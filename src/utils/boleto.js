import { jsPDF } from 'jspdf'
import JsBarcode from 'jsbarcode'

// Formatador de moeda
const formatMoeda = (value) => {
  if (value === undefined || value === null) return '0,00'
  const num = typeof value === 'string'
    ? parseFloat(value.replace(/\./g, '').replace(',', '.'))
    : value
  if (isNaN(num)) return '0,00'
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// Formatador de datas
const formatDate = (date) => {
  if (!date) return ''

  if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = date.split('-')
    return `${day}/${month}/${year}`
  }

  const d = new Date(date)
  if (isNaN(d.getTime())) {
    if (typeof date === 'string') {
      const parts = date.split('-')
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
    return String(date)
  }
  return d.toLocaleDateString('pt-BR')
}

// Valor para barcode (10 dígitos em centavos)
const getValorForBarcode = (value) => {
  let num = 0
  if (typeof value === 'number') {
    num = value
  } else if (typeof value === 'string') {
    const normalized = value.replace(/\./g, '').replace(',', '.')
    num = parseFloat(normalized)
  }
  if (isNaN(num)) return '0000000000'
  return num.toFixed(2).replace('.', '').padStart(10, '0')
}

// Modulo 10
const modulo10 = (numero) => {
  let soma = 0
  let peso = 2
  for (let i = numero.length - 1; i >= 0; i--) {
    let termo = parseInt(numero.charAt(i)) * peso
    if (termo > 9) termo = termo - 9
    soma += termo
    peso = peso === 2 ? 1 : 2
  }
  const resto = soma % 10
  return (10 - resto) % 10
}

// Modulo 11
const modulo11 = (numero) => {
  let soma = 0
  let peso = 2
  const base = 9
  for (let i = numero.length - 1; i >= 0; i--) {
    soma += parseInt(numero.charAt(i)) * peso
    if (peso < base) peso++
    else peso = 2
  }
  const resto = soma % 11
  return resto < 2 ? 1 : 11 - resto
}

// Fator de vencimento
const calcularFatorVencimento = (vencimentoStr) => {
  if (!vencimentoStr) return '0000'

  const vencimento = new Date(vencimentoStr)
  if (isNaN(vencimento.getTime())) return '0000'

  const dataBase = new Date('1997-10-07T00:00:00Z')

  const v = new Date(Date.UTC(vencimento.getUTCFullYear(), vencimento.getUTCMonth(), vencimento.getUTCDate()))
  const b = new Date(Date.UTC(dataBase.getUTCFullYear(), dataBase.getUTCMonth(), dataBase.getUTCDate()))

  const diffMillis = v.getTime() - b.getTime()
  let dias = Math.floor(diffMillis / (1000 * 60 * 60 * 24))

  if (dias >= 10000) {
    dias = ((dias - 10000) % 9000) + 1000
  }

  if (dias < 0) return '0000'

  return String(dias).padStart(4, '0')
}

// Gerar código de barras (44 dígitos)
const generateBarcodeString = (data) => {
  const banco = '274'
  const moeda = '9'

  const fator = calcularFatorVencimento(data.VENCIMENTO || data.vencimento)
  const val = data.VALOR !== undefined ? data.VALOR : data.valor
  const valorStr = getValorForBarcode(val)

  const agencia = '0001'

  let nossoNumeroRaw = String(data.NOSSO_NUMERO || data.nosso_numero || '090000000000').replace(/[^0-9]/g, '')
  let numeroBase = nossoNumeroRaw.slice(0, -1) || '0'

  const carteiraFinal = '09'
  const nossoNumero = numeroBase.padStart(11, '0')

  let contaRaw = (data.CONTA || data.conta || '0000000').replace(/[^0-9]/g, '')
  if (contaRaw.length > 7) contaRaw = contaRaw.slice(0, 7)

  const contaSemDV = contaRaw.padStart(7, '0').slice(-7)
  const conta = contaSemDV + '0'

  const freeField = `${agencia}${carteiraFinal}${nossoNumero}${conta}`
  const block = `${banco}${moeda}${fator}${valorStr}${freeField}`
  const dv = modulo11(block)

  return `${banco}${moeda}${dv}${fator}${valorStr}${freeField}`
}

// Linha digitável formatada
const formatLinhaDigitavel = (barcode) => {
  const field1Raw = barcode.substring(0, 4) + barcode.substring(19, 24)
  const dv1 = modulo10(field1Raw)
  const field1 = `${field1Raw.substring(0, 5)}.${field1Raw.substring(5)}${dv1}`

  const field2Raw = barcode.substring(24, 34)
  const dv2 = modulo10(field2Raw)
  const field2 = `${field2Raw.substring(0, 5)}.${field2Raw.substring(5)}${dv2}`

  const field3Raw = barcode.substring(34, 44)
  const dv3 = modulo10(field3Raw)
  const field3 = `${field3Raw.substring(0, 5)}.${field3Raw.substring(5)}${dv3}`

  const field4 = barcode.charAt(4)
  const field5 = barcode.substring(5, 19)

  return `${field1} ${field2} ${field3} ${field4} ${field5}`
}

// Renderizar boleto completo
const renderBoleto = async (doc, data) => {
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 10
  const contentWidth = pageWidth - (margin * 2)

  // Dados do beneficiário
  const nomeCorrentista = data.NOME_CORRENTISTA || 'CAPT SOLUÇÕES FINANCEIRAS'
  const cicCorrentista = data.CIC || '00.000.000/0000-00'
  const enderecoCorrentista = data.ENDERECO || ''
  const bairroCorrentista = data.BAIRRO || ''
  const cidadeCorrentista = data.CIDADE || ''
  const ufCorrentista = data.UF || ''
  const cepCorrentista = data.CEP || ''

  // Dados do cliente (pagador)
  const sacadoNome = data.SACADO_NOME || data.sacado_nome || 'CLIENTE'
  const sacadoCic = data.SACADO_CIC || data.sacado_cic || ''
  const sacadoEnd = data.SACADO_ENDERECO || data.sacado_endereco || ''
  const sacadoBairro = data.SACADO_BAIRRO || data.sacado_bairro || ''
  const sacadoCidade = data.SACADO_CIDADE || data.sacado_cidade || ''
  const sacadoUf = data.SACADO_UF || data.sacado_uf || ''
  const sacadoCep = data.SACADO_CEP || data.sacado_cep || ''

  const emissao = data.EMISSAO || data.data_emissao || new Date()
  const titulo = data.NUM_TITULO || data.numero_documento || '0000'
  const vencimento = data.VENCIMENTO || data.data_vencimento
  const valor = formatMoeda(data.VALOR || data.valor || 0)
  const valorRaw = data.VALOR !== undefined ? data.VALOR : data.valor

  const nossoNumero = (data.NOSSO_NUMERO || data.nosso_numero || '').replace(/[^0-9]/g, '')
  const agencia = (data.AGENCIA || '0001').replace(/[^0-9]/g, '')
  const conta = (data.CONTA || '000000').replace(/[^0-9]/g, '')
  const carteira = (data.CARTEIRA || '09').replace(/[^0-9]/g, '')

  const barcodeStr = generateBarcodeString(data)
  const linhaDigitavel = formatLinhaDigitavel(barcodeStr)

  let y = 25

  // ===== PARTE 1: FATURA =====

  // HEADER COM DADOS DO BENEFICIÁRIO
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(nomeCorrentista, margin, y)
  y += 4
  doc.text(`CPF/CNPJ: ${cicCorrentista}`, margin, y)
  y += 4
  doc.text(enderecoCorrentista, margin, y)
  y += 4

  const endCompleto = [bairroCorrentista, cidadeCorrentista, ufCorrentista, cepCorrentista]
    .filter(Boolean)
    .join(' - ')
  if (endCompleto) {
    doc.text(endCompleto, margin, y)
    y += 4
  }

  // FATURA à direita
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('FATURA', margin + contentWidth - 5, y - 6, { align: 'right' })

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(`Emissão: ${formatDate(emissao)}`, margin + contentWidth - 5, y + 1, { align: 'right' })

  y += 6
  doc.setLineWidth(0.3)
  doc.line(margin, y, margin + contentWidth, y)
  y += 5

  // DADOS DO CLIENTE
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('DADOS DO CLIENTE', margin, y)
  y += 4

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(sacadoNome, margin, y)
  y += 3
  doc.text(`CPF/CNPJ: ${sacadoCic}`, margin, y)
  y += 3

  const sacadoEndFull = [sacadoEnd, sacadoBairro, sacadoCidade, sacadoUf, sacadoCep]
    .filter(Boolean)
    .join(' - ')
  if (sacadoEndFull) {
    doc.text(sacadoEndFull, margin, y)
    y += 3
  }

  y += 4
  doc.setLineWidth(0.3)
  doc.line(margin, y, margin + contentWidth, y)
  y += 5

  // DESCRIÇÃO DOS SERVIÇOS / PRODUTOS
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('DESCRIÇÃO DOS SERVIÇOS / PRODUTOS', margin, y)
  y += 5

  // Cabeçalho tabela
  doc.setLineWidth(0.3)
  doc.line(margin, y, margin + contentWidth, y)
  y += 4

  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.text('ITEM / DESCRIÇÃO', margin + 2, y)
  doc.text('VALOR', margin + contentWidth - 10, y, { align: 'right' })
  y += 4

  doc.line(margin, y, margin + contentWidth, y)
  y += 4

  // Linha de item
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const desc = `Título: ${titulo} - Vencimento: ${formatDate(vencimento)}`
  doc.text(desc, margin + 2, y)
  doc.text(`R$ ${valor}`, margin + contentWidth - 10, y, { align: 'right' })
  y += 4

  doc.setLineWidth(0.3)
  doc.line(margin, y, margin + contentWidth, y)
  y += 4

  // Total
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  const totalX = margin + contentWidth - 40
  doc.text('TOTAL A PAGAR', totalX, y, { align: 'right' })
  doc.text(`R$ ${valor}`, margin + contentWidth - 2, y, { align: 'right' })
  y += 6

  doc.setLineWidth(0.3)
  doc.line(margin, y, margin + contentWidth, y)
  y += 4

  // Observações
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('OBSERVAÇÕES:', margin, y)
  y += 4

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('Esta fatura serve apenas como demonstrativo. Utilize o boleto abaixo para pagamento.', margin + 2, y)
  y += 3
  doc.text('Em caso de dúvidas, entre em contato.', margin + 2, y)

  y += 10

  // ===== LINHA DE CORTE =====
  const cutLineY = y + 2
  doc.setDrawColor(100, 100, 100)
  doc.setLineDash([2, 2])
  doc.line(margin, cutLineY, margin + contentWidth, cutLineY)
  doc.setLineDash([])

  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.text('Destaque aqui para pagamento', margin + contentWidth / 2, cutLineY + 2, { align: 'center' })

  y = cutLineY + 6

  // ===== PARTE 2: BOLETO BANCÁRIO =====

  let bY = y
  const rowH = 5

  // Cabeçalho com código do banco e linha digitável
  doc.setLineWidth(0.5)
  doc.setDrawColor(0)

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('274', margin + 5, bY + 4)

  doc.setFontSize(9)
  doc.setFont('courier', 'bold')
  doc.text(linhaDigitavel, margin + 20, bY + 4)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('BOLETO BANCÁRIO', margin + contentWidth - 5, bY + 4, { align: 'right' })

  bY += 6
  doc.line(margin, bY, margin + contentWidth, bY)

  // Linha 1: Local de Pagamento / Vencimento
  bY += 5
  doc.setFontSize(6)
  doc.setFont('helvetica', 'bold')
  doc.text('Local de Pagamento', margin + 2, bY)

  const rightColX = margin + contentWidth - 45
  doc.text('Vencimento', rightColX + 2, bY)

  bY += 3.5
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('PAGÁVEL EM QUALQUER BANCO ATÉ O VENCIMENTO', margin + 2, bY)

  doc.setFont('helvetica', 'bold')
  doc.text(formatDate(vencimento), margin + contentWidth - 2, bY, { align: 'right' })

  bY += 4
  doc.setLineWidth(0.3)
  doc.line(margin, bY, margin + contentWidth, bY)

  // Linha 2: Beneficiário / Agência
  bY += 4
  doc.setFontSize(6)
  doc.setFont('helvetica', 'bold')
  doc.text('Beneficiário', margin + 2, bY)
  doc.text('Agência/Código Beneficiário', rightColX + 2, bY)

  bY += 3.5
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  const beneficiarioTexto = cicCorrentista
    ? `${nomeCorrentista} - ${cicCorrentista}`
    : nomeCorrentista
  doc.text(beneficiarioTexto, margin + 2, bY)

  doc.text(`${agencia} / ${conta}`, margin + contentWidth - 2, bY, { align: 'right' })

  bY += 4
  doc.setLineWidth(0.3)
  doc.line(margin, bY, margin + contentWidth, bY)

  // Linha 3: Campos de data, documento, espécie, aceite, processamento e nosso número
  bY += 4
  const colWidth = (contentWidth - 45) / 5

  doc.setFontSize(6)
  doc.setFont('helvetica', 'bold')
  doc.text('Data Documento', margin + 2, bY)
  doc.text('Nº do Documento', margin + colWidth + 2, bY)
  doc.text('Espécie Doc.', margin + colWidth * 2 + 2, bY)
  doc.text('Aceite', margin + colWidth * 3 + 2, bY)
  doc.text('Data Processamento', margin + colWidth * 4 + 2, bY)
  doc.text('Nosso Número', rightColX + 2, bY)

  bY += 3.5
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(formatDate(emissao), margin + 2, bY)
  doc.text(titulo, margin + colWidth + 2, bY)
  doc.text('DM', margin + colWidth * 2 + 2, bY)
  doc.text('N', margin + colWidth * 3 + 2, bY)
  doc.text(formatDate(new Date()), margin + colWidth * 4 + 2, bY)
  doc.text(nossoNumero, margin + contentWidth - 2, bY, { align: 'right' })

  bY += 4
  doc.setLineWidth(0.3)
  doc.line(margin, bY, margin + contentWidth, bY)

  // Linha 4: Carteira / Espécie / Valor do Documento
  bY += 4
  doc.setFontSize(6)
  doc.setFont('helvetica', 'bold')
  doc.text('Carteira', margin + colWidth + 2, bY)
  doc.text('Espécie', margin + colWidth * 2 + 2, bY)
  doc.text('(=) Valor do Documento', rightColX + 2, bY)

  bY += 3.5
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(carteira, margin + colWidth + 2, bY)
  doc.text('R$', margin + colWidth * 2 + 2, bY)

  doc.setFont('helvetica', 'bold')
  doc.text(`R$ ${valor}`, margin + contentWidth - 2, bY, { align: 'right' })

  bY += 4
  doc.setLineWidth(0.3)
  doc.line(margin, bY, margin + contentWidth, bY)

  // Instruções
  bY += 4
  doc.setFontSize(6)
  doc.setFont('helvetica', 'bold')
  doc.text('INSTRUÇÕES (TEXTO DE RESPONSABILIDADE DO BENEFICIÁRIO)', margin + 2, bY)

  bY += 3
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')

  const moraValor = ((typeof valorRaw === 'number' ? valorRaw : parseFloat(String(valorRaw).replace(/\./g, '').replace(',', '.'))) * 0.002).toFixed(2).replace('.', ',')
  doc.text(`APÓS VENCIMENTO COBRAR MORA DE R$ ${moraValor} POR DIA`, margin + 2, bY)

  bY += 8
  doc.setLineWidth(0.3)
  doc.line(margin, bY, margin + contentWidth, bY)

  // Pagador
  bY += 4
  doc.setFontSize(6)
  doc.setFont('helvetica', 'bold')
  doc.text('Pagador', margin + 2, bY)

  bY += 3
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text(sacadoNome, margin + 2, bY)

  doc.setFont('helvetica', 'normal')
  bY += 3
  doc.text(`CPF/CNPJ: ${sacadoCic}`, margin + 2, bY)

  bY += 3
  if (sacadoEndFull) {
    doc.text(sacadoEndFull, margin + 2, bY)
  }

  bY += 4
  doc.setLineWidth(0.3)
  doc.line(margin, bY, margin + contentWidth, bY)

  // Sacador/Avalista
  bY += 2
  doc.setFontSize(6)
  doc.setFont('helvetica', 'bold')
  doc.text('Sacador/Avalista', margin + 2, bY)

  bY += 5
  doc.setLineWidth(0.5)
  doc.line(margin, bY, margin + contentWidth, bY)

  // Barcode - centralizado
  bY += 6
  try {
    const canvas = document.createElement('canvas')
    const scale = 1.5
    canvas.width = 1200 * scale
    canvas.height = 150 * scale

    const ctx = canvas.getContext('2d')
    if (ctx) ctx.scale(scale, scale)

    JsBarcode(canvas, barcodeStr, {
      format: 'ITF',
      displayValue: false,
      width: 3,
      height: 120,
      margin: 10,
      fontSize: 0,
      background: '#ffffff',
      lineColor: '#000000'
    })

    const barcodeDataUrl = canvas.toDataURL('image/png', 0.85)
    // Centralizar: calcular posição x para centralizar a imagem
    const barcodeWidth = contentWidth - 10
    const barcodePadding = (contentWidth - barcodeWidth) / 2
    doc.addImage(barcodeDataUrl, 'PNG', margin + barcodePadding, bY, barcodeWidth, 12)
  } catch (e) {
    console.error('Erro ao gerar barcode:', e)
  }

  bY += 16
  doc.setFontSize(8)
  doc.setFont('courier', 'bold')
  // Centralizar linha digitável
  doc.text(linhaDigitavel, margin + contentWidth / 2, bY, { align: 'center' })
}

export const generateSingleBoletoPDF = async (record) => {
  console.log('[PDF-Util] generateSingleBoletoPDF chamado')
  try {
    if (!record) throw new Error('Nenhum boleto fornecido')

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    await renderBoleto(doc, record)

    const blob = doc.output('blob')
    console.log('[PDF-Util] Blob gerado com sucesso, tamanho:', blob.size)
    return blob
  } catch (error) {
    console.error('[PDF-Util] ERRO:', error)
    throw error
  }
}

export const generateMultipleBoletoPDFs = async (records) => {
  console.log('[PDF-Util] Gerando múltiplos PDFs para', records.length, 'boletos')
  const pdfs = []

  for (let i = 0; i < records.length; i++) {
    const record = records[i]
    try {
      const boletoData = {
        NOME_CORRENTISTA: 'CAPT SOLUÇÕES FINANCEIRAS LTDA',
        CIC: '00.000.000/0000-00',
        ENDERECO: 'RUA DAS FINANÇAS, 1000',
        BAIRRO: 'CENTRO',
        CIDADE: 'SÃO PAULO',
        UF: 'SP',
        CEP: '01310-100',
        NUM_TITULO: record.numero_documento,
        EMISSAO: record.data_emissao,
        VENCIMENTO: record.data_vencimento,
        VALOR: record.valor,
        NOSSO_NUMERO: record.nosso_numero,
        SACADO_NOME: record.sacado_nome,
        SACADO_CIC: record.sacado_cic,
        SACADO_ENDERECO: record.sacado_endereco,
        SACADO_CEP: record.sacado_cep,
      }

      const pdfBlob = await generateSingleBoletoPDF(boletoData)
      const filename = `boleto_${record.numero_documento || 'documento'}.pdf`

      pdfs.push({
        filename,
        blob: pdfBlob
      })

      console.log(`[PDF-Util] PDF ${i + 1}/${records.length} gerado: ${filename}`)
    } catch (error) {
      console.error(`[PDF-Util] Erro ao gerar PDF para boleto ${i}:`, error)
    }
  }

  console.log('[PDF-Util] Total de PDFs gerados:', pdfs.length)
  return pdfs
}

// ===== CNAB400 REMITTANCE GENERATION =====

// Helper functions for CNAB400
const padLeft = (value, size, char = '0') => {
  const str = String(value)
  return str.padStart(size, char)
}

const padRight = (value, size, char = ' ') => {
  const str = String(value)
  return str.padEnd(size, char)
}

// Remove accents and special characters
const cleanStr = (str) => {
  if (!str) return ''
  return String(str)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .toUpperCase()
}

// Clean numeric string (remove non-digits)
const cleanNum = (str) => {
  if (!str) return '0'
  return String(str).replace(/[^0-9]/g, '')
}

// Format date for CNAB400 (DDMMAA or DDMMYYYY)
const fmtDateCNAB = (dateStr, format = 'DDMMAA') => {
  if (!dateStr) return format === 'DDMMAA' ? '000000' : '00000000'

  let date
  if (typeof dateStr === 'string') {
    if (dateStr.includes('/')) {
      const [day, month, year] = dateStr.split('/')
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    } else if (dateStr.includes('-')) {
      date = new Date(dateStr)
    } else {
      return format === 'DDMMAA' ? '000000' : '00000000'
    }
  } else {
    date = new Date(dateStr)
  }

  if (isNaN(date.getTime())) {
    return format === 'DDMMAA' ? '000000' : '00000000'
  }

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = format === 'DDMMAA'
    ? String(date.getFullYear()).slice(-2)
    : String(date.getFullYear()).padStart(4, '0')

  return format === 'DDMMAA'
    ? `${day}${month}${year}`
    : `${day}${month}${year}`
}

// Format monetary value in centavos (13 digits)
const fmtValorCNAB = (value) => {
  let num = 0
  if (typeof value === 'number') {
    num = value
  } else if (typeof value === 'string') {
    const normalized = value.replace(/\./g, '').replace(',', '.')
    num = parseFloat(normalized) || 0
  }

  const centavos = Math.round(num * 100)
  return padLeft(centavos, 13, '0')
}

// Calculate check digit for BMP (Modulo 11)
const calcularDigitoBMP = (numeroSemDv) => {
  let soma = 0
  let peso = 2
  const base = 9

  const digitos = String(numeroSemDv).split('').reverse()

  for (let i = 0; i < digitos.length; i++) {
    soma += parseInt(digitos[i]) * peso
    if (peso < base) peso++
    else peso = 2
  }

  const resto = soma % 11
  return resto < 2 ? 1 : 11 - resto
}

// Generate CNAB400 Header Record (Type 0)
const generateHeaderRecord = (cedente) => {
  let line = ''

  line += '033' // Código do banco (BMP)
  line += '0000' // Lote de serviço
  line += '0' // Tipo de registro: Header de lote
  line += padRight('', 3) // Reservado (uso futuro)
  line += 'C' // Tipo de inscrição cedente (C = CNPJ)
  line += padLeft('00000000000000', 14) // CNPJ cedente (sem dígito)
  line += padLeft('0', 20) // Código do cedente (conta corrente)
  line += padLeft('0', 11) // Dígito verif. da agência
  line += padLeft('0', 2) // Dígito verif. da conta
  line += padRight('0', 1) // Dígito verif. agência/conta
  line += padRight(cleanStr('CAPT SOLUÇÕES FINANCEIRAS'), 30) // Nome do cedente
  line += padRight('', 40) // Nome do banco
  line += padLeft(String(new Date().getFullYear()), 2) // Data de gerência (YYMMDD) - ano
  line += padLeft(String(new Date().getMonth() + 1), 2)
  line += padLeft(String(new Date().getDate()), 2)
  line += padLeft('1', 6) // NSA - número sequencial do arquivo
  line += padLeft('090001', 6) // Versão do layout
  line += padLeft('0', 5) // Densidade de gravação
  line += padRight('0', 20) // Reservado
  line += padRight('', 20) // Número da remessa (sequencial)

  // Ensure 400 characters total
  while (line.length < 400) {
    line += ' '
  }

  return line.substring(0, 400)
}

// Generate CNAB400 Detail Record Type 1 (Title Info)
const generateDetailRecord1 = (sequencia, boleto) => {
  let line = ''

  line += '033' // Código do banco
  line += '0001' // Lote de serviço
  line += '1' // Tipo de registro: Detail
  line += padLeft(sequencia, 5) // Número sequencial do registro
  line += padRight('', 4) // Código de segmento
  line += padRight(' ', 1) // Uso exclusivo da FEBRABAN
  line += 'C' // Tipo de inscrição
  line += padLeft('00000000000000', 14) // CNPJ cedente
  line += padLeft('0', 20) // Código do cedente
  line += padLeft('0', 11) // Dígito agência
  line += padLeft('0', 2) // Dígito conta
  line += padRight('0', 1) // Dígito agência/conta
  line += padLeft(String(boleto.nosso_numero || '0').replace(/[^0-9]/g, ''), 11) // Nosso número
  line += '09' // Carteira
  line += padLeft(String(boleto.numero_documento || '0'), 15) // Número do título
  line += fmtDateCNAB(boleto.data_emissao, 'DDMMAA') // Data emissão
  line += fmtDateCNAB(boleto.data_vencimento, 'DDMMAA') // Data vencimento
  line += fmtValorCNAB(boleto.valor) // Valor do documento
  line += padLeft('0', 8) // Valor do banco
  line += '01' // Espécie do título
  line += 'N' // Aceite
  line += fmtDateCNAB(new Date(), 'DDMMAA') // Data entrega
  line += padLeft('0', 12) // Juros de mora
  line += padLeft('0', 12) // Desconto
  line += padLeft('0', 12) // Valor abatimento
  line += 'C' // Tipo inscrição sacado
  line += padLeft(cleanNum(boleto.sacado_cic || '0'), 14) // CPF/CNPJ sacado
  line += padRight(cleanStr(boleto.sacado_nome || 'CLIENTE'), 30) // Nome sacado
  line += padRight(cleanStr(boleto.sacado_endereco || ''), 30) // Endereço sacado
  line += padLeft('0', 15) // Complemento endereço
  line += padRight(cleanStr(boleto.sacado_bairro || ''), 15) // Bairro
  line += padLeft(cleanNum(boleto.sacado_cep || '0'), 5) // CEP
  line += padLeft('0', 3) // Sufixo CEP
  line += padRight(cleanStr(boleto.sacado_cidade || ''), 15) // Cidade
  line += padRight('SP', 2) // UF
  line += padLeft('0', 4) // Código do sacador
  line += padRight('', 30) // Nome do sacador

  // Ensure 400 characters
  while (line.length < 400) {
    line += ' '
  }

  return line.substring(0, 400)
}

// Generate CNAB400 Detail Record Type 2 (Messages and complementary info)
const generateDetailRecord2 = (sequencia, boleto) => {
  let line = ''

  line += '033' // Código do banco
  line += '0001' // Lote de serviço
  line += '2' // Tipo de registro: Detail complementar
  line += padLeft(sequencia, 5) // Número sequencial
  line += padRight('', 4) // Código de segmento
  line += padRight(' ', 1) // Uso FEBRABAN
  line += padRight('', 80) // Mensagem 1
  line += padRight('BOLETO BANCARIO', 80) // Mensagem 2
  line += padRight('', 80) // Mensagem 3
  line += padRight('', 80) // Campo livre para uso do cedente

  // Ensure 400 characters
  while (line.length < 400) {
    line += ' '
  }

  return line.substring(0, 400)
}

// Generate CNAB400 Trailer Record (Type 9)
const generateTrailerRecord = (totalLinhas, totalValor) => {
  let line = ''

  line += '033' // Código do banco
  line += '0001' // Lote de serviço
  line += '9' // Tipo de registro: Trailer
  line += padLeft(totalLinhas, 6) // Quantidade de registros do lote
  line += padLeft('0', 6) // Quantidade de títulos
  line += fmtValorCNAB(totalValor) // Valor total dos títulos
  line += padLeft('0', 13) // Valor total desconto
  line += padLeft('0', 13) // Valor total abatimento
  line += padLeft('0', 13) // Valor total mora
  line += padLeft('0', 13) // Valor total multa
  line += padLeft('0', 13) // Valor líquido
  line += padRight('', 24) // Uso FEBRABAN
  line += padRight('', 165) // Reservado

  // Ensure 400 characters
  while (line.length < 400) {
    line += ' '
  }

  return line.substring(0, 400)
}

// Main function to generate CNAB400 remittance file
export const generateCNAB400RemittanceFile = (boletos) => {
  console.log('[CNAB400] Gerando remessa para', boletos.length, 'boletos')

  if (!boletos || boletos.length === 0) {
    throw new Error('Nenhum boleto fornecido para gerar remessa')
  }

  let content = ''
  let sequenciaDetalhe = 1
  let totalValor = 0

  // Header
  content += generateHeaderRecord() + '\r\n'

  // Detail Records (Type 1 and 2 for each boleto)
  for (const boleto of boletos) {
    content += generateDetailRecord1(sequenciaDetalhe, boleto) + '\r\n'
    sequenciaDetalhe++
    content += generateDetailRecord2(sequenciaDetalhe, boleto) + '\r\n'
    sequenciaDetalhe++

    // Calculate total value
    if (boleto.valor) {
      const val = typeof boleto.valor === 'string'
        ? parseFloat(boleto.valor.replace(/\./g, '').replace(',', '.'))
        : boleto.valor
      totalValor += isNaN(val) ? 0 : val
    }
  }

  // Trailer
  const totalLinhas = sequenciaDetalhe + 1 // +1 for trailer itself
  content += generateTrailerRecord(totalLinhas, totalValor) + '\r\n'

  console.log('[CNAB400] Remessa gerada com', sequenciaDetalhe, 'registros de detalhe e valor total:', totalValor)

  // Create a Blob with the content
  const blob = new Blob([content], { type: 'text/plain; charset=utf-8' })
  return blob
}
