// Cruzamento OPEITE x capt_registrado (Sincronizar · Ações).
//
// Gera os 7 conjuntos usados no relatório Excel e na tela "Sincronizar":
//   1. OPEITE          — TIPO_TITULO = DUP, vencimento (DT_VENCI ou DT_VENCI_NOVO) de hoje em diante,
//                         STATUS diferente de DC e CO; ordem vencimento, valor.
//   2. capt_registrado — status_ret diferente de Pago e Cancelado (vazio entra).
//   3. OPEITE + capt   — CIC idêntico + mesmo valor + mesmo vencimento
//                         (DT_VENCI ou DT_VENCI_NOVO = dt_venc_tit). Pareamento 1:1.
//   4. OPEITE sem correspondência em capt_registrado (sobras do 1).
//   5. capt_registrado sem correspondência em OPEITE (sobras do 2).
//   6. Sobras com mesmo CIC e mesmo valor, mas datas divergentes (1:1, data mais próxima).
//   7. Sobras com mesmo CIC e mesma data, mas valores divergentes (1:1, valor mais próximo).
//
// CIC: compara só os dígitos e exige igualdade exata (sem completar zeros à esquerda).

import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const iso = (d) => (d ? String(d).slice(0, 10) : '')
const cents = (v) => Math.round((parseFloat(v) || 0) * 100)
const dig = (v) => String(v ?? '').replace(/\D/g, '')
const dias = (a, b) => {
  const x = Date.parse(iso(a) + 'T00:00:00Z'), y = Date.parse(iso(b) + 'T00:00:00Z')
  return isNaN(x) || isNaN(y) ? Infinity : Math.abs(x - y) / 86400000
}
const up = (v) => String(v ?? '').trim().toUpperCase()
const cmpStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

// ---------- Colunas de cada visão ----------
const C = {
  lanc: { key: 'lanc', label: 'Nº Lançamento (OPEITE.NUM_LANCAMENTO)', type: 'int' },
  titulo: { key: 'titulo', label: 'Nº Título (OPEITE.NUM_TITULO)', type: 'text' },
  dtVenci: { key: 'dtVenci', label: 'Dt Venci', type: 'date' },
  dtNovo: { key: 'dtNovo', label: 'Dt Novo', type: 'date' },
  vrFace: { key: 'vrFace', label: 'Vr Face', type: 'money' },
  nome: { key: 'nome', label: 'Nome Sacado', type: 'text' },
  cic: { key: 'cic', label: 'CIC Sacado', type: 'text' },
  numDoc: { key: 'numDoc', label: 'Nº Documento (capt.numero_documento)', type: 'text' },
  dtVencTit: { key: 'dtVencTit', label: 'Dt Venc Tít', type: 'date' },
  vlrTit: { key: 'vlrTit', label: 'Vlr Tít', type: 'money' },
  pagador: { key: 'pagador', label: 'Nome/Razão Pagador', type: 'text' },
  cnpjCpf: { key: 'cnpjCpf', label: 'CNPJ/CPF Pagador', type: 'text' },
  dtVencCapt: { key: 'dtVencCapt', label: 'Dt Venc Tít (capt)', type: 'date' },
  vlrTitCapt: { key: 'vlrTitCapt', label: 'Vlr Tít (capt)', type: 'money' },
  numDocTit: { key: 'numDocTit', label: 'Nº Doc Tít (capt.num_doc_tit)', type: 'text' },
  numDocCapt: { key: 'numDocCapt', label: 'Nº Documento (capt.numero_documento)', type: 'text' },
  correntista: { key: 'nome', label: 'Nome Correntista', type: 'text' },
  cicPar: { key: 'cic', label: 'CIC', type: 'text' },
}
const COLS_OPEITE = [C.lanc, C.titulo, C.dtVenci, C.dtNovo, C.vrFace, C.nome, C.cic]
const COLS_CAPT = [C.numDoc, C.dtVencTit, C.vlrTit, C.pagador, C.cnpjCpf]

export const CRUZ_VIEWS = [
  { key: 't1', n: 1, label: 'OPEITE', sheet: '1 OPEITE', desc: 'TIPO_TITULO = DUP · vencimento de hoje em diante · STATUS ≠ DC/CO', cols: COLS_OPEITE },
  { key: 't2', n: 2, label: 'capt_registrado', sheet: '2 capt_registrado', desc: 'status_ret ≠ Pago/Cancelado', cols: COLS_CAPT },
  { key: 't3', n: 3, label: 'OPEITE + capt_registrado', sheet: '3 OPEITE+capt', desc: 'CIC, valor e vencimento iguais', cols: [C.lanc, C.titulo, C.numDocCapt, C.dtVenci, C.dtNovo, C.dtVencCapt, C.vrFace, C.vlrTitCapt, C.correntista, C.cicPar] },
  { key: 't4', n: 4, label: 'OPEITE sem capt_registrado', sheet: '4 OPEITE sem capt', desc: 'Não encontrados em capt_registrado', cols: COLS_OPEITE },
  { key: 't5', n: 5, label: 'capt_registrado sem OPEITE', sheet: '5 capt sem OPEITE', desc: 'Não encontrados em OPEITE', cols: COLS_CAPT },
  { key: 't6', n: 6, label: 'Mesmo CIC e valor · datas divergentes', sheet: '6 Datas divergentes', desc: 'Entre os não encontrados', cols: [C.lanc, C.titulo, C.numDocCapt, C.dtVenci, C.dtNovo, C.dtVencCapt, C.vrFace, C.vlrTitCapt, C.cicPar] },
  { key: 't7', n: 7, label: 'Mesmo CIC e data · valores divergentes', sheet: '7 Valores divergentes', desc: 'Entre os não encontrados', cols: [C.lanc, C.titulo, C.numDocCapt, C.numDocTit, C.dtVenci, C.dtNovo, C.dtVencCapt, C.vrFace, C.vlrTitCapt, C.cicPar] },
]

// ---------- Cálculo ----------
// opeite: [{ NUM_LANCAMENTO, NUM_TITULO, TIPO_TITULO, DT_VENCI, DT_VENCI_NOVO, VR_FACE, STATUS, nome, cic }]
// capt:   [{ id, numero_documento, num_doc_tit, dt_venc_tit, vlr_tit, nom_rz_soc_pagdr, cnpj_cpf_pagdr, status_ret }]
export function calcularCruzamento({ opeite, capt, hoje }) {
  const t1 = opeite
    .filter((o) => {
      const st = up(o.STATUS)
      if (st === 'DC' || st === 'CO') return false
      if (up(o.TIPO_TITULO) !== 'DUP') return false
      return iso(o.DT_VENCI) >= hoje || iso(o.DT_VENCI_NOVO) >= hoje
    })
    .map((o, i) => ({
      id: `o:${o.NUM_LANCAMENTO ?? ''}:${i}`,
      lanc: o.NUM_LANCAMENTO,
      titulo: String(o.NUM_TITULO ?? '').trim(),
      dtVenci: iso(o.DT_VENCI),
      dtNovo: iso(o.DT_VENCI_NOVO),
      vrFace: parseFloat(o.VR_FACE) || 0,
      nome: String(o.nome ?? '').trim(),
      cic: dig(o.cic),
    }))
    .sort((a, b) => cmpStr(a.dtVenci, b.dtVenci) || a.vrFace - b.vrFace || (parseInt(a.lanc) || 0) - (parseInt(b.lanc) || 0))

  const t2 = capt
    .filter((c) => { const s = up(c.status_ret); return s !== 'PAGO' && s !== 'CANCELADO' })
    .map((c) => ({
      id: `c:${c.id}`,
      numDoc: String(c.numero_documento ?? '').trim(),
      numDocTit: String(c.num_doc_tit ?? '').trim(),
      dtVencTit: iso(c.dt_venc_tit),
      vlrTit: parseFloat(c.vlr_tit) || 0,
      pagador: String(c.nom_rz_soc_pagdr ?? '').trim(),
      cnpjCpf: dig(c.cnpj_cpf_pagdr),
    }))
    .sort((a, b) => cmpStr(a.dtVencTit, b.dtVencTit) || a.vlrTit - b.vlrTit)

  const par = (o, c) => ({
    id: `${o.id}|${c.id}`,
    lanc: o.lanc, titulo: o.titulo, dtVenci: o.dtVenci, dtNovo: o.dtNovo,
    dtVencCapt: c.dtVencTit, vrFace: o.vrFace, vlrTitCapt: c.vlrTit,
    numDocCapt: c.numDoc, numDocTit: c.numDocTit, nome: o.nome || c.pagador, cic: o.cic,
  })

  // 3) CIC + valor + vencimento (DT_VENCI, depois DT_VENCI_NOVO)
  const idx = new Map()
  for (const c of t2) {
    if (!c.cnpjCpf || !c.dtVencTit) continue
    const k = `${c.cnpjCpf}|${cents(c.vlrTit)}|${c.dtVencTit}`
    if (!idx.has(k)) idx.set(k, [])
    idx.get(k).push(c)
  }
  const usadoO = new Set(), usadoC = new Set()
  const t3 = []
  for (const o of t1) {
    if (!o.cic) continue
    for (const d of [o.dtVenci, o.dtNovo]) {
      if (!d) continue
      const lista = idx.get(`${o.cic}|${cents(o.vrFace)}|${d}`)
      const c = lista && lista.find((x) => !usadoC.has(x.id))
      if (c) { usadoO.add(o.id); usadoC.add(c.id); t3.push(par(o, c)); break }
    }
  }
  const t4 = t1.filter((o) => !usadoO.has(o.id))
  const t5 = t2.filter((c) => !usadoC.has(c.id))

  const porCic = new Map()
  for (const c of t5) {
    if (!c.cnpjCpf) continue
    if (!porCic.has(c.cnpjCpf)) porCic.set(c.cnpjCpf, [])
    porCic.get(c.cnpjCpf).push(c)
  }

  // 6) mesmo CIC + mesmo valor, datas diferentes — 1:1 pela data mais próxima
  const t6 = [], usado6 = new Set()
  for (const o of t4) {
    const ref = o.dtNovo || o.dtVenci
    let melhor = null, dist = Infinity
    for (const c of porCic.get(o.cic) || []) {
      if (usado6.has(c.id) || cents(c.vlrTit) !== cents(o.vrFace)) continue
      if (c.dtVencTit === o.dtVenci || c.dtVencTit === o.dtNovo) continue
      const dd = dias(ref, c.dtVencTit)
      if (dd < dist) { dist = dd; melhor = c }
    }
    if (melhor) { usado6.add(melhor.id); t6.push(par(o, melhor)) }
  }

  // 7) mesmo CIC + mesma data, valores diferentes — 1:1 pelo valor mais próximo
  const t7 = [], usado7 = new Set()
  for (const o of t4) {
    let melhor = null, dist = Infinity
    for (const c of porCic.get(o.cic) || []) {
      if (usado7.has(c.id) || cents(c.vlrTit) === cents(o.vrFace)) continue
      if (!c.dtVencTit || (c.dtVencTit !== o.dtVenci && c.dtVencTit !== o.dtNovo)) continue
      const dv = Math.abs(cents(c.vlrTit) - cents(o.vrFace))
      if (dv < dist) { dist = dv; melhor = c }
    }
    if (melhor) { usado7.add(melhor.id); t7.push(par(o, melhor)) }
  }

  return { t1, t2, t3, t4, t5, t6, t7 }
}

// ---------- Datas divergentes (tela Sincronizar) ----------
// Títulos de capt_registrado cujo vencimento difere do esperado pela OPEITE.
// Data esperada = DT_VENCI_NOVO quando preenchida; senão DT_VENCI. Não depende
// do STATUS da OPEITE (não precisa ser PR). Cruza por CIC + valor:
//   1) CIC + valor + data esperada iguais -> correto, fica fora da relação (1:1);
//   2) entre as sobras, mesmo CIC + valor com data diferente -> entra na relação
//      (1:1; prefere o capt já vinculado ao lançamento, depois o que ainda está no
//      DT_VENCI antigo, depois a data mais próxima).
// Um capt já vinculado a OUTRO lançamento (num_lanca) nunca é pareado: evita cruzar
// parcelas de mesmo valor do mesmo sacado.
// Só considera capt_registrado ativo no banco (situação A Vencer/Vencido, não devolvido).
// opeite: mesmo formato de calcularCruzamento; capt: + situacao_boleto, status, identd_nosso_num, num_lanca.
export const VIEW_DATAS = {
  key: 'datas', n: 1, label: 'Datas divergentes', sheet: 'Datas divergentes',
  desc: 'capt_registrado com vencimento diferente do esperado na OPEITE (Dt Novo; se vazio, Dt Venci) · mesmo CIC e valor',
  cols: [
    C.lanc, C.titulo,
    { key: 'status', label: 'Status OPEITE', type: 'text' },
    { key: 'nosso', label: 'Nosso Número', type: 'text' },
    C.numDocCapt, C.dtVenci, C.dtNovo, C.dtVencCapt, C.vrFace, C.correntista, C.cicPar,
  ],
}

export function calcularDatasDivergentes({ opeite, capt }) {
  const os = opeite.map((o, i) => {
    const dtVenci = iso(o.DT_VENCI), dtNovo = iso(o.DT_VENCI_NOVO)
    return {
      id: `o:${o.NUM_LANCAMENTO ?? ''}:${i}`,
      lanc: o.NUM_LANCAMENTO,
      titulo: String(o.NUM_TITULO ?? '').trim(),
      status: up(o.STATUS),
      dtVenci, dtNovo, esperado: dtNovo || dtVenci,
      vrFace: parseFloat(o.VR_FACE) || 0,
      nome: String(o.nome ?? '').trim(),
      cic: dig(o.cic),
    }
  }).filter((o) => o.cic && o.esperado)

  const porCicValor = new Map()
  for (const c of capt) {
    const sit = String(c.situacao_boleto ?? '').trim().toLowerCase()
    if (sit !== 'a vencer' && sit !== 'vencido') continue
    if (String(c.status ?? '').trim().toLowerCase() === 'devolvido') continue
    const cic = dig(c.cnpj_cpf_pagdr), dt = iso(c.dt_venc_tit)
    if (!cic || !dt) continue
    const k = `${cic}|${cents(c.vlr_tit)}`
    if (!porCicValor.has(k)) porCicValor.set(k, [])
    porCicValor.get(k).push({
      id: `c:${c.id}`, dt,
      lanc: c.num_lanca == null || c.num_lanca === '' ? null : String(c.num_lanca),
      numDoc: String(c.numero_documento ?? '').trim(),
      nosso: String(c.identd_nosso_num ?? '').trim(),
      pagador: String(c.nom_rz_soc_pagdr ?? '').trim(),
    })
  }

  const usadoC = new Set()
  const livres = (o) => (porCicValor.get(`${o.cic}|${cents(o.vrFace)}`) || [])
    .filter((c) => !usadoC.has(c.id) && (c.lanc == null || c.lanc === String(o.lanc)))
    .sort((a, b) => (b.lanc != null) - (a.lanc != null))

  // 1) data esperada já confere -> correto
  const sobras = []
  for (const o of os) {
    const c = livres(o).find((x) => x.dt === o.esperado)
    if (c) usadoC.add(c.id)
    else sobras.push(o)
  }

  // 2) mesmo CIC + valor, data diferente
  const linha = (o, c) => ({
    id: `${o.id}|${c.id}`,
    lanc: o.lanc, titulo: o.titulo, status: o.status, nosso: c.nosso, numDocCapt: c.numDoc,
    dtVenci: o.dtVenci, dtNovo: o.dtNovo, dtVencCapt: c.dt,
    vrFace: o.vrFace, nome: o.nome || c.pagador, cic: o.cic,
  })
  const out = [], resto = []
  for (const o of sobras) {
    const l = livres(o)
    const c = l.find((x) => x.lanc != null) || (o.dtNovo ? l.find((x) => x.dt === o.dtVenci) : null)
    if (c) { usadoC.add(c.id); out.push(linha(o, c)) }
    else resto.push(o)
  }
  for (const o of resto) {
    let melhor = null, dist = Infinity
    for (const c of livres(o)) {
      const dd = dias(o.esperado, c.dt)
      if (dd < dist) { dist = dd; melhor = c }
    }
    if (melhor) { usadoC.add(melhor.id); out.push(linha(o, melhor)) }
  }
  return out.sort((a, b) => cmpStr(a.dtNovo || a.dtVenci, b.dtNovo || b.dtVenci) || (parseInt(a.lanc) || 0) - (parseInt(b.lanc) || 0))
}

// ---------- Formatação ----------
export const fmtCel = (v, type) => {
  if (v == null || v === '') return ''
  if (type === 'date') { const [a, m, d] = String(v).split('-'); return a && m && d ? `${d}/${m}/${a}` : String(v) }
  if (type === 'money') return (parseFloat(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return String(v)
}

// Planilha com números/datas reais (datas como serial Excel, sem fuso).
function montarAba(cols, rows) {
  const aoa = [cols.map((c) => c.label)]
  for (const r of rows) {
    aoa.push(cols.map((c) => {
      const v = r[c.key]
      if (v == null || v === '') return ''
      if (c.type === 'money') return parseFloat(v) || 0
      if (c.type === 'int') return parseInt(v) || String(v)
      if (c.type === 'date') {
        const [a, m, d] = String(v).split('-').map(Number)
        return a && m && d ? (Date.UTC(a, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000 : String(v)
      }
      return String(v)
    }))
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  for (let i = 1; i < aoa.length; i++) {
    cols.forEach((c, j) => {
      const cell = ws[XLSX.utils.encode_cell({ r: i, c: j })]
      if (!cell || cell.t !== 'n') return
      if (c.type === 'date') cell.z = 'dd/mm/yyyy'
      else if (c.type === 'money') cell.z = '#,##0.00'
    })
  }
  ws['!cols'] = cols.map((c) => ({ wch: c.type === 'date' ? 12 : c.type === 'money' ? 14 : c.key === 'nome' || c.key === 'pagador' ? 38 : Math.max(18, c.label.length + 2) }))
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(aoa.length - 1, 0), c: cols.length - 1 } }) }
  return ws
}

// Relatório completo: 7 abas.
export function exportarCruzamentoExcel(res, nomeArquivo) {
  const wb = XLSX.utils.book_new()
  for (const v of CRUZ_VIEWS) XLSX.utils.book_append_sheet(wb, montarAba(v.cols, res[v.key] || []), v.sheet)
  XLSX.writeFile(wb, nomeArquivo)
}

// Uma visão (registros selecionados) em Excel.
export function exportarVisaoExcel(view, rows, nomeArquivo) {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, montarAba(view.cols, rows), view.sheet)
  XLSX.writeFile(wb, nomeArquivo)
}

// Uma visão (registros selecionados) em PDF.
export function exportarVisaoPdf(view, rows, nomeArquivo) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  doc.setFontSize(11); doc.setFont(undefined, 'bold')
  doc.text(`Sincronizar — ${view.n}. ${view.label}`, 14, 13)
  doc.setFont(undefined, 'normal'); doc.setFontSize(8)
  const total = view.cols.find((c) => c.type === 'money')
  const soma = total ? rows.reduce((s, r) => s + (parseFloat(r[total.key]) || 0), 0) : null
  doc.text(`${view.desc} · Registros: ${rows.length}${soma != null ? ` · Total ${total.label}: ${fmtCel(soma, 'money')}` : ''} · Emitido em ${new Date().toLocaleString('pt-BR')}`, 14, 19)
  const columnStyles = {}
  view.cols.forEach((c, i) => { if (c.type === 'money' || c.type === 'int') columnStyles[i] = { halign: 'right' } })
  autoTable(doc, {
    startY: 24,
    margin: { left: 14, right: 10 },
    head: [view.cols.map((c) => c.label)],
    body: rows.map((r) => view.cols.map((c) => fmtCel(r[c.key], c.type))),
    styles: { fontSize: 7, cellPadding: 1, overflow: 'linebreak', textColor: [0, 0, 0], lineColor: [200, 200, 200], lineWidth: 0.1 },
    headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles,
    theme: 'grid',
  })
  doc.save(nomeArquivo)
}
