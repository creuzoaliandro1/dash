import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// supabase.functions.invoke() só expõe uma mensagem genérica ("Edge Function
// returned a non-2xx status code") em `error.message` — o corpo JSON real
// (com a mensagem específica que a função devolveu) fica em `error.context`
// (a Response bruta). Sem isso, qualquer erro no backend aparece igual pro
// usuário, impossível de diagnosticar.
const extractInvokeError = async (error, fallback) => {
  if (!error) return null
  try {
    if (error.context && typeof error.context.json === 'function') {
      const body = await error.context.clone().json()
      if (body?.error) return body.error
    }
  } catch {
    // corpo não era JSON — ignora e usa o fallback
  }
  return error.message || fallback
}

export default function AcessosPage() {
  const [contas, setContas] = useState([])
  const [loading, setLoading] = useState(true)
  const [contaId, setContaId] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null) // { ok, message }
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [bulkFeedback, setBulkFeedback] = useState(null) // { ok, message }
  const [resetSubmitting, setResetSubmitting] = useState(false)
  const [resetFeedback, setResetFeedback] = useState(null) // { ok, message }
  // Guarda síncrona contra clique duplo — setSubmitting(true) é assíncrono
  // (só reflete no `disabled` do botão no próximo render), então um clique
  // rápido demais consegue disparar duas chamadas antes do botão desabilitar.
  const submittingRef = useRef(false)
  const bulkSubmittingRef = useRef(false)
  const resetSubmittingRef = useRef(false)

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
    if (submittingRef.current) return
    submittingRef.current = true

    setSubmitting(true)
    try {
      const { data, error } = await supabase.functions.invoke('admin-set-password', {
        body: { email, password },
      })
      if (error) {
        setFeedback({ ok: false, message: await extractInvokeError(error, 'Erro ao definir a senha.') })
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
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const handleBulkCreate = async () => {
    setBulkFeedback(null)
    if (bulkSubmittingRef.current) return
    bulkSubmittingRef.current = true

    setBulkSubmitting(true)
    try {
      const { data, error } = await supabase.functions.invoke('admin-bulk-create-access', {
        body: {},
      })
      if (error) {
        setBulkFeedback({ ok: false, message: await extractInvokeError(error, 'Erro ao provisionar acessos.') })
      } else if (data?.error) {
        setBulkFeedback({ ok: false, message: data.error })
      } else {
        const { created = [], skipped = [], errors = [] } = data || {}
        const parts = [
          `${created.length} acesso(s) criado(s) com a senha padrão 123456`,
          `${skipped.length} conta(s) já tinham acesso (ignoradas)`,
        ]
        if (errors.length) parts.push(`${errors.length} erro(s): ${errors.map((e) => `${e.email} (${e.message})`).join('; ')}`)
        setBulkFeedback({ ok: errors.length === 0, message: parts.join(' — ') })
      }
    } catch (err) {
      setBulkFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      bulkSubmittingRef.current = false
      setBulkSubmitting(false)
    }
  }

  const handleResetAll = async () => {
    setResetFeedback(null)
    if (resetSubmittingRef.current) return
    if (!window.confirm('Isso vai redefinir a senha de TODAS as contas (inclusive as que já têm acesso) para 123456. Confirma?')) {
      return
    }
    resetSubmittingRef.current = true

    setResetSubmitting(true)
    try {
      const { data, error } = await supabase.functions.invoke('admin-bulk-create-access', {
        body: { resetExisting: true },
      })
      if (error) {
        setResetFeedback({ ok: false, message: await extractInvokeError(error, 'Erro ao resetar acessos.') })
      } else if (data?.error) {
        setResetFeedback({ ok: false, message: data.error })
      } else {
        const { created = [], reset = [], errors = [] } = data || {}
        const parts = [
          `${created.length} acesso(s) criado(s)`,
          `${reset.length} senha(s) resetada(s) para 123456`,
        ]
        if (errors.length) parts.push(`${errors.length} erro(s): ${errors.map((e) => `${e.email} (${e.message})`).join('; ')}`)
        setResetFeedback({ ok: errors.length === 0, message: parts.join(' — ') })
      }
    } catch (err) {
      setResetFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      resetSubmittingRef.current = false
      setResetSubmitting(false)
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

        <div className="mt-6 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-6">
          <h2 className="text-sm font-semibold text-white mb-1">Provisionamento em massa</h2>
          <p className="text-xs text-[#a3a3a3] mb-4">
            Cria o acesso (senha padrão <span className="text-white">123456</span>) para toda conta de CONTAS que
            tenha e-mail e ainda não tenha login. Contas que já têm acesso não são alteradas. No primeiro login,
            o usuário é obrigado a trocar a senha antes de usar o sistema.
          </p>

          {bulkFeedback && (
            <div
              className={`p-3 rounded-md text-xs border mb-4 ${
                bulkFeedback.ok
                  ? 'bg-emerald-900/20 border-emerald-800 text-emerald-200'
                  : 'bg-red-900/20 border-red-800 text-red-200'
              }`}
            >
              {bulkFeedback.message}
            </div>
          )}

          <button
            type="button"
            onClick={handleBulkCreate}
            disabled={bulkSubmitting}
            className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] text-white font-medium rounded-md hover:border-white disabled:opacity-50 transition text-sm"
          >
            {bulkSubmitting ? 'Provisionando...' : 'Criar acessos em massa (senha padrão 123456)'}
          </button>
        </div>

        <div className="mt-6 bg-[#0a0a0a] border border-red-900/40 rounded-lg p-6">
          <h2 className="text-sm font-semibold text-white mb-1">Resetar todas as senhas</h2>
          <p className="text-xs text-[#a3a3a3] mb-4">
            Redefine a senha de <span className="text-white">todas</span> as contas com e-mail para{' '}
            <span className="text-white">123456</span> — inclusive as que já têm acesso. Use só quando necessário
            (ex: senhas desconhecidas/quebradas). No próximo login, todo mundo é obrigado a trocar a senha.
          </p>

          {resetFeedback && (
            <div
              className={`p-3 rounded-md text-xs border mb-4 ${
                resetFeedback.ok
                  ? 'bg-emerald-900/20 border-emerald-800 text-emerald-200'
                  : 'bg-red-900/20 border-red-800 text-red-200'
              }`}
            >
              {resetFeedback.message}
            </div>
          )}

          <button
            type="button"
            onClick={handleResetAll}
            disabled={resetSubmitting}
            className="w-full px-3 py-2 bg-red-900/30 border border-red-800 text-red-200 font-medium rounded-md hover:bg-red-900/50 disabled:opacity-50 transition text-sm"
          >
            {resetSubmitting ? 'Resetando...' : 'Resetar TODAS as senhas para 123456'}
          </button>
        </div>
      </div>
    </div>
  )
}
