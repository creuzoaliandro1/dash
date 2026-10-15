import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { supabase } from '../lib/supabase'
import { smartFrom } from './firebirdQuery'
import { generateCNAB400RemittanceFile } from '../utils/boleto'
import { incrementContaCnab400, getContaRemessaCount, uploadRemessaCNAB400, createRemessa, getContaCaptCapital } from './boletoService'

// Remessa CNAB400 enviada pela CAPT CAPITAL sobre títulos já registrados (modelo
// da remessa 68): header e conta do tipo 1 (pos 030-037) = CAPT CAPITAL, carteira
// 01 só no header, cada título com tipo 1 + tipo 2 (dados do pagador, exigidos pelo
// BMP) + tipo 3 com o código de barras original (pos 172-215), pelo qual o BMP
// localiza o título no cedente de origem. Usada pela Remessa Prorrogação (Sincronizar,
// ocorrência 06) e pela Baixa (Boletos > Importados > CNAB400, ocorrência 02).

// Colunas de capt_registrado usadas para montar o título da remessa.
export const CAPT_REGISTRADO_REMESSA_COLS = 'id, num_lanca, identd_nosso_num, numero_documento, num_doc_tit, nom_rz_soc_pagdr, cnpj_cpf_pagdr, vlr_tit, dt_venc_tit, dt_ems_tit, lograd_pagdr, numero_endereco_pagdr, cep_pagdr, cid_pagdr, uf_pagdr, nome_sacador_avalista, descricao, num_linha_digtvl, cod_cedente_titular'

// Extrai o número do endereço (último número do texto); 'SN' quando não há.
const extractNumero = (end) => {
  const m = String(end || '').match(/(\d+)\s*$/)
  return m ? m[1] : 'SN'
}

export const campoVazio = (v) => !String(v ?? '').trim()

// Mapeia uma linha de capt_registrado + a data de vencimento + os dados do SACADO
// (endereço completo do pagador) para o formato de "boleto" do CNAB400.
export const captParaBoletoRemessa = (c, dataVencimento, sac) => {
  // Endereço/cidade/UF/CEP: capt_registrado (SACADO só como reserva).
  const endereco = c.lograd_pagdr || (sac && sac.endereco) || ''
  // Número do pagador: capt_registrado.numero_endereco_pagdr; se vazio,
  // extrai do fim do endereço do SACADO (para não voltar em branco ao BMP).
  const numero = c.numero_endereco_pagdr || extractNumero((sac && sac.endereco) || endereco)
  return {
    numero_documento: c.numero_documento || c.num_doc_tit || '',
    nosso_numero: c.identd_nosso_num || '',
    data_vencimento: dataVencimento,
    data_emissao: c.dt_ems_tit || '',
    valor: c.vlr_tit,
    sacado_cic: c.cnpj_cpf_pagdr || '',
    sacado_nome: c.nom_rz_soc_pagdr || '',
    sacado_endereco: endereco,
    sacado_numero: numero,
    sacado_cep: c.cep_pagdr || (sac && sac.cep) || '',
    sacado_bairro: (sac && sac.bairro) || '',        // bairro: SACADO (via OPEITE)
    sacado_uf: c.uf_pagdr || (sac && sac.uf) || '',
    sacado_cidade: c.cid_pagdr || (sac && sac.cidade) || '',
    avalista_cic: '',
    avalista_nome: c.nome_sacador_avalista || '',
    descricao: c.descricao || '',
    codigo_barras: c.num_linha_digtvl || '',
  }
}

// Endereço do pagador (SACADO) por COD_SACADO: Firebird e, para campo em branco,
// a réplica do Supabase (o BMP rejeita a remessa sem bairro/cidade/UF do pagador).
export async function carregarSacadosEndereco(codsSacado) {
  const cods = [...new Set((codsSacado || []).filter((v) => v != null))]
  const sacadoMap = {}
  for (let i = 0; i < cods.length; i += 300) {
    const chunk = cods.slice(i, i + 300)
    const { data: sacs } = await smartFrom('SACADO')
      .select('COD_SACADO, BAIRRO, CIDADE, UF, ENDERECO, CEP').in('COD_SACADO', chunk)
    ;(sacs || []).forEach((sx) => {
      sacadoMap[sx.COD_SACADO] = { bairro: sx.BAIRRO, cidade: sx.CIDADE, uf: sx.UF, endereco: sx.ENDERECO, cep: sx.CEP }
    })
  }
  const incompletos = cods.filter((c) => { const s = sacadoMap[c]; return !s || campoVazio(s.bairro) || campoVazio(s.cidade) || campoVazio(s.uf) })
  if (incompletos.length > 0) {
    const { data: sacsSb } = await supabase.from('SACADO')
      .select('COD_SACADO, BAIRRO, CIDADE, UF, ENDERECO, CEP').in('COD_SACADO', incompletos)
    ;(sacsSb || []).forEach((sx) => {
      const s = sacadoMap[sx.COD_SACADO] || {}
      sacadoMap[sx.COD_SACADO] = {
        bairro: campoVazio(s.bairro) ? sx.BAIRRO : s.bairro,
        cidade: campoVazio(s.cidade) ? sx.CIDADE : s.cidade,
        uf: campoVazio(s.uf) ? sx.UF : s.uf,
        endereco: campoVazio(s.endereco) ? sx.ENDERECO : s.endereco,
        cep: campoVazio(s.cep) ? sx.CEP : s.cep,
      }
    })
  }
  return sacadoMap
}

// Endereço do pagador (SACADO) por CPF/CNPJ (só dígitos) — reserva para título sem
// lançamento vinculado (sem COD_SACADO): capt_registrado não tem bairro e o BMP
// rejeita a remessa sem ele (motivo 47). Retorna { [cic]: { bairro, cidade, uf, endereco, cep } }.
export async function carregarSacadosPorCic(cics) {
  const lista = [...new Set((cics || []).map((c) => String(c ?? '').replace(/\D/g, '')).filter(Boolean))]
  const map = {}
  for (let i = 0; i < lista.length; i += 300) {
    const { data } = await supabase.from('SACADO')
      .select('CIC, BAIRRO, CIDADE, UF, ENDERECO, CEP').in('CIC', lista.slice(i, i + 300))
    ;(data || []).forEach((sx) => {
      const atual = map[sx.CIC]
      // havendo mais de um cadastro para o CPF/CNPJ, fica o que tem bairro
      if (!atual || (campoVazio(atual.bairro) && !campoVazio(sx.BAIRRO))) {
        map[sx.CIC] = { bairro: sx.BAIRRO, cidade: sx.CIDADE, uf: sx.UF, endereco: sx.ENDERECO, cep: sx.CEP }
      }
    })
  }
  return map
}

// Faltas de endereço do pagador que impedem o título de entrar na remessa.
export const faltasEnderecoBoleto = (b) =>
  [['bairro', b.sacado_bairro], ['cidade', b.sacado_cidade], ['UF', b.sacado_uf]]
    .filter(([, v]) => campoVazio(v)).map(([n]) => n)

// Gera UM .REM pela CAPT CAPITAL (numeração de remessa dela) com a ocorrência
// informada, registra a remessa (contador, Storage, REMESSAS) e baixa o .zip.
// Retorna { remName, quantidade }.
export async function gerarRemessaCaptCapital(boletos, ocorrencia) {
  const { data: contaCapt, error: captErr } = await getContaCaptCapital()
  if (captErr || !contaCapt) {
    throw new Error('Não foi possível carregar os dados da CAPT CAPITAL: ' + (captErr?.message || 'conta não encontrada'))
  }
  const cnab400Capt = Number(contaCapt.cnab400)
  let nextSeq
  if (!isNaN(cnab400Capt) && cnab400Capt >= 1) nextSeq = cnab400Capt + 1
  else { const { count } = await getContaRemessaCount(contaCapt.cedente || ''); nextSeq = (count || 0) + 1 }
  const now = new Date()
  const p2 = (n) => String(n).padStart(2, '0')
  const dd = p2(now.getDate()), mm = p2(now.getMonth() + 1)
  const blob = await generateCNAB400RemittanceFile(boletos, contaCapt, nextSeq, ocorrencia, undefined, null, true, 1) // carteira 1: header pos 046 e tipo 1 pos 024
  const seq = String(nextSeq).padStart(7, '0')
  const remName = `CB${dd}${mm}${seq}.REM`
  try { await incrementContaCnab400(contaCapt.id, nextSeq) } catch (e) { /* best-effort */ }
  let caminhoStorage = null
  try { const { data: up } = await uploadRemessaCNAB400(contaCapt.id, remName, blob); caminhoStorage = up?.caminho || null } catch (e) { /* best-effort */ }
  try {
    const valorTotal = boletos.reduce((sm, b) => sm + (parseFloat(b.valor) || 0), 0)
    await createRemessa(contaCapt.id, { filename: remName, quantidadeBoletos: boletos.length, valorTotal, caminhoStorage })
  } catch (e) { /* best-effort */ }

  const zip = new JSZip()
  zip.file(remName, blob)
  saveAs(await zip.generateAsync({ type: 'blob' }), `CB${dd}${mm}${seq}.zip`)
  return { remName, quantidade: boletos.length }
}

const _cents = (v) => Math.round((parseFloat(v) || 0) * 100)
const _iso = (d) => (d ? String(d).slice(0, 10) : '')
const _semZeros = (v) => String(v ?? '').replace(/\D/g, '').replace(/^0+/, '')
const _chave = (valor, venc, cic) => `${_cents(valor)}|${_iso(venc)}|${_semZeros(cic)}`

// Localiza em capt_registrado o título de cada linha do modo Importados (linha
// `reg_<id>` pelo id; demais por valor+vencimento+CIC, preferindo o mesmo nosso
// número e um título não cancelado). Retorna [{ row, reg }] (reg = null se não achou).
export async function buscarRegistradosDasLinhas(rows) {
  const porId = {}
  const ids = rows.map((r) => String(r.id || '')).filter((id) => id.startsWith('reg_')).map((id) => id.slice(4))
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase.from('capt_registrado')
      .select(CAPT_REGISTRADO_REMESSA_COLS + ', situacao_boleto').in('id', ids.slice(i, i + 200))
    ;(data || []).forEach((r) => { porId[String(r.id)] = r })
  }
  const porChave = {}
  const valores = [...new Set(rows.filter((r) => !String(r.id || '').startsWith('reg_')).map((r) => parseFloat(r.valor)).filter((v) => !isNaN(v)))]
  for (let i = 0; i < valores.length; i += 100) {
    const { data } = await supabase.from('capt_registrado')
      .select(CAPT_REGISTRADO_REMESSA_COLS + ', situacao_boleto').in('vlr_tit', valores.slice(i, i + 100))
    ;(data || []).forEach((r) => {
      const k = _chave(r.vlr_tit, r.dt_venc_tit, r.cnpj_cpf_pagdr)
      ;(porChave[k] = porChave[k] || []).push(r)
    })
  }
  const cancelado = (r) => /cancelad/i.test(String(r.situacao_boleto || ''))
  return rows.map((row) => {
    const id = String(row.id || '')
    if (id.startsWith('reg_')) return { row, reg: porId[id.slice(4)] || null }
    const cands = porChave[_chave(row.valor, row.data_vencimento, row.sacado_cic)] || []
    const nn = _semZeros(row.nosso_numero)
    const reg = (nn && cands.find((r) => _semZeros(r.identd_nosso_num) === nn))
      || cands.find((r) => !cancelado(r)) || cands[0] || null
    return { row, reg }
  })
}

// COD_SACADO das linhas do modo Importados: o da própria linha (OPEITE) ou, pelo
// lançamento, o da OPEITE no Firebird. Retorna { [String(num_lancamento)]: COD_SACADO }.
export async function codSacadoPorLancamento(rows) {
  const map = {}
  rows.forEach((r) => { if (r.num_lancamento && r._COD_SACADO != null) map[String(r.num_lancamento)] = r._COD_SACADO })
  const lancs = [...new Set(rows.map((r) => Number(r.num_lancamento)).filter((v) => v && !(String(v) in map)))]
  for (let i = 0; i < lancs.length; i += 300) {
    const { data } = await smartFrom('OPEITE').select('NUM_LANCAMENTO, COD_SACADO').in('NUM_LANCAMENTO', lancs.slice(i, i + 300))
    ;(data || []).forEach((o) => { if (o.COD_SACADO != null) map[String(o.NUM_LANCAMENTO)] = o.COD_SACADO })
  }
  return map
}
