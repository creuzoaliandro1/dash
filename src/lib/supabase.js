import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ============================================================
// Auth — Supabase Auth vinculado à tabela CONTAS pelo e-mail.
// Cada linha de CONTAS tem um e-mail único (sem duplicidade); o usuário
// autenticado no Supabase Auth é resolvido para "sua" conta por esse e-mail.
//
// Mantemos o objeto 'user' em localStorage com o MESMO formato de antes
// ({ id, cic, name, email, tipo }), pois MainLayout.jsx lê/escreve esse
// objeto diretamente (inclui o switch de conta ativa do Master, que troca
// 'id'/'name' preservando tipo='M'). Trocar apenas o mecanismo de login,
// sem tocar nesse contrato, evita ter que reescrever o restante do app.
// ============================================================

const buildUserFromConta = (conta) => ({
  id: conta.id,
  cic: conta.cic,
  name: conta.nome_correntista || conta.cic,
  email: conta.email || null,
  tipo: conta.tipo || null,
})

// Busca a CONTA vinculada a um e-mail (1 e-mail = 1 conta, sem duplicidade).
const fetchContaByEmail = async (email) => {
  if (!email) return { data: null, error: new Error('Sem e-mail na sessão') }
  const { data, error } = await supabase
    .from('CONTAS')
    .select('id, cic, nome_correntista, email, tipo')
    .ilike('email', email)
    .limit(1)
    .maybeSingle()
  return { data, error }
}

export const signIn = async (email, password) => {
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !authData?.user) {
      return { data: null, error: { message: 'E-mail ou senha inválidos' } }
    }

    const { data: conta, error: contaError } = await fetchContaByEmail(authData.user.email)
    if (contaError || !conta) {
      await supabase.auth.signOut()
      return {
        data: null,
        error: { message: 'Nenhuma conta Capt vinculada a este e-mail. Fale com o administrador.' },
      }
    }

    const user = buildUserFromConta(conta)
    localStorage.setItem('user', JSON.stringify(user))

    return { data: user, error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}

// Dispara o e-mail de redefinição de senha do Supabase Auth.
export const resetPassword = async (email) => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    return { error }
  } catch (err) {
    return { error: err }
  }
}

export const signOut = async () => {
  try {
    await supabase.auth.signOut()
  } catch (err) {
    console.error('[signOut] erro:', err)
  }
  localStorage.removeItem('user')
  localStorage.removeItem('activeContaId')
  return { error: null }
}

export const getCurrentUser = async () => {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const session = sessionData?.session

    if (!session?.user?.email) {
      localStorage.removeItem('user')
      localStorage.removeItem('activeContaId')
      return { user: null, error: null }
    }

    // Reaproveita o cache local se pertencer ao mesmo e-mail já autenticado
    // (preserva o switch de conta ativa do Master entre reloads da página).
    const cachedStr = localStorage.getItem('user')
    if (cachedStr) {
      try {
        const cached = JSON.parse(cachedStr)
        if (cached?.email && String(cached.email).toLowerCase() === session.user.email.toLowerCase()) {
          return { user: cached, error: null }
        }
      } catch {
        // cache inválido — recarrega abaixo
      }
    }

    const { data: conta, error } = await fetchContaByEmail(session.user.email)
    if (error || !conta) {
      return { user: null, error: error || new Error('Nenhuma conta Capt vinculada a este e-mail.') }
    }

    const user = buildUserFromConta(conta)
    localStorage.setItem('user', JSON.stringify(user))
    return { user, error: null }
  } catch (err) {
    return { user: null, error: err }
  }
}
