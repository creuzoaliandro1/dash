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

// Função auxiliar para converter número da célula em posição (row, col)
const getCellPosition = (cellNumber, cols) => {
  cellNumber-- // Converter para 0-based
  const row = Math.floor(cellNumber / cols)
  const col = cellNumber % cols
  return { row, col }
}

// Função para desenhar um retângulo mesclado com arredondamento e espaçamento
const drawMergedRect = (pdf, startX, startY, colWidth, rowHeight, cells, cols, cardNumber = null) => {
  if (cells.length === 0) return

  const spacing = 0.75 // 0.75mm de cada lado = 1.5mm total de separação
  const radius = 2 // Raio dos cantos arredondados em mm

  // Encontrar bounds das células
  const positions = cells.map(cell => getCellPosition(cell, cols))
  const minCol = Math.min(...positions.map(p => p.col))
  const maxCol = Math.max(...positions.map(p => p.col))
  const minRow = Math.min(...positions.map(p => p.row))
  const maxRow = Math.max(...positions.map(p => p.row))

  const x = startX + minCol * colWidth + spacing
  const y = startY + minRow * rowHeight + spacing
  const width = (maxCol - minCol + 1) * colWidth - spacing * 2
  const height = (maxRow - minRow + 1) * rowHeight - spacing * 2

  // Desenhar retângulo com cantos arredondados
  pdf.roundedRect(x, y, width, height, radius, radius)

  // Adicionar número do card no centro
  if (cardNumber !== null) {
    const centerX = x + width / 2
    const centerY = y + height / 2

    pdf.setFontSize(8)
    pdf.setTextColor(180, 180, 180) // Cinza claro
    pdf.setFont(undefined, 'normal')
    pdf.text(String(cardNumber), centerX, centerY, { align: 'center', baseline: 'middle' })
    pdf.setTextColor(0, 0, 0) // Voltar para preto
  }
}

export const generateDuplicataPDF = async (boleto, conta, logoUrl) => {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  // Dimensões da Duplicata
  const duplicataWidth = 190 // 19cm em mm
  const duplicataHeight = 120 // 12cm em mm
  const cols = 6
  const rows = 13

  // Calcular dimensões de cada célula
  const colWidth = duplicataWidth / cols
  const rowHeight = duplicataHeight / rows

  // Posição inicial da Duplicata no PDF
  const startX = 10
  const startY = 10

  try {
    pdf.setDrawColor(0, 0, 0)
    pdf.setLineWidth(0.4)

    // ===== DESENHAR GRID COM MESCLAGENS =====

    // Card 1: Logo + Dados cedente (1,2,3,4,7,8,9,10,13,14,15,16)
    drawMergedRect(pdf, startX, startY, colWidth, rowHeight, [1,2,3,4,7,8,9,10,13,14,15,16], cols, 1)

    // Card 2: Telefone cedente (5,11)
    drawMergedRect(pdf, startX, startY, colWidth, rowHeight, [5,11], cols, 2)

    // Card 3: Espaço vazio (6,12)
    drawMergedRect(pdf, startX, startY, colWidth, rowHeight, [6,12], cols, 3)

    // Card 4: Para uso de Instituição (17,18)
    drawMergedRect(pdf, startX, startY, colWidth, rowHeight, [17,18], cols, 4)

    // Card 5: Tabelas Fatura/Duplicata (20,21,22,23,26,27,28,29)
    drawMergedRect(pdf, startX, startY, colWidth, rowHeight, [20,21,22,23,26,27,28,29], cols, 5)

    // Card 6: Desconto (24,30,36)
    drawMergedRect(pdf, startX, startY, colWidth, rowHeight, [24,30,36], cols, 6)

    // Card 7: Dados Sacado header (32,33,34,35)
    drawMergedRect(pdf, startX, startY, colWidth, rowHeight, [32,33,34,35], cols, 7)

    // Card 8: Coluna esquerda vertical (19,25,31,37,43,49,55,61,67,73,79)
    drawMergedRect(pdf, startX, startY, colWidth, rowHeight, [19,25,31,37,43,49,55,61,67,73,79], cols, 8)

    // Card 9: Grande área central (38,39,40,41,42,44,45,46,47,48,50,51,52,53,54,56,57,58,59,60,62,63,64,65,66)
    drawMergedRect(pdf, startX, startY, colWidth, rowHeight, [38,39,40,41,42,44,45,46,47,48,50,51,52,53,54,56,57,58,59,60,62,63,64,65,66], cols, 9)

    // Card 10: Assinatura (68,69,70,71,72)
    drawMergedRect(pdf, startX, startY, colWidth, rowHeight, [68,69,70,71,72], cols, 10)

    // ===== ADICIONAR CONTEÚDO NAS ÁREAS =====

    pdf.setTextColor(0, 0, 0)
    pdf.setFont(undefined, 'normal')

    // ===== CARD 1: LOGO (1/4) + DADOS CEDENTE (3/4) =====
    // Calcular dimensões do card 1
    const card1Positions = [1,2,3,4,7,8,9,10,13,14,15,16].map(cell => getCellPosition(cell, cols))
    const card1MinCol = Math.min(...card1Positions.map(p => p.col))
    const card1MaxCol = Math.max(...card1Positions.map(p => p.col))
    const card1MinRow = Math.min(...card1Positions.map(p => p.row))
    const card1MaxRow = Math.max(...card1Positions.map(p => p.row))

    const spacing = 0.75
    const card1X = startX + card1MinCol * colWidth + spacing
    const card1Y = startY + card1MinRow * rowHeight + spacing
    const card1Width = (card1MaxCol - card1MinCol + 1) * colWidth - spacing * 2
    const card1Height = (card1MaxRow - card1MinRow + 1) * rowHeight - spacing * 2

    const card1LogoWidth = card1Width / 4
    const card1DataWidth = card1Width * 3 / 4

    // Logo (1/4 da largura) - usar logo armazenado na conta, não URL
    const logoData = conta?.logo || null
    if (logoData) {
      try {
        console.log('[Duplicata] Logo encontrado na conta, tamanho:', logoData.length)
        const logoHeight = card1Height - 2
        const logoWidth = card1LogoWidth - 2

        // Determinar tipo de imagem baseado no conteúdo
        let imgFormat = 'PNG'
        let imgDataUri = logoData

        // Se não começar com data:, é provavelmente base64 puro
        if (!logoData.startsWith('data:')) {
          // Verificar se é PNG ou JPG baseado na assinatura
          if (logoData.startsWith('iVBO')) {
            imgDataUri = 'data:image/png;base64,' + logoData
          } else if (logoData.startsWith('/9j/')) {
            imgDataUri = 'data:image/jpeg;base64,' + logoData
            imgFormat = 'JPEG'
          } else {
            // Assume PNG como padrão
            imgDataUri = 'data:image/png;base64,' + logoData
          }
        }

        pdf.addImage(imgDataUri, imgFormat, card1X + 1, card1Y + 1, logoWidth, logoHeight, undefined, 'FAST')
        console.log('[Duplicata] ✓ Logo carregada com sucesso')
      } catch (e) {
        console.warn('[Duplicata] Erro ao carregar logo:', e.message)
      }
    } else {
      console.warn('[Duplicata] Nenhum logo disponível (campo logo vazio na conta)')
    }

    // Dados cedente (3/4 da largura)
    pdf.setFontSize(8)
    const cedenteX = card1X + card1LogoWidth + 1
    const cedenteY = card1Y + 1

    pdf.setFont(undefined, 'normal')
    pdf.text('RAZÃO SOCIAL:', cedenteX, cedenteY)
    pdf.setFont(undefined, 'normal')
    pdf.text((conta?.nome_correntista || 'EMPRESA').toUpperCase(), cedenteX, cedenteY + 2.5, { maxWidth: card1DataWidth - 2 })

    pdf.setFont(undefined, 'normal')
    pdf.text('CNPJ:', cedenteX, cedenteY + 5)
    pdf.setFont(undefined, 'normal')
    pdf.text((conta?.cic || '00.000.000/0000-00').toUpperCase(), cedenteX, cedenteY + 7, { maxWidth: card1DataWidth - 2 })

    pdf.setFont(undefined, 'normal')
    pdf.text('ENDEREÇO:', cedenteX, cedenteY + 10)
    pdf.setFont(undefined, 'normal')
    pdf.text((conta?.endereco || 'RUA').toUpperCase(), cedenteX, cedenteY + 12, { maxWidth: card1DataWidth - 2 })

    pdf.setFont(undefined, 'normal')
    pdf.text('MUNICÍPIO / UF:', cedenteX, cedenteY + 15)
    pdf.setFont(undefined, 'normal')
    pdf.text(((conta?.cidade || '') + ' - ' + (conta?.uf || '')).toUpperCase(), cedenteX, cedenteY + 17, { maxWidth: card1DataWidth - 2 })

    pdf.setFont(undefined, 'normal')
    pdf.text('CEP:', cedenteX, cedenteY + 20)
    pdf.setFont(undefined, 'normal')
    pdf.text((conta?.cep || '00000-000').toUpperCase(), cedenteX, cedenteY + 22, { maxWidth: card1DataWidth / 2 - 2 })

    pdf.setFont(undefined, 'normal')
    pdf.text('TELEFONE:', cedenteX + card1DataWidth / 2, cedenteY + 20)
    pdf.setFont(undefined, 'normal')
    pdf.text((conta?.telefone || '').toUpperCase(), cedenteX + card1DataWidth / 2, cedenteY + 22, { maxWidth: card1DataWidth / 2 - 2 })

    // ===== CARD 3: DUPLICATA (centralizado vertical) =====
    const card3Positions = [6,12].map(cell => getCellPosition(cell, cols))
    const card3MinCol = Math.min(...card3Positions.map(p => p.col))
    const card3MaxCol = Math.max(...card3Positions.map(p => p.col))
    const card3MinRow = Math.min(...card3Positions.map(p => p.row))
    const card3MaxRow = Math.max(...card3Positions.map(p => p.row))

    const card3X = startX + card3MinCol * colWidth + spacing
    const card3Y = startY + card3MinRow * rowHeight + spacing
    const card3Width = (card3MaxCol - card3MinCol + 1) * colWidth - spacing * 2
    const card3Height = (card3MaxRow - card3MinRow + 1) * rowHeight - spacing * 2

    pdf.setFontSize(8)
    pdf.setFont(undefined, 'normal')
    pdf.text('DUPLICATA', card3X + card3Width / 2, card3Y + card3Height / 2, { align: 'center', baseline: 'middle' })

    // ===== CARD 5: LINHA DIVISÓRIA (Fatura | Duplicata) =====
    const card5Positions = [20,21,22,23,26,27,28,29].map(cell => getCellPosition(cell, cols))
    const card5MinCol = Math.min(...card5Positions.map(p => p.col))
    const card5MaxCol = Math.max(...card5Positions.map(p => p.col))
    const card5MinRow = Math.min(...card5Positions.map(p => p.row))
    const card5MaxRow = Math.max(...card5Positions.map(p => p.row))

    const card5X = startX + card5MinCol * colWidth + spacing
    const card5Y = startY + card5MinRow * rowHeight + spacing
    const card5Width = (card5MaxCol - card5MinCol + 1) * colWidth - spacing * 2
    const card5Height = (card5MaxRow - card5MinRow + 1) * rowHeight - spacing * 2

    // Linha horizontal dividindo o card ao meio
    const card5MidY = card5Y + card5Height / 2
    pdf.setDrawColor(0, 0, 0)
    pdf.setLineWidth(0.4)
    pdf.line(card5X, card5MidY, card5X + card5Width, card5MidY)

    // Linhas verticais dividindo o card em 4 colunas
    const card5Col1X = card5X + card5Width / 4
    const card5Col2X = card5X + card5Width / 2
    const card5Col3X = card5X + (card5Width * 3) / 4

    pdf.line(card5Col1X, card5Y, card5Col1X, card5Y + card5Height) // 1ª linha vertical (25%)
    pdf.line(card5Col2X, card5Y, card5Col2X, card5Y + card5Height) // 2ª linha vertical (50%)
    pdf.line(card5Col3X, card5Y, card5Col3X, card5Y + card5Height) // 3ª linha vertical (75%)

    // Labels nas 4 colunas do Card 5 - alinhados verticalmente com o centro da linha horizontal
    const card5LabelY = card5Y + card5Height / 2 // Centro da linha horizontal

    pdf.setFontSize(8)
    pdf.setFont(undefined, 'normal')

    // Coluna 1: "NF-FATURA"
    const col1CenterX = card5X + (card5Col1X - card5X) / 2
    pdf.text('NF-FATURA', col1CenterX, card5LabelY, { align: 'center', baseline: 'middle' })

    // Coluna 2: "DUPLICATA VALOR R$" (com quebra de linha)
    const col2CenterX = card5Col1X + (card5Col2X - card5Col1X) / 2
    pdf.text('DUPLICATA', col2CenterX, card5LabelY - 1.5, { align: 'center' })
    pdf.text('VALOR R$', col2CenterX, card5LabelY + 1.5, { align: 'center' })

    // Coluna 3: "DUPLICATA Nº"
    const col3CenterX = card5Col2X + (card5Col3X - card5Col2X) / 2
    pdf.text('DUPLICATA', col3CenterX, card5LabelY - 1.5, { align: 'center' })
    pdf.text('Nº', col3CenterX, card5LabelY + 1.5, { align: 'center' })

    // Coluna 4: "VENCIMENTO"
    const col4CenterX = card5Col3X + (card5X + card5Width - card5Col3X) / 2
    pdf.text('VENCIMENTO', col4CenterX, card5LabelY, { align: 'center', baseline: 'middle' })

    // ===== CARD 6: PARA USO DA INSTITUIÇÃO =====
    const card6Positions = [24,30,36].map(cell => getCellPosition(cell, cols))
    const card6MinCol = Math.min(...card6Positions.map(p => p.col))
    const card6MaxCol = Math.max(...card6Positions.map(p => p.col))
    const card6MinRow = Math.min(...card6Positions.map(p => p.row))
    const card6MaxRow = Math.max(...card6Positions.map(p => p.row))

    const card6X = startX + card6MinCol * colWidth + spacing
    const card6Y = startY + card6MinRow * rowHeight + spacing
    const card6Width = (card6MaxCol - card6MinCol + 1) * colWidth - spacing * 2
    const card6Height = (card6MaxRow - card6MinRow + 1) * rowHeight - spacing * 2

    pdf.setFontSize(8)
    pdf.setFont(undefined, 'normal')
    pdf.text('USO DA INSTITUIÇÃO', card6X + card6Width / 2, card6Y + card6Height / 6, { align: 'center', baseline: 'middle' })

    // ===== CARD 8: LINHA PARA ASSINATURA =====
    const card8Positions = [19,25,31,37,43,49,55,61,67,73,79].map(cell => getCellPosition(cell, cols))
    const card8MinCol = Math.min(...card8Positions.map(p => p.col))
    const card8MaxCol = Math.max(...card8Positions.map(p => p.col))
    const card8MinRow = Math.min(...card8Positions.map(p => p.row))
    const card8MaxRow = Math.max(...card8Positions.map(p => p.row))

    const card8X = startX + card8MinCol * colWidth + spacing
    const card8Y = startY + card8MinRow * rowHeight + spacing
    const card8Width = (card8MaxCol - card8MinCol + 1) * colWidth - spacing * 2
    const card8Height = (card8MaxRow - card8MinRow + 1) * rowHeight - spacing * 2

    // Desenhar linha vertical para assinatura - posicionada à direita do card
    const card8LineX = card8X + card8Width * 0.75 // 75% da largura (mais à direita)
    const card8SignatureLineStartY = card8Y + 2 // Começar próximo ao topo
    const card8SignatureLineEndY = card8Y + card8Height - 2 // Terminar próximo ao fundo
    pdf.setDrawColor(0, 0, 0)
    pdf.setLineWidth(0.2) // Linha mais fina
    pdf.line(card8LineX, card8SignatureLineStartY, card8LineX, card8SignatureLineEndY)

    // Label "ASSINATURA DO EMITENTE" vertical ao lado direito da linha, centralizado pela altura do card
    // Desenhar letra por letra (90 graus rotacionado)
    const labelVertical = 'ASSINATURA DO EMITENTE'
    const charSpacing = 1.2 // espaço entre caracteres
    const card8CenterY = card8Y + card8Height / 2 // altura central do card
    const textX = card8LineX + 4 // um pouco à direita da linha

    // Calcular ponto de início para centralizar o texto pela altura
    const totalTextHeight = labelVertical.length * charSpacing
    const textStartY = card8CenterY + (totalTextHeight / 2) // começar do centro

    pdf.setFontSize(8)
    pdf.setFont(undefined, 'normal')
    let currentY = textStartY
    for (let i = labelVertical.length - 1; i >= 0; i--) {
      pdf.text(labelVertical[i], textX, currentY, { align: 'left' })
      currentY += charSpacing
    }

    // ===== CARD 9: DADOS DO SACADO =====
    const card9Positions = [38,39,40,41,42,44,45,46,47,48,50,51,52,53,54,56,57,58,59,60,62,63,64,65,66].map(cell => getCellPosition(cell, cols))
    const card9MinCol = Math.min(...card9Positions.map(p => p.col))
    const card9MaxCol = Math.max(...card9Positions.map(p => p.col))
    const card9MinRow = Math.min(...card9Positions.map(p => p.row))
    const card9MaxRow = Math.max(...card9Positions.map(p => p.row))

    const card9X = startX + card9MinCol * colWidth + spacing + 10 // Avanço de 1cm (10mm) para direita
    const card9Y = startY + card9MinRow * rowHeight + spacing
    const card9Width = (card9MaxCol - card9MinCol + 1) * colWidth - spacing * 2 - 10 // Ajusta largura
    const card9Height = (card9MaxRow - card9MinRow + 1) * rowHeight - spacing * 2

    pdf.setFont(undefined, 'normal')
    pdf.setFontSize(8)
    pdf.text('DADOS DO SACADO:', card9X, card9Y + 7)

    pdf.setFont(undefined, 'normal')
    pdf.setFontSize(8)

    // Razão Social - posicionada no mesmo alinhamento que "Dados do Sacado:"
    const card9DataStartY = card9Y + 11 // Logo após "Dados do Sacado:" (7 + 4mm de espaço)
    const card9DataX = card9X + 5 // Recuo de 5mm para o lado esquerdo
    pdf.setFont(undefined, 'normal')
    pdf.text('RAZÃO SOCIAL:', card9DataX, card9DataStartY)
    pdf.setFont(undefined, 'normal')
    pdf.text((boleto.sacado_nome || '').toUpperCase(), card9DataX, card9DataStartY + 2, { maxWidth: card9Width - 2 })

    // CNPJ/CPF - linha seguinte
    pdf.setFont(undefined, 'normal')
    pdf.text('CNPJ/CPF:', card9DataX, card9DataStartY + 6)
    pdf.setFont(undefined, 'normal')
    pdf.text((boleto.sacado_cic || '').toUpperCase(), card9DataX, card9DataStartY + 8)

    // Endereço - linha seguinte
    pdf.setFont(undefined, 'normal')
    pdf.text('ENDEREÇO:', card9DataX, card9DataStartY + 12)
    pdf.setFont(undefined, 'normal')
    pdf.text((boleto.sacado_endereco || '').toUpperCase(), card9DataX, card9DataStartY + 14, { maxWidth: card9Width - 2 })

    // Município/UF, CEP, Celular e Telefone na mesma linha
    const bottomLineY = card9DataStartY + 19
    const colWidth1 = card9Width / 4 - 1
    const colWidth2 = card9Width / 4 - 1
    const colWidth3 = card9Width / 4 - 1
    const colWidth4 = card9Width / 4 - 1

    // Município/UF
    pdf.setFont(undefined, 'normal')
    pdf.text('MUNICÍPIO/UF:', card9DataX, bottomLineY - 2)
    pdf.setFont(undefined, 'normal')
    pdf.text(((boleto.sacado_cidade || '') + ' - ' + (boleto.sacado_uf || '')).toUpperCase(), card9DataX, bottomLineY, { maxWidth: colWidth1 })

    // CEP
    pdf.setFont(undefined, 'normal')
    pdf.text('CEP:', card9DataX + colWidth1 + 1, bottomLineY - 2)
    pdf.setFont(undefined, 'normal')
    pdf.text((boleto.sacado_cep || '').toUpperCase(), card9DataX + colWidth1 + 1, bottomLineY, { maxWidth: colWidth2 })

    // Celular
    pdf.setFont(undefined, 'normal')
    pdf.text('CEL:', card9DataX + (colWidth1 + colWidth2) + 2, bottomLineY - 2)
    pdf.setFont(undefined, 'normal')
    pdf.text((boleto.sacado_celular || '').toUpperCase(), card9DataX + (colWidth1 + colWidth2) + 2, bottomLineY, { maxWidth: colWidth3 })

    // Telefone
    pdf.setFont(undefined, 'normal')
    pdf.text('TELEFONE:', card9DataX + (colWidth1 + colWidth2 + colWidth3) + 3, bottomLineY - 2)
    pdf.setFont(undefined, 'normal')
    pdf.text((boleto.sacado_telefone || '').toUpperCase(), card9DataX + (colWidth1 + colWidth2 + colWidth3) + 3, bottomLineY, { maxWidth: colWidth4 })

    const blob = pdf.output('blob')
    return blob
  } catch (error) {
    console.error('[Duplicata] Erro ao gerar PDF:', error)
    throw error
  }
}
