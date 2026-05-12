import { useState, useEffect } from 'react'
import { getCurrentUser } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import BoletosPage from './pages/BoletosPage'
import EfactorPage from './pages/EfactorPage'
import ContaCaptPage from './pages/ContaCaptPage'
import MainLayout from './components/Layout/MainLayout'

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState('dashboard')

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    const { user } = await getCurrentUser()
    setUser(user)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-[#a3a3a3]">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage onLoginSuccess={() => checkUser()} />
  }

  return (
    <MainLayout currentPage={currentPage} setCurrentPage={setCurrentPage}>
      {currentPage === 'dashboard' && <DashboardPage />}
      {currentPage === 'boletos' && <BoletosPage />}
      {currentPage === 'conta-capt' && <ContaCaptPage />}
      {currentPage === 'efactor' && <EfactorPage />}
      {currentPage === 'relatorios' && <div className="text-white">Relatórios</div>}
      {currentPage === 'settings' && <div className="text-white">Configurações</div>}
    </MainLayout>
  )
}
