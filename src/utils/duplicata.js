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

// ============================================================
// Renderiza a seção de Cessão de Direitos Creditórios em um
// documento jsPDF já existente, a partir de startY (mm).
// ============================================================
export const renderCessaoDireitos = (doc, boleto, conta, startY = 159, pageBottom = 297) => {
  const leftX = 10
  const rightX = 200
  const lineW = 190
  let ty = startY

  const cedNome = (conta?.nome_correntista || '').toUpperCase()
  const cedDig = String(conta?.cic || '').replace(/\D/g, '')
  const cedDoc = cedDig.length === 14
    ? cedDig.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    : cedDig.length === 11
      ? cedDig.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
      : (conta?.cic || '')
  const cedDocLbl = cedDig.length === 14 ? 'CNPJ nº' : 'CPF nº'
  const cedEnd = [conta?.endereco, ((conta?.cidade || '') + '-' + (conta?.uf || ''))].filter(p => p && p !== '-').join(', ')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text('INSTRUMENTO PARTICULAR DE CESSÃO DE DIREITOS CREDITÓRIOS E ANTECIPAÇÃO DE RECEBÍVEIS', 105, ty, { align: 'center' })
  ty += 7

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  const cedPrefix = `CEDENTE: ${cedNome}`
  doc.text(cedPrefix, leftX, ty)
  doc.setFont('helvetica', 'normal')
  doc.text(`, ${cedDocLbl} ${cedDoc}, residente na ${cedEnd}.`, leftX + doc.getTextWidth(cedPrefix), ty)
  ty += 4

  doc.setFont('helvetica', 'bold')
  const cesPrefix = 'CESSIONÁRIA: CAPT ADMINISTRAÇÃO DE PAGAMENTOS LTDA'
  doc.text(cesPrefix, leftX, ty)
  doc.setFont('helvetica', 'normal')
  doc.text(', CNPJ nº 08.035.579/0001-30.', leftX + doc.getTextWidth(cesPrefix), ty)
  ty += 4

  const para = (text) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    const lines = doc.splitTextToSize(text, lineW)
    lines.forEach(ln => { doc.text(ln, leftX, ty); ty += 3.4 })
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
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(h, leftX, ty)
    ty += 3.8
    para(b)
    ty += 1
  })

  const sigInset = 10
  const sCol = 72
  const sLeftX = leftX + sigInset
  const sRightX = rightX - sigInset
  const lcx = sLeftX + sCol / 2
  const rcx = sRightX - sCol / 2
  let sy = pageBottom - 10 - 8
  if (sy < ty + 8) sy = ty + 8
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.3)
  doc.line(sLeftX, sy, sLeftX + sCol, sy)
  doc.line(sRightX - sCol, sy, sRightX, sy)
  doc.setTextColor(255, 255, 255)
  doc.text('<<cedente>>', lcx, sy - 9, { align: 'center' })
  doc.text('<<capt>>', rcx, sy - 9, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  sy += 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(cedNome, lcx, sy, { align: 'center' })
  doc.text('CAPT ADMINISTRAÇÃO DE PAGAMENTOS LTDA', rcx, sy, { align: 'center' })
  sy += 4
  doc.text(`${cedDocLbl} ${cedDoc}`, lcx, sy, { align: 'center' })
  doc.text('CNPJ nº 08.035.579/0001-30', rcx, sy, { align: 'center' })
}

// ============================================================
// Renderiza apenas o grid/conteúdo da Duplicata em um doc jsPDF
// existente (sem Cessão de Direitos).
// ============================================================
export const renderDuplicataOnDoc = async (pdf, boleto, conta, startY = 10) => {
  // Dimensões da Duplicata
  const duplicataWidth = 190 // 19cm em mm
  const duplicataHeight = 120 // 12cm em mm
  const cols = 6
  const rows = 13

  // Posição inicial da Duplicata no PDF
  const startX = 10

  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.4)

  const frameSpacing = 0.75
  const frameTop = startY - frameSpacing
  const frameBottom = startY + 130
  pdf.roundedRect(
    startX - frameSpacing,
    frameTop,
    duplicataWidth + frameSpacing * 2,
    frameBottom - frameTop,
    3, 3
  )

  const colWidth = duplicataWidth / cols
  const rowHeight = duplicataHeight / rows

  drawMergedRect(pdf, startX, startY, colWidth, rowHeight, [1,2,3,4,7,8,9,10,13,14,15,16], cols, 1)
  drawMergedRect(pdf, startX, startY, colWidth, rowHeight, [5,11], cols, 2)
  drawMergedRect(pdf, startX, startY, colWidth, rowHeight, [6,12], cols, 3)
  drawMergedRect(pdf, startX, startY, colWidth, rowHeight, [17,18], cols, 4)
  drawMergedRect(pdf, startX, startY, colWidth, rowHeight, [20,21,22,23,26,27,28,29], cols, 5)
  drawMergedRect(pdf, startX, startY, colWidth, rowHeight, [24,30,36], cols, 6)
  drawMergedRect(pdf, startX, startY, colWidth, rowHeight, [32,33,34,35], cols, 7)
  drawMergedRect(pdf, startX, startY, colWidth, rowHeight, [19,25,31,37,43,49,55,61,67,73,79], cols, 8)
  drawMergedRect(pdf, startX, startY, colWidth, rowHeight, [38,39,40,41,42,44,45,46,47,48,50,51,52,53,54,56,57,58,59,60,62,63,64,65,66], cols, 9)
  drawMergedRect(pdf, startX, startY, colWidth, rowHeight, [68,69,70,71,72], cols, 10)

  pdf.setTextColor(0, 0, 0)
  pdf.setFont(undefined, 'normal')

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

  const logoData = conta?.logo || null
  if (logoData) {
    try {
      const logoHeight = card1Height - 2
      const logoWidth = card1LogoWidth - 2
      let imgFormat = 'PNG'
      let imgDataUri = logoData
      if (!logoData.startsWith('data:')) {
        if (logoData.startsWith('iVBO')) {
          imgDataUri = 'data:image/png;base64,' + logoData
        } else if (logoData.startsWith('/9j/')) {
          imgDataUri = 'data:image/jpeg;base64,' + logoData
          imgFormat = 'JPEG'
        } else {
          imgDataUri = 'data:image/png;base64,' + logoData
        }
      }
      pdf.addImage(imgDataUri, imgFormat, card1X + 1, card1Y + 1, logoWidth, logoHeight, undefined, 'FAST')
    } catch (e) {
      console.warn('[Duplicata] Erro ao carregar logo:', e.message)
    }
  }

  pdf.setFontSize(8)
  const GRID_MM = 2
  const gridColX = (idx0) => startX + idx0 * GRID_MM
  const gridRowY = (rowNum) => startY + (rowNum - 1) * GRID_MM + GRID_MM / 2
  const colS_X = gridColX(18)
  const colAH_X = gridColX(33)
  const colAI_X = gridColX(34)
  const colAL_X = gridColX(37)
  const colAW_X = gridColX(48)
  const colAZ_X = gridColX(51)
  const colBB_X = gridColX(53)
  const colBE_X = gridColX(56)
  const colBH_X = gridColX(59)
  const colBJ_X = gridColX(61)
  const colBN_X = gridColX(65)
  const colBO_X = gridColX(66)
  const colBQ_X = gridColX(68)
  const colBV_X = gridColX(73)
  const colCA_X = gridColX(78)
  const colCC_X = gridColX(80)
  const razaoMaxWidth = colBN_X - colS_X - 2
  const cnpjMaxWidth = (card1X + card1Width) - colBN_X - 1

  pdf.setFont(undefined, 'normal')
  pdf.text('RAZÃO SOCIAL:', colS_X, gridRowY(2), { baseline: 'middle' })
  pdf.text((conta?.nome_correntista || 'EMPRESA').toUpperCase(), colS_X, gridRowY(4), { baseline: 'middle', maxWidth: razaoMaxWidth })
  pdf.text('ENDEREÇO:', colS_X, gridRowY(6), { baseline: 'middle' })
  pdf.text((conta?.endereco || 'RUA').toUpperCase(), colS_X, gridRowY(8), { baseline: 'middle', maxWidth: razaoMaxWidth })
  pdf.text('CNPJ:', colBN_X, gridRowY(2), { baseline: 'middle' })
  pdf.text((conta?.cic || '00.000.000/0000-00').toUpperCase(), colBN_X, gridRowY(4), { baseline: 'middle', maxWidth: cnpjMaxWidth })
  pdf.setFont(undefined, 'normal')
  pdf.text('MUNICÍPIO:', colS_X, gridRowY(10), { baseline: 'middle' })
  pdf.text(((conta?.cidade || '') + ' - ' + (conta?.uf || '')).toUpperCase(), colS_X, gridRowY(12), { baseline: 'middle', maxWidth: colAL_X - colS_X - 2 })
  pdf.text('CEP:', colAL_X, gridRowY(10), { baseline: 'middle' })
  pdf.text((conta?.cep || '00000-000').toUpperCase(), colAL_X, gridRowY(12), { baseline: 'middle', maxWidth: colAW_X - colAL_X - 2 })
  pdf.text('TELEFONE:', colAW_X, gridRowY(10), { baseline: 'middle' })
  pdf.text((conta?.telefone || '').toUpperCase(), colAW_X, gridRowY(12), { baseline: 'middle', maxWidth: (card1X + card1Width) - colAW_X - 1 })

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

  const card5Positions = [20,21,22,23,26,27,28,29].map(cell => getCellPosition(cell, cols))
  const card5MinCol = Math.min(...card5Positions.map(p => p.col))
  const card5MaxCol = Math.max(...card5Positions.map(p => p.col))
  const card5MinRow = Math.min(...card5Positions.map(p => p.row))
  const card5MaxRow = Math.max(...card5Positions.map(p => p.row))
  const card5X = startX + card5MinCol * colWidth + spacing
  const card5Y = startY + card5MinRow * rowHeight + spacing
  const card5Width = (card5MaxCol - card5MinCol + 1) * colWidth - spacing * 2
  const card5Height = (card5MaxRow - card5MinRow + 1) * rowHeight - spacing * 2
  const card5MidY = card5Y + card5Height / 2
  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.4)
  pdf.line(card5X, card5MidY, card5X + card5Width, card5MidY)
  const card5Col1X = card5X + card5Width / 4
  const card5Col2X = card5X + card5Width / 2
  const card5Col3X = card5X + (card5Width * 3) / 4
  pdf.line(card5Col1X, card5Y, card5Col1X, card5Y + card5Height)
  pdf.line(card5Col2X, card5Y, card5Col2X, card5Y + card5Height)
  pdf.line(card5Col3X, card5Y, card5Col3X, card5Y + card5Height)
  const card5LabelY = gridRowY(16)
  pdf.setFontSize(8)
  pdf.setFont(undefined, 'normal')
  const col1CenterX = card5X + (card5Col1X - card5X) / 2
  pdf.text('NF-FATURA', col1CenterX, card5LabelY, { align: 'center', baseline: 'middle' })
  const col2CenterX = card5Col1X + (card5Col2X - card5Col1X) / 2
  pdf.text('DUPLICATA', col2CenterX, card5LabelY, { align: 'center', baseline: 'middle' })
  pdf.text('VALOR R$', col2CenterX, card5LabelY + 3, { align: 'center', baseline: 'middle' })
  const col3CenterX = card5Col2X + (card5Col3X - card5Col2X) / 2
  pdf.text('DUPLICATA', col3CenterX, card5LabelY, { align: 'center', baseline: 'middle' })
  pdf.text('Nº', col3CenterX, card5LabelY + 3, { align: 'center', baseline: 'middle' })
  const col4CenterX = card5Col3X + (card5X + card5Width - card5Col3X) / 2
  pdf.text('VENCIMENTO', col4CenterX, card5LabelY, { align: 'center', baseline: 'middle' })
  pdf.setFontSize(8)
  pdf.setFont(undefined, 'normal')
  pdf.text(formatMoeda(boleto?.valor || 0), colAL_X, gridRowY(21), { baseline: 'middle' })
  pdf.text(String(boleto?.numero_documento || ''), gridColX(50), gridRowY(21), { baseline: 'middle' })
  pdf.text(formatDate(boleto?.data_vencimento), colBQ_X, gridRowY(21), { baseline: 'middle' })

  const card4X = startX + 4 * colWidth + spacing
  const card4Y = startY + 2 * rowHeight + spacing
  const card4Width = 2 * colWidth - spacing * 2
  const card4Height = rowHeight - spacing * 2
  pdf.setFontSize(8)
  pdf.setFont(undefined, 'normal')
  pdf.text('DATA EMISSÃO: ' + formatDate(boleto?.data_emissao), card4X + card4Width / 2, card4Y + card4Height / 2, { align: 'center', baseline: 'middle' })

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

  pdf.setFontSize(8)
  pdf.setFont(undefined, 'normal')
  pdf.text('DESCONTO DE             %                    SOBRE R$                     ATÉ', colS_X, gridRowY(25), { baseline: 'middle' })
  pdf.text('CONDIÇÕES ESPECIAIS', colS_X, gridRowY(27), { baseline: 'middle' })

  const card8Positions = [19,25,31,37,43,49,55,61,67,73,79].map(cell => getCellPosition(cell, cols))
  const card8MinCol = Math.min(...card8Positions.map(p => p.col))
  const card8MaxCol = Math.max(...card8Positions.map(p => p.col))
  const card8MinRow = Math.min(...card8Positions.map(p => p.row))
  const card8MaxRow = Math.max(...card8Positions.map(p => p.row))
  const card8X = startX + card8MinCol * colWidth + spacing
  const card8Y = startY + card8MinRow * rowHeight + spacing
  const card8Width = (card8MaxCol - card8MinCol + 1) * colWidth - spacing * 2
  const card8Height = (card8MaxRow - card8MinRow + 1) * rowHeight - spacing * 2
  const card8LineX = card8X + card8Width * 0.75
  const card8SignatureLineStartY = card8Y + 2
  const card8SignatureLineEndY = card8Y + card8Height - 2
  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.2)
  pdf.line(card8LineX, card8SignatureLineStartY, card8LineX, card8SignatureLineEndY)
  pdf.setFontSize(8)
  pdf.setFont(undefined, 'normal')
  pdf.text('ASSINATURA DO EMITENTE', 56, startY + 92, { align: 'center', baseline: 'middle', angle: 90 })
  pdf.setTextColor(255, 255, 255)
  pdf.text('<<cedente>>', card8LineX - 6, card8Y + card8Height / 2, { align: 'center' })
  pdf.setTextColor(0, 0, 0)

  const card9Positions = [38,39,40,41,42,44,45,46,47,48,50,51,52,53,54,56,57,58,59,60,62,63,64,65,66].map(cell => getCellPosition(cell, cols))
  const card9MinCol = Math.min(...card9Positions.map(p => p.col))
  const card9MaxCol = Math.max(...card9Positions.map(p => p.col))
  const card9MinRow = Math.min(...card9Positions.map(p => p.row))
  const card9MaxRow = Math.max(...card9Positions.map(p => p.row))
  const card9X = startX + card9MinCol * colWidth + spacing + 10
  const card9Y = startY + card9MinRow * rowHeight + spacing
  const card9Width = (card9MaxCol - card9MinCol + 1) * colWidth - spacing * 2 - 10
  const card9Height = (card9MaxRow - card9MinRow + 1) * rowHeight - spacing * 2
  pdf.setFont(undefined, 'normal')
  pdf.setFontSize(8)
  pdf.text('DADOS DO SACADO:', colS_X, gridRowY(30), { baseline: 'middle' })
  pdf.text('RAZÃO SOCIAL:', colS_X, gridRowY(33), { baseline: 'middle' })
  pdf.text((boleto.sacado_nome || '').toUpperCase(), colS_X, gridRowY(35), { baseline: 'middle', maxWidth: colBH_X - colS_X - 2 })
  pdf.text('CNPJ/CPF:', colBH_X, gridRowY(33), { baseline: 'middle' })
  pdf.text((boleto.sacado_cic || '').toUpperCase(), colBH_X, gridRowY(35), { baseline: 'middle', maxWidth: (startX + duplicataWidth) - colBH_X - 2 })
  pdf.text('ENDEREÇO:', colS_X, gridRowY(37), { baseline: 'middle' })
  pdf.text((boleto.sacado_endereco || '').toUpperCase(), colS_X, gridRowY(39), { baseline: 'middle', maxWidth: colCA_X - colS_X })
  pdf.text('MUNICÍPIO/UF:', colS_X, gridRowY(41), { baseline: 'middle' })
  pdf.text(((boleto.sacado_cidade || '') + ' - ' + (boleto.sacado_uf || '')).toUpperCase(), colS_X, gridRowY(43), { baseline: 'middle', maxWidth: colCA_X - colS_X })
  pdf.text('CEP:', colS_X, gridRowY(45), { baseline: 'middle' })
  pdf.text((boleto.sacado_cep || '').toUpperCase(), colS_X, gridRowY(47), { baseline: 'middle', maxWidth: colBH_X - colS_X - 2 })
  pdf.text('CEL:', colBH_X, gridRowY(45), { baseline: 'middle' })
  pdf.text((boleto.sacado_celular || '').toUpperCase(), colBH_X, gridRowY(47), { baseline: 'middle', maxWidth: colCA_X - colBH_X - 2 })
  pdf.text('TELEFONE:', colCA_X, gridRowY(45), { baseline: 'middle' })
  pdf.text((boleto.sacado_telefone || '').toUpperCase(), colCA_X, gridRowY(47), { baseline: 'middle', maxWidth: (startX + duplicataWidth) - colCA_X - 1 })

  const card10Positions = [68,69,70,71,72].map(cell => getCellPosition(cell, cols))
  const card10MinCol = Math.min(...card10Positions.map(p => p.col))
  const card10MaxCol = Math.max(...card10Positions.map(p => p.col))
  const card10MinRow = Math.min(...card10Positions.map(p => p.row))
  const card10MaxRow = Math.max(...card10Positions.map(p => p.row))
  const card10X = startX + card10MinCol * colWidth + spacing
  const card10Y = startY + card10MinRow * rowHeight + spacing
  const card10Width = (card10MaxCol - card10MinCol + 1) * colWidth - spacing * 2
  const card10Height = (card10MaxRow - card10MinRow + 1) * rowHeight - spacing * 2
  const card10DivX = card10X + card10Width / 5
  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.4)
  pdf.line(card10DivX, card10Y, card10DivX, card10Y + card10Height)
  pdf.setFontSize(8)
  pdf.setFont(undefined, 'normal')
  pdf.text('VALOR EXTENSO', colS_X, gridRowY(53), { baseline: 'middle' })
  const valorExtenso = converterNumeroParaExtenso(boleto?.valor || 0)
  pdf.text((valorExtenso || '').toUpperCase(), colAH_X, gridRowY(53), { baseline: 'middle', maxWidth: (startX + duplicataWidth) - colAH_X - 2 })
  pdf.setFontSize(8)
  pdf.setFont(undefined, 'normal')
  pdf.text('Confirmo a compra, o recebimento da mercadoria e o reconhecimento integral desta duplicata.', colS_X, gridRowY(57), { baseline: 'middle' })

  pdf.setFontSize(8)
  pdf.setFont(undefined, 'normal')
  pdf.text('DATA DO ACEITE EM ____/____/_____', colS_X, gridRowY(64), { baseline: 'middle' })
  pdf.text('______________________________________________', colBE_X, gridRowY(62), { baseline: 'middle' })
  pdf.text('ASSINATURA DO SACADO', colBN_X, gridRowY(64), { baseline: 'middle' })
  pdf.setTextColor(255, 255, 255)
  pdf.text('<<sacado>>', colBN_X, gridRowY(61), { baseline: 'middle' })
  pdf.setTextColor(0, 0, 0)
}

export const generateDuplicataPDF = async (boleto, conta, logoUrl) => {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  try {
    await renderDuplicataOnDoc(pdf, boleto, conta)

    const blob = pdf.output('blob')
    return blob
  } catch (error) {
    console.error('[Duplicata] Erro ao gerar PDF:', error)
    throw error
  }

}

// ============================================================
// Renderiza 2 duplicatas em uma página A4 (sem Cessão).
// boleto2 pode ser null (renderiza só boleto1 nesse caso).
// ============================================================
export const render2DuplicatasOnPage = async (doc, boleto1, boleto2, conta) => {
  await renderDuplicataOnDoc(doc, boleto1, conta, 8)
  if (boleto2) {
    await renderDuplicataOnDoc(doc, boleto2, conta, 152)
  }
}

// ============================================================
// Renderiza o "INSTRUMENTO PARTICULAR..." em página A4 completa
// com lista de todos os boletos na Cláusula Oitava.
// ============================================================
export const renderCessaoDireitosPageCompleta = (doc, boletos, conta) => {
  const leftX = 10
  const rightX = 200
  const lineW = 190
  let ty = 15

  const cedNome = (conta?.nome_correntista || '').toUpperCase()
  const cedDig = String(conta?.cic || '').replace(/\D/g, '')
  const cedDoc = cedDig.length === 14
    ? cedDig.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    : cedDig.length === 11
      ? cedDig.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
      : (conta?.cic || '')
  const cedDocLbl = cedDig.length === 14 ? 'CNPJ nº' : 'CPF nº'
  const cedEnd = [conta?.endereco, ((conta?.cidade || '') + '-' + (conta?.uf || ''))].filter(p => p && p !== '-').join(', ')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('INSTRUMENTO PARTICULAR DE CESSÃO DE DIREITOS CREDITÓRIOS E ANTECIPAÇÃO DE RECEBÍVEIS', 105, ty, { align: 'center' })
  ty += 7

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  const cedPrefix = `CEDENTE: ${cedNome}`
  doc.text(cedPrefix, leftX, ty)
  doc.setFont('helvetica', 'normal')
  doc.text(`, ${cedDocLbl} ${cedDoc}, residente na ${cedEnd}.`, leftX + doc.getTextWidth(cedPrefix), ty)
  ty += 4

  doc.setFont('helvetica', 'bold')
  const cesPrefix = 'CESSIONÁRIA: CAPT ADMINISTRAÇÃO DE PAGAMENTOS LTDA'
  doc.text(cesPrefix, leftX, ty)
  doc.setFont('helvetica', 'normal')
  doc.text(', CNPJ nº 08.035.579/0001-30.', leftX + doc.getTextWidth(cesPrefix), ty)
  ty += 4

  const para = (text) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    const lines = doc.splitTextToSize(text, lineW)
    lines.forEach(ln => { doc.text(ln, leftX, ty); ty += 3.4 })
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
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(h, leftX, ty)
    ty += 3.8
    para(b)
    ty += 1
  })

  // Cláusula Oitava - Títulos Cedidos
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('CLÁUSULA OITAVA - DOS TÍTULOS CEDIDOS', leftX, ty)
  ty += 3.8

  const isSingular = boletos.length === 1
  para(isSingular
    ? 'O presente instrumento tem por objeto a cessão do seguinte título de crédito:'
    : 'O presente instrumento tem por objeto a cessão dos seguintes títulos de crédito:')
  ty += 1

  // Tabela de títulos
  const colHeaders = ['EMISSÃO', 'Nº TÍTULO', 'VENCIMENTO', 'VALOR R$', 'SACADO', 'CPF/CNPJ']
  const colWidths = [22, 28, 22, 22, 56, 40]
  let cx = leftX

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  colHeaders.forEach((h, i) => {
    doc.text(h, cx, ty)
    cx += colWidths[i]
  })
  ty += 0.5
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.2)
  doc.line(leftX, ty, leftX + lineW, ty)
  ty += 3

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  boletos.forEach(b => {
    cx = leftX
    const rowData = [
      formatDate(b.data_emissao),
      String(b.numero_documento || b.num_titulo || ''),
      formatDate(b.data_vencimento),
      formatMoeda(b.valor || 0),
      (b.sacado_nome || '').substring(0, 30),
      String(b.sacado_cic || ''),
    ]
    rowData.forEach((cell, i) => {
      doc.text(String(cell), cx, ty)
      cx += colWidths[i]
    })
    ty += 0.5
    doc.line(leftX, ty, leftX + lineW, ty)
    ty += 3
  })
  ty += 1

  // Assinaturas fixas em sy = 277mm
  const sigInset = 10
  const sCol = 72
  const sLeftX = leftX + sigInset
  const sRightX = rightX - sigInset
  const lcx = sLeftX + sCol / 2
  const rcx = sRightX - sCol / 2
  const sy = 277

  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.3)
  doc.line(sLeftX, sy, sLeftX + sCol, sy)
  doc.line(sRightX - sCol, sy, sRightX, sy)
  doc.setTextColor(255, 255, 255)
  doc.text('<<cedente>>', lcx, sy - 9, { align: 'center' })
  doc.text('<<capt>>', rcx, sy - 9, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(cedNome, lcx, sy + 4, { align: 'center' })
  doc.text('CAPT ADMINISTRAÇÃO DE PAGAMENTOS LTDA', rcx, sy + 4, { align: 'center' })
  doc.text(`${cedDocLbl} ${cedDoc}`, lcx, sy + 8, { align: 'center' })
  doc.text('CNPJ nº 08.035.579/0001-30', rcx, sy + 8, { align: 'center' })
}

// ============================================================
// Gera um Blob PDF com apenas a página de cessão de direitos
// contendo todos os boletos na Cláusula Oitava.
// ============================================================
export const generateCessaoDireitosBlob = (boletos, conta) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  renderCessaoDireitosPageCompleta(doc, boletos, conta)
  return doc.output('blob')
}









