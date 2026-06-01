import { jsPDF } from 'jspdf'
import JsBarcode from 'jsbarcode'

// Formatadores
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

const formatDate = (date) => {
  if (!date) return ''
  if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = date.split('-')
    return `${day}/${month}/${year}`
  }
  const d = new Date(date)
  if (isNaN(d.getTime())) return String(date)
  return d.toLocaleDateString('pt-BR')
}

// Funções para gerar código de barras
const getValorForBarcode = (value) => {
  let num = 0
  if (typeof value === 'number') num = value
  else if (typeof value === 'string') {
    const normalized = value.replace(/\./g, '').replace(',', '.')
    num = parseFloat(normalized)
  }
  if (isNaN(num)) return '0000000000'
  return num.toFixed(2).replace('.', '').padStart(10, '0')
}

const calcularFatorVencimento = (vencimentoStr) => {
  if (!vencimentoStr) return '0000'
  const vencimento = new Date(vencimentoStr)
  if (isNaN(vencimento.getTime())) return '0000'
  const dataBase = new Date('1997-10-07')
  const diffTime = vencimento.getTime() - dataBase.getTime()
  let dias = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  if (dias >= 10000) dias = ((dias - 10000) % 9000) + 1000
  if (dias < 0) return '0000'
  return String(dias).padStart(4, '0')
}

const modulo10 = (numero) => {
  let soma = 0, peso = 2
  for (let i = numero.length - 1; i >= 0; i--) {
    let termo = parseInt(numero.charAt(i)) * peso
    termo = Math.floor(termo / 10) + (termo % 10)
    soma += termo
    peso = peso === 2 ? 1 : 2
  }
  const digito = 10 - (soma % 10)
  return digito === 10 ? '0' : String(digito)
}

const modulo11 = (numero) => {
  const sequencia = '23456789'
  let soma = 0, posicao = 0
  for (let i = numero.length - 1; i >= 0; i--) {
    soma += parseInt(numero.charAt(i)) * parseInt(sequencia.charAt(posicao))
    posicao = (posicao + 1) % sequencia.length
  }
  const resto = soma % 11
  const digito = 11 - resto
  if (digito === 0 || digito === 10 || digito === 11) return '1'
  return String(digito)
}

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
  const field4 = barcode.substring(4, 5)
  const field5 = barcode.substring(5, 9)
  return `${field1} ${field2} ${field3} ${field4} ${field5}`
}

// Função principal de renderização ABNT
const renderBoletoABNT = async (doc, data) => {
  const MARGIN = 10
  const PAGE_WIDTH = 210
  const PAGE_HEIGHT = 297
  const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2)

  // Extrair dados
  const beneficiario = data.NOME_CORRENTISTA || 'CAPT SOLUÇÕES FINANCEIRAS'
  const cnpj = data.CIC || '00.000.000/0000-00'
  const endereco = data.ENDERECO || 'RUA DAS FINANÇAS, 1000'
  const bairro = data.BAIRRO || 'CENTRO'
  const cidade = data.CIDADE || 'SÃO PAULO'
  const uf = data.UF || 'SP'
  const cep = data.CEP || '01310-100'

  const sacadoNome = data.SACADO_NOME || data.sacado_nome || 'CLIENTE'
  const sacadoCIC = data.SACADO_CIC || data.sacado_cic || '000.000.000-00'
  const sacadoEnd = data.SACADO_ENDERECO || data.sacado_endereco || ''
  const sacadoCEP = data.SACADO_CEP || data.sacado_cep || ''

  const numeroDocumento = data.NUM_TITULO || data.numero_documento || '0000'
  const dataEmissao = data.EMISSAO || data.data_emissao || new Date()
  const dataVencimento = data.VENCIMENTO || data.data_vencimento || new Date()
  const valor = formatMoeda(data.VALOR || data.valor || 0)
  const nossoNumero = data.NOSSO_NUMERO || data.nosso_numero || '0000'

  const barcodeStr = generateBarcodeString(data)
  const linhaDigitavel = formatLinhaDigitavel(barcodeStr)

  let y = MARGIN

  // ===== SEÇÃO 1: CABEÇALHO DO BANCO =====
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('274', MARGIN, y + 5)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(beneficiario, MARGIN + 15, y + 2)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text(`CNPJ: ${cnpj}`, MARGIN + 15, y + 6)

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('BOLETO BANCÁRIO', MARGIN + CONTENT_WIDTH - 40, y + 3, { align: 'right' })

  y += 12
  doc.setDrawColor(0)
  doc.setLineWidth(0.5)
  doc.line(MARGIN, y, MARGIN + CONTENT_WIDTH, y)

  // ===== SEÇÃO 2: INSTRUÇÕES =====
  y += 2
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text('INSTRUÇÕES - PAGÁVEL EM QUALQUER BANCO ATÉ A DATA DE VENCIMENTO', MARGIN + 2, y)

  y += 5
  doc.line(MARGIN, y, MARGIN + CONTENT_WIDTH, y)

  y += 2
  doc.setFontSize(6.5)
  const instrucoes = [
    '1. Não receba um boleto com valor alterado ou rasurando, devolva ao banco.  2. Juros e multa de acordo com contrato.',
    '3. Sem protestos.  4. Após vencimento, cobrar juros de 1% ao mês + multa de 2%.'
  ]
  instrucoes.forEach((instr) => {
    doc.text(instr, MARGIN + 2, y)
    y += 3
  })

  y += 2
  doc.line(MARGIN, y, MARGIN + CONTENT_WIDTH, y)

  // ===== SEÇÃO 3: CAMPOS PRINCIPAIS (4 COLUNAS) =====
  y += 3
  doc.setFontSize(6)
  doc.setFont('helvetica', 'bold')

  const col1 = MARGIN + 2
  const col2 = MARGIN + 53
  const col3 = MARGIN + 106
  const col4 = MARGIN + 159

  // Linha 1
  doc.text('LOCAL DE PAGAMENTO', col1, y)
  doc.text('VENCIMENTO', col2, y)
  doc.text('AGÊNCIA/CÓDIGO', col3, y)
  doc.text('NOSSO NÚMERO', col4, y)

  y += 3
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Qualquer agência do Banco Bradesco', col1, y)
  doc.setFont('helvetica', 'bold')
  doc.text(formatDate(dataVencimento), col2, y)
  doc.text('0001/0000000', col3, y)
  doc.text(nossoNumero, col4, y)

  y += 5
  doc.line(MARGIN, y, MARGIN + CONTENT_WIDTH, y)

  // Linha 2
  y += 3
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.text('NÚMERO DOCUMENTO', col1, y)
  doc.text('SÉRIE', col2, y)
  doc.text('ESPÉCIE', col3, y)
  doc.text('ACEITE', col4, y)

  y += 3
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(numeroDocumento, col1, y)
  doc.text('001', col2, y)
  doc.text('DM', col3, y)
  doc.text('N', col4, y)

  y += 5
  doc.line(MARGIN, y, MARGIN + CONTENT_WIDTH, y)

  // Linha 3
  y += 3
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.text('DATA EMISSÃO', col1, y)
  doc.text('JUROS/MÊS', col2, y)
  doc.text('DESCONTO', col3, y)
  doc.text('VALOR DOCUMENTO', col4, y)

  y += 3
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(formatDate(dataEmissao), col1, y)
  doc.text('0,00', col2, y)
  doc.text('0,00', col3, y)
  doc.setFont('helvetica', 'bold')
  doc.text(`R$ ${valor}`, col4, y, { align: 'right' })

  y += 5
  doc.line(MARGIN, y, MARGIN + CONTENT_WIDTH, y)

  // ===== SEÇÃO 4: BENEFICIÁRIO =====
  y += 3
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.text('BENEFICIÁRIO', col1, y)

  y += 3
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(beneficiario, col1, y)

  y += 5
  doc.line(MARGIN, y, MARGIN + CONTENT_WIDTH, y)

  // ===== SEÇÃO 5: SACADO (PAGADOR) =====
  y += 3
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.text('PAGADOR', col1, y)

  y += 3
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(sacadoNome, col1, y)
  y += 3
  doc.setFontSize(7)
  doc.text(`CPF/CNPJ: ${sacadoCIC}`, col1, y)
  y += 3
  doc.text(`${sacadoEnd} - ${sacadoCEP}`, col1, y)

  y += 7
  doc.setLineWidth(0.5)
  doc.line(MARGIN, y, MARGIN + CONTENT_WIDTH, y)

  // ===== SEÇÃO 6: CÓDIGO DE BARRAS E LINHA DIGITÁVEL =====
  y += 5

  // Gerar e inserir código de barras
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 100
    JsBarcode(canvas, barcodeStr, {
      format: 'ITF',
      displayValue: false,
      width: 2,
      height: 60,
      margin: 5,
      background: '#ffffff',
      lineColor: '#000000',
    })
    const barcodeDataUrl = canvas.toDataURL('image/png')
    doc.addImage(barcodeDataUrl, 'PNG', MARGIN + 10, y, 190, 15)
    y += 18
  } catch (e) {
    console.error('Erro ao gerar barcode:', e)
    y += 10
  }

  // Linha digitável
  doc.setFontSize(11)
  doc.setFont('courier', 'bold')
  doc.text(linhaDigitavel, MARGIN + 10, y)

  y += 5
  doc.setLineWidth(0.5)
  doc.line(MARGIN, y, MARGIN + CONTENT_WIDTH, y)
}

export const generateSingleBoletoPDF = async (record) => {
  console.log('[PDF-Util] generateSingleBoletoPDF chamado')
  try {
    if (!record) throw new Error('Nenhum boleto fornecido')
    console.log('[PDF-Util] Criando documento jsPDF...')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    console.log('[PDF-Util] Renderizando boleto ABNT...')
    await renderBoletoABNT(doc, record)
    console.log('[PDF-Util] Gerando blob...')
    const blob = doc.output('blob')
    console.log('[PDF-Util] Blob gerado com sucesso, tamanho:', blob.size)
    return blob
  } catch (error) {
    console.error('[PDF-Util] ERRO:', error)
    console.error('[PDF-Util] Message:', error.message)
    console.error('[PDF-Util] Stack:', error.stack)
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
