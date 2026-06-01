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
      // Compatibilidade: signatário único (formato antigo)
      signer_name,
      signer_email,
      signer_phone,
      auth_mode,
      // Novo: lista de signatários [{ name, email, phone, auth_mode }]
      signers: signersInput,
      // Novo: documentos extras (anexos) no MESMO link [{ name, base64 }]
      extra_pdfs: extraPdfs,
      // Novo: posicionamento por coordenadas (place-signatures) no doc principal.
      // [{ page, type, relative_position_bottom, relative_position_left, relative_size_x, relative_size_y, signer_index }]
      placements,
      send_automatic_email = false,
    } = payload ?? {}

    if (!name || !base64_pdf) {
      return json({ error: "Campos obrigatórios: name, base64_pdf" }, 400)
    }

    // Monta a lista de signatários
    let signers: Record<string, unknown>[]
    if (Array.isArray(signersInput) && signersInput.length > 0) {
      signers = signersInput.map((s: Record<string, unknown>) => {
        const sig: Record<string, unknown> = {
          name: (s.name as string) || "Signatário",
          send_automatic_email,
        }
        if (s.email) sig.email = s.email
        if (s.phone) sig.phone_number = s.phone
        if (s.phone_number) sig.phone_number = s.phone_number
        if (s.auth_mode) sig.auth_mode = s.auth_mode
        // Posicionamento por texto-âncora (ZapSign): assinatura/rubrica
        if (s.signature_placement) sig.signature_placement = s.signature_placement
        if (s.rubrica_placement) sig.rubrica_placement = s.rubrica_placement
        return sig
      })
    } else {
      const signer: Record<string, unknown> = {
        name: signer_name || "Signatário",
        send_automatic_email,
      }
      if (signer_email) signer.email = signer_email
      if (signer_phone) signer.phone_number = signer_phone
      if (auth_mode) signer.auth_mode = auth_mode
      signers = [signer]
    }

    const body = {
      name,
      base64_pdf,
      lang: "pt-br",
      disable_signer_emails: !send_automatic_email,
      signers,
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

    // Extrai o token do documento e os links de assinatura de cada signatário
    const doc_token = data?.token ?? data?.open_id ?? null
    const sign_url = data?.signers?.[0]?.sign_url ?? null
    const signers_out = Array.isArray(data?.signers)
      ? data.signers.map((s: Record<string, unknown>) => ({
          name: s?.name ?? null,
          sign_url: s?.sign_url ?? null,
          token: s?.token ?? null,
        }))
      : []

    // Posiciona assinaturas (place-signatures) num documento (principal ou anexo).
    const placeOn = async (token: string | null, plcs: unknown) => {
      if (!token || !Array.isArray(plcs) || plcs.length === 0 || !Array.isArray(data?.signers)) return
      const rubricas = (plcs as Record<string, unknown>[])
        .map((p) => {
          const idx = Number(p?.signer_index ?? -1)
          const tok = data.signers[idx]?.token
          if (!tok) return null
          return {
            type: (p?.type as string) || "signature",
            page: Number(p?.page ?? 0),
            relative_position_bottom: Number(p?.relative_position_bottom ?? 0),
            relative_position_left: Number(p?.relative_position_left ?? 0),
            relative_size_x: Number(p?.relative_size_x ?? 16.6),
            relative_size_y: Number(p?.relative_size_y ?? 6),
            signer_token: tok,
          }
        })
        .filter(Boolean)
      if (rubricas.length === 0) return
      try {
        const pr = await fetch(`${ZAPSIGN_BASE_URL}/api/v1/docs/${token}/place-signatures/`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${ZAPSIGN_API_TOKEN}` },
          body: JSON.stringify({ rubricas }),
        })
        if (!pr.ok) {
          const pe = await pr.json().catch(() => ({}))
          console.error("[zapsign] place-signatures", token, pr.status, JSON.stringify(pe))
        }
      } catch (e) {
        console.error("[zapsign] place-signatures exc", String(e))
      }
    }

    // Anexa documentos extras (mesmo link); posiciona assinaturas no anexo se vier ex.placements
    const extra_docs_out: Record<string, unknown>[] = []
    if (Array.isArray(extraPdfs) && extraPdfs.length > 0 && doc_token) {
      for (const ex of extraPdfs) {
        try {
          const r = await fetch(`${ZAPSIGN_BASE_URL}/api/v1/docs/${doc_token}/upload-extra-doc/`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${ZAPSIGN_API_TOKEN}` },
            body: JSON.stringify({ name: ex?.name || "Anexo", base64_pdf: ex?.base64 }),
          })
          const ed = await r.json().catch(() => ({}))
          if (r.ok) {
            extra_docs_out.push({ token: ed?.token ?? null, name: ed?.name ?? null })
            if (ed?.token && Array.isArray(ex?.placements)) await placeOn(ed.token, ex.placements)
          } else console.error("[zapsign] upload-extra-doc", r.status, JSON.stringify(ed))
        } catch (e) {
          console.error("[zapsign] upload-extra-doc exc", String(e))
        }
      }
    }

    // Posicionamento no documento principal
    await placeOn(doc_token, placements)

    return json({ doc_token, sign_url, signers: signers_out, extra_docs: extra_docs_out, raw: data })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
