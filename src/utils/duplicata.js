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

// Converte número para extenso no padrão monetário brasileiro (reais e centavos)
// Ex.: 6456.32 -> "seis mil quatrocentos e cinquenta e seis reais e trinta e dois centavos"
const converterNumeroParaExtenso = (numero) => {
  const valor = typeof numero === 'string'
    ? parseFloat(numero.replace(/\./g, '').replace(',', '.'))
    : parseFloat(numero)
  if (isNaN(valor)) return ''

  const totalCentavos = Math.round(valor * 100)
  const reais = Math.floor(totalCentavos / 100)
  const centavos = totalCentavos % 100

  const unidades = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

  // Converte um grupo de 0..999 em extenso
  const ate999 = (n) => {
    if (n === 0) return ''
    if (n === 100) return 'cem'
    let s = ''
    const c = Math.floor(n / 100)
    const resto = n % 100
    if (c > 0) s += centenas[c]
    if (resto > 0) {
      if (c > 0) s += ' e '
      if (resto < 20) s += unidades[resto]
      else {
        s += dezenas[Math.floor(resto / 10)]
        if (resto % 10 > 0) s += ' e ' + unidades[resto % 10]
      }
    }
    return s
  }

  // Converte um inteiro qualquer (até bilhões) em extenso
  const inteiroExtenso = (n) => {
    if (n === 0) return 'zero'
    const grupos = [
      { div: 1000000000, sing: ' bilhão', plur: ' bilhões' },
      { div: 1000000, sing: ' milhão', plur: ' milhões' },
      { div: 1000, sing: ' mil', plur: ' mil' },
      { div: 1, sing: '', plur: '' },
    ]
    let restante = n
    const partes = []
    for (const g of grupos) {
      const q = Math.floor(restante / g.div)
      restante = restante % g.div
      if (q > 0) {
        if (g.div === 1000) {
          partes.push(q === 1 ? 'mil' : ate999(q) + ' mil')
        } else if (g.div === 1) {
          partes.push(ate999(q))
        } else {
          partes.push(ate999(q) + (q === 1 ? g.sing : g.plur))
        }
      }
    }
    // Junta os grupos; usa " e " antes do último grupo quando ele for < 100 ou centena exata
    const ultimo = n % 1000
    const ligaUltimo = ultimo > 0 && (ultimo < 100 || ultimo % 100 === 0)
    let texto = ''
    for (let i = 0; i < partes.length; i++) {
      if (i === 0) texto = partes[i]
      else {
        const isLast = i === partes.length - 1
        texto += (isLast && ligaUltimo ? ' e ' : ' ') + partes[i]
      }
    }
    return texto
  }

  let resultado = ''
  if (reais > 0) {
    resultado += inteiroExtenso(reais) + (reais === 1 ? ' real' : ' reais')
  }
  if (centavos > 0) {
    if (reais > 0) resultado += ' '
    resultado += inteiroExtenso(centavos) + (centavos === 1 ? ' centavo' : ' centavos')
  }
  if (reais === 0 && centavos === 0) resultado = 'zero reais'

  return resultado
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
}

// Grade de referência (papel milimetrado) de cellSize x cellSize mm.
// Desenha linhas finas em cinza claro e rótulos: colunas A,B,...,Z,AA,... no topo
// e linhas 1,2,... à esquerda. Serve como auxílio para posicionar labels/campos.
const drawReferenceGrid = (pdf, startX, startY, width, height, cellSize = 5, rowsOverride = null) => {
  const numCols = Math.floor(width / cellSize)
  const numRows = rowsOverride != null ? rowsOverride : Math.floor(height / cellSize)

  // Converte índice 0-based em rótulo de coluna estilo planilha (A..Z, AA, AB, ...)
  const colLabel = (n) => {
    let s = ''
    n++
    while (n > 0) {
      const rem = (n - 1) % 26
      s = String.fromCharCode(65 + rem) + s
      n = Math.floor((n - 1) / 26)
    }
    return s
  }

  // Linhas finas em cinza claro
  pdf.setDrawColor(170, 170, 170)
  pdf.setLineWidth(0.1)

  // Linhas verticais (colunas)
  for (let c = 0; c <= numCols; c++) {
    const x = startX + c * cellSize
    pdf.line(x, startY, x, startY + numRows * cellSize)
  }
  // Linhas horizontais (linhas)
  for (let r = 0; r <= numRows; r++) {
    const y = startY + r * cellSize
    pdf.line(startX, y, startX + numCols * cellSize, y)
  }

  // Rótulos — fonte adaptada ao tamanho da célula para caber em células pequenas
  const labelFont = Math.max(2.5, Math.min(5, cellSize - 0.5))
  pdf.setFontSize(labelFont)
  pdf.setFont(undefined, 'normal')
  pdf.setTextColor(120, 120, 120)

  // Colunas (A, B, ...) acima de cada coluna, centralizadas
  for (let c = 0; c < numCols; c++) {
    const cx = startX + c * cellSize + cellSize / 2
    pdf.text(colLabel(c), cx, startY - 0.8, { align: 'center', baseline: 'bottom' })
  }
  // Linhas (1, 2, ...) à esquerda de cada linha, centralizadas verticalmente
  for (let r = 0; r < numRows; r++) {
    const cy = startY + r * cellSize + cellSize / 2
    pdf.text(String(r + 1), startX - 1, cy, { align: 'right', baseline: 'middle' })
  }

  // Restaurar padrões (preto / linha padrão)
  pdf.setTextColor(0, 0, 0)
  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.4)
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

    // ===== MOLDURA EXTERNA (todo o polígono da duplicata, cantos arredondados) =====
    // Posicionada 1,5mm para fora dos cards externos (mesma folga entre os cards)
    const frameSpacing = 0.75 // metade da folga de 1,5mm entre cards
    const frameTop = startY - frameSpacing
    const frameBottom = startY + 130 // estende a moldura para cobrir a área de aceite/assinatura abaixo dos cards
    pdf.roundedRect(
      startX - frameSpacing,
      frameTop,
      duplicataWidth + frameSpacing * 2,
      frameBottom - frameTop,
      3, 3
    )

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

    // Posicionamento pela grade de referência de 2mm:
    // coluna X = startX + indice*2 ; linha Y (centro da faixa) = startY + (linha-1)*2 + 1
    const GRID_MM = 2
    const gridColX = (idx0) => startX + idx0 * GRID_MM
    const gridRowY = (rowNum) => startY + (rowNum - 1) * GRID_MM + GRID_MM / 2
    const colS_X = gridColX(18)   // coluna S
    const colAH_X = gridColX(33)  // coluna AH
    const colAI_X = gridColX(34)  // coluna AI
    const colAL_X = gridColX(37)  // coluna AL
    const colAW_X = gridColX(48)  // coluna AW
    const colAZ_X = gridColX(51)  // coluna AZ
    const colBB_X = gridColX(53)  // coluna BB
    const colBE_X = gridColX(56)  // coluna BE
    const colBH_X = gridColX(59)  // coluna BH
    const colBJ_X = gridColX(61)  // coluna BJ
    const colBN_X = gridColX(65)  // coluna BN
    const colBO_X = gridColX(66)  // coluna BO
    const colBQ_X = gridColX(68)  // coluna BQ
    const colBV_X = gridColX(73)  // coluna BV
    const colCA_X = gridColX(78)  // coluna CA
    const colCC_X = gridColX(80)  // coluna CC
    const razaoMaxWidth = colBN_X - colS_X - 2
    const cnpjMaxWidth = (card1X + card1Width) - colBN_X - 1

    // Razão Social (coluna S): label na linha 2, nome da empresa na linha 4
    pdf.setFont(undefined, 'normal')
    pdf.text('RAZÃO SOCIAL:', colS_X, gridRowY(2), { baseline: 'middle' })
    pdf.text((conta?.nome_correntista || 'EMPRESA').toUpperCase(), colS_X, gridRowY(4), { baseline: 'middle', maxWidth: razaoMaxWidth })

    // Endereço (coluna S): label na linha 6, rua na linha 8
    pdf.text('ENDEREÇO:', colS_X, gridRowY(6), { baseline: 'middle' })
    pdf.text((conta?.endereco || 'RUA').toUpperCase(), colS_X, gridRowY(8), { baseline: 'middle', maxWidth: razaoMaxWidth })

    // CNPJ (coluna BN): label na linha 2, número na linha 4
    pdf.text('CNPJ:', colBN_X, gridRowY(2), { baseline: 'middle' })
    pdf.text((conta?.cic || '00.000.000/0000-00').toUpperCase(), colBN_X, gridRowY(4), { baseline: 'middle', maxWidth: cnpjMaxWidth })

    // Município (coluna S), CEP (coluna AI), Telefone (coluna AW) — labels linha 10, campos linha 12
    pdf.setFont(undefined, 'normal')
    pdf.text('MUNICÍPIO:', colS_X, gridRowY(10), { baseline: 'middle' })
    pdf.text(((conta?.cidade || '') + ' - ' + (conta?.uf || '')).toUpperCase(), colS_X, gridRowY(12), { baseline: 'middle', maxWidth: colAL_X - colS_X - 2 })

    pdf.text('CEP:', colAL_X, gridRowY(10), { baseline: 'middle' })
    pdf.text((conta?.cep || '00000-000').toUpperCase(), colAL_X, gridRowY(12), { baseline: 'middle', maxWidth: colAW_X - colAL_X - 2 })

    pdf.text('TELEFONE:', colAW_X, gridRowY(10), { baseline: 'middle' })
    pdf.text((conta?.telefone || '').toUpperCase(), colAW_X, gridRowY(12), { baseline: 'middle', maxWidth: (card1X + card1Width) - colAW_X - 1 })

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

    // Labels nas 4 colunas do Card 5 - na linha 16 da grade, mantendo as posições de largura
    const card5LabelY = gridRowY(16) // linha 16 (y=41)

    pdf.setFontSize(8)
    pdf.setFont(undefined, 'normal')

    // Coluna 1: "NF-FATURA"
    const col1CenterX = card5X + (card5Col1X - card5X) / 2
    pdf.text('NF-FATURA', col1CenterX, card5LabelY, { align: 'center', baseline: 'middle' })

    // Coluna 2: "DUPLICATA VALOR R$" (com quebra de linha) - linha de cima na L16
    const col2CenterX = card5Col1X + (card5Col2X - card5Col1X) / 2
    pdf.text('DUPLICATA', col2CenterX, card5LabelY, { align: 'center', baseline: 'middle' })
    pdf.text('VALOR R$', col2CenterX, card5LabelY + 3, { align: 'center', baseline: 'middle' })

    // Coluna 3: "DUPLICATA Nº" - linha de cima na L16
    const col3CenterX = card5Col2X + (card5Col3X - card5Col2X) / 2
    pdf.text('DUPLICATA', col3CenterX, card5LabelY, { align: 'center', baseline: 'middle' })
    pdf.text('Nº', col3CenterX, card5LabelY + 3, { align: 'center', baseline: 'middle' })

    // Coluna 4: "VENCIMENTO"
    const col4CenterX = card5Col3X + (card5X + card5Width - card5Col3X) / 2
    pdf.text('VENCIMENTO', col4CenterX, card5LabelY, { align: 'center', baseline: 'middle' })

    // Valores do título (linha 21): valor (coluna AL), número documento (coluna BB), vencimento (coluna BQ)
    pdf.setFontSize(8)
    pdf.setFont(undefined, 'normal')
    pdf.text(formatMoeda(boleto?.valor || 0), colAL_X, gridRowY(21), { baseline: 'middle' })
    pdf.text(String(boleto?.numero_documento || ''), gridColX(50), gridRowY(21), { baseline: 'middle' })
    pdf.text(formatDate(boleto?.data_vencimento), colBQ_X, gridRowY(21), { baseline: 'middle' })

    // DATA EMISSÃO — no card em branco (Card 4), abaixo do bloco CNPJ / DUPLICATA
    const card4X = startX + 4 * colWidth + spacing
    const card4Y = startY + 2 * rowHeight + spacing
    const card4Width = 2 * colWidth - spacing * 2
    const card4Height = rowHeight - spacing * 2
    pdf.setFontSize(8)
    pdf.setFont(undefined, 'normal')
    pdf.text('DATA EMISSÃO: ' + formatDate(boleto?.data_emissao), card4X + card4Width / 2, card4Y + card4Height / 2, { align: 'center', baseline: 'middle' })

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

    // ===== CARD 7: DESCONTO / CONDIÇÕES ESPECIAIS =====
    pdf.setFontSize(8)
    pdf.setFont(undefined, 'normal')
    pdf.text('DESCONTO DE             %                    SOBRE R$                     ATÉ', colS_X, gridRowY(25), { baseline: 'middle' })
    pdf.text('CONDIÇÕES ESPECIAIS', colS_X, gridRowY(27), { baseline: 'middle' })

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

    // Label "ASSINATURA DO EMITENTE" rotacionado 90° para a esquerda, ancorado em X=56 / Y=102 (mm)
    pdf.setFontSize(8)
    pdf.setFont(undefined, 'normal')
    pdf.text('ASSINATURA DO EMITENTE', 56, 102, { align: 'center', baseline: 'middle', angle: 90 })
    // Âncora invisível (ZapSign) — assinatura do EMITENTE (cedente)
    pdf.setTextColor(255, 255, 255)
    pdf.text('<<cedente>>', card8LineX - 6, card8Y + card8Height / 2, { align: 'center' })
    pdf.setTextColor(0, 0, 0)

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
    pdf.text('DADOS DO SACADO:', colS_X, gridRowY(30), { baseline: 'middle' })

    // Razão Social (coluna S): label linha 33, campo linha 35
    pdf.text('RAZÃO SOCIAL:', colS_X, gridRowY(33), { baseline: 'middle' })
    pdf.text((boleto.sacado_nome || '').toUpperCase(), colS_X, gridRowY(35), { baseline: 'middle', maxWidth: colBH_X - colS_X - 2 })

    // CNPJ/CPF (coluna BH): label linha 33, campo linha 35
    pdf.text('CNPJ/CPF:', colBH_X, gridRowY(33), { baseline: 'middle' })
    pdf.text((boleto.sacado_cic || '').toUpperCase(), colBH_X, gridRowY(35), { baseline: 'middle', maxWidth: (startX + duplicataWidth) - colBH_X - 2 })

    // Endereço (coluna S): label linha 37, campo linha 39
    pdf.text('ENDEREÇO:', colS_X, gridRowY(37), { baseline: 'middle' })
    pdf.text((boleto.sacado_endereco || '').toUpperCase(), colS_X, gridRowY(39), { baseline: 'middle', maxWidth: colCA_X - colS_X })

    // Município/UF (coluna S): label linha 41, campo linha 43
    pdf.text('MUNICÍPIO/UF:', colS_X, gridRowY(41), { baseline: 'middle' })
    pdf.text(((boleto.sacado_cidade || '') + ' - ' + (boleto.sacado_uf || '')).toUpperCase(), colS_X, gridRowY(43), { baseline: 'middle', maxWidth: colCA_X - colS_X })

    // Linha inferior (labels linha 45, campos linha 47): CEP (S), CEL (BH), TELEFONE (CA)
    pdf.text('CEP:', colS_X, gridRowY(45), { baseline: 'middle' })
    pdf.text((boleto.sacado_cep || '').toUpperCase(), colS_X, gridRowY(47), { baseline: 'middle', maxWidth: colBH_X - colS_X - 2 })

    pdf.text('CEL:', colBH_X, gridRowY(45), { baseline: 'middle' })
    pdf.text((boleto.sacado_celular || '').toUpperCase(), colBH_X, gridRowY(47), { baseline: 'middle', maxWidth: colCA_X - colBH_X - 2 })

    pdf.text('TELEFONE:', colCA_X, gridRowY(45), { baseline: 'middle' })
    pdf.text((boleto.sacado_telefone || '').toUpperCase(), colCA_X, gridRowY(47), { baseline: 'middle', maxWidth: (startX + duplicataWidth) - colCA_X - 1 })

    // ===== CARD 10: VALOR POR EXTENSO =====
    const card10Positions = [68,69,70,71,72].map(cell => getCellPosition(cell, cols))
    const card10MinCol = Math.min(...card10Positions.map(p => p.col))
    const card10MaxCol = Math.max(...card10Positions.map(p => p.col))
    const card10MinRow = Math.min(...card10Positions.map(p => p.row))
    const card10MaxRow = Math.max(...card10Positions.map(p => p.row))

    const card10X = startX + card10MinCol * colWidth + spacing
    const card10Y = startY + card10MinRow * rowHeight + spacing
    const card10Width = (card10MaxCol - card10MinCol + 1) * colWidth - spacing * 2
    const card10Height = (card10MaxRow - card10MinRow + 1) * rowHeight - spacing * 2

    // Linha vertical dividindo o primeiro quinto da largura do card
    const card10DivX = card10X + card10Width / 5
    pdf.setDrawColor(0, 0, 0)
    pdf.setLineWidth(0.4)
    pdf.line(card10DivX, card10Y, card10DivX, card10Y + card10Height)

    // Label "Valor por extenso" (linha 53, coluna S) e valor por extenso (linha 53, coluna AH)
    pdf.setFontSize(8)
    pdf.setFont(undefined, 'normal')
    pdf.text('VALOR EXTENSO', colS_X, gridRowY(53), { baseline: 'middle' })
    const valorExtenso = converterNumeroParaExtenso(boleto?.valor || 0)
    const valorExtensoUpper = (valorExtenso || '').toUpperCase()
    pdf.text(valorExtensoUpper, colAH_X, gridRowY(53), { baseline: 'middle', maxWidth: (startX + duplicataWidth) - colAH_X - 2 })

    // Texto de confirmação abaixo do card Valor Extenso
    pdf.setFontSize(8)
    pdf.setFont(undefined, 'normal')
    pdf.text('Confirmo a compra, o recebimento da mercadoria e o reconhecimento integral desta duplicata.', colS_X, gridRowY(57), { baseline: 'middle' })

    // ===== ACEITE / ASSINATURA DO SACADO (abaixo da duplicata) =====
    pdf.setFontSize(8)
    pdf.setFont(undefined, 'normal')
    pdf.text('DATA DO ACEITE EM ____/____/_____', colS_X, gridRowY(64), { baseline: 'middle' })
    pdf.text('______________________________________________', colBE_X, gridRowY(62), { baseline: 'middle' })
    pdf.text('ASSINATURA DO SACADO', colBN_X, gridRowY(64), { baseline: 'middle' })
    // Âncora invisível (ZapSign) — assinatura do SACADO (sobre a linha do aceite)
    pdf.setTextColor(255, 255, 255)
    pdf.text('<<sacado>>', colBN_X, gridRowY(61), { baseline: 'middle' })
    pdf.setTextColor(0, 0, 0)

    // Grade de referência 5mm x 5mm (auxílio de posicionamento).
    // Defina como false para ocultar na versão final.
    const SHOW_REFERENCE_GRID = false
    if (SHOW_REFERENCE_GRID) {
      drawReferenceGrid(pdf, startX, startY, duplicataWidth, duplicataHeight, 2, 65)
    }

    // ===== METADE INFERIOR: INSTRUMENTO PARTICULAR DE CESSÃO DE DIREITOS =====
    {
      const pageWid = 210
      const leftX = startX
      const rightX = startX + duplicataWidth
      const lineW = duplicataWidth
      let ty = 159 // início do texto na metade inferior (descido para terminar a 2cm do fim)

      // Dados do CEDENTE (a conta/cedente da duplicata)
      const cedNome = (conta?.nome_correntista || '').toUpperCase()
      const cedDig = String(conta?.cic || '').replace(/\D/g, '')
      const cedDoc = cedDig.length === 14
        ? cedDig.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
        : cedDig.length === 11
          ? cedDig.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
          : (conta?.cic || '')
      const cedDocLbl = cedDig.length === 14 ? 'CNPJ nº' : 'CPF nº'
      const cedEnd = [conta?.endereco, ((conta?.cidade || '') + '-' + (conta?.uf || ''))].filter(p => p && p !== '-').join(', ')

      // Título centralizado
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(8.5)
      pdf.text('INSTRUMENTO PARTICULAR DE CESSÃO DE DIREITOS CREDITÓRIOS E ANTECIPAÇÃO DE RECEBÍVEIS', pageWid / 2, ty, { align: 'center' })
      ty += 7

      pdf.setFontSize(8)
      // CEDENTE (label + nome em negrito, restante normal)
      pdf.setFont('helvetica', 'bold')
      const cedPrefix = `CEDENTE: ${cedNome}`
      pdf.text(cedPrefix, leftX, ty)
      pdf.setFont('helvetica', 'normal')
      pdf.text(`, ${cedDocLbl} ${cedDoc}, residente na ${cedEnd}.`, leftX + pdf.getTextWidth(cedPrefix), ty)
      ty += 4

      // CESSIONÁRIA (fixa: CAPT)
      pdf.setFont('helvetica', 'bold')
      const cesPrefix = 'CESSIONÁRIA: CAPT ADMINISTRAÇÃO DE PAGAMENTOS LTDA'
      pdf.text(cesPrefix, leftX, ty)
      pdf.setFont('helvetica', 'normal')
      pdf.text(', CNPJ nº 08.035.579/0001-30.', leftX + pdf.getTextWidth(cesPrefix), ty)
      ty += 4

      const para = (text) => {
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(8)
        const lines = pdf.splitTextToSize(text, lineW)
        lines.forEach(ln => { pdf.text(ln, leftX, ty); ty += 3.4 })
      }

      para('As partes celebram o presente Instrumento de Cessão de Direitos Creditórios e Antecipação de Recebíveis.')
      ty += 1

      const clausulas = [
        ['CLÁUSULA PRIMEIRA - DO CRÉDITO CEDIDO', 'O CEDENTE declara ser titular dos direitos creditórios decorrentes da duplicata mercantil anexa, originada de venda mercantil regularmente realizada ao SACADO, representada por Nota Fiscal/Fatura e respectiva duplicata.'],
        ['CLÁUSULA SEGUNDA - DA CESSÃO', 'O CEDENTE cede e transfere à CESSIONÁRIA, em caráter irrevogável e irretratável, todos os direitos, ações e garantias relativos ao crédito referido, autorizando sua cobrança administrativa ou judicial.'],
        ['CLÁUSULA TERCEIRA - DA ANTECIPAÇÃO DE RECEBÍVEIS', 'Em contrapartida à cessão, a CESSIONÁRIA pagará ao CEDENTE o valor líquido ajustado para aquisição do crédito. O CEDENTE reconhece que o valor recebido poderá ser inferior ao valor nominal do título em razão de deságio, remuneração da operação, tarifas, custos financeiros e encargos pactuados.'],
        ['CLÁUSULA QUARTA - DAS DECLARAÇÕES E GARANTIAS', 'O CEDENTE declara que é legítimo titular do crédito, que a mercadoria foi entregue ou o serviço prestado, que o crédito é legítimo, líquido, certo e exigível, inexistindo impedimento legal, contratual ou judicial à presente cessão, sendo autênticas todas as informações e documentos fornecidos.'],
        ['CLÁUSULA QUINTA - DA RESPONSABILIDADE DO CEDENTE', 'Constatada fraude, simulação, inexistência do crédito, devolução de mercadorias, cancelamento da nota fiscal, vício da operação comercial, contestação procedente do SACADO ou qualquer fato atribuível ao CEDENTE que impeça a liquidação do título, este restituirá imediatamente à CESSIONÁRIA os valores recebidos, acrescidos de correção monetária, juros legais e despesas incorridas.'],
        ['CLÁUSULA SEXTA - DA NOTIFICAÇÃO AO SACADO', 'A CESSIONÁRIA poderá comunicar a cessão ao SACADO, nos termos do art. 290 do Código Civil, passando os pagamentos a serem efetuados diretamente à CESSIONÁRIA ou a quem indicar.'],
        ['CLÁUSULA SÉTIMA - DA FUNDAMENTAÇÃO LEGAL', 'O presente instrumento é regido pelos arts. 286 a 298 da Lei nº 10.406/2002 e pela Lei nº 5.474/1968, além das demais normas aplicáveis.'],
      ]

      clausulas.forEach(([h, b]) => {
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(8)
        pdf.text(h, leftX, ty)
        ty += 3.8
        para(b)
        ty += 1
      })

      // Assinaturas (CEDENTE e CESSIONÁRIA) — recuadas 1cm nas laterais e ancoradas a 2cm do fim
      const sigInset = 10                 // recuo de 1cm em cada borda lateral
      const sCol = 72
      const sLeftX = leftX + sigInset
      const sRightX = rightX - sigInset
      const lcx = sLeftX + sCol / 2
      const rcx = sRightX - sCol / 2
      let sy = 297 - 10 - 8               // linha das assinaturas (última linha fica a 1cm do fim)
      if (sy < ty + 8) sy = ty + 8        // segurança: garante folga mínima entre texto e assinaturas
      pdf.setDrawColor(0, 0, 0)
      pdf.setLineWidth(0.3)
      pdf.line(sLeftX, sy, sLeftX + sCol, sy)
      pdf.line(sRightX - sCol, sy, sRightX, sy)
      // Âncoras invisíveis (ZapSign) — CEDENTE (esq.) e CESSIONÁRIA/CAPT (dir.) acima das linhas
      pdf.setTextColor(255, 255, 255)
      pdf.text('<<cedente>>', lcx, sy - 9, { align: 'center' })
      pdf.text('<<capt>>', rcx, sy - 9, { align: 'center' })
      pdf.setTextColor(0, 0, 0)
      sy += 4
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.text(cedNome, lcx, sy, { align: 'center' })
      pdf.text('CAPT ADMINISTRAÇÃO DE PAGAMENTOS LTDA', rcx, sy, { align: 'center' })
      sy += 4
      pdf.text(`${cedDocLbl} ${cedDoc}`, lcx, sy, { align: 'center' })
      pdf.text('CNPJ nº 08.035.579/0001-30', rcx, sy, { align: 'center' })
    }

    const blob = pdf.output('blob')
    return blob
  } catch (error) {
    console.error('[Duplicata] Erro ao gerar PDF:', error)
    throw error
  }
}
