// Edge Function: zapsign-create-doc
// Proxy seguro para criar documentos de assinatura na ZapSign a partir de um PDF (base64).
// O token da API fica APENAS no servidor (secret), nunca exposto no front-end.
//
// Secrets necessários (configurar via: supabase secrets set ...):
//   ZAPSIGN_API_TOKEN  -> token da API ZapSign (use o de SANDBOX primeiro)
//   ZAPSIGN_BASE_URL   -> opcional. Default: https://sandbox.api.zapsign.com.br
//                         (produção: https://api.zapsign.com.br)
//
// Deploy: supabase functions deploy zapsign-create-doc
//
// NOTA: confira os nomes exatos dos campos na documentação oficial
// (https://docs.zapsign.com.br) — em especial base64_pdf, signers[].auth_mode
// e o formato da resposta (token do documento e sign_url do signatário).

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return json({ error: "Método não permitido" }, 405)
  }

  try {
    const ZAPSIGN_API_TOKEN = Deno.env.get("ZAPSIGN_API_TOKEN")
    const ZAPSIGN_BASE_URL =
      Deno.env.get("ZAPSIGN_BASE_URL") ?? "https://sandbox.api.zapsign.com.br"

    if (!ZAPSIGN_API_TOKEN) {
      return json({ error: "ZAPSIGN_API_TOKEN não configurado no servidor" }, 500)
    }

    const payload = await req.json()
    const {
      name,
      base64_pdf,
      signer_name,
      signer_email,
      signer_phone,
      auth_mode, // ex.: "assinaturaTela" (assinar na tela). Opcional.
      send_automatic_email = false,
    } = payload ?? {}

    if (!name || !base64_pdf) {
      return json({ error: "Campos obrigatórios: name, base64_pdf" }, 400)
    }

    // Monta o signatário (cliente que clica no link e assina na tela)
    const signer: Record<string, unknown> = {
      name: signer_name || "Signatário",
      send_automatic_email,
    }
    if (signer_email) signer.email = signer_email
    if (signer_phone) signer.phone_number = signer_phone
    if (auth_mode) signer.auth_mode = auth_mode

    const body = {
      name,
      base64_pdf,
      lang: "pt-br",
      disable_signer_emails: !send_automatic_email,
      signers: [signer],
    }

    console.log("[zapsign] base:", ZAPSIGN_BASE_URL, "token_len:", ZAPSIGN_API_TOKEN.length)

    const resp = await fetch(`${ZAPSIGN_BASE_URL}/api/v1/docs/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ZAPSIGN_API_TOKEN}`,
      },
      body: JSON.stringify(body),
    })

    const data = await resp.json().catch(() => ({}))

    if (!resp.ok) {
      console.error("[zapsign] ZapSign respondeu", resp.status, "body:", JSON.stringify(data))
      return json({ error: "Erro na ZapSign", status: resp.status, details: data }, resp.status)
    }

    // Extrai o token do documento e o link de assinatura do primeiro signatário
    const doc_token = data?.token ?? data?.open_id ?? null
    const sign_url = data?.signers?.[0]?.sign_url ?? null

    return json({ doc_token, sign_url, raw: data })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
