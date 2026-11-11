// Relatório de Inadimplência / Responsabilidade: títulos de OPEITE (tipos DUP,
// CHE e PRO) com STATUS = 'IN' (inadimplência) e/ou 'DO'/'PR' (responsabilidade).
// DC e CO nunca entram. Lê a réplica do Supabase, como o Relatório de Borderôs — os
// filtros por intervalo (gte/lte) não são traduzidos para o Firebird.

import { supabase } from '../lib/supabase'
import { firebirdApi } from './firebirdApi'

export const TIPOS_INADIMPLENCIA = ['DUP', 'CHE', 'PRO']
export const STATUS_INADIMPLENCIA = ['IN']
export const STATUS_RESPONSABILIDADE = ['DO', 'PR']

// Status a buscar conforme os checkboxes da tela.
export const statusSelecionados = (f) => [
  ...(f.inadimplencia ? STATUS_INADIMPLENCIA : []),
  ...(f.responsabilidade ? STATUS_RESPONSABILIDADE : []),
]

// Nome do relatório conforme os status incluídos.
export function nomeRelatorio(f) {
  if (f.analise) return 'Análise de Sacados'
  if (f.responsabilidade && f.inadimplencia) return 'Responsabilidade + Inadimplência'
  if (f.responsabilidade) return 'Responsabilidade'
  return 'Inadimplência'
}

// Data de hoje (local) no formato YYYY-MM-DD.
const hojeISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Dias corridos entre duas datas YYYY-MM-DD (b - a).
const diasEntre = (a, b) => {
  const [y1, m1, d1] = String(a).slice(0, 10).split('-').map(Number)
  const [y2, m2, d2] = String(b).slice(0, 10).split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000)
}

const num = (v) => (v == null || v === '' ? null : parseFloat(v))

// Executa fn em cada item com no máximo `n` chamadas simultâneas.
async function emParalelo(itens, n, fn) {
  const fila = [...itens]
  const worker = async () => { while (fila.length) await fn(fila.shift()) }
  await Promise.all(Array.from({ length: Math.min(n, itens.length) }, worker))
}

/**
 * Parâmetros de atraso, lidos do Firebird (não existem na réplica):
 *  - taxa por título:  OPEITE.TAXA_OCORRE (% a.m.)
 *  - taxa do cedente:  CEDENTE.TAXA_OCORRENCIA (% a.m.) — usada quando o título não tem
 *  - saldo do título:  OPEITE.VR_SALDO (base da correção; senão VR_FACE)
 * Lê só o necessário para os títulos que precisam de correção:
 *  - cedentesIN: cedentes com títulos IN (em lote: OPEITE?COD_CEDENTE&STATUS=IN)
 *  - chavesAvulsas: títulos DO/PR já vencidos (um a um pela PK)
 *  - cedentesTaxa: cedentes cuja taxa padrão pode ser necessária
 * Retorna { titulos: Map(KEY -> {taxa, saldo}), cedentes: Map(cod -> taxa), ok }.
 */
async function getParametrosAtraso({ cedentesIN, chavesAvulsas, cedentesTaxa }) {
  const titulos = new Map()
  const cedentes = new Map()
  let ok = true
  const guardar = (t) => titulos.set(`${t.COD_CEDENTE}~${t.COD_OPERACAO}~${t.NUM_LANCAMENTO}`, {
    taxa: num(t.TAXA_OCORRE),
    saldo: num(t.VR_SALDO),
  })
  const tarefas = [
    ...cedentesIN.map((cod) => async () => {
      const r = await firebirdApi.list('OPEITE', { COD_CEDENTE: cod, STATUS: 'IN', limit: 500 })
      if (r.error) ok = false
      ;(r.data?.rows || []).forEach(guardar)
    }),
    ...chavesAvulsas.map((key) => async () => {
      const r = await firebirdApi.get('OPEITE', key)
      if (r.error) ok = false
      const row = r.data?.row || r.data
      if (row && row.COD_CEDENTE != null) guardar(row)
    }),
    ...cedentesTaxa.map((cod) => async () => {
      const r = await firebirdApi.get('CEDENTE', String(cod))
      if (r.error) ok = false
      const row = r.data?.row || r.data
      if (row && row.COD_CEDENTE != null) cedentes.set(Number(cod), num(row.TAXA_OCORRENCIA))
    }),
  ]
  await emParalelo(tarefas, 6, (fn) => fn())
  return { titulos, cedentes, ok }
}

/**
 * Valor corrigido pelo mesmo critério do sistema (juros compostos mensais, pro rata die):
 *   corrigido = base × (1 + taxa/100) ^ (dias/30)
 */
export function calcularCorrigido(base, taxa, dias) {
  if (!(dias > 0) || !(taxa > 0)) return base
  return Math.round(base * Math.pow(1 + taxa / 100, dias / 30) * 100) / 100
}

const PAGE = 1000
const CHUNK = 200

const chunks = (arr, n) => {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

const temValor = (v) => v !== '' && v != null

/**
 * Busca os títulos (inadimplência e/ou responsabilidade).
 * @param {object} f { codCedente, codOperacao, tipos: string[], inadimplencia, responsabilidade,
 *   dtVenciIni, dtVenciFim, vrFaceMin, vrFaceMax, dtEmissaoIni, dtEmissaoFim }
 * Vencimento considerado = DT_VENCI_NOVO (prorrogação) ou DT_VENCI.
 * Emissão = DT_LANCA (OPEITE não tem data de emissão própria).
 */
export async function getTitulosInadimplentes(f) {
  try {
    const tipos = f.tipos?.length ? f.tipos : TIPOS_INADIMPLENCIA
    const status = statusSelecionados(f)
    if (status.length === 0) return { data: [], error: null, parametrosOk: true }

    const build = () => {
      let q = supabase
        .from('OPEITE')
        .select('COD_CEDENTE, COD_OPERACAO, NUM_LANCAMENTO, NUM_TITULO, DT_LANCA, TIPO_TITULO, VR_FACE, DT_VENCI, DT_VENCI_NOVO, STATUS, COD_SACADO')
        .in('STATUS', status)
        .in('TIPO_TITULO', tipos)
      if (temValor(f.codCedente)) q = q.eq('COD_CEDENTE', Number(f.codCedente))
      // "Borderô" na tela = operação (OPEITE.COD_OPERACAO; numeração por cedente)
      if (temValor(f.codOperacao)) q = q.eq('COD_OPERACAO', Number(f.codOperacao))
      if (temValor(f.vrFaceMin)) q = q.gte('VR_FACE', Number(f.vrFaceMin))
      if (temValor(f.vrFaceMax)) q = q.lte('VR_FACE', Number(f.vrFaceMax))
      if (f.dtEmissaoIni) q = q.gte('DT_LANCA', f.dtEmissaoIni)
      if (f.dtEmissaoFim) q = q.lte('DT_LANCA', f.dtEmissaoFim)
      return q
        .order('COD_CEDENTE', { ascending: true })
        .order('COD_OPERACAO', { ascending: true })
        .order('NUM_LANCAMENTO', { ascending: true })
    }

    const titulos = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await build().range(from, from + PAGE - 1)
      if (error) throw error
      titulos.push(...(data || []))
      if (!data || data.length < PAGE) break
    }

    // Vencimento efetivo (considera prorrogação) — filtrado aqui.
    const filtrados = titulos.filter((t) => {
      const v = t.DT_VENCI_NOVO || t.DT_VENCI || ''
      if (f.dtVenciIni && (!v || v < f.dtVenciIni)) return false
      if (f.dtVenciFim && (!v || v > f.dtVenciFim)) return false
      return true
    })

    const sacados = new Map()
    const codSacados = [...new Set(filtrados.map((t) => t.COD_SACADO).filter((v) => v != null))]
    for (const c of chunks(codSacados, CHUNK)) {
      const { data, error } = await supabase
        .from('SACADO')
        .select('COD_SACADO, NOME_CORRENTISTA, CIC')
        .in('COD_SACADO', c)
      if (error) throw error
      ;(data || []).forEach((s) => sacados.set(s.COD_SACADO, s))
    }

    const cedentes = new Map()
    const codCedentes = [...new Set(filtrados.map((t) => t.COD_CEDENTE).filter((v) => v != null))]
    for (const c of chunks(codCedentes, CHUNK)) {
      const { data, error } = await supabase
        .from('CEDENTE')
        .select('COD_CEDENTE, RAZAO_SOCIAL, NOME_FANTASIA')
        .in('COD_CEDENTE', c)
      if (error) throw error
      ;(data || []).forEach((ce) => cedentes.set(ce.COD_CEDENTE, ce))
    }

    const hoje = hojeISO()
    const vencEfetivo = (t) => t.DT_VENCI_NOVO || t.DT_VENCI
    const vencido = (t) => !!vencEfetivo(t) && diasEntre(vencEfetivo(t), hoje) > 0
    // Precisam de correção: todos os IN e os DO/PR já vencidos.
    const corrigir = filtrados.filter((t) => t.STATUS === 'IN' || vencido(t))
    const params = await getParametrosAtraso({
      cedentesIN: [...new Set(corrigir.filter((t) => t.STATUS === 'IN').map((t) => t.COD_CEDENTE))],
      chavesAvulsas: corrigir.filter((t) => t.STATUS !== 'IN').map((t) => `${t.COD_CEDENTE}~${t.COD_OPERACAO}~${t.NUM_LANCAMENTO}`),
      cedentesTaxa: [...new Set(corrigir.map((t) => t.COD_CEDENTE))],
    })

    const rows = filtrados.map((t) => {
      const s = sacados.get(t.COD_SACADO)
      const ce = cedentes.get(t.COD_CEDENTE)
      const KEY = `${t.COD_CEDENTE}~${t.COD_OPERACAO}~${t.NUM_LANCAMENTO}`
      const VENCIMENTO = t.DT_VENCI_NOVO || t.DT_VENCI
      const VR_FACE = parseFloat(t.VR_FACE) || 0
      const DIAS_ATRASO = VENCIMENTO ? Math.max(0, diasEntre(VENCIMENTO, hoje)) : 0

      // Taxa: do título (OPEITE.TAXA_OCORRE); se vazia, do cedente (CEDENTE.TAXA_OCORRENCIA).
      const p = params.titulos.get(KEY)
      let TAXA_ATRASO = null
      let ORIGEM_TAXA = ''
      if (p?.taxa != null) { TAXA_ATRASO = p.taxa; ORIGEM_TAXA = 'OPEITE' }
      else if (params.cedentes.get(Number(t.COD_CEDENTE)) != null) {
        TAXA_ATRASO = params.cedentes.get(Number(t.COD_CEDENTE)); ORIGEM_TAXA = 'CEDENTE'
      }
      let BASE_CORRECAO = p?.saldo > 0 ? p.saldo : VR_FACE
      let VR_CORRIGIDO = TAXA_ATRASO == null ? null : calcularCorrigido(BASE_CORRECAO, TAXA_ATRASO, DIAS_ATRASO)
      // Responsabilidade (DO/PR) ainda a vencer: corrigido repete o valor.
      if (t.STATUS !== 'IN' && DIAS_ATRASO === 0) {
        TAXA_ATRASO = null; ORIGEM_TAXA = 'A VENCER'; BASE_CORRECAO = VR_FACE; VR_CORRIGIDO = VR_FACE
      }

      return {
        ...t,
        KEY,
        VENCIMENTO,
        PRORROGADO: !!t.DT_VENCI_NOVO,
        NOME_SACADO: s?.NOME_CORRENTISTA || '',
        CIC_SACADO: s?.CIC || '',
        NOME_CEDENTE: ce?.RAZAO_SOCIAL || ce?.NOME_FANTASIA || '',
        VR_FACE,
        DIAS_ATRASO,
        TAXA_ATRASO,
        ORIGEM_TAXA,
        BASE_CORRECAO,
        VR_CORRIGIDO,
      }
    })
    return { data: rows, error: null, parametrosOk: params.ok }
  } catch (error) {
    console.error('[relatorioInadimplencia] erro:', error)
    return { data: [], error }
  }
}

/**
 * Borderôs (operações) de um cedente, de OPECAB, do mais recente para o mais antigo.
 * Retorna [{ COD_OPERACAO, DATA, VR_FACE, QTD_TITULOS }].
 */
export async function getBorderosCedente(codCedente) {
  try {
    const rows = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('OPECAB')
        .select('COD_OPERACAO, DATA, VR_FACE, QTD_TITULOS')
        .eq('COD_CEDENTE', Number(codCedente))
        .order('DATA', { ascending: false, nullsFirst: false })
        .order('COD_OPERACAO', { ascending: false })
        .range(from, from + PAGE - 1)
      if (error) throw error
      rows.push(...(data || []))
      if (!data || data.length < PAGE) break
    }
    return { data: rows, error: null }
  } catch (error) {
    console.error('[relatorioInadimplencia] borderôs:', error)
    return { data: [], error }
  }
}

// ---------------------------------------------------------------------------
// Análise de sacados
// ---------------------------------------------------------------------------

// Vencimento em sábado/domingo passa para a segunda-feira (pagamento em dia).
function proximoDiaUtil(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dow = dt.getUTCDay()
  if (dow === 6) dt.setUTCDate(dt.getUTCDate() + 2)
  else if (dow === 0) dt.setUTCDate(dt.getUTCDate() + 1)
  return dt.toISOString().slice(0, 10)
}

// Todas as linhas de OPEITE (Firebird) de um sacado, paginando de 500 em 500.
async function opeiteDoSacado(codSacado) {
  const out = []
  for (let offset = 0; offset < 50000; offset += 500) {
    const r = await firebirdApi.list('OPEITE', { COD_SACADO: codSacado, limit: 500, offset })
    if (r.error) throw r.firebirdDown ? new Error('Firebird indisponível') : r.error
    const rows = r.data?.rows || []
    out.push(...rows)
    if (rows.length < 500) break
  }
  return out
}

const resumo = () => ({ qtd: 0, total: 0 })

/**
 * Análise dos sacados de um borderô (operação) de um cedente.
 * Para cada sacado presente no borderô, olha TODOS os títulos dele (todos os
 * cedentes, só dos tipos marcados), lidos do Firebird (a réplica não tem
 * DT_OCORRE/VR_PAGO):
 *  - aVencer:      STATUS DO/PR, detalhados
 *  - inadimplentes: STATUS IN, detalhados
 *  - coEmDia:      STATUS CO com DT_OCORRE <= vencimento (fim de semana -> segunda) — só total
 *  - coAtraso:     STATUS CO pagos depois do vencimento — só total
 * Retorna { data: [{ COD_SACADO, NOME_SACADO, CIC_SACADO, aVencer, inadimplentes, coEmDia, coAtraso }], error, parametrosOk }.
 */
export async function getAnaliseSacados(f) {
  try {
    const tipos = f.tipos?.length ? f.tipos : TIPOS_INADIMPLENCIA
    const { data: itens, error } = await supabase
      .from('OPEITE')
      .select('COD_SACADO')
      .eq('COD_CEDENTE', Number(f.codCedente))
      .eq('COD_OPERACAO', Number(f.codOperacao))
    if (error) throw error
    const codSacados = [...new Set((itens || []).map((i) => i.COD_SACADO).filter((v) => v != null))]
    if (codSacados.length === 0) return { data: [], error: null, parametrosOk: true }

    // Títulos de cada sacado (Firebird)
    const porSacado = new Map()
    await emParalelo(codSacados, 4, async (cod) => {
      const rows = await opeiteDoSacado(cod)
      porSacado.set(cod, rows.filter((t) => tipos.includes(t.TIPO_TITULO)))
    })

    // Nomes de sacados e cedentes (réplica)
    const sacados = new Map()
    const { data: sacs, error: e1 } = await supabase.from('SACADO').select('COD_SACADO, NOME_CORRENTISTA, CIC').in('COD_SACADO', codSacados)
    if (e1) throw e1
    ;(sacs || []).forEach((s) => sacados.set(s.COD_SACADO, s))
    const todos = [...porSacado.values()].flat()
    const codCedentes = [...new Set(todos.map((t) => t.COD_CEDENTE).filter((v) => v != null))]
    const cedentes = new Map()
    for (const c of chunks(codCedentes, CHUNK)) {
      const { data, error: e2 } = await supabase.from('CEDENTE').select('COD_CEDENTE, RAZAO_SOCIAL, NOME_FANTASIA').in('COD_CEDENTE', c)
      if (e2) throw e2
      ;(data || []).forEach((ce) => cedentes.set(ce.COD_CEDENTE, ce))
    }

    // Taxa padrão do cedente, para os títulos sem TAXA_OCORRE que precisam de correção
    const hoje = hojeISO()
    const venc = (t) => t.DT_VENCI_NOVO || t.DT_VENCI
    const atrasado = (t) => !!venc(t) && diasEntre(venc(t), hoje) > 0
    const precisaTaxaCedente = todos.filter((t) => ['IN', 'DO', 'PR'].includes(t.STATUS) && (t.STATUS === 'IN' || atrasado(t)) && num(t.TAXA_OCORRE) == null)
    const { cedentes: taxasCedente, ok } = await getParametrosAtraso({
      cedentesIN: [], chavesAvulsas: [],
      cedentesTaxa: [...new Set(precisaTaxaCedente.map((t) => t.COD_CEDENTE))],
    })

    const linha = (t) => {
      const VENCIMENTO = venc(t)
      const VR_FACE = parseFloat(t.VR_FACE) || 0
      const DIAS_ATRASO = VENCIMENTO ? Math.max(0, diasEntre(VENCIMENTO, hoje)) : 0
      let TAXA_ATRASO = num(t.TAXA_OCORRE)
      let ORIGEM_TAXA = TAXA_ATRASO != null ? 'OPEITE' : ''
      if (TAXA_ATRASO == null && taxasCedente.get(Number(t.COD_CEDENTE)) != null) {
        TAXA_ATRASO = taxasCedente.get(Number(t.COD_CEDENTE)); ORIGEM_TAXA = 'CEDENTE'
      }
      let BASE_CORRECAO = num(t.VR_SALDO) > 0 ? num(t.VR_SALDO) : VR_FACE
      let VR_CORRIGIDO = TAXA_ATRASO == null ? null : calcularCorrigido(BASE_CORRECAO, TAXA_ATRASO, DIAS_ATRASO)
      if (t.STATUS !== 'IN' && DIAS_ATRASO === 0) {
        TAXA_ATRASO = null; ORIGEM_TAXA = 'A VENCER'; BASE_CORRECAO = VR_FACE; VR_CORRIGIDO = VR_FACE
      }
      const ce = cedentes.get(t.COD_CEDENTE)
      return {
        COD_CEDENTE: t.COD_CEDENTE,
        COD_OPERACAO: t.COD_OPERACAO,
        NUM_LANCAMENTO: t.NUM_LANCAMENTO,
        NUM_TITULO: t.NUM_TITULO,
        TIPO_TITULO: t.TIPO_TITULO,
        STATUS: t.STATUS,
        DT_LANCA: t.DT_LANCA,
        DT_VENCI: t.DT_VENCI,
        KEY: `${t.COD_CEDENTE}~${t.COD_OPERACAO}~${t.NUM_LANCAMENTO}`,
        VENCIMENTO,
        PRORROGADO: !!t.DT_VENCI_NOVO,
        NOME_CEDENTE: ce?.RAZAO_SOCIAL || ce?.NOME_FANTASIA || '',
        DO_BORDERO: Number(t.COD_CEDENTE) === Number(f.codCedente) && Number(t.COD_OPERACAO) === Number(f.codOperacao),
        VR_FACE, DIAS_ATRASO, TAXA_ATRASO, ORIGEM_TAXA, BASE_CORRECAO, VR_CORRIGIDO,
      }
    }
    const porVenc = (a, b) => String(a.VENCIMENTO || '').localeCompare(String(b.VENCIMENTO || '')) || a.NUM_LANCAMENTO - b.NUM_LANCAMENTO

    const data = codSacados.map((cod) => {
      const s = sacados.get(cod)
      const ts = porSacado.get(cod) || []
      const coEmDia = resumo()
      const coAtraso = resumo()
      for (const t of ts.filter((x) => x.STATUS === 'CO')) {
        const v = venc(t)
        const pago = t.DT_OCORRE ? String(t.DT_OCORRE).slice(0, 10) : null
        const alvo = !v || !pago || pago <= proximoDiaUtil(v) ? coEmDia : coAtraso
        alvo.qtd += 1
        alvo.total += parseFloat(t.VR_FACE) || 0
      }
      return {
        COD_SACADO: cod,
        NOME_SACADO: s?.NOME_CORRENTISTA || '',
        CIC_SACADO: s?.CIC || '',
        aVencer: ts.filter((t) => t.STATUS === 'DO' || t.STATUS === 'PR').map(linha).sort(porVenc),
        inadimplentes: ts.filter((t) => t.STATUS === 'IN').map(linha).sort(porVenc),
        coEmDia,
        coAtraso,
      }
    }).sort((a, b) => a.NOME_SACADO.localeCompare(b.NOME_SACADO, 'pt-BR'))

    return { data, error: null, parametrosOk: ok }
  } catch (error) {
    console.error('[relatorioInadimplencia] análise:', error)
    return { data: [], error }
  }
}

// Soma de uma lista de linhas detalhadas (valor e corrigido).
export const somaLinhas = (rows) => ({
  qtd: rows.length,
  total: rows.reduce((s, r) => s + r.VR_FACE, 0),
  corrigido: rows.reduce((s, r) => s + corrigidoOuValor(r), 0),
})

// Status presentes por cedente (IN, DO, PR) — usado para montar o combobox.
// Retorna Map(COD_CEDENTE -> Set(STATUS)).
export async function getStatusPorCedente() {
  const m = new Map()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('OPEITE')
      .select('COD_CEDENTE, STATUS')
      .in('STATUS', [...STATUS_INADIMPLENCIA, ...STATUS_RESPONSABILIDADE])
      .in('TIPO_TITULO', TIPOS_INADIMPLENCIA)
      .order('COD_CEDENTE', { ascending: true })
      .order('COD_OPERACAO', { ascending: true })
      .order('NUM_LANCAMENTO', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) return { data: null, error }
    for (const r of data || []) {
      const c = Number(r.COD_CEDENTE)
      if (!m.has(c)) m.set(c, new Set())
      m.get(c).add(r.STATUS)
    }
    if (!data || data.length < PAGE) break
  }
  return { data: m, error: null }
}

// Para totais: sem taxa definida, o título entra pelo valor de face.
export const corrigidoOuValor = (r) => (r.VR_CORRIGIDO ?? r.VR_FACE)

export const AGRUPAMENTOS = [
  { value: 'nenhum', label: 'Sem agrupar' },
  { value: 'cedente', label: 'Por Cedente' },
  { value: 'sacado', label: 'Por Sacado' },
]

/**
 * Agrupa os títulos (na ordem recebida) por cedente ou sacado.
 * Grupos em ordem alfabética do nome; dentro do grupo, mantém a ordem recebida.
 * Retorna [{ chave, cod, nome, cic, rows, qtd, total, corrigido }]; 'nenhum' → um grupo só.
 */
export function agruparTitulos(rows, modo) {
  if (modo !== 'cedente' && modo !== 'sacado') {
    return [{ chave: 'todos', cod: null, nome: '', cic: '', rows, qtd: rows.length, total: rows.reduce((s, r) => s + r.VR_FACE, 0), corrigido: rows.reduce((s, r) => s + corrigidoOuValor(r), 0) }]
  }
  const m = new Map()
  for (const r of rows) {
    const chave = modo === 'cedente' ? `c${r.COD_CEDENTE}` : `s${r.COD_SACADO ?? ''}`
    if (!m.has(chave)) {
      const g = modo === 'cedente'
        ? { cod: r.COD_CEDENTE, nome: r.NOME_CEDENTE || '', cic: '' }
        : { cod: r.COD_SACADO, nome: r.NOME_SACADO || '', cic: r.CIC_SACADO || '' }
      m.set(chave, { chave, ...g, rows: [], qtd: 0, total: 0, corrigido: 0 })
    }
    const g = m.get(chave)
    g.rows.push(r)
    g.qtd += 1
    g.total += r.VR_FACE
    g.corrigido += corrigidoOuValor(r)
  }
  return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.chave.localeCompare(b.chave))
}

// Somatório por cedente (usado quando o filtro de cedente é "Todos").
export function totaisPorCedente(rows) {
  const m = new Map()
  for (const r of rows) {
    if (!m.has(r.COD_CEDENTE)) {
      m.set(r.COD_CEDENTE, { COD_CEDENTE: r.COD_CEDENTE, NOME_CEDENTE: r.NOME_CEDENTE, qtd: 0, total: 0, corrigido: 0 })
    }
    const g = m.get(r.COD_CEDENTE)
    g.qtd += 1
    g.total += r.VR_FACE
    g.corrigido += corrigidoOuValor(r)
  }
  return [...m.values()].sort((a, b) => b.total - a.total)
}
