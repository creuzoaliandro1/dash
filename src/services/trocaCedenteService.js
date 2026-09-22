import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'

// Mapa [cabeçalho no Excel, coluna no banco] — 63 campos do
// "Relatório de Gestão de Boletos Negociados" (BMP).
export const TROCA_CEDENTE_MAP = [
  ['Documento federal do titular da conta', 'doc_federal_titular'],
  ['Nome do titular da conta', 'nome_titular'],
  ['Código cedente do titular da conta', 'cod_cedente_titular'],
  ['Banco do titular', 'banco_titular'],
  ['Agência do titular', 'agencia_titular'],
  ['Número da conta do titular', 'conta_titular'],
  ['Status do boleto', 'status_boleto'],
  ['Nosso número', 'nosso_numero'],
  ['Seu número', 'seu_numero'],
  ['Número do documento', 'numero_documento'],
  ['Nome do pagador', 'nome_pagador'],
  ['Documento federal do pagador', 'doc_federal_pagador'],
  ['CEP do pagador', 'cep_pagador'],
  ['Logradouro do pagador', 'logradouro_pagador'],
  ['Número do endereço do pagador', 'numero_endereco_pagador'],
  ['Complemento do endereço do pagador', 'complemento_endereco_pagador'],
  ['Cidade do pagador', 'cidade_pagador'],
  ['UF do pagador', 'uf_pagador'],
  ['Email do pagador', 'email_pagador'],
  ['Telefone do pagador', 'telefone_pagador'],
  ['Data de emissão', 'data_emissao'],
  ['Data de registro', 'data_registro'],
  ['Valor do título', 'valor_titulo'],
  ['Data de vencimento', 'data_vencimento'],
  ['Data limite de pagamento', 'data_limite_pagamento'],
  ['Tipo de boleto', 'tipo_boleto'],
  ['Linha digitável', 'linha_digitavel'],
  ['PIX copia e cola', 'pix_copia_cola'],
  ['Carteira', 'carteira'],
  ['Beneficiário final (sacador avalista)', 'beneficiario_final'],
  ['Parametrização multa', 'parametrizacao_multa'],
  ['Valor de multa', 'valor_multa'],
  ['Data multa', 'data_multa'],
  ['Parametrização juros', 'parametrizacao_juros'],
  ['Valor de juros', 'valor_juros'],
  ['Data juros', 'data_juros'],
  ['Parametrização desconto (primeira faixa)', 'parametrizacao_desconto_1'],
  ['Valor de desconto (primeira faixa)', 'valor_desconto_1'],
  ['Data de desconto (primeira faixa)', 'data_desconto_1'],
  ['Parametrização desconto (segunda faixa)', 'parametrizacao_desconto_2'],
  ['Valor de desconto (segunda faixa)', 'valor_desconto_2'],
  ['Data de desconto (segunda faixa)', 'data_desconto_2'],
  ['Parametrização desconto (terceira faixa)', 'parametrizacao_desconto_3'],
  ['Valor de desconto (terceira faixa)', 'valor_desconto_3'],
  ['Data de desconto (terceira faixa)', 'data_desconto_3'],
  ['Abatimento', 'abatimento'],
  ['Valor pago', 'valor_pago'],
  ['Data de pagamento', 'data_pagamento'],
  ['Data do crédito', 'data_credito'],
  ['Canal do pagamento', 'canal_pagamento'],
  ['Espécie', 'especie'],
  ['Modalidade', 'modalidade'],
  ['Descrição', 'descricao'],
  ['Tipo de negociação', 'tipo_negociacao'],
  ['Status da negociação', 'status_negociacao'],
  ['Data do envio dos boletos para negociação', 'data_envio_negociacao'],
  ['Usuário de envio de boletos para negociação', 'usuario_envio_negociacao'],
  ['Data da aprovação de envio dos boletos para negociação', 'data_aprovacao_envio_negociacao'],
  ['Usuário de aprovação de envio de boletos para negociação', 'usuario_aprovacao_envio_negociacao'],
  ['Data do recebimento dos boletos para negociação', 'data_recebimento_negociacao'],
  ['Usuário de recebimento de boletos para negociação', 'usuario_recebimento_negociacao'],
  ['Data da aprovação de recebimento dos boletos para negociação', 'data_aprovacao_recebimento_negociacao'],
  ['Usuário de aprovação de recebimento de boletos para negociação', 'usuario_aprovacao_recebimento_negociacao'],
]

const _clean = (v) => {
  if (v === null || v === undefined) return ''
  const s = String(v).trim()
  return (s === '- - -') ? '' : s
}
const _digits = (v) => String(v || '').replace(/\D/g, '')
const _noZeros = (v) => _digits(v).replace(/^0+/, '')

function _chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

// Hash estável (djb2) do conteúdo de negócio da linha: muda se qualquer campo mudar.
function _hashLinha(obj) {
  const s = TROCA_CEDENTE_MAP.map(([, k]) => obj[k] || '').join('|') + '|' + (obj.bairro || '')
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0
  return h.toString(16)
}

// 1) Lê o Excel do relatório → array de objetos {coluna_db: valor}.
export async function parseTrocaCedenteFile(file) {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const json = XLSX.utils.sheet_to_json(ws, { defval: '' })
  return json
    .map((row) => {
      const obj = {}
      for (const [header, key] of TROCA_CEDENTE_MAP) obj[key] = _clean(row[header])
      return obj
    })
    .filter((o) => o.linha_digitavel) // descarta rodapés / linhas sem linha digitável
}

// 2) Resolve o BAIRRO usando o código de barras / nosso número como referência:
//    - capt_boletos.sacado_bairro por nosso_numero (fonte do bairro)
//    - ponte capt_registrado.num_linha_digtvl (= linha digitável) -> identd_nosso_num,
//      quando o nosso número do relatório não bate direto em capt_boletos.
export async function resolverBairroTroca(rows) {
  const bairroPorNosso = {} // nossoNorm -> bairro

  const addBoletos = async (nossos) => {
    for (const c of _chunk([...new Set(nossos.filter(Boolean))], 200)) {
      const { data, error } = await supabase
        .from('capt_boletos')
        .select('nosso_numero, sacado_bairro')
        .in('nosso_numero', c)
      if (error) { console.warn('[trocaCedente] capt_boletos:', error.message); continue }
      ;(data || []).forEach((b) => {
        const k = _noZeros(b.nosso_numero)
        const v = _clean(b.sacado_bairro)
        if (k && v && !bairroPorNosso[k]) bairroPorNosso[k] = v
      })
    }
  }

  // Casa por nosso número do relatório (com e sem zeros à esquerda)
  await addBoletos(rows.map((r) => String(r.nosso_numero || '').trim()))
  await addBoletos(rows.map((r) => _noZeros(r.nosso_numero)))

  // Ponte via capt_registrado p/ quem ainda não achou bairro
  const semBairro = rows.filter((r) => !bairroPorNosso[_noZeros(r.nosso_numero)])
  const lds = [...new Set(semBairro.map((r) => String(r.linha_digitavel || '').trim()).filter(Boolean))]
  const nossoPorLd = {}
  for (const c of _chunk(lds, 150)) {
    const { data, error } = await supabase
      .from('capt_registrado')
      .select('num_linha_digtvl, identd_nosso_num')
      .in('num_linha_digtvl', c)
    if (error) { console.warn('[trocaCedente] capt_registrado:', error.message); continue }
    ;(data || []).forEach((r) => {
      const ld = String(r.num_linha_digtvl || '').trim()
      if (ld && r.identd_nosso_num) nossoPorLd[ld] = _noZeros(r.identd_nosso_num)
    })
  }
  await addBoletos(Object.values(nossoPorLd))

  // Aplica bairro em cada linha
  return rows.map((r) => {
    let bairro = bairroPorNosso[_noZeros(r.nosso_numero)] || ''
    if (!bairro) {
      const viaLd = nossoPorLd[String(r.linha_digitavel || '').trim()]
      if (viaLd) bairro = bairroPorNosso[viaLd] || ''
    }
    return { ...r, bairro }
  })
}

// 3) Grava em capt_troca_cedente:
//    - dedup por linha_digitavel (chave natural)
//    - ignora linha idêntica (mesmo hash), atualiza linha alterada, insere nova.
export async function gravarTrocaCedente(rows) {
  // Dedup interno do arquivo por linha digitável (mantém a última ocorrência)
  const porLd = new Map()
  for (const r of rows) porLd.set(r.linha_digitavel, r)
  const unicos = [...porLd.values()].map((r) => ({ ...r, hash_dedup: _hashLinha(r) }))
  const duplicadosInternos = rows.length - unicos.length

  // Hashes já existentes p/ as linhas digitáveis do lote
  const existentes = {}
  for (const c of _chunk(unicos.map((r) => r.linha_digitavel), 150)) {
    const { data, error } = await supabase
      .from('capt_troca_cedente')
      .select('linha_digitavel, hash_dedup')
      .in('linha_digitavel', c)
    if (error) { console.warn('[trocaCedente] select existentes:', error.message); continue }
    ;(data || []).forEach((x) => { existentes[x.linha_digitavel] = x.hash_dedup })
  }

  const inserir = []
  const atualizar = []
  let ignorados = 0
  for (const r of unicos) {
    const he = existentes[r.linha_digitavel]
    if (he === undefined) inserir.push(r)
    else if (he !== r.hash_dedup) atualizar.push(r)
    else ignorados++
  }

  let inseridos = 0, atualizados = 0, falhas = 0, primeiroErro = null

  for (const c of _chunk(inserir, 500)) {
    const { data, error } = await supabase.from('capt_troca_cedente').insert(c).select('linha_digitavel')
    if (!error) { inseridos += data ? data.length : c.length; continue }
    for (const row of c) {
      const { error: e1 } = await supabase.from('capt_troca_cedente').insert(row)
      if (e1) { falhas++; if (!primeiroErro) primeiroErro = e1; console.warn('[trocaCedente] insert', row.linha_digitavel, e1.message) }
      else inseridos++
    }
  }

  for (const r of atualizar) {
    const payload = { ...r, updated_at: new Date().toISOString() }
    const { error } = await supabase
      .from('capt_troca_cedente')
      .update(payload)
      .eq('linha_digitavel', r.linha_digitavel)
    if (error) { falhas++; if (!primeiroErro) primeiroErro = error; console.warn('[trocaCedente] update', r.linha_digitavel, error.message) }
    else atualizados++
  }

  return {
    total: rows.length,
    inseridos,
    atualizados,
    ignorados,
    duplicadosInternos,
    falhas,
    error: (inseridos === 0 && atualizados === 0 && falhas > 0) ? primeiroErro : null,
  }
}

// 4) Lê os registros gravados (mais recentes primeiro) p/ a tabela da página.
export async function getTrocaCedente() {
  const ps = 1000
  let from = 0
  let all = []
  while (true) {
    const { data, error } = await supabase
      .from('capt_troca_cedente')
      .select('*')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .range(from, from + ps - 1)
    if (error) { console.warn('[getTrocaCedente]', error.message); break }
    if (!data || !data.length) break
    all = all.concat(data)
    if (data.length < ps) break
    from += ps
  }
  return all
}
