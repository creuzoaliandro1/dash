/**
 * Serviço de Validação CNAB400
 * Diagnostica problemas no arquivo CNAB400 gerado
 */

// Replica da função de cálculo de DV para validação
const calcNossoNumeroDV = (nossoBase) => {
  const base = String(nossoBase || '').replace(/\D/g, '').padStart(11, '0').slice(0, 11)
  const pesos = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4]
  let soma = 0
  for (let i = 0; i < 11; i++) {
    soma += parseInt(base.charAt(i), 10) * pesos[i]
  }
  const resto = soma % 11
  return resto < 2 ? '0' : String(11 - resto)
}

/**
 * Valida o DV de um nosso número
 * @param {string} nossoNumeroCompleto - nosso número com DV (12 caracteres)
 * @returns {object} { valido: boolean, dvEsperado: string, dvRecebido: string, base: string }
 */
export function validarDVNossoNumero(nossoNumeroCompleto) {
  if (!nossoNumeroCompleto || nossoNumeroCompleto.length < 12) {
    return {
      valido: false,
      erro: 'Nosso número deve ter 12 caracteres (11 base + 1 DV)',
      tamanhoRecebido: nossoNumeroCompleto ? nossoNumeroCompleto.length : 0
    }
  }

  const base = nossoNumeroCompleto.slice(0, 11)
  const dvRecebido = nossoNumeroCompleto.slice(11, 12)
  const dvEsperado = calcNossoNumeroDV(base)

  return {
    valido: dvRecebido === dvEsperado,
    base,
    dvRecebido,
    dvEsperado,
    detalhes: `Base: ${base} → DV esperado: ${dvEsperado}, DV recebido: ${dvRecebido}`
  }
}

/**
 * Analisa um arquivo CNAB400 e valida DVs
 * @param {string} conteudoArquivo - conteúdo completo do arquivo
 * @returns {object} relatório de validação
 */
export function analisarCNAB400(conteudoArquivo) {
  const linhas = conteudoArquivo.split('\n').filter(l => l.trim())
  const relatorio = {
    totalLinhas: linhas.length,
    validacoes: [],
    erros: [],
    avisos: []
  }

  linhas.forEach((linha, idx) => {
    const numero = idx + 1
    const tipoRegistro = linha.substring(0, 1)

    console.log(`\n[CNAB Linha ${numero}] Tipo: ${tipoRegistro}`)

    // ====== TIPO 0 - HEADER ======
    if (tipoRegistro === '0') {
      analisarHeaderCNAB(linha, numero, relatorio)
    }

    // ====== TIPO 1 - DETALHE ======
    if (tipoRegistro === '1') {
      analisarDetalheCNAB(linha, numero, relatorio)
    }

    // ====== TIPO 2 - DETALHE ======
    if (tipoRegistro === '2') {
      // Tipo 2 é apenas descrição, não valida DV normalmente
      console.log(`  [INFO] Registro tipo 2 (descrição) - sem validação de DV`)
    }

    // ====== TIPO 9 - TRAILER ======
    if (tipoRegistro === '9') {
      console.log(`  [INFO] Registro tipo 9 (trailer) - validação de rodapé`)
    }
  })

  return relatorio
}

function analisarHeaderCNAB(linha, numLinha, relatorio) {
  console.log(`\n  ========== HEADER (Tipo 0) ==========`)

  // Extrair posições importantes
  const seq = linha.substring(0, 2)       // Posição 1-2
  const tipo = linha.substring(0, 1)       // Posição 1
  const codigoServico = linha.substring(1, 2)  // Posição 2

  console.log(`  Sequência: ${seq}`)
  console.log(`  Tipo: ${tipo}`)
  console.log(`  Código Serviço: ${codigoServico}`)

  // Analisar posição 82 (índice 81)
  const pos82 = linha.substring(81, 82)
  const nossoNumeroHeader = linha.substring(75, 86)  // Posições 76-86 (0-based: 75-85)

  console.log(`\n  [Posição 76-86] Nosso Número Header: "${nossoNumeroHeader}"`)
  console.log(`  [Posição 82] (índice 81): "${pos82}" (este é o DV esperado)`)

  // Validar DV se possível
  if (nossoNumeroHeader && nossoNumeroHeader.length >= 11) {
    const validacao = validarDVNossoNumero(nossoNumeroHeader + pos82)
    console.log(`\n  Validação DV:`)
    console.log(`    ✓ Base: ${validacao.base}`)
    console.log(`    ✓ DV Recebido: ${validacao.dvRecebido}`)
    console.log(`    ✓ DV Esperado: ${validacao.dvEsperado}`)
    console.log(`    ${validacao.valido ? '✅ VÁLIDO' : '❌ INVÁLIDO'}`)

    if (!validacao.valido) {
      const erro = `Linha ${numLinha} (HEADER): DV incorreto na posição 82. Esperado: ${validacao.dvEsperado}, Recebido: ${validacao.dvRecebido}`
      relatorio.erros.push(erro)
      console.log(`    ${erro}`)
    }

    relatorio.validacoes.push({
      linha: numLinha,
      tipo: 'HEADER',
      nossoNumero: nossoNumeroHeader + pos82,
      ...validacao
    })
  }

  // Analisar outros campos importantes
  analisarCamposHeaderComuns(linha, relatorio, numLinha)
}

function analisarDetalheCNAB(linha, numLinha, relatorio) {
  console.log(`\n  ========== DETALHE (Tipo 1) ==========`)

  // Extrair posições importantes para tipo 1
  const nossoNumeroDetalhe = linha.substring(75, 86)  // Posições 76-86 (0-based: 75-85)
  const dvDetalhe = linha.substring(85, 86)  // Posição 86 (0-based: 85)

  console.log(`\n  [Posição 76-86] Nosso Número: "${nossoNumeroDetalhe}"`)
  console.log(`  [Posição 86] (índice 85): "${dvDetalhe}" (DV)`)

  // Validar DV
  if (nossoNumeroDetalhe && nossoNumeroDetalhe.length >= 11) {
    const validacao = validarDVNossoNumero(nossoNumeroDetalhe + dvDetalhe)
    console.log(`\n  Validação DV:`)
    console.log(`    ✓ Base: ${validacao.base}`)
    console.log(`    ✓ DV Recebido: ${validacao.dvRecebido}`)
    console.log(`    ✓ DV Esperado: ${validacao.dvEsperado}`)
    console.log(`    ${validacao.valido ? '✅ VÁLIDO' : '❌ INVÁLIDO'}`)

    if (!validacao.valido) {
      const erro = `Linha ${numLinha} (DETALHE): DV incorreto na posição 82-86. Nosso Número: ${nossoNumeroDetalhe}, DV Esperado: ${validacao.dvEsperado}, DV Recebido: ${validacao.dvRecebido}`
      relatorio.erros.push(erro)
      console.log(`    ${erro}`)
    }

    relatorio.validacoes.push({
      linha: numLinha,
      tipo: 'DETALHE',
      nossoNumero: nossoNumeroDetalhe + dvDetalhe,
      ...validacao
    })
  }

  // Analisar outros campos
  analisarCamposDetalheComuns(linha, relatorio, numLinha)
}

function analisarCamposHeaderComuns(linha, relatorio, numLinha) {
  // Banco
  const banco = linha.substring(76, 79)  // Posições 77-79
  console.log(`  [Posições 77-79] Banco: ${banco}`)

  // Lote
  const lote = linha.substring(79, 83)  // Posições 80-83
  console.log(`  [Posições 80-83] Lote: ${lote}`)

  // Data
  const data = linha.substring(120, 126)  // Posições 121-126 (aproximado)
  console.log(`  [Data aprox]: ${data}`)
}

function analisarCamposDetalheComuns(linha, relatorio, numLinha) {
  // Valor
  const valorStr = linha.substring(149, 162)  // Posições 150-162 (aproximado)
  console.log(`  [Posições 150-162] Valor: ${valorStr}`)

  // Sacado (cliente)
  const sacadoStr = linha.substring(193, 213)  // Posições 194-213 (aproximado)
  console.log(`  [Posições 194-213] Sacado: ${sacadoStr.trim()}`)
}

/**
 * Gera relatório formatado de erros
 */
export function gerarRelatorioErros(relatorio) {
  let resultado = '═══════════════════════════════════════════════════════════\n'
  resultado += '  RELATÓRIO DE VALIDAÇÃO CNAB400\n'
  resultado += '═══════════════════════════════════════════════════════════\n\n'

  resultado += `Total de linhas: ${relatorio.totalLinhas}\n`
  resultado += `Validações realizadas: ${relatorio.validacoes.length}\n\n`

  if (relatorio.erros.length === 0) {
    resultado += '✅ NENHUM ERRO ENCONTRADO\n'
  } else {
    resultado += `❌ ${relatorio.erros.length} ERRO(S) ENCONTRADO(S):\n\n`
    relatorio.erros.forEach((erro, idx) => {
      resultado += `${idx + 1}. ${erro}\n`
    })
  }

  if (relatorio.avisos.length > 0) {
    resultado += `\n⚠️  ${relatorio.avisos.length} AVISO(S):\n\n`
    relatorio.avisos.forEach((aviso, idx) => {
      resultado += `${idx + 1}. ${aviso}\n`
    })
  }

  resultado += '\n═══════════════════════════════════════════════════════════\n'
  resultado += 'Detalhes das validações:\n'
  resultado += '═══════════════════════════════════════════════════════════\n\n'

  relatorio.validacoes.forEach((val, idx) => {
    resultado += `${idx + 1}. Linha ${val.linha} (${val.tipo})\n`
    resultado += `   Nosso Número: ${val.nossoNumero}\n`
    resultado += `   Base: ${val.base}\n`
    resultado += `   DV Recebido: ${val.dvRecebido}\n`
    resultado += `   DV Esperado: ${val.dvEsperado}\n`
    resultado += `   Status: ${val.valido ? '✅ VÁLIDO' : '❌ INVÁLIDO'}\n\n`
  })

  return resultado
}
