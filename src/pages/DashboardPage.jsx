import { useState, useEffect } from 'react'
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
  const [stats] = useState({
    totalRecebido: 723463.76,
    aReceber: 376208.85,
    inadimplentes: 93,
    clientesAtivos: 30,
  })

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

  const recentBoletos = [
    { id: 1, doc: 'DOC-15660992', client: 'Agro Plantar Ltda', emissao: '23/04/2026', vencimento: '16/04/2026', valor: 0.00, status: 'Atrasado' },
    { id: 2, doc: 'DOC-15660993', client: 'Agro Plantar Ltda', emissao: '23/04/2026', vencimento: '09/04/2026', valor: 0.00, status: 'Atrasado' },
    { id: 3, doc: 'DOC-15660994', client: 'Agro Plantar Ltda', emissao: '23/04/2026', vencimento: '25/04/2026', valor: 0.00, status: 'Atrasado' },
    { id: 4, doc: 'DOC-15660995', client: 'Agro Plantar Ltda', emissao: '23/04/2026', vencimento: '16/04/2026', valor: 0.00, status: 'Atrasado' },
    { id: 5, doc: 'DOC-15660996', client: 'Agro Plantar Ltda', emissao: '23/04/2026', vencimento: '16/04/2026', valor: 0.00, status: 'Atrasado' },
    { id: 6, doc: 'DOC-15660997', client: 'Agro Plantar Ltda', emissao: '23/04/2026', vencimento: '09/04/2026', valor: 0.00, status: 'Atrasado' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">Visão geral</h1>
        <p className="text-sm text-[#666666] mt-1">Métricas e indicadores da operação de cobrança</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-6">
          <p className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-3">Receita Recebida</p>
          <p className="text-3xl font-bold text-white mb-2">R$ 723.463,76</p>
          <p className="text-xs text-[#666666]">93 boletos pagos</p>
        </div>

        <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-6">
          <p className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-3">A Receber</p>
          <p className="text-3xl font-bold text-white mb-2">R$ 376.208,85</p>
          <p className="text-xs text-[#666666]">118 títulos em aberto</p>
        </div>

        <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-6">
          <p className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-3">Inadimplentes</p>
          <p className="text-3xl font-bold text-white mb-2">93</p>
          <p className="text-xs text-[#666666]">43.9% do total</p>
        </div>

        <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-6">
          <p className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-3">Clientes Ativos</p>
          <p className="text-3xl font-bold text-white mb-2">30</p>
          <p className="text-xs text-[#666666]">Cadastrados na base</p>
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
              {recentBoletos.map((boleto) => (
                <tr key={boleto.id} className="border-b border-[#1f1f1f] hover:bg-[#111111] transition">
                  <td className="px-4 py-3 text-white font-mono text-xs">{boleto.doc}</td>
                  <td className="px-4 py-3 text-[#a3a3a3] text-sm">{boleto.client}</td>
                  <td className="px-4 py-3 text-[#a3a3a3] text-sm">{boleto.emissao}</td>
                  <td className="px-4 py-3 text-[#a3a3a3] text-sm">{boleto.vencimento}</td>
                  <td className="px-4 py-3 text-right text-white font-mono text-sm">R$ {boleto.valor.toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium text-white border border-[#404040] bg-[#1a1a1a]">
                      {boleto.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
