import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

const FS = 7

const fmtMoeda = (v) =>
  (parseFloat(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtData = (d) => {
  if (!d) return '—'
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d)
}

const fmtCnpjCpf = (cic) => {
  const d = String(cic || '').replace(/\D/g, '')
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  return cic || ''
}

const cut = (s, n) => {
  const t = String(s || '').toUpperCase()
  return t.length > n ? t.substring(0, n) : t
}

// Texto curto descrevendo os filtros aplicados (vai no cabeçalho do PDF).
function descreverFiltros(f, nomeCedente) {
  const parts = []
  const intervalo = (label, a, b, fmt = fmtData) => {
    if (a && b) parts.push(`${label}: ${fmt(a)} a ${fmt(b)}`)
    else if (a) parts.push(`${label}: a partir de ${fmt(a)}`)
    else if (b) parts.push(`${label}: até ${fmt(b)}`)
  }
  intervalo('Dt. lançamento', f.dtLancaIni, f.dtLancaFim)
  intervalo('Vr. face', f.vrFaceMin, f.vrFaceMax, fmtMoeda)
  intervalo('Vencimento', f.dtVenciIni, f.dtVenciFim)
  intervalo('Venc. novo', f.dtVenciNovoIni, f.dtVenciNovoFim)
  if (f.codOperacao) parts.push(`Operação: ${f.codOperacao}`)
  if (f.codCedente) parts.push(`Cedente: ${f.codCedente}${nomeCedente ? ` - ${nomeCedente}` : ''}`)
  parts.push(`Status: ${(f.status || []).join(', ')}`)
  return parts.join('   ·   ')
}

/**
 * Gera o PDF (A4 retrato) do relatório de borderôs.
 * Agrupa por borderô (cedente + operação) e, dentro dele, por vencimento.
 * @param {Array} rows linhas de getTitulosRelatorioBorderos
 * @param {object} filtros filtros usados (para o cabeçalho)
 * @param {string} [nomeCedente] nome do cedente filtrado, se houver
 * @returns {Blob}
 */
export function generateRelatorioBorderosPDF(rows, filtros, nomeCedente) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const mL = 12
  const mR = pageW - 12
  const contentW = mR - mL

  // ----- Agrupamento: borderô -> vencimento -----
  const borderos = new Map()
  for (const r of rows) {
    const key = `${r.COD_CEDENTE}|${r.COD_OPERACAO}`
    if (!borderos.has(key)) {
      borderos.set(key, { COD_CEDENTE: r.COD_CEDENTE, COD_OPERACAO: r.COD_OPERACAO, NOME_CEDENTE: r.NOME_CEDENTE, itens: [] })
    }
    borderos.get(key).itens.push(r)
  }
  const grupos = [...borderos.values()].sort(
    (a, b) => (a.COD_CEDENTE - b.COD_CEDENTE) || (a.COD_OPERACAO - b.COD_OPERACAO)
  )

  // ----- Colunas -----
  const cols = [
    { h: 'Nº LANÇ.', w: 16, align: 'center' },
    { h: 'DT LANÇA', w: 17, align: 'center' },
    { h: 'TIPO', w: 10, align: 'center' },
    { h: 'SACADO', w: 0, align: 'left' },
    { h: 'CPF/CNPJ', w: 29, align: 'center' },
    { h: 'ST', w: 8, align: 'center' },
    { h: 'VENCIMENTO', w: 19, align: 'center' },
    { h: 'VR FACE', w: 22, align: 'right' },
  ]
  cols[3].w = contentW - cols.reduce((s, c) => s + c.w, 0)
  const nCols = cols.length

  // ----- Corpo: linhas de grupo + títulos + subtotais -----
  const body = []
  const groupRow = (text, fill, bold = true) => [{
    content: text,
    colSpan: nCols,
    styles: { fontStyle: bold ? 'bold' : 'normal', fillColor: fill, halign: 'left' },
  }]
  const totalRow = (label, qtd, valor, fill) => [
    { content: `${label} (${qtd} título${qtd === 1 ? '' : 's'})`, colSpan: nCols - 1, styles: { fontStyle: 'bold', halign: 'right', fillColor: fill } },
    { content: fmtMoeda(valor), styles: { fontStyle: 'bold', halign: 'right', fillColor: fill } },
  ]

  let totalGeral = 0
  for (const g of grupos) {
    const totalBordero = g.itens.reduce((s, t) => s + (parseFloat(t.VR_FACE) || 0), 0)
    totalGeral += totalBordero
    body.push(groupRow(
      `BORDERÔ Nº ${g.COD_OPERACAO}   ·   CEDENTE ${g.COD_CEDENTE}${g.NOME_CEDENTE ? ` - ${cut(g.NOME_CEDENTE, 60)}` : ''}`,
      [215, 215, 215]
    ))

    const porVenc = new Map()
    for (const t of g.itens) {
      const k = t.VENCIMENTO || ''
      if (!porVenc.has(k)) porVenc.set(k, [])
      porVenc.get(k).push(t)
    }
    const vencs = [...porVenc.keys()].sort()
    for (const v of vencs) {
      const itens = porVenc.get(v).sort((a, b) => a.NUM_LANCAMENTO - b.NUM_LANCAMENTO)
      body.push(groupRow(`VENCIMENTO ${fmtData(v)}`, [240, 240, 240]))
      for (const t of itens) {
        body.push([
          String(t.NUM_LANCAMENTO ?? ''),
          fmtData(t.DT_LANCA),
          cut(t.TIPO_TITULO, 4),
          cut(t.NOME_CORRENTISTA || '—', 34),
          fmtCnpjCpf(t.CIC),
          String(t.STATUS || ''),
          `${fmtData(t.VENCIMENTO)}${t.PRORROGADO ? '*' : ''}`,
          fmtMoeda(t.VR_FACE),
        ])
      }
      if (itens.length > 1) {
        const tv = itens.reduce((s, t) => s + (parseFloat(t.VR_FACE) || 0), 0)
        body.push(totalRow(`Subtotal vencimento ${fmtData(v)}`, itens.length, tv, [255, 255, 255]))
      }
    }
    body.push(totalRow(`Total borderô ${g.COD_OPERACAO}`, g.itens.length, totalBordero, [230, 230, 230]))
  }
  body.push(totalRow(`TOTAL GERAL — ${grupos.length} borderô(s)`, rows.length, totalGeral, [200, 200, 200]))

  // ----- Cabeçalho da primeira página -----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('RELATÓRIO DE BORDERÔS', mL, 15)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(FS)
  const agora = new Date()
  doc.text(`Emitido em ${agora.toLocaleDateString('pt-BR')} ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, mR, 15, { align: 'right' })
  const filtrosTxt = doc.splitTextToSize(descreverFiltros(filtros, nomeCedente), contentW)
  doc.text(filtrosTxt, mL, 20)
  let y = 20 + filtrosTxt.length * 3
  doc.text('* vencimento prorrogado (DT_VENCI_NOVO)', mL, y)
  y += 2

  doc.autoTable({
    startY: y,
    head: [cols.map((c) => c.h)],
    body,
    theme: 'plain',
    margin: { left: mL, right: pageW - mR, top: 14, bottom: 14 },
    styles: { font: 'helvetica', fontSize: FS, cellPadding: { top: 0.7, bottom: 0.7, left: 1, right: 1 }, textColor: 20, overflow: 'ellipsize' },
    headStyles: { fontStyle: 'bold', halign: 'center', fillColor: [255, 255, 255], lineWidth: { bottom: 0.3 }, lineColor: [40, 40, 40] },
    columnStyles: cols.reduce((acc, c, i) => { acc[i] = { cellWidth: c.w, halign: c.align }; return acc }, {}),
    showHead: 'everyPage',
    didParseCell: (d) => {
      if (d.section === 'head') d.cell.styles.halign = cols[d.column.index].align === 'left' ? 'left' : 'center'
    },
  })

  // ----- Rodapé com paginação -----
  const total = doc.internal.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(FS)
    doc.setTextColor(110)
    doc.text('Capt — Relatório de Borderôs', mL, pageH - 7)
    doc.text(`Página ${p} de ${total}`, mR, pageH - 7, { align: 'right' })
    doc.setTextColor(0)
  }

  return doc.output('blob')
}
