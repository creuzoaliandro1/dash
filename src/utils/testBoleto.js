// Arquivo de teste para verificar importações
console.log('=== TESTE DE IMPORTAÇÕES ===')

try {
  console.log('1. Testando importação de jsPDF...')
  const { jsPDF } = await import('jspdf')
  console.log('✓ jsPDF importado com sucesso:', typeof jsPDF)
} catch (e) {
  console.error('✗ Erro ao importar jsPDF:', e.message)
}

try {
  console.log('2. Testando importação de jsbarcode...')
  const JsBarcode = await import('jsbarcode')
  console.log('✓ jsbarcode importado com sucesso:', typeof JsBarcode)
} catch (e) {
  console.error('✗ Erro ao importar jsbarcode:', e.message)
}

try {
  console.log('3. Testando importação de generateSingleBoletoPDF...')
  const { generateSingleBoletoPDF } = await import('./boleto.js')
  console.log('✓ generateSingleBoletoPDF importado com sucesso:', typeof generateSingleBoletoPDF)
} catch (e) {
  console.error('✗ Erro ao importar generateSingleBoletoPDF:', e.message)
}

console.log('=== FIM DO TESTE ===')
