import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ============================================================
// Fix (03/07/2026): quando uma Edge Function responde com status != 2xx,
// supabase-js só expõe a mensagem genérica "Edge Function returned a
// non-2xx status code" em error.message — o corpo JSON real (com
// data.mensagem/data.error, incluindo o que o próprio BMP respondeu) fica
// em error.context (um Response), que nenhuma das dezenas de telas BMP
// (ContaBmp/*, BoletosBmp/*) lia. Isso fazia toda função BMP falhar mostrar
// só esse texto genérico, sem dar pra diagnosticar o erro real do BMP nem
// preencher a planilha de testes.
//
// Em vez de tornar toda função extractError(...) espalhada pelo app async
// (o que exigiria revisar ~70 call sites, vários deles dentro de
// Array.filter — que não suporta callback assíncrono), a correção é feita
// uma única vez aqui: intercepta supabase.functions.invoke e, se vier um
// erro com corpo JSON, já substitui error.message pela mensagem real antes
// de devolver — todo o resto do app continua funcionando sem mudanças.
// supabase.functions é um GETTER (definido no protótipo do SupabaseClient) que
// devolve uma instância NOVA de FunctionsClient a cada acesso — por isso não dá
// pra remendar `supabase.functions.invoke` diretamente (o objeto remendado é
// descartado na hora). A correção precisa sobrescrever o próprio getter numa
// propriedade own da instância `supabase`, remendando o `.invoke` de cada
// client novo que ele devolver.
const functionsProtoDescriptor = (() => {
  let proto = Object.getPrototypeOf(supabase)
  while (proto) {
    const d = Object.getOwnPropertyDescriptor(proto, 'functions')
    if (d) return d
    proto = Object.getPrototypeOf(proto)
  }
  return null
})()

if (functionsProtoDescriptor?.get) {
  Object.defineProperty(supabase, 'functions', {
    configurable: true,
    get() {
      const client = functionsProtoDescriptor.get.call(this)
      const originalInvoke = client.invoke.bind(client)
      client.invoke = async (...args) => {
        const result = await originalInvoke(...args)
        if (result?.error?.context && typeof result.error.context.json === 'function') {
          try {
            const body = await result.error.context.clone().json()
            result.error.body = body
            const mensagem = body?.mensagem || body?.error
            if (mensagem) result.error.message = mensagem
          } catch {
            // corpo do erro não era JSON — mantém a mensagem genérica do supabase-js
          }
        }
        return result
      }
      return client
    },
  })
}

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
  // Contas provisionadas com a senha padrão (123456) via "Acessos" nascem com
  // must_change_password = true e ficam presas na tela de troca de senha
  // (ChangePasswordPage) até o usuário definir uma senha própria.
  mustChangePassword: !!conta.must_change_password,
})

// Busca a CONTA vinculada a um e-mail (1 e-mail = 1 conta, sem duplicidade).
const fetchContaByEmail = async (email) => {
  if (!email) return { data: null, error: new Error('Sem e-mail na sessão') }
  const { data, error } = await supabase
    .from('CONTAS')
    .select('id, cic, nome_correntista, email, tipo, must_change_password')
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

// Usado pela troca obrigatória de senha no primeiro acesso (ChangePasswordPage):
// define a nova senha no Supabase Auth e derruba a flag must_change_password
// da CONTA correspondente, liberando o restante do app.
export const setNewPassword = async (contaId, newPassword) => {
  try {
    const { error: authError } = await supabase.auth.updateUser({ password: newPassword })
    if (authError) return { error: authError }

    const { error: contaError } = await supabase
      .from('CONTAS')
      .update({ must_change_password: false })
      .eq('id', contaId)
    if (contaError) return { error: contaError }

    const cachedStr = localStorage.getItem('user')
    if (cachedStr) {
      try {
        const cached = JSON.parse(cachedStr)
        localStorage.setItem('user', JSON.stringify({ ...cached, mustChangePassword: false }))
      } catch {
        // cache inválido — ignora, próximo getCurrentUser recarrega do banco
      }
    }

    return { error: null }
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
