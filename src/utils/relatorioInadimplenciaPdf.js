import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import { totaisPorCedente, corrigidoOuValor } from '../services/relatorioInadimplenciaService'

const FS = 6.5

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

function descreverFiltros(f, nomeCedente) {
  const parts = []
  const intervalo = (label, a, b, fmt = fmtData) => {
    if (a && b) parts.push(`${label}: ${fmt(a)} a ${fmt(b)}`)
    else if (a) parts.push(`${label}: a partir de ${fmt(a)}`)
    else if (b) parts.push(`${label}: até ${fmt(b)}`)
  }
  parts.push(f.codCedente ? `Cedente: ${f.codCedente}${nomeCedente ? ` - ${nomeCedente}` : ''}` : 'Cedente: Todos')
  intervalo('Vencimento', f.dtVenciIni, f.dtVenciFim)
  intervalo('Valor', f.vrFaceMin, f.vrFaceMax, fmtMoeda)
  intervalo('Emissão', f.dtEmissaoIni, f.dtEmissaoFim)
  parts.push(`Tipos: ${(f.tipos || []).join(', ')}`)
  return parts.join('   ·   ')
}

/**
 * PDF (A4 retrato) com os títulos inadimplentes selecionados, na ordem da tela.
 * Com cedente "Todos", inclui ao final o somatório por cedente.
 * @returns {Blob}
 */
export function generateRelatorioInadimplenciaPDF(rows, filtros, nomeCedente) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const mL = 10
  const mR = pageW - 10
  const contentW = mR - mL

  const SACADO = 4 // índice da coluna que absorve a largura restante
  const cols = [
    { h: 'OPER.', w: 10, align: 'center' },
    { h: 'Nº LANÇ.', w: 12, align: 'center' },
    { h: 'Nº TÍTULO', w: 17, align: 'left' },
    { h: 'TIPO', w: 8, align: 'center' },
    { h: 'SACADO', w: 0, align: 'left' },
    { h: 'CPF/CNPJ', w: 25, align: 'center' },
    { h: 'EMISSÃO', w: 14, align: 'center' },
    { h: 'VENC.', w: 15, align: 'center' },
    { h: 'DIAS', w: 9, align: 'center' },
    { h: 'VALOR', w: 18, align: 'right' },
    { h: 'CORRIGIDO', w: 19, align: 'right' },
  ]
  cols[SACADO].w = contentW - cols.reduce((s, c) => s + c.w, 0)
  const nCols = cols.length

  const body = rows.map((t) => [
    String(t.COD_OPERACAO ?? ''),
    String(t.NUM_LANCAMENTO ?? ''),
    String(t.NUM_TITULO || ''),
    cut(t.TIPO_TITULO, 4),
    cut(t.NOME_SACADO || '—', 40),
    fmtCnpjCpf(t.CIC_SACADO),
    fmtData(t.DT_LANCA),
    `${fmtData(t.VENCIMENTO)}${t.PRORROGADO ? '*' : ''}`,
    String(t.DIAS_ATRASO ?? ''),
    fmtMoeda(t.VR_FACE),
    t.VR_CORRIGIDO == null ? '—' : fmtMoeda(t.VR_CORRIGIDO),
  ])
  const total = rows.reduce((s, t) => s + t.VR_FACE, 0)
  const totalCorrigido = rows.reduce((s, t) => s + corrigidoOuValor(t), 0)
  const totStyle = { fontStyle: 'bold', halign: 'right', fillColor: [215, 215, 215] }
  body.push([
    { content: `TOTAL (${rows.length} título${rows.length === 1 ? '' : 's'})`, colSpan: nCols - 2, styles: totStyle },
    { content: fmtMoeda(total), styles: totStyle },
    { content: fmtMoeda(totalCorrigido), styles: totStyle },
  ])

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('RELATÓRIO DE INADIMPLÊNCIA', mL, 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(FS)
  const agora = new Date()
  doc.text(`Emitido em ${agora.toLocaleDateString('pt-BR')} ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, mR, 14, { align: 'right' })
  const filtrosTxt = doc.splitTextToSize(descreverFiltros(filtros, nomeCedente), contentW)
  doc.text(filtrosTxt, mL, 19)
  let y = 19 + filtrosTxt.length * 3
  doc.text('* vencimento prorrogado (DT_VENCI_NOVO)   ·   Dias = dias de atraso até hoje', mL, y)
  y += 3
  doc.text('Corrigido = saldo × (1 + taxa)^(dias/30); taxa % a.m. de OPEITE.TAXA_OCORRE ou, se vazia, CEDENTE.TAXA_OCORRENCIA', mL, y)
  y += 2

  const tableStyles = {
    theme: 'plain',
    margin: { left: mL, right: pageW - mR, top: 12, bottom: 12 },
    styles: { font: 'helvetica', fontSize: FS, cellPadding: { top: 0.7, bottom: 0.7, left: 1, right: 1 }, textColor: 20, overflow: 'ellipsize' },
    headStyles: { fontStyle: 'bold', halign: 'center', fillColor: [255, 255, 255], lineWidth: { bottom: 0.3 }, lineColor: [40, 40, 40] },
    showHead: 'everyPage',
  }

  doc.autoTable({
    ...tableStyles,
    startY: y,
    head: [cols.map((c) => c.h)],
    body,
    columnStyles: cols.reduce((acc, c, i) => { acc[i] = { cellWidth: c.w, halign: c.align }; return acc }, {}),
    didParseCell: (d) => {
      if (d.section === 'head') d.cell.styles.halign = cols[d.column.index].align === 'left' ? 'left' : 'center'
    },
  })

  // Somatório por cedente quando o filtro é "Todos"
  if (!filtros.codCedente) {
    const grupos = totaisPorCedente(rows)
    let sy = doc.lastAutoTable.finalY + 8
    if (sy > pageH - 30) { doc.addPage(); sy = 16 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('SOMATÓRIO POR CEDENTE', mL, sy)
    doc.autoTable({
      ...tableStyles,
      startY: sy + 2,
      tableWidth: contentW,
      head: [['CÓD.', 'CEDENTE', 'QTD', 'TOTAL', 'CORRIGIDO']],
      body: [
        ...grupos.map((g) => [String(g.COD_CEDENTE), cut(g.NOME_CEDENTE, 60), String(g.qtd), fmtMoeda(g.total), fmtMoeda(g.corrigido)]),
        [
          { content: 'TOTAL GERAL', colSpan: 2, styles: totStyle },
          { content: String(rows.length), styles: { ...totStyle, halign: 'center' } },
          { content: fmtMoeda(total), styles: totStyle },
          { content: fmtMoeda(totalCorrigido), styles: totStyle },
        ],
      ],
      columnStyles: {
        0: { cellWidth: 14, halign: 'center' },
        1: { cellWidth: contentW - 14 - 16 - 30 - 30, halign: 'left' },
        2: { cellWidth: 16, halign: 'center' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 30, halign: 'right' },
      },
    })
  }

  const nPag = doc.internal.getNumberOfPages()
  for (let p = 1; p <= nPag; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(FS)
    doc.setTextColor(110)
    doc.text('Capt — Relatório de Inadimplência', mL, pageH - 6)
    doc.text(`Página ${p} de ${nPag}`, mR, pageH - 6, { align: 'right' })
    doc.setTextColor(0)
  }

  return doc.output('blob')
}
