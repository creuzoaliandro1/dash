import { useState, useEffect } from 'react'
import * as ctb from '../services/contabilService'
import PlanoContasTab from '../components/Contabil/PlanoContasTab'
import LancamentosTab from '../components/Contabil/LancamentosTab'
import RelatoriosTab from '../components/Contabil/RelatoriosTab'
import PeriodosTab from '../components/Contabil/PeriodosTab'
import CadastrosTab from '../components/Contabil/CadastrosTab'
import IntegracaoTab from '../components/Contabil/IntegracaoTab'

const TABS = [
  ['lancamentos', 'Lançamentos'],
  ['plano-contas', 'Plano de Contas'],
  ['relatorios', 'Relatórios'],
  ['periodos', 'Períodos'],
  ['integracao', 'Integração'],
  ['cadastros', 'Cadastros'],
]

export default function ContabilPage() {
  const [tab, setTab] = useState('lancamentos')
  const [pronto, setPronto] = useState(false)
  const [erro, setErro] = useState('')

  // garante seed (plano de contas modelo, grupos, históricos, períodos) na primeira utilização
  useEffect(() => {
    ctb.ensureSeed()
      .then(() => setPronto(true))
      .catch(e => { setErro(ctb.mensagemErro(e)); setPronto(true) })
  }, [])

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-white">Contábil</h1>
        <p className="text-sm text-[#a3a3a3] mt-1">
          Partidas dobradas · competência · saldos consolidados · preparação SPED/ECD
        </p>
      </div>

      <div className="flex gap-1 mb-5 border-b border-[#1f1f1f] overflow-x-auto">
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px whitespace-nowrap ${
              tab === id ? 'text-white border-white' : 'text-[#666666] border-transparent hover:text-white'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {erro && <p className="text-xs text-red-400 mb-4">Falha ao inicializar o módulo: {erro}</p>}

      {!pronto ? (
        <p className="text-sm text-[#666666] py-8 text-center">Inicializando módulo contábil...</p>
      ) : (
        <div>
          {tab === 'lancamentos' && <LancamentosTab />}
          {tab === 'plano-contas' && <PlanoContasTab />}
          {tab === 'relatorios' && <RelatoriosTab />}
          {tab === 'periodos' && <PeriodosTab />}
          {tab === 'integracao' && <IntegracaoTab />}
          {tab === 'cadastros' && <CadastrosTab />}
        </div>
      )}
    </div>
  )
}
