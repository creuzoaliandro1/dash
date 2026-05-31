import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

// Dados fixos da empresa CONTRATADA (factoring/securitizadora).
// Ajuste aqui caso a razão social / CNPJ mudem.
const CONTRATADA = {
  nome: 'CAPT Administração de Pagamentos Ltda',
  cnpj: '08.035.579/0001-30',
}

// --- Helpers de formatação ---
const fmtMoeda = (v) => {
  const n = parseFloat(v) || 0
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const fmtData = (d) => {
  if (!d) return '—'
  const s = String(d).trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (m) return `${m[1]}/${m[2]}/${m[3]}`
  return s
}

const fmtPrazo = (v) => {
  if (v === null || v === undefined || v === '') return '—'
  return String(v).replace('.', ',')
}

const fmtCnpjCpf = (cic) => {
  const d = String(cic || '').replace(/\D/g, '')
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  return cic || ''
}

/**
 * Gera o PDF do borderô seguindo o modelo compacto (uma operação).
 * @param {{cedente:object, cabecalho:object, titulos:Array}} bordero
 * @returns {Blob}
 */
export function generateBorderoPDF(bordero) {
  const { cedente, cabecalho, titulos } = bordero
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const mL = 14
  const mR = pageW - 14
  const contentW = mR - mL

  const hline = (yy) => {
    doc.setDrawColor(40)
    doc.setLineWidth(0.2)
    doc.line(mL, yy, mR, yy)
  }

  let y = 16

  // ===== Título =====
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(`BORDERÔ DO ADITIVO    No. ${cabecalho.COD_OPERACAO ?? '—'}`, pageW / 2, y, { align: 'center' })
  y += 5
  hline(y)
  y += 6

  // ===== CONTRATANTE / CONTRATADA =====
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.text('CONTRATANTE', mL, y)
  doc.text(`DATA: ${fmtData(cabecalho.DATA)}`, mR, y, { align: 'right' })
  y += 5.5
  doc.setFont('helvetica', 'bold')
  const cedenteLabel = `${cabecalho.COD_CEDENTE ?? cedente.COD_CEDENTE ?? ''} - ${String(cedente.RAZAO_SOCIAL || cedente.NOME_FANTASIA || '—')}`
  doc.text(cedenteLabel, mL, y)
  doc.text(`C.N.P.J. ${fmtCnpjCpf(cedente.CIC)}`, mR, y, { align: 'right' })
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.text('CONTRATADA', mL, y)
  y += 5.5
  doc.setFont('helvetica', 'bold')
  doc.text(CONTRATADA.nome, mL, y)
  doc.text(`C.N.P.J. ${CONTRATADA.cnpj}`, mR, y, { align: 'right' })
  y += 4
  hline(y)
  y += 1

  // ===== Tabela de títulos =====
  // Larguras de coluna (somam contentW = 182)
  const wTipo = 14, wTitulo = 22, wCnpj = 34, wPrz = 12, wVenc = 26, wFace = 22
  const wSacado = contentW - (wTipo + wTitulo + wCnpj + wPrz + wVenc + wFace)
  const totalFace = titulos.reduce((s, t) => s + (parseFloat(t.valor) || 0), 0)

  doc.autoTable({
    startY: y,
    head: [['Tipo', 'Título', 'Sacado', 'C.N.P.J.', 'Prz', 'Vencimento', 'Face']],
    body: titulos.map(t => [
      t.tipo || 'DUP',
      t.numero || '—',
      t.nome || '—',
      fmtCnpjCpf(t.cic),
      (t.dias === '' || t.dias === null || t.dias === undefined) ? '—' : String(t.dias),
      fmtData(t.vencimento),
      fmtMoeda(t.valor),
    ]),
    theme: 'plain',
    margin: { left: mL, right: 14 },
    styles: { fontSize: 9, cellPadding: { top: 1.3, bottom: 1.3, left: 1, right: 1 }, textColor: 20 },
    headStyles: { fontStyle: 'normal', textColor: 110, halign: 'left', lineWidth: { bottom: 0.2 }, lineColor: [40, 40, 40] },
    columnStyles: {
      0: { cellWidth: wTipo },
      1: { cellWidth: wTitulo },
      2: { cellWidth: wSacado },
      3: { cellWidth: wCnpj, halign: 'left' },
      4: { cellWidth: wPrz, halign: 'center' },
      5: { cellWidth: wVenc, halign: 'center' },
      6: { cellWidth: wFace, halign: 'right' },
    },
  })
  y = doc.lastAutoTable.finalY + 1
  hline(y)
  y += 5.5

  // ===== Resumo do lote =====
  const qtd = cabecalho.QTD_TITULOS ?? titulos.length
  const statusPag = String(cabecalho.STATUS_PAGAMENTO || '').trim().toUpperCase()
  const lotePago = statusPag === 'P' ? 'LOTE PAGO' : 'LOTE A PAGAR'
  // Âncoras alinhadas às colunas da tabela
  const xCnpj = mL + wTipo + wTitulo + wSacado          // início da coluna C.N.P.J.
  const xPrz = xCnpj + wCnpj                            // início Prz/Vencimento
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const loteTxt = `LOTE COM ${qtd} TÍTULO(S) NEGOCIADOS(S) EM ${fmtData(cabecalho.DATA)}`
  doc.text(loteTxt, mL, y)
  const xLote = Math.max(xCnpj, mL + doc.getTextWidth(loteTxt) + 5)
  doc.text(lotePago, xLote, y)
  doc.text(`PZ MÉDIO ${fmtPrazo(cabecalho.PRAZO_MEDIO)}`, xPrz, y)
  doc.setFont('helvetica', 'bold')
  doc.text(`TOTAL: ${fmtMoeda(totalFace)}`, mR, y, { align: 'right' })
  y += 2.5
  hline(y)
  y += 5.5

  // ===== Deduções (linha única, fluindo da esquerda; LÍQUIDO à direita) =====
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const dedItems = [
    ['DESÁGIO', cabecalho.VR_DESAGIO],
    ['AD VALOREM', cabecalho.VR_ADVALOREM],
    ['ISS', cabecalho.VR_ISS],
    ['CPMF', cabecalho.VR_CPMF],
    ['IOF', cabecalho.VR_IOF],
    ['COBRANÇA', cabecalho.VR_COBRANCA],
  ]
  let dx = mL
  doc.text('DEDUÇÕES:', dx, y)
  dx += doc.getTextWidth('DEDUÇÕES:') + 3
  dedItems.forEach(([label, val]) => {
    const s = `${label}: ${fmtMoeda(val)}`
    doc.text(s, dx, y)
    dx += doc.getTextWidth(s) + 4
  })
  doc.setFont('helvetica', 'bold')
  doc.text(`LÍQUIDO: ${fmtMoeda(cabecalho.VR_LIQUIDO)}`, mR, y, { align: 'right' })
  y += 2.5
  hline(y)

  // ===== Assinaturas =====
  let sy = y + 34
  if (sy > pageH - 24) sy = pageH - 24
  const sigW = 80
  const leftCenter = mL + sigW / 2
  const rightCenter = mR - sigW / 2
  doc.setDrawColor(40)
  doc.setLineWidth(0.2)
  doc.line(mL, sy, mL + sigW, sy)
  doc.line(mR - sigW, sy, mR, sy)
  sy += 4.5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(String(cedente.RAZAO_SOCIAL || '—'), leftCenter, sy, { align: 'center' })
  doc.text(CONTRATADA.nome, rightCenter, sy, { align: 'center' })
  sy += 4.5
  doc.setFontSize(8.5)
  doc.text(`C.N.P.J. ${fmtCnpjCpf(cedente.CIC)}`, leftCenter, sy, { align: 'center' })
  doc.text(`C.N.P.J. ${CONTRATADA.cnpj}`, rightCenter, sy, { align: 'cent