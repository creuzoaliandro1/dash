// Edge Function: serpro-consulta-nfe
// Consulta uma NF-e pela chave de acesso na API "Consulta NF-e Direto na Faixa"
// do Serpro e devolve o XML da nota (nfeProc) pronto para salvar como .xml.
// As credenciais do Serpro ficam APENAS no servidor (secrets), nunca no front-end.
//
// Secrets necessários (supabase secrets set ...):
//   SERPRO_CONSUMER_KEY     -> Consumer Key do contrato no Serpro
//   SERPRO_CONSUMER_SECRET  -> Consumer Secret do contrato no Serpro
//   SERPRO_NFE_BASE_URL     -> opcional. Default (produção):
//                              https://gateway.apiserpro.serpro.gov.br/consulta-nfe-df/api/v1
//                              Demonstração (dados fictícios, sem cobrança):
//                              https://gateway.apiserpro.serpro.gov.br/consulta-nfe-df-trial/api/v1
//
// Deploy: supabase functions deploy serpro-consulta-nfe
//
// Entrada:  POST { chave: "44 dígitos" }
// Saída OK: { ok: true, chave, xml, resumo: { numero, serie, emissao, valor,
//             emitente: { nome, cnpj }, destinatario: { nome, documento },
//             protocolo, situacao } }
//
// Cobrança: o Serpro cobra só respostas 200. Erros 400/401/403/404/406/408/500/504
// não são cobrados — por isso validamos a chave aqui antes de chamar a API.

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

const TOKEN_URL = "https://gateway.apiserpro.serpro.gov.br/token"
const DEFAULT_BASE_URL = "https://gateway.apiserpro.serpro.gov.br/consulta-nfe-df/api/v1"

// Token reaproveitado entre chamadas enquanto a instância da função estiver viva
// (o Serpro emite tokens de ~1h). Renovamos 60s antes de expirar.
let cachedToken: { value: string; expiresAt: number } | null = null

async function getToken(key: string, secret: string, force = false): Promise<string> {
  if (!force && cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${key}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => "")
    throw new Error(`Falha ao autenticar no Serpro (HTTP ${res.status}) ${txt.slice(0, 200)}`)
  }
  const data = await res.json()
  if (!data?.access_token) throw new Error("Serpro não retornou access_token")
  const ttl = Number(data.expires_in) || 3600
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (ttl - 60) * 1000 }
  return cachedToken.value
}

// Dígito verificador da chave de acesso (módulo 11, pesos 2..9 da direita p/ esquerda).
function chaveValida(chave: string): boolean {
  if (!/^\d{44}$/.test(chave)) return false
  let soma = 0
  let peso = 2
  for (let i = 42; i >= 0; i--) {
    soma += Number(chave[i]) * peso
    peso = peso === 9 ? 2 : peso + 1
  }
  const resto = soma % 11
  const dv = resto < 2 ? 0 : 11 - resto
  return dv === Number(chave[43])
}

// Primeiro bloco <tag ...>...</tag> (com prefixo de namespace opcional).
function bloco(xml: string, tag: string): string | null {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}(?:\\s[^>]*)?>[\\s\\S]*?</(?:[\\w-]+:)?${tag}>`)
  return xml.match(re)?.[0] ?? null
}

// Texto da primeira ocorrência de <tag>texto</tag> dentro de um trecho.
function texto(xml: string | null, tag: string): string {
  if (!xml) return ""
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}(?:\\s[^>]*)?>([^<]*)</(?:[\\w-]+:)?${tag}>`)
  return (xml.match(re)?.[1] ?? "").trim()
}

// O Serpro devolve a nota dentro de um envelope SOAP (retConsNFeLog/NFeLog/nfeProc),
// com <protNFe> antes de <NFe>. Remontamos no leiaute padrão de distribuição
// (nfeProc > NFe + protNFe) para o .xml abrir em qualquer sistema/validador.
function montarNfeProc(raw: string): string | null {
  const nfe = bloco(raw, "NFe")
  if (!nfe) return null
  const prot = bloco(raw, "protNFe") ?? ""
  const infNFe = nfe.match(/<infNFe[^>]*\sversao="([^"]+)"/)?.[1]
  const versao = infNFe || texto(bloco(raw, "nfeProc"), "versao") || "4.00"
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="${versao}">` +
    nfe +
    prot +
    `</nfeProc>`
  )
}

function resumo(xml: string) {
  const ide = bloco(xml, "ide")
  const emit = bloco(xml, "emit")
  const dest = bloco(xml, "dest")
  const total = bloco(xml, "ICMSTot")
  const prot = bloco(xml, "infProt")
  return {
    numero: texto(ide, "nNF"),
    serie: texto(ide, "serie"),
    emissao: (texto(ide, "dhEmi") || texto(ide, "dEmi")).slice(0, 10),
    valor: texto(total, "vNF"),
    emitente: { nome: texto(emit, "xNome"), cnpj: texto(emit, "CNPJ") || texto(emit, "CPF") },
    destinatario: {
      nome: texto(dest, "xNome"),
      documento: texto(dest, "CNPJ") || texto(dest, "CPF"),
    },
    protocolo: texto(prot, "nProt"),
    situacao: [texto(prot, "cStat"), texto(prot, "xMotivo")].filter(Boolean).join(" - "),
  }
}

const MENSAGENS: Record<number, string> = {
  400: "Chave de acesso inválida para o Serpro.",
  401: "Falha de autenticação no Serpro.",
  403: "Acesso negado pelo Serpro (verifique o contrato/URL da API).",
  404: "NF-e não encontrada para essa chave.",
  408: "O Serpro demorou para responder. Tente novamente.",
  500: "Erro interno no Serpro. Tente novamente.",
  504: "Serpro indisponível no momento (timeout). Tente novamente.",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json({ ok: false, error: "Método não permitido" }, 405)

  try {
    const KEY = Deno.env.get("SERPRO_CONSUMER_KEY")
    const SECRET = Deno.env.get("SERPRO_CONSUMER_SECRET")
    const BASE_URL = (Deno.env.get("SERPRO_NFE_BASE_URL") ?? DEFAULT_BASE_URL).replace(/\/+$/, "")
    if (!KEY || !SECRET) {
      return json({ ok: false, error: "Credenciais do Serpro não configuradas no servidor" }, 200)
    }

    const body = await req.json().catch(() => ({}))
    const chave = String(body?.chave ?? "").replace(/\D/g, "")
    // A chave de exemplo do ambiente de demonstração é fictícia (DV não confere).
    const modoDemo = BASE_URL.includes("-trial")
    if (modoDemo ? !/^\d{44}$/.test(chave) : !chaveValida(chave)) {
      return json({ ok: false, error: "Chave NF inválida: informe os 44 dígitos da chave de acesso." }, 200)
    }

    const consultar = async (token: string) =>
      fetch(`${BASE_URL}/nfe/${chave}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/xml" },
      })

    let res = await consultar(await getToken(KEY, SECRET))
    // Token pode ter sido revogado/expirado antes do previsto: renova uma vez.
    if (res.status === 401) res = await consultar(await getToken(KEY, SECRET, true))

    const raw = await res.text()
    if (!res.ok) {
      console.error(`Serpro HTTP ${res.status}: ${raw.slice(0, 500)}`)
      return json(
        { ok: false, status: res.status, error: MENSAGENS[res.status] ?? `Erro no Serpro (HTTP ${res.status})` },
        // Erros voltam com HTTP 200 + ok:false para o front exibir a mensagem
        // (supabase.functions.invoke esconde o corpo de respostas não-2xx).
        200,
      )
    }

    const xml = montarNfeProc(raw)
    if (!xml) {
      console.error("Resposta do Serpro sem <NFe>:", raw.slice(0, 500))
      return json({ ok: false, error: "Resposta do Serpro sem os dados da NF-e." }, 200)
    }

    return json({ ok: true, chave, xml, resumo: resumo(xml) })
  } catch (err) {
    console.error("serpro-consulta-nfe:", err)
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 200)
  }
})
