// Camada de roteamento Firebird <-> Supabase.
//
// Política (definida com o time):
//   LEITURA: tenta Firebird; se estiver fora do ar, cai para o Supabase.
//   ESCRITA: tenta Firebird; em 409 (lock do efactor-sync) retransmite algumas
//            vezes; se continuar fora do ar, ENFILEIRA em firebird_outbox para
//            reprocessar depois (worker `firebird-outbox-worker`).
//   Erro de NEGÓCIO (400/401/403/404) nunca vira fallback nem fila — é devolvido.
//
// Tudo passa pela flag firebirdConfig.enabled: desligada, o comportamento é
// idêntico ao atual (100% Supabase).

import { supabase } from '../lib/supabase'
import { firebirdConfig } from '../config/firebird'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Leitura com fallback. `firebird` e `supabaseFallback` são funções async que
// retornam { data, error } (o padrão dos services). `firebird` deve retornar
// também `firebirdDown`.
export async function readThrough({ firebird, supabaseFallback }) {
  if (!firebirdConfig.enabled) {
    const r = await supabaseFallback()
    return { ...r, source: 'supabase' }
  }
  const fb = await firebird()
  // Durante o rollout, qualquer falha do Firebird (fora do ar OU erro de
  // negócio, ex. PK ainda não confirmada) cai para o Supabase — leitura nunca
  // regride. Só devolve dados do Firebird em sucesso limpo.
  if (fb?.firebirdDown || fb?.error) {
    if (fb?.error && !fb?.firebirdDown) {
      console.warn('[Firebird] leitura falhou, usando Supabase:', fb.error?.message)
    }
    const r = await supabaseFallback()
    return { ...r, source: fb?.firebirdDown ? 'supabase-fallback' : 'supabase-fallback-err' }
  }
  return { data: fb.data, error: null, source: 'firebird' }
}

// Enfileira uma escrita para reprocessamento posterior.
export async function enqueue({ op, table, id = null, payload = null, motivo = null }) {
  return supabase.from('firebird_outbox').insert([{
    op, fb_table: table, fb_id: id, payload, status: 'pending', motivo,
  }])
}

// Escrita com retry de 409 + fila em caso de indisponibilidade.
// `firebird` retorna { data, error, firebirdDown, status }.
export async function writeThrough({ op, table, id = null, payload = null, firebird, supabaseFallback = null }) {
  if (!firebirdConfig.enabled) {
    if (supabaseFallback) {
      const r = await supabaseFallback()
      return { ...r, source: 'supabase' }
    }
    return { data: null, error: new Error('Firebird desabilitado e sem fallback'), source: 'none' }
  }

  let last = null
  for (let attempt = 0; attempt <= firebirdConfig.retry409; attempt++) {
    const fb = await firebird()
    last = fb

    if (!fb.error) {
      return { data: fb.data, error: null, source: 'firebird', status: fb.status }
    }
    // 409 por chave DUPLICADA = já aplicado no Firebird => idempotente, sucesso.
    if (fb.status === 409 && /existe|duplicat/i.test(fb.error?.message || '')) {
      return { data: fb.data ?? null, error: null, source: 'firebird-dup', status: 409 }
    }
    // 409 = lock do efactor-sync. Só faz sentido re-tentar enquanto houver tentativas.
    if (fb.status === 409 && attempt < firebirdConfig.retry409) {
      await sleep(firebirdConfig.retry409DelayMs)
      continue
    }
    // Fora do ar -> enfileira.
    if (fb.firebirdDown) {
      const { error: enqErr } = await enqueue({ op, table, id, payload, motivo: fb.error?.message })
      return { data: null, error: null, queued: true, enqueueError: enqErr ?? null, source: 'outbox', status: fb.status }
    }
    // Erro de negócio -> devolve.
    return { data: fb.data ?? null, error: fb.error, source: 'firebird', status: fb.status }
  }
  // Esgotou os retries de 409 -> enfileira.
  const { error: enqErr } = await enqueue({ op, table, id, payload, motivo: last?.error?.message })
  return { data: null, error: null, queued: true, enqueueError: enqErr ?? null, source: 'outbox', status: last?.status }
}
