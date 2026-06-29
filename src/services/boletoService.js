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

  // Converter DD/MM/YY (ano de 2 dígitos) para YYYY-MM-DD assumindo 20YY
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split('/')
    return `20${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
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

      let query = supabase
        .from('capt_boletos')
        .select('id, numero_documento, sacado_nome, sacado_cic, sacado_endereco, sacado_bairro, sacado_cidade, sacado_uf, sacado_cep, sacado_telefone, sacado_email, data_emissao, data_vencimento, valor, nosso_numero, codigo_barras, status, situacao, created_at, num_lancamento, descricao, avalista_nome, avalista_cic, status_efactor, zapsign_status, zapsign_sign_url, zapsign_doc_token')
        .order('created_at', { ascending: false })
        .range(start, end)

      // contaId null/undefined = sem filtro de perfil (retorna todos os registros)
      if (contaId) {
        query = query.eq('conta_id', contaId)
      }

      const { data, error } = await query

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
    // Incremento ATÔMICO via RPC (UPDATE ... RETURNING com lock de linha).
    // Substitui o antigo SELECT+UPDATE, que sob importação em paralelo
    // (Promise.all) lia o mesmo nnumero em chamadas simultâneas e gerava
    // nosso_numero DUPLICADO. A RPC garante uma faixa exclusiva por chamada.
    const { data, error } = await supabase
      .rpc('next_nosso_numero', { p_conta_id: contaId, p_count: 1 })
      .single()

    if (error) throw error
    if (!data || data.last_num == null) {
      throw new Error('RPC next_nosso_numero não retornou valor')
    }

    // Armazena APENAS O NÚMERO, SEM DV (DV é recalculado na geração do CNAB400)
    return { nossoNumero: String(data.last_num), error: null }
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
      // Novo boleto (importação OS, digitação ou Efactor) nasce como "Gravado".
      // Só vira "Registrado" via importação do relatório BTG (que passa SITUACAO explicitamente).
      situacao: boletoData.SITUACAO || 'Gravado',
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

// Inserção EM LOTE (otimizada) — usada na importação Conta Capt.
// Lê CONTAS uma vez, gera nosso_numero/barcode/juros em memória e insere em lotes,
// em vez de chamar createBoleto (que faz ~4 queries por boleto).
export const createBoletosBulk = async (contaId, boletosData) => {
  try {
    if (!Array.isArray(boletosData) || boletosData.length === 0) {
      return { data: { imported: 0, errors: 0, total: 0 }, error: null }
    }

    // 1) Lê a conta uma única vez (dados para barcode/juros)
    const { data: conta, error: contaErr } = await supabase
      .from('CONTAS')
      .select('id, nnumero, nnumero_dv, nome_correntista, cic, cedente, juros, conta')
      .eq('id', contaId)
      .single()
    if (contaErr || !conta) {
      return { data: null, error: contaErr || new Error('Conta não encontrada') }
    }

    // 1.1) Reserva ATÔMICA da faixa de nosso_numero para todo o lote (sem corrida).
    // A RPC incrementa CONTAS.nnumero em N de uma só vez e devolve a faixa
    // [first_num .. last_num] exclusiva desta chamada.
    const { data: faixa, error: faixaErr } = await supabase
      .rpc('next_nosso_numero', { p_conta_id: contaId, p_count: boletosData.length })
      .single()
    if (faixaErr || !faixa || faixa.first_num == null) {
      return { data: null, error: faixaErr || new Error('Falha ao reservar faixa de nosso_numero') }
    }

    // nnumeroBase é incrementado para first_num já na primeira iteração do map
    let nnumeroBase = Number(faixa.first_num) - 1

    // 2) Monta todos os registros em memória
    const registros = boletosData.map((boletoData) => {
      nnumeroBase += 1
      const dataToInsert = {
        conta_id: contaId,
        numero_documento: boletoData.NUM_TITULO || boletoData.NUMERO_DOCUMENTO || '',
        sacado_nome: boletoData.SACADO_NOME || '',
        data_emissao: convertDateToPG(boletoData.EMISSAO || boletoData.DATA_EMISSAO),
        data_vencimento: convertDateToPG(boletoData.VENCIMENTO || boletoData.DATA_VENCIMENTO),
        valor: parseFloat(boletoData.VALOR || 0),
        nosso_numero: String(nnumeroBase),
        status: boletoData.STATUS || 'pendente',
        situacao: boletoData.SITUACAO || 'Gravado',
        sacado_cic: boletoData.SACADO_CIC || '',
        sacado_endereco: boletoData.SACADO_ENDERECO || '',
        sacado_bairro: boletoData.SACADO_BAIRRO || '',
        sacado_cidade: boletoData.SACADO_CIDADE || '',
        sacado_uf: boletoData.SACADO_UF || '',
        sacado_cep: boletoData.SACADO_CEP || '',
        sacado_telefone: boletoData.SACADO_TELEFONE || '',
        sacado_email: boletoData.SACADO_EMAIL || '',
        avalista_nome: boletoData.AVALISTA_NOME || '',
        avalista_cic: boletoData.AVALISTA_CIC || '',
        valor_pagamento: parseFloat(boletoData.VALOR_PAGAMENTO || 0),
        data_pagamento: boletoData.DATA_PAGAMENTO ? convertDateToPG(boletoData.DATA_PAGAMENTO) : null,
        descricao: boletoData.DESCRICAO || '',
      }

      // Código de barras (gerado) — sobrescrito pela Linha digitável importada, se houver
      try {
        dataToInsert.codigo_barras = generateBarcodeFromBoleto(dataToInsert, conta)
      } catch (e) {
        dataToInsert.codigo_barras = ''
      }
      const cbImportado = String(boletoData.CODIGO_BARRAS || '').replace(/\D/g, '')
      if (cbImportado) dataToInsert.codigo_barras = cbImportado

      // Juros diário a partir de CONTAS.juros
      if (conta.juros && dataToInsert.valor) {
        dataToInsert.juros = Math.round(((dataToInsert.valor * conta.juros) / 3000) * 100) / 100
      }

      // Campos opcionais (Efactor)
      if (boletoData.NUM_LANCAMENTO !== undefined && boletoData.NUM_LANCAMENTO !== null && boletoData.NUM_LANCAMENTO !== '') {
        const n = Number(boletoData.NUM_LANCAMENTO)
        if (!isNaN(n)) dataToInsert.num_lancamento = n
      }
      if (boletoData.STATUS_EFACTOR) dataToInsert.status_efactor = boletoData.STATUS_EFACTOR

      return dataToInsert
    })

    // 3) Insere em lotes
    let imported = 0
    let errors = 0
    const batchSize = 500
    for (let i = 0; i < registros.length; i += batchSize) {
      const lote = registros.slice(i, i + batchSize)
      const { error } = await supabase.from('capt_boletos').insert(lote)
      if (error) {
        console.error('[BoletoService][Bulk] Erro ao inserir lote:', error.message)
        errors += lote.length
      } else {
        imported += lote.length
      }
    }

    // 4) (removido) O contador CONTAS.nnumero já foi avançado atomicamente
    // pela RPC next_nosso_numero no passo 1.1 — não há mais update aqui.

    console.log(`[BoletoService][Bulk] ${imported} inserido(s), ${errors} erro(s)`)
    return { data: { imported, errors, total: registros.length }, error: null }
  } catch (err) {
    console.error('[BoletoService][Bulk] Erro geral:', err)
    return { data: null, error: err }
  }
}

// ============================================================================
// IMPORT CONTA CAPT → capt_registrado
// Regras:
//  - Grava sempre em capt_registrado (nunca em capt_boletos)
//  - Se já existe em capt_registrado (por num_linha_digtvl) → atualiza
//  - Se não existe → insere
//  - Se existe em capt_boletos (por codigo_barras = num_linha_digtvl) → exclui
// ============================================================================
export const importContaCaptToRegistrado = async (boletosData) => {
  try {
    if (!Array.isArray(boletosData) || boletosData.length === 0) {
      return { data: { inserted: 0, updated: 0, deletedFromBoletos: 0, errors: 0 }, error: null }
    }

    // Converte data (Excel serial, DD/MM/YYYY ou YYYY-MM-DD) para YYYY-MM-DD
    const toISO = (v) => {
      if (!v) return null
      if (typeof v === 'number') {
        const d = new Date(Math.round((v - 25569) * 86400 * 1000))
        return isNaN(d) ? null : d.toISOString().slice(0, 10)
      }
      const s = String(v).trim()
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
        const [dd, mm, yyyy] = s.split('/')
        return `${yyyy}-${mm}-${dd}`
      }
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
      return null
    }

    const toNum = (v) => {
      if (!v && v !== 0) return null
      if (typeof v === 'number') return v
      const s = String(v).trim().replace(/[^\d.,]/g, '')
      if (s.includes(',')) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || null
      return parseFloat(s) || null
    }

    // Mapeia campos da ContaCaptUpload → capt_registrado
    const toRegistradoRow = (b) => ({
      num_linha_digtvl: String(b.CODIGO_BARRAS || '').replace(/\D/g, '') || null,
      numero_documento:            b.NUMERO_DOCUMENTO || null,
      nom_rz_soc_pagdr:            b.SACADO_NOME     || null,
      cnpj_cpf_pagdr:              String(b.SACADO_CIC  || '').replace(/\D/g, '') || null,
      cep_pagdr:                   String(b.SACADO_CEP  || '').replace(/\D/g, '') || null,
      lograd_pagdr:                b.SACADO_ENDERECO  || null,
      numero_endereco_pagdr:       b.SACADO_NUMERO    || null,
      complemento_endereco_pagdr:  b.SACADO_COMPLEMENTO || null,
      cid_pagdr:                   b.SACADO_CIDADE    || null,
      uf_pagdr:                    b.SACADO_UF        || null,
      email_pagdr:                 b.SACADO_EMAIL     || null,
      telefone_pagdr:              b.SACADO_TELEFONE  || null,
      identd_nosso_num:            b.NOSSO_NUMERO     || null,
      vlr_tit:                     toNum(b.VALOR),
      dt_ems_tit:                  toISO(b.EMISSAO),
      dt_venc_tit:                 toISO(b.VENCIMENTO),
      nome_sacador_avalista:       b.AVALISTA_NOME    || null,
      descricao:                   b.DESCRICAO        || null,
      situacao_boleto:             b.STATUS           || null,
    })

    const rows = boletosData.map(toRegistradoRow)
    // Conjunto de linhas digitáveis do lote (sempre só dígitos)
    const linhasDigitaveis = [...new Set(rows.map(r => r.num_linha_digtvl).filter(Boolean))]
    const linhasSet = new Set(linhasDigitaveis)

    // 1) Buscar registros existentes em capt_registrado varrendo TODAS as páginas.
    //    O campo num_linha_digtvl pode estar armazenado com formatação (espaços, pontos)
    //    ou só dígitos — por isso normalizamos os dois lados para comparar.
    //    existingMap: digits-only → { id, storedValue }
    const existingMap = new Map()
    {
      const pageSize = 1000
      let from = 0
      while (true) {
        const { data, error } = await supabase
          .from('capt_registrado')
          .select('id, num_linha_digtvl')
          .range(from, from + pageSize - 1)
        if (error) { console.warn('[importContaCaptToRegistrado] Erro ao ler capt_registrado:', error.message); break }
        if (!data || data.length === 0) break
        data.forEach(r => {
          const norm = String(r.num_linha_digtvl || '').replace(/\D/g, '')
          if (norm && linhasSet.has(norm)) {
            existingMap.set(norm, r.id)
          }
        })
        if (data.length < pageSize) break
        from += pageSize
      }
    }
    console.log(`[importContaCaptToRegistrado] ${existingMap.size} registro(s) já existente(s) em capt_registrado`)

    // 2) Excluir de capt_boletos qualquer registro cujo codigo_barras bata com
    //    uma das linhas digitáveis importadas.
    //    Estratégia: carrega TODA capt_boletos em páginas (comparação em JS),
    //    evitando URLs longas que causam 400 ao usar .in() com strings de 47 dígitos.
    let deletedFromBoletos = 0
    {
      const idsParaExcluir = []
      const pageSize = 1000
      let from = 0
      while (true) {
        const { data: bPage, error: bErr } = await supabase
          .from('capt_boletos')
          .select('id, codigo_barras')
          .range(from, from + pageSize - 1)
        if (bErr) { console.warn('[importContaCaptToRegistrado] Erro ao ler capt_boletos:', bErr.message); break }
        if (!bPage || bPage.length === 0) break
        bPage.forEach(b => {
          const norm = String(b.codigo_barras || '').replace(/\D/g, '')
          if (norm && linhasSet.has(norm)) idsParaExcluir.push(b.id)
        })
        if (bPage.length < pageSize) break
        from += pageSize
      }
      // Exclui em lotes de 100 IDs (UUIDs são curtos, sem risco de URL longa)
      const delBatch = 100
      for (let i = 0; i < idsParaExcluir.length; i += delBatch) {
        const chunk = idsParaExcluir.slice(i, i + delBatch)
        const { error: delErr } = await supabase.from('capt_boletos').delete().in('id', chunk)
        if (!delErr) deletedFromBoletos += chunk.length
        else console.warn('[importContaCaptToRegistrado] Erro ao excluir capt_boletos:', delErr.message)
      }
    }

    // 3) Separar em inserções e atualizações (por num_linha_digtvl normalizado)
    const toInsert = []
    const toUpdate = [] // [{id, row}]
    for (const row of rows) {
      const norm = String(row.num_linha_digtvl || '').replace(/\D/g, '')
      const existingId = norm ? existingMap.get(norm) : null
      if (existingId) {
        toUpdate.push({ id: existingId, row })
      } else {
        toInsert.push(row)
      }
    }

    // 4) Inserir novos em lote
    let inserted = 0
    let errors = 0
    const BATCH = 500
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const chunk = toInsert.slice(i, i + BATCH)
      const { error } = await supabase.from('capt_registrado').insert(chunk)
      if (error) {
        errors += chunk.length
        console.error('[importContaCaptToRegistrado] Erro ao inserir lote:', error.message)
      } else {
        inserted += chunk.length
      }
    }

    // 5) Atualizar existentes em lote usando update por id
    //    (Supabase não suporta bulk update com diferentes valores, então fazemos em paralelo controlado)
    let updated = 0
    const UPDATE_CONCURRENCY = 10
    for (let i = 0; i < toUpdate.length; i += UPDATE_CONCURRENCY) {
      const slice = toUpdate.slice(i, i + UPDATE_CONCURRENCY)
      const results = await Promise.all(
        slice.map(({ id, row }) =>
          supabase.from('capt_registrado').update(row).eq('id', id)
        )
      )
      results.forEach(({ error }) => {
        if (error) {
          errors++
          console.error('[importContaCaptToRegistrado] Erro ao atualizar:', error.message)
        } else {
          updated++
        }
      })
    }

    console.log(`[importContaCaptToRegistrado] ${inserted} inserido(s), ${updated} atualizado(s), ${deletedFromBoletos} removido(s) de capt_boletos, ${errors} erro(s)`)
    return { data: { inserted, updated, deletedFromBoletos, errors }, error: null }
  } catch (err) {
    console.error('[importContaCaptToRegistrado] Erro geral:', err)
    return { data: null, error: err }
  }
}

// Buscar Lançamento (E-Factor): para os boletos SEM num_lancamento, pareia cada um
// com o melhor candidato OPEITE do MESMO sacado (CIC). Retorna linhas comparativas.
export const buscarLancamentos = async (boletos) => {
  try {
    const alvos = (boletos || []).filter(b => !b.num_lancamento)
    if (alvos.length === 0) return { data: [], error: null }

    const onlyDigits = (v) => String(v || '').replace(/\D/g, '')
    const normData = (d) => (d ? String(d).slice(0, 10) : '')
    const cicsAlvo = new Set(alvos.map(b => onlyDigits(b.sacado_cic)).filter(Boolean))

    // 1) SACADO: COD_SACADO -> CIC
    const cicPorCod = {}
    {
      let from = 0; const ps = 1000
      while (true) {
        const { data, error } = await supabase.from('SACADO').select('COD_SACADO, CIC').range(from, from + ps - 1)
        if (error) { console.warn('[buscarLancamentos] SACADO:', error.message); break }
        if (!data || data.length === 0) break
        data.forEach(s => { cicPorCod[s.COD_SACADO] = onlyDigits(s.CIC) })
        if (data.length < ps) break
        from += ps
      }
    }

    // 2) OPEITE agrupado por CIC (apenas dos sacados-alvo)
    const opeitePorCic = {}
    {
      let from = 0; const ps = 1000
      while (true) {
        const { data, error } = await supabase.from('OPEITE')
          .select('NUM_LANCAMENTO, NUM_TITULO, VR_FACE, DT_VENCI, COD_SACADO')
          .range(from, from + ps - 1)
        if (error) { console.warn('[buscarLancamentos] OPEITE:', error.message); break }
        if (!data || data.length === 0) break
        data.forEach(o => {
          const cic = cicPorCod[o.COD_SACADO]
          if (!cic || !cicsAlvo.has(cic)) return
          ;(opeitePorCic[cic] = opeitePorCic[cic] || []).push(o)
        })
        if (data.length < ps) break
        from += ps
      }
    }

    // 3) Melhor candidato por boleto (prefere valor+venc, depois valor, depois venc)
    const rows = alvos.map(b => {
      const cic = onlyDigits(b.sacado_cic)
      const valor = parseFloat(b.valor) || 0
      const venc = normData(b.data_vencimento)
      const cands = opeitePorCic[cic] || []
      let best = null, bestScore = -1
      for (const o of cands) {
        const mv = (parseFloat(o.VR_FACE) || 0) === valor
        const md = normData(o.DT_VENCI) === venc
        const score = (mv ? 2 : 0) + (md ? 1 : 0)
        if (score > bestScore) { bestScore = score; best = o }
      }
      return {
        boleto_id: b.id,
        boleto_num_lancamento: b.num_lancamento || '',
        opeite_num_lancamento: best ? (best.NUM_LANCAMENTO ?? '') : '',
        boleto_numero_documento: b.numero_documento || '',
        opeite_num_titulo: best ? (best.NUM_TITULO ?? '') : '',
        boleto_valor: valor,
        opeite_vr_face: best ? (parseFloat(best.VR_FACE) || 0) : '',
        boleto_vencimento: b.data_vencimento || '',
        opeite_dt_venci: best ? (best.DT_VENCI ?? '') : '',
        boleto_sacado_cic: cic,
        sacado_cic: best ? cic : '',
      }
    })

    return { data: rows, error: null }
  } catch (err) {
    console.error('[buscarLancamentos] Erro:', err)
    return { data: null, error: err }
  }
}

// Buscar Lançamento (E-Factor): retorna os lançamentos OPEITE do mesmo sacado (CIC)
// de um boleto. Usado para escolher manualmente o NUM_LANCAMENTO.
export const buscarOpeitePorCic = async (sacadoCic) => {
  try {
    const cic = String(sacadoCic || '').replace(/\D/g, '')
    if (!cic) return { data: [], error: null }

    // 1) COD_SACADO(s) com esse CIC
    const { data: sacados, error: e1 } = await supabase
      .from('SACADO')
      .select('COD_SACADO, CIC')
      .eq('CIC', cic)
    if (e1) throw e1
    const cods = (sacados || []).map(s => s.COD_SACADO)
    if (cods.length === 0) return { data: [], error: null }

    // 2) OPEITE desses sacados (paginado)
    let all = []
    const ps = 1000
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('OPEITE')
        .select('NUM_LANCAMENTO, NUM_TITULO, VR_FACE, DT_VENCI, DT_VENCI_NOVO, STATUS, COD_SACADO')
        .in('COD_SACADO', cods)
        .in('STATUS', ['DO', 'PR', 'IN'])
        .range(from, from + ps - 1)
      if (error) throw error
      if (!data || data.length === 0) break
      all = all.concat(data)
      if (data.length < ps) break
      from += ps
    }
    // Regra: se STATUS=PR, usar DT_VENCI_NOVO no lugar de DT_VENCI
    all.forEach(o => {
      if (String(o.STATUS || '').trim().toUpperCase() === 'PR' && o.DT_VENCI_NOVO) {
        o.DT_VENCI = o.DT_VENCI_NOVO
      }
    })
    return { data: all, error: null }
  } catch (err) {
    console.error('[buscarOpeitePorCic] Erro:', err)
    return { data: null, error: err }
  }
}

// Monta conjuntos de valores/vencimentos do OPEITE por CIC.
// Usado para filtrar na E-Factor os boletos que têm valor/vencimento com correspondência no OPEITE.
export const getOpeiteMatchMaps = async () => {
  try {
    const cicPorCod = {}
    {
      let from = 0; const ps = 1000
      while (true) {
        const { data, error } = await supabase.from('SACADO').select('COD_SACADO, CIC').range(from, from + ps - 1)
        if (error) { console.warn('[getOpeiteMatchMaps] SACADO:', error.message); break }
        if (!data || data.length === 0) break
        data.forEach(s => { cicPorCod[s.COD_SACADO] = String(s.CIC || '').replace(/\D/g, '') })
        if (data.length < ps) break
        from += ps
      }
    }

    const valoresPorCic = {}      // cic -> Set(cents)
    const vencimentosPorCic = {}  // cic -> Set('YYYY-MM-DD')
    const porTitulo = {}          // `${cic}|${tituloNormalizado}` -> { cents, venc }
    {
      let from = 0; const ps = 1000
      while (true) {
        const { data, error } = await supabase.from('OPEITE').select('NUM_TITULO, VR_FACE, DT_VENCI, COD_SACADO').range(from, from + ps - 1)
        if (error) { console.warn('[getOpeiteMatchMaps] OPEITE:', error.message); break }
        if (!data || data.length === 0) break
        data.forEach(o => {
          const cic = cicPorCod[o.COD_SACADO]
          if (!cic) return
          const cents = Math.round((parseFloat(o.VR_FACE) || 0) * 100)
          ;(valoresPorCic[cic] = valoresPorCic[cic] || new Set()).add(cents)
          const dv = o.DT_VENCI ? String(o.DT_VENCI).slice(0, 10) : ''
          if (dv) (vencimentosPorCic[cic] = vencimentosPorCic[cic] || new Set()).add(dv)
          // Mapa por título (CIC + NUM_TITULO normalizado, só dígitos sem zeros à esquerda)
          const tit = String(o.NUM_TITULO || '').replace(/\D/g, '').replace(/^0+/, '')
          if (tit) porTitulo[`${cic}|${tit}`] = { cents, venc: dv }
        })
        if (data.length < ps) break
        from += ps
      }
    }

    return { data: { valoresPorCic, vencimentosPorCic, porTitulo }, error: null }
  } catch (err) {
    console.error('[getOpeiteMatchMaps] Erro:', err)
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

// Atualiza múltiplos boletos por num_lancamento (útil após auto-import para ZapSign)
export const updateBoletosByLancamentos = async (contaId, lancamentos, updates) => {
  const nums = lancamentos.map(Number).filter(n => !isNaN(n) && n > 0)
  if (!nums.length) return { error: null }
  const { error } = await supabase
    .from('capt_boletos')
    .update(updates)
    .eq('conta_id', contaId)
    .in('num_lancamento', nums)
  if (error) console.error('[updateBoletosByLancamentos]', error.message)
  return { error }
}

/**
 * Remove de capt_boletos todos os registros cuja conta_id = contaId e cujo nosso_numero
 * já existe em capt_registrado (identd_nosso_num). Retorna { excluidos, error }.
 */
// ============================================================
// capt_assina — funções de serviço
// ============================================================

/**
 * Determina o valor de `lancamento` e `digitavel` para gravar em capt_assina,
 * com base na origem do boleto (OPEITE, CAPT ou REGISTRADO).
 */
export const resolverLancamentoAssina = (boleto) => {
  const origem = boleto._ORIGEM || (boleto.num_lancamento ? 'OPEITE' : 'CAPT')
  let lancamento = ''
  let digitavel = ''

  if (origem === 'OPEITE') {
    lancamento = String(boleto.num_lancamento || '')
    digitavel = boleto.codigo_barras || ''
  } else if (origem === 'REGISTRADO') {
    lancamento = boleto.num_linha_digtvl || String(boleto.nosso_numero || '')
    digitavel = boleto.num_linha_digtvl || ''
  } else {
    // CAPT (capt_boletos)
    lancamento = boleto.codigo_barras || String(boleto.nosso_numero || '')
    digitavel = boleto.codigo_barras || ''
  }
  return { lancamento, digitavel }
}

/**
 * Insere registros em capt_assina — um por boleto.
 * `docResp` = objeto retornado pela API ZapSign (doc_token, open_id, status, name, etc.)
 * `boletos` = array de boletos selecionados (do unified view)
 * `contaId` = UUID da conta
 */
export const insertCaptAssina = async (contaId, docResp, boletos) => {
  if (!docResp?.token || !boletos?.length) return { error: null }
  const rows = boletos.map((b) => {
    const { lancamento, digitavel } = resolverLancamentoAssina(b)
    return {
      conta_id: contaId,
      doc_token: docResp.token,
      open_id: docResp.open_id || null,
      status: 'pendente',
      nome_documento: docResp.name || '',
      original_file: docResp.original_file || null,
      signed_file: docResp.signed_file || null,
      zapsign_created_at: docResp.created_at || null,
      zapsign_updated_at: docResp.last_update_at || null,
      signers: docResp.signers || [],
      lancamento: lancamento || null,
      digitavel: digitavel || null,
    }
  })
  const { error } = await supabase.from('capt_assina').insert(rows)
  if (error) console.error('[insertCaptAssina]', error.message)
  return { error }
}

/**
 * Atualiza status (e signed_file) em capt_assina para todos os registros com doc_token.
 */
export const updateCaptAssinaStatus = async (docToken, status, signedFile) => {
  const updates = { status }
  if (signedFile) updates.signed_file = signedFile
  const { error } = await supabase
    .from('capt_assina')
    .update(updates)
    .eq('doc_token', docToken)
  if (error) console.error('[updateCaptAssinaStatus]', error.message)
  return { error }
}

export const deletarBoletosJaRegistrados = async (contaId) => {
  try {
    // 1. Busca todos os identd_nosso_num de capt_registrado
    const { data: regRows, error: regErr } = await supabase
      .from('capt_registrado')
      .select('identd_nosso_num')
      .not('identd_nosso_num', 'is', null)
    if (regErr) return { excluidos: 0, error: regErr }

    const nossoNumerosRegistrados = [...new Set(
      (regRows || []).map(r => String(r.identd_nosso_num || '').trim()).filter(Boolean)
    )]
    if (nossoNumerosRegistrados.length === 0) return { excluidos: 0, error: null }

    // 2. Deleta de capt_boletos onde nosso_numero bate com algum identd_nosso_num
    const { data: deleted, error: delErr } = await supabase
      .from('capt_boletos')
      .delete()
      .eq('conta_id', contaId)
      .in('nosso_numero', nossoNumerosRegistrados)
      .select('id')
    if (delErr) return { excluidos: 0, error: delErr }

    return { excluidos: (deleted || []).length, error: null }
  } catch (err) {
    return { excluidos: 0, error: err }
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
    let [boletos, allOpeite, allSacado] = await Promise.all([
      paginateTable('capt_boletos', 'id, numero_documento, num_lancamento, valor, data_vencimento, sacado_cic, status'),
      paginateTable('OPEITE', 'NUM_LANCAMENTO, NUM_TITULO, VR_FACE, DT_VENCI, DT_VENCI_NOVO, STATUS, COD_SACADO'),
      paginateTable('SACADO', 'COD_SACADO, CIC')
    ])

    // Regra: desconsiderar registros OPEITE com STATUS = 'DC'
    const totalAntesDC = allOpeite.length
    allOpeite = allOpeite.filter(o => String(o.STATUS || '').trim().toUpperCase() !== 'DC')
    if (totalAntesDC !== allOpeite.length) {
      console.log(`[Reconciliação] ${totalAntesDC - allOpeite.length} registro(s) OPEITE com STATUS=DC desconsiderado(s)`)
    }

    // Regra: se OPEITE.STATUS = 'PR', usar DT_VENCI_NOVO no lugar de DT_VENCI
    // (afeta matching exato, todos os índices e as 3 listas de divergências)
    allOpeite.forEach(o => {
      if (String(o.STATUS || '').trim().toUpperCase() === 'PR' && o.DT_VENCI_NOVO) {
        o.DT_VENCI = o.DT_VENCI_NOVO
      }
    })

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

    // Controle de duplicidades: OPEITE já consumidos nesta execução e boletos pendentes para 2ª passada
    const numLancamentosConsumidos = new Set()
    const pendentesDuplicidade = []

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
          numLancamentosConsumidos.add(exactMatches[0].NUM_LANCAMENTO)
          continue
        }

        // Se MÚLTIPLAS correspondências exatas (duplicidade):
        // desempatar comparando capt_boletos.numero_documento com OPEITE.NUM_TITULO
        if (exactMatches.length > 1) {
          // Normaliza: só dígitos, sem zeros à esquerda (ex: "000000000670201" ≈ "6702-01")
          const normDoc = (v) => String(v || '').replace(/\D/g, '').replace(/^0+/, '')
          const docBoleto = normDoc(boleto.numero_documento)
          const candidatos = docBoleto
            ? exactMatches.filter(m => normDoc(m.NUM_TITULO) === docBoleto)
            : []

          if (candidatos.length === 1) {
            updatesToApply.push({
              id: boleto.id,
              num_lancamento: candidatos[0].NUM_LANCAMENTO
            })
            numLancamentosConsumidos.add(candidatos[0].NUM_LANCAMENTO)
          } else {
            // Sem correspondência de documento (ou ainda ambíguo):
            // guardar para 2ª passada, após os desempates por título consumirem os OPEITE
            pendentesDuplicidade.push({ boleto, exactMatches })
          }
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

    // FASE 1.5: Segunda passada nas duplicidades não resolvidas.
    // Após os desempates por NUM_TITULO consumirem seus OPEITE, reaplica a regra
    // dos 3 iguais (valor+vencimento+cic) apenas entre os OPEITE ainda não consumidos.
    if (pendentesDuplicidade.length > 0) {
      console.log(`[Reconciliação] Fase 1.5: Reprocessando ${pendentesDuplicidade.length} duplicidade(s) com OPEITE restantes...`)
      for (const { boleto, exactMatches } of pendentesDuplicidade) {
        const restantes = exactMatches.filter(m => !numLancamentosConsumidos.has(m.NUM_LANCAMENTO))
        if (restantes.length === 1) {
          updatesToApply.push({
            id: boleto.id,
            num_lancamento: restantes[0].NUM_LANCAMENTO
          })
          numLancamentosConsumidos.add(restantes[0].NUM_LANCAMENTO)
        } else {
          // Ainda ambíguo (0 ou 2+ OPEITE restantes) - ignorar
          totalMatched++
        }
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

// Soma VR_FACE dos registros OPEITE com STATUS='IN' para um dado COD_CEDENTE.
// Usado no card Inadimplentes do Dashboard.
export const getOPEITEInadimplentesTotal = async (codCedente) => {
  if (!codCedente) return 0
  try {
    let total = 0
    let from = 0
    const pageSize = 1000
    while (true) {
      const { data, error } = await supabase
        .from('OPEITE')
        .select('VR_FACE')
        .eq('COD_CEDENTE', codCedente)
        .eq('STATUS', 'IN')
        .range(from, from + pageSize - 1)
      if (error) { console.warn('[getOPEITEInadimplentesTotal]', error.message); break }
      if (!data || data.length === 0) break
      data.forEach(o => { total += parseFloat(o.VR_FACE) || 0 })
      if (data.length < pageSize) break
      from += pageSize
    }
    return total
  } catch (err) {
    console.warn('[getOPEITEInadimplentesTotal] Exceção:', err)
    return 0
  }
}

// Soma VR_FACE de OPEITE onde STATUS IN ('IN','PR','DO') — boletos em aberto no Efactor
export const getOPEITEAbertoTotal = async (codCedente) => {
  if (!codCedente) return 0
  try {
    let total = 0
    let from = 0
    const pageSize = 1000
    while (true) {
      const { data, error } = await supabase
        .from('OPEITE')
        .select('VR_FACE')
        .eq('COD_CEDENTE', codCedente)
        .in('STATUS', ['IN', 'PR', 'DO'])
        .range(from, from + pageSize - 1)
      if (error) { console.warn('[getOPEITEAbertoTotal]', error.message); break }
      if (!data || data.length === 0) break
      data.forEach(o => { total += parseFloat(o.VR_FACE) || 0 })
      if (data.length < pageSize) break
      from += pageSize
    }
    return total
  } catch (err) {
    console.warn('[getOPEITEAbertoTotal] Exceção:', err)
    return 0
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
        .select('NUM_LANCAMENTO, DT_LANCA, NUM_TITULO, VR_FACE, DT_VENCI, DT_VENCI_NOVO, STATUS, COD_SACADO, COD_CEDENTE, NOME_AVALISTA, CIC_AVALISTA')
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

    // Regra: se STATUS=PR, usar DT_VENCI_NOVO no lugar de DT_VENCI
    allOpeite.forEach(o => {
      if (String(o.STATUS || '').trim().toUpperCase() === 'PR' && o.DT_VENCI_NOVO) {
        o.DT_VENCI = o.DT_VENCI_NOVO
      }
    })

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

// ============================================================================
// VISÃO UNIFICADA "IMPORTADOS": une capt_boletos + capt_registrado + OPEITE.
// Faz o matching por VALOR + VENCIMENTO + CIC. Quando o mesmo título aparece
// em 2 ou 3 fontes, exibe APENAS UM registro, priorizando os dados de
// capt_registrado, depois OPEITE, depois capt_boletos. Registros sem
// correspondência aparecem individualmente.
// Vínculos por cedente:
//   capt_boletos.conta_id            = CONTAS.id
//   capt_registrado.cod_cedente_titular = CONTAS.cedente  (texto, ex. "1124527")
//   OPEITE.COD_CEDENTE               = CONTAS.cod_cedente (inteiro, ex. 462)
// ============================================================================

// Normalizações usadas na chave de matching
const _digitsOnly = (v) => String(v ?? '').replace(/\D/g, '')
const _toCents = (v) => Math.round((parseFloat(v) || 0) * 100)
const _isoDate = (d) => (d ? String(d).slice(0, 10) : '')
const _matchKey = (valor, venc, cic) => `${_toCents(valor)}|${_isoDate(venc)}|${_digitsOnly(cic)}`

// Carrega TODA a capt_registrado (a tabela é registrada sob a conta-mãe CAPT, então o
// vínculo com um título do perfil é feito pela CHAVE valor+vencimento+cic, e não pelo
// cedente). Mantém cod_cedente_titular e situacao_boleto para as regras de exibição.
const getAllRegistrado = async () => {
  let all = []
  let page = 0
  const pageSize = 1000
  while (true) {
    const start = page * pageSize
    const { data, error } = await supabase
      .from('capt_registrado')
      .select('id, created_at, dt_inclusao, dt_ems_tit, numero_documento, num_doc_tit, vlr_tit, dt_venc_tit, nom_rz_soc_pagdr, cnpj_cpf_pagdr, situacao_boleto, identd_nosso_num, num_linha_digtvl, cod_cedente_titular')
      .range(start, start + pageSize - 1)
    if (error) {
      console.error('[getAllRegistrado] erro:', error.message)
      break
    }
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < pageSize) break
    page++
  }
  return all
}

// Indexa um array de registros (já no formato unificado) por _key
const _indexByKey = (arr) => {
  const m = new Map()
  for (const rec of arr) {
    if (!m.has(rec._key)) m.set(rec._key, [])
    m.get(rec._key).push(rec)
  }
  return m
}

export const getBoletosImportadosUnificados = async (contaData) => {
  try {
    const contaId = contaData?.id ?? null
    const cedenteTxt = contaData?.cedente ? String(contaData.cedente).trim() : ''
    const codCedente = contaData?.cod_cedente ?? null

    // Carrega as 3 fontes em paralelo. capt_registrado é carregada inteira pois o
    // vínculo é por chave (valor+venc+cic), não por cedente (ver getAllRegistrado).
    const [boletosRes, registrados, opeiteRes] = await Promise.all([
      getBoletos(contaId),
      getAllRegistrado(),
      codCedente != null ? getOPEITEByCedente(codCedente) : Promise.resolve({ data: [] }),
    ])

    const boletos = boletosRes?.data || []
    const opeite = opeiteRes?.data || []

    // --- Normaliza cada fonte para a forma usada pela BoletoTable ---
    const captRecs = boletos.map((b) => ({
      ...b,
      _ORIGEM: 'CAPT',
      _hasCapt: true,
      _key: _matchKey(b.valor, b.data_vencimento, b.sacado_cic),
    }))

    const opeiteRecs = opeite.map((o) => ({
      ...o, // já vem em snake_case (getOPEITEByCedente) com _ORIGEM:'OPEITE'
      _key: _matchKey(o.valor, o.data_vencimento, o.sacado_cic),
    }))

    const regRecs = registrados.map((r) => ({
      _registrado_id: r.id,
      id: `reg_${r.id}`,
      _ORIGEM: 'REGISTRADO',
      num_lancamento: null,
      created_at: r.created_at || r.dt_inclusao || null,
      data_emissao: r.dt_ems_tit || null,
      numero_documento: r.numero_documento || r.num_doc_tit || '',
      valor: parseFloat(r.vlr_tit) || 0,
      data_vencimento: r.dt_venc_tit || null,
      sacado_nome: r.nom_rz_soc_pagdr || '',
      sacado_cic: r.cnpj_cpf_pagdr || '',
      status: r.situacao_boleto || '',
      status_efactor: null,
      situacao: 'registrado', // dispara coluna CONTA = "Sim"
      zapsign_status: null,
      nosso_numero: r.identd_nosso_num || '',
      num_linha_digtvl: r.num_linha_digtvl || '',
      _situacaoReg: r.situacao_boleto || '',
      _cedenteTitular: String(r.cod_cedente_titular ?? '').trim(),
      _key: _matchKey(r.vlr_tit, r.dt_venc_tit, r.cnpj_cpf_pagdr),
    }))

    const regByKey = _indexByKey(regRecs)
    const opeByKey = _indexByKey(opeiteRecs)
    const captByKey = _indexByKey(captRecs)

    // Monta um registro mesclado a partir das 3 fontes (qualquer uma pode faltar).
    // Exibição prioriza REGISTRADO > OPEITE > CAPT; ações usam o registro CAPT (se houver).
    const buildMerged = (R, O, C) => {
      const primary = R || O || C       // fonte dos campos de exibição (prioridade)
      const base = C || primary          // base p/ identidade e ações (capt é editável)
      const merged = { ...base }

      // Campos de exibição vêm da fonte prioritária
      merged.data_emissao = primary.data_emissao
      merged.numero_documento = primary.numero_documento
      merged.valor = primary.valor
      merged.data_vencimento = primary.data_vencimento
      merged.sacado_nome = primary.sacado_nome
      merged.sacado_cic = primary.sacado_cic
      merged.status = primary.status

      // Colunas cruzadas
      // LANC: do capt ou do OPEITE
      merged.num_lancamento = (C && C.num_lancamento) || (O && O.num_lancamento) || primary.num_lancamento || null
      // ANTECIPA: status_efactor do capt, senão do OPEITE
      merged.status_efactor = (C && C.status_efactor) || (O && O.status_efactor) || null
      // ASSINA: somente o capt possui ZapSign
      merged.zapsign_status = C ? C.zapsign_status : null
      merged.zapsign_sign_url = C ? C.zapsign_sign_url : null
      // CONTA: "registrado" se presente em capt_registrado
      merged.situacao = R ? 'registrado' : (C ? C.situacao : (primary.situacao || ''))

      // Origem primária (para badge/guards) e disponibilidade do registro CAPT
      merged._ORIGEM = R ? 'REGISTRADO' : (O ? 'OPEITE' : 'CAPT')
      merged._hasCapt = !!C
      merged._fontes = [R && 'REGISTRADO', O && 'OPEITE', C && 'CAPT'].filter(Boolean)

      // Rótulos das colunas (regras do modo Importados, baseadas na presença em cada fonte):
      // CONTA   = "Sim" se está em capt_registrado, senão "Não"
      // ANTECIPA= "Sim" se está em OPEITE (ou já antecipado); "Enviado" se a antecipação
      //           foi solicitada (capt.status_efactor='Enviado') aguardando aparecer em OPEITE; senão "Não"
      // STATUS  = "Vencer" se está em OPEITE E capt_registrado; senão "Pendente"
      const captStatusEfactor = C ? C.status_efactor : null
      const captSituacao = C ? String(C.situacao || '').toLowerCase() : ''

      // Registrado: verde se em capt_registrado, amarelo se CNAB400 foi gerado (situacao='Remessa'),
      // vermelho caso contrário.
      merged._contaLabel = R
        ? 'Sim'
        : (captSituacao === 'remessa' ? 'Remessa' : 'Não')

      // Antecipado: verde se aparece em OPEITE (confirmado), amarelo se solicitado mas
      // ainda não está em OPEITE, vermelho se não solicitado.
      merged._antecipaLabel = O
        ? 'Sim'
        : (captStatusEfactor === 'Enviado' || captStatusEfactor === 'Antecipado'
          ? 'Aguardando'
          : 'Não')

      merged._statusLabel = (R && O) ? 'Vencer' : 'Pendente'

      // Identidade: usa id do capt se existir; senão id estável da fonte prioritária
      if (C) {
        merged.id = C.id
        merged.conta_id = C.conta_id
      } else if (R) {
        merged.id = R.id // `reg_<id>`
      } else if (O) {
        merged.id = `ope_${O.num_lancamento || O._key}`
      }
      return merged
    }

    const todasKeys = new Set([...regByKey.keys(), ...opeByKey.keys(), ...captByKey.keys()])
    const rows = []
    for (const k of todasKeys) {
      const R = regByKey.get(k) || []
      const O = opeByKey.get(k) || []
      const C = captByKey.get(k) || []
      const n = Math.max(R.length, O.length, C.length)
      for (let i = 0; i < n; i++) {
        const Ri = R[i] || null
        const Oi = O[i] || null
        const Ci = C[i] || null

        // Visibilidade (regra do modo Importados): mostra a linha se
        //  - está em capt_boletos, OU
        //  - está em OPEITE (já filtrado DO/IN/PR), OU
        //  - é um registrado AVULSO (sem capt/OPEITE) "A Vencer" do cedente do perfil ativo.
        // capt_registrado de OUTRO cedente só entra quando casa com um título do perfil
        // (capt/OPEITE) — aí serve apenas para marcar CONTA=Sim, sem virar linha própria.
        const registradoAvulsoVisivel = !!Ri && !Oi && !Ci
          && Ri._cedenteTitular === cedenteTxt
          && Ri._situacaoReg === 'A Vencer'

        if (!(Ci || Oi || registradoAvulsoVisivel)) continue

        rows.push(buildMerged(Ri, Oi, Ci))
      }
    }

    // Ordenação: sem LANC primeiro (topo), depois LANC decrescente (maior = mais recente)
    rows.sort((a, b) => {
      const la = a.num_lancamento || null
      const lb = b.num_lancamento || null
      if (!la && !lb) return 0
      if (!la) return -1   // sem LANC sobe ao topo
      if (!lb) return 1
      return lb - la        // decrescente
    })

    console.log(`[Unificado] capt=${captRecs.length} registrado=${regRecs.length} opeite=${opeiteRecs.length} -> ${rows.length} linha(s)`)
    return { data: rows, error: null }
  } catch (err) {
    console.error('[getBoletosImportadosUnificados] Erro:', err)
    return { data: [], error: err }
  }
}

// Buscar registros OPEITE disponíveis para a view "Efactor" da EfactorPage.
// - codCedente null => todos os registros (usuário Master sem perfil selecionado)
// - Exclui NUM_LANCAMENTO já inseridos em capt_boletos (num_lancamento)
// - Exclui títulos com DT_VENCI anterior à data de hoje
export const getOpeiteEfactorDisponiveis = async (codCedente = null) => {
  try {
    // Data de hoje (local) em YYYY-MM-DD
    const hoje = new Date()
    const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`

    console.log('[BoletoService] Efactor OPEITE disponíveis. COD_CEDENTE:', codCedente || 'TODOS', '| DT_VENCI >=', hojeStr)

    let allOpeite = []
    let page = 0
    const pageSize = 1000

    while (true) {
      const start = page * pageSize
      const end = start + pageSize - 1

      let query = supabase
        .from('OPEITE')
        .select('NUM_LANCAMENTO, DT_LANCA, NUM_TITULO, VR_FACE, DT_VENCI, DT_VENCI_NOVO, STATUS, COD_SACADO, COD_CEDENTE, NOME_AVALISTA, CIC_AVALISTA')
        .eq('TIPO_TITULO', 'DUP')
        .in('STATUS', ['DO', 'IN', 'PR'])
        .range(start, end)

      if (codCedente) {
        query = query.eq('COD_CEDENTE', codCedente)
      }

      const { data, error } = await query
      if (error) throw error
      if (!data || data.length === 0) break

      allOpeite = [...allOpeite, ...data]
      if (data.length < pageSize) break
      page++
    }

    // Regra: se STATUS=PR, usar DT_VENCI_NOVO no lugar de DT_VENCI (antes de qualquer filtro por data)
    allOpeite.forEach(o => {
      if (String(o.STATUS || '').trim().toUpperCase() === 'PR' && o.DT_VENCI_NOVO) {
        o.DT_VENCI = o.DT_VENCI_NOVO
      }
    })

    // Aplicar filtro de vencimento >= hoje após substituição PR
    allOpeite = allOpeite.filter(o => (o.DT_VENCI || '') >= hojeStr)

    console.log(`[BoletoService] Efactor OPEITE: ${allOpeite.length} registros antes da exclusão de já inseridos`)

    // Excluir NUM_LANCAMENTO já existentes em capt_boletos
    const numLancamentos = [...new Set(allOpeite.map(o => o.NUM_LANCAMENTO).filter(Boolean))]
    const jaInseridos = new Set()
    const chunkSize = 500

    for (let i = 0; i < numLancamentos.length; i += chunkSize) {
      const chunk = numLancamentos.slice(i, i + chunkSize)
      const { data: existentes, error: exError } = await supabase
        .from('capt_boletos')
        .select('num_lancamento')
        .in('num_lancamento', chunk)

      if (exError) {
        console.error('[BoletoService] Erro ao verificar num_lancamento em capt_boletos:', exError)
        throw exError
      }
      ;(existentes || []).forEach(r => {
        if (r.num_lancamento != null) jaInseridos.add(String(r.num_lancamento).trim())
      })
    }

    const disponiveis = allOpeite.filter(o => !jaInseridos.has(String(o.NUM_LANCAMENTO).trim()))
    console.log(`[BoletoService] Efactor OPEITE: ${disponiveis.length} disponíveis (${jaInseridos.size} já inseridos em capt_boletos)`)

    // Buscar dados de SACADO para NOME_CORRENTISTA/CIC
    const codSacadoArray = [...new Set(disponiveis.map(o => o.COD_SACADO).filter(Boolean))]
    const sacadoMap = {}

    for (let i = 0; i < codSacadoArray.length; i += pageSize) {
      const batch = codSacadoArray.slice(i, i + pageSize)
      const { data: sacados, error: sacadoError } = await supabase
        .from('SACADO')
        .select('COD_SACADO, NOME_CORRENTISTA, CIC')
        .in('COD_SACADO', batch)

      if (!sacadoError && sacados) {
        sacados.forEach(s => {
          sacadoMap[s.COD_SACADO] = { NOME_CORRENTISTA: s.NOME_CORRENTISTA, CIC: s.CIC }
        })
      }
    }

    // Mapeamento para o padrão dos campos atuais (mesmo formato de getOPEITEByCedente)
    const boletosMapeados = disponiveis.map(opeite => {
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
        created_at: new Date().toISOString(),
        _ORIGEM: 'OPEITE',
        _COD_CEDENTE: opeite.COD_CEDENTE,
        _COD_SACADO: opeite.COD_SACADO,
      }
    })

    return { data: boletosMapeados, error: null }
  } catch (err) {
    console.error('[BoletoService] Erro ao carregar OPEITE disponíveis (Efactor):', err)
    return { data: [], error: err }
  }
}

// ============================================================================
// BORDERÔ: monta os dados do borderô (operação) de um título.
// Fluxo:
//   capt_boletos.num_lancamento = OPEITE.NUM_LANCAMENTO
//   -> OPEITE (linha do título) fornece COD_OPERACAO + COD_CEDENTE
//   -> OPECAB (header da operação, STATUS em BI/LC/LP) fornece os valores
//   -> CEDENTE (qualificação da empresa) por COD_CEDENTE
//   -> OPEITE (todos os títulos da mesma operação) compõem o borderô
//   -> SACADO fornece o nome do sacado de cada título
// Retorna { data: { cedente, cabecalho, titulos }, error }
// ============================================================================
export const getBorderoData = async (numLancamento) => {
  try {
    const numLanc = Number(numLancamento)
    if (!numLanc || isNaN(numLanc)) {
      return { data: null, error: new Error('Título sem num_lancamento (não vinculado ao Efactor).') }
    }

    // 1) Linha do título no OPEITE -> COD_OPERACAO + COD_CEDENTE
    const { data: itemRows, error: itemErr } = await supabase
      .from('OPEITE')
      .select('NUM_LANCAMENTO, COD_OPERACAO, COD_CEDENTE')
      .eq('NUM_LANCAMENTO', numLanc)
      .limit(1)
    if (itemErr) throw itemErr
    if (!itemRows || itemRows.length === 0) {
      return { data: null, error: new Error(`Nenhum lançamento OPEITE encontrado para NUM_LANCAMENTO ${numLanc}.`) }
    }
    const codOperacao = itemRows[0].COD_OPERACAO
    const codCedente = itemRows[0].COD_CEDENTE

    // 2) Header da operação (OPECAB) — STATUS BI/LC/LP
    const { data: cabRows, error: cabErr } = await supabase
      .from('OPECAB')
      .select('COD_CEDENTE, COD_OPERACAO, DATA, VR_FACE, VR_DESAGIO, VR_COMPRA, QTD_TITULOS, VR_IOF, VR_CPMF, VR_ADVALOREM, VR_ISS, VR_COBRANCA, VR_LIQUIDO, PRAZO_MEDIO, STATUS, STATUS_PAGAMENTO')
      .eq('COD_OPERACAO', codOperacao)
      .eq('COD_CEDENTE', codCedente)
      .in('STATUS', ['BI', 'LC', 'LP'])
      .limit(1)
    if (cabErr) throw cabErr
    if (!cabRows || cabRows.length === 0) {
      return { data: null, error: new Error(`Operação ${codOperacao} não disponível para borderô (status diferente de BI/LC/LP).`) }
    }
    const cabecalho = cabRows[0]

    // 3) Qualificação do CEDENTE
    const { data: cedRows, error: cedErr } = await supabase
      .from('CEDENTE')
      .select('COD_CEDENTE, RAZAO_SOCIAL, NOME_FANTASIA, ENDERECO, BAIRRO, CIDADE, UF, CEP, CIC, TELEFONE, ATIVIDADE')
      .eq('COD_CEDENTE', codCedente)
      .limit(1)
    if (cedErr) throw cedErr
    const cedente = (cedRows && cedRows[0]) || { COD_CEDENTE: codCedente, RAZAO_SOCIAL: '' }

    // 4) Todos os títulos da operação (OPEITE)
    const { data: titRows, error: titErr } = await supabase
      .from('OPEITE')
      .select('NUM_LANCAMENTO, NUM_TITULO, TIPO_TITULO, DT_VENCI, VR_FACE, COD_SACADO')
      .eq('COD_OPERACAO', codOperacao)
      .eq('COD_CEDENTE', codCedente)
    if (titErr) throw titErr

    // 5) Nomes dos sacados
    const codSacadoSet = Array.from(new Set((titRows || []).map(t => t.COD_SACADO).filter(Boolean)))
    const sacadoMap = {}
    if (codSacadoSet.length > 0) {
      const { data: sacados } = await supabase
        .from('SACADO')
        .select('COD_SACADO, NOME_CORRENTISTA, CIC')
        .in('COD_SACADO', codSacadoSet)
      ;(sacados || []).forEach(s => { sacadoMap[s.COD_SACADO] = { nome: s.NOME_CORRENTISTA || '', cic: s.CIC || '' } })
    }

    // Data do borderô (para cálculo de dias)
    const dataBordero = cabecalho.DATA ? new Date(cabecalho.DATA) : null

    const titulos = (titRows || []).map(t => {
      const venc = t.DT_VENCI ? new Date(t.DT_VENCI) : null
      let dias = ''
      if (dataBordero && venc && !isNaN(dataBordero.getTime()) && !isNaN(venc.getTime())) {
        dias = Math.round((venc - dataBordero) / (1000 * 60 * 60 * 24))
      }
      const sac = sacadoMap[t.COD_SACADO] || {}
      return {
        tipo: t.TIPO_TITULO || '',
        numero: t.NUM_TITULO || String(t.NUM_LANCAMENTO || ''),
        vencimento: t.DT_VENCI || '',
        valor: parseFloat(t.VR_FACE) || 0,
        nome: sac.nome || '',
        cic: sac.cic || '',
        dias,
      }
    })

    // Ordenar por vencimento
    titulos.sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)))

    return { data: { cedente, cabecalho, titulos }, error: null }
  } catch (err) {
    console.error('[BoletoService] Erro ao montar borderô:', err)
    return { data: null, error: err }
  }
}

// Retorna TODOS os capt_boletos que pertencem à mesma operação (borderô) do título.
// Fluxo: num_lancamento -> OPEITE (COD_OPERACAO+COD_CEDENTE) -> todos os NUM_LANCAMENTO
// da operação -> capt_boletos com esses num_lancamento.
export const getBoletosDoBordero = async (numLancamento) => {
  try {
    const numLanc = Number(numLancamento)
    if (!numLanc || isNaN(numLanc)) return { data: [], error: new Error('Título sem num_lancamento.') }

    const { data: itemRows, error: e1 } = await supabase
      .from('OPEITE')
      .select('COD_OPERACAO, COD_CEDENTE')
      .eq('NUM_LANCAMENTO', numLanc)
      .limit(1)
    if (e1) throw e1
    if (!itemRows || itemRows.length === 0) return { data: [], error: new Error('Operação não encontrada.') }
    const { COD_OPERACAO, COD_CEDENTE } = itemRows[0]

    const { data: titRows, error: e2 } = await supabase
      .from('OPEITE')
      .select('NUM_LANCAMENTO')
      .eq('COD_OPERACAO', COD_OPERACAO)
      .eq('COD_CEDENTE', COD_CEDENTE)
    if (e2) throw e2
    const numLancs = Array.from(new Set((titRows || []).map(t => t.NUM_LANCAMENTO).filter(Boolean)))
    if (numLancs.length === 0) return { data: [], error: null }

    const { data: boletos, error: e3 } = await supabase
      .from('capt_boletos')
      .select('*')
      .in('num_lancamento', numLancs)
    if (e3) throw e3
    return { data: boletos || [], error: null }
  } catch (err) {
    console.error('[BoletoService] Erro ao buscar boletos do borderô:', err)
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
        // Importação do Efactor cria boleto como "Gravado" (ainda não registrado no banco)
        SITUACAO: 'Gravado',
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

// Auto-importa para capt_boletos os registros do modo Importados que ainda não têm entrada
// em capt_boletos (_hasCapt === false). Funciona tanto com registros de origem OPEITE quanto
// REGISTRADO (capt_registrado). Retorna os objetos capt_boletos criados para uso imediato
// na geração de remessa CNAB400.
export const autoImportarParaCapt = async (contaId, records) => {
  try {
    if (!contaId || !records || records.length === 0) {
      return { data: { imported: 0, skipped: 0, errors: 0, boletos: [] }, error: null }
    }

    console.log(`[autoImportarParaCapt] ${records.length} registro(s) sem capt_boletos para conta ${contaId}`)

    // Dedup por num_lancamento (OPEITE): verifica o que já existe em capt_boletos
    const numLancamentosOpeite = records
      .map(r => Number(r.num_lancamento))
      .filter(n => !isNaN(n) && n > 0)

    const existentes = new Set()
    if (numLancamentosOpeite.length > 0) {
      const { data: jaExistem } = await supabase
        .from('capt_boletos')
        .select('num_lancamento')
        .eq('conta_id', contaId)
        .in('num_lancamento', numLancamentosOpeite)
      if (jaExistem) jaExistem.forEach(b => existentes.add(Number(b.num_lancamento)))
    }

    // Buscar endereço completo dos sacados OPEITE (o modo unificado só carrega nome+CIC).
    // importOpeiteToBoletos já faz isso, então seguimos o mesmo padrão aqui.
    const codSacadoSet = new Set(records.map(r => r._COD_SACADO).filter(Boolean))
    const sacadoMap = {}
    if (codSacadoSet.size > 0) {
      const codArray = Array.from(codSacadoSet)
      for (let i = 0; i < codArray.length; i += 1000) {
        const batch = codArray.slice(i, i + 1000)
        const { data: sacados, error: sacErr } = await supabase
          .from('SACADO')
          .select('COD_SACADO, NOME_CORRENTISTA, CIC, ENDERECO, BAIRRO, CIDADE, UF, CEP')
          .in('COD_SACADO', batch)
        if (!sacErr && sacados) {
          sacados.forEach(s => { sacadoMap[s.COD_SACADO] = s })
        } else if (sacErr) {
          console.warn('[autoImportarParaCapt] Aviso ao buscar SACADO:', sacErr.message)
        }
      }
    }

    let imported = 0
    let skipped = 0
    let errors = 0
    const boletos = []

    for (const rec of records) {
      // Checar dedup por num_lancamento
      const numLanc = Number(rec.num_lancamento)
      if (!isNaN(numLanc) && numLanc > 0 && existentes.has(numLanc)) {
        // Já existe em capt_boletos — buscar e usar o existente
        const { data: existente } = await supabase
          .from('capt_boletos')
          .select('*')
          .eq('conta_id', contaId)
          .eq('num_lancamento', numLanc)
          .single()
        if (existente) boletos.push(existente)
        skipped++
        continue
      }

      // Para registros OPEITE: preferir dados completos do SACADO (com endereço).
      // Para registros REGISTRADO: os campos já estão mapeados no objeto mesclado.
      const sac = sacadoMap[rec._COD_SACADO] || {}

      const payload = {
        NUM_TITULO:       rec.num_titulo || rec.numero_documento || '',
        EMISSAO:          rec.data_emissao  || null,
        VENCIMENTO:       rec.data_vencimento || null,
        VALOR:            rec.valor || 0,
        SACADO_NOME:      sac.NOME_CORRENTISTA || rec.sacado_nome || '',
        SACADO_CIC:       sac.CIC              || rec.sacado_cic  || '',
        SACADO_ENDERECO:  sac.ENDERECO         || rec.sacado_endereco || '',
        SACADO_BAIRRO:    sac.BAIRRO           || rec.sacado_bairro  || '',
        SACADO_CIDADE:    sac.CIDADE           || rec.sacado_cidade  || '',
        SACADO_UF:        sac.UF               || rec.sacado_uf      || '',
        SACADO_CEP:       sac.CEP              || rec.sacado_cep     || '',
        AVALISTA_NOME:    rec.avalista_nome  || '',
        AVALISTA_CIC:     rec.avalista_cic   || '',
        STATUS:           'pendente',
        SITUACAO:         'Gravado',
        STATUS_EFACTOR:   rec.status_efactor || (rec._ORIGEM === 'OPEITE' ? 'Registrado' : ''),
        NUM_LANCAMENTO:   (!isNaN(numLanc) && numLanc > 0) ? numLanc : '',
        DESCRICAO:        '',
      }

      const { data: criado, error } = await createBoleto(contaId, payload)
      if (error) {
        errors++
        console.error('[autoImportarParaCapt] Erro ao criar boleto para registro', rec.num_lancamento || rec.numero_documento, ':', error.message)
      } else {
        imported++
        if (!isNaN(numLanc) && numLanc > 0) existentes.add(numLanc)
        if (criado) boletos.push(criado)
      }
    }

    console.log(`[autoImportarParaCapt] Concluído: ${imported} criados, ${skipped} já existiam, ${errors} erros`)
    return { data: { imported, skipped, errors, boletos }, error: null }
  } catch (err) {
    console.error('[autoImportarParaCapt] Erro geral:', err)
    return { data: null, error: err }
  }
}

// Converte uma "Linha digitável" (47 dígitos) no "Código de barras" (44 dígitos).
// Se já vier com 44 dígitos, retorna como está. Usado para casar o relatório BTG
// (que só traz a linha digitável) com capt_boletos.codigo_barras (que pode estar
// armazenado em qualquer um dos dois formatos).
export const linhaDigitavelParaBarcode = (valor) => {
  const d = String(valor || '').replace(/\D/g, '')
  if (d.length === 44) return d
  if (d.length !== 47) return ''
  // Mapeamento inverso de formatLinhaDigitavel():
  // barcode = banco/moeda(0-4) + DVgeral(32) + fator+valor(33-47) + campoLivre(4-9, 10-20, 21-31)
  return d.slice(0, 4) + d[32] + d.slice(33, 47) + d.slice(4, 9) + d.slice(10, 20) + d.slice(21, 31)
}

// Marca como "Registrado" qualquer boleto existente cujo codigo_barras corresponda
// a uma das variantes informadas (linha digitável de 47 e/ou código de barras de 44).
// Retorna { atualizado: boolean, ids: [...] }. Se nada foi atualizado, o chamador
// deve criar o boleto como "Registrado".
export const marcarRegistradoPorCodigoBarras = async (variantes) => {
  try {
    const vs = Array.from(new Set(
      (variantes || []).map(v => String(v || '').replace(/\D/g, '')).filter(Boolean)
    ))
    if (vs.length === 0) return { atualizado: false, ids: [] }

    // Atualiza em lotes pequenos para evitar URLs gigantes no filtro .in()
    const ids = []
    const chunk = 100
    for (let i = 0; i < vs.length; i += chunk) {
      const batch = vs.slice(i, i + chunk)
      const { data, error } = await supabase
        .from('capt_boletos')
        .update({ situacao: 'Registrado' })
        .in('codigo_barras', batch)
        .select('id')
      if (error) {
        console.error('[marcarRegistradoPorCodigoBarras] erro:', error.message)
        return { atualizado: ids.length > 0, ids, error }
      }
      if (data) data.forEach(d => ids.push(d.id))
    }
    return { atualizado: ids.length > 0, ids }
  } catch (err) {
    console.error('[marcarRegistradoPorCodigoBarras] exceção:', err)
    return { atualizado: false, ids: [], error: err }
  }
}

// Retorna um Set com TODOS os codigo_barras já cadastrados em capt_boletos
// (apenas dígitos). Faz uma leitura única paginada da coluna — bem mais rápido e
// seguro que enviar centenas de valores em .in() (que gera URLs gigantes e trava).
// O chamador checa a existência localmente com existentes.has(variante).
// `contaId` opcional restringe a busca a uma conta (mais leve quando informado).
export const buscarCodigosBarrasExistentes = async (codigos, contaId = null) => {
  const existentes = new Set()
  try {
    const pageSize = 1000
    let from = 0
    for (;;) {
      let query = supabase
        .from('capt_boletos')
        .select('codigo_barras')
        .not('codigo_barras', 'is', null)
        .neq('codigo_barras', '')
        .order('id', { ascending: true })
        .range(from, from + pageSize - 1)
      if (contaId) query = query.eq('conta_id', contaId)

      const { data, error } = await query
      if (error) {
        console.warn('[buscarCodigosBarrasExistentes] aviso:', error.message)
        break
      }
      if (!data || data.length === 0) break
      data.forEach(d => {
        const v = String(d.codigo_barras || '').replace(/\D/g, '')
        if (v) existentes.add(v)
      })
      if (data.length < pageSize) break
      from += pageSize
    }
  } catch (err) {
    console.error('[buscarCodigosBarrasExistentes] exceção:', err)
  }
  return existentes
}

// Converte "dd/mm/yyyy" em "yyyy-mm-dd" (formato Postgres). Retorna null se inválido.
const ddmmyyyyParaPG = (s) => {
  const m = String(s || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

// Reconciliação do relatório BTG: para cada registro do arquivo cujo codigo_barras
// corresponda a um boleto já existente, verifica se houve mudança e atualiza:
//   - situacao  → 'Registrado'
//   - status    → coluna G ("Status do boleto", já mapeado)
//   - valor_pagamento → coluna AU ("Valor pago")  — só quando há pagamento (> 0)
//   - data_pagamento  → coluna AV ("Data de pagamento") — só quando há pagamento
// Só grava quando algum campo realmente difere do que está em capt_boletos.
// `registros`: [{ variants:[barcodeDigitos...], isBTG, status, valorPago, dataPagamento }]
// Retorna { existentes:Set<barcodeDigitos>, atualizados:number }.
export const reconciliarBTGExistentes = async (registros) => {
  const result = { existentes: new Set(), atualizados: 0 }
  try {
    // 1) Mapa de boletos existentes (codigo_barras normalizado → linha), leitura paginada
    const mapa = new Map()
    const pageSize = 1000
    let from = 0
    for (;;) {
      const { data, error } = await supabase
        .from('capt_boletos')
        .select('id, codigo_barras, status, valor_pagamento, data_pagamento, situacao')
        .not('codigo_barras', 'is', null)
        .neq('codigo_barras', '')
        .order('id', { ascending: true })
        .range(from, from + pageSize - 1)
      if (error) {
        console.warn('[reconciliarBTGExistentes] aviso:', error.message)
        break
      }
      if (!data || data.length === 0) break
      data.forEach(r => {
        const k = String(r.codigo_barras || '').replace(/\D/g, '')
        if (k) { mapa.set(k, r); result.existentes.add(k) }
      })
      if (data.length < pageSize) break
      from += pageSize
    }

    // 2) Monta updates apenas para os que casaram E mudaram (somente BTG atualiza dados)
    const updates = []
    for (const reg of (registros || [])) {
      let row = null
      for (const v of (reg.variants || [])) {
        if (mapa.has(v)) { row = mapa.get(v); break }
      }
      if (!row || !reg.isBTG) continue

      const payload = {}
      if (String(row.situacao || '') !== 'Registrado') payload.situacao = 'Registrado'
      if (reg.status && reg.status !== row.status) payload.status = reg.status

      const vp = Number(reg.valorPago) || 0
      if (vp > 0) {
        if (Math.abs(vp - (parseFloat(row.valor_pagamento) || 0)) > 0.001) payload.valor_pagamento = vp
        const dp = ddmmyyyyParaPG(reg.dataPagamento)
        if (dp && dp !== (row.data_pagamento || null)) payload.data_pagamento = dp
      }

      if (Object.keys(payload).length > 0) updates.push({ id: row.id, payload })
    }

    // 3) Aplica os updates em paralelo, em lotes
    const BATCH = 25
    for (let i = 0; i < updates.length; i += BATCH) {
      const slice = updates.slice(i, i + BATCH)
      await Promise.all(slice.map(u =>
        supabase.from('capt_boletos').update(u.payload).eq('id', u.id)
      ))
      result.atualizados += slice.length
    }
  } catch (err) {
    console.error('[reconciliarBTGExistentes] exceção:', err)
  }
  return result
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
            .select('id, nome_correntista, conta, cedente, cic, cod_cedente')
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

// Marcar boletos como "Remessa" (CNAB400 Registro gerado) para indicar que estão aguardando registro no banco.
// O ícone Registrado ficará amarelo até aparecer em capt_registrado (verde).
// Verifica quais boletos (por codigo_barras) já existem em capt_registrado.
// Retorna array de { boleto, num_titulo_registrado } para os que já estão registrados.
export const checkBoletosJaRegistrados = async (boletos) => {
  // Monta mapa: codigo_barras normalizado → boleto
  const normMap = new Map()
  for (const b of boletos) {
    const norm = String(b.codigo_barras || '').replace(/\D/g, '')
    if (norm) normMap.set(norm, b)
  }
  if (normMap.size === 0) return []

  const jaRegistrados = []
  const pageSize = 1000
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('capt_registrado')
      .select('num_linha_digtvl, NUM_TITULO')
      .range(from, from + pageSize - 1)
    if (error) { console.warn('[checkBoletosJaRegistrados]', error.message); break }
    if (!data || data.length === 0) break
    data.forEach(r => {
      const norm = String(r.num_linha_digtvl || '').replace(/\D/g, '')
      if (norm && normMap.has(norm)) {
        jaRegistrados.push({ boleto: normMap.get(norm), num_titulo_registrado: r.NUM_TITULO })
      }
    })
    if (data.length < pageSize) break
    from += pageSize
  }
  return jaRegistrados
}

export const markBoletosRemessa = async (ids) => {
  if (!ids || ids.length === 0) return { error: null }
  try {
    const { error } = await supabase
      .from('capt_boletos')
      .update({ situacao: 'Remessa' })
      .in('id', ids)
    if (error) throw error
    return { error: null }
  } catch (err) {
    console.error('[markBoletosRemessa] Erro:', err)
    return { error: err }
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


// ============================================================================
// IMPORTADOS: união simples de capt_boletos + capt_registrado + OPEITE.
// Cada fonte é mapeada para as colunas atuais da BoletoTable. SEM dedup,
// SEM exclusão e SEM regra dos 3 — apenas apresentação dos registros.
// ============================================================================

// Mapeia uma linha de capt_registrado para o formato exibido na BoletoTable.
const mapRegistradoParaColuna = (r) => ({
  id: r.id,
  numero_documento: r.numero_documento || r.num_doc_tit || '',
  sacado_nome: r.nom_rz_soc_pagdr || '',
  sacado_cic: r.cnpj_cpf_pagdr || '',
  data_emissao: r.dt_ems_tit || '',
  data_vencimento: r.dt_venc_tit || '',
  valor: parseFloat(r.vlr_tit) || 0,
  nosso_numero: r.identd_nosso_num || '',
  status: 'pendente',
  situacao: 'Registrado',
  num_lancamento: '',
  created_at: r.dt_inclusao || r.created_at || '',
  _ORIGEM: 'REGISTRADO',
})

// Carrega capt_registrado (paginado) com os campos usados nas colunas.
const carregarCaptRegistrado = async () => {
  let all = []
  let page = 0
  const pageSize = 1000
  while (true) {
    const start = page * pageSize
    const { data, error } = await supabase
      .from('capt_registrado')
      .select('id, numero_documento, num_doc_tit, identd_nosso_num, nom_rz_soc_pagdr, cnpj_cpf_pagdr, dt_ems_tit, dt_inclusao, dt_venc_tit, vlr_tit, num_linha_digtvl, situacao_boleto, created_at')
      .order('created_at', { ascending: false })
      .range(start, start + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all = [...all, ...data]
    if (data.length < pageSize) break
    page++
  }
  return all
}

// Extrai o código de 7 dígitos da CONTA embutido na linha digitável (posições 24-30,
// 1-based) — mesma regra do filtro por perfil usado na importação de arquivos.
const extractContaDaLinha = (linha) => {
  const d = String(linha || '').replace(/\D/g, '')
  if (d.length < 30) return null
  return d.substring(23, 30)
}

// União para o modo Importados: capt_boletos (perfil) + capt_registrado + OPEITE (cedente).
export const getImportadosUnificados = async (contaId, contaData, userType = 'U') => {
  try {
    const [boletosRes, registradosRaw] = await Promise.all([
      getBoletos(contaId),
      carregarCaptRegistrado(),
    ])
    const boletos = boletosRes?.data || []

    // Política de perfil: usuários NÃO master só veem registros de capt_registrado
    // cuja linha digitável pertence à conta do perfil ativo (CONTAS.conta).
    // Enquanto contaData não chegou (carga inicial), NÃO exibe nenhum registrado —
    // evita o "flash" mostrando todos os registros antes do perfil carregar.
    let registradosRelevantes = registradosRaw
    if (userType !== 'M') {
      const contaPerfil = (contaData && contaData.conta)
        ? String(contaData.conta).padStart(8, '0').substring(0, 7)
        : null
      registradosRelevantes = contaPerfil
        ? registradosRaw.filter((r) => extractContaDaLinha(r.num_linha_digtvl) === contaPerfil)
        : []
      console.log(`[Importados] Perfil não-master: capt_registrado filtrado por conta ${contaPerfil} (${registradosRelevantes.length}/${registradosRaw.length})`)
    }
    const registrados = registradosRelevantes.map(mapRegistradoParaColuna)

    let opeite = []
    if (contaData && contaData.cod_cedente) {
      const { data } = await getOPEITEByCedente(contaData.cod_cedente)
      opeite = data || []
    } else {
      console.warn('[Importados] Sem cod_cedente; OPEITE não incluído.')
    }

    const unificadoBruto = [...boletos, ...registrados, ...opeite]

    // Regra dos 3: agrupa por (CIC, valor, vencimento). Quando há correspondência
    // entre as fontes, colapsa em UMA única linha (remove duplicidades).
    const dig = (v) => String(v ?? '').replace(/\D/g, '')
    const chave3 = (r) => {
      const c = dig(r.sacado_cic)
      const cents = Math.round((parseFloat(r.valor) || 0) * 100)
      const v = r.data_vencimento ? String(r.data_vencimento).slice(0, 10) : ''
      return (c && cents && v) ? `${c}|${cents}|${v}` : null
    }
    const grupos = new Map()
    const semChave = []
    for (const r of unificadoBruto) {
      const k = chave3(r)
      if (!k) { semChave.push(r); continue }
      if (!grupos.has(k)) grupos.set(k, [])
      grupos.get(k).push(r)
    }
    const mesclados = []
    for (const rows of grupos.values()) {
      if (rows.length === 1) { mesclados.push(rows[0]); continue }
      // Prioridade da linha base: capt_boletos (editável) > capt_registrado > OPEITE
      const base = rows.find((r) => !r._ORIGEM) || rows.find((r) => r._ORIGEM === 'REGISTRADO') || rows[0]
      const merged = { ...base }
      // LANC: aproveita o num_lancamento de qualquer fonte (tipicamente OPEITE)
      const comLanc = rows.find((r) => r.num_lancamento)
      if (comLanc && comLanc.num_lancamento) {
        merged.num_lancamento = comLanc.num_lancamento
        merged.status_efactor = merged.status_efactor || 'Antecipado'
      }
      // CONTA = Sim quando o título também consta no Relatório de Gestão (capt_registrado)
      if (rows.some((r) => r._ORIGEM === 'REGISTRADO')) merged.situacao = 'Registrado'
      mesclados.push(merged)
    }
    const unificado = [...mesclados, ...semChave]
    console.log(`[Importados] União: ${boletos.length} boletos + ${registrados.length} registrados + ${opeite.length} OPEITE = ${unificadoBruto.length} brutos -> ${unificado.length} após regra dos 3`)
    return { data: unificado, error: null }
  } catch (err) {
    console.error('[Importados] Erro na união:', err)
    return { data: [], error: err }
  }
}
