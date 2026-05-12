/**
 * SCRIPT: Extrair contas do arquivo CNAB400 e inserir no Supabase
 * Como usar: node extrair_e_inserir_contas.js
 */

import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Carregar variáveis
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

/**
 * Extrair número da conta
 */
function extrairNumeroConta(linhaDigitavel) {
  if (!linhaDigitavel || linhaDigitavel.length < 30) {
    return null
  }
  return linhaDigitavel.substring(23, 30)
}

/**
 * MAIN
 */
async function main() {
  try {
    console.log('📂 Lendo arquivo Excel...')

    // 1. Ler arquivo
    const workbook = XLSX.readFile('../Relatorio_Gestao_Boletos_Todos_9536939_20260511.xlsx')
    const primeiraAba = workbook.SheetNames[0]
    const planilha = workbook.Sheets[primeiraAba]
    const boletos = XLSX.utils.sheet_to_json(planilha)

    console.log(`✓ Arquivo lido: ${boletos.length} registros`)

    // 2. Extrair números únicos de contas
    const contasSet = new Set()
    const erros = []

    for (let i = 0; i < boletos.length; i++) {
      const boleto = boletos[i]
      const linhaDigitavel = boleto['Linha digitável']

      try {
        const numeroConta = extrairNumeroConta(linhaDigitavel)
        if (numeroConta) {
          contasSet.add(numeroConta)
        }
      } catch (error) {
        erros.push({ linha: i + 2, erro: error.message })
      }
    }

    const contasUnicas = Array.from(contasSet).sort()

    console.log(`\n📊 Contas encontradas no arquivo:`)
    console.log(`   Total de contas únicas: ${contasUnicas.length}`)
    console.log(`\n📋 Contas (primeiras 20):`)
    contasUnicas.slice(0, 20).forEach(conta => {
      console.log(`   - ${conta}`)
    })

    if (contasUnicas.length > 20) {
      console.log(`   ... e ${contasUnicas.length - 20} mais`)
    }

    console.log(`\n🔍 Verificando quais contas já existem no Supabase...`)

    // 3. Verificar quais já existem
    const { data: contasExistentes, error: erroSelect } = await supabase
      .from('contas')
      .select('conta')

    if (erroSelect) {
      console.error('❌ Erro ao buscar contas:', erroSelect.message)
      return
    }

    const contasExistentesSet = new Set(contasExistentes.map(c => c.conta.substring(0, 7)))
    const contasFaltando = contasUnicas.filter(conta => !contasExistentesSet.has(conta))

    console.log(`   Contas existentes: ${contasExistentes.length}`)
    console.log(`   Contas faltando: ${contasFaltando.length}`)

    if (contasFaltando.length === 0) {
      console.log(`\n✅ Todas as contas já existem! Pode importar.`)
      return
    }

    // 4. Inserir contas faltando
    console.log(`\n📝 Inserindo ${contasFaltando.length} contas faltando...`)

    // USER_ID padrão para teste (MUDE ISSO)
    const USER_ID = '550e8400-e29b-41d4-a716-446655440000'

    // Preparar dados para inserção
    const contasParaInserir = contasFaltando.map(numero => ({
      conta: numero + '02', // Adiciona dígito verificador padrão
      usuario_id: USER_ID,
      banco_codigo: '274', // Banco Itaú (do seu arquivo)
      agencia: null,
      nome_titular: 'RETIFICA VOLANTE',
      documento_titular: '59849652000148',
    }))

    // Inserir
    const { data: contasInseridas, error: erroInsert } = await supabase
      .from('contas')
      .insert(contasParaInserir)
      .select()

    if (erroInsert) {
      console.error('❌ Erro ao inserir:', erroInsert.message)
      return
    }

    console.log(`✅ ${contasInseridas.length} contas inseridas com sucesso!`)

    // 5. Exibir SQL gerado (para referência)
    console.log(`\n📄 SQL executado (para referência):`)
    console.log(`\n-- Contas inseridas:`)
    contasInseridas.forEach(conta => {
      console.log(`-- ${conta.id}: ${conta.conta} (${conta.usuario_id})`)
    })

    // 6. Resumo
    console.log(`\n${'='.repeat(60)}`)
    console.log(`✅ PRONTO PARA IMPORTAR!`)
    console.log(`${'='.repeat(60)}`)
    console.log(`
Próximo passo:
  1. Acesse o frontend da aplicação
  2. Vá para "Importar Boletos"
  3. Selecione o arquivo Excel
  4. Clique em "Importar"

O sistema encontrará as seguintes contas:
`)
    contasInseridas.forEach(conta => {
      console.log(`  ✓ ${conta.conta} (${conta.nome_titular})`)
    })

  } catch (error) {
    console.error('❌ Erro fatal:', error.message)
    process.exit(1)
  }
}

// Executar
main()
