import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import { dcSaldo } from '../services/relatorioContaCorrenteService'

const FS = 7

const fmtValor = (v) =>
  Math.abs(parseFloat(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtData = (d) => {
  const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

/**
 * Extrato de conta corrente (A4 retrato), no layout do extrato do sistema:
 * cabeçalho, saldo anterior, lançamentos com saldo acumulado, saldo bloqueado
 * e lançamentos futuros.
 * @param {object} extrato retorno de getExtratoContaCorrente
 * @param {object} info { nomeCedente, dtIni }
 * @returns {Blob}
 */
export function generateExtratoContaCorrentePDF(extrato, { nomeCedente, dtIni }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const mL = 7
  const mR = pageW - 7
  const contentW = mR - mL

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('CAPT PAY', mL, 13)
  doc.setFontSize(10)
  doc.text('Extrato conta-corrente', pageW / 2, 19, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(FS)
  doc.text(`A partir de ${fmtData(dtIni)}`, pageW / 2, 23, { align: 'center' })
  doc.setFont('helvetica', 'bold')
  doc.text(`Cedente : ${String(nomeCedente || '').toUpperCase()}`, mL, 29)

  const base = {
    theme: 'plain',
    margin: { left: mL, right: pageW - mR, top: 12, bottom: 14 },
    styles: { font: 'helvetica', fontSize: FS, cellPadding: { top: 0.7, bottom: 0.7, left: 1, right: 1 }, textColor: 20, overflow: 'linebreak' },
    headStyles: { fontStyle: 'bold', fillColor: [255, 255, 255], lineWidth: { bottom: 0.3 }, lineColor: [40, 40, 40] },
    showHead: 'everyPage',
  }

  // Lançamentos: Data | Valor | D/C | Histórico | Saldo | C/D
  const W = { data: 18, valor: 22, dc: 5, saldo: 22 }
  const hist = contentW - W.data - W.valor - W.dc - W.saldo - W.dc
  const body = [
    [fmtData(extrato.dtSaldoAnterior), '', '', 'Saldo anterior', fmtValor(extrato.saldoAnterior), dcSaldo(extrato.saldoAnterior)],
    ...extrato.lancamentos.map((l) => [fmtData(l.DATA), fmtValor(l.VALOR), l.DC, l.HISTORICO, fmtValor(l.SALDO), dcSaldo(l.SALDO)]),
  ]
  doc.autoTable({
    ...base,
    startY: 31,
    head: [['Data', 'Valor', '', 'Histórico', 'Saldo', '']],
    body,
    columnStyles: {
      0: { cellWidth: W.data },
      1: { cellWidth: W.valor, halign: 'right' },
      2: { cellWidth: W.dc, halign: 'center' },
      3: { cellWidth: hist },
      4: { cellWidth: W.saldo, halign: 'right' },
      5: { cellWidth: W.dc, halign: 'center' },
    },
    didParseCell: (d) => {
      if (d.section === 'head' && (d.column.index === 1 || d.column.index === 4)) d.cell.styles.halign = 'right'
    },
  })

  // Saldo bloqueado
  let y = doc.lastAutoTable.finalY + 6
  if (y > pageH - 40) { doc.addPage(); y = 16 }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(FS)
  doc.text('SALDO BLOQUEADO', mR - W.saldo - W.dc - 4, y, { align: 'right' })
  doc.text(fmtValor(extrato.saldoBloqueado), mR - W.dc - 1, y, { align: 'right' })
  doc.text(dcSaldo(extrato.saldoBloqueado, 'C'), mR - W.dc / 2, y, { align: 'center' })

  // Lançamentos futuros
  y += 9
  doc.setFontSize(10)
  doc.text('Lançamentos Futuro', pageW / 2, y, { align: 'center' })
  doc.autoTable({
    ...base,
    startY: y + 2,
    head: [['Data', 'Valor', '', 'Histórico']],
    body: extrato.futuros.length
      ? extrato.futuros.map((l) => [fmtData(l.DATA), fmtValor(l.VALOR), l.DC, l.HISTORICO])
      : [[{ content: 'Nenhum lançamento futuro.', colSpan: 4, styles: { textColor: 110 } }]],
    columnStyles: {
      0: { cellWidth: W.data },
      1: { cellWidth: W.valor, halign: 'right' },
      2: { cellWidth: W.dc, halign: 'center' },
      3: { cellWidth: contentW - W.data - W.valor - W.dc },
    },
    didParseCell: (d) => {
      if (d.section === 'head' && d.column.index === 1) d.cell.styles.halign = 'right'
    },
  })

  // Rodapé como no extrato do sistema
  const agora = new Date()
  const emissao = `${agora.toLocaleDateString('pt-BR')} ${agora.toLocaleTimeString('pt-BR')}`
  const nPag = doc.internal.getNumberOfPages()
  for (let p = 1; p <= nPag; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(FS)
    doc.text('SISTEMA GESTOR DE FACTORING', mL, pageH - 8)
    doc.text(emissao, pageW / 2 + 40, pageH - 8, { align: 'center' })
    doc.text(`Página ${p}`, mR, pageH - 8, { align: 'right' })
  }

  return doc.output('blob')
}
