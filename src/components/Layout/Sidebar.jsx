import { useState, useEffect } from 'react'

export default function Sidebar({ currentPage, setCurrentPage, allContas = [], onContaSwitch }) {
  const [expandedMenu, setExpandedMenu] = useState(null)

  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const isMaster = user.tipo === 'M'

  const [activeContaId, setActiveContaId] = useState(
    () => localStorage.getItem('activeContaId') || String(user.id) || ''
  )

  // Sincronizar quando outro componente dispara contaSwitched
  useEffect(() => {
    const sync = () => {
      setActiveContaId(localStorage.getItem('activeContaId') || String(user.id) || '')
    }
    window.addEventListener('contaSwitched', sync)
    return () => window.removeEventListener('contaSwitched', sync)
  }, [user.id])

  const handleContaChange = (e) => {
    const contaId = e.target.value
    setActiveContaId(contaId)
    localStorage.setItem('activeContaId', contaId)
    // NÃO dispara contaSwitched aqui — MainLayout faz isso após atualizar localStorage.user
    if (onContaSwitch) onContaSwitch(contaId)
  }

  const activeConta = allContas.find(c => String(c.id) === String(activeContaId))
  const activeNome = activeConta?.nome_correntista || user.nome || user.name || ''
  const initials = activeNome
    ? activeNome.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : 'CA'

  const navItems = [
    {
      id: 'dashboard',
      label: 'Visão geral',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
      )
    },
    {
      id: 'boletos',
      label: 'Boletos',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="12" y1="11" x2="12" y2="17"></line>
          <line x1="9" y1="14" x2="15" y2="14"></line>
        </svg>
      )
    },
    // Extrato — visível apenas para usuários Master
    ...(isMaster ? [{
      id: 'extrato',
      label: 'Extrato',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="16" rx="2"></rect>
          <line x1="3" y1="10" x2="21" y2="10"></line>
          <line x1="7" y1="14" x2="14" y2="14"></line>
          <line x1="7" y1="17" x2="11" y2="17"></line>
        </svg>
      )
    }] : []),
  ]

  return (
    <aside className="w-[230px] bg-[#0a0a0a] border-r border-[#1f1f1f] flex flex-col h-screen sticky top-0">
      {/* Brand */}
      <div className="h-16 flex items-center gap-3 px-4 border-b border-[#1f1f1f] flex-shrink-0">
        <div className="flex flex-col flex-1 leading-tight">
          <h1 className="font-semibold text-sm text-white">Capt</h1>
          <p className="text-xs text-[#666666] uppercase tracking-wider">Gestão de Boletos</p>
        </div>
      </div>

      {/* Perfil Ativo */}
      <div className="px-4 py-3 mt-4">
        <p className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-2">Perfil Ativo</p>
        {allContas.length > 0 ? (
          <select
            value={activeContaId}
            onChange={handleContaChange}
            className="w-full px-2 py-1.5 bg-[#111111] border border-[#2a2a2a] rounded text-white text-xs focus:border-[#444] outline-none transition cursor-pointer"
          >
            {allContas.map(conta => (
              <option key={conta.id} value={String(conta.id)}>
                {conta.nome_correntista}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-[#a3a3a3] truncate">{activeNome || 'Carregando...'}</p>
        )}
      </div>

      {/* Navigation */}
      <nav className="px-3 py-2 flex flex-col gap-1">
        <p className="text-xs font-semibold text-[#666666] uppercase tracking-wider px-2 py-2">Principal</p>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition ${
              currentPage === item.id
                ? 'bg-[#1a1a1a] text-white'
                : 'text-[#a3a3a3] hover:bg-[#111111] hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Operations Section - Only for Master Users */}
      {isMaster && (
        <div className="px-3 py-2 mt-4 flex flex-col gap-1 border-t border-[#1f1f1f] pt-4">
          <p className="text-xs font-semibold text-[#666666] uppercase tracking-wider px-2 py-2">Operações</p>

          {/* Importar with submenu - Master Only */}
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setExpandedMenu(expandedMenu === 'importar' ? null : 'importar')}
              className="flex items-center justify-between px-3 py-2 text-sm font-medium text-[#a3a3a3] hover:bg-[#111111] hover:text-white rounded transition w-full"
            >
              <span>Importar</span>
              <svg
                className={`w-4 h-4 transition ${expandedMenu === 'importar' ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>

            {expandedMenu === 'importar' && (
              <div className="pl-4 flex flex-col gap-1">
                <button
                  onClick={() => setCurrentPage('conta-capt')}
                  className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded transition ${
                    currentPage === 'conta-capt'
                      ? 'bg-[#1a1a1a] text-white'
                      : 'text-[#a3a3a3] hover:bg-[#111111] hover:text-white'
                  }`}
                >
                  Conta Capt
                </button>
                <button
                  onClick={() => setCurrentPage('efactor')}
                  className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded transition ${
                    currentPage === 'efactor'
                      ? 'bg-[#1a1a1a] text-white'
                      : 'text-[#a3a3a3] hover:bg-[#111111] hover:text-white'
                  }`}
                >
                  E-Factor
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto px-3 py-3 border-t border-[#1f1f1f]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#1a1a1a] border border-[#2a2a2a] rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white font-medium truncate">{activeNome || 'Usuário'}</p>
            <p className="text-xs text-[#666666] truncate">{isMaster ? 'Master' : 'Usuário'}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
