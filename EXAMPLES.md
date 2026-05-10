# 📖 Exemplos de Integração - Capt

Exemplos práticos de como estender a plataforma.

## 1️⃣ Integrar com API de Boletos (Asaas)

### Backend Integration

```javascript
// backend/integrations/asaas.js
import axios from 'axios'

const ASAAS_API_URL = 'https://api.asaas.com/v3'
const ASAAS_API_KEY = process.env.ASAAS_API_KEY

const asaasClient = axios.create({
  baseURL: ASAAS_API_URL,
  headers: {
    'access_token': ASAAS_API_KEY,
  }
})

// Criar boleto na Asaas
export const createBoletoAsaas = async (boleto) => {
  try {
    const response = await asaasClient.post('/payments', {
      customer: boleto.clienteId,
      value: boleto.valor,
      dueDate: boleto.vencimento,
      description: boleto.descricao,
      billingType: 'BOLETO',
    })

    return {
      success: true,
      data: response.data,
      nossoNumero: response.data.nossoNumero,
      codigoBarras: response.data.codigoBarras,
    }
  } catch (error) {
    return {
      success: false,
      error: error.response.data,
    }
  }
}

// Webhook para atualizar status
export const handleAsaasWebhook = async (payload) => {
  const { payment } = payload

  // Mapear status Asaas → Capt
  const statusMap = {
    'PENDING': 'pendente',
    'CONFIRMED': 'pago',
    'OVERDUE': 'atrasado',
    'CANCELLED': 'cancelado',
  }

  await supabase
    .from('boletos')
    .update({ status: statusMap[payment.status] })
    .eq('external_id', payment.id)
}
```

### Frontend Usage

```javascript
// src/services/boletoService.js
import axios from 'axios'

export const createBoleto = async (formData) => {
  const response = await axios.post('/api/boletos', {
    ...formData,
    tipo: 'asaas', // Indicar que será criado via Asaas
  })

  return response.data
}

// Componente para criar boleto
export default function CreateBoletoModal({ onSuccess }) {
  const [formData, setFormData] = useState({
    descricao: '',
    clienteId: '',
    valor: '',
    vencimento: '',
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const boleto = await createBoleto(formData)
      // Boleto criado com sucesso
      onSuccess(boleto)
    } catch (error) {
      console.error('Erro:', error)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Descrição"
        value={formData.descricao}
        onChange={(e) => setFormData({...formData, descricao: e.target.value})}
      />
      {/* ... outros campos ... */}
      <button type="submit">Criar Boleto</button>
    </form>
  )
}
```

## 2️⃣ Adicionar Gráficos com Chart.js

```javascript
// src/components/Dashboard/RevenueChart.jsx
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

export default function RevenueChart({ data }) {
  const chartData = {
    labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
    datasets: [
      {
        label: 'Receita',
        data: [10000, 12500, 15000, 18000, 16500, 20000],
        borderColor: '#fff',
        backgroundColor: 'rgba(255,255,255,0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  }

  return (
    <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-4">
      <h2 className="text-white font-semibold mb-4">Receita Mensal</h2>
      <Line data={chartData} options={{
        responsive: true,
        plugins: {
          legend: { display: false },
          filler: { propagate: true },
        },
        scales: {
          y: {
            grid: { color: '#1f1f1f' },
            ticks: { color: '#a3a3a3' },
          },
          x: {
            grid: { display: false },
            ticks: { color: '#a3a3a3' },
          },
        },
      }} />
    </div>
  )
}
```

## 3️⃣ Sistema de Notificações por Email

```javascript
// backend/services/email.js
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  }
})

export const sendBoletoEmail = async (cliente, boleto) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: cliente.email,
    subject: `Boleto para pagamento - ${boleto.descricao}`,
    html: `
      <h2>Boleto para Pagamento</h2>
      <p><strong>Descrição:</strong> ${boleto.descricao}</p>
      <p><strong>Valor:</strong> R$ ${boleto.valor.toFixed(2)}</p>
      <p><strong>Vencimento:</strong> ${boleto.vencimento}</p>
      <p><strong>Código de Barras:</strong></p>
      <p style="font-family: monospace; font-size: 18px;">${boleto.codigoBarras}</p>
    `
  }

  return transporter.sendMail(mailOptions)
}

// Usar em uma rota
app.post('/boletos/send-email/:id', async (req, res) => {
  try {
    const boleto = await getBoleto(req.params.id)
    const cliente = await getCliente(boleto.cliente_id)
    
    await sendBoletoEmail(cliente, boleto)
    
    res.json({ success: true })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})
```

## 4️⃣ Exportar para Excel

```javascript
// src/services/exportService.js
import * as XLSX from 'xlsx'

export const exportBoletos = (boletos) => {
  const ws = XLSX.utils.json_to_sheet(
    boletos.map(b => ({
      Descrição: b.descricao,
      Cliente: b.cliente,
      Valor: `R$ ${b.valor.toFixed(2)}`,
      Status: b.status,
      Vencimento: b.vencimento,
    }))
  )

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Boletos')
  XLSX.writeFile(wb, `boletos-${new Date().toISOString().split('T')[0]}.xlsx`)
}

// Usar no componente
<button onClick={() => exportBoletos(boletos)}>
  📥 Exportar para Excel
</button>
```

## 5️⃣ Filtros Avançados

```javascript
// src/hooks/useFilters.js
export const useFilters = (boletos) => {
  const [filters, setFilters] = useState({
    status: null,
    dataInicio: null,
    dataFim: null,
    valorMin: null,
    valorMax: null,
    busca: '',
  })

  const filtered = boletos.filter(b => {
    if (filters.status && b.status !== filters.status) return false
    if (filters.busca && !b.cliente.includes(filters.busca)) return false
    if (filters.dataInicio && new Date(b.vencimento) < new Date(filters.dataInicio)) return false
    if (filters.dataFim && new Date(b.vencimento) > new Date(filters.dataFim)) return false
    if (filters.valorMin && b.valor < filters.valorMin) return false
    if (filters.valorMax && b.valor > filters.valorMax) return false
    return true
  })

  return { filters, setFilters, filtered }
}
```

## 6️⃣ Dark/Light Mode Toggle

```javascript
// src/hooks/useTheme.js
export const useTheme = () => {
  const [isDark, setIsDark] = useState(true)

  const toggle = () => {
    setIsDark(!isDark)
    document.documentElement.setAttribute(
      'data-theme',
      !isDark ? 'light' : 'dark'
    )
    localStorage.setItem('theme', !isDark ? 'light' : 'dark')
  }

  return { isDark, toggle }
}
```

---

**Dúvidas?** Consulte a [documentação oficial do Supabase](https://supabase.com/docs) 📚
