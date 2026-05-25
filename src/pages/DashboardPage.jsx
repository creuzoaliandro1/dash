import { useState, useEffect, useRef } from 'react'
import { Line, Pie, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { getBoletos } from '../services/boletoService'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
)

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalRecebido: 0,
    aReceber: 0,
    inadimplentes: 0,
    clientesAtivos: 30,
  })
  const [boletos, setBoletos] = useState([])
  const [loading, setLoading] = useState(true)

  // Lê o ID ativo sempre do localStorage (sem stale closure)
  const getActiveContaId = useRef(() => {
    const stored = localStorage.getItem('activeContaId')
    if (stored) return stored
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    return user.id
  }).current

  // Carregar dados de boletos em aberto
  useEffect(() => {
    const loadBoletosAbertos = async () => {
      setLoading(true)
      try {
        const activeId = getActiveContaId()
        if (!activeId) {
          setLoading(false)
          return
        }

        const resultado = await getBoletos(activeId)
        const boletosData = resultado.data || []

        // Salvar todos os boletos para exibição na tabela
        setBoletos(boletosData)

        // ============================================================================
        // CARD 1: BOLETOS EM ABERTO
        // Critério: status='pendente' E situacao='Registrado'
        // ============================================================================
        const boletosAbertos = boletosData.filter(b =>
          b.status === 'pendente' && b.situacao === 'Registrado'
        )
        const totalAberto = boletosAbertos.reduce((sum, b) => sum + (parseFloat(b.valor) || 0), 0)

        // ============================================================================
        // CARD 2: RECEITA RECEBIDA
        // Critério: status='pago'
        // ============================================================================
        const boletosPagos = boletos.filter(b => b.status === 'pago')
        const totalPago = boletosPagos.reduce((sum, b) => sum + (parseFloat(b.valor) || 0), 0)

        // ============================================================================
        // CARD 3: INADIMPLENTES (VENCIDOS)
        // Critério: status='pendente' E situacao='Registrado' E data_vencimento < hoje
        // ============================================================================
        const hoje = new Date()
        hoje.setHours(0, 0, 0, 0)

        // Filtrar apenas boletos em aberto que estão vencidos
        const boletosInadimplentes = boletosAbertos.filter(b => {
          if (!b.data_vencimento) return false

          let dataVencimento
          if (typeof b.data_vencimento === 'string') {
            // Suporta formatos: YYYY-MM-DD e DD/MM/YYYY
            if (b.data_vencimento.includes('-')) {
              const [year, month, day] = b.data_vencimento.split('-')
              dataVencimento = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
            } else if (b.data_vencimento.includes('/')) {
              const [day, month, year] = b.data_vencimento.split('/')
              dataVencimento = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
            } else {
              return false
            }
          } else {
            dataVencimento = new Date(b.data_vencimento)
          }

          dataVencimento.setHours(0, 0, 0, 0)
          // Retorna true apenas se a data de vencimento for ANTERIOR a hoje
          return dataVencimento < hoje
        })

        // Soma dos valores dos boletos inadimplentes (vencidos)
        const totalInadimplentes = boletosInadimplentes.reduce((sum, b) => sum + (parseFloat(b.valor) || 0), 0)

        // Clientes Ativos: Contar CICs únicos dos boletos em aberto
        // Extrair sacado_cic de todos os boletos em aberto e contar únicos
        const cicUnicos = new Set(
          boletosAbertos
            .filter(b => b.sacado_cic && b.sacado_cic.trim() !== '') // Filtrar CICs vazios
            .map(b => b.sacado_cic.trim()) // Extrair e remover espaços
        )
        const quantidadeClientesUnicos = cicUnicos.size

        setStats({
          totalRecebido: totalAberto,
          aReceber: totalPago,
          inadimplentes: totalInadimplentes,
          clientesAtivos: quantidadeClientesUnicos,
        })
      } catch (error) {
        console.error('Erro ao carregar boletos:', error)
      } finally {
        setLoading(false)
      }
    }

    loadBoletosAbertos()

    // Recarregar quando usuario tipo M troca de perfil
    const handleContaSwitched = () => {
      loadBoletosAbertos()
    }
    window.addEventListener('contaSwitched', handleContaSwitched)
    return () => window.removeEventListener('contaSwitched', handleContaSwitched)
  }, [])

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#1a1a1a',
        titleColor: '#fff',
        bodyColor: '#a3a3a3',
        borderColor: '#2a2a2a',
        borderWidth: 1,
      },
    },
    scales: {
      y: {
        display: true,
        grid: { color: '#1f1f1f', drawBorder: false },
        ticks: { color: '#666666', font: { size: 11 } },
      },
      x: {
        display: true,
        grid: { display: false, drawBorder: false },
        ticks: { color: '#666666', font: { size: 11 } },
      },
    },
  }

  const revenueData = {
    labels: ['Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai'],
    datasets: [
      {
        label: 'Emitido',
        data: [95000, 110000, 85000, 75000, 120000, 140000, 155000, 128000, 95000, 110000, 125000, 135000],
        borderColor: '#ffffff',
        backgroundColor: 'transparent',
        borderWidth: 2,
        tension: 0.4,
        fill: false,
        pointRadius: 4,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#ffffff',
      },
      {
        label: 'Recebido',
        data: [45000, 62000, 48000, 35000, 78000, 95000, 110000, 82000, 58000, 68000, 75000, 88000],
        borderColor: '#808080',
        backgroundColor: 'transparent',
        borderWidth: 2,
        tension: 0.4,
        fill: false,
        pointRadius: 4,
        pointBackgroundColor: '#808080',
        pointBorderColor: '#808080',
      },
    ],
  }

  const statusData = {
    labels: ['Pagos', 'Pendentes', 'Atrasados', 'Cancelados'],
    datasets: [
      {
        data: [45, 30, 18, 7],
        backgroundColor: ['#ffffff', '#808080', '#404040', '#1a1a1a'],
        borderColor: '#0a0a0a',
        borderWidth: 2,
      },
    ],
  }

  const defaultData = {
    labels: ['0-15 dias', '16-30 dias', '31-60 dias', '61-90 dias', '90+ dias'],
    datasets: [
      {
        label: 'Valor em Atraso (R$)',
        data: [15000, 28000, 45000, 62000, 88000],
        backgroundColor: '#ffffff',
        borderColor: '#ffffff',
        borderWidth: 1,
      },
    ],
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    let date
    if (typeof dateStr === 'string') {
      if (dateStr.includes('/')) {
        const [day, month, year] = dateStr.split('/')
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      } else if (dateStr.includes('-')) {
        const [year, month, day] = dateStr.split('-')
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      } else {
        return dateStr
      }
    } else {
      date = new Date(dateStr)
    }
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = String(date.getFullYear())
    return `${day}/${month}/${year}`
  }

  const formatCurrency = (value) => {
    const num = parseFloat(value) || 0
    return num.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  // Pega os últimos 10 boletos (ou todos se houver menos)
  const boletosRecentes = boletos.slice(0, 10)

  return (
    <div className="space-y-6 overflow-y-auto flex-1 min-h-0">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">Visão geral</h1>
        <p className="text-sm text-[#666666] mt-1">Métricas e indicadores da operação de cobrança</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-6">
          <p className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-3">Boletos em aberto</p>
          <p className="text-3xl font-bold text-white mb-2">
            {loading ? '—' : `R$ ${stats.totalRecebido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </p>
          <p className="text-xs text-[#666666]">{loading ? 'Carregando...' : `${stats.inadimplentes} boletos atrasados`}</p>
        </div>

        <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-6">
          <p className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-3">Receita Recebida</p>
          <p className="text-3xl font-bold text-white mb-2">
            {loading ? '—' : `R$ ${stats.aReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </p>
          <p className="text-xs text-[#666666]">{loading ? 'Carregando...' : 'Boletos pagos'}</p>
        </div>

        <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-6">
          <p className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-3">Inadimplentes</p>
          <p className="text-3xl font-bold text-white mb-2">
            {loading ? '—' : `R$ ${stats.inadimplentes.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </p>
          <p className="text-xs text-[#666666]">{loading ? 'Carregando...' : 'Vencidos (pendentes + registrados)'}</p>
        </div>

        <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-6">
          <p className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-3">Clientes Ativos</p>
          <p className="text-3xl font-bold text-white mb-2">{loading ? '—' : stats.clientesAtivos}</p>
          <p className="text-xs text-[#666666]">{loading ? 'Carregando...' : 'Cadastrados na base'}</p>
        </div>
      </div>

      {/* Charts Grid - Single Row */}
      <div className="grid grid-cols-4 gap-4">
        {/* Revenue Chart - 1/4 width */}
        <div className="col-span-1 bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-6">
          <h2 className="text-sm font-semibold text-white mb-4">Emissão vs. Recebimento (últimos 12 meses)</h2>
          <div className="h-64">
            <Line data={revenueData} options={chartOptions} />
          </div>
        </div>

        {/* Status Pie Chart - 1/4 width */}
        <div className="col-span-1 bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-6">
          <h2 className="text-sm font-semibold text-white mb-4">Distribuição por status</h2>
          <div className="h-64 flex items-center justify-center">
            <div className="w-48">
              <Pie
                data={statusData}
                options={{
                  responsive: true,
                  maintainAspectRatio: true,
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: {
                        color: '#a3a3a3',
                        font: { size: 11 },
                        padding: 15,
                      },
                    },
                    tooltip: {
                      backgroundColor: '#1a1a1a',
                      titleColor: '#fff',
                      bodyColor: '#a3a3a3',
                      borderColor: '#2a2a2a',
                      borderWidth: 1,
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>

        {/* Aging Chart - 2/4 width */}
        <div className="col-span-2 bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-6">
          <h2 className="text-sm font-semibold text-white mb-4">Aging de atraso</h2>
          <div className="h-64">
            <Bar data={defaultData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* Recent Boletos Table */}
      <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Boletos recentes</h2>
          <a href="#" className="text-xs text-[#a3a3a3] hover:text-white">Ver todos</a>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1f1f1f]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#666666] uppercase tracking-wider">Documento</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#666666] uppercase tracking-wider">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#666666] uppercase tracking-wider">Emissão</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#666666] uppercase tracking-wider">Vencimento</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#666666] uppercase tracking-wider">Valor</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-[#666666] uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {boletosRecentes.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-3 text-center text-[#666666]">
                    Nenhum boleto encontrado
                  </td>
                </tr>
              ) : (
                boletosRecentes.map((boleto) => (
                  <tr key={boleto.id} className="border-b border-[#1f1f1f] hover:bg-[#111111] transition">
                    <td className="px-4 py-3 text-white font-mono text-xs">{boleto.numero_documento || '—'}</td>
                    <td className="px-4 py-3 text-[#a3a3a3] text-sm">{boleto.sacado_nome || '—'}</td>
                    <td className="px-4 py-3 text-[#a3a3a3] text-sm">{formatDate(boleto.data_emissao)}</td>
                    <td className="px-4 py-3 text-[#a3a3a3] text-sm">{formatDate(boleto.data_vencimento)}</td>
                    <td className="px-4 py-3 text-right text-white font-mono text-sm">R$ {formatCurrency(boleto.valor)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium text-white border border-[#404040] bg-[#1a1a1a] capitalize">
                        {boleto.status || 'Pendente'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
