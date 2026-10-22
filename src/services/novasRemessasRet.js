import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { supabase } from '../lib/supabase'
import { generateCNAB400RemittanceFile } from '../utils/boleto'
import {
  getContaInfo, getContaRemessaCount, incrementContaCnab400,
  uploadRemessaCNAB400, createRemessa, markBoletosRemessa,
} from './boletoService'
import {
  CAPT_REGISTRADO_REMESSA_COLS, captParaBoletoRemessa, carregarSacadosPorCic, faltasEnderecoBoleto,
} from './remessaCaptCapital'

// Retorno CNAB400 › Gravados em RET_CONTACAPT › Ações › Gerar novas remessas.
// Para os títulos marcados, gera UMA remessa CNAB400 de registro (ocorrência 01)
// por conta, igual à geração da página Boletos: header/detalhe com os dados da
// própria conta, numeração pelo contador CONTAS.cnab400, arquivo
// CB[DD][MM][SSSSSSS].REM compactado em CB[DD][MM][SSSSSSS].zip, salvo no Storage
// e registrado em REMESSAS. Todos os .zip vão juntos num único .zip para download.
// Dados do título: capt_boletos (pelo nosso número) e, na falta, capt_registrado
// (bairro/cidade/UF do pagador completados pelo SACADO via CPF/CNPJ).

const semZeros = (v) => String(v ?? '').replace(/\D/g, '').replace(/^0+/, '')
const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out }
const p2 = (n) => String(n).padStart(2, '0')

// Conta (CONTAS) de uma linha do RET_CONTACAPT, por CONTA_CEDENTE = conta ou cedente.
const contaDaLinha = (r, contas) => {
  const k = semZeros(r.CONTA_CEDENTE)
  if (!k) return null
  return contas.find((c) => semZeros(c.conta) === k) || contas.find((c) => semZeros(c.cedente) === k) || null
}

// Prepara os títulos agrupados por conta, sem gerar nada (para confirmação).
// Retorna { grupos: [{ conta, boletos, captIds }], faltas: [string] }.
export async function prepararNovasRemessas(linhas, contas) {
  const faltas = []
  const itens = []
  const vistos = new Set()
  for (const r of linhas) {
    const nosso = semZeros(r.NOSSO_NUMERO)
    const conta = contaDaLinha(r, contas)
    if (!nosso) { faltas.push(`${r.NUM_LANCA || '—'}: sem nosso número`); continue }
    if (!conta) { faltas.push(`${nosso}: conta ${String(r.CONTA_CEDENTE || '').trim() || '—'} não encontrada em CONTAS`); continue }
    const chave = `${conta.id}|${nosso}`
    if (vistos.has(chave)) continue // mesmo título marcado mais de uma vez (ocorrências diferentes)
    vistos.add(chave)
    itens.push({ r, nosso, conta })
  }
  if (!itens.length) return { grupos: [], faltas }

  // 1) capt_boletos pelo nosso número (preferindo o da mesma conta)
  const nossos = [...new Set(itens.map((i) => i.nosso))]
  const captPorNosso = {}
  for (const c of chunk(nossos, 300)) {
    const { data, error } = await supabase.from('capt_boletos').select('*').in('nosso_numero', c)
    if (error) throw new Error('capt_boletos: ' + error.message)
    ;(data || []).forEach((b) => { (captPorNosso[semZeros(b.nosso_numero)] ||= []).push(b) })
  }

  // 2) capt_registrado para os que não estão em capt_boletos
  const faltamCapt = nossos.filter((n) => !captPorNosso[n])
  const regPorNosso = {}
  for (const c of chunk(faltamCapt, 300)) {
    const { data, error } = await supabase.from('capt_registrado')
      .select(CAPT_REGISTRADO_REMESSA_COLS + ', situacao_boleto').in('identd_nosso_num', c)
    if (error) throw new Error('capt_registrado: ' + error.message)
    ;(data || []).forEach((x) => { (regPorNosso[semZeros(x.identd_nosso_num)] ||= []).push(x) })
  }
  const cancelado = (x) => /cancelad/i.test(String(x.situacao_boleto || ''))
  const regEscolhido = {}
  Object.entries(regPorNosso).forEach(([k, arr]) => { regEscolhido[k] = arr.find((x) => !cancelado(x)) || arr[0] })
  const sacadoPorCic = await carregarSacadosPorCic(Object.values(regEscolhido).map((x) => x.cnpj_cpf_pagdr))

  // 3) monta o "boleto" de cada título e agrupa por conta
  const porConta = new Map()
  for (const { r, nosso, conta } of itens) {
    let boleto = null
    let captId = null
    const cands = captPorNosso[nosso]
    if (cands) {
      const b = cands.find((x) => String(x.conta_id) === String(conta.id)) || cands[0]
      boleto = { ...b }
      captId = b.id
    } else if (regEscolhido[nosso]) {
      const reg = regEscolhido[nosso]
      const cic = String(reg.cnpj_cpf_pagdr ?? '').replace(/\D/g, '')
      boleto = captParaBoletoRemessa(reg, reg.dt_venc_tit, sacadoPorCic[cic])
    }
    if (!boleto) { faltas.push(`${nosso}: título não encontrado em capt_boletos nem capt_registrado`); continue }
    const falta = faltasEnderecoBoleto(boleto)
    if (falta.length) { faltas.push(`${nosso}: sem ${falta.join(', ')} do pagador`); continue }
    if (!boleto.data_vencimento || !(parseFloat(boleto.valor) > 0)) { faltas.push(`${nosso}: sem vencimento ou valor`); continue }
    if (!porConta.has(conta.id)) porConta.set(conta.id, { conta, boletos: [], captIds: [] })
    const g = porConta.get(conta.id)
    g.boletos.push(boleto)
    if (captId) g.captIds.push(captId)
  }
  return { grupos: [...porConta.values()], faltas }
}

// Gera as remessas (uma por conta) e baixa um único .zip com os .zip de cada conta.
// Retorna { zipName, arquivos: [{ conta, remName, quantidade }], erros: [string] }.
export async function gerarNovasRemessas(grupos, onProgresso) {
  const now = new Date()
  const dd = p2(now.getDate()), mm = p2(now.getMonth() + 1)
  const geral = new JSZip()
  const usados = new Set()
  const arquivos = []
  const erros = []

  for (let i = 0; i < grupos.length; i++) {
    const { conta: contaResumo, boletos, captIds } = grupos[i]
    const rotulo = `${contaResumo.conta || contaResumo.cedente} — ${contaResumo.nome_correntista || ''}`.trim()
    onProgresso?.(`Gerando remessa ${i + 1}/${grupos.length}: ${rotulo}`)
    try {
      // Conta completa (header CNAB) e contador atualizado no momento da geração
      const { data: conta, error } = await getContaInfo(contaResumo.id)
      if (error || !conta) throw new Error('conta não carregada')
      const cnab = Number(conta.cnab400)
      let nextSeq
      if (!isNaN(cnab) && cnab >= 1) nextSeq = cnab + 1
      else { const { count } = await getContaRemessaCount(conta.cedente || ''); nextSeq = (count || 0) + 1 }

      const blob = await generateCNAB400RemittanceFile(boletos, conta, nextSeq, '01')
      const seq = String(nextSeq).padStart(7, '0')
      const remName = `CB${dd}${mm}${seq}.REM`
      await incrementContaCnab400(conta.id, nextSeq)

      const zipConta = new JSZip()
      zipConta.file(remName, blob)
      const zipContaBlob = await zipConta.generateAsync({ type: 'blob' })
      let zipContaName = `CB${dd}${mm}${seq}.zip`
      // contas diferentes podem ter a mesma sequência: separa em pasta da conta
      if (usados.has(zipContaName)) zipContaName = `${semZeros(conta.conta || conta.cedente)}/${zipContaName}`
      usados.add(zipContaName)
      geral.file(zipContaName, zipContaBlob)

      // Best-effort, como na página Boletos: Storage, REMESSAS e situação 'Remessa'
      let caminhoStorage = null
      try { const { data: up } = await uploadRemessaCNAB400(conta.id, remName, blob); caminhoStorage = up?.caminho || null } catch (e) { console.warn('[NovasRemessas] Storage:', e) }
      try {
        const valorTotal = boletos.reduce((s, b) => s + (parseFloat(b.valor) || 0), 0)
        await createRemessa(conta.id, { filename: remName, quantidadeBoletos: boletos.length, valorTotal, caminhoStorage })
      } catch (e) { console.warn('[NovasRemessas] REMESSAS:', e) }
      if (captIds.length) { try { await markBoletosRemessa(captIds) } catch (e) { console.warn('[NovasRemessas] situacao:', e) } }

      arquivos.push({ conta: rotulo, remName, quantidade: boletos.length })
    } catch (e) {
      erros.push(`${rotulo}: ${e?.message || e}`)
    }
  }

  if (!arquivos.length) return { zipName: null, arquivos, erros }
  const stamp = `${dd}${mm}${now.getFullYear()}${p2(now.getHours())}${p2(now.getMinutes())}${p2(now.getSeconds())}`
  const zipName = `NR${stamp}.zip`
  onProgresso?.('Compactando os arquivos...')
  saveAs(await geral.generateAsync({ type: 'blob' }), zipName)
  return { zipName, arquivos, erros }
}
