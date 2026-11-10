// Relatório de Conta Corrente (extrato do cedente).
// Os lançamentos vêm da tabela CTACORRENTE do Firebird — ela não é replicada no
// Supabase. Os dados dos títulos citados no histórico (nº, valor, vencimento e
// sacado) vêm da réplica (OPEITE e SACADO), que é bem mais rápida para buscar em lote.

import { supabase } from '../lib/supabase'
import { firebirdApi } from './firebirdApi'

const LIMITE = 500 // máximo de linhas por chamada da API Firebird
const CHUNK = 200

const chunks = (arr, n) => {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

export const hojeISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Dia anterior a uma data YYYY-MM-DD.
const diaAnterior = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d - 1))
  return dt.toISOString().slice(0, 10)
}

const centavos = (v) => Math.round((parseFloat(v) || 0) * 100)

const fmtValor = (v) =>
  (parseFloat(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// dd/mm/aa
const fmtDataCurta = (d) => {
  const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1].slice(2)}` : ''
}

// Lê todos os lançamentos do cedente (a API não ordena; pagina por offset).
async function lerCtaCorrente(codCedente) {
  const linhas = []
  const vistos = new Set()
  for (let offset = 0; ; offset += LIMITE) {
    const r = await firebirdApi.list('CTACORRENTE', { COD_CEDENTE: codCedente, limit: LIMITE, offset })
    if (r.error) throw new Error(`Firebird: ${r.error.message || r.error}`)
    const rows = r.data?.rows || []
    let novos = 0
    for (const x of rows) {
      if (vistos.has(x.NUM_OCORRENCIA)) continue
      vistos.add(x.NUM_OCORRENCIA)
      linhas.push(x)
      novos++
    }
    if (rows.length < LIMITE || novos === 0) break
  }
  return linhas.sort((a, b) =>
    String(a.DT_REFERENCIA || '').localeCompare(String(b.DT_REFERENCIA || '')) || a.NUM_OCORRENCIA - b.NUM_OCORRENCIA)
}

// Títulos citados pelos lançamentos (NUM_LANCAMENTO) com o nome do sacado.
async function lerTitulos(codCedente, numLancamentos) {
  const titulos = new Map()
  for (const c of chunks(numLancamentos, CHUNK)) {
    const { data, error } = await supabase
      .from('OPEITE')
      .select('NUM_LANCAMENTO, NUM_TITULO, TIPO_TITULO, VR_FACE, DT_VENCI, COD_SACADO')
      .eq('COD_CEDENTE', codCedente)
      .in('NUM_LANCAMENTO', c)
    if (error) throw error
    ;(data || []).forEach((t) => titulos.set(Number(t.NUM_LANCAMENTO), t))
  }
  const codSacados = [...new Set([...titulos.values()].map((t) => t.COD_SACADO).filter((v) => v != null))]
  const sacados = new Map()
  for (const c of chunks(codSacados, CHUNK)) {
    const { data, error } = await supabase.from('SACADO').select('COD_SACADO, NOME_CORRENTISTA').in('COD_SACADO', c)
    if (error) throw error
    ;(data || []).forEach((s) => sacados.set(s.COD_SACADO, s.NOME_CORRENTISTA || ''))
  }
  for (const t of titulos.values()) t.NOME_SACADO = sacados.get(t.COD_SACADO) || ''
  return titulos
}

/**
 * Histórico como no extrato do sistema:
 *  - Juros de prorrogação  -> "PRORR DUP 9126-02 2.000,00 30/09/26 SACADO"
 *  - Montante de cobertura -> "COBER DUP 5927-03 1.650,00 18/09/26 SACADO"
 *  - com IDENTIFICADOR     -> "<histórico> - <identificador>" (ex.: "LANC.MAN. - PIX ...")
 *  - demais                -> o próprio HISTORICO
 */
function montarHistorico(x, titulos) {
  const h = String(x.HISTORICO || '').trim()
  const t = x.NUM_LANCAMENTO != null ? titulos.get(Number(x.NUM_LANCAMENTO)) : null
  const prefixo = /^juros de prorroga/i.test(h) ? 'PRORR' : /^montante de cobertura/i.test(h) ? 'COBER' : null
  if (prefixo && t) {
    return [prefixo, t.TIPO_TITULO || 'DUP', t.NUM_TITULO, fmtValor(t.VR_FACE), fmtDataCurta(t.DT_VENCI), t.NOME_SACADO]
      .filter(Boolean).join(' ')
  }
  const id = String(x.IDENTIFICADOR || '').trim()
  return id ? `${h} - ${id}` : h
}

/**
 * Extrato da conta corrente do cedente.
 * Saldo = créditos (C) - débitos (D), acumulado em ordem de data e nº da ocorrência.
 * Lançamentos com data posterior a hoje vão para "Lançamentos futuros" e não entram no saldo.
 * @param dtIni YYYY-MM-DD; vazio = a partir da última vez em que o saldo ficou zerado
 *   (os lançamentos começam logo depois do que zerou a conta; se nunca zerou, desde o início).
 * @returns {{ data: { saldoAnterior, dtSaldoAnterior, dtIni, desdeZerado, lancamentos (do mais antigo
 *   ao mais novo), futuros, saldoFinal, saldoBloqueado } | null, error }}
 */
export async function getExtratoContaCorrente(codCedente, dtIni) {
  try {
    const cod = Number(codCedente)
    const hoje = hojeISO()
    const [todos, ced] = await Promise.all([lerCtaCorrente(cod), firebirdApi.get('CEDENTE', String(cod))])

    const sinal = (x) => (x.TIPO_LANCAMENTO === 'C' ? 1 : -1)
    const ateHoje = todos.filter((x) => String(x.DT_REFERENCIA || '') <= hoje)
    const futuros = todos.filter((x) => String(x.DT_REFERENCIA || '') > hoje)

    let anteriores, periodo, dtSaldoAnterior
    const desdeZerado = !dtIni
    if (desdeZerado) {
      // Último lançamento depois do qual o saldo acumulado ficou em zero.
      let acumulado = 0
      let corte = -1
      ateHoje.forEach((x, i) => {
        acumulado += sinal(x) * centavos(x.VALOR)
        if (acumulado === 0) corte = i
      })
      anteriores = ateHoje.slice(0, corte + 1)
      periodo = ateHoje.slice(corte + 1)
      dtSaldoAnterior = corte >= 0 ? ateHoje[corte].DT_REFERENCIA : (periodo[0] ? diaAnterior(periodo[0].DT_REFERENCIA) : hoje)
      dtIni = corte >= 0 ? ateHoje[corte].DT_REFERENCIA : (periodo[0]?.DT_REFERENCIA || hoje)
    } else {
      anteriores = ateHoje.filter((x) => String(x.DT_REFERENCIA || '') < dtIni)
      periodo = ateHoje.filter((x) => String(x.DT_REFERENCIA || '') >= dtIni)
      dtSaldoAnterior = diaAnterior(dtIni)
    }

    const numLancs = [...new Set([...periodo, ...futuros].map((x) => x.NUM_LANCAMENTO).filter((v) => v != null).map(Number))]
    const titulos = await lerTitulos(cod, numLancs)

    let saldo = anteriores.reduce((s, x) => s + sinal(x) * centavos(x.VALOR), 0)
    const saldoAnterior = saldo / 100

    const lancamentos = periodo.map((x) => {
      saldo += sinal(x) * centavos(x.VALOR)
      return {
        ID: x.NUM_OCORRENCIA,
        DATA: x.DT_REFERENCIA,
        VALOR: centavos(x.VALOR) / 100,
        DC: x.TIPO_LANCAMENTO === 'C' ? 'C' : 'D',
        HISTORICO: montarHistorico(x, titulos),
        SALDO: saldo / 100,
      }
    })

    const cedRow = ced.data?.row || ced.data
    return {
      data: {
        saldoAnterior,
        dtSaldoAnterior,
        dtIni,
        desdeZerado,
        lancamentos,
        futuros: futuros.map((x) => ({
          ID: x.NUM_OCORRENCIA,
          DATA: x.DT_REFERENCIA,
          VALOR: centavos(x.VALOR) / 100,
          DC: x.TIPO_LANCAMENTO === 'C' ? 'C' : 'D',
          HISTORICO: montarHistorico(x, titulos),
        })),
        saldoFinal: saldo / 100,
        saldoBloqueado: parseFloat(cedRow?.VR_BLOQUEADO) || 0,
        totalLancamentos: todos.length,
      },
      error: null,
    }
  } catch (error) {
    console.error('[relatorioContaCorrente] erro:', error)
    return { data: null, error }
  }
}

// Indicador C/D do saldo. No extrato do sistema o saldo zerado sai como "D"
// (o saldo bloqueado zerado sai como "C" — passe zero = 'C').
export const dcSaldo = (saldo, zero = 'D') =>
  Math.abs(saldo) < 0.005 ? zero : saldo > 0 ? 'C' : 'D'
