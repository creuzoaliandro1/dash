import { useState } from 'react'
import { setNewPassword, signOut } from '../lib/supabase'

// Tela obrigatória exibida no primeiro acesso de contas provisionadas com a
// senha padrão (123456). Bloqueia o restante do app (ver App.jsx) até que o
// usuário defina uma senha própria.
export default function ChangePasswordPage({ user, onPasswordChanged }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('A nova senha deve ter ao menos 6 caracteres.')
      return
    }
    if (password === '123456') {
      setError('Escolha uma senha diferente da senha padrão.')
      return
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)
    try {
      const { error: err } = await setNewPassword(user.id, password)
      if (err) {
        setError(err.message || 'Não foi possível atualizar a senha.')
      } else {
        onPasswordChanged()
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
        <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-7">
          <div className="mb-6">
            <h1 className="text-lg font-semibold text-white">Capt</h1>
            <p className="text-xs text-[#666666] uppercase tracking-wider mt-1">Defina sua nova senha</p>
          </div>

          <p className="text-sm text-[#a3a3a3] mb-5">
            Este é seu primeiro acesso com a senha padrão. Defina uma nova senha para continuar.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">Nova senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-md text-white placeholder-[#666666] focus:border-white focus:bg-[#1a1a1a] outline-none transition text-sm"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">Confirmar nova senha</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
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
              {loading ? 'Salvando...' : 'Salvar nova senha'}
            </button>
          </form>

          <div className="mt-4 text-center text-xs">
            <button
              onClick={() => signOut().then(() => window.location.reload())}
              className="text-[#a3a3a3] hover:text-white transition"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
