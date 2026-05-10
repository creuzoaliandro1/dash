import { useState } from 'react'
import { signIn, signUp } from '../lib/supabase'

export default function LoginPage({ onLoginSuccess }) {
  const [cic, setCic] = useState('')
  const [pass, setPass] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      let result
      if (isSignUp) {
        result = await signUp(cic, pass)
      } else {
        result = await signIn(cic, pass)
      }

      if (result.error) {
        setError(result.error.message)
      } else {
        onLoginSuccess()
      }
    } catch (err) {
      setError('Erro ao conectar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center h-screen bg-black">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-7">
          {/* Brand */}
          <div className="mb-6">
            <h1 className="text-lg font-semibold text-white">Capt</h1>
            <p className="text-xs text-[#666666] uppercase tracking-wider mt-1">Gestão de Boletos</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">
                CIC
              </label>
              <input
                type="text"
                value={cic}
                onChange={(e) => setCic(e.target.value)}
                placeholder="seu CIC"
                className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-md text-white placeholder-[#666666] focus:border-white focus:bg-[#1a1a1a] outline-none transition text-sm"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">
                Senha
              </label>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-md text-white placeholder-[#666666] focus:border-white focus:bg-[#1a1a1a] outline-none transition text-sm"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-900/20 border border-red-800 rounded-md text-xs text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-3 py-2 bg-white text-black font-medium rounded-md hover:opacity-90 disabled:opacity-50 transition text-sm"
            >
              {loading ? 'Carregando...' : (isSignUp ? 'Criar Conta' : 'Entrar')}
            </button>
          </form>

          {/* Toggle */}
          <div className="mt-4 text-center text-xs">
            <span className="text-[#a3a3a3]">
              {isSignUp ? 'Já tem conta?' : 'Não tem conta?'}{' '}
            </span>
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-white hover:opacity-70 font-medium"
            >
              {isSignUp ? 'Entrar' : 'Criar Conta'}
            </button>
          </div>

          {/* Demo Info */}
          <div className="mt-6 pt-4 border-t border-[#1f1f1f] text-xs text-[#666666]">
            <p className="mb-2">Credenciais de teste</p>
            <p className="font-mono text-[#a3a3a3]">CIC: 12345678901</p>
            <p className="font-mono text-[#a3a3a3]">Senha: 123456</p>
          </div>
        </div>
      </div>
    </div>
  )
}
