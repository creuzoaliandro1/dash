// Antecipação gravada DIRETO no Firebird (OPECABWEB / OPEITEWEB / SACADOWEB),
// via a Edge Function proxy. Espelha a lógica de criarAntecipacao/retornarAntecipacao
// do boletoService, mas escrevendo no Firebird em vez do Supabase.
//
// Schema confirmado via GET /_tables (2026-09):
//   OPECABWEB  PK (COD_CEDENTE, COD_BORDERO)            -> _id "ced~bordero"
//   OPEITEWEB  PK (COD_CEDENTE, COD_BORDERO, COD_TITULO) -> _id "ced~bordero~titulo"
//   SACADOWEB  PK (CIC_SACADO)                           -> _id "cic"
//
// Alocação de códigos (autoritativa do Firebird):
//   COD_OPERACAO = max(OPECABWEB.COD_OPERACAO onde COD_CEDENTE=ced) + 1
//   COD_BORDERO  = max(OPECABWEB.COD_BORDERO) + 1  (global)
//   COD_TITULO   = max(OPEITEWEB.COD_TITULO no último borderô) + 1  (sequência global;
//                  validado: o maior título global está sempre no último borderô)

import { firebirdApi } from './firebirdApi'
import { writeThrough } from './firebirdRepo'

const PREFIXO_NOSSO_NUMERO = '36877480' // 8 dígitos

const trunc = (s, n) => (s == null ? '' : String(s).slice(0, n))
const soDigitos = (s) => String(s ?? '').replace(/\D/g, '')

// Lista TODAS as linhas de uma tabela (pagina de 500 em 500 até acabar).
async function listAll(table, query = {}, capPaginas = 40) {
  const out = []
  for (let p = 0; p < capPaginas; p++) {
    const r = await firebirdApi.list(table, { ...query, limit: 500, offset: p * 500 })
    if (r.error) return { rows: out, error: r.error, firebirdDown: r.firebirdDown }
    const rows = r.data?.rows ?? []
    out.push(...rows)
    if (rows.length < 500) break
  }
  return { rows: out, error: null, firebirdDown: false }
}

// Aloca os próximos códigos a partir do Firebird.
async function alocarCodigos(codCedente) {
  const ced = parseInt(codCedente)
  const cab = await listAll('OPECABWEB')
  if (cab.error) return { error: cab.error, firebirdDown: cab.firebirdDown }

  let maxBordero = 0, maxOper = 0
  for (const r of cab.rows) {
    const b = parseInt(r.COD_BORDERO || 0); if (b > maxBordero) maxBordero = b
    if (parseInt(r.COD_CEDENTE) === ced) {
      const o = parseInt(r.COD_OPERACAO || 0); if (o > maxOper) maxOper = o
    }
  }
  const proximoCodBordero = maxBordero + 1
  const proximoCodOperacao = maxOper + 1

  // COD_TITULO: maior título do último borderô (== maior global, validado).
  let maxTit = 0
  if (maxBordero > 0) {
    const tit = await firebirdApi.list('OPEITEWEB', { COD_BORDERO: maxBordero, limit: 500 })
    if (tit.error) return { error: tit.error, firebirdDown: tit.firebirdDown }
    for (const r of (tit.data?.rows ?? [])) {
      const t = parseInt(r.COD_TITULO || 0); if (t > maxTit) maxTit = t
    }
  }
  return { proximoCodOperacao, proximoCodBordero, proximoCodTitulo: maxTit + 1 }
}

export async function criarAntecipacaoFirebird(boletosParaAntecipar, contaData) {
  try {
    if (!contaData || !contaData.cod_cedente) throw new Error('Conta sem cod_cedente definido')
    const codCedente = parseInt(contaData.cod_cedente)

    // 1. Alocar códigos no Firebird. Se estiver fora do ar aqui, não dá pra
    //    alocar com segurança — devolve erro para o usuário tentar de novo.
    const aloc = await alocarCodigos(codCedente)
    if (aloc.error) {
      return { data: null, error: new Error('Firebird indisponível para antecipar: ' + (aloc.error.message || aloc.error)) }
    }
    const { proximoCodOperacao, proximoCodBordero } = aloc
    let codTitulo = aloc.proximoCodTitulo

    const agora = new Date()
    const dtRecepcao = agora.toISOString().split('T')[0]
    const hrRecepcao = agora.toTimeString().split(' ')[0]

    // 2. SACADOWEB (best-effort; duplicata de CIC é ok).
    for (const b of boletosParaAntecipar) {
      const cic = soDigitos(b.sacado_cic).slice(0, 14)
      if (!cic) continue
      const payload = {
        CIC_SACADO: cic,
        NOME_SACADO: trunc(b.sacado_nome, 60),
        CEP: trunc(b.sacado_cep, 9),
        NOME_LOGRADOURO: trunc(b.sacado_endereco, 60),
        BAIRRO: trunc(b.sacado_bairro, 40),
        LOCALIDADE: trunc(b.sacado_cidade, 40),
        UF: trunc(b.sacado_uf, 2),
      }
      await firebirdApi.create('SACADOWEB', payload) // ignora erro/duplicata
    }

    // 3. OPECABWEB (cabeçalho).
    const cab = {
      COD_CEDENTE: codCedente,
      COD_BORDERO: proximoCodBordero,
      COD_OPERACAO: proximoCodOperacao,
      DT_RECEPCAO: dtRecepcao,
      HR_RECEPCAO: hrRecepcao,
      STATUS: 'R',
    }
    const cabRes = await writeThrough({
      op: 'POST', table: 'OPECABWEB', id: `${codCedente}~${proximoCodBordero}`, payload: cab,
      firebird: () => firebirdApi.create('OPECABWEB', cab),
    })
    if (cabRes.error && !cabRes.queued) {
      return { data: null, error: cabRes.error }
    }

    // 4. OPEITEWEB (um título por boleto, COD_TITULO sequencial).
    const codTituloInicio = codTitulo
    let enfileirados = 0, gravados = 0
    for (const b of boletosParaAntecipar) {
      const numeroRaw = String(b.numero_documento || '').trim()
      const numero = (/^\d+$/.test(numeroRaw) ? numeroRaw.replace(/^0+/, '') : numeroRaw).slice(-8) || '0'
      const nossoNumero = (PREFIXO_NOSSO_NUMERO + soDigitos(b.nosso_numero).padStart(9, '0')).slice(0, 30)

      const reg = {
        COD_CEDENTE: codCedente,
        COD_BORDERO: proximoCodBordero,
        COD_TITULO: codTitulo,
        TIPO: 'DUP',
        DT_BORDERO: dtRecepcao,
        VR_FACE: parseFloat(b.valor) || 0,
        DT_VENCIMENTO: b.data_vencimento || null,
        NUMERO: numero,
        NOME_EMITENTE: trunc(b.sacado_nome, 60),
        CIC_EMITENTE: soDigitos(b.sacado_cic).slice(0, 14),
        NOSSO_NUMERO: nossoNumero,
        NOME_AVALISTA: trunc(b.avalista_nome, 25),
        CIC_AVALISTA: soDigitos(b.avalista_cic).slice(0, 14),
        STATUS: 'R',
      }
      const idTit = `${codCedente}~${proximoCodBordero}~${codTitulo}`
      const res = await writeThrough({
        op: 'POST', table: 'OPEITEWEB', id: idTit, payload: reg,
        firebird: () => firebirdApi.create('OPEITEWEB', reg),
      })
      if (res.queued) enfileirados++
      else if (res.error) return { data: null, error: res.error }
      else gravados++
      codTitulo++
    }

    return {
      data: {
        codBordero: proximoCodBordero,
        codOperacao: proximoCodOperacao,
        quantidadeBoletos: boletosParaAntecipar.length,
        codTituloInicio,
        codTituloFim: codTitulo - 1,
        gravados,
        enfileirados, // >0 => Firebird caiu no meio; worker reprocessa a fila
      },
      error: null,
    }
  } catch (err) {
    console.error('[Firebird] Erro ao criar antecipação:', err)
    return { data: null, error: err }
  }
}

export async function retornarAntecipacaoFirebird(boletosParaRetornar, contaData) {
  try {
    if (!contaData || !contaData.cod_cedente) throw new Error('Conta sem cod_cedente definido')
    const codCedente = parseInt(contaData.cod_cedente)

    let retornados = 0
    const bloqueadosTitulos = []
    let naoEncontrados = 0
    const borderosAfetados = new Set()

    for (const b of (boletosParaRetornar || [])) {
      const chave = PREFIXO_NOSSO_NUMERO + soDigitos(b.nosso_numero).padStart(9, '0')

      // Localiza o título por NOSSO_NUMERO.
      const busca = await firebirdApi.list('OPEITEWEB', { NOSSO_NUMERO: chave, limit: 10 })
      if (busca.error) return { data: null, error: busca.error }
      const linhas = (busca.data?.rows ?? []).filter(r => parseInt(r.COD_CEDENTE) === codCedente)
      if (linhas.length === 0) { naoEncontrados++; continue }

      for (const t of linhas) {
        // Só retorna se o cabeçalho estiver com STATUS='R'.
        const cab = await firebirdApi.get('OPECABWEB', `${codCedente}~${t.COD_BORDERO}`)
        const status = cab.data?.row?.STATUS
        if (status !== 'R') { bloqueadosTitulos.push(t.NUMERO); continue }

        const del = await firebirdApi.remove('OPEITEWEB', `${codCedente}~${t.COD_BORDERO}~${t.COD_TITULO}`)
        if (del.error && !del.firebirdDown) return { data: null, error: del.error }
        if (!del.error) { retornados++; borderosAfetados.add(t.COD_BORDERO) }
      }
    }

    // Remove o cabeçalho de borderôs que ficaram sem títulos.
    for (const bordero of borderosAfetados) {
      const rest = await firebirdApi.list('OPEITEWEB', { COD_CEDENTE: codCedente, COD_BORDERO: bordero, limit: 1 })
      if (!rest.error && (rest.data?.rows ?? []).length === 0) {
        await firebirdApi.remove('OPECABWEB', `${codCedente}~${bordero}`)
      }
    }

    return {
      data: { retornados, bloqueados: bloqueadosTitulos.length, naoEncontrados, bloqueadosTitulos },
      error: null,
    }
  } catch (err) {
    console.error('[Firebird] Erro ao retornar antecipação:', err)
    return { data: null, error: err }
  }
}
