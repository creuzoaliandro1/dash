import { jsPDF } from 'jspdf'

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
  if (isNaN(d.getTime())) return ''
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

// Converte número para extenso
const converterNumeroParaExtenso = (numero) => {
  const num = parseFloat(numero)
  if (isNaN(num)) return ''

  const reais = Math.floor(num)
  const centavos = Math.round((num - reais) * 100)

  const unidades = ['', 'Um', 'Dois', 'Três', 'Quatro', 'Cinco', 'Seis', 'Sete', 'Oito', 'Nove']
  const dez_dezenove = ['Dez', 'Onze', 'Doze', 'Treze', 'Quatorze', 'Quinze', 'Dezesseis', 'Dezessete', 'Dezoito', 'Dezenove']
  const dezenas = ['', '', 'Vinte', 'Trinta', 'Quarenta', 'Cinquenta', 'Sessenta', 'Setenta', 'Oitenta', 'Noventa']
  const centenas = ['', 'Cento', 'Duzentos', 'Trezentos', 'Quatrocentos', 'Quinhentos', 'Seiscentos', 'Setecentos', 'Oitocentos', 'Novecentos']

  let extenso = ''

  // Centenas
  if (reais >= 100) {
    extenso += centenas[Math.floor(reais / 100)]
    const resto = reais % 100
    if (resto > 0) extenso += ' e '
    if (resto > 0 && resto < 10) extenso += unidades[resto]
    else if (resto >= 10 && resto < 20) extenso += dez_dezenove[resto - 10]
    else {
      if (Math.floor(resto / 10) > 0) extenso += dezenas[Math.floor(resto / 10)]
      if (resto % 10 > 0) extenso += ' e ' + unidades[resto % 10]
    }
  } else if (reais >= 10 && reais < 20) {
    extenso += dez_dezenove[reais - 10]
  } else if (reais >= 20) {
    extenso += dezenas[Math.floor(reais / 10)]
    if (reais % 10 > 0) extenso += ' e ' + unidades[reais % 10]
  } else if (reais > 0) {
    extenso += unidades[reais]
  }

  extenso += ' Real'
  if (reais !== 1) extenso += 'is'

  if (centavos > 0) {
    extenso += ' e ' + centavos + ' Centavos'
  }

  return extenso
}

export const generateDuplicataPDF = async (boleto, conta, logoUrl) => {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 10
  const contentWidth = pageWidth - margin * 2

  try {
    let yPos = margin

    // ===== HEADER: LOGO + DADOS DA EMPRESA =====
    // Logo (lado esquerdo)
    if (logoUrl) {
      try {
        const imgData = await fetch(logoUrl).then(r => r.blob()).then(b => b.arrayBuffer())
        const imgBinary = String.fromCharCode(...new Uint8Array(imgData))
        const imgBase64 = btoa(imgBinary)
        pdf.addImage('data:image/png;base64,' + imgBase64, 'PNG', margin, yPos, 30, 15)
      } catch (e) {
        console.warn('[Duplicata] Erro ao carregar logo:', e)
      }
    }

    // Dados da empresa cedente (lado direito)
    pdf.setFontSize(9)
    pdf.setFont(undefined, 'normal')

    const dataStartX = margin + 50
    let dataY = yPos + 1

    pdf.text('Razão Social: ' + (conta?.nome_correntista || 'EMPRESA'), dataStartX, dataY)
    dataY += 4
    pdf.text('CNPJ: ' + (conta?.cic || conta?.cpf_cnpj || '00.000.000/0000-00'), dataStartX, dataY)
    dataY += 4
    pdf.text('Endereço: ' + (conta?.endereco || 'RUA'), dataStartX, dataY)
    dataY += 4
    pdf.text('Município / UF: ' + (conta?.cidade || '') + ' - ' + (conta?.uf || ''), dataStartX, dataY)
    dataY += 4
    pdf.text('Cep: ' + (conta?.cep || '00000-000'), dataStartX, dataY)

    pdf.setFontSize(8)
    pdf.text('Telefone: ' + (conta?.telefone || ''), pageWidth - margin - 30, yPos + 2)

    yPos += 22

    // ===== TABELAS: FATURA | DUPLICATA | PARA USO DE INSTITUIÇÃO FINANCEIRA =====
    const colWidth = (contentWidth - 4) / 3

    // Desenhar retângulos das três colunas
    pdf.rect(margin, yPos, colWidth, 28)
    pdf.rect(margin + colWidth + 2, yPos, colWidth, 28)
    pdf.rect(margin + colWidth * 2 + 4, yPos, colWidth, 28)

    // Headers
    pdf.setFontSize(9)
    pdf.setFont(undefined, 'bold')
    pdf.text('Fatura', margin + colWidth / 2, yPos + 4, { align: 'center' })
    pdf.text('Duplicata', margin + colWidth + 2 + colWidth / 2, yPos + 4, { align: 'center' })
    pdf.text('Para uso de Instituição financeira', margin + colWidth * 2 + 4 + colWidth / 2, yPos + 4, { align: 'center' })

    // Linhas separadoras do header
    pdf.setDrawColor(0)
    pdf.line(margin + 2, yPos + 5.5, margin + colWidth - 2, yPos + 5.5)
    pdf.line(margin + colWidth + 4, yPos + 5.5, margin + colWidth * 2, yPos + 5.5)
    pdf.line(margin + colWidth * 2 + 6, yPos + 5.5, pageWidth - margin - 2, yPos + 5.5)

    // Dados das tabelas
    pdf.setFont(undefined, 'normal')
    pdf.setFontSize(8)

    let tableDataY = yPos + 8

    // FATURA - Coluna 1
    pdf.text('Número', margin + 2, tableDataY)
    pdf.text('Valor', margin + 2, tableDataY + 5)
    pdf.text('Dt. Emissão', margin + 2, tableDataY + 10)

    pdf.text(boleto.numero_documento || '', margin + 2, tableDataY + 15)
    pdf.text('R$ ' + formatMoeda(boleto.valor), margin + 2, tableDataY + 20)
    pdf.text(formatDate(boleto.data_emissao) || '', margin + 2, tableDataY + 25)

    // DUPLICATA - Coluna 2
    pdf.text('Número', margin + colWidth + 4, tableDataY)
    pdf.text('Valor', margin + colWidth + 4, tableDataY + 5)
    pdf.text('Vencimento', margin + colWidth + 4, tableDataY + 10)

    const numDuplicata = (boleto.numero_documento || '') + ' 1/3'
    const valorParcela = formatMoeda(parseFloat(boleto.valor || 0) / 3)

    pdf.text(numDuplicata, margin + colWidth + 4, tableDataY + 15)
    pdf.text('R$ ' + valorParcela, margin + colWidth + 4, tableDataY + 20)
    pdf.text(formatDate(boleto.data_vencimento) || '', margin + colWidth + 4, tableDataY + 25)

    yPos += 30

    // ===== DESCONTO =====
    pdf.rect(margin, yPos, colWidth, 10)
    pdf.setFontSize(9)
    pdf.setFont(undefined, 'bold')
    pdf.text('Desconto', margin + 2, yPos + 4)
    pdf.setFont(undefined, 'normal')
    pdf.setFontSize(8)
    pdf.text('0.00', margin + 2, yPos + 8)

    yPos += 12

    // ===== DADOS DO SACADO (DEVEDOR) =====
    pdf.setFontSize(9)
    pdf.setFont(undefined, 'bold')
    pdf.text('Dados do Sacado:', margin, yPos)

    yPos += 5
    pdf.setFont(undefined, 'normal')
    pdf.setFontSize(8)

    pdf.text('Razão Social: ' + (boleto.sacado_nome || ''), margin, yPos)
    yPos += 4
    pdf.text('CNPJ / CPF: ' + (boleto.sacado_cic || ''), margin, yPos)
    yPos += 4
    pdf.text('Endereço: ' + (boleto.sacado_endereco || ''), margin, yPos)
    yPos += 4
    pdf.text('Município / UF: ' + (boleto.sacado_cidade || '') + ' - ' + (boleto.sacado_uf || ''), margin, yPos)
    yPos += 4
    pdf.text('Cep: ' + (boleto.sacado_cep || ''), margin, yPos)
    yPos += 4
    pdf.text('Praça de pagamento: A mesma', margin, yPos)

    yPos += 6

    // ===== VALOR POR EXTENSO =====
    pdf.setFont(undefined, 'bold')
    pdf.setFontSize(8)
    pdf.text('Valor por extenso:', margin, yPos)
    yPos += 4
    pdf.setFont(undefined, 'normal')
    const extenso = converterNumeroParaExtenso(parseFloat(boleto.valor || 0) / 3)
    pdf.text(extenso, margin, yPos, { maxWidth: contentWidth })

    yPos += 8

    // ===== RECONHECIMENTO =====
    pdf.setFont(undefined, 'bold')
    pdf.setFontSize(8)
    pdf.text('Reconhecimento:', margin, yPos)
    yPos += 4
    pdf.setFont(undefined, 'normal')
    pdf.setFontSize(7)
    const reconhecimentoText = 'Reconheci(emos) a exatidão desta DUPLICATA de venda realizada acima. Qualquer contestação deverá ser feita por escrito em até 30 dias contados da data de recebimento desta duplicata.'
    pdf.text(reconhecimentoText, margin, yPos, { maxWidth: contentWidth, align: 'justify' })

    yPos = pageHeight - 35

    // ===== ASSINATURA =====
    pdf.setFont(undefined, 'normal')
    pdf.setFontSize(8)
    pdf.text('Em: _____ / _____ / _____', margin, yPos)
    pdf.line(margin + 35, yPos, margin + contentWidth - 20, yPos)
    pdf.setFontSize(7)
    pdf.text('Data do Aceite', margin + 35, yPos + 3)

    pdf.setFontSize(8)
    pdf.text('_________________________________', margin + contentWidth / 2, yPos)
    pdf.setFontSize(7)
    pdf.text('EMPRESA / SACADO', margin + contentWidth / 2 + 5, yPos + 3)

    const blob = pdf.output('blob')
    return blob
  } catch (error) {
    console.error('[Duplicata] Erro ao gerar PDF:', error)
    throw error
  }
}
