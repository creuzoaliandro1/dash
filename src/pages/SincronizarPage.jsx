import { useState, useRef, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { smartFrom } from '../services/firebirdQuery'
import { firebirdConfig } from '../config/firebird'

// Sincronizar (Operações · Master): TODA a OPEITE (sem paginar, exceto STATUS='DC'),
// lida do Firebird (com fallback Supabase). Colunas:
// LANC · Nosso Número · Documento · Valor · Vencimento · Nome · CIC · Linha Digitável.
// Nosso Número e Linha Digitável vêm de capt_registrado, cruzando OPEITE x
// capt_registrado por valor+vencimento+cic (identd_nosso_num / num_linha_digtvl).
// O filtro de vencimento já inicia em HOJE para reduzir o volume enriquecido.

const API_PAGE = 500
const hojeISO = () => new Date().toISOString().slice(0, 10)

const fmtValor = (v) => (parseFloat(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtData = (d) => {
  if (!d) return ''
  const s = String(d).slice(0, 10)
  const [a, m, dia] = s.split('-')
  return a && m && dia ? `${dia}/${m}/${a}` : s
}

const _cents = (v) => Math.round((parseFloat(v) || 0) * 100)
const _iso = (d) => (d ? String(d).slice(0, 10) : '')
const _dig = (v) => String(v ?? '').replace(/\D/g, '')
const chaveVVC = (valor, venc, cic) => `${_cents(valor)}|${_iso(venc)}|${_dig(cic)}`

// capt_registrado indexada por valor+venc+cic -> { nosso, linha }
async function carregarRegIndex() {
  const idx = {}
  let from = 0
  const ps = 1000
  while (true) {
    const { data, error } = await supabase
      .from('capt_registrado')
      .select('vlr_tit, dt_venc_tit, cnpj_cpf_pagdr, identd_nosso_num, num_linha_digtvl')
      .range(from, from + ps - 1)
    if (error || !data || data.length === 0) break
    data.forEach((r) => {
      const k = chaveVVC(r.vlr_tit, r.dt_venc_tit, r.cnpj_cpf_pagdr)
      if (!(k in idx)) idx[k] = { nosso: r.identd_nosso_num ?? '', linha: r.num_linha_digtvl ?? '' }
    })
    if (data.length < ps) break
    from += ps
  }
  return idx
}

export default function SincronizarPage() {
  const [rawRows, setRawRows] = useState([])       // toda a OPEITE (menos DC), cru
  const [displayRows, setDisplayRows] = useState([]) // subconjunto filtrado + enriquecido
  const [loading, setLoading] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [erro, setErro] = useState(null)
  const [showFiltro, setShowFiltro] = useState(false)
  const F0 = { vencDe: hojeISO(), vencAte: '', lancaDe: '', lancaAte: '', numDe: '', numAte: '', debitavel: false }
  const [f, setF] = useState(F0)
  const [sort, setSort] = useState({ col: 'lanc', dir: 'desc' })
  const toggleSort = (c) => setSort((x) => x.col === c ? { col: c, dir: x.dir === 'asc' ? 'desc' : 'asc' } : { col: c, dir: 'asc' })
  const sacadoCache = useRef({})
  const regIdx = useRef({})

  // Carga inicial: índice do capt_registrado + TODA a OPEITE (menos DC).
  useEffect(() => {
    let cancel = false
    ;(async () => {
      setLoading(true); setErro(null); setProgresso(0)
      try {
        regIdx.current = await carregarRegIndex()
        const todas = []
        for (let p = 0; p < 600; p++) {
          const { data, error } = await smartFrom('OPEITE')
            .select('NUM_LANCAMENTO, NUM_TITULO, VR_FACE, DT_VENCI, DT_LANCA, COD_SACADO, STATUS')
            .range(p * API_PAGE, p * API_PAGE + API_PAGE - 1)
          if (error) throw error
          const lote = data || []
          for (const o of lote) {
            if (String(o.STATUS || '').trim().toUpperCase() !== 'DC') todas.push(o)
          }
          if (!cancel) setProgresso(todas.length)
          if (lote.length < API_PAGE) break
        }
        if (!cancel) setRawRows(todas)
      } catch (e) {
        if (!cancel) setErro(e?.message || String(e))
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => { cancel = true }
  }, [])

  // Pré-filtro (vencimento/lançamento/nº) sobre o cru — não precisa de enriquecimento.
  const preFiltrados = useMemo(() => {
    const dstr = (d) => (d ? String(d).slice(0, 10) : '')
    return rawRows.filter((o) => {
      const v = dstr(o.DT_VENCI), l = dstr(o.DT_LANCA), n = parseInt(o.NUM_LANCAMENTO)
      if (f.vencDe && v < f.vencDe) return false
      if (f.vencAte && v > f.vencAte) return false
      if (f.lancaDe && l < f.lancaDe) return false
      if (f.lancaAte && l > f.lancaAte) return false
      if (f.numDe !== '' && !(n >= parseInt(f.numDe))) return false
      if (f.numAte !== '' && !(n <= parseInt(f.numAte))) return false
      return true
    })
  }, [rawRows, f.vencDe, f.vencAte, f.lancaDe, f.lancaAte, f.numDe, f.numAte])

  // Enriquece só o pré-filtrado: nome/CIC (SACADO) + nosso número/linha (capt_registrado).
  useEffect(() => {
    let cancel = false
    ;(async () => {
      if (rawRows.length === 0) { setDisplayRows([]); return }
      setEnriching(true)
      try {
        const cods = [...new Set(preFiltrados.map((o) => o.COD_SACADO)
          .filter((v) => v != null && !(v in sacadoCache.current)))]
        if (cods.length) {
          const { data: sac } = await smartFrom('SACADO')
            .select('COD_SACADO, NOME_CORRENTISTA, CIC').in('COD_SACADO', cods)
          ;(sac || []).forEach((s) => { sacadoCache.current[s.COD_SACADO] = { nome: s.NOME_CORRENTISTA, cic: s.CIC } })
          cods.forEach((c) => { if (!(c in sacadoCache.current)) sacadoCache.current[c] = { nome: '', cic: '' } })
        }
        if (cancel) return
        const enr = preFiltrados.map((o) => {
          const cic = sacadoCache.current[o.COD_SACADO]?.cic || ''
          const reg = regIdx.current[chaveVVC(o.VR_FACE, o.DT_VENCI, cic)]
          return {
            lanc: o.NUM_LANCAMENTO,
            nosso: reg?.nosso || '',
            doc: o.NUM_TITULO || '',
            valor: o.VR_FACE,
            venc: o.DT_VENCI,
            lanca: o.DT_LANCA,
            nome: sacadoCache.current[o.COD_SACADO]?.nome || '',
            cic,
            linha: reg?.linha || '',
            temCodigo: !!reg,
          }
        })
        if (!cancel) setDisplayRows(enr)
      } finally {
        if (!cancel) setEnriching(false)
      }
    })()
    return () => { cancel = true }
  }, [preFiltrados])

  // Debitável (desmarcado = só os sem linha digitável) + ordenação.
  const rowsFiltrados = displayRows.filter((r) => (f.debitavel ? true : !r.temCodigo))
  const numCols = new Set(['lanc', 'valor'])
  const rowsOrdenados = [...rowsFiltrados].sort((a, b) => {
    const c = sort.col
    let r
    if (numCols.has(c)) r = (parseFloat(a[c]) || 0) - (parseFloat(b[c]) || 0)
    else r = String(a[c] || '').localeCompare(String(b[c] || ''))
    return sort.dir === 'asc' ? r : -r
  })
  const arrow = (c) => (sort.col === c ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '')

  const th = 'text-left px-3 py-2 font-semibold text-[#a3a3a3] uppercase text-xs whitespace-nowrap'
  const td = 'px-3 py-2 whitespace-nowrap border-t border-[#1f1f1f]'
  const thc = 'cursor-pointer select-none hover:text-white'

  return (
    <div className="text-white">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold">Sincronizar</h1>
          <p className="text-sm text-[#a3a3a3]">
            OPEITE (exceto STATUS DC) ·{' '}
            {firebirdConfig.enabled
              ? <span className="text-green-400">Firebird</span>
              : <span className="text-yellow-400">Supabase (Firebird desativado)</span>}
            {loading && <span className="text-[#666666]"> · carregando {progresso} registros…</span>}
            {!loading && <span className="text-[#666666]"> · {rawRows.length} carregados · {rowsOrdenados.length} exibidos</span>}
            {enriching && <span className="text-[#666666]"> · buscando nomes…</span>}
          </p>
        </div>
        <button
          onClick={() => setShowFiltro((x) => !x)}
          className={`px-3 py-2 rounded border text-sm ${showFiltro ? 'bg-white text-black border-white' : 'bg-[#1a1a1a] border-[#2a2a2a] hover:bg-[#222]'}`}
        >Filtro</button>
      </div>

      {erro && <div className="mb-3 text-sm text-red-400">Erro: {erro}</div>}

      {showFiltro && (
        <div className="mb-4 p-4 bg-[#111111] border border-[#1f1f1f] rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <label className="block text-xs text-[#666666] uppercase mb-1">Vencimento (DT_VENCI)</label>
            <div className="flex gap-2">
              <input type="date" value={f.vencDe} onChange={(e) => setF({ ...f, vencDe: e.target.value })} className="bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-1 w-full" />
              <input type="date" value={f.vencAte} onChange={(e) => setF({ ...f, vencAte: e.target.value })} className="bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-1 w-full" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#666666] uppercase mb-1">Lançamento (DT_LANCA)</label>
            <div className="flex gap-2">
              <input type="date" value={f.lancaDe} onChange={(e) => setF({ ...f, lancaDe: e.target.value })} className="bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-1 w-full" />
              <input type="date" value={f.lancaAte} onChange={(e) => setF({ ...f, lancaAte: e.target.value })} className="bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-1 w-full" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#666666] uppercase mb-1">Nº Lançamento (intervalo)</label>
            <div className="flex gap-2">
              <input type="number" placeholder="de" value={f.numDe} onChange={(e) => setF({ ...f, numDe: e.target.value })} className="bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-1 w-full" />
              <input type="number" placeholder="até" value={f.numAte} onChange={(e) => setF({ ...f, numAte: e.target.value })} className="bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-1 w-full" />
            </div>
          </div>
          <div className="sm:col-span-3 flex items-center justify-between">
            <label className="flex items-center gap-2 text-[#a3a3a3]">
              <input type="checkbox" checked={f.debitavel} onChange={(e) => setF({ ...f, debitavel: e.target.checked })} />
              Debitável <span className="text-[#666666]">(desmarcado = só sem linha digitável)</span>
            </label>
            <button onClick={() => setF(F0)} className="px-3 py-1 rounded bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222]">Limpar</button>
          </div>
        </div>
      )}

      <div className="overflow-auto max-h-[70vh] border border-[#1f1f1f] rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-[#111111] sticky top-0 z-10">
            <tr>
              <th className={`${th} ${thc}`} onClick={() => toggleSort('lanc')}>LANC{arrow('lanc')}</th>
              <th className={`${th} ${thc}`} onClick={() => toggleSort('nosso')}>Nosso Número{arrow('nosso')}</th>
              <th className={`${th} ${thc}`} onClick={() => toggleSort('doc')}>Documento{arrow('doc')}</th>
              <th className={`${th} text-right ${thc}`} onClick={() => toggleSort('valor')}>Valor{arrow('valor')}</th>
              <th className={`${th} ${thc}`} onClick={() => toggleSort('venc')}>Vencimento{arrow('venc')}</th>
              <th className={`${th} ${thc}`} onClick={() => toggleSort('nome')}>Nome{arrow('nome')}</th>
              <th className={`${th} ${thc}`} onClick={() => toggleSort('cic')}>CIC{arrow('cic')}</th>
              <th className={`${th} ${thc}`} onClick={() => toggleSort('linha')}>Linha Digitável{arrow('linha')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td className={td} colSpan={8}>Carregando OPEITE do Firebird… {progresso} registros</td></tr>
            )}
            {!loading && rowsOrdenados.length === 0 && (
              <tr><td className={td} colSpan={8}>Nenhum registro para o filtro atual.</td></tr>
            )}
            {!loading && rowsOrdenados.map((r, i) => (
              <tr key={`${r.lanc}-${i}`} className="hover:bg-[#0d0d0d]">
                <td className={td}>{r.lanc}</td>
                <td className={td}>{r.nosso}</td>
                <td className={td}>{r.doc}</td>
                <td className={`${td} text-right`}>{fmtValor(r.valor)}</td>
                <td className={td}>{fmtData(r.venc)}</td>
                <td className={td}>{r.nome}</td>
                <td className={td}>{r.cic}</td>
                <td className={td}>{r.linha}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
