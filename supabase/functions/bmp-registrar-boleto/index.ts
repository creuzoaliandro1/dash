// Edge Function: bmp-registrar-boleto
// Proxy seguro para registrar boletos no BMP (POST /api/Boleto/Registrar).
// O token/credenciais ficam APENAS no servidor (secrets), nunca no front-end.
// Ref: https://bmpdocs.moneyp.com.br/baas/referencias-de-api/boletos/55-registrar-boleto
//
// Secrets (supabase secrets set ...):
//   BMP_BASE_URL          -> base da API. Ex.: https://api.ext.dbs.moneyp.dev.br (homologação)
//   BMP_IGNORA_HANDSHAKE  -> "true" em homologação (header IgnoraHandshake). Default "true".
//   Autenticação (escolha UMA das opções):
//     (A) Token estático:   BMP_TOKEN  -> Bearer token já emitido
//     (B) OAuth2 client_credentials:
//         BMP_TOKEN_URL      -> endpoint que emite o token
//         BMP_CLIENT_ID
//         BMP_CLIENT_SECRET
//         BMP_SCOPE          -> ex.: "api.ext api.boleto.registrar"
//
// Deploy: supabase functions deploy bmp-registrar-boleto
//
// Body esperado (POST):
//   { payload: RegistrarBoletoManualExternoRequest, idempotencyKey: string, ignoraHandshake?: boolean }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })

// Obtém o Bearer token: usa BMP_TOKEN estático, ou faz client_credentials se configurado.
async function getAccessToken(): Promise<string> {
  const staticToken = Deno.env.get("BMP_TOKEN")
  if (staticToken) return staticToken

  const tokenUrl = Deno.env.get("BMP_TOKEN_URL")
  const clientId = Deno.env.get("BMP_CLIENT_ID")
  const clientSecret = Deno.env.get("BMP_CLIENT_SECRET")
  const scope = Deno.env.get("BMP_SCOPE") ?? "api.ext api.boleto.registrar"

  if (!tokenUrl || !clientId || !clientSecret) {
    throw new Error(
      "Autenticação BMP não configurada: defina BMP_TOKEN, ou BMP_TOKEN_URL + BMP_CLIENT_ID + BMP_CLIENT_SECRET",
    )
  }

  const form = new URLSearchParams()
  form.set("grant_type", "client_credentials")
  form.set("client_id", clientId)
  form.set("client_secret", clientSecret)
  form.set("scope", scope)

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) {
    throw new Error("Falha ao obter token BMP: " + (data.error_description || data.error || res.status))
  }
  return data.access_token as string
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json({ sucesso: false, mensagem: "Método não permitido" }, 405)

  try {
    const BMP_BASE_URL = Deno.env.get("BMP_BASE_URL") ?? "https://api.ext.dbs.moneyp.dev.br"
    const defaultIgnora = (Deno.env.get("BMP_IGNORA_HANDSHAKE") ?? "true") === "true"

    const body = await req.json().catch(() => ({}))
    const { payload, idempotencyKey, ignoraHandshake } = body ?? {}

    if (!payload) return json({ sucesso: false, mensagem: "Campo obrigatório: payload" }, 400)
    if (!idempotencyKey) return json({ sucesso: false, mensagem: "Campo obrigatório: idempotencyKey" }, 400)

    const token = await getAccessToken()

    const res = await fetch(`${BMP_BASE_URL.replace(/\/$/, "")}/api/Boleto/Registrar`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "IdempotencyKey": String(idempotencyKey),
        "IgnoraHandshake": String(ignoraHandshake ?? defaultIgnora),
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      // BMP retorna { sucesso, mensagem } em 400/500
      return json({ sucesso: false, status: res.status, ...data }, res.status)
    }
    return json(data, 200)
  } catch (err) {
    return json({ sucesso: false, mensagem: (err as Error).message }, 500)
  }
})
