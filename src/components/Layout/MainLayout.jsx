import { useState, useEffect, useRef } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import { signOut } from '../../lib/supabase'
import { getAllContas, getContaInfo } from '../../services/boletoService'

export default function MainLayout({ children, currentPage, setCurrentPage }) {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [allContas, setAllContas] = useState([])

  // Capturar o usuario master no mount (imutavel durante a sessao)
  const masterUserRef = useRef(JSON.parse(localStorage.getItem('user') || '{}'))
  const masterUser = masterUserRef.current

  // Se o usuario for tipo M, carregar lista de todas as contas para o combobox
  useEffect(() => {
    if (masterUser.tipo !== 'M' || !masterUser.id) return

    getAllContas().then(({ data, error }) => {
      if (error) console.error('[MainLayout] getAllContas error:', error)
      if (data && data.length > 0) {
        setAllContas(data)
        if (!localStorage.getItem('activeContaId')) {
          localStorage.setItem('activeContaId', String(masterUser.id))
        }
      }
    })
  }, [])

  const handleLogout = async () => {
    localStorage.removeItem('activeContaId')
    await signOut()
    window.location.reload()
  }

  const handleContaSwitch = async (contaId) => {
    // Atualizar localStorage.user com os dados da conta selecionada
    // (preservando tipo: 'M' para o combobox continuar visivel)
    try {
      const { data: contaSelecionada } = await getContaInfo(contaId)
      if (contaSelecionada) {
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
        localStorage.setItem('user', JSON.stringify({
          ...currentUser,
          id: contaSelecionada.id,
          name: contaSelecionada.nome_correntista,
          email: contaSelecionada.email || currentUser.email,
          tipo: 'M', // sempre preservar tipo M para o combobox continuar visivel
        }))
      }
    } catch (err) {
      console.error('[handleContaSwitch] erro ao atualizar user:', err)
    }
    // Disparar evento para que as paginas recarreguem seus dados
    window.dispatchEvent(new Event('contaSwitched'))
  }

  return (
    <div className="flex h-screen bg-black">
      <Sidebar
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          allContas={allContas}
          onContaSwitch={handleContaSwitch}
        />

      <main className="flex-1 flex flex-col bg-black overflow-hidden">
        <Header
          showUserMenu={showUserMenu}
          setShowUserMenu={setShowUserMenu}
          onLogout={handleLogout}
          allContas={masterUser.tipo === 'M' ? allContas : []}
          onContaSwitch={handleContaSwitch}
        />

        {/* overflow-hidden aqui + flex-col permite que cada pagina controle seu proprio scroll */}
        <div className="flex-1 overflow-hidden flex flex-col px-8 py-6">
          {children}
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
