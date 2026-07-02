import { useState } from 'react'
import CadastroTab from '../components/ContaBmp/CadastroTab'
import SaldoTab from '../components/ContaBmp/SaldoTab'
import ExtratoTab from '../components/ContaBmp/ExtratoTab'
import ComprovantesTab from '../components/ContaBmp/ComprovantesTab'
import TarifasTab from '../components/ContaBmp/TarifasTab'
import MovimentacaoTab from '../components/ContaBmp/MovimentacaoTab'
import FavorecidosTab from '../components/ContaBmp/FavorecidosTab'
import EncerramentoTab from '../components/ContaBmp/EncerramentoTab'

const TABS = [
  ['cadastro', 'Cadastro'],
  ['saldo', 'Saldo'],
  ['extrato', 'Extrato'],
  ['comprovantes', 'Comprovantes'],
  ['tarifas', 'Tarifas'],
  ['movimentacao', 'Movimentação'],
  ['favorecidos', 'Favorecidos'],
  ['encerramento', 'Encerramento'],
]

export default function ContaBmpPage() {
  const [tab, setTab] = useState('cadastro')

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-white mb-1">Conta</h1>
        <p className="text-sm text-[#a3a3a3]">
          Ambiente da Conta BMP (Banking as a Service) — cadastro, saldo, extrato, comprovantes, tarifas,
          movimentação, favorecidos e encerramento.
        </p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-[#1f1f1f] overflow-x-auto">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium transition rounded-t-md whitespace-nowrap ${
              tab === id ? 'bg-[#1a1a1a] text-white' : 'text-[#a3a3a3] hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div>
        {tab === 'cadastro' && <CadastroTab />}
        {tab === 'saldo' && <SaldoTab />}
        {tab === 'extrato' && <ExtratoTab />}
        {tab === 'comprovantes' && <ComprovantesTab />}
        {tab === 'tarifas' && <TarifasTab />}
        {tab === 'movimentacao' && <MovimentacaoTab />}
        {tab === 'favorecidos' && <FavorecidosTab />}
        {tab === 'encerramento' && <EncerramentoTab />}
      </div>
    </div>
  )
}
