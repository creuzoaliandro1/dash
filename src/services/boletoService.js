import { supabase } from '../lib/supabase'
import { generateBarcodeFromBoleto } from '../utils/boleto'

// Calcula DV do nosso numero - algoritmo BMP274 CNAB400 (oficial)
// Algoritmo:
// 1. Prefixar com "0900" + nosso_numero (ex: 313500015 → 0900313500015)
// 2. Usar TODOS os 13 dígitos com pesos [2,7,6,5,4,3,2,7,6,5,4,3,2]
// 3. Multiplicar, somar, dividir por 11
// 4. Se resto=0: DV="0", Se resto=1: DV="P", Senão: DV=11-resto
const calcNossoNumeroDV = (nossoBase) => {
  const num = String(nossoBase || '').replace(/\D/g, '')

  // Prefixar com "0900" para o cálculo
  const prefixado = '0900' + num.padStart(9, '0')

  // Usar TODOS os 13 dígitos (não usar slice!)
  const base13 = prefixado

  // Pesos oficiais BMP274 - 13 pesos para 13 dígitos
  const pesos = [2, 7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2]

  // Multiplicar e somar
  let soma = 0
  for (let i = 0; i < 13; i++) {
    soma += parseInt(base13.charAt(i), 10) * pesos[i]
  }

  // Dividir por 11 e calcular resto
  const quociente = Math.floor(soma / 11)
  const resto = soma - (quociente * 11)

  // Calcular DV conforme regra BMP274
  if (resto === 0) {
    return '0'
  } else if (resto === 1) {
    return 'P'
  } else {
    return String(11 - resto)
  }
}

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
        .select('id, numero_documento, sacado_nome, sacado_cic, sacado_endereco, sacado_bairro, sacado_cidade, sacado_uf, sacado_cep, sacado_telefone, sacado_email, data_emissao, data_vencimento, valor, nosso_numero, status, situacao, created_at, num_lancamento, descricao, avalista_nome, avalista_cic, status_efactor, zapsign_status, zapsign_sign_url')
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

// Buscar proximo nosso_numero da conta e incrementar CONTAS.nnumero
// IMPORTANTE: Retorna APENAS O NÚMERO BASE (SEM DV)
// O DV é calculado apenas na geração do CNAB400 (pos 82)
// Retorna: CONTAS.nnumero + 1 (ex: nnumero=50007 → retorna "50008")
export const getNextNossoNumero = async (contaId) => {
  try {
    const { data: conta, error } = await supabase
      .from('CONTAS')
      .select('nnumero, nnumero_dv')
      .eq('id', contaId)
      .single()

    if (error) throw error

    // Incrementa CONTAS.nnumero e retorna o novo valor (sem DV)
    const nextBase = Number(conta.nnumero || 0) + 1

    // Pre-calcula o DV do proximo numero para cache em nnumero_dv
    // IMPORTANTE: passar apenas a base (9 dígitos), NÃO a versão padronizada!
    const nextDv = calcNossoNumeroDV(String(nextBase))

    await supabase
      .from('CONTAS')
      .update({ nnumero: nextBase, nnumero_dv: nextDv })
      .eq('id', contaId)

    // Armazena APENAS O NÚMERO, SEM DV
    // Exemplo: nextBase = 50008 → retorna "50008" (string)
    // CNAB400 vai recalcular o DV na posição 82
    return { nossoNumero: String(nextBase), error: null }
  } catch (err) {
    console.error('Erro ao gerar nosso numero:', err)
    return { nossoNumero: null, error: err }
  }
}

// Criar novo boleto
export const createBoleto = async (contaId, boletoData) => {
  try {
    // IMPORTANTE: SEMPRE gera novo nosso_numero usando o contador CONTAS.nnumero
    // Isso garante que cada boleto (importado ou novo) tenha um número único e sequencial
    // Não usa NOSSO_NUMERO do arquivo importado - sempre gera um novo
    const { nossoNumero: gerado, error: nnErr } = await getNextNossoNumero(contaId)
    if (nnErr || !gerado) {
      const msg = nnErr?.message || 'erro desconhecido'
      console.error('[BoletoService] Erro ao gerar nosso_numero:', msg)
      throw new Error('Falha ao gerar nosso número da conta: ' + msg)
    }
    const nossoNumeroFinal = gerado
    console.log('[BoletoService] nosso_numero gerado:', nossoNumeroFinal, '(contador CONTAS.nnumero + 1)')

    // Mapear dados para as colunas corretas da tabela capt_boletos
    const dataToInsert = {
      conta_id: contaId,
      numero_documento: boletoData.NUM_TITULO || boletoData.NUMERO_DOCUMENTO || '',
      sacado_nome: boletoData.SACADO_NOME || '',
      data_emissao: convertDateToPG(boletoData.EMISSAO || boletoData.DATA_EMISSAO),
      data_vencimento: convertDateToPG(boletoData.VENCIMENTO || boletoData.DATA_VENCIMENTO),
      valor: parseFloat(boletoData.VALOR || 0),
      nosso_numero: nossoNumeroFinal,
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
      avalista_nome: boletoData.AVALISTA_NOME || '',
      avalista_cic:  boletoData.AVALISTA_CIC  || '',
      valor_pagamento: parseFloat(boletoData.VALOR_PAGAMENTO || 0),
      data_pagamento: boletoData.DATA_PAGAMENTO ? convertDateToPG(boletoData.DATA_PAGAMENTO) : null,
      descricao: boletoData.DESCRICAO || '',
    }

    // Campos opcionais vindos da importação do Efactor (OPEITE)
    if (boletoData.NUM_LANCAMENTO !== undefined && boletoData.NUM_LANCAMENTO !== null && boletoData.NUM_LANCAMENTO !== '') {
      const numLanc = Number(boletoData.NUM_LANCAMENTO)
      if (!isNaN(numLanc)) dataToInsert.num_lancamento = numLanc
    }
    if (boletoData.STATUS_EFACTOR) {
      dataToInsert.status_efactor = boletoData.STATUS_EFACTOR
    }

    // Gerar codigo de barras automaticamente e calcular juros
    try {
      const { data: contaData, error: contaErr } = await supabase
        .from('CONTAS')
        .select('nome_correntista, cic, cedente, juros')
        .eq('id', contaId)
        .single()

      if (!contaErr && contaData) {
        const barcode = generateBarcodeFromBoleto(dataToInsert, contaData)
        dataToInsert.codigo_barras = barcode
        console.log('[BoletoService] Código de barras gerado:', barcode)

        // Calcular juros diário: (valor * juros_mensal / 30) / 100
        if (contaData.juros && dataToInsert.valor) {
          const jurosDiario = (dataToInsert.valor * contaData.juros) / 3000
          dataToInsert.juros = Math.round(jurosDiario * 100) / 100 // Arredondar para 2 casas decimais
          console.log(`[BoletoService] Juros calculado: valor=${dataToInsert.valor}, juros_mensal=${contaData.juros}, juros_diario=${dataToInsert.juros}`)
        }
      } else {
        console.warn('[BoletoService] Aviso ao gerar barcode - não encontrou conta:', contaErr)
        dataToInsert.codigo_barras = ''
      }
    } catch (err) {
      console.error('[BoletoService] Erro ao gerar codigo_barras:', err)
      dataToInsert.codigo_barras = ''
    }

    // Se veio a Linha digitável da importação (CODIGO_BARRAS), preserva-a em codigo_barras
    // (mantém a chave estável para deduplicação em reimportações)
    const cbImportado = String(boletoData.CODIGO_BARRAS || '').replace(/\D/g, '')
    if (cbImportado) {
      dataToInsert.codigo_barras = cbImportado
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
    // Se campos que afetam o código de barras foram alterados, regenerar o barcode
    const barcodeRelatedFields = ['data_vencimento', 'valor', 'nosso_numero']
    const hasBarcodeDependentChanges = Object.keys(updates).some(key =>
      barcodeRelatedFields.includes(key)
    )

    if (hasBarcodeDependentChanges) {
      console.log('[updateBoleto] Detectado mudança em campo que afeta barcode, regenerando...')

      // Buscar o boleto atual para ter todos os dados
      const { data: boletoAtual, error: fetchErr } = await supabase
        .from('capt_boletos')
        .select('*')
        .eq('id', boletoId)
        .single()

      if (!fetchErr && boletoAtual) {
        // Mesclar atualizações com dados atuais
        const boletoMerged = { ...boletoAtual, ...updates }

        // Buscar dados da conta
        const { data: contaData, error: contaErr } = await supabase
          .from('CONTAS')
          .select('nome_correntista, cpf_cnpj, cic, cedente, convenio, juros')
          .eq('id', boletoMerged.conta_id)
          .single()

        if (!contaErr && contaData) {
          const barcode = generateBarcodeFromBoleto(boletoMerged, contaData)
          updates.codigo_barras = barcode
          console.log('[updateBoleto] Novo código de barras gerado:', barcode)

          // Recalcular juros se o valor foi alterado
          if (updates.valor && contaData.juros) {
            const jurosDiario = (updates.valor * contaData.juros) / 3000
            updates.juros = Math.round(jurosDiario * 100) / 100 // Arredondar para 2 casas decimais
            console.log(`[updateBoleto] Juros recalculado: valor=${updates.valor}, juros_mensal=${contaData.juros}, juros_diario=${updates.juros}`)
          }
        }
      }
    }

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

// Criar registro de remessa CNAB400 na tabela REMESSAS
// IMPORTANTE: Apenas insere nos campos que existem na tabela
export const createRemessa = async (contaId, remessaData) => {
  try {
    // Buscar dados da conta para preencher CONTA e AGENCIA
    const { data: conta, error: contaErr } = await supabase
      .from('CONTAS')
      .select('cedente, agencia')
      .eq('id', contaId)
      .single()

    if (contaErr) {
      console.warn('[RemessaService] Erro ao buscar conta:', contaErr)
    }

    // Inserir apenas os campos que existem na tabela REMESSAS
    const dataToInsert = {
      ARQUIVO_REMESSA: remessaData.filename || '',
      DATA_REMESSA: new Date().toISOString().split('T')[0],
      DATA_ENVIO: new Date().toISOString(),
      STATUS: 'gerado',
      CONTA: conta?.cedente || '',
      AGENCIA: conta?.agencia || '',
      // Campos opcionais para rastreamento (se a tabela tiver)
      GERADO: new Date().toISOString().split('T')[0],
    }

    console.log('[RemessaService] Inserindo remessa:', dataToInsert)

    const { data, error } = await supabase
      .from('REMESSAS')
      .insert([dataToInsert])
      .select()
      .single()

    if (error) {
      // RLS policy pode bloquear, mas não é crítico - o arquivo já foi gerado
      console.warn('[RemessaService] Aviso ao criar remessa (não bloqueia):', error.message)
      // Retorna com aviso, não erro
      return { data: null, error: error, isWarning: true }
    }

    console.log('[RemessaService] Remessa criada com sucesso:', data?.ID)
    return { data, error: null }
  } catch (err) {
    // RLS policy pode bloquear, mas não é crítico
    console.warn('[RemessaService] Aviso ao criar remessa (não bloqueia):', err.message)
    // Retorna com aviso, não erro
    return { data: null, error: err, isWarning: true }
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
      paginateTable('capt_boletos', 'id, numero_documento, num_lancamento, valor, data_vencimento, sacado_cic, status'),
      paginateTable('OPEITE', 'NUM_LANCAMENTO, NUM_TITULO, VR_FACE, DT_VENCI, COD_SACADO'),
      paginateTable('SACADO', 'COD_SACADO, CIC')
    ])

    const loadTime = ((Date.now() - loadStartTime) / 1000).toFixed(2)
    console.log(`[Reconciliação] ✓ Dados carregados em ${loadTime}s\n`)

    // Regra: TODO boleto que já possui num_lancamento deve ficar com status_efactor='Antecipado'
    // (executado sempre que clicar em Reconciliar OPEITE, varrendo todos os registros)
    try {
      const { error: errSweepAntecipado } = await supabase
        .from('capt_boletos')
        .update({ status_efactor: 'Antecipado' })
        .not('num_lancamento', 'is', null)
      if (errSweepAntecipado) {
        console.warn('[Reconciliação] Aviso ao marcar status_efactor=Antecipado:', errSweepAntecipado.message)
      } else {
        console.log('[Reconciliação] ✓ status_efactor=Antecipado aplicado aos boletos com num_lancamento')
      }
    } catch (e) {
      console.warn('[Reconciliação] Falha no sweep de status_efactor:', e.message)
    }

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
          // Ao reconciliar com OPEITE: grava o num_lancamento e marca como 'Antecipado'
          .update({ num_lancamento: update.num_lancamento, status_efactor: 'Antecipado' })
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

// Buscar registros OPEITE filtrando por COD_CEDENTE (para origem Efactor)
export const getOPEITEByCedente = async (codCedente) => {
  try {
    console.log('[BoletoService] Buscando OPEITE para COD_CEDENTE:', codCedente, '(TIPO_TITULO=DUP, STATUS em [DO,IN,PR])')

    let allOpeite = []
    let page = 0
    const pageSize = 1000

    while (true) {
      const start = page * pageSize
      const end = start + pageSize - 1

      const { data, error } = await supabase
        .from('OPEITE')
        .select('NUM_LANCAMENTO, DT_LANCA, NUM_TITULO, VR_FACE, DT_VENCI, COD_SACADO, COD_CEDENTE, NOME_AVALISTA, CIC_AVALISTA')
        .eq('COD_CEDENTE', codCedente)
        .eq('TIPO_TITULO', 'DUP')
        .in('STATUS', ['DO', 'IN', 'PR'])
        .range(start, end)

      if (error) {
        console.error('[BoletoService] Erro ao buscar OPEITE:', error)
        throw error
      }

      if (!data || data.length === 0) {
        console.log('[BoletoService] OPEITE: fim dos registros')
        break
      }

      allOpeite = [...allOpeite, ...data]
      console.log(`[BoletoService] OPEITE: página ${page} (+${data.length}, total: ${allOpeite.length})`)

      if (data.length < pageSize) {
        break
      }

      page++
    }

    console.log(`[BoletoService] ✓ Total de OPEITE: ${allOpeite.length} registros`)

    // Buscar dados de SACADO para pegar NOME_CORRENTISTA
    const codSacadoSet = new Set(allOpeite.map(o => o.COD_SACADO).filter(Boolean))
    const sacadoMap = {}

    if (codSacadoSet.size > 0) {
      const codSacadoArray = Array.from(codSacadoSet)

      for (let i = 0; i < codSacadoArray.length; i += pageSize) {
        const batch = codSacadoArray.slice(i, i + pageSize)

        const { data: sacados, error: sacadoError } = await supabase
          .from('SACADO')
          .select('COD_SACADO, NOME_CORRENTISTA, CIC')
          .in('COD_SACADO', batch)

        if (!sacadoError && sacados) {
          sacados.forEach(s => {
            sacadoMap[s.COD_SACADO] = {
              NOME_CORRENTISTA: s.NOME_CORRENTISTA,
              CIC: s.CIC
            }
          })
        }
      }
    }

    // Mapear dados para o padrão de boleto (snake_case para compatibilidade com capt_boletos)
    const boletosMapeados = allOpeite.map(opeite => {
      const sacado = sacadoMap[opeite.COD_SACADO] || {}
      return {
        num_titulo: opeite.NUM_TITULO || '',
        data_emissao: opeite.DT_LANCA || '',
        data_vencimento: opeite.DT_VENCI || '',
        valor: parseFloat(opeite.VR_FACE) || 0,
        numero_documento: opeite.NUM_LANCAMENTO || '',
        sacado_nome: sacado.NOME_CORRENTISTA || '',
        sacado_cic: sacado.CIC || '',
        avalista_nome: opeite.NOME_AVALISTA || '',
        avalista_cic: opeite.CIC_AVALISTA || '',
        status: 'pendente',
        status_efactor: 'Registrado',
        num_lancamento: opeite.NUM_LANCAMENTO || '',
        created_at: new Date().toISOString(), // Data da busca
        // Metadados para rastreamento
        _ORIGEM: 'OPEITE',
        _COD_CEDENTE: opeite.COD_CEDENTE,
        _COD_SACADO: opeite.COD_SACADO,
      }
    })

    return { data: boletosMapeados, error: null }
  } catch (err) {
    console.error('[BoletoService] Erro ao carregar OPEITE:', err)
    return { data: [], error: err }
  }
}

// Importar registros do Efactor (OPEITE) para capt_boletos
// Mapeia OPEITE + SACADO + CONTAS -> capt_boletos, gerando nosso_numero novo.
// Pula registros cujo num_lancamento já exista em capt_boletos para a conta.
export const importOpeiteToBoletos = async (contaId, opeiteRecords) => {
  try {
    if (!contaId) {
      return { data: null, error: new Error('Conta não identificada') }
    }
    if (!Array.isArray(opeiteRecords) || opeiteRecords.length === 0) {
      return { data: { imported: 0, skipped: 0, errors: 0, total: 0, errorDetails: [] }, error: null }
    }

    console.log(`[Import OPEITE] Iniciando importação de ${opeiteRecords.length} registro(s) para conta ${contaId}`)

    // 1) Detectar duplicados: num_lancamento já existentes em capt_boletos para a conta
    const numLancamentos = opeiteRecords
      .map(r => Number(r.num_lancamento))
      .filter(n => !isNaN(n) && n > 0)

    const existentes = new Set()
    if (numLancamentos.length > 0) {
      const pageSize = 1000
      for (let i = 0; i < numLancamentos.length; i += pageSize) {
        const batch = numLancamentos.slice(i, i + pageSize)
        const { data: jaImportados, error: dupError } = await supabase
          .from('capt_boletos')
          .select('num_lancamento')
          .eq('conta_id', contaId)
          .in('num_lancamento', batch)
        if (dupError) {
          console.warn('[Import OPEITE] Aviso ao checar duplicados:', dupError.message)
        } else if (jaImportados) {
          jaImportados.forEach(b => existentes.add(Number(b.num_lancamento)))
        }
      }
    }
    console.log(`[Import OPEITE] ${existentes.size} num_lancamento já existem na conta (serão pulados)`)

    // 2) Buscar dados completos de SACADO (endereço/cidade/uf/cep) por COD_SACADO
    const codSacadoSet = new Set(opeiteRecords.map(r => r._COD_SACADO).filter(Boolean))
    const sacadoMap = {}
    if (codSacadoSet.size > 0) {
      const codArray = Array.from(codSacadoSet)
      const pageSize = 1000
      for (let i = 0; i < codArray.length; i += pageSize) {
        const batch = codArray.slice(i, i + pageSize)
        const { data: sacados, error: sacError } = await supabase
          .from('SACADO')
          .select('COD_SACADO, NOME_CORRENTISTA, CIC, ENDERECO, BAIRRO, CIDADE, UF, CEP')
          .in('COD_SACADO', batch)
        if (!sacError && sacados) {
          sacados.forEach(s => { sacadoMap[s.COD_SACADO] = s })
        } else if (sacError) {
          console.warn('[Import OPEITE] Aviso ao buscar SACADO:', sacError.message)
        }
      }
    }

    // 3) Importar cada registro (pulando duplicados) via createBoleto
    let imported = 0
    let skipped = 0
    let errors = 0
    const errorDetails = []

    for (const rec of opeiteRecords) {
      const numLanc = Number(rec.num_lancamento)
      if (!isNaN(numLanc) && numLanc > 0 && existentes.has(numLanc)) {
        skipped++
        continue
      }

      const sac = sacadoMap[rec._COD_SACADO] || {}
      const payload = {
        NUM_TITULO: rec.num_titulo || rec.numero_documento || '',
        EMISSAO: rec.data_emissao || null,
        VENCIMENTO: rec.data_vencimento || null,
        VALOR: rec.valor || 0,
        SACADO_NOME: sac.NOME_CORRENTISTA || rec.sacado_nome || '',
        SACADO_CIC: sac.CIC || rec.sacado_cic || '',
        SACADO_ENDERECO: sac.ENDERECO || '',
        SACADO_BAIRRO: sac.BAIRRO || '',
        SACADO_CIDADE: sac.CIDADE || '',
        SACADO_UF: sac.UF || '',
        SACADO_CEP: sac.CEP || '',
        AVALISTA_NOME: rec.avalista_nome || '',
        AVALISTA_CIC: rec.avalista_cic || '',
        STATUS: 'pendente',
        SITUACAO: 'Registrado',
        STATUS_EFACTOR: rec.status_efactor || 'Registrado',
        NUM_LANCAMENTO: rec.num_lancamento || '',
        DESCRICAO: '',
      }

      const { error } = await createBoleto(contaId, payload)
      if (error) {
        errors++
        errorDetails.push({ num_lancamento: rec.num_lancamento, message: error.message })
        console.error('[Import OPEITE] Erro ao importar num_lancamento', rec.num_lancamento, ':', error.message)
      } else {
        imported++
        if (!isNaN(numLanc) && numLanc > 0) existentes.add(numLanc) // evita duplicar dentro da própria seleção
      }
    }

    console.log(`[Import OPEITE] Concluído: ${imported} importados, ${skipped} pulados, ${errors} erros`)
    return {
      data: { imported, skipped, errors, total: opeiteRecords.length, errorDetails },
      error: null,
    }
  } catch (err) {
    console.error('[Import OPEITE] Erro geral:', err)
    return { data: null, error: err }
  }
}

// Buscar dados completos da conta (incluindo logo, email, tipo)
export const getContaInfo = async (contaId) => {
    try {
          const { data, error } = await supabase
            .from('CONTAS')
            .select('*')
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
// Agora inclui CNPJ para auto-preenchimento de avalista durante importação
export const getAllContas = async () => {
    try {
          const { data, error } = await supabase
            .from('CONTAS')
            .select('id, nome_correntista, conta, cedente, cic')
            .order('nome_correntista', { ascending: true })

      if (error) throw error

      console.log('[getAllContas] Resultado da query:')
      console.log('  Total de contas:', data?.length || 0)
      if (data?.length > 0) {
        console.log('  Primeira conta - campos:', Object.keys(data[0]))
        console.log('  Exemplo:', data[0])
      }

          return { data: data || [], error: null }
    } catch (err) {
          console.error('[getAllContas] Erro ao buscar contas:', err)
          return { data: [], error: err }
    }
}

// ===== GERENCIAMENTO DE ANEXOS =====

// Fazer upload de arquivo para um boleto
export const uploadAnexoBoleto = async (boletoId, file, contaId) => {
  try {
    if (!file) {
      throw new Error('Nenhum arquivo selecionado')
    }

    // Validar tipos de arquivo
    const tiposPermitidos = ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/xml', 'application/xml', 'application/pdf']
    if (!tiposPermitidos.includes(file.type)) {
      throw new Error(`Tipo de arquivo não permitido: ${file.type}. Permitidos: XML, Excel, PDF`)
    }

    // Gerar nome único para o arquivo
    const timestamp = new Date().getTime()
    const ext = file.name.split('.').pop()
    const nomeArquivo = `boleto_${boletoId}_${timestamp}.${ext}`
    const caminho = `anexos/${contaId}/${nomeArquivo}`
    const BUCKET_NAME = 'titulos'

    console.log('[BoletoService] Fazendo upload de anexo:', caminho, 'Tamanho:', file.size, 'Bucket:', BUCKET_NAME)

    // Upload para Storage (bucket deve existir em Supabase)
    const { error: erroUpload } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(caminho, file, { upsert: false })

    if (erroUpload) {
      console.error('[BoletoService] Erro ao fazer upload:', erroUpload)
      throw erroUpload
    }

    // Registrar metadados do arquivo na tabela
    const { error: erroMetadados } = await supabase
      .from('capt_boletos_anexos')
      .insert([{
        boleto_id: boletoId,
        nome_arquivo: file.name,
        tipo_arquivo: file.type,
        tamanho_bytes: file.size,
        caminho_storage: caminho,
        data_upload: new Date().toISOString()
      }])

    if (erroMetadados) {
      console.error('[BoletoService] Erro ao registrar metadados:', erroMetadados)
      throw erroMetadados
    }

    console.log('[BoletoService] ✓ Arquivo anexado com sucesso')
    return { data: { caminho, nomeArquivo }, error: null }
  } catch (err) {
    console.error('[BoletoService] Erro ao anexar arquivo:', err)
    return { data: null, error: err }
  }
}

// Buscar anexos de um boleto
export const getAnexosBoleto = async (boletoId) => {
  try {
    const { data, error } = await supabase
      .from('capt_boletos_anexos')
      .select('*')
      .eq('boleto_id', boletoId)
      .order('data_upload', { ascending: false })

    if (error) throw error

    console.log('[BoletoService] Anexos do boleto', boletoId, ':', data?.length || 0)
    return { data: data || [], error: null }
  } catch (err) {
    console.error('[BoletoService] Erro ao buscar anexos:', err)
    return { data: [], error: err }
  }
}

// Deletar anexo de um boleto
export const deleteAnexoBoleto = async (anexoId, caminhoStorage) => {
  try {
    console.log('[BoletoService] Deletando anexo:', anexoId)

    // Deletar arquivo do storage
    const { error: erroStorage } = await supabase.storage
      .from('titulos')
      .remove([caminhoStorage])

    if (erroStorage) {
      console.warn('[BoletoService] Aviso ao deletar do storage:', erroStorage.message)
    }

    // Deletar registro de metadados
    const { error: erroMetadados } = await supabase
      .from('capt_boletos_anexos')
      .delete()
      .eq('id', anexoId)

    if (erroMetadados) {
      console.error('[BoletoService] Erro ao deletar metadados:', erroMetadados)
      throw erroMetadados
    }

    console.log('[BoletoService] ✓ Anexo deletado com sucesso')
    return { error: null }
  } catch (err) {
    console.error('[BoletoService] Erro ao deletar anexo:', err)
    return { error: err }
  }
}

// Gerar URL de download para um anexo
export const getDownloadUrlAnexo = async (caminhoStorage) => {
  try {
    const { data, error } = await supabase.storage
      .from('titulos')
      .createSignedUrl(caminhoStorage, 3600) // URL válida por 1 hora

    if (error) throw error

    return { data: data.signedUrl, error: null }
  } catch (err) {
    console.error('[BoletoService] Erro ao gerar URL de download:', err)
    return { data: null, error: err }
  }
}

// Buscar o próximo COD_OPERACAO para um cedente
export const getProximoCodOperacao = async (codCedente) => {
  try {
    console.log('[BoletoService] Buscando próximo COD_OPERACAO para:', codCedente)

    const { data, error } = await supabase
      .from('OPECABWEB')
      .select('COD_OPERACAO')
      .eq('COD_CEDENTE', codCedente)
      .order('COD_OPERACAO', { ascending: false })
      .limit(1)

    if (error) throw error

    let proximo = 1
    if (data && data.length > 0) {
      const ultimoCod = parseInt(data[0].COD_OPERACAO || 0)
      proximo = ultimoCod + 1
    }

    console.log('[BoletoService] Próximo COD_OPERACAO:', proximo)
    return { data: proximo, error: null }
  } catch (err) {
    console.error('[BoletoService] Erro ao buscar COD_OPERACAO:', err)
    return { data: 1, error: err }
  }
}

// Buscar o próximo COD_BORDERO (global)
export const getProximoCodBordero = async () => {
  try {
    console.log('[BoletoService] Buscando próximo COD_BORDERO global...')

    const { data, error } = await supabase
      .from('OPECABWEB')
      .select('COD_BORDERO')
      .order('COD_BORDERO', { ascending: false })
      .limit(1)

    if (error) throw error

    let proximo = 1
    if (data && data.length > 0) {
      const ultimoCod = parseInt(data[0].COD_BORDERO || 0)
      proximo = ultimoCod + 1
    }

    console.log('[BoletoService] Próximo COD_BORDERO:', proximo)
    return { data: proximo, error: null }
  } catch (err) {
    console.error('[BoletoService] Erro ao buscar COD_BORDERO:', err)
    return { data: 1, error: err }
  }
}

// Buscar o próximo COD_TITULO da tabela OPEITEWEB
export const getProximoCodTitulo = async () => {
  try {
    console.log('[BoletoService] Buscando próximo COD_TITULO de OPEITEWEB...')

    const { data, error } = await supabase
      .from('OPEITEWEB')
      .select('COD_TITULO')
      .order('COD_TITULO', { ascending: false })
      .limit(1)

    if (error) throw error

    let proximo = 1
    if (data && data.length > 0) {
      const ultimoCod = parseInt(data[0].COD_TITULO || 0)
      proximo = ultimoCod + 1
    }

    console.log('[BoletoService] Próximo COD_TITULO:', proximo)
    return { data: proximo, error: null }
  } catch (err) {
    console.error('[BoletoService] Erro ao buscar COD_TITULO:', err)
    return { data: 1, error: err }
  }
}

// Função auxiliar para truncar strings a um tamanho máximo
const truncarString = (str, maxLength = 25) => {
  if (!str) return ''
  const strOriginal = String(str)
  if (strOriginal.length > maxLength) {
    console.warn(`[BoletoService] Campo truncado de ${strOriginal.length} para ${maxLength} caracteres`)
    return strOriginal.substring(0, maxLength)
  }
  return strOriginal
}

// Criar antecipação: insere registros em OPECABWEB, SACADOWEB e OPEITEWEB
export const criarAntecipacao = async (boletosParaAntecipar, contaData) => {
  try {
    console.log('[BoletoService] Criando antecipação para', boletosParaAntecipar.length, 'boletos')

    if (!contaData || !contaData.cod_cedente) {
      throw new Error('Conta sem cod_cedente definido')
    }

    // 1. Obter próximos COD_OPERACAO, COD_BORDERO e COD_TITULO
    const { data: proximoCodOperacao } = await getProximoCodOperacao(contaData.cod_cedente)
    const { data: proximoCodBordero } = await getProximoCodBordero()
    const { data: proximoCodTituloInicial } = await getProximoCodTitulo()

    // 2. Preparar dados para OPECABWEB
    const agora = new Date()
    const dtRecepcao = agora.toISOString().split('T')[0] // YYYY-MM-DD
    const hrRecepcao = agora.toTimeString().split(' ')[0] // HH:mm:ss

    const registroOPECABWEB = {
      COD_CEDENTE: contaData.cod_cedente,
      COD_OPERACAO: proximoCodOperacao,
      DT_RECEPCAO: dtRecepcao,
      HR_RECEPCAO: hrRecepcao,
      COD_BORDERO: proximoCodBordero,
      STATUS: 'R'
    }

    console.log('[BoletoService] Inserindo OPECABWEB com STATUS=R:', registroOPECABWEB)

    // 3. Inserir em OPECABWEB
    const { error: erroOPECABWEB } = await supabase
      .from('OPECABWEB')
      .insert([registroOPECABWEB])

    if (erroOPECABWEB) {
      console.error('[BoletoService] Erro ao inserir OPECABWEB:', erroOPECABWEB)
      throw erroOPECABWEB
    }

    // 4. Preparar e inserir registros em SACADOWEB para cada boleto
    console.log('[BoletoService] Preparando registros SACADOWEB...')

    const registrosSACLADOWEB = boletosParaAntecipar.map(boleto => ({
      NOME_SACADO: boleto.sacado_nome || '',
      CIC_SACADO: boleto.sacado_cic || '',
      NOME_LOGRADOURO: boleto.sacado_endereco || '',
      CEP: boleto.sacado_cep || '',
      BAIRRO: boleto.sacado_bairro || '',
      LOCALIDADE: boleto.sacado_cidade || '',
      UF: boleto.sacado_uf || ''
    }))

    // Inserir em SACADOWEB (pode gerar erro de duplicata, que é aceitável)
    const { error: erroSACADOWEB } = await supabase
      .from('SACADOWEB')
      .insert(registrosSACLADOWEB)

    if (erroSACADOWEB) {
      console.warn('[BoletoService] Aviso ao inserir SACADOWEB (pode ter duplicatas):', erroSACADOWEB.message)
      // Não lançar erro, pois SACADO pode já existir
    }

    // 5. Preparar registros para OPEITEWEB com COD_TITULO sequencial
    const PREFIXO_NOSSO_NUMERO = '36877480' // 8 dígitos
    let codTituloAtual = proximoCodTituloInicial
    const registrosOPEITEWEB = boletosParaAntecipar.map(boleto => {
      // Construir NOSSO_NUMERO com prefixo (total 17 dígitos)
      // Prefixo (8) + nosso_numero (9) = 17 dígitos
      const nossoNumeroCompleto = PREFIXO_NOSSO_NUMERO + (boleto.nosso_numero || '').padStart(9, '0')

      // NUMERO é varchar(8): se for numérico, remove zeros à esquerda; pega os últimos 8
      const numeroDocRaw = String(boleto.numero_documento || '').trim()
      const numeroDoc = (/^\d+$/.test(numeroDocRaw) ? numeroDocRaw.replace(/^0+/, '') : numeroDocRaw).slice(-8) || '0'

      // CICs são varchar(14): mantém só dígitos e limita a 14
      const cicEmit = String(boleto.sacado_cic || '').replace(/\D/g, '').slice(0, 14)
      const cicAval = String(boleto.avalista_cic || '').replace(/\D/g, '').slice(0, 14)

      const registro = {
        COD_CEDENTE: contaData.cod_cedente,
        COD_BORDERO: proximoCodBordero,
        COD_TITULO: codTituloAtual++,
        TIPO: 'DUP',
        DT_BORDERO: dtRecepcao,
        VR_FACE: parseFloat(boleto.valor) || 0,
        DT_VENCIMENTO: boleto.data_vencimento || null,
        NUMERO: numeroDoc,                                  // varchar(8)
        NOME_EMITENTE: truncarString(boleto.sacado_nome, 60), // varchar(60)
        CIC_EMITENTE: cicEmit,                              // varchar(14)
        NOSSO_NUMERO: nossoNumeroCompleto.substring(0, 30), // varchar(30)
        NOME_AVALISTA: truncarString(boleto.avalista_nome, 25), // varchar(25)
        CIC_AVALISTA: cicAval,                              // varchar(14)
        STATUS: 'R'
      }

      console.log(`[BoletoService] NUMERO: ${numeroDocRaw} → ${numeroDoc} | NOSSO_NUMERO: ${boleto.nosso_numero || ''} → ${nossoNumeroCompleto}`)

      return registro
    })

    console.log('[BoletoService] Inserindo', registrosOPEITEWEB.length, 'registros OPEITEWEB com COD_TITULO sequencial')

    if (registrosOPEITEWEB.length > 0) {
      console.log('[BoletoService] Exemplo de registro OPEITEWEB:', JSON.stringify(registrosOPEITEWEB[0], null, 2))
    }

    // 6. Inserir em OPEITEWEB
    const { error: erroOPEITEWEB } = await supabase
      .from('OPEITEWEB')
      .insert(registrosOPEITEWEB)

    if (erroOPEITEWEB) {
      console.error('[BoletoService] Erro ao inserir OPEITEWEB:', erroOPEITEWEB)
      throw erroOPEITEWEB
    }

    // Marca os boletos enviados para antecipação como status_efactor = 'Enviado'
    const idsBoletosEnviados = boletosParaAntecipar.map(b => b.id).filter(Boolean)
    if (idsBoletosEnviados.length > 0) {
      const { error: errStatusEfactor } = await supabase
        .from('capt_boletos')
        .update({ status_efactor: 'Enviado' })
        .in('id', idsBoletosEnviados)
      if (errStatusEfactor) {
        console.warn('[BoletoService] Aviso ao atualizar status_efactor=Enviado:', errStatusEfactor.message)
      } else {
        console.log(`[BoletoService] status_efactor='Enviado' atualizado em ${idsBoletosEnviados.length} boleto(s)`)
      }
    }

    console.log('[BoletoService] ✓ Antecipação criada com sucesso')
    return {
      data: {
        codBordero: proximoCodBordero,
        codOperacao: proximoCodOperacao,
        quantidadeBoletos: registrosOPEITEWEB.length,
        codTituloInicio: proximoCodTituloInicial,
        codTituloFim: codTituloAtual - 1
      },
      error: null
    }
  } catch (err) {
    console.error('[BoletoService] Erro ao criar antecipação:', err)
    return { data: null, error: err }
  }
}

// Retornar (desfazer) antecipação: remove os registros gravados pelo Antecipar.
// Regra: se o título em OPEITEWEB estiver com STATUS = 'R', NÃO é possível retornar.
// (condição isolada em STATUS_BLOQUEIA_RETORNO para fácil ajuste/inversão)
export const retornarAntecipacao = async (boletosParaRetornar, contaData) => {
  try {
    if (!contaData || !contaData.cod_cedente) {
      throw new Error('Conta sem cod_cedente definido')
    }

    const PREFIXO_NOSSO_NUMERO = '36877480'
    const STATUS_PERMITE_RETORNO = 'R' // OPECABWEB.STATUS = 'R' => permite retornar

    // Monta as chaves NOSSO_NUMERO (mesma regra usada no criarAntecipacao)
    const chaves = (boletosParaRetornar || [])
      .map(b => PREFIXO_NOSSO_NUMERO + String(b.nosso_numero || '').padStart(9, '0'))
      .filter(Boolean)

    if (chaves.length === 0) {
      return { data: { retornados: 0, bloqueados: 0, naoEncontrados: (boletosParaRetornar || []).length, bloqueadosTitulos: [] }, error: null }
    }

    // 1) Localiza os títulos em OPEITEWEB
    const { data: rows, error: errBusca } = await supabase
      .from('OPEITEWEB')
      .select('ID, COD_BORDERO, NOSSO_NUMERO, NUMERO')
      .eq('COD_CEDENTE', contaData.cod_cedente)
      .in('NOSSO_NUMERO', chaves)

    if (errBusca) throw errBusca

    const encontrados = rows || []
    const chavesEncontradas = new Set(encontrados.map(r => r.NOSSO_NUMERO))
    const naoEncontrados = chaves.filter(c => !chavesEncontradas.has(c)).length

    if (encontrados.length === 0) {
      return { data: { retornados: 0, bloqueados: 0, naoEncontrados, bloqueadosTitulos: [] }, error: null }
    }

    // 2) Carrega o STATUS de OPECABWEB para cada borderô envolvido
    const borderos = [...new Set(encontrados.map(r => r.COD_BORDERO).filter(v => v != null))]
    const statusPorBordero = {}
    if (borderos.length > 0) {
      const { data: cabs, error: errCab } = await supabase
        .from('OPECABWEB')
        .select('COD_BORDERO, STATUS')
        .eq('COD_CEDENTE', contaData.cod_cedente)
        .in('COD_BORDERO', borderos)
      if (errCab) throw errCab
      ;(cabs || []).forEach(c => { statusPorBordero[c.COD_BORDERO] = c.STATUS })
    }

    // 3) Permite retornar quando OPECABWEB.STATUS = 'R'; caso contrário, bloqueia
    const permitidos = encontrados.filter(r => statusPorBordero[r.COD_BORDERO] === STATUS_PERMITE_RETORNO)
    const bloqueados = encontrados.filter(r => statusPorBordero[r.COD_BORDERO] !== STATUS_PERMITE_RETORNO)

    console.log(`[BoletoService] Retornar antecipação: ${encontrados.length} encontrados, ${permitidos.length} permitidos (OPECABWEB.STATUS=R), ${bloqueados.length} bloqueados`)

    let retornados = 0
    if (permitidos.length > 0) {
      // Remove os títulos permitidos de OPEITEWEB
      const ids = permitidos.map(r => r.ID)
      const { error: errDel } = await supabase.from('OPEITEWEB').delete().in('ID', ids)
      if (errDel) throw errDel
      retornados = permitidos.length

      // Remove o cabeçalho OPECABWEB do borderô quando não restarem títulos
      const borderosAfetados = [...new Set(permitidos.map(r => r.COD_BORDERO).filter(v => v != null))]
      for (const bordero of borderosAfetados) {
        const { count } = await supabase
          .from('OPEITEWEB')
          .select('*', { count: 'exact', head: true })
          .eq('COD_CEDENTE', contaData.cod_cedente)
          .eq('COD_BORDERO', bordero)
        if (!count || count === 0) {
          const { error: errCabDel } = await supabase
            .from('OPECABWEB')
            .delete()
            .eq('COD_CEDENTE', contaData.cod_cedente)
            .eq('COD_BORDERO', bordero)
          if (errCabDel) console.warn('[BoletoService] Aviso ao remover OPECABWEB do borderô', bordero, errCabDel.message)
        }
      }
    }

    return {
      data: {
        retornados,
        bloqueados: bloqueados.length,
        naoEncontrados,
        bloqueadosTitulos: bloqueados.map(r => r.NUMERO),
      },
      error: null,
    }
  } catch (err) {
    console.error('[BoletoService] Erro ao retornar antecipação:', err)
    return { data: null, error: err }
  }
}

// Contar quantas remessas ja foram geradas para uma conta (pelo cedente)
// Usado como fallback quando cnab400 esta corrompido/nulo
export const getContaRemessaCount = async (cedente) => {
    try {
        if (!cedente) return { count: 0, error: null }
        const { count, error } = await supabase
            .from('REMESSAS')
            .select('*', { count: 'exact', head: true })
            .eq('CONTA', cedente)
        if (error) throw error
        return { count: count || 0, error: null }
    } catch (err) {
        console.error('Erro ao contar remessas:', err)
        return { count: 0, error: err }
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
