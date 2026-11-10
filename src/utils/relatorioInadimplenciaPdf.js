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

  const SACADO = 5 // índice da coluna que absorve a largura restante
  const cols = [
    { h: 'CED.', w: 9, align: 'center' },
    { h: 'OPER.', w: 10, align: 'center' },
    { h: 'Nº LANÇ.', w: 13, align: 'center' },
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
    String(t.COD_CEDENTE ?? ''),
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
  const totStyle = { fontStyle: 'bold', halign: 'right', fillColor: [255, 255, 255], lineWidth: { top: 0.3 }, lineColor: [0, 0, 0] }
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
  const y = 19 + filtrosTxt.length * 3 - 1

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

  return doc.output('blob')
}

/**
 * PDF (A4 retrato) da inadimplência total por cedente — mesmo padrão do relatório
 * de títulos, mas cada linha é um cedente com o total inadimplente dele.
 * @param {Array} grupos linhas de totaisPorCedente() (só os cedentes marcados)
 * @returns {Blob}
 */
export function generateInadimplenciaTotalPDF(grupos, filtros) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const mL = 10
  const mR = pageW - 10
  const contentW = mR - mL

  const CEDENTE = 1 // coluna que absorve a largura restante
  const cols = [
    { h: 'CÓD.', w: 14, align: 'center' },
    { h: 'CEDENTE', w: 0, align: 'left' },
    { h: 'QTD TÍTULOS', w: 20, align: 'center' },
    { h: 'VALOR', w: 28, align: 'right' },
    { h: 'CORRIGIDO', w: 28, align: 'right' },
  ]
  cols[CEDENTE].w = contentW - cols.reduce((s, c) => s + c.w, 0)

  const qtd = grupos.reduce((s, g) => s + g.qtd, 0)
  const total = grupos.reduce((s, g) => s + g.total, 0)
  const totalCorrigido = grupos.reduce((s, g) => s + g.corrigido, 0)
  const totStyle = { fontStyle: 'bold', halign: 'right', fillColor: [255, 255, 255], lineWidth: { top: 0.3 }, lineColor: [0, 0, 0] }
  const body = grupos.map((g) => [
    String(g.COD_CEDENTE),
    cut(g.NOME_CEDENTE || '—', 70),
    String(g.qtd),
    fmtMoeda(g.total),
    fmtMoeda(g.corrigido),
  ])
  body.push([
    { content: `TOTAL (${grupos.length} cedente${grupos.length === 1 ? '' : 's'})`, colSpan: 2, styles: totStyle },
    { content: String(qtd), styles: { ...totStyle, halign: 'center' } },
    { content: fmtMoeda(total), styles: totStyle },
    { content: fmtMoeda(totalCorrigido), styles: totStyle },
  ])

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('RELATÓRIO DE INADIMPLÊNCIA TOTAL', mL, 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(FS)
  const agora = new Date()
  doc.text(`Emitido em ${agora.toLocaleDateString('pt-BR')} ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, mR, 14, { align: 'right' })
  const filtrosTxt = doc.splitTextToSize(descreverFiltros(filtros, ''), contentW)
  doc.text(filtrosTxt, mL, 19)
  const y = 19 + filtrosTxt.length * 3 - 1

  doc.autoTable({
    theme: 'plain',
    margin: { left: mL, right: pageW - mR, top: 12, bottom: 12 },
    styles: { font: 'helvetica', fontSize: FS, cellPadding: { top: 0.7, bottom: 0.7, left: 1, right: 1 }, textColor: 20, overflow: 'ellipsize' },
    headStyles: { fontStyle: 'bold', halign: 'center', fillColor: [255, 255, 255], lineWidth: { bottom: 0.3 }, lineColor: [40, 40, 40] },
    showHead: 'everyPage',
    startY: y,
    head: [cols.map((c) => c.h)],
    body,
    columnStyles: cols.reduce((acc, c, i) => { acc[i] = { cellWidth: c.w, halign: c.align }; return acc }, {}),
    didParseCell: (d) => {
      if (d.section === 'head') d.cell.styles.halign = cols[d.column.index].align === 'left' ? 'left' : 'center'
    },
  })

  return doc.output('blob')
}
