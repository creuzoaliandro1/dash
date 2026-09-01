// Cliente front-end da API Firebird — chama a Edge Function `firebird-proxy`
// (a chave X-API-Key vive só no servidor). Nunca fala direto com dash.contacapt.
//
// Toda função retorna { data, error, firebirdDown, status }:
//   - firebirdDown=true  -> Firebird fora do ar / timeout / rede => use fallback Supabase
//   - error set & firebirdDown=false -> erro de negócio (400/401/403/404/409): NÃO faça fallback
//
// Formato do :id => valores da PK na ordem, separados por "~" (ex. "6~1~20781").

import { supabase } from '../lib/supabase'
import { firebirdConfig } from '../config/firebird'

async function call({ method, table, id = null, query = null, body = null }) {
  try {
    const { data: env, error: invokeErr } = await supabase.functions.invoke(
      firebirdConfig.proxyFunction,
      { body: { method, table, id, query, body } },
    )

    // Falha ao sequer chamar a Edge Function (rede do proxy, função não deployada...).
    if (invokeErr) {
      return { data: null, error: invokeErr, firebirdDown: true, status: 0 }
    }

    // env = { ok, status, data, firebirdDown, error }
    if (env?.ok) {
      return { data: env.data, error: null, firebirdDown: false, status: env.status }
    }
    return {
      data: env?.data ?? null,
      error: new Error(env?.error || `Firebird HTTP ${env?.status ?? '??'}`),
      firebirdDown: Boolean(env?.firebirdDown),
      status: env?.status ?? 0,
    }
  } catch (e) {
    // Exceção inesperada => trata como indisponível para permitir fallback.
    return { data: null, error: e, firebirdDown: true, status: 0 }
  }
}

export const firebirdApi = {
  // Introspecção do schema real. Rode isto uma vez para conferir colunas/PK.
  tables: () => call({ method: 'GET', table: '_tables' }),

  // Lista com filtro por igualdade (limit máx. 500). Ex.: list('CEDENTE', { COD_CEDENTE: 6, limit: 5 })
  list: (table, query = {}) => call({ method: 'GET', table, query }),

  // Busca uma linha pela PK (id = valores unidos por "~"). Ex.: get('CEDENTE', '6')
  get: (table, id) => call({ method: 'GET', table, id }),

  // Cria (PK obrigatória no body).
  create: (table, row) => call({ method: 'POST', table, body: row }),

  // Atualiza campos (não a PK).
  update: (table, id, fields) => call({ method: 'PUT', table, id, body: fields }),

  // Remove.
  remove: (table, id) => call({ method: 'DELETE', table, id }),
}

export default firebirdApi
