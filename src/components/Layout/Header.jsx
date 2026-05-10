import { useState, useEffect, useRef } from 'react'

export default function Header({ showUserMenu, setShowUserMenu, onLogout, allContas, onContaSwitch }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const isTipoM = user.tipo === 'M'

  const [activeContaId, setActiveContaId] = useState(
    () => localStorage.getItem('activeContaId') || user.id || ''
  )
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Sincronizar com mudancas externas no localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      const id = localStorage.getItem('activeContaId') || user.id || ''
      setActiveContaId(id)
    }
    window.addEventListener('contaSwitched', handleStorageChange)
    return () => window.removeEventListener('contaSwitched', handleStorageChange)
  }, [user.id])

  const handleSwitch = (contaId) => {
    localStorage.setItem('activeContaId', contaId)
    setActiveContaId(contaId)
    setDropdownOpen(false)
    if (onContaSwitch) onContaSwitch(contaId)
    window.dispatchEvent(new Event('contaSwitched'))
  }

  const activeNome = allContas?.find(c => c.id === activeContaId)?.nome_correntista
    || user.name
    || user.cic
    || '—'

  const initials = activeNome
    ? activeNome.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : 'CA'

  return (
    <header className="h-16 bg-[#0a0a0a] border-b border-[#1f1f1f] flex items-center justify-between px-8 sticky top-0 z-40 backdrop-blur-lg">
      <div />

      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="w-7 h-7 bg-[#1a1a1a] border border-[#2a2a2a] rounded-full flex items-center justify-center text-white text-xs font-semibold hover:bg-[#2a2a2a] transition cursor-pointer"
        >
          {initials}
        </button>
      </div>
    </header>
  )
}
