// Edge Function: firebird-outbox-worker
// Drena a fila public.firebird_outbox reenviando as escritas ao Firebird.
//
// Secrets: FIREBIRD_API_KEY (obrig.), FIREBIRD_API_URL (default dash.contacapt...).
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetados automaticamente.
//
// Deploy:   supabase functions deploy firebird-outbox-worker
// Agendar:  chame periodicamente (pg_cron / Scheduled Function) — para agendar
//           sem JWT de usuário, deixe verify_jwt=false OU chame com o service key.
//
// Regras: 2xx => done. 5xx/timeout => Firebird ainda fora, para o lote e deixa
// pending. 4xx => erro de negócio, marca 'error' (não reprocessa em loop).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } })

const BATCH = 50
const MAX_ATTEMPTS = 25
const TIMEOUT_MS = 32000

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  const apiKey = Deno.env.get("FIREBIRD_API_KEY")
  const baseUrl = (Deno.env.get("FIREBIRD_API_URL") ?? "https://dash.contacapt.com.br/api/firebird").replace(/\/+$/, "")
  const supaUrl = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  if (!apiKey) return json({ error: "FIREBIRD_API_KEY não configurada" }, 500)

  const db = createClient(supaUrl, serviceKey)

  const { data: pend, error: selErr } = await db
    .from("firebird_outbox")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(BATCH)
  if (selErr) return json({ error: selErr.message }, 500)

  let done = 0, errored = 0, stoppedDown = false
  for (const row of pend ?? []) {
    let url = `${baseUrl}/${encodeURIComponent(row.fb_table)}`
    if (row.fb_id) url += `/${encodeURIComponent(row.fb_id)}`
    const hasBody = row.op !== "DELETE" && row.payload != null

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    let status = 0, errMsg = "", down = false
    try {
      const res = await fetch(url, {
        method: row.op,
        headers: { "X-API-Key": apiKey, ...(hasBody ? { "Content-Type": "application/json" } : {}) },
        body: hasBody ? JSON.stringify(row.payload) : undefined,
        signal: controller.signal,
      })
      clearTimeout(timer)
      status = res.status
      if (status >= 500) { down = true; errMsg = `HTTP ${status}` }
      else if (status < 200 || status >= 300) {
        const t = await res.text().catch(() => "")
        errMsg = t || `HTTP ${status}`
      }
    } catch (e) {
      clearTimeout(timer)
      down = true
      errMsg = (e as any)?.name === "AbortError" ? "timeout" : String((e as any)?.message ?? e)
    }

    const dupOk = status === 409 && /existe|duplicat/i.test(errMsg)
    if ((status >= 200 && status < 300) || dupOk) {
      await db.from("firebird_outbox").update({ status: "done", processed_at: new Date().toISOString(), attempts: row.attempts + 1 }).eq("id", row.id)
      done++
    } else if (down) {
      // Firebird ainda fora — não adianta seguir o lote.
      await db.from("firebird_outbox").update({ attempts: row.attempts + 1, last_error: errMsg }).eq("id", row.id)
      stoppedDown = true
      break
    } else {
      const attempts = row.attempts + 1
      await db.from("firebird_outbox").update({
        status: attempts >= MAX_ATTEMPTS ? "error" : "pending",
        attempts, last_error: errMsg,
      }).eq("id", row.id)
      errored++
    }
  }

  const { count: remaining } = await db
    .from("firebird_outbox").select("*", { count: "exact", head: true }).eq("status", "pending")

  return json({ processados: (pend ?? []).length, done, errored, restantes: remaining ?? 0, firebirdForaDoAr: stoppedDown })
})
