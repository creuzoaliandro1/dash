// Cliente do backend Baileys (WhatsApp). A URL do backend é configurável por
// variável de ambiente VITE_WHATSAPP_API (ex.: https://meu-backend.exemplo.com).
// Em desenvolvimento cai no localhost:3001 (o `backend/` do projeto).
export const WHATSAPP_API_BASE = String(
  import.meta.env.VITE_WHATSAPP_API || 'http://localhost:3001'
).replace(/\/$/, '')

const req = async (path, opts = {}) => {
  let res
  try {
    res = await fetch(WHATSAPP_API_BASE + path, {
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      ...opts,
    })
  } catch (e) {
    // Falha de rede = backend fora do ar / URL errada
    const err = new Error('Backend do WhatsApp indisponível (' + WHATSAPP_API_BASE + ').')
    err.offline = true
    throw err
  }
  let data = null
  try { data = await res.json() } catch {}
  if (!res.ok) throw new Error((data && (data.erro || data.error)) || `Falha (${res.status})`)
  return data
}

export const waStatus = () => req('/api/whatsapp/status')
export const waIniciar = () => req('/api/whatsapp/iniciar', { method: 'POST' })
export const waDesconectar = () => req('/api/whatsapp/desconectar', { method: 'POST' })
export const waEnviarDocumento = (telefone, base64, filename, caption) =>
  req('/api/whatsapp/enviar-documento', {
    method: 'POST',
    body: JSON.stringify({ telefone, base64, filename, caption }),
  })
