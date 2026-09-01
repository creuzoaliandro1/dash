// smartFrom(table): drop-in para `supabase.from(table)` nas tabelas do Firebird.
//
// Quando firebirdConfig.enabled e o Firebird responde, roteia a query (via proxy)
// para o Firebird. Se o Firebird estiver fora do ar — ou se a query usar um
// operador que o shim não sabe traduzir — cai automaticamente para o Supabase,
// executando EXATAMENTE a mesma query. Com a flag desligada, é 100% Supabase.
//
// Suporta: select, eq, in, range, limit, order, single/maybeSingle, count+head.
// Writes (insert/update/delete) e operadores não suportados => delega ao Supabase.
//
// Limitações da API respeitadas: filtra por igualdade, limit máx 500 por página
// (o shim pagina internamente para honrar range/limit maiores), sem ORDER server
// (ordenação feita no cliente).

import { supabase } from '../lib/supabase'
import { firebirdConfig } from '../config/firebird'
import { firebirdApi } from './firebirdApi'

// Supabase _WEB -> nome real no Firebird.
const NAME_MAP = { OPECAB_WEB: 'OPECABWEB', OPEITE_WEB: 'OPEITEWEB', SACADO_WEB: 'SACADOWEB' }
const ROTEAVEIS = new Set([
  'CEDENTE', 'CTACORRENTE', 'DEBENTURE', 'LANCACTA', 'MENSAGEM', 'NNOPEITE',
  'OCORRENCIA', 'OPECAB', 'OPECABWEB', 'OPEITE', 'OPEITEWEB', 'SACADO', 'SACADOWEB',
  'OPECAB_WEB', 'OPEITE_WEB', 'SACADO_WEB',
])
const API_PAGE = 500
const CONC = 8

class FirebirdDown extends Error {}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length)
  let i = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]) }
  }))
  return out
}

async function fbPage(table, filters, offset, limit) {
  const r = await firebirdApi.list(table, { ...filters, limit, offset })
  if (r.firebirdDown) throw new FirebirdDown()
  if (r.error) throw r.error
  return r.data?.rows ?? []
}

// Todas as linhas que casam com os filtros de igualdade (pagina de 500 em 500).
async function fbFetchAll(table, filters, cap = 400) {
  const out = []
  for (let p = 0; p < cap; p++) {
    const rows = await fbPage(table, filters, p * API_PAGE, API_PAGE)
    out.push(...rows)
    if (rows.length < API_PAGE) break
  }
  return out
}

// Janela [a..b] (offset absoluto), em chunks de 500.
async function fbFetchWindow(table, filters, a, b) {
  const need = b - a + 1
  const out = []
  let off = a
  while (out.length < need) {
    const rows = await fbPage(table, filters, off, API_PAGE)
    out.push(...rows)
    if (rows.length < API_PAGE) break
    off += API_PAGE
  }
  return out.slice(0, need)
}

const cmp = (x, y) => (x == null ? -1 : y == null ? 1 : x < y ? -1 : x > y ? 1 : 0)

class SmartBuilder {
  constructor(table) {
    this.table = table
    this.fbTable = NAME_MAP[table] || table
    this._sel = '*'; this._eq = []; this._in = null
    this._range = null; this._limit = null; this._order = null
    this._single = false; this._count = null; this._head = false
    this._unsupported = false
    this._write = null // {op, payload}
  }
  // ---- leitura ----
  select(cols = '*', opts) { this._sel = cols; if (opts?.count) this._count = opts.count; if (opts?.head) this._head = true; return this }
  eq(c, v) { this._eq.push([c, v]); return this }
  in(c, vals) { this._in = [c, vals || []]; return this }
  range(a, b) { this._range = [a, b]; return this }
  limit(n) { this._limit = n; return this }
  order(c, o) { this._order = [c, (o && o.ascending === false) ? 'desc' : 'asc']; return this }
  single() { this._single = true; return this }
  maybeSingle() { this._single = true; return this }
  // operadores não traduzidos -> força fallback Supabase
  gte() { this._unsupported = true; this._gargs = arguments; return this._passthru('gte', arguments) }
  lte() { return this._passthru('lte', arguments) }
  gt() { return this._passthru('gt', arguments) }
  lt() { return this._passthru('lt', arguments) }
  like() { return this._passthru('like', arguments) }
  ilike() { return this._passthru('ilike', arguments) }
  neq() { return this._passthru('neq', arguments) }
  or() { return this._passthru('or', arguments) }
  not() { return this._passthru('not', arguments) }
  contains() { return this._passthru('contains', arguments) }
  _passthru(op, args) { this._unsupported = true; (this._extra ||= []).push([op, args]); return this }
  // ---- escrita (delega ao Supabase) ----
  insert(rows, opts) { this._write = { m: 'insert', a: [rows, opts] }; return this._sbWrite() }
  update(vals, opts) { this._write = { m: 'update', a: [vals, opts] }; return this._sbWrite() }
  upsert(rows, opts) { this._write = { m: 'upsert', a: [rows, opts] }; return this._sbWrite() }
  delete(opts) { this._write = { m: 'delete', a: [opts] }; return this._sbWrite() }
  _sbWrite() { return supabase.from(this.table)[this._write.m](...this._write.a) }

  // Reconstrói a MESMA query no Supabase (fallback / flag off / não suportado).
  _sb() {
    let q = supabase.from(this.table).select(this._sel, this._count ? { count: this._count, head: this._head } : undefined)
    for (const [c, v] of this._eq) q = q.eq(c, v)
    if (this._in) q = q.in(this._in[0], this._in[1])
    for (const [op, args] of (this._extra || [])) q = q[op](...args)
    if (this._order) q = q.order(this._order[0], { ascending: this._order[1] === 'asc' })
    if (this._range) q = q.range(this._range[0], this._range[1])
    if (this._limit != null) q = q.limit(this._limit)
    if (this._single) q = q.single()
    return q
  }

  async _fb() {
    const base = {}; for (const [c, v] of this._eq) base[c] = v
    let rows
    if (this._in) {
      const [col, vals] = this._in
      if (!vals || vals.length === 0) rows = []
      else rows = [].concat(...await mapLimit(vals, CONC, (v) => fbFetchAll(this.fbTable, { ...base, [col]: v })))
    } else if (this._range && !this._order && !this._count) {
      // Caminho eficiente: janela direta por offset (paginação dos callers).
      const win = await fbFetchWindow(this.fbTable, base, this._range[0], this._range[1])
      return { data: win, error: null }
    } else {
      rows = await fbFetchAll(this.fbTable, base)
    }
    // ordenação client-side
    if (this._order) {
      const [c, dir] = this._order
      rows.sort((a, b) => (dir === 'asc' ? cmp(a[c], b[c]) : cmp(b[c], a[c])))
    } else {
      rows.sort((a, b) => cmp(a._id, b._id)) // estável p/ paginação
    }
    if (this._count && this._head) return { data: null, count: rows.length, error: null }
    if (this._range) rows = rows.slice(this._range[0], this._range[1] + 1)
    else if (this._limit != null) rows = rows.slice(0, this._limit)
    if (this._single) return { data: rows[0] ?? null, error: rows[0] ? null : { code: 'PGRST116', message: 'no rows' } }
    return { data: rows, error: null, count: this._count ? rows.length : undefined }
  }

  async _run() {
    if (this._write) return this._sbWrite()
    if (firebirdConfig.enabled && !this._unsupported) {
      try { return await this._fb() }
      catch (e) {
        if (e instanceof FirebirdDown) { console.warn(`[Firebird] ${this.table} indisponível — Supabase (fallback)`) }
        else { console.warn(`[Firebird] ${this.table} erro no shim, Supabase:`, e?.message) }
      }
    }
    return this._sb()
  }
  then(onF, onR) { return this._run().then(onF, onR) }
  catch(onR) { return this._run().catch(onR) }
}

export function smartFrom(table) {
  if (!ROTEAVEIS.has(table)) return supabase.from(table)
  return new SmartBuilder(table)
}
