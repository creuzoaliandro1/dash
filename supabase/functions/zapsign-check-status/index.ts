// Edge Function: zapsign-check-status
// Recebe: { tokens: string[] }   — array de zapsign_doc_token
// Retorna: { results: { token, status }[] }
// Status ZapSign: "pending" | "signed" | "refused"
// Deploy: supabase functions deploy zapsign-check-status --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { tokens } = await req.json()
    if (!Array.isArray(tokens) || tokens.length === 0) {
      return new Response(JSON.stringify({ results: [] }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const ZAPSIGN_TOKEN = Deno.env.get('ZAPSIGN_TOKEN') || ''
    const ZAPSIGN_BASE_URL = Deno.env.get('ZAPSIGN_BASE_URL') || 'https://api.zapsign.com.br'

    const results = await Promise.all(
      tokens.map(async (token) => {
        try {
          const res = await fetch(`${ZAPSIGN_BASE_URL}/api/v1/docs/${token}/`, {
            headers: { Authorization: `Bearer ${ZAPSIGN_TOKEN}` },
          })
          if (!res.ok) return { token, status: null, error: `HTTP ${res.status}` }
          const doc = await res.json()
          // ZapSign retorna status "pending" ou "signed"
          // Considera "signed" quando todos os signatários assinaram
          const allSigned = Array.isArray(doc.signers) && doc.signers.length > 0
            ? doc.signers.every((s: any) => s.status === 'signed')
            : doc.status === 'signed'
          return { token, status: allSigned ? 'assinado' : doc.status ?? 'pendente' }
        } catch (e) {
          return { token, status: null, error: String(e) }
        }
      })
    )

    return new Response(JSON.stringify({ results }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
