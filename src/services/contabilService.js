import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'

// Módulo Contábil — service layer (empresa única, ver accounting-module/CONTEXT)
export const EMPRESA_ID = 1

const userId = () => {
  try { return JSON.parse(localStorage.getItem('user') || '{}').id || null } catch { return null }
}

// "1.234,56" | "1234.56" | número → decimal JS
export const parseValorBR = (raw) => {
  if (raw === null || raw === undefined || raw === '') return 0
  if (typeof raw === 'number') return raw
  const s = String(raw).replace(/[^\d.,-]/g, '')
  if (!s) return 0
  if (s.includes(',')) {
    const n = parseFloat(s.replace(/\./g, '').replace(',', '.'))
    return isNaN(n) ? 0 : n
  }
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

// Erros das RPCs vêm como "CODIGO: mensagem" — traduz para exibição
export const mensagemErro = (error) => {
  const msg = error?.message || String(error)
  const m = msg.match(/^([A-Z_]+):\s*(.*)$/)
  return m ? m[2] || m[1] : msg
}

// ===== Seed / bootstrap =====
export const ensureSeed = async () => {
  const { count } = await supabase.from('ctb_conta_contabil')
    .select('id', { count: 'exact', head: true }).eq('empresa_id', EMPRESA_ID)
  if (!count) {
    const { data, error } = await supabase.rpc('ctb_seed_empresa', { p_empresa: EMPRESA_ID })
    if (error) throw error
    return data
  }
  return null
}

// ===== Plano de Contas =====
export const getContas = async () => {
  const { data, error } = await supabase.from('ctb_conta_contabil')
    .select('*, ctb_grupo_dre(codigo, descricao), ctb_grupo_balanco(codigo, descricao)')
    .eq('empresa_id', EMPRESA_ID).order('codigo')
  if (error) throw error
  return data || []
}

export const createConta = async ({ codigo, nome, tipo, natureza, aceita_lancamento, grupo_dre_id, grupo_balanco_id }) => {
  const segs = codigo.split('.')
  const nivel = segs.length
  let conta_pai_id = null
  if (nivel > 1) {
    const paiCodigo = segs.slice(0, -1).join('.')
    const { data: pai } = await supabase.from('ctb_conta_contabil')
      .select('id, nivel, tipo, natureza').eq('empresa_id', EMPRESA_ID).eq('codigo', paiCodigo).single()
    if (!pai) throw new Error(`Conta pai ${paiCodigo} não encontrada (RP-02)`)
    conta_pai_id = pai.id
    // pai com filhas torna-se sintética (RP-03)
    await supabase.from('ctb_conta_contabil').update({ aceita_lancamento: false }).eq('id', pai.id)
  }
  const { data, error } = await supabase.from('ctb_conta_contabil').insert([{
    empresa_id: EMPRESA_ID, codigo, nome, conta_pai_id, nivel, tipo, natureza,
    aceita_lancamento: !!aceita_lancamento,
    grupo_dre_id: grupo_dre_id || null, grupo_balanco_id: grupo_balanco_id || null,
  }]).select().single()
  if (error) throw error
  return data
}

export const updateConta = async (id, fields) => {
  const { data, error } = await supabase.from('ctb_conta_contabil')
    .update(fields).eq('id', id).eq('empresa_id', EMPRESA_ID).select().single()
  if (error) throw error
  return data
}

export const contaTemMovimento = async (id) => {
  const { count } = await supabase.from('ctb_lancamento_item')
    .select('id', { count: 'exact', head: true }).eq('conta_id', id)
  return (count || 0) > 0
}

// ===== Grupos DRE / Balanço =====
export const getGruposDre = async () => {
  const { data, error } = await supabase.from('ctb_grupo_dre')
    .select('*').eq('empresa_id', EMPRESA_ID).order('ordem')
  if (error) throw error
  return data || []
}
export const getGruposBalanco = async () => {
  const { data, error } = await supabase.from('ctb_grupo_balanco')
    .select('*').eq('empresa_id', EMPRESA_ID).order('ordem')
  if (error) throw error
  return data || []
}

// ===== Históricos padrão =====
export const getHistoricos = async () => {
  const { data, error } = await supabase.from('ctb_historico_padrao')
    .select('*').eq('empresa_id', EMPRESA_ID).order('codigo')
  if (error) throw error
  return data || []
}
export const saveHistorico = async (h) => {
  const payload = { ...h, empresa_id: EMPRESA_ID }
  const q = h.id
    ? supabase.from('ctb_historico_padrao').update(payload).eq('id', h.id)
    : supabase.from('ctb_historico_padrao').insert([payload])
  const { error } = await q
  if (error) throw error
}

// ===== Centros de custo =====
export const getCentrosCusto = async () => {
  const { data, error } = await supabase.from('ctb_centro_custo')
    .select('*').eq('empresa_id', EMPRESA_ID).order('codigo')
  if (error) throw error
  return data || []
}
export const saveCentroCusto = async (cc) => {
  const payload = { ...cc, empresa_id: EMPRESA_ID }
  const q = cc.id
    ? supabase.from('ctb_centro_custo').update(payload).eq('id', cc.id)
    : supabase.from('ctb_centro_custo').insert([payload])
  const { error } = await q
  if (error) throw error
}

// ===== Períodos / Encerramento =====
export const getPeriodos = async (ano) => {
  const { data, error } = await supabase.from('ctb_periodo_contabil')
    .select('*').eq('empresa_id', EMPRESA_ID).eq('ano', ano).order('mes')
  if (error) throw error
  return data || []
}
export const criarPeriodosAno = async (ano) => {
  const rows = Array.from({ length: 12 }, (_, i) => ({ empresa_id: EMPRESA_ID, ano, mes: i + 1 }))
  await supabase.from('ctb_periodo_contabil').upsert(rows, { onConflict: 'empresa_id,ano,mes', ignoreDuplicates: true })
}
export const encerrarPeriodo = async (ano, mes) => {
  const { data, error } = await supabase.rpc('ctb_encerrar_periodo',
    { p_empresa: EMPRESA_ID, p_ano: ano, p_mes: mes, p_usuario: userId() })
  if (error) throw error
  return data
}
export const reabrirPeriodo = async (ano, mes, motivo) => {
  const { data, error } = await supabase.rpc('ctb_reabrir_periodo',
    { p_empresa: EMPRESA_ID, p_ano: ano, p_mes: mes, p_usuario: userId(), p_motivo: motivo })
  if (error) throw error
  return data
}
export const encerrarExercicio = async (ano) => {
  const { data, error } = await supabase.rpc('ctb_encerrar_exercicio',
    { p_empresa: EMPRESA_ID, p_ano: ano, p_usuario: userId() })
  if (error) throw error
  return data
}

// ===== Lançamentos =====
export const getLancamentos = async ({ de, ate, status, busca, limite = 200 } = {}) => {
  let q = supabase.from('ctb_lancamento')
    .select('*, ctb_lancamento_item(id, conta_id, tipo, valor, historico_item, ctb_conta_contabil(codigo, nome))')
    .eq('empresa_id', EMPRESA_ID)
    .order('data_competencia', { ascending: false }).order('id', { ascending: false })
    .limit(limite)
  if (de) q = q.gte('data_competencia', de)
  if (ate) q = q.lte('data_competencia', ate)
  if (status) q = q.eq('status', status)
  if (busca) q = q.ilike('historico', `%${busca}%`)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export const criarLancamento = async ({ dataCompetencia, historico, historicoPadraoId, itens, contabilizar }) => {
  const { data, error } = await supabase.rpc('ctb_criar_lancamento', {
    p: {
      empresa_id: EMPRESA_ID,
      data_lancamento: new Date().toISOString().slice(0, 10),
      data_competencia: dataCompetencia,
      historico,
      historico_padrao_id: historicoPadraoId || '',
      criado_por: userId() || '',
      contabilizar: !!contabilizar,
      itens,
    },
  })
  if (error) throw error
  return data
}

export const contabilizarLancamento = async (id) => {
  const { data, error } = await supabase.rpc('ctb_contabilizar', { p_lancamento_id: id })
  if (error) throw error
  return data
}
export const estornarLancamento = async (id, motivo) => {
  const { data, error } = await supabase.rpc('ctb_estornar',
    { p_lancamento_id: id, p_motivo: motivo, p_usuario: userId() })
  if (error) throw error
  return data
}
export const excluirRascunho = async (id) => {
  const { error } = await supabase.rpc('ctb_excluir_rascunho', { p_id: id })
  if (error) throw error
}

// ===== Relatórios =====
export const relBalancete = async (de, ate) => {
  const { data, error } = await supabase.rpc('ctb_rel_balancete', { p_empresa: EMPRESA_ID, p_de: de, p_ate: ate })
  if (error) throw error
  return data || []
}
export const relRazao = async (contaId, de, ate) => {
  const { data, error } = await supabase.rpc('ctb_rel_razao',
    { p_empresa: EMPRESA_ID, p_conta: contaId, p_de: de, p_ate: ate })
  if (error) throw error
  return data
}
export const relDiario = async (de, ate) => {
  const { data, error } = await supabase.from('ctb_lancamento')
    .select('*, ctb_lancamento_item(id, tipo, valor, ctb_conta_contabil(codigo, nome))')
    .eq('empresa_id', EMPRESA_ID).neq('status', 'rascunho')
    .gte('data_competencia', de).lte('data_competencia', ate)
    .order('data_competencia').order('numero')
  if (error) throw error
  return data || []
}
export const relDre = async (de, ate) => {
  const { data, error } = await supabase.rpc('ctb_rel_dre', { p_empresa: EMPRESA_ID, p_de: de, p_ate: ate })
  if (error) throw error
  return data || []
}
export const relBalanco = async (ate) => {
  const { data, error } = await supabase.rpc('ctb_rel_balanco', { p_empresa: EMPRESA_ID, p_ate: ate })
  if (error) throw error
  return data
}

// ===== Integração Financeiro =====
export const getMapeamentos = async () => {
  const { data, error } = await supabase.from('ctb_mapeamento_contabil')
    .select('*, debito:ctb_conta_contabil!ctb_mapeamento_contabil_conta_debito_id_fkey(codigo, nome), credito:ctb_conta_contabil!ctb_mapeamento_contabil_conta_credito_id_fkey(codigo, nome)')
    .eq('empresa_id', EMPRESA_ID).order('evento')
  if (error) throw error
  return data || []
}
export const saveMapeamento = async (m) => {
  const payload = {
    empresa_id: EMPRESA_ID, evento: m.evento,
    conta_debito_id: m.conta_debito_id, conta_credito_id: m.conta_credito_id, ativo: m.ativo !== false,
  }
  const q = m.id
    ? supabase.from('ctb_mapeamento_contabil').update(payload).eq('id', m.id)
    : supabase.from('ctb_mapeamento_contabil').insert([payload])
  const { error } = await q
  if (error) throw error
}
export const capturarEventos = async () => {
  const { data, error } = await supabase.rpc('ctb_capturar_eventos', { p_empresa: EMPRESA_ID })
  if (error) throw error
  return data
}
export const processarPendencias = async () => {
  const { data, error } = await supabase.rpc('ctb_processar_pendencias',
    { p_empresa: EMPRESA_ID, p_usuario: userId(), p_limite: 500 })
  if (error) throw error
  return data
}
export const getPendencias = async (status) => {
  let q = supabase.from('ctb_integracao_pendencia')
    .select('*').eq('empresa_id', EMPRESA_ID).order('id', { ascending: false }).limit(300)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  return data || []
}
export const getPendenciasResumo = async () => {
  const { data, error } = await supabase.from('ctb_integracao_pendencia')
    .select('status').eq('empresa_id', EMPRESA_ID)
  if (error) throw error
  const resumo = { pendente: 0, processado: 0, erro: 0, descartado: 0 }
  for (const r of data || []) resumo[r.status] = (resumo[r.status] || 0) + 1
  return resumo
}

// ===== Exportação XLSX =====
export const exportarXlsx = (nomeArquivo, linhas, nomeAba = 'Relatório') => {
  const ws = XLSX.utils.json_to_sheet(linhas)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, nomeAba)
  XLSX.writeFile(wb, `${nomeArquivo}.xlsx`)
}
