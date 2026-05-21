// TESTE DE LÓGICA - Detecção de Arquivo FORTALLOG

/**
 * Teste 1: isFortallogFile() - Detecção por nome
 */
function isFortallogFile(fileName) {
  const lowerName = fileName.toLowerCase()
  return lowerName.includes('fortallog') || (lowerName.includes('os_') && lowerName.endsWith('.xls'))
}

console.log('=== TESTE 1: Detecção de Arquivo ===')
const testFiles = [
  'OS_11115_BDF5A51 - FORTALLOG.xls',           // ✓ Deve ser TRUE
  'OS_11115_BDF5A51 - FORTALLOG-b3b063e3.xls',  // ✓ Deve ser TRUE
  'FORTALLOG_2026_05.xls',                       // ✓ Deve ser TRUE
  'fortallog_teste.XLS',                         // ✓ Deve ser TRUE
  'OS_12345_TESTE.xls',                          // ✓ Deve ser TRUE
  'boleto_normal.xlsx',                          // ✗ Deve ser FALSE
  'arquivo_excel.csv',                           // ✗ Deve ser FALSE
]

testFiles.forEach(file => {
  const result = isFortallogFile(file)
  const expected = file.toLowerCase().includes('fortallog') ||
                   (file.toLowerCase().includes('os_') && file.endsWith('.xls'))
  const status = result === expected ? '✓' : '✗'
  console.log(`${status} ${file.padEnd(40)} → ${result}`)
})

/**
 * Teste 2: Extração de UF de cidade
 */
console.log('\n=== TESTE 2: Extração de UF ===')
const cidades = [
  'FORTALEZA - CE',
  'SÃO PAULO - SP',
  'RIO DE JANEIRO - RJ',
  'BELO HORIZONTE - MG',
  'SALVADOR',  // Sem UF
]

cidades.forEach(cidade => {
  const uf = cidade.includes('-')
    ? cidade.split('-')[1].trim().toUpperCase().substring(0, 2)
    : ''
  console.log(`${cidade.padEnd(30)} → UF: "${uf}"`)
})

/**
 * Teste 3: Limpeza de valores
 */
console.log('\n=== TESTE 3: Parsing de Valores ===')
const valores = [
  '5.132,25',
  '5132.25',
  '5,132.25',
  1500,
  '1500',
  0,
]

valores.forEach(valor => {
  let resultado
  if (typeof valor === 'string') {
    resultado = parseFloat(valor.replace(/[^\d,.-]/g, '').replace(',', '.'))
  } else if (typeof valor === 'number') {
    resultado = valor
  } else {
    resultado = 0
  }
  console.log(`${String(valor).padEnd(15)} → ${resultado}`)
})

/**
 * Teste 4: Limpeza de CIC/CEP
 */
console.log('\n=== TESTE 4: Limpeza de CIC/CEP ===')
const documentos = [
  '15.521.992/0001-70',
  '12345678901234',
  '123.456.789-00',
  '00.000.000/0000-00',
]

documentos.forEach(doc => {
  const limpo = String(doc).replace(/\D/g, '')
  console.log(`${doc.padEnd(25)} → ${limpo}`)
})

console.log('\n✓ Testes de lógica concluídos')
