import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Carregar variáveis do arquivo .env.local na raiz do projeto
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// ==================
// ROUTES
// ==================

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'OK' })
})

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
// ERROR HANDLING
// ==================

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

// ==================
// START SERVER
// ==================

app.listen(PORT, () => {
  console.log(`🚀 Server rodando em http://localhost:${PORT}`)
})
