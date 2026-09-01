// Edge Function: firebird-proxy
// Proxy seguro para a API Firebird do ContaCapt (https://dash.contacapt.com.br/api/firebird).
// A X-API-Key (write-capable) fica APENAS aqui, como secret — nunca no bundle do front-end.
//
// Secrets (supabase secrets set ...):
//   FIREBIRD_API_KEY  -> a chave capt_... gerada no servidor ContaCapt (OBRIGATÓRIO)
//   FIREBIRD_API_URL  -> base da API. Default: https://dash.contacapt.com.br/api/firebird
//
// Deploy: supabase functions deploy firebird-proxy
//
// Contrato (POST, body JSON):
//   { method: "GET"|"POST"|"PUT"|"DELETE", table: "OPEITE"|..., id?: "6~1~20781",
//     query?: { campo: valor, limit, offset }, body?: {...} }
//
// Resposta: SEMPRE HTTP 200 com um envelope (evita que supabase-js engula o corpo
// em erros non-2xx). O status real do Firebird vai em `status`:
//   { ok: boolean, status: number, data: any, firebirdDown: boolean, error?: string }
//   - firebirdDown=true  -> Firebird fora do ar / timeout / rede (500, 502, 504, sem resposta)
//   - ok=false & firebirdDown=false -> erro de negócio do Firebird (400/401/403/404/409)

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

// Tabelas físicas do Firebird (Dados.gdb) + o introspector _tables.
// Allowlist evita path-injection / SSRF via o campo `table`.
const TABELAS = new Set([
  "AVALISTA", "CEDENTE", "CTACORRENTE", "NNOPEITE", "OPECAB", "OPEITE",
  "OPEITEWEB", "OPECABWEB", "SACADO", "SACADOWEB", "OCORRENCIA",
  "LANCACTA", "DEBENTURE", "MENSAGEM", "_tables",
])

const METODOS = new Set(["GET", "POST", "PUT", "DELETE"])
const TIMEOUT_MS = 32000 // API Firebird tem timeout ~30s; damos uma folga

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  const apiKey = Deno.env.get("FIREBIRD_API_KEY")
  const baseUrl = (Deno.env.get("FIREBIRD_API_URL") ?? "https://dash.contacapt.com.br/api/firebird").replace(/\/+$/, "")

  if (!apiKey) {
    return json({ ok: false, status: 0, data: null, firebirdDown: true, error: "FIREBIRD_API_KEY não configurada no servidor" })
  }

  let payload: any
  try {
    payload = await req.json()
  } catch {
    return json({ ok: false, status: 400, data: null, firebirdDown: false, error: "Body JSON inválido" })
  }

  const method = String(payload?.method ?? "GET").toUpperCase()
  const table = String(payload?.table ?? "")
  const id = payload?.id != null ? String(payload.id) : null
  const query = payload?.query ?? null
  const bodyOut = payload?.body ?? null

  if (!METODOS.has(method)) {
    return json({ ok: false, status: 400, data: null, firebirdDown: false, error: `Método inválido: ${method}` })
  }
  if (!TABELAS.has(table)) {
    return json({ ok: false, status: 400, data: null, firebirdDown: false, error: `Tabela desconhecida: ${table}` })
  }

  // Monta a URL: /:table  ou  /:table/:id  (+ querystring nos GET de lista)
  let url = `${baseUrl}/${encodeURIComponent(table)}`
  if (id) url += `/${encodeURIComponent(id)}`
  if (query && typeof query === "object") {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue
      qs.set(k, String(v))
    }
    const s = qs.toString()
    if (s) url += `?${s}`
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "X-API-Key": apiKey,
        ...(bodyOut != null ? { "Content-Type": "application/json" } : {}),
      },
      body: bodyOut != null ? JSON.stringify(bodyOut) : undefined,
      signal: controller.signal,
    })
    clearTimeout(timer)

    const status = res.status
    // 204 (DELETE ok) não tem corpo
    let data: any = null
    if (status !== 204) {
      const text = await res.text()
      try { data = text ? JSON.parse(text) : null } catch { data = text }
    }

    // 500 do Firebird = fora do ar / timeout interno (por spec). 5xx em geral = down.
    const firebirdDown = status >= 500
    const ok = status >= 200 && status < 300
    return json({ ok, status, data, firebirdDown, error: ok ? undefined : (data?.error ?? data?.message ?? `HTTP ${status}`) })
  } catch (e) {
    clearTimeout(timer)
    const aborted = (e as any)?.name === "AbortError"
    return json({
      ok: false,
      status: aborted ? 504 : 502,
      data: null,
      firebirdDown: true,
      error: aborted ? "Timeout ao contatar o Firebird" : `Falha de rede ao contatar o Firebird: ${(e as any)?.message ?? e}`,
    })
  }
})
