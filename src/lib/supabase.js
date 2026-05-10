import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Auth helpers - usando tabela CONTAS
export const signIn = async (cic, pass) => {
  try {
    const { data, error } = await supabase
      .from('CONTAS')
      .select('*')
      .eq('cic', cic)
      .eq('pass', pass)
      .single()

    if (error || !data) {
      return { data: null, error: { message: 'CIC ou senha inválidos' } }
    }

    // Salvar sessão no localStorage
    const user = {
      id: data.id,
      cic: data.cic,
      name: data.name || data.cic,
      email: data.email || null,
    }

    localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem('sessionToken', btoa(JSON.stringify(user)))

    return { data: user, error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}

export const signUp = async (cic, pass) => {
  try {
    // Verificar se CIC já existe
    const { data: existing } = await supabase
      .from('CONTAS')
      .select('id')
      .eq('cic', cic)
      .single()

    if (existing) {
      return { data: null, error: { message: 'CIC já registrado' } }
    }

    // Criar novo usuário
    const { data, error } = await supabase
      .from('CONTAS')
      .insert([{ cic, pass }])
      .select()
      .single()

    if (error) {
      return { data: null, error }
    }

    // Fazer login automático
    return signIn(cic, pass)
  } catch (err) {
    return { data: null, error: err }
  }
}

export const signOut = async () => {
  localStorage.removeItem('user')
  localStorage.removeItem('sessionToken')
  return { error: null }
}

export const getCurrentUser = async () => {
  try {
    const userStr = localStorage.getItem('user')
    if (!userStr) {
      return { user: null, error: null }
    }

    const user = JSON.parse(userStr)
    return { user, error: null }
  } catch (err) {
    return { user: null, error: err }
  }
}

// Boletos
export const getBoletos = async (userId) => {
  const { data, error } = await supabase
    .from('boletos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return { data, error }
}

export const createBoleto = async (userId, boleto) => {
  const { data, error } = await supabase
    .from('boletos')
    .insert([{ ...boleto, user_id: userId }])
    .select()
  return { data, error }
}

export const updateBoleto = async (id, updates) => {
  const { data, error } = await supabase
    .from('boletos')
    .update(updates)
    .eq('id', id)
    .select()
  return { data, error }
}

export const deleteBoleto = async (id) => {
  const { error } = await supabase
    .from('boletos')
    .delete()
    .eq('id', id)
  return { error }
}
