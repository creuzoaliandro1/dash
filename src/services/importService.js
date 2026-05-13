import { createBoleto } from './boletoService'
import { supabase } from '../lib/supabase'

/**
 * Parse Excel files (.xlsx, .xls) - SIMPLES e DIRETO
 * Carrega biblioteca XLSX do unpkg e mapeia colunas automaticamente
 */
async function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    // Carregar biblioteca XLSX se não estiver carregada
    if (!window.XLSX) {
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/xlsx/dist/xlsx.full.min.js'
      document.head.appendChild(script)

      script.onload = () => {
        processExcelFile(file, resolve, reject)
      }
      script.onerror = () => {
        reject(new Error('Erro ao carregar biblioteca Excel'))
      }
    } else {
      processExcelFile(file, resolve, reject)
    }
  })
}

function processExcelFile(file, resolve, reject) {
  const reader = new FileReader()

  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result)
      const workbook = window.XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = window.XLSX.utils.sheet_to_json(worksheet)

      console.log(`[Excel] Encontrado ${jsonData.length} linhas`)

      // Mapeamento automático de colunas
      const boletos = jsonData.map(row => {
        return {
          NUM_TITULO: String(row['Seu número'] || row['Número do documento'] || '').trim(),
          SACADO_NOME: String(row['Nome do pagador'] || '').trim(),
          SACADO_CIC: String(row['Documento federal do pagador'] || '').replace(/\D/g, ''),
          EMISSAO: formatarData(row['Data de emissão']),
          VENCIMENTO: formatarData(row['Data de vencimento']),
          VALOR: parseFloat(String(row['Valor do título'] || '0').replace(/[^\d,.-]/g, '').replace(',', '.')),
          NOSSO_NUMERO: String(row['Nosso número'] || '').trim(),
          STATUS: String(row['Status do boleto'] || 'pendente').includes('Pago') ? 'pago' : 'pendente',
          SACADO_ENDERECO: String(row['Logradouro do pagador'] || '').trim(),
          SACADO_BAIRRO: String(row['Bairro do pagador'] || '').trim(),
          SACADO_CIDADE: String(row['Cidade do pagador'] || '').trim(),
          SACADO_UF: String(row['UF do pagador'] || '').substring(0, 2).toUpperCase(),
          SACADO_CEP: String(row['CEP do pagador'] || '').replace(/\D/g, ''),
          SACADO_TELEFONE: String(row['Telefone do pagador'] || '').trim(),
          SACADO_EMAIL: String(row['Email do pagador'] || '').trim(),
          CODIGO_BARRAS: String(row['Linha digitável'] || '').trim(),
          AVALISTA_NOME: String(row['Beneficiário final (sacador avalista)'] || '').trim(),
          AVALISTA_CIC: String(row['Documento federal do avalista'] || row['CPF/CNPJ do avalista'] || row['CIC do avalista'] || '').replace(/\D/g, ''),
          VALOR_PAGAMENTO: parseFloat(String(row['Valor pago'] || '0').replace(/[^\d,.-]/g, '').replace(',', '.')),
          DATA_PAGAMENTO: formatarData(row['Data de pagamento']),
          DESCRICAO: String(row['Descrição'] || row['Descricao'] || '').trim(),
        }
      }).filter(b => b.SACADO_NOME && b.VALOR > 0)

      if (boletos.length === 0) {
        reject(new Error('Nenhum boleto válido encontrado'))
        return
      }

      console.log(`[Excel] ${boletos.length} boleto(s) extraído(s)`)
      resolve(boletos)
    } catch (error) {
      console.error('[Excel] Erro:', error)
      reject(new Error('Erro ao processar Excel: ' + error.message))
    }
  }

  reader.onerror = () => {
    reject(new Error('Erro ao ler arquivo'))
  }

  reader.readAsArrayBuffer(file)
}

function formatarData(dataExcel) {
  if (!dataExcel) return new Date().toLocaleDateString('pt-BR')

  // Se já está em formato DD/MM/YYYY
  if (typeof dataExcel === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(dataExcel)) {
    return dataExcel
  }

  // Se é número (data Excel)
  if (typeof dataExcel === 'number') {
    const date = new Date((dataExcel - 25569) * 86400 * 1000)
    return date.toLocaleDateString('pt-BR')
  }

  return new Date().toLocaleDateString('pt-BR')
}

/**
 * Parse CSV files (.csv)
 */
async function parseCSVFile(file) {
  const text = await file.text()
  const lines = text.split('\n').filter(line => line.trim())
  const headers = lines[0].split(',').map(h => h.trim())

  const data = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim())
    const obj = {}
    headers.forEach((header, index) => {
      obj[header] = values[index] || ''
    })
    return obj
  })

  return data.map(row => ({
    NUM_TITULO: row['NUM_TITULO'] || row['Documento'] || row['documento'] || '',
    SACADO_NOME: row['SACADO_NOME'] || row['Cliente'] || row['cliente'] || '',
    EMISSAO: row['EMISSAO'] || row['Emissão'] || row['emissao'] || new Date().toLocaleDateString('pt-BR'),
    VENCIMENTO: row['VENCIMENTO'] || row['Vencimento'] || row['vencimento'] || '',
    VALOR: parseFloat(row['VALOR'] || row['Valor'] || row['valor'] || 0),
    NOSSO_NUMERO: row['NOSSO_NUMERO'] || row['Nosso Número'] || row['nosso_numero'] || '',
    STATUS: row['STATUS'] || row['Status'] || row['status'] || 'pendente',
  }))
}

/**
 * Parse TXT files (fixed format)
 */
async function parseTXTFile(file) {
  const text = await file.text()
  const lines = text.split('\n').filter(line => line.trim())

  // Esperamos linhas com formato: NUM_TITULO|SACADO|EMISSAO|VENCIMENTO|VALOR
  return lines.map(line => {
    const [titulo, sacado, emissao, vencimento, valor, nossoNumero, status] = line.split('|').map(v => v.trim())
    return {
      NUM_TITULO: titulo || '',
      SACADO_NOME: sacado || '',
      EMISSAO: emissao || new Date().toLocaleDateString('pt-BR'),
      VENCIMENTO: vencimento || '',
      VALOR: parseFloat(valor || 0),
      NOSSO_NUMERO: nossoNumero || '',
      STATUS: status || 'pendente',
    }
  })
}

/**
 * Parse XML files (NFe, NFSe, CTe, MDFe)
 */
// Helper function to query elements in namespaced XML
function getElementByTagName(xmlDoc, tagName) {
  // Tenta primeiro com querySelector (sem namespaces)
  let result = xmlDoc.querySelector(tagName)
  if (result) return result

  // Se falhar, tenta find com getElementsByTagName (funciona com namespaces)
  const elements = xmlDoc.getElementsByTagName(tagName)
  return elements.length > 0 ? elements[0] : null
}

// Helper function to get text content of first element with given tag
function getElementText(xmlDoc, tagName) {
  const elements = xmlDoc.getElementsByTagName(tagName)
  if (elements.length > 0) {
    return elements[0].textContent || ''
  }
  return ''
}

// Helper function to get text content from a child element within a parent
function getChildElementText(parentElement, tagName) {
  if (!parentElement) return ''
  const children = parentElement.getElementsByTagName(tagName)
  if (children.length > 0) {
    return children[0].textContent || ''
  }
  return ''
}

async function parseXMLFile(file) {
  const text = await file.text()
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(text, 'text/xml')

  // Detectar tipo de documento usando o nome da raiz
  const rootTag = xmlDoc.documentElement.tagName.toLowerCase()

  // Detectar usando getElementsByTagName (funciona com namespaces)
  let boletos = []

  if (rootTag.includes('nfe')) {
    boletos = parseNFe(xmlDoc)
  } else if (rootTag.includes('nfse')) {
    boletos = parseNFSe(xmlDoc)
  } else if (rootTag.includes('cte')) {
    boletos = parseCTe(xmlDoc)
  } else if (rootTag.includes('mdfe')) {
    boletos = parseMDFe(xmlDoc)
  } else {
    // Fallback: verificar por tags específicas
    if (getElementByTagName(xmlDoc, 'NFe')) {
      boletos = parseNFe(xmlDoc)
    } else if (getElementByTagName(xmlDoc, 'Nfse') || getElementByTagName(xmlDoc, 'NFSe') ||
               getElementByTagName(xmlDoc, 'CompactedNFSe') || getElementByTagName(xmlDoc, 'RPS')) {
      boletos = parseNFSe(xmlDoc)
    } else if (getElementByTagName(xmlDoc, 'CTe')) {
      boletos = parseCTe(xmlDoc)
    } else if (getElementByTagName(xmlDoc, 'MDFe')) {
      boletos = parseMDFe(xmlDoc)
    }
  }

  return boletos
}

function parseNFe(xmlDoc) {
  try {
    // NFe: Dados do DESTINATÁRIO (tomador/sacado) vêm da tag <dest>

    // Extrair número da NF
    let nNF = getElementText(xmlDoc, 'nNF') || ''

    // Extrair data de emissão
    let dhEmi = getElementText(xmlDoc, 'dhEmi') || new Date().toISOString()

    // Extrair valor total
    let vNF = getElementText(xmlDoc, 'vNF') ||
              getElementText(xmlDoc, 'valor') || '0'

    // DADOS DO DESTINATÁRIO (sacado) - PROCURAR ESPECIFICAMENTE NA TAG <dest>
    const destElement = xmlDoc.getElementsByTagName('dest')[0]
    let destXNome = getChildElementText(destElement, 'xNome') || ''
    let destCNPJ = getChildElementText(destElement, 'CNPJ') || ''
    let destCPF = getChildElementText(destElement, 'CPF') || ''
    let destEmail = getChildElementText(destElement, 'email') || ''
    let destEndereco = getChildElementText(destElement, 'xLgr') || ''
    let destBairro = getChildElementText(destElement, 'xBairro') || ''
    let destCidade = getChildElementText(destElement, 'xMun') || ''
    let destUF = getChildElementText(destElement, 'UF') || ''
    let destCEP = getChildElementText(destElement, 'CEP') || ''

    // Se ainda não encontrou o número, tentar padrão genérico
    if (!nNF) {
      const allElements = xmlDoc.getElementsByTagName('*')
      for (let elem of allElements) {
        if (elem.tagName.toLowerCase().includes('nf') && elem.textContent.match(/^\d+$/)) {
          nNF = elem.textContent
          break
        }
      }
    }

    // Fallback: se tudo falhar, usar 'SEM_NUMERO'
    if (!nNF) nNF = 'SEM_NUMERO'

    console.log('[NFe Parser] Extraído - NNF:', nNF, 'Destinatário:', destXNome, 'Valor:', vNF)

    return [{
      NUM_TITULO: nNF,
      SACADO_NOME: destXNome || 'CLIENTE SEM NOME',
      SACADO_CIC: destCNPJ || destCPF || '',
      SACADO_ENDERECO: destEndereco || '',
      SACADO_BAIRRO: destBairro || '',
      SACADO_CIDADE: destCidade || '',
      SACADO_UF: destUF || '',
      SACADO_CEP: destCEP || '',
      SACADO_EMAIL: destEmail || '',
      EMISSAO: dhEmi ? new Date(dhEmi).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
      VENCIMENTO: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
      VALOR: parseFloat(vNF.toString().replace(/[^\d.,]/g, '').replace(',', '.')) || 0,
      NOSSO_NUMERO: nNF,
      STATUS: 'pendente',
    }]
  } catch (error) {
    console.error('[NFe Parser] Erro:', error)
    return []
  }
}

function parseNFSe(xmlDoc) {
  try {
    // NFSe: DOIS FORMATOS diferentes
    // Formato 1 (Ginfes): Dados do TOMADOR vêm de <TomadorServico>
    // Formato 2 (SPED): Dados do TOMADOR vêm de <toma>

    // Tenta todos os nomes de tags possíveis para NÚMERO
    let numero = getElementText(xmlDoc, 'Numero') ||
                 getElementText(xmlDoc, 'nNFSe') ||
                 getElementText(xmlDoc, 'nDFSe') || ''

    let dataEmissao = getElementText(xmlDoc, 'DataEmissao') ||
                      getElementText(xmlDoc, 'dhProc') ||
                      getElementText(xmlDoc, 'dhEmi') || new Date().toISOString()

    let valor = getElementText(xmlDoc, 'ValorServicos') ||
                getElementText(xmlDoc, 'vLiq') ||
                getElementText(xmlDoc, 'vBC') ||
                getElementText(xmlDoc, 'vServ') || '0'

    // DADOS DO TOMADOR (sacado) - PROCURAR ESPECIFICAMENTE NA TAG DO TOMADOR
    // Tentar primeiro formato Ginfes: <TomadorServico>
    let tomaElement = xmlDoc.getElementsByTagName('TomadorServico')[0]
    let tomaRazao = getChildElementText(tomaElement, 'RazaoSocial')
    let tomaCNPJ = ''
    let tomaEmail = ''
    let tomaEndereco = ''
    let tomaBairro = ''
    let tomaCidade = ''
    let tomaUF = ''
    let tomaCEP = ''
    let tomaFone = ''

    // Se encontrou TomadorServico (Ginfes format), extrair os dados
    if (tomaElement && tomaRazao) {
      // CNPJ está nested: TomadorServico > IdentificacaoTomador > CpfCnpj > Cnpj
      const idTomadorElements = tomaElement.getElementsByTagName('IdentificacaoTomador')
      if (idTomadorElements.length > 0) {
        const cpfCnpjElements = idTomadorElements[0].getElementsByTagName('CpfCnpj')
        if (cpfCnpjElements.length > 0) {
          tomaCNPJ = getChildElementText(cpfCnpjElements[0], 'Cnpj') ||
                     getChildElementText(cpfCnpjElements[0], 'Cpf') || ''
        }
      }

      // Email e Telefone estão em: TomadorServico > Contato
      const contatoElements = tomaElement.getElementsByTagName('Contato')
      if (contatoElements.length > 0) {
        tomaEmail = getChildElementText(contatoElements[0], 'Email') || ''
        tomaFone = getChildElementText(contatoElements[0], 'Telefone') || ''
      }

      // Endereço está em: TomadorServico > Endereco
      const enderecoElements = tomaElement.getElementsByTagName('Endereco')
      if (enderecoElements.length > 0) {
        tomaEndereco = getChildElementText(enderecoElements[0], 'Endereco') || ''
        tomaBairro = getChildElementText(enderecoElements[0], 'Bairro') || ''
        tomaCidade = getChildElementText(enderecoElements[0], 'Cidade') || ''
        tomaUF = getChildElementText(enderecoElements[0], 'Uf') || ''
        tomaCEP = getChildElementText(enderecoElements[0], 'Cep') || ''
      }
    }
    // Se não achou no formato Ginfes, tentar formato SPED: <toma>
    else {
      tomaElement = xmlDoc.getElementsByTagName('toma')[0]
      tomaRazao = getChildElementText(tomaElement, 'xNome')
      tomaCNPJ = getChildElementText(tomaElement, 'CNPJ') || getChildElementText(tomaElement, 'CPF')
      tomaEmail = getChildElementText(tomaElement, 'email')
      tomaFone = getChildElementText(tomaElement, 'fone')
      // No formato SPED, endereço vem dentro de <end>
      const endElement = tomaElement ? tomaElement.getElementsByTagName('end')[0] : null
      tomaEndereco = getChildElementText(endElement, 'xLgr')
      tomaBairro = getChildElementText(endElement, 'xBairro')
      tomaCidade = getChildElementText(endElement, 'xMun')
      tomaUF = getChildElementText(endElement, 'UF')
      tomaCEP = getChildElementText(endElement, 'CEP')
    }

    let tomador = tomaRazao || ''

    console.log('[NFSe Parser] Extraído - Número:', numero, 'Tomador:', tomador, 'Valor:', valor, 'Data:', dataEmissao)

    // Validar se conseguiu extrair o número (campo crítico)
    if (!numero || numero.trim() === '') {
      console.log('[NFSe Parser] Número vazio, descartando')
      return []
    }

    // Limpar valor de caracteres não numéricos
    const valorLimpo = parseFloat(valor.toString().replace(/[^\d.,]/g, '').replace(',', '.')) || 0

    return [{
      NUM_TITULO: numero,
      SACADO_NOME: tomador.trim() || 'CLIENTE SEM NOME',
      SACADO_CIC: tomaCNPJ || '',
      SACADO_ENDERECO: tomaEndereco || '',
      SACADO_BAIRRO: tomaBairro || '',
      SACADO_CIDADE: tomaCidade || '',
      SACADO_UF: tomaUF || '',
      SACADO_CEP: tomaCEP || '',
      SACADO_EMAIL: tomaEmail || '',
      SACADO_TELEFONE: tomaFone || '',
      EMISSAO: dataEmissao ? new Date(dataEmissao).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
      VENCIMENTO: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
      VALOR: valorLimpo,
      NOSSO_NUMERO: numero,
      STATUS: 'pendente',
    }]
  } catch (error) {
    console.error('[NFSe Parser] Erro:', error)
    return []
  }
}

function parseCTe(xmlDoc) {
  try {
    // CTe: Dados do TOMADOR (sacado) vêm da tag <emit> (emitente que é tomador)
    const nCT = getElementText(xmlDoc, 'nCT') || ''
    const dhEmi = getElementText(xmlDoc, 'dhEmi') || new Date().toISOString()
    const vCT = getElementText(xmlDoc, 'vCT') || '0'

    // PROCURAR ESPECIFICAMENTE NA TAG <emit> (emitente/tomador)
    const emitElement = xmlDoc.getElementsByTagName('emit')[0]
    const xNome = getChildElementText(emitElement, 'xNome') || ''
    const cnpj = getChildElementText(emitElement, 'CNPJ') || getChildElementText(emitElement, 'CPF') || ''
    const email = getChildElementText(emitElement, 'email') || ''
    const endereco = getChildElementText(emitElement, 'xLgr') || ''
    const bairro = getChildElementText(emitElement, 'xBairro') || ''
    const cidade = getChildElementText(emitElement, 'xMun') || ''
    const uf = getChildElementText(emitElement, 'UF') || ''
    const cep = getChildElementText(emitElement, 'CEP') || ''

    return [{
      NUM_TITULO: nCT,
      SACADO_NOME: xNome || 'CLIENTE SEM NOME',
      SACADO_CIC: cnpj || '',
      SACADO_ENDERECO: endereco || '',
      SACADO_BAIRRO: bairro || '',
      SACADO_CIDADE: cidade || '',
      SACADO_UF: uf || '',
      SACADO_CEP: cep || '',
      SACADO_EMAIL: email || '',
      EMISSAO: dhEmi ? new Date(dhEmi).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
      VENCIMENTO: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
      VALOR: parseFloat(vCT.toString().replace(/[^\d.,]/g, '').replace(',', '.')) || 0,
      NOSSO_NUMERO: nCT,
      STATUS: 'pendente',
    }]
  } catch (error) {
    console.error('[CTe Parser] Erro:', error)
    return []
  }
}

function parseMDFe(xmlDoc) {
  try {
    // MDFe: Dados do TOMADOR (sacado) vêm da tag <emit> (emitente/tomador)
    const nMDF = getElementText(xmlDoc, 'nMDF') || ''
    const dhEmi = getElementText(xmlDoc, 'dhEmi') || new Date().toISOString()
    const vMDF = getElementText(xmlDoc, 'vMDF') || '0'

    // PROCURAR ESPECIFICAMENTE NA TAG <emit> (emitente/tomador)
    const emitElement = xmlDoc.getElementsByTagName('emit')[0]
    const xNome = getChildElementText(emitElement, 'xNome') || ''
    const cnpj = getChildElementText(emitElement, 'CNPJ') || getChildElementText(emitElement, 'CPF') || ''
    const email = getChildElementText(emitElement, 'email') || ''
    const endereco = getChildElementText(emitElement, 'xLgr') || ''
    const bairro = getChildElementText(emitElement, 'xBairro') || ''
    const cidade = getChildElementText(emitElement, 'xMun') || ''
    const uf = getChildElementText(emitElement, 'UF') || ''
    const cep = getChildElementText(emitElement, 'CEP') || ''

    return [{
      NUM_TITULO: nMDF,
      SACADO_NOME: xNome || 'CLIENTE SEM NOME',
      SACADO_CIC: cnpj || '',
      SACADO_ENDERECO: endereco || '',
      SACADO_BAIRRO: bairro || '',
      SACADO_CIDADE: cidade || '',
      SACADO_UF: uf || '',
      SACADO_CEP: cep || '',
      SACADO_EMAIL: email || '',
      EMISSAO: dhEmi ? new Date(dhEmi).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
      VENCIMENTO: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
      VALOR: parseFloat(vMDF.toString().replace(/[^\d.,]/g, '').replace(',', '.')) || 0,
      NOSSO_NUMERO: nMDF,
      STATUS: 'pendente',
    }]
  } catch (error) {
    console.error('[MDFe Parser] Erro:', error)
    return []
  }
}

/**
 * Process file based on extension
 */
export async function processFile(file) {
  const extension = file.name.split('.').pop().toLowerCase()

  try {
    let data = []

    console.log(`[Import] Processando arquivo: ${file.name} (${extension})`)

    switch (extension) {
      case 'csv':
        data = await parseCSVFile(file)
        break
      case 'txt':
        data = await parseTXTFile(file)
        break
      case 'xlsx':
      case 'xls':
        data = await parseExcelFile(file)
        break
      case 'xml':
        data = await parseXMLFile(file)
        break
      default:
        throw new Error(`Formato de arquivo não suportado: .${extension}`)
    }

    console.log(`[Import] ${data.length} linha(s) processada(s) de ${file.name}`)

    if (data.length === 0) {
      throw new Error('Nenhum dado foi extraído do arquivo')
    }

    return { success: true, data, fileName: file.name }
  } catch (error) {
    console.error(`[Import Error] ${file.name}:`, error)
    return { success: false, error: error.message, fileName: file.name }
  }
}

/**
 * Process files and return preview data without saving to database
 */
export async function processFilesForPreview(files) {
  console.log(`[Import] Processando ${files.length} arquivo(s) para preview`)

  const allData = []
  const errors = []

  for (const file of files) {
    const { success, data, error, fileName } = await processFile(file)

    if (!success) {
      console.error(`[Import] Erro ao processar ${fileName}:`, error)
      errors.push({
        fileName,
        message: error,
      })
      continue
    }

    console.log(`[Import] ${data.length} linha(s) processada(s) de ${fileName}`)
    allData.push(...data)
  }

  return {
    data: allData,
    errors,
    total: allData.length,
  }
}

/**
 * Check if boleto exists by NUM_TITULO and detect changes
 */
async function getBoletoByNumTitulo(userId, numTitulo) {
  try {
    const { data, error } = await supabase
      .from('capt_boletos')
      .select('*')
      .eq('user_id', userId)
      .eq('numero_documento', numTitulo)
      .single()

    if (error && error.code !== 'PGRST116') throw error // PGRST116 = not found
    return data
  } catch (error) {
    console.error('[Import] Erro ao buscar boleto:', error)
    return null
  }
}

/**
 * Detect changes between existing and imported boleto
 */
function detectChanges(existing, imported) {
  const changes = {}
  const fieldsToCheck = [
    'SACADO_NOME', 'SACADO_CIC', 'SACADO_ENDERECO', 'SACADO_CIDADE',
    'SACADO_UF', 'SACADO_CEP', 'EMISSAO', 'VENCIMENTO', 'VALOR',
    'STATUS', 'NOSSO_NUMERO', 'AVALISTA_NOME', 'SACADO_BAIRRO',
    'SACADO_TELEFONE', 'SACADO_EMAIL', 'DATA_PAGAMENTO', 'VALOR_PAGAMENTO',
    'DESCRICAO'
  ]

  fieldsToCheck.forEach(field => {
    const importedValue = imported[field]
    const existingKey = field.toLowerCase()
    const existingValue = existing[existingKey] || existing[field]

    if (importedValue && importedValue !== existingValue) {
      changes[existingKey] = {
        old: existingValue,
        new: importedValue
      }
    }
  })

  return changes
}

/**
 * Import multiple files with upsert logic (insert or update)
 */
export async function importBoletos(files, userId) {
  console.log(`[Import] Iniciando importação de ${files.length} arquivo(s) para usuário ${userId}`)

  const results = []
  let totalImported = 0
  let totalUpdated = 0
  let totalUnchanged = 0
  let totalErrors = 0

  for (const file of files) {
    const { success, data, error, fileName } = await processFile(file)

    if (!success) {
      console.error(`[Import] Erro ao processar ${fileName}:`, error)
      results.push({
        fileName,
        status: 'error',
        message: error,
      })
      totalErrors++
      continue
    }

    console.log(`[Import] Processando ${data.length} boleto(s) do arquivo ${fileName}`)

    let fileImported = 0
    let fileUpdated = 0
    let fileUnchanged = 0
    let fileErrors = 0

    for (const boletoData of data) {
      try {
        // Check if boleto already exists
        const existing = await getBoletoByNumTitulo(userId, boletoData.NUM_TITULO)

        if (existing) {
          // Boleto exists - check for changes
          const changes = detectChanges(existing, boletoData)

          if (Object.keys(changes).length > 0) {
            // Update boleto
            console.log(`[Import] Atualizando boleto ${boletoData.NUM_TITULO}`, changes)

            const updatePayload = {}
            Object.keys(changes).forEach(key => {
              updatePayload[key] = changes[key].new
            })

            const { error: updateError } = await supabase
              .from('capt_boletos')
              .update(updatePayload)
              .eq('id', existing.id)

            if (updateError) {
              console.error(`[Import] Erro ao atualizar boleto:`, updateError)
              fileErrors++
            } else {
              console.log(`[Import] Boleto atualizado com sucesso: ${boletoData.NUM_TITULO}`)
              fileUpdated++
              totalUpdated++
            }
          } else {
            // No changes detected
            console.log(`[Import] Boleto já existe sem mudanças: ${boletoData.NUM_TITULO}`)
            fileUnchanged++
            totalUnchanged++
          }
        } else {
          // New boleto - insert
          console.log(`[Import] Salvando novo boleto:`, boletoData)
          const result = await createBoleto(userId, boletoData)
          const { error: saveError, data: savedData } = result

          if (saveError) {
            console.error(`[Import] Erro ao salvar boleto:`, saveError)
            fileErrors++
          } else {
            console.log(`[Import] Boleto salvo com sucesso:`, savedData?.id)
            fileImported++
            totalImported++
          }
        }
      } catch (err) {
        console.error(`[Import] Exceção ao processar boleto ${boletoData?.NUM_TITULO}:`, err)
        fileErrors++
      }
    }

    results.push({
      fileName,
      status: fileErrors === 0 ? 'success' : 'partial',
      imported: fileImported,
      updated: fileUpdated,
      unchanged: fileUnchanged,
      errors: fileErrors,
      total: data.length,
    })

    console.log(`[Import] Resultado para ${fileName}: ${fileImported} novo(s), ${fileUpdated} atualizado(s), ${fileUnchanged} sem mudanças, ${fileErrors} erro(s)`)
  }

  console.log(`[Import] Importação concluída. Total: ${totalImported} novo(s), ${totalUpdated} atualizado(s), ${totalUnchanged} sem mudanças`)

  return {
    totalImported,
    totalUpdated,
    totalUnchanged,
    totalErrors,
    results,
  }
}

/**
 * Extrair código da conta do código de barras
 * Pega as posições 24-30 do código de barras e remove apenas o dígito de verificação (último)
 * Retorna 7 dígitos para comparação com CONTAS.conta (sem o dígito de verificação)
 */
function extractContaFromBarcode(codigo_barras) {
  if (!codigo_barras || codigo_barras.length < 30) return null
  // Posições 24-30 em string (1-based) = índices 23-30 (0-based)
  const codigoCompleto = codigo_barras.substring(23, 30) // 7 caracteres
  // Remove apenas o ÚLTIMO dígito (dígito de verificação) = 7 caracteres
  const codigoSemDigito = codigoCompleto.substring(0, 7) // 0953880
  return codigoSemDigito
}

/**
 * Processar arquivo Excel para página de boletos com validação de conta
 * Se é Master: mostra todos os registros agrupados por conta
 * Se não é Master: mostra apenas registros da conta selecionada
 */
export async function processContaCaptFileForBoletos(file, userType, selectedContaId) {
  return new Promise((resolve, reject) => {
    if (!window.XLSX) {
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/xlsx/dist/xlsx.full.min.js'
      document.head.appendChild(script)

      script.onload = () => {
        processContaCaptExcel(file, userType, selectedContaId, resolve, reject)
      }
      script.onerror = () => {
        reject(new Error('Erro ao carregar biblioteca Excel'))
      }
    } else {
      processContaCaptExcel(file, userType, selectedContaId, resolve, reject)
    }
  })
}

function processContaCaptExcel(file, userType, selectedContaId, resolve, reject) {
  const reader = new FileReader()

  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result)
      const workbook = window.XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = window.XLSX.utils.sheet_to_json(worksheet)

      console.log(`[ContaCapt] Encontrado ${jsonData.length} linhas`)

      // Processar cada linha
      const processados = jsonData.map(row => {
        const codigoBarras = String(row['Linha digitável'] || '').trim()
        const contaCodigo = extractContaFromBarcode(codigoBarras)

        return {
          NUM_TITULO: String(row['Seu número'] || row['Número do documento'] || '').trim(),
          SACADO_NOME: String(row['Nome do pagador'] || '').trim(),
          SACADO_CIC: String(row['Documento federal do pagador'] || '').replace(/\D/g, ''),
          EMISSAO: formatarData(row['Data de emissão']),
          VENCIMENTO: formatarData(row['Data de vencimento']),
          VALOR: parseFloat(String(row['Valor do título'] || '0').replace(/[^\d,.-]/g, '').replace(',', '.')),
          NOSSO_NUMERO: String(row['Nosso número'] || '').trim(),
          STATUS: mapStatus(String(row['Status do boleto'] || '')),
          SACADO_ENDERECO: String(row['Logradouro do pagador'] || '').trim(),
          SACADO_BAIRRO: String(row['Bairro do pagador'] || '').trim(),
          SACADO_CIDADE: String(row['Cidade do pagador'] || '').trim(),
          SACADO_UF: String(row['UF do pagador'] || '').substring(0, 2).toUpperCase(),
          SACADO_CEP: String(row['CEP do pagador'] || '').replace(/\D/g, ''),
          SACADO_TELEFONE: String(row['Telefone do pagador'] || '').trim(),
          SACADO_EMAIL: String(row['Email do pagador'] || '').trim(),
          CODIGO_BARRAS: codigoBarras,
          CONTA_CODIGO: contaCodigo,
          AVALISTA_NOME: String(row['Beneficiário final (sacador avalista)'] || '').trim(),
          DESCRICAO: String(row['Descrição'] || '').trim(),
        }
      }).filter(b => b.SACADO_NOME && b.VALOR > 0)

      // Filtrar conforme tipo de usuário
      let filtrados = processados

      if (userType !== 'M') {
        // Não é Master: filtrar apenas registros da conta selecionada
        // selectedContaId vem como CONTAS.conta (ex: 09538802)
        // Extrair 7 primeiros dígitos para comparar (remove dígito de verificação)
        const contaSelecionadaFull = String(selectedContaId).padStart(8, '0')
        const contaSelecionadaFormatada = contaSelecionadaFull.substring(0, 7)
        console.log(`[ContaCapt] Filtrando para conta selecionada: ${selectedContaId} -> ${contaSelecionadaFormatada}`)
        filtrados = processados.filter(b => {
          const match = b.CONTA_CODIGO && b.CONTA_CODIGO === contaSelecionadaFormatada
          console.log(`[ContaCapt] Boleto CONTA_CODIGO="${b.CONTA_CODIGO}" vs "${contaSelecionadaFormatada}" = ${match}`)
          return match
        })

        if (filtrados.length === 0) {
          reject(new Error(`Nenhum boleto encontrado para a conta selecionada (${selectedContaId})`))
          return
        }
      } else {
        // É Master: agrupar por conta
        // Manter informação de qual conta cada boleto pertence
      }

      if (filtrados.length === 0) {
        reject(new Error('Nenhum boleto válido encontrado no arquivo'))
        return
      }

      console.log(`[ContaCapt] ${filtrados.length} boleto(s) processado(s)`)
      resolve({
        data: filtrados,
        total: filtrados.length,
        userType,
      })
    } catch (error) {
      console.error('[ContaCapt] Erro:', error)
      reject(new Error('Erro ao processar arquivo: ' + error.message))
    }
  }

  reader.onerror = () => {
    reject(new Error('Erro ao ler arquivo'))
  }

  reader.readAsArrayBuffer(file)
}

function mapStatus(statusExcel) {
  if (!statusExcel) return 'pendente'
  const status = String(statusExcel).toLowerCase().trim()
  if (status.includes('pago')) return 'pago'
  if (status.includes('vencer')) return 'pendente'
  if (status.includes('atraso')) return 'atrasado'
  if (status.includes('cancel')) return 'cancelado'
  return 'pendente'
}
