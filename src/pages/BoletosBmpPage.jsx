import { useState } from 'react'
import RegistrarTab from '../components/BoletosBmp/RegistrarTab'
import PagarTab from '../components/BoletosBmp/PagarTab'
import ConsultarRegistroTab from '../components/BoletosBmp/ConsultarRegistroTab'
import ConsultarRegistradosTab from '../components/BoletosBmp/ConsultarRegistradosTab'
import CancelarTab from '../components/BoletosBmp/CancelarTab'
import ConsultarCancelamentoTab from '../components/BoletosBmp/ConsultarCancelamentoTab'
import AtualizarTab from '../components/BoletosBmp/AtualizarTab'
import AlteracoesTab from '../components/BoletosBmp/AlteracoesTab'
import OutrosBancosTab from '../components/BoletosBmp/OutrosBancosTab'
import CedenteTab from '../components/BoletosBmp/CedenteTab'
import ImprimirTab from '../components/BoletosBmp/ImprimirTab'

const TABS = [
  ['registrar', 'Registrar'],
  ['pagar', 'Pagar'],
  ['consultar-registro', 'Consultar Registro'],
  ['consultar-registrados', 'Registrados'],
  ['cancelar', 'Cancelar'],
  ['consultar-cancelamento', 'Consultar Cancelamento'],
  ['atualizar', 'Atualizar'],
  ['alteracoes', 'Alterações'],
  ['outros-bancos', 'Outros Bancos'],
  ['cedente', 'Cedente'],
  ['imprimir', 'Imprimir'],
]

export default function BoletosBmpPage() {
  const [tab, setTab] = useState('registrar')

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-white mb-1">Boletos BMP</h1>
        <p className="text-sm text-[#a3a3a3]">
          Ambiente de Boletos BMP (Banking as a Service) — registro, pagamento, consultas, cancelamento,
          atualização, alterações, cedentes e impressão.
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
        {tab === 'consultar-registro' && <ConsultarRegistroTab />}
        {tab === 'consultar-registrados' && <ConsultarRegistradosTab />}
        {tab === 'cancelar' && <CancelarTab />}
        {tab === 'consultar-cancelamento' && <ConsultarCancelamentoTab />}
        {tab === 'atualizar' && <AtualizarTab />}
        {tab === 'alteracoes' && <AlteracoesTab />}
        {tab === 'outros-bancos' && <OutrosBancosTab />}
        {tab === 'cedente' && <CedenteTab />}
        {tab === 'imprimir' && <ImprimirTab />}
      </div>
    </div>
  )
}
