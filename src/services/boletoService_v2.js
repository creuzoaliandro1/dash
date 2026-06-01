// Versão otimizada da função de reconciliação
import { supabase } from '../lib/supabase'

// Função auxiliar para paginar qualquer tabela
const paginateTable = async (tableName, selectCols, filters = {}, pageSize = 5000) => {
  let allData = []
  let page = 0

  while (true) {
    const start = page * pageSize
    const end = start + pageSize - 1

    console.log(`[Reconciliação] Buscando ${tableName} range [${start}-${end}]...`)

    let query = supabase
      .from(tableName)
      .select(selectCols)

    // Aplicar filtros dinamicamente
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
      console.log(`[Reconciliação] Fim dos registros ${tableName}`)
      break
    }

    allData = [...allData, ...data]
    console.log(`[Reconciliação] ✓ ${tableName}: +${data.length} registros (total: ${allData.length})`)

    if (data.length < pageSize) {
      console.log(`[Reconciliação] Última página de ${tableName} atingida`)
      break
    }

    page++
  }

  console.log(`[Reconciliação] ✓ Total final de ${tableName}: ${allData.length} registros\n`)
  return allData
}

// Reconciliar boletos com OPEITE/SACADO (OTIMIZADO)
export const reconciliateOpeiteWithBoletos = async (contaId) => {
  try {
    console.log('[Reconciliação] ======== INICIANDO ========')
    const globalStartTime = Date.now()

    // Carregar as 3 tabelas EM PARALELO (5x mais rápido)
    console.log('[Reconciliação] Carregando 3 tabelas em paralelo...\n')

    const loadStartTime = Date.now()
    const [boletos, allOpeite, allSacado] = await Promise.all([
      paginateTable('capt_boletos', 'id, valor, data_vencimento, sacado_cic', { conta_id: contaId }),
      paginateTable('OPEITE', 'NUM_LANCAMENTO, VR_FACE, DT_VENCI, COD_SACADO'),
      paginateTable('SACADO', 'COD_SACADO, CIC')
    ])

    const loadTime = ((Date.now() - loadStartTime) / 1000).toFixed(2)
    console.log(`[Reconciliação] ✓ Dados carregados em ${loadTime}s\n`)

    if (!boletos || boletos.length === 0) {
      console.log('[Reconciliação] Nenhum boleto encontrado')
      return {
        success: true,
        totalProcessed: 0,
        totalMatched: 0,
        totalUpdated: 0,
        errors: []
      }
    }

    // Criar mapa de SACADO (COD_SACADO -> CIC) para lookup rápido
    console.log('[Reconciliação] Criando mapa de SACADO...')
    const cicMap = {}
    allSacado.forEach(sacado => {
      cicMap[sacado.COD_SACADO] = sacado.CIC
    })
    console.log(`[Reconciliação] ✓ Mapa criado com ${Object.keys(cicMap).length} SACADO únicos\n`)

    // OTIMIZAÇÃO: Criar índice de OPEITE (chave = valor|data|cic) para O(1) lookup
    console.log('[Reconciliação] Criando índice de OPEITE (para matching rápido)...')
    const opiteIndexStartTime = Date.now()

    const opiteIndex = {}  // chave: "valor|data|cic" -> array de NUM_LANCAMENTO
    allOpeite.forEach(opeite => {
      const opeiteCic = cicMap[opeite.COD_SACADO] || ''
      const key = `${opeite.VR_FACE}|${opeite.DT_VENCI}|${opeiteCic}`

      if (!opiteIndex[key]) {
        opiteIndex[key] = []
      }
      opiteIndex[key].push(opeite.NUM_LANCAMENTO)
    })

    const opiteIndexTime = ((Date.now() - opiteIndexStartTime) / 1000).toFixed(2)
    console.log(`[Reconciliação] ✓ Índice criado em ${opiteIndexTime}s`)
    console.log(`[Reconciliação] ✓ ${Object.keys(opiteIndex).length} combinações valor+data+cic únicas\n`)

    // Reconciliar boletos
    console.log('[Reconciliação] Iniciando matching de boletos...')
    console.log(`[Reconciliação] - Total de boletos: ${boletos.length}`)
    console.log(`[Reconciliação] - Total de OPEITE: ${allOpeite.length}`)
    console.log(`[Reconciliação] - Total de SACADO: ${allSacado.length}\n`)

    let totalMatched = 0
    let totalUpdated = 0
    const errors = []

    const matchStartTime = Date.now()

    // Para cada boleto, fazer lookup O(1) no índice (não O(n) com filter)
    for (let idx = 0; idx < boletos.length; idx++) {
      const boleto = boletos[idx]

      try {
        // Lookup O(1) usando índice
        const key = `${boleto.valor}|${boleto.data_vencimento}|${boleto.sacado_cic}`
        const numLancamentos = opiteIndex[key] || []

        // Debug dos primeiros 5 boletos
        if (idx < 5) {
          console.log(`[Debug] Boleto ${idx}: valor=${boleto.valor}, data=${boleto.data_vencimento}, cic=${boleto.sacado_cic}, matches=${numLancamentos.length}`)
          if (numLancamentos.length > 0) {
            console.log(`[Debug]   -> NUM_LANCAMENTO: ${numLancamentos[0]}`)
          }
        }

        // Se EXATAMENTE 1 correspondência, atualizar
        if (numLancamentos.length === 1) {
          const numLancamento = numLancamentos[0]

          const { error: updateError } = await supabase
            .from('capt_boletos')
            .update({ num_lancamento: numLancamento })
            .eq('id', boleto.id)

          if (updateError) {
            errors.push({
              boletoId: boleto.id,
              message: `Erro ao atualizar: ${updateError.message}`
            })
            continue
          }

          totalUpdated++
          continue
        }

        // Se MÚLTIPLAS correspondências, desprezar (ambíguo)
        if (numLancamentos.length > 1) {
          totalMatched++
          continue
        }

        // Se nenhuma correspondência, não fazer nada
        // (não incrementa nada)

      } catch (err) {
        errors.push({
          boletoId: boleto.id,
          message: err.message
        })
      }
    }

    const matchTime = ((Date.now() - matchStartTime) / 1000).toFixed(2)
    console.log(`\n[Reconciliação] ✓ Matching concluído em ${matchTime}s`)

    const totalTime = ((Date.now() - globalStartTime) / 1000).toFixed(2)
    console.log(`[Reconciliação] ✓ TEMPO TOTAL: ${totalTime}s`)
    console.log('[Reconciliação] ======== CONCLUÍDO ========')

    return {
      success: true,
      totalProcessed: boletos.length,
      totalMatched,
      totalUpdated,
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
