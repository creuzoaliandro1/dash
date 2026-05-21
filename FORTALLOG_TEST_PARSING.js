// TESTE DE PARSING DE VALORES - Detectar formato brasileiro vs internacional

function parseValor(valor) {
  if (typeof valor === 'string') {
    let valorLimpo = valor.trim()

    // Detectar formato
    const pontos = (valorLimpo.match(/\./g) || []).length
    const virgulas = (valorLimpo.match(/,/g) || []).length

    if (virgulas === 1 && valorLimpo.lastIndexOf(',') > valorLimpo.lastIndexOf('.')) {
      // Formato brasileiro: 1.234,56 → remove pontos e substitui vírgula
      valorLimpo = valorLimpo.replace(/\./g, '').replace(',', '.')
    } else if (pontos === 1 && virgulas > 0) {
      // Formato internacional: 1,234.56 → remove vírgulas
      valorLimpo = valorLimpo.replace(/,/g, '')
    } else if (virgulas > 0) {
      // Se tem vírgula mas sem padrão claro, assume brasileiro
      valorLimpo = valorLimpo.replace(/\./g, '').replace(',', '.')
    }

    return parseFloat(valorLimpo)
  } else if (typeof valor === 'number') {
    return valor
  } else {
    return 0
  }
}

console.log('=== TESTE DE PARSING DE VALORES ===\n')

const testCases = [
  // Formato brasileiro (esperado)
  { input: '5.132,25', expected: 5132.25, format: 'Brasileiro' },
  { input: '1.234.567,89', expected: 1234567.89, format: 'Brasileiro' },
  { input: '500,00', expected: 500.00, format: 'Brasileiro' },
  { input: '1.000', expected: 1000, format: 'Brasileiro (sem decimal)' },

  // Formato internacional
  { input: '5,132.25', expected: 5132.25, format: 'Internacional' },
  { input: '1,234,567.89', expected: 1234567.89, format: 'Internacional' },
  { input: '500.00', expected: 500.00, format: 'Internacional' },
  { input: '1,000', expected: 1000, format: 'Internacional (sem decimal)' },

  // Sem separadores
  { input: '5132.25', expected: 5132.25, format: 'Sem separador' },
  { input: '1500', expected: 1500, format: 'Sem separador' },

  // Números diretos
  { input: 5132.25, expected: 5132.25, format: 'Número' },
  { input: 1500, expected: 1500, format: 'Número' },
]

testCases.forEach(({ input, expected, format }) => {
  const resultado = parseValor(input)
  const status = Math.abs(resultado - expected) < 0.01 ? '✓' : '✗'
  console.log(
    `${status} ${format.padEnd(30)} | ${String(input).padEnd(20)} → ${resultado.toFixed(2).padEnd(10)} (esperado: ${expected.toFixed(2)})`
  )
})

console.log('\n✓ Testes de parsing concluídos')
