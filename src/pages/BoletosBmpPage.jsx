import { useState } from 'react'
import RegistrarTab from '../components/BoletosBmp/RegistrarTab'
import PagarTab from '../components/BoletosBmp/PagarTab'
import ConsultarRegistradosTab from '../components/BoletosBmp/ConsultarRegistradosTab'
import OutrosBancosTab from '../components/BoletosBmp/OutrosBancosTab'
import CedenteTab from '../components/BoletosBmp/CedenteTab'
import ProtestoTab from '../components/BoletosBmp/ProtestoTab'
import CnabTab from '../components/BoletosBmp/CnabTab'

const TABS = [
  ['registrar', 'Registrar'],
  ['pagar', 'Pagar'],
  ['consultar-registrados', 'Registrados'],
  ['outros-bancos', 'Outros Bancos'],
  ['cedente', 'Cedente'],
  ['protesto', 'Protesto'],
  ['cnab', 'CNAB'],
]

export default function BoletosBmpPage() {
  const [tab, setTab] = useState('registrar')

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-white mb-1">Boletos BMP</h1>
        <p className="text-sm text-[#a3a3a3]">
          Ambiente de Boletos BMP (Banking as a Service) — registro, pagamento, consultas, cedentes e outros bancos.
          Cancelamento, consulta de registro/cancelamento, atualização, alterações e impressão ficam disponíveis
          pelo menu de ações (⋯) de cada boleto na aba Registrados.
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
        {tab === 'registrar' && <RegistrarTab />}
        {tab === 'pagar' && <PagarTab />}
        {tab === 'consultar-registrados' && <ConsultarRegistradosTab />}
        {tab === 'outros-bancos' && <OutrosBancosTab />}
        {tab === 'cedente' && <CedenteTab />}
        {tab === 'protesto' && <ProtestoTab />}
        {tab === 'cnab' && <CnabTab />}
      </div>
    </div>
  )
}
