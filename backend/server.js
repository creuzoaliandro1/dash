import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import { fileURLToPath } from 'url'
import multer from 'multer'
import * as XLSX from 'xlsx'

// Importar serviços
import {
  processarBoleto,
  processarArquivoBoletos,
  normalizarData,
  normalizarValor,
} from './services/boletoImportService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Carregar variáveis do arquivo .env.local
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

// Multer para upload de arquivo
const upload = multer({ storage: multer.memoryStorage() })

// Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// ==================
// HEALTH CHECK
// ==================

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

// ==================
// ROUTES: BOLETOS EXISTENTES
// ==================

// Get all boletos for user
app.get('/boletos/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const { data, error } = await supabase
      .from('boletos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// Create boleto
app.post('/boletos', async (req, res) => {
  try {
    const { user_id, descricao, cliente, valor, status, vencimento } = req.body

    const { data, error } = await supabase
      .from('boletos')
      .insert([{
        user_id,
        descricao,
        cliente,
        valor,
        status: status || 'pendente',
        vencimento,
      }])
      .select()

    if (error) throw error
    res.json(data[0])
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// Update boleto
app.put('/boletos/:id', async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    const { data, error } = await supabase
      .from('boletos')
      .update(updates)
      .eq('id', id)
      .select()

    if (error) throw error
    res.json(data[0])
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// Delete boleto
app.delete('/boletos/:id', async (req, res) => {
  try {
    const { id } = req.params

    const { error } = await supabase
      .from('boletos')
      .delete()
      .eq('id', id)

    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// Get statistics
app.get('/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params

    const { data, error } = await supabase
      .from('boletos')
      .select('status, valor')
      .eq('user_id', userId)

    if (error) throw error

    const stats = {
      total: data.length,
      pago: data.filter(b => b.status === 'pago').length,
      pendente: data.filter(b => b.status === 'pendente').length,
      atrasado: data.filter(b => b.status === 'atrasado').length,
      cancelado: data.filter(b => b.status === 'cancelado').length,
      totalRecebido: data
        .filter(b => b.status === 'pago')
        .reduce((sum, b) => sum + (b.valor || 0), 0),
    }

    res.json(stats)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// ==================
// ROUTES: IMPORTAÇÃO CNAB400 (NOVO)
// ==================

/**
 * POST /api/importar-boletos
 * Importa arquivo Excel com boletos CNAB400
 */
app.post('/api/importar-boletos', upload.single('arquivo'), async (req, res) => {
  try {
    // 1. Validar arquivo
    if (!req.file) {
      return res.status(400).json({ erro: 'Arquivo não fornecido' })
    }

    console.log(`[IMPORT] Iniciado - Importação de arquivo CNAB400`)

    // 2. Ler arquivo Excel
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' })
    const primeiraAba = workbook.SheetNames[0]
    const planilha = workbook.Sheets[primeiraAba]
    const boletos = XLSX.utils.sheet_to_json(planilha)

    console.log(`[IMPORT] Arquivo contém ${boletos.length} registros`)

    // 3. Validar se há registros
    if (boletos.length === 0) {
      return res.status(400).json({ erro: 'Arquivo vazio' })
    }

    // 4. Processar todos os boletos
    const resultado = await processarArquivoBoletos(boletos, null, supabase, 'normal')

    console.log(`[IMPORT] Concluído: ${resultado.inseridos} INSERT, ${resultado.atualizados} UPDATE, ${resultado.erros} ERRO`)

    // 5. Retornar resultado
    res.json({
      mensagem: 'Importação concluída com sucesso',
      resumo: {
        total: resultado.total,
        inseridos: resultado.inseridos,
        atualizados: resultado.atualizados,
        nao_alterados: resultado.semMudanca,
        com_erro: resultado.erros,
        taxa_sucesso: resultado.taxaSucesso,
      },
      importacao_id: resultado.importacaoId,
      // Retornar apenas erros (máx 10)
      erros: resultado.erros > 0
        ? resultado.resultados.filter(r => r.status === 'erro').slice(0, 10)
        : [],
    })
  } catch (error) {
    console.error('[IMPORT] Erro:', error)
    res.status(500).json({
      erro: 'Erro ao processar arquivo',
      detalhes: error.message,
    })
  }
})

/**
 * POST /api/importar-boleto-individual
 * Importa apenas um boleto (útil para testes)
 */
app.post('/api/importar-boleto-individual', express.json(), async (req, res) => {
  try {
    const boleto = req.body

    if (!boleto['Linha digitável']) {
      return res.status(400).json({ erro: 'Campo "Linha digitável" é obrigatório' })
    }

    const resultado = await processarBoleto(boleto, null, supabase, 'normal')

    res.json({
      ...resultado,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    res.status(500).json({
      status: 'erro',
      message: error.message,
    })
  }
})

/**
 * GET /api/capt-boletos
 * Lista todos os boletos importados
 */
app.get('/api/capt-boletos', async (req, res) => {
  try {
    const { page = 1, limit = 50, status } = req.query

    let query = supabase
      .from('"CAPT_BOLETOS"')
      .select('*', { count: 'exact' })

    if (status) {
      query = query.eq('"status"', status)
    }

    const offset = (page - 1) * limit
    const { data, error, count } = await query
      .order('"criado_em"', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    res.json({
      data,
      paginacao: {
        total: count,
        pagina: page,
        limit,
        total_paginas: Math.ceil(count / limit),
      },
    })
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})

/**
 * GET /api/capt-boletos-stats
 * Estatísticas dos boletos importados
 */
app.get('/api/capt-boletos-stats', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('"CAPT_BOLETOS"')
      .select('"status", "valor_titulo", "valor_pagamento", "data_vencimento"')

    if (error) throw error

    const stats = {
      total: data.length,
      pendente: data.filter(b => b.status === 'pendente').length,
      pago: data.filter(b => b.status === 'pago').length,
      atrasado: data.filter(b => b.status === 'atrasado').length,
      cancelado: data.filter(b => b.status === 'cancelado').length,
      valor_total_titulo: data.reduce((sum, b) => sum + (b.valor_titulo || 0), 0),
      valor_total_pago: data.reduce((sum, b) => sum + (b.valor_pagamento || 0), 0),
      valor_total_pendente: data.reduce((sum, b) => sum + ((b.valor_titulo || 0) - (b.valor_pagamento || 0)), 0),
    }

    res.json(stats)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})

/**
 * GET /api/capt-importacoes
 * Histórico de importações
 */
app.get('/api/capt-importacoes', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('"CAPT_IMPORTACOES"')
      .select('*')
      .order('"criado_em"', { ascending: false })
      .limit(50)

    if (error) throw error

    res.json(data)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})

/**
 * GET /api/capt-logs-importacao/:importacaoId
 * Logs detalhados de uma importação
 */
app.get('/api/capt-logs-importacao/:importacaoId', async (req, res) => {
  try {
    const { importacaoId } = req.params

    const { data, error } = await supabase
      .from('"CAPT_LOGS_PROCESSAMENTO"')
      .select('*')
      .eq('"importacao_id"', importacaoId)
      .order('"numero_linha"', { ascending: true })

    if (error) throw error

    res.json(data)
  } catch (error) {
    res.status(400).json({ erro: error.message })
  }
})

// ==================
// ERROR HANDLING
// ==================

app.use((err, req, res, next) => {
  console.error('[ERROR]', err)
  res.status(500).json({ error: 'Internal server error', detalhes: err.message })
})

// ==================
// START SERVER
// ==================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║           🚀 Servidor CAPT Iniciado                       ║
║   http://localhost:${PORT}                                 ║
╚════════════════════════════════════════════════════════════╝

📌 Endpoints disponíveis:

  BOLETOS (originais):
    - GET    /boletos/:userId
    - POST   /boletos
    - PUT    /boletos/:id
    - DELETE /boletos/:id
    - GET    /stats/:userId

  IMPORTAÇÃO CNAB400 (NOVO):
    - POST   /api/importar-boletos              (arquivo Excel)
    - POST   /api/importar-boleto-individual    (JSON)
    - GET    /api/capt-boletos                  (listar com paginação)
    - GET    /api/capt-boletos-stats            (estatísticas)
    - GET    /api/capt-importacoes              (histórico de importações)
    - GET    /api/capt-logs-importacao/:id      (logs detalhados)

  Teste com curl:
    curl -X POST http://localhost:${PORT}/api/importar-boletos \\
      -F "arquivo=@seu_arquivo.xlsx"
`)
})
