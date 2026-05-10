import { useState } from 'react'

export default function Sidebar({ currentPage, setCurrentPage }) {
  const [expandedMenu, setExpandedMenu] = useState(null)

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
    {
      id: 'relatorios',
      label: 'Relatórios',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="2" x2="12" y2="22"></line>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
        </svg>
      )
    },
    {
      id: 'settings',
      label: 'Configurações',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6m-16.78 7.78l4.24-4.24m4.24-4.24l4.24-4.24"></path>
        </svg>
      )
    },
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

      {/* Section Label */}
      <div className="px-4 py-3 mt-4">
        <p className="text-xs font-semibold text-[#666666] uppercase tracking-wider">Perfil Ativo</p>
        <p className="text-xs text-[#a3a3a3] mt-1">CAPT ADMINISTRAÇÃO DE PAG</p>
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

      {/* Operations Section */}
      <div className="px-3 py-2 mt-4 flex flex-col gap-1 border-t border-[#1f1f1f] pt-4">
        <p className="text-xs font-semibold text-[#666666] uppercase tracking-wider px-2 py-2">Operações</p>

        {/* Importar with submenu */}
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

          {/* Submenu */}
          {expandedMenu === 'importar' && (
            <div className="pl-4 flex flex-col gap-1">
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

        <button className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-[#a3a3a3] hover:bg-[#111111] hover:text-white rounded transition">
          Emails
        </button>
        <button className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-[#a3a3a3] hover:bg-[#111111] hover:text-white rounded transition">
          Contas
        </button>
        <button className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-[#a3a3a3] hover:bg-[#111111] hover:text-white rounded transition">
          Pagamentos
        </button>
      </div>

      {/* Footer */}
      <div className="mt-auto px-3 py-3 border-t border-[#1f1f1f]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#1a1a1a] border border-[#2a2a2a] rounded-full flex items-center justify-center text-white text-xs font-semibold">
            CA
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white font-medium truncate">CAPT ADMINISTR...</p>
            <p className="text-xs text-[#666666] truncate">Master</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
