import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function AcessosPage() {
  const [contas, setContas] = useState([])
  const [loading, setLoading] = useState(true)
  const [contaId, setContaId] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [adminKey, setAdminKey] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null) // { ok, message }

  useEffect(() => {
    let active = true
    supabase
      .from('CONTAS')
      .select('id, cic, nome_correntista, email, tipo')
      .order('nome_correntista')
      .then(({ data, error }) => {
        if (!active) return
        if (error) console.error('[AcessosPage] erro ao carregar CONTAS:', error)
        setContas(data || [])
        setLoading(false)
      })
    return () => { active = false }
  }, [])

  const handleSelectConta = (id) => {
    setContaId(id)
    const conta = contas.find((c) => String(c.id) === String(id))
    setEmail(conta?.email || '')
    setFeedback(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)

    if (!email) {
      setFeedback({ ok: false, message: 'Selecione uma conta ou informe o e-mail.' })
      return
    }
    if (password.length < 6) {
      setFeedback({ ok: false, message: 'A senha deve ter ao menos 6 caracteres.' })
      return
    }
    if (password !== confirmPassword) {
      setFeedback({ ok: false, message: 'As senhas não coincidem.' })
      return
    }
    if (!adminKey) {
      setFeedback({ ok: false, message: 'Informe a chave administrativa.' })
      return
    }

    setSubmitting(true)
    try {
      const { data, error } = await supabase.functions.invoke('admin-set-password', {
        body: { adminKey, email, password },
      })
      if (error) {
        setFeedback({ ok: false, message: error.message || 'Erro ao definir a senha.' })
      } else if (data?.error) {
        setFeedback({ ok: false, message: data.error })
      } else {
        const acao = data?.action === 'usuario_criado' ? 'Acesso criado' : 'Senha atualizada'
        setFeedback({ ok: true, message: `${acao} para ${email}.` })
        setPassword('')
        setConfirmPassword('')
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-lg">
        <h1 className="text-lg font-semibold text-white mb-1">Acessos</h1>
        <p className="text-sm text-[#a3a3a3] mb-6">
          Defina a senha de login (Supabase Auth) de uma conta cadastrada em CONTAS.
          Use uma conta por vez, no seu ritmo.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-6">
          <div>
            <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">Conta</label>
            <select
              value={contaId}
              onChange={(e) => handleSelectConta(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-md text-white text-sm outline-none focus:border-white transition"
            >
              <option value="">
                {loading ? 'Carregando...' : 'Selecione uma conta'}
              </option>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome_correntista} — {c.email || 'sem e-mail'} {c.tipo === 'M' ? '(Master)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-md text-white placeholder-[#666666] outline-none focus:border-white transition text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">Nova senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-md text-white placeholder-[#666666] outline-none focus:border-white transition text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">Confirmar senha</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-md text-white placeholder-[#666666] outline-none focus:border-white transition text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">Chave administrativa</label>
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="ADMIN_SETUP_KEY configurada no Supabase"
              autoComplete="off"
              className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-md text-white placeholder-[#666666] outline-none focus:border-white transition text-sm"
            />
            <p className="text-[11px] text-[#666666] mt-1">
              O mesmo valor cadastrado como secret ADMIN_SETUP_KEY (Edge Functions → Secrets). Não é salva em nenhum lugar.
            </p>
          </div>

          {feedback && (
            <div
              className={`p-3 rounded-md text-xs border ${
                feedback.ok
                  ? 'bg-emerald-900/20 border-emerald-800 text-emerald-200'
                  : 'bg-red-900/20 border-red-800 text-red-200'
              }`}
            >
              {feedback.message}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-3 py-2 bg-white text-black font-medium rounded-md hover:opacity-90 disabled:opacity-50 transition text-sm"
          >
            {submitting ? 'Aplicando...' : 'Definir senha'}
          </button>
        </form>
      </div>
    </div>
  )
}
