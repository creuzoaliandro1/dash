import { useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import { signOut } from '../../lib/supabase'

export default function MainLayout({ children, currentPage, setCurrentPage }) {
  const [showUserMenu, setShowUserMenu] = useState(false)

  const handleLogout = async () => {
    await signOut()
    window.location.reload()
  }

  return (
    <div className="flex h-screen bg-black">
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />

      <main className="flex-1 flex flex-col bg-black">
        <Header showUserMenu={showUserMenu} setShowUserMenu={setShowUserMenu} onLogout={handleLogout} />

        <div className="flex-1 overflow-auto">
          <div className="px-8 py-6">
            {children}
          </div>
        </div>
      </main>

      {/* User Menu */}
      {showUserMenu && (
        <div className="absolute top-16 right-6 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-lg p-4 w-40 z-50">
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-sm text-white hover:bg-[#2a2a2a] rounded transition"
          >
            Sair
          </button>
        </div>
      )}
    </div>
  )
}
