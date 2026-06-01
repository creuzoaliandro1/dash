import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

// Tamanho de fonte único para TODO o borderô (labels, campos, cabeçalhos).
const FS = 7

// Dados fixos da empresa CONTRATADA (factoring/securitizadora).
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
 * Gera o PDF do borderô (modelo compacto). Fonte única, sem negrito, tudo em MAIÚSCULAS.
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

  // Fonte única, sempre normal (sem negrito)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(FS)

  // Escreve sempre em maiúsculas
  const T = (text, x, yy, opts) => doc.text(String(text ?? '').toUpperCase(), x, yy, opts)
  // Versão em negrito (restaura normal ao final)
  const TB = (text, x, yy, opts) => { doc.setFont('helvetica', 'bold'); doc.text(String(text ?? '').toUpperCase(), x, yy, opts); doc.setFont('helvetica', 'normal') }
  const wBold = (text) => { doc.setFont('helvetica', 'bold'); const w = doc.getTextWidth(String(text ?? '').toUpperCase()); doc.setFont('helvetica', 'normal'); return w }

  const hline = (yy) => {
    doc.setDrawColor(40)
    doc.setLineWidth(0.2)
    doc.line(mL, yy, mR, yy)
  }

  let y = 16

  // ===== Título + DATA na mesma linha =====
  doc.setFontSize(11)
  TB(`BORDERÔ DO ADITIVO    No. ${cabecalho.COD_OPERACAO ?? '—'}`, pageW / 2, y, { align: 'center' })
  doc.setFontSize(FS)
  T(`DATA: ${fmtData(cabecalho.DATA)}`, mR, y, { align: 'right' })
  y += 5
  hline(y)
  y += 6

  // ===== CONTRATANTE / CONTRATADA (label + campo + CNPJ na mesma linha) =====
  const cedenteNome = String(cedente.RAZAO_SOCIAL || cedente.NOME_FANTASIA || '—')
  const cedenteCod = cabecalho.COD_CEDENTE ?? cedente.COD_CEDENTE ?? ''
  const lblContratante = 'CONTRATANTE: '
  TB(lblContratante, mL, y)
  const cedNameX = mL + wBold(lblContratante) + 1
  T(cedenteNome, cedNameX, y)
  T(`CÓDIGO: ${cedenteCod}`, cedNameX + doc.getTextWidth(cedenteNome.toUpperCase()) + 8, y)
  T(`C.N.P.J. ${fmtCnpjCpf(cedente.CIC)}`, mR, y, { align: 'right' })
  y += 6
  const lblContratada = 'CONTRATADA: '
  TB(lblContratada, mL, y)
  T(CONTRATADA.nome, mL + wBold(lblContratada) + 1, y)
  T(`C.N.P.J. ${CONTRATADA.cnpj}`, mR, y, { align: 'right' })
  y += 4
  hline(y)
  y += 5

  // ===== Linha do lote (acima do cabeçalho dos títulos) =====
  const qtd = cabecalho.QTD_TITULOS ?? titulos.length
  const statusPag = String(cabecalho.STATUS_PAGAMENTO || '').trim().toUpperCase()
  const lotePago = statusPag === 'P' ? 'LOTE PAGO' : 'LOTE A PAGAR'
  const loteTxt = `LOTE COM ${qtd} TÍTULO(S) NEGOCIADOS(S) EM ${fmtData(cabecalho.DATA)}`
  T(loteTxt, mL, y)
  T(lotePago, mR, y, { align: 'right' })
  y += 2
  hline(y)
  y += 1

  // ===== Tabela de títulos =====
  // Ordem das colunas (TÍTULO posicionado entre PRZ e VENCIMENTO).
  // bAlign = alinhamento do corpo; o cabeçalho é sempre centralizado.
  const wSacado = contentW - (12 + 36 + 20 + 22 + 8 + 22)
  const cols = [
    { h: 'TIPO', key: 'tipo', w: 12, bAlign: 'center' },
    { h: 'SACADO', key: 'nome', w: wSacado, bAlign: 'left' },
    { h: 'C.N.P.J.', key: 'cic', w: 36, bAlign: 'center' },
    { h: 'TÍTULO', key: 'numero', w: 20, bAlign: 'center' },
    { h: 'VENCIMENTO', key: 'venc', w: 22, bAlign: 'center' },
    { h: 'PRZ', key: 'dias', w: 8, bAlign: 'center' },
    { h: 'FACE', key: 'face', w: 22, bAlign: 'right' },
  ]
  const totalFace = titulos.reduce((s, t) => s + (parseFloat(t.valor) || 0), 0)
  const cellFor = (t, key) => {
    switch (key) {
      case 'tipo': return (t.tipo || 'DUP').toUpperCase()
      case 'numero': return String(t.numero || '—').toUpperCase()
      case 'nome': {
        const nome = String(t.nome || '—').toUpperCase()
        // Limitar a 30 caracteres, sem quebra de linha
        return nome.length > 30 ? nome.substring(0, 30) : nome
      }
      case 'cic': return fmtCnpjCpf(t.cic)
      case 'dias': return (t.dias === '' || t.dias === null || t.dias === undefined) ? '—' : String(t.dias)
      case 'venc': return fmtData(t.vencimento)
      case 'face': return fmtMoeda(t.valor)
      default: return ''
    }
  }

  doc.autoTable({
    startY: y,
    head: [cols.map(c => c.h)],
    body: titulos.map(t => cols.map(c => cellFor(t, c.key))),
    theme: 'plain',
    margin: { left: mL, right: 14 },
    styles: { font: 'helvetica', fontStyle: 'normal', fontSize: FS, cellPadding: { top: 0.8, bottom: 0.8, left: 1, right: 1 }, textColor: 20 },
    headStyles: { fontStyle: 'normal', textColor: 20, halign: 'center', lineWidth: { bottom: 0.2 }, lineColor: [40, 40, 40] },
    bodyStyles: { fontStyle: 'normal' },
    columnStyles: cols.reduce((acc, c, i) => { acc[i] = { cellWidth: c.w }; return acc }, {}),
    didParseCell: (d) => {
      // Cabeçalho sempre centralizado; corpo segue o bAlign da coluna
      if (d.section === 'head') d.cell.styles.halign = 'center'
      else if (d.section === 'body') d.cell.styles.halign = cols[d.column.index].bAlign
    },
  })
  y = doc.lastAutoTable.finalY + 1
  hline(y)
  y += 5.5

  // ===== Resumo (abaixo da tabela): PRAZO MÉDIO e TOTAL =====
  // O valor do PZ MÉDIO fica centralizado exatamente sob a coluna PRZ da tabela
  const przIdx = cols.findIndex(c => c.key === 'dias')
  const xPrzStart = mL + cols.slice(0, przIdx).reduce((s, c) => s + c.w, 0)
  const wPrz = cols[przIdx].w
  const xPrzCenter = xPrzStart + wPrz / 2
  T('PZ MÉDIO', xPrzStart - 2, y, { align: 'right' })
  T(fmtPrazo(cabecalho.PRAZO_MEDIO), xPrzCenter, y, { align: 'center' })
  TB(`TOTAL: ${fmtMoeda(totalFace)}`, mR, y, { align: 'right' })
  y += 2.5
  hline(y)
  y += 5.5

  // ===== Deduções (linha única; LÍQUIDO à direita) =====
  const dedItems = [
    ['DESÁGIO', cabecalho.VR_DESAGIO],
    ['AD VALOREM', cabecalho.VR_ADVALOREM],
    ['ISS', cabecalho.VR_ISS],
    ['CPMF', cabecalho.VR_CPMF],
    ['IOF', cabecalho.VR_IOF],
    ['COBRANÇA', cabecalho.VR_COBRANCA],
  ]
  // LÍQUIDO fica à direita; os demais itens são distribuídos uniformemente à esquerda
  const liqTxt = `LÍQUIDO: ${fmtMoeda(cabecalho.VR_LIQUIDO)}`.toUpperCase()
  const liqLeft = mR - wBold(liqTxt)
  const flow = ['DEDUÇÕES:', ...dedItems.map(([l, v]) => `${l}: ${fmtMoeda(v)}`.toUpperCase())]
  const flowW = flow.map(s => doc.getTextWidth(s))
  const sumW = flowW.reduce((a, b) => a + b, 0)
  const avail = (liqLeft - 3) - mL          // espaço útil antes do LÍQUIDO
  let gap = (avail - sumW) / flow.length     // folga distribuída
  if (gap < 1.5) gap = 1.5
  let dx = mL
  flow.forEach((s, i) => { T(s, dx, y); dx += flowW[i] + gap })
  TB(liqTxt, mR, y, { align: 'right' })
  y += 2.5
  hline(y)

  // ===== Assinaturas =====
  let sy = y + 16
  if (sy > pageH - 24) sy = pageH - 24
  const lineY = sy // altura (mm, do topo) das linhas de assinatura — varia conforme nº de títulos
  const sigW = 88
  const leftCenter = mL + sigW / 2
  const rightCenter = mR - sigW / 2
  doc.setDrawColor(40)
  doc.setLineWidth(0.2)
  doc.line(mL, sy, mL + sigW, sy)
  doc.line(mR - sigW, sy, mR, sy)
  // Âncoras invisíveis (ZapSign) — assinaturas posicionadas ACIMA das linhas
  doc.setTextColor(255, 255, 255)
  doc.text('<<cedente>>', leftCenter, sy - 9, { align: 'center' })
  doc.text('<<capt>>', rightCenter, sy - 9, { align: 'center' })
  doc.setTextColor(20, 20, 20)
  sy += 4.5
  T(String(cedente.RAZAO_SOCIAL || '—'), leftCenter, sy, { align: 'center' })
  T(CONTRATADA.nome, rightCenter, sy, { align: 'center' })
  sy += 4.5
  T(`C.N.P.J. ${fmtCnpjCpf(cedente.CIC)}`, leftCenter, sy, { align: 'center' })
  T(`C.N.P.J. ${CONTRATADA.cnpj}`, rightCenter, sy, { align: 'center' })

  // Retorna o blob e a altura da linha de assinatura (para posicionar a assinatura ZapSign acima dela).
  return { blob: doc.output('blob'), signatureLineY: lineY, pageHeight: pageH }
}
