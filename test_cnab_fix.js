/**
 * Script de teste para validar a correção do CNAB400
 * Gera um arquivo CNAB400 com a função corrigida e valida com cnab400ValidatorService
 */

import { generateCNAB400RemittanceFile } from './src/utils/boleto.js'
import { analisarCNAB400, gerarRelatorioErros } from './src/services/cnab400ValidatorService.js'

// Dados de teste
const contaTeste = {
    nome_correntista: 'CARRETAO COMERCIO E SERVICOS',
    conta: '00000000',
    conta_corrente: '00001',
    convenio: '112506',
    cpf_cnpj: '09646308000',
    cedente: '000001',
    cic: '09646308000000',
    cnab400: 42
}

const boletosTeste = [
    {
        nosso_numero: '000900001090',
        numero_documento: '000337',
        data_vencimento: '2026-06-10',
        data_emissao: '2026-05-21',
        valor: '3306.00',
        sacado_nome: 'CORDEIRO LOCACAO DE MAQUINAS E EQUIPAMENTOS',
        sacado_endereco: 'RUA TESTE',
        sacado_cep: '62670000',
        sacado_bairro: 'BAIRRO',
        sacado_cidade: 'GONCALO DO AMARANTE',
        sacado_uf: 'CE',
        sacado_cic: '06940000000',
        mensagem1: 'PECEM'
    },
    {
        nosso_numero: '000900001130',
        numero_documento: '000680',
        data_vencimento: '2026-06-10',
        data_emissao: '2026-05-21',
        valor: '120.00',
        sacado_nome: 'CORDEIRO LOCACAO DE MAQUINAS E EQUIPAMENTOS',
        sacado_endereco: 'RUA TESTE',
        sacado_cep: '62670000',
        sacado_bairro: 'BAIRRO',
        sacado_cidade: 'GONCALO DO AMARANTE',
        sacado_uf: 'CE',
        sacado_cic: '06940000000',
        mensagem1: 'PECE'
    }
]

console.log('========================================================')
console.log('  TESTE DE GERAÇÃO CNAB400 COM CORREÇÃO')
console.log('========================================================\n')

try {
    // Gerar arquivo CNAB400
    console.log('1. Gerando arquivo CNAB400 com a função corrigida...')
    const blob = generateCNAB400RemittanceFile(boletosTeste, contaTeste, 43)

    // Converter blob para string
    const texto = await blob.text()

    console.log('✓ Arquivo gerado com sucesso\n')

    // Salvar arquivo temporário para análise
    const conteudo = texto
    console.log('2. Analisando arquivo com validador CNAB400...\n')

    // Analisar com o validador
    const relatorio = analisarCNAB400(conteudo)
    const relatorioFormatado = gerarRelatorioErros(relatorio)

    console.log(relatorioFormatado)

    // Mostrar primeiras linhas do arquivo para inspeção visual
    console.log('\n3. Primeiras 3 linhas do arquivo gerado:\n')
    const linhas = conteudo.split('\n').slice(0, 3)
    linhas.forEach((linha, idx) => {
        console.log(`Linha ${idx + 1} (${linha.length} chars):`)
        console.log(linha)

        // Mostrar posições chave
        if (idx === 0) {
            console.log('\nPosições chave do HEADER:')
            console.log(`  Pos 77-79 (Banco): "${linha.substring(76, 79)}"`)
            console.log(`  Pos 80-94 (Nome Banco): "${linha.substring(79, 94)}"`)
            console.log(`  Pos 95-100 (Data): "${linha.substring(94, 100)}"`)
            console.log(`  Pos 109-119 (Nosso Numero): "${linha.substring(108, 119)}"`)
            console.log(`  Pos 120 (DV): "${linha.substring(119, 120)}"`)
        }
        if (idx === 1) {
            console.log('\nPosições chave do DETALHE 1:')
            console.log(`  Pos 71-81 (Nosso Numero): "${linha.substring(70, 81)}"`)
            console.log(`  Pos 82 (DV): "${linha.substring(81, 82)}"`)
        }

        console.log()
    })

    // Salvar arquivo no diretório de saída
    console.log('4. Salvando arquivo de teste...')
    const fs = await import('fs').then(m => m.promises)
    const path = '/sessions/optimistic-beautiful-davinci/mnt/outputs/CB21050000043_TESTE.REM'
    await fs.writeFile(path, conteudo)
    console.log(`✓ Arquivo salvo em: ${path}`)

    console.log('\n========================================================')
    console.log('  TESTE CONCLUÍDO')
    console.log('========================================================')

} catch (erro) {
    console.error('❌ Erro durante o teste:')
    console.error(erro.message)
    console.error(erro.stack)
}
