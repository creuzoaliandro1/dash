import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import { totaisPorCedente, corrigidoOuValor, nomeRelatorio, statusSelecionados, agruparTitulos } from '../services/relatorioInadimplenciaService'

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
  if (f.codOperacao) parts.push(`Borderô: ${f.codOperacao}`)
  intervalo('Vencimento', f.dtVenciIni, f.dtVenciFim)
  intervalo('Valor', f.vrFaceMin, f.vrFaceMax, fmtMoeda)
  intervalo('Emissão', f.dtEmissaoIni, f.dtEmissaoFim)
  parts.push(`Tipos: ${(f.tipos || []).join(', ')}`)
  parts.push(`Status: ${statusSelecionados(f).join(', ')}`)
  return parts.join('   ·   ')
}

/**
 * PDF (A4 retrato) com os títulos inadimplentes selecionados, na ordem da tela.
 * agrupamento 'cedente' | 'sacado': cabeçalho e subtotal por grupo.
 * Com cedente "Todos" (e sem agrupar por cedente), inclui ao final o somatório por cedente.
 * @returns {Blob}
 */
export function generateRelatorioInadimplenciaPDF(rows, filtros, nomeCedente, agrupamento = 'nenhum') {
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

  const linha = (t) => [
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
  ]
  const total = rows.reduce((s, t) => s + t.VR_FACE, 0)
  const totalCorrigido = rows.reduce((s, t) => s + corrigidoOuValor(t), 0)
  const totStyle = { fontStyle: 'bold', halign: 'right', fillColor: [255, 255, 255], lineWidth: { top: 0.3 }, lineColor: [0, 0, 0] }

  const agrupado = agrupamento === 'cedente' || agrupamento === 'sacado'
  const body = []
  if (!agrupado) {
    rows.forEach((t) => body.push(linha(t)))
  } else {
    const grpStyle = { fontStyle: 'bold', halign: 'left', fillColor: [235, 235, 235] }
    const subStyle = { fontStyle: 'bold', halign: 'right', fillColor: [255, 255, 255], lineWidth: { top: 0.1 }, lineColor: [120, 120, 120] }
    for (const g of agruparTitulos(rows, agrupamento)) {
      const rotulo = agrupamento === 'cedente'
        ? `CEDENTE ${g.cod} - ${cut(g.nome || '—', 70)}`
        : `SACADO: ${cut(g.nome || '(sem sacado)', 70)}${g.cic ? `   ${fmtCnpjCpf(g.cic)}` : ''}`
      body.push([{ content: rotulo, colSpan: nCols, styles: grpStyle }])
      g.rows.forEach((t) => body.push(linha(t)))
      body.push([
        { content: `SUBTOTAL (${g.qtd} título${g.qtd === 1 ? '' : 's'})`, colSpan: nCols - 2, styles: subStyle },
        { content: fmtMoeda(g.total), styles: subStyle },
        { content: fmtMoeda(g.corrigido), styles: subStyle },
      ])
    }
  }
  body.push([
    { content: `TOTAL (${rows.length} título${rows.length === 1 ? '' : 's'})`, colSpan: nCols - 2, styles: totStyle },
    { content: fmtMoeda(total), styles: totStyle },
    { content: fmtMoeda(totalCorrigido), styles: totStyle },
  ])

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(`RELATÓRIO DE ${nomeRelatorio(filtros).toUpperCase()}`, mL, 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(FS)
  const agora = new Date()
  doc.text(`Emitido em ${agora.toLocaleDateString('pt-BR')} ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, mR, 14, { align: 'right' })
  const descAgrup = agrupamento === 'cedente' ? '   ·   Agrupado por cedente' : agrupamento === 'sacado' ? '   ·   Agrupado por sacado' : ''
  const filtrosTxt = doc.splitTextToSize(descreverFiltros(filtros, nomeCedente) + descAgrup, contentW)
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

  // Somatório por cedente quando o filtro é "Todos" (dispensado se já agrupado por cedente)
  if (!filtros.codCedente && agrupamento !== 'cedente') {
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
  doc.text(`RELATÓRIO DE ${nomeRelatorio(filtros).toUpperCase()} TOTAL`, mL, 14)
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

/**
 * PDF (A4 retrato) da Análise dos sacados de um borderô: por sacado, títulos DO/PR
 * e IN detalhados com subtotal, e os CO só em total (pagos até / após o vencimento).
 * @param {Array} sacados linhas de getAnaliseSacados() + somaAVencer/somaIN
 * @returns {Blob}
 */
export function generateAnaliseSacadosPDF(sacados, filtros, nomeCedente) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const mL = 10
  const mR = pageW - 10
  const contentW = mR - mL

  const cols = [
    { h: 'CED.', w: 12, align: 'center' },
    { h: 'OPER.', w: 11, align: 'center' },
    { h: 'Nº TÍTULO', w: 0, align: 'left' },
    { h: 'TIPO', w: 9, align: 'center' },
    { h: 'STATUS', w: 11, align: 'center' },
    { h: 'EMISSÃO', w: 16, align: 'center' },
    { h: 'VENC.', w: 17, align: 'center' },
    { h: 'DIAS', w: 10, align: 'center' },
    { h: 'VALOR', w: 22, align: 'right' },
    { h: 'CORRIGIDO', w: 22, align: 'right' },
  ]
  cols[2].w = contentW - cols.reduce((s, c) => s + c.w, 0)
  const nCols = cols.length

  const sacStyle = { fontStyle: 'bold', halign: 'left', fillColor: [225, 225, 225] }
  const secStyle = { fontStyle: 'bold', halign: 'left', fillColor: [255, 255, 255], textColor: 60 }
  const subStyle = { fontStyle: 'bold', halign: 'right', fillColor: [255, 255, 255], lineWidth: { top: 0.1 }, lineColor: [120, 120, 120] }
  const coStyle = { halign: 'left', fillColor: [255, 255, 255] }
  const coVal = { fontStyle: 'bold', halign: 'right', fillColor: [255, 255, 255] }

  const body = []
  const secao = (titulo, rows, soma) => {
    body.push([{ content: titulo, colSpan: nCols, styles: secStyle }])
    if (rows.length === 0) body.push([{ content: 'Nenhum título', colSpan: nCols, styles: { textColor: 120 } }])
    rows.forEach((t) => body.push([
      `${t.DO_BORDERO ? '> ' : ''}${t.COD_CEDENTE ?? ''}`,
      String(t.COD_OPERACAO ?? ''),
      String(t.NUM_TITULO || ''),
      cut(t.TIPO_TITULO, 4),
      String(t.STATUS || ''),
      fmtData(t.DT_LANCA),
      `${fmtData(t.VENCIMENTO)}${t.PRORROGADO ? '*' : ''}`,
      String(t.DIAS_ATRASO ?? ''),
      fmtMoeda(t.VR_FACE),
      t.VR_CORRIGIDO == null ? '—' : fmtMoeda(t.VR_CORRIGIDO),
    ]))
    body.push([
      { content: `SUBTOTAL (${soma.qtd} título${soma.qtd === 1 ? '' : 's'})`, colSpan: nCols - 2, styles: subStyle },
      { content: fmtMoeda(soma.total), styles: subStyle },
      { content: fmtMoeda(soma.corrigido), styles: subStyle },
    ])
  }
  const resumoCO = (titulo, r) => body.push([
    { content: `${titulo} — ${r.qtd} título${r.qtd === 1 ? '' : 's'}`, colSpan: nCols - 2, styles: coStyle },
    { content: fmtMoeda(r.total), styles: coVal },
    { content: '', styles: coStyle },
  ])

  for (const s of sacados) {
    body.push([{ content: `SACADO: ${cut(s.NOME_SACADO || '(sem nome)', 70)}${s.CIC_SACADO ? `   ${fmtCnpjCpf(s.CIC_SACADO)}` : ''}`, colSpan: nCols, styles: sacStyle }])
    secao('A VENCER / RESPONSABILIDADE (DO, PR)', s.aVencer, s.somaAVencer)
    if (s.inadimplentes.length > 0) secao('INADIMPLÊNCIA (IN)', s.inadimplentes, s.somaIN)
    resumoCO('PAGOS ATÉ O VENCIMENTO (CO)', s.coEmDia)
    resumoCO('PAGOS APÓS O VENCIMENTO (CO)', s.coAtraso)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('ANÁLISE DE SACADOS', mL, 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(FS)
  const agora = new Date()
  doc.text(`Emitido em ${agora.toLocaleDateString('pt-BR')} ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, mR, 14, { align: 'right' })
  const desc = [
    `Cedente: ${filtros.codCedente}${nomeCedente ? ` - ${nomeCedente}` : ''}`,
    `Borderô: ${filtros.codOperacao}`,
    `Tipos: ${(filtros.tipos || []).join(', ')}`,
    `${sacados.length} sacado(s) — todos os títulos de cada sacado, em todos os cedentes`,
  ].join('   ·   ')
  const filtrosTxt = doc.splitTextToSize(desc, contentW)
  doc.text(filtrosTxt, mL, 19)
  const y = 19 + filtrosTxt.length * 3 - 1

  doc.autoTable({
    theme: 'plain',
    margin: { left: mL, right: pageW - mR, top: 12, bottom: 14 },
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

  let fy = doc.lastAutoTable.finalY + 5
  if (fy > doc.internal.pageSize.getHeight() - 12) { doc.addPage(); fy = 16 }
  doc.setFontSize(FS - 0.5)
  doc.text('> título deste borderô.  * vencimento prorrogado.  CO em dia = pago (DT_OCORRE) até o vencimento; vencimento em sábado/domingo vale até a segunda-feira.', mL, fy)

  return doc.output('blob')
}
