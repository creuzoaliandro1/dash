import { useState } from 'react'
import { signIn, resetPassword } from '../lib/supabase'

export default function LoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)

    try {
      const result = await signIn(email, pass)

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

  const handleForgotPassword = async () => {
    setError('')
    setInfo('')
    if (!email) {
      setError('Informe seu e-mail acima para receber o link de redefinição.')
      return
    }
    setSendingReset(true)
    try {
      const { error } = await resetPassword(email)
      if (error) {
        setError(error.message || 'Não foi possível enviar o e-mail de redefinição.')
      } else {
        setInfo('Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha.')
      }
    } finally {
      setSendingReset(false)
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
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="username"
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
                autoComplete="current-password"
                className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-md text-white placeholder-[#666666] focus:border-white focus:bg-[#1a1a1a] outline-none transition text-sm"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-900/20 border border-red-800 rounded-md text-xs text-red-200">
                {error}
              </div>
            )}

            {info && (
              <div className="p-3 bg-emerald-900/20 border border-emerald-800 rounded-md text-xs text-emerald-200">
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-3 py-2 bg-white text-black font-medium rounded-md hover:opacity-90 disabled:opacity-50 transition text-sm"
            >
              {loading ? 'Carregando...' : 'Entrar'}
            </button>
          </form>

          {/* Esqueci minha senha */}
          <div className="mt-4 text-center text-xs">
            <button
              onClick={handleForgotPassword}
              disabled={sendingReset}
              className="text-[#a3a3a3] hover:text-white transition disabled:opacity-50"
            >
              {sendingReset ? 'Enviando...' : 'Esqueci minha senha'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
