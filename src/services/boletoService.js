import { supabase } from '../lib/supabase'

// Função auxiliar para converter data DD/MM/YYYY para YYYY-MM-DD
const convertDateToPG = (dateStr) => {
  if (!dateStr) return new Date().toISOString().split('T')[0]

  // Já está em YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr
  }

  // Converter DD/MM/YYYY para YYYY-MM-DD
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split('/')
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  return new Date().toISOString().split('T')[0]
}

// Buscar todos os boletos do usuário (com paginação para suportar > 1000)
export const getBoletos = async (contaId) => {
  try {
    let allBoletos = []
    let page = 0
    const pageSize = 1000  // Hard limit do Supabase PostgREST

    while (true) {
      const start = page * pageSize
      const end = start + pageSize - 1

      const { data, error } = await supabase
        .from('capt_boletos')
        .select('id, numero_documento, sacado_nome, sacado_cic, data_emissao, data_vencimento, valor, nosso_numero, status, situacao, created_at, num_lancamento')
        .eq('conta_id', contaId)
        .order('created_at', { ascending: false })
        .range(start, end)

      if (error) throw error

      if (!data || data.length === 0) break

      allBoletos = [...allBoletos, ...data]
      console.log(`[getBoletos] Carregou ${data.length} boletos. Total: ${allBoletos.length}`)

      if (data.length < pageSize) break
      page++
    }

    console.log(`[getBoletos] ✓ Total de boletos carregados: ${allBoletos.length}`)
    return { data: allBoletos, error: null }
  } catch (err) {
    console.error('Erro ao buscar boletos:', err)
    return { data: [], error: err }
  }
}

// Criar novo boleto
export const createBoleto = async (contaId, boletoData) => {
  try {
    // Mapear dados para as colunas corretas da tabela capt_boletos
    const dataToInsert = {
      conta_id: contaId,
      numero_documento: boletoData.NUM_TITULO || boletoData.NUMERO_DOCUMENTO || '',
      sacado_nome: boletoData.SACADO_NOME || '',
      data_emissao: convertDateToPG(boletoData.EMISSAO || boletoData.DATA_EMISSAO),
      data_vencimento: convertDateToPG(boletoData.VENCIMENTO || boletoData.DATA_VENCIMENTO),
      valor: parseFloat(boletoData.VALOR || 0),
      nosso_numero: boletoData.NOSSO_NUMERO || '',
      status: boletoData.STATUS || 'pendente',
      situacao: boletoData.SITUACAO || 'Registrado',
      sacado_cic: boletoData.SACADO_CIC || '',
      sacado_endereco: boletoData.SACADO_ENDERECO || '',
      sacado_bairro: boletoData.SACADO_BAIRRO || '',
      sacado_cidade: boletoData.SACADO_CIDADE || '',
      sacado_uf: boletoData.SACADO_UF || '',
      sacado_cep: boletoData.SACADO_CEP || '',
      sacado_telefone: boletoData.SACADO_TELEFONE || '',
      sacado_email: boletoData.SACADO_EMAIL || '',
      codigo_barras: boletoData.CODIGO_BARRAS || '',
      avalista_nome: boletoData.AVALISTA_NOME || '',
      valor_pagamento: parseFloat(boletoData.VALOR_PAGAMENTO || 0),
      data_pagamento: boletoData.DATA_PAGAMENTO ? convertDateToPG(boletoData.DATA_PAGAMENTO) : null,
      descricao: boletoData.DESCRICAO || '',
    }

    console.log('[BoletoService] Criando boleto com dados:', dataToInsert)

    const { data, error } = await supabase
      .from('capt_boletos')
      .insert([dataToInsert])
      .select()
      .single()

    if (error) {
      console.error('[BoletoService] Erro na resposta:', error)
      throw error
    }

    console.log('[BoletoService] Boleto criado com sucesso:', data?.id)
    return { data, error: null }
  } catch (err) {
    console.error('Erro ao criar boleto:', err)
    return { data: null, error: err }
  }
}

// Atualizar boleto
export const updateBoleto = async (boletoId, updates) => {
  try {
    const { data, error } = await supabase
      .from('capt_boletos')
      .update(updates)
      .eq('id', boletoId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (err) {
    console.error('Erro ao atualizar boleto:', err)
    return { data: null, error: err }
  }
}

// Deletar boleto
export const deleteBoleto = async (boletoId) => {
  try {
    const { error } = await supabase
      .from('capt_boletos')
      .delete()
      .eq('id', boletoId)

    if (error) throw error
    return { error: null }
  } catch (err) {
    console.error('Erro ao deletar boleto:', err)
    return { error: err }
  }
}

// Buscar boletos por status
export const getBoletosByStatus = async (contaId, status) => {
  try {
    const { data, error } = await supabase
      .from('capt_boletos')
      .select('*')
      .eq('conta_id', contaId)
      .eq('status', status)
      .order('data_vencimento', { ascending: true })

    if (error) throw error
    return { data, error: null }
  } catch (err) {
    console.error('Erro ao buscar boletos por status:', err)
    return { data: [], error: err }
  }
}

// Buscar boletos vencidos
export const getBoletoVencidos = async (contaId) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('capt_boletos')
      .select('*')
      .eq('conta_id', contaId)
      .neq('status', 'pago')
      .lt('data_vencimento', today)
      .order('data_vencimento', { ascending: true })

    if (error) throw error
    return { data, error: null }
  } catch (err) {
    console.error('Erro ao buscar boletos vencidos:', err)
    return { data: [], error: err }
  }
}

// Estatísticas de boletos
export const getBoletoStats = async (contaId) => {
  try {
    const { data, error } = await supabase
      .from('capt_boletos')
      .select('status, valor, data_vencimento')
      .eq('conta_id', contaId)

    if (error) throw error

    const stats = {
      total: data.length,
      pago: data.filter(b => b.status === 'pago').length,
      pendente: data.filter(b => b.status === 'pendente').length,
      atrasado: data.filter(b => b.status === 'atrasado').length,
      cancelado: data.filter(b => b.status === 'cancelado').length,
      valorTotal: data.reduce((sum, b) => sum + (parseFloat(b.valor) || 0), 0),
      valorPago: data
        .filter(b => b.status === 'pago')
        .reduce((sum, b) => sum + (parseFloat(b.valor) || 0), 0),
    }

    return { data: stats, error: null }
  } catch (err) {
    console.error('Erro ao buscar estatísticas:', err)
    return { data: null, error: err }
  }
}

// Criar registro de remessa CNAB400 na tabela REMESSAS existente
export const createRemessa = async (contaId, remessaData) => {
  try {
    const dataToInsert = {
      "ARQUIVO_REMESSA": remessaData.filename,
      "DATA_REMESSA": new Date().toISOString().split('T')[0],
      "DATA_ENVIO": new Date().toISOString(),
      "STATUS": 'gerado',
      "CONTA": remessaData.conta || '',
      "AGENCIA": remessaData.agencia || '',
    }

    const { data, error } = await supabase
      .from('REMESSAS')
      .insert([dataToInsert])
      .select()
      .single()

    if (error) {
      console.error('[RemessaService] Erro ao criar remessa:', error)
      throw error
    }

    console.log('[RemessaService] Remessa criada com sucesso:', data?.ID)
    return { data, error: null }
  } catch (err) {
    console.error('Erro ao criar remessa:', err)
    return { data: null, error: err }
  }
}

// Atualizar CONTAS table com data e info da última remessa
export const updateContaLastRemessaDate = async (contaId, remessaFilename) => {
  try {
    const { data, error } = await supabase
      .from('CONTAS')
      .update({
        "cnab400": remessaFilename,
        "updated_at": new Date().toISOString()
      })
      .eq('id', contaId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (err) {
    console.error('Erro ao atualizar conta:', err)
    return { data: null, error: err }
  }
}

// ========== RECONCILIAÇÃO OTIMIZADA ==========

// Função auxiliar para paginar qualquer tabela (PostgREST tem hard limit de 1000)
const paginateTable = async (tableName, selectCols, filters = {}) => {
  let allData = []
  let page = 0
  const pageSize = 1000  // Hard limit do Supabase PostgREST

  while (true) {
    const start = page * pageSize
    const end = start + pageSize - 1

    let query = supabase
      .from(tableName)
      .select(selectCols)

    Object.entries(filters).forEach(([col, val]) => {
      query = query.eq(col, val)
    })

    query = query.range(start, end)

    const { data, error } = await query

    if (error) {
      console.error(`[Reconciliação] Erro ao buscar ${tableName} [${start}-${end}]:`, error)
      throw error
    }

    if (!data || data.length === 0) {
      console.log(`[Reconciliação] ${tableName}: fim dos registros`)
      break
    }

    allData = [...allData, ...data]
    console.log(`[Reconciliação] ${tableName}: página ${page} (+${data.length}, total: ${allData.length})`)

    // PostgREST retorna no máximo 1000 registros
    // Se retorna menos de 1000, chegou no fim
    if (data.length < pageSize) {
      console.log(`[Reconciliação] ${tableName}: última página atingida`)
      break
    }

    page++
  }

  console.log(`[Reconciliação] ✓ Total de ${tableName}: ${allData.length} registros`)
  return allData
}

// Reconciliar boletos com OPEITE/SACADO (OTIMIZADO - PARALELO + HASH MAP)
export const reconciliateOpeiteWithBoletos = async (contaId) => {
  try {
    console.log('[Reconciliação] ========== INICIANDO ==========')
    const globalStartTime = Date.now()

    // Carregar as 3 tabelas EM PARALELO (muito mais rápido)
    // PostgREST tem hard limit de 1000 por requisição, então pagina de 1000 em 1000
    console.log('[Reconciliação] Carregando 3 tabelas em paralelo (1000 registros por página)...\n')

    const loadStartTime = Date.now()
    const [boletos, allOpeite, allSacado] = await Promise.all([
      paginateTable('capt_boletos', 'id, numero_documento, num_lancamento, valor, data_vencimento, sacado_cic, status', { conta_id: contaId }),
      paginateTable('OPEITE', 'NUM_LANCAMENTO, NUM_TITULO, VR_FACE, DT_VENCI, COD_SACADO'),
      paginateTable('SACADO', 'COD_SACADO, CIC')
    ])

    const loadTime = ((Date.now() - loadStartTime) / 1000).toFixed(2)
    console.log(`[Reconciliação] ✓ Dados carregados em ${loadTime}s\n`)

    if (!boletos || boletos.length === 0) {
      return {
        success: true,
        totalProcessed: 0,
        totalMatched: 0,
        totalUpdated: 0,
        errors: []
      }
    }

    // Criar mapa de SACADO (COD_SACADO -> CIC)
    console.log('[Reconciliação] Criando mapa de SACADO...')
    const cicMap = {}
    allSacado.forEach(sacado => {
      cicMap[sacado.COD_SACADO] = sacado.CIC
    })
    console.log(`[Reconciliação] ✓ ${Object.keys(cicMap).length} SACADO únicos\n`)

    // OTIMIZAÇÃO: Criar 4 índices de OPEITE para lookup O(1) de diferentes tipos de divergência
    console.log('[Reconciliação] Criando índices de OPEITE para 3 tipos de divergência...')
    const indexStartTime = Date.now()

    // Índice 1: valor|data|cic -> NUM_LANCAMENTO (para matching perfeito)
    const opiteIndex = {}

    // Índice 2: valor|data -> OPEITE (para divergências de CIC)
    const opiteIndexValueDate = {}

    // Índice 3: cic|data -> OPEITE (para divergências de Valor)
    const opiteIndexCicDate = {}

    // Índice 4: cic|valor -> OPEITE (para divergências de Vencimento)
    const opiteIndexCicValor = {}

    allOpeite.forEach(opeite => {
      const opeiteCic = cicMap[opeite.COD_SACADO] || ''
      const keyExact = `${opeite.VR_FACE}|${opeite.DT_VENCI}|${opeiteCic}`
      const keyValueDate = `${opeite.VR_FACE}|${opeite.DT_VENCI}`
      const keyCicDate = `${opeiteCic}|${opeite.DT_VENCI}`
      const keyCicValor = `${opeiteCic}|${opeite.VR_FACE}`

      // Índice exato
      if (!opiteIndex[keyExact]) {
        opiteIndex[keyExact] = []
      }
      opiteIndex[keyExact].push({
        NUM_LANCAMENTO: opeite.NUM_LANCAMENTO,
        NUM_TITULO: opeite.NUM_TITULO,
        DT_VENCI: opeite.DT_VENCI,
        VR_FACE: opeite.VR_FACE,
        COD_SACADO: opeite.COD_SACADO,
        OPEITE_CIC: opeiteCic
      })

      // Índice valor+data (para divergências de CIC)
      if (!opiteIndexValueDate[keyValueDate]) {
        opiteIndexValueDate[keyValueDate] = []
      }
      opiteIndexValueDate[keyValueDate].push(opeite)

      // Índice cic+data (para divergências de Valor)
      if (!opiteIndexCicDate[keyCicDate]) {
        opiteIndexCicDate[keyCicDate] = []
      }
      opiteIndexCicDate[keyCicDate].push(opeite)

      // Índice cic+valor (para divergências de Vencimento)
      if (!opiteIndexCicValor[keyCicValor]) {
        opiteIndexCicValor[keyCicValor] = []
      }
      opiteIndexCicValor[keyCicValor].push(opeite)
    })

    const indexTime = ((Date.now() - indexStartTime) / 1000).toFixed(2)
    console.log(`[Reconciliação] ✓ Índices criados em ${indexTime}s`)
    console.log(`[Reconciliação] ✓ ${Object.keys(opiteIndex).length} chaves únicas (exatas)\n`)

    // Iniciar matching
    console.log('[Reconciliação] Iniciando matching...')
    console.log(`[Reconciliação] - Boletos: ${boletos.length}`)
    console.log(`[Reconciliação] - OPEITE: ${allOpeite.length}`)
    console.log(`[Reconciliação] - SACADO: ${allSacado.length}\n`)

    let totalMatched = 0
    let totalUpdated = 0
    let totalDivergenciasCIC = 0
    let totalDivergenciasValor = 0
    let totalDivergenciasVencimento = 0
    const errors = []
    const updatesToApply = []  // Batch updates
    const divergenciasCIC = []     // Divergências de CIC (valor+data OK)
    const divergenciasValor = []   // Divergências de Valor (cic+data OK)
    const divergenciasVencimento = [] // Divergências de Vencimento (cic+valor OK)

    const matchStartTime = Date.now()

    // FASE 1: Matching (identificar quais boletos atualizar e 3 tipos de divergências)
    console.log('[Reconciliação] Fase 1: Identificando boletos para atualizar e 3 tipos de divergência...')
    for (let idx = 0; idx < boletos.length; idx++) {
      const boleto = boletos[idx]

      try {
        // Lookup O(1) para match exato (valor+data+cic)
        const keyExact = `${boleto.valor}|${boleto.data_vencimento}|${boleto.sacado_cic}`
        const exactMatches = opiteIndex[keyExact] || []

        // Debug dos primeiros 5 boletos
        if (idx < 5) {
          console.log(`[Debug] Boleto ${idx}: valor=${boleto.valor}, data=${boleto.data_vencimento}, cic=${boleto.sacado_cic}, matches=${exactMatches.length}`)
        }

        // Se EXATAMENTE 1 correspondência EXATA
        if (exactMatches.length === 1) {
          updatesToApply.push({
            id: boleto.id,
            num_lancamento: exactMatches[0].NUM_LANCAMENTO
          })
          continue
        }

        // Se MÚLTIPLAS correspondências exatas (ignorar - ambíguo)
        if (exactMatches.length > 1) {
          totalMatched++
          continue
        }

        // Se nenhuma correspondência exata, procurar divergências

        // 1. DIVERGÊNCIA CIC: valor + data OK, mas CIC diferente
        const keyValueDate = `${boleto.valor}|${boleto.data_vencimento}`
        const matchesPorValorData = opiteIndexValueDate[keyValueDate] || []

        if (matchesPorValorData.length === 1) {
          const opeiteMatch = matchesPorValorData[0]
          const opeiteeCic = cicMap[opeiteMatch.COD_SACADO] || ''
          if (opeiteeCic !== boleto.sacado_cic) {
            divergenciasCIC.push({
              boleto_num_lancamento: boleto.num_lancamento,
              boleto_numero_documento: boleto.numero_documento,
              boleto_id: boleto.id,
              boleto_valor: boleto.valor,
              boleto_data_vencimento: boleto.data_vencimento,
              boleto_sacado_cic: boleto.sacado_cic,
              status_banco: boleto.status,
              opeite_num_lancamento: opeiteMatch.NUM_LANCAMENTO,
              opeite_vr_face: opeiteMatch.VR_FACE,
              opeite_dt_venci: opeiteMatch.DT_VENCI,
              opeite_cic: opeiteeCic,
              opeite_num_titulo: opeiteMatch.NUM_TITULO
            })
            totalDivergenciasCIC++
            continue
          }
        }

        // 2. DIVERGÊNCIA VALOR: cic + data OK, mas Valor diferente
        const keyCicDate = `${boleto.sacado_cic}|${boleto.data_vencimento}`
        const matchesPorCicData = opiteIndexCicDate[keyCicDate] || []

        if (matchesPorCicData.length === 1) {
          const opeiteMatch = matchesPorCicData[0]
          const opeiteeCic = cicMap[opeiteMatch.COD_SACADO] || ''
          if (parseFloat(opeiteMatch.VR_FACE) !== parseFloat(boleto.valor)) {
            divergenciasValor.push({
              boleto_num_lancamento: boleto.num_lancamento,
              boleto_numero_documento: boleto.numero_documento,
              boleto_id: boleto.id,
              boleto_valor: boleto.valor,
              boleto_data_vencimento: boleto.data_vencimento,
              boleto_sacado_cic: boleto.sacado_cic,
              status_banco: boleto.status,
              opeite_num_lancamento: opeiteMatch.NUM_LANCAMENTO,
              opeite_vr_face: opeiteMatch.VR_FACE,
              opeite_dt_venci: opeiteMatch.DT_VENCI,
              opeite_cic: opeiteeCic,
              opeite_num_titulo: opeiteMatch.NUM_TITULO
            })
            totalDivergenciasValor++
            continue
          }
        }

        // 3. DIVERGÊNCIA VENCIMENTO: cic + valor OK, mas Data diferente
        const keyCicValor = `${boleto.sacado_cic}|${boleto.valor}`
        const matchesPorCicValor = opiteIndexCicValor[keyCicValor] || []

        if (matchesPorCicValor.length === 1) {
          const opeiteMatch = matchesPorCicValor[0]
          const opeiteeCic = cicMap[opeiteMatch.COD_SACADO] || ''
          if (opeiteMatch.DT_VENCI !== boleto.data_vencimento) {
            divergenciasVencimento.push({
              boleto_num_lancamento: boleto.num_lancamento,
              boleto_numero_documento: boleto.numero_documento,
              boleto_id: boleto.id,
              boleto_valor: boleto.valor,
              boleto_data_vencimento: boleto.data_vencimento,
              boleto_sacado_cic: boleto.sacado_cic,
              status_banco: boleto.status,
              opeite_num_lancamento: opeiteMatch.NUM_LANCAMENTO,
              opeite_vr_face: opeiteMatch.VR_FACE,
              opeite_dt_venci: opeiteMatch.DT_VENCI,
              opeite_cic: opeiteeCic,
              opeite_num_titulo: opeiteMatch.NUM_TITULO
            })
            totalDivergenciasVencimento++
            continue
          }
        }

      } catch (err) {
        errors.push({
          boletoId: boleto.id,
          message: err.message
        })
      }
    }

    console.log(`[Reconciliação] ✓ Fase 1 concluída: ${updatesToApply.length} boletos para atualizar\n`)

    // FASE 2: Atualizar em lotes (batch)
    console.log('[Reconciliação] Fase 2: Atualizando no banco de dados (batch)...')
    const batchSize = 100
    for (let i = 0; i < updatesToApply.length; i += batchSize) {
      const batch = updatesToApply.slice(i, i + batchSize)

      // Fazer update em paralelo para este lote
      const updatePromises = batch.map(update =>
        supabase
          .from('capt_boletos')
          .update({ num_lancamento: update.num_lancamento })
          .eq('id', update.id)
      )

      const results = await Promise.all(updatePromises)

      // Contar sucessos e erros
      results.forEach((result, idx) => {
        if (result.error) {
          errors.push({
            boletoId: batch[idx].id,
            message: `Erro: ${result.error.message}`
          })
        } else {
          totalUpdated++
        }
      })

      const percentage = (((i + batchSize) / updatesToApply.length) * 100).toFixed(0)
      console.log(`[Reconciliação] Progresso: ${percentage}% (${Math.min(i + batchSize, updatesToApply.length)}/${updatesToApply.length})`)
    }

    console.log(`[Reconciliação] ✓ Fase 2 concluída: ${totalUpdated} boletos atualizados`)
    console.log(`[Reconciliação] ✓ Divergências CIC (valor+data OK): ${totalDivergenciasCIC}`)
    console.log(`[Reconciliação] ✓ Divergências Valor (cic+data OK): ${totalDivergenciasValor}`)
    console.log(`[Reconciliação] ✓ Divergências Vencimento (cic+valor OK): ${totalDivergenciasVencimento}\n`)

    const matchTime = ((Date.now() - matchStartTime) / 1000).toFixed(2)
    console.log(`\n[Reconciliação] ✓ Matching concluído em ${matchTime}s`)

    const totalTime = ((Date.now() - globalStartTime) / 1000).toFixed(2)
    console.log(`[Reconciliação] ✓ TEMPO TOTAL: ${totalTime}s`)
    console.log('[Reconciliação] ========== CONCLUÍDO ==========')

    return {
      success: true,
      totalProcessed: boletos.length,
      totalMatched,
      totalUpdated,
      totalDivergenciasCIC,
      totalDivergenciasValor,
      totalDivergenciasVencimento,
      divergenciasCIC,
      divergenciasValor,
      divergenciasVencimento,
      errors
    }

  } catch (err) {
    console.error('Erro na reconciliação:', err)
    return {
      success: false,
      error: err.message,
      totalProcessed: 0,
      totalMatched: 0,
      totalUpdated: 0,
      errors: []
    }
  }
}

// Buscar dados completos da conta (incluindo logo, email, tipo)
export const getContaInfo = async (contaId) => {
    try {
          const { data, error } = await supabase
            .from('CONTAS')
            .select('id, nome_correntista, conta_corrente, convenio, cpf_cnpj, cedente, cnab400, email, logo, tipo')
            .eq('id', contaId)
            .single()

      if (error) throw error
          return { data, error: null }
    } catch (err) {
          console.error('Erro ao buscar conta:', err)
          return { data: null, error: err }
    }
}

// Buscar todas as contas (usado pelo combobox de troca de perfil para usuarios tipo M)
export const getAllContas = async () => {
    try {
          const { data, error } = await supabase
            .from('CONTAS')
            .select('id, nome_correntista')
            .order('nome_correntista', { ascending: true })

      if (error) throw error
          return { data: data || [], error: null }
    } catch (err) {
          console.error('Erro ao buscar contas:', err)
          return { data: [], error: err }
    }
}

// Incrementar contador cnab400 da conta apos gerar remessa
export const incrementContaCnab400 = async (contaId, nextSeq) => {
    try {
          const { error } = await supabase
            .from('CONTAS')
            .update({ cnab400: nextSeq })
            .eq('id', contaId)

      if (error) throw error
          return { error: null }
    } catch (err) {
          console.error('Erro ao atualizar cnab400 da conta:', err)
          return { error: err }
    }
}
