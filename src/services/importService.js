import { createBoleto } from './boletoService'
import { supabase } from '../lib/supabase'

/**
 * Parse Excel files (.xlsx, .xls) - SIMPLES e DIRETO
 * Carrega biblioteca XLSX do unpkg e mapeia colunas automaticamente
 * @param {File} file - arquivo Excel
 * @param {string} profileName - nome do perfil/conta (avalista nome)
 * @param {string} profileCIC - CNPJ do perfil/conta (avalista CIC)
 */
async function parseExcelFile(file, profileName, profileCIC) {
  return new Promise((resolve, reject) => {
    // Carregar biblioteca XLSX se não estiver carregada
    if (!window.XLSX) {
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/xlsx/dist/xlsx.full.min.js'
      document.head.appendChild(script)

      script.onload = () => {
        processExcelFile(file, profileName, profileCIC, resolve, reject)
      }
      script.onerror = () => {
        reject(new Error('Erro ao carregar biblioteca Excel'))
      }
    } else {
      processExcelFile(file, profileName, profileCIC, resolve, reject)
    }
  })
}

function processExcelFile(file, profileName, profileCIC, resolve, reject) {
  const reader = new FileReader()

  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result)
      const workbook = window.XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      let worksheet = workbook.Sheets[sheetName]

      // **IMPORTANTE**: Desmergar células se houver mesclagens
      worksheet = unmergeAndFillCells(worksheet)

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
          VALOR: converterValor(row['Valor do título']),
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
          // Avalista auto-populate com dados do perfil logado
          AVALISTA_NOME: profileName || String(row['Beneficiário final (sacador avalista)'] || '').trim(),
          AVALISTA_CIC: profileCIC || String(row['Documento federal do avalista'] || row['CPF/CNPJ do avalista'] || row['CIC do avalista'] || '').replace(/\D/g, ''),
          VALOR_PAGAMENTO: converterValor(row['Valor pago']),
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
 * Converter valor de string para número (suporta formato brasileiro e americano)
 * Exemplo: "2.199,54" → 2199.54 | "2,199.54" → 2199.54 | "2199.54" → 2199.54
 * @param {string|number} valor - valor a converter
 * @returns {number} - valor numérico
 */
function converterValor(valor) {
  if (!valor) return 0

  const valorStr = String(valor).replace(/[^\d.,]/g, '')

  // Detectar formato: se tem vírgula, é brasileiro (2.199,54)
  if (valorStr.includes(',')) {
    // Formato brasileiro: remover todos os pontos (separador de milhares)
    // e manter a vírgula que vira ponto (separador decimal)
    const numStr = valorStr.replace(/\./g, '').replace(',', '.')
    return parseFloat(numStr) || 0
  } else {
    // Formato americano: remover vírgulas e usar como está
    const numStr = valorStr.replace(',', '')
    return parseFloat(numStr) || 0
  }
}

/**
 * Parse CSV files (.csv)
 * @param {File} file - arquivo CSV
 * @param {string} profileName - nome do perfil/conta (avalista nome)
 * @param {string} profileCIC - CNPJ do perfil/conta (avalista CIC)
 */
async function parseCSVFile(file, profileName, profileCIC) {
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
    // Avalista auto-populate com dados do perfil logado
    AVALISTA_NOME: profileName || '',
    AVALISTA_CIC: profileCIC || '',
  }))
}

/**
 * Parse TXT files (fixed format)
 * @param {File} file - arquivo TXT
 * @param {string} profileName - nome do perfil/conta (avalista nome)
 * @param {string} profileCIC - CNPJ do perfil/conta (avalista CIC)
 */
async function parseTXTFile(file, profileName, profileCIC) {
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
      // Avalista auto-populate com dados do perfil logado
      AVALISTA_NOME: profileName || '',
      AVALISTA_CIC: profileCIC || '',
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

    // Extrair descrição - prioridade: infCpl (NFe) → xDescServ (NFSe) → Discriminacao (NFSe alt) → xInfComp → Complemento
    let descricao = getElementText(xmlDoc, 'infCpl') ||
                    getElementText(xmlDoc, 'xDescServ') ||
                    getElementText(xmlDoc, 'Discriminacao') ||
                    getElementText(xmlDoc, 'xInfComp') ||
                    getElementText(xmlDoc, 'Complemento') || ''

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

    // Formata data ISO (YYYY-MM-DD) para DD/MM/YYYY sem problemas de fuso horário
    const fmtDataBR = (iso) => {
      if (!iso) return ''
      const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/)
      if (m) return `${m[3]}/${m[2]}/${m[1]}`
      const d = new Date(iso)
      return isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR')
    }

    const emissaoBR = fmtDataBR((dhEmi || '').split('T')[0]) || new Date().toLocaleDateString('pt-BR')

    const sacadoFields = {
      SACADO_NOME: destXNome || 'CLIENTE SEM NOME',
      SACADO_CIC: destCNPJ || destCPF || '',
      SACADO_ENDERECO: destEndereco || '',
      SACADO_BAIRRO: destBairro || '',
      SACADO_CIDADE: destCidade || '',
      SACADO_UF: destUF || '',
      SACADO_CEP: destCEP || '',
      SACADO_EMAIL: destEmail || '',
      DESCRICAO: descricao || '',
      STATUS: 'pendente',
    }

    // Uma parcela por <dup> dentro de <cobr>:
    //   título = nNF-nDup (ex.: 6840-1, 6840-2), valor = vDup, vencimento = dVenc
    const dups = Array.from(xmlDoc.getElementsByTagName('dup'))
    console.log('[NFe Parser] NNF:', nNF, 'Destinatário:', destXNome, 'Parcelas (dup):', dups.length)

    if (dups.length > 0) {
      // Monta as parcelas no formato esperado pelo ImportPreview (_parcelas):
      // um único cadastro (sacado) com as parcelas exibidas abaixo, como no parcelamento manual.
      const parcelas = dups.map((dup) => {
        const nDup = getChildElementText(dup, 'nDup') || ''
        const dVenc = getChildElementText(dup, 'dVenc') || ''
        const vDup = getChildElementText(dup, 'vDup') || '0'
        const parcela = parseInt(nDup, 10)
        const tituloNum = `${nNF}-${isNaN(parcela) ? nDup : parcela}`
        return {
          number: tituloNum,
          dueDate: fmtDataBR(dVenc),
          value: converterValor(vDup),
          emission: emissaoBR,
        }
      })

      const primeira = parcelas[0]
      return [{
        ...sacadoFields,
        NUM_TITULO: primeira.number,
        NOSSO_NUMERO: primeira.number,
        EMISSAO: primeira.emission,
        VENCIMENTO: primeira.dueDate,
        VALOR: primeira.value,
        _parcelas: parcelas,
      }]
    }

    // Sem parcelas (NF à vista): um único boleto com o valor total
    const vencAvista = fmtDataBR(getElementText(xmlDoc, 'dVenc'))
    return [{
      ...sacadoFields,
      NUM_TITULO: nNF,
      NOSSO_NUMERO: nNF,
      EMISSAO: emissaoBR,
      VENCIMENTO: vencAvista || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
      VALOR: converterValor(vNF),
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

    // Extrair descrição - prioridade: xDescServ (NFSe) → Discriminacao → xInfComp → Complemento → infCpl
    let descricao = getElementText(xmlDoc, 'xDescServ') ||
                    getElementText(xmlDoc, 'Discriminacao') ||
                    getElementText(xmlDoc, 'xInfComp') ||
                    getElementText(xmlDoc, 'Complemento') ||
                    getElementText(xmlDoc, 'infCpl') || ''

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

    // Converter valor para número (suporta formato brasileiro)
    const valorLimpo = converterValor(valor)

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
      DESCRICAO: descricao || '',
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
    const descricao = getElementText(xmlDoc, 'xDescServ') ||
                      getElementText(xmlDoc, 'Discriminacao') ||
                      getElementText(xmlDoc, 'xInfComp') ||
                      getElementText(xmlDoc, 'Complemento') ||
                      getElementText(xmlDoc, 'infCpl') || ''

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
      VALOR: converterValor(vCT),
      DESCRICAO: descricao || '',
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
    const descricao = getElementText(xmlDoc, 'xDescServ') ||
                      getElementText(xmlDoc, 'Discriminacao') ||
                      getElementText(xmlDoc, 'xInfComp') ||
                      getElementText(xmlDoc, 'Complemento') ||
                      getElementText(xmlDoc, 'infCpl') || ''

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
      VALOR: converterValor(vMDF),
      DESCRICAO: descricao || '',
      NOSSO_NUMERO: nMDF,
      STATUS: 'pendente',
    }]
  } catch (error) {
    console.error('[MDFe Parser] Erro:', error)
    return []
  }
}

/**
 * Parse arquivo OS - Ordem de Serviço (.xls) - Mapeamento específico de células
 * Detecta arquivo por padrão 'OS_' e extrai dados de células específicas
 *
 * Nota: Pode vir de qualquer cliente (FORTALLOG, etc), não é vinculado a um cliente específico
 *
 * Mapeamento de células:
 * - numero_documento: D13
 * - data_emissao: AN11
 * - sacado_nome: K16
 * - sacado_cic: F17
 * - sacado_endereco: F19
 * - sacado_bairro: F20
 * - sacado_cep: T20
 * - sacado_cidade: AJ19
 * - valor: coluna AU (linha com "Saldo A Receber" na coluna AJ)
 * - vencimentos: coluna X (procura "Data" e extrai datas abaixo)
 *
 * @param {File} file - arquivo Excel
 * @param {string} profileName - nome do perfil/conta (avalista nome)
 * @param {string} profileCIC - CNPJ do perfil/conta (avalista CIC)
 */
async function parseOSFile(file, profileName, profileCIC) {
  return new Promise((resolve, reject) => {
    if (!window.XLSX) {
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/xlsx/dist/xlsx.full.min.js'
      document.head.appendChild(script)

      script.onload = () => {
        processOSExcel(file, profileName, profileCIC, resolve, reject)
      }
      script.onerror = () => {
        reject(new Error('Erro ao carregar biblioteca Excel'))
      }
    } else {
      processOSExcel(file, profileName, profileCIC, resolve, reject)
    }
  })
}

function processOSExcel(file, profileName, profileCIC, resolve, reject) {
  const reader = new FileReader()

  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result)
      const workbook = window.XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      let worksheet = workbook.Sheets[sheetName]

      console.log(`[OS] Processando arquivo ${file.name}`)

      // **IMPORTANTE**: Desmergar células se houver mesclagens
      worksheet = unmergeAndFillCells(worksheet)

      // Helper para converter coluna (A, B, ..., Z, AA, AB, ..., AZ, BA, etc) para número
      const colToNum = (col) => {
        let result = 0
        for (let i = 0; i < col.length; i++) {
          result = result * 26 + (col.charCodeAt(i) - 'A'.charCodeAt(0) + 1)
        }
        return result
      }

      // Helper para obter valor de célula por referência (ex: 'D13', 'AN11')
      const getCellValue = (cellRef) => {
        const cell = worksheet[cellRef]
        return cell ? cell.v : ''
      }

      // Extrair dados das células específicas
      const numero_documento = String(getCellValue('D13') || '').trim()
      const data_emissao = String(getCellValue('AN11') || '').trim()
      const sacado_nome = String(getCellValue('K16') || '').trim()
      const sacado_cic = String(getCellValue('F17') || '').replace(/\D/g, '')
      const sacado_endereco = String(getCellValue('F19') || '').trim()
      const sacado_bairro = String(getCellValue('F20') || '').trim()
      const sacado_cep = String(getCellValue('T20') || '').replace(/\D/g, '')
      const sacado_cidade = String(getCellValue('AJ19') || '').trim()

      // Extrair G14 (placa) + L14 (descrição do equipamento) para descricao
      const placa = String(getCellValue('G14') || '').trim()
      const equipamento = String(getCellValue('L14') || '').trim()
      const descricao = placa && equipamento ? `${placa} - ${equipamento}`
                      : placa ? placa
                      : equipamento ? equipamento
                      : ''

      // Procurar pela linha contendo "Saldo A Receber" na coluna AJ
      let linhaValor = null
      const colAJNum = colToNum('AJ')

      // Iterar pelas células do worksheet para encontrar "Saldo A Receber" na coluna AJ
      for (const cellRef in worksheet) {
        const cell = worksheet[cellRef]
        if (cell && cell.v) {
          const cellValue = String(cell.v).trim().toUpperCase()
          // Verificar se a célula contém "SALDO A RECEBER" (ou variações)
          if (cellValue.includes('SALDO') && cellValue.includes('RECEBER')) {
            // Extrair número da linha da referência (ex: "AJ54" -> 54)
            const match = cellRef.match(/(\d+)$/)
            if (match) {
              linhaValor = parseInt(match[1])
              console.log(`[OS] "Saldo A Receber" encontrado na linha ${linhaValor}, coluna AJ`)
              break
            }
          }
        }
      }

      // Se não encontrou "Saldo A Receber", usar default AU54
      if (!linhaValor) {
        console.log(`[OS] "Saldo A Receber" não encontrado, usando default AU54`)
        linhaValor = 54
      }

      // Obter valor da coluna AU na linha encontrada
      const celulaDOValor = 'AU' + linhaValor
      let valor = getCellValue(celulaDOValor)
      console.log(`[OS] Valor obtido da célula ${celulaDOValor}: ${valor}`)

      // Converter valor para número (detectar formato brasileiro ou internacional)
      if (typeof valor === 'string') {
        // Remover espaços
        let valorLimpo = valor.trim()

        // Detectar formato brasileiro (1.234,56) vs internacional (1,234.56)
        // Formato brasileiro: último separador é vírgula, anteriores são pontos
        // Formato internacional: último separador é ponto, anteriores são vírgulas

        // Contar separadores
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

        valor = parseFloat(valorLimpo)
      } else if (typeof valor === 'number') {
        valor = valor
      } else {
        valor = 0
      }

      // Validar dados obrigatórios
      if (!numero_documento || !sacado_nome || valor <= 0) {
        reject(new Error('Arquivo inválido: dados obrigatórios faltando (documento, nome ou valor)'))
        return
      }

      console.log(`[OS] Dados extraídos:`, {
        numero_documento,
        data_emissao,
        sacado_nome,
        valor,
      })

      // Formatar data se necessário
      let data_emissao_formatada = data_emissao
      if (data_emissao && !/^\d{2}\/\d{2}\/\d{4}$/.test(data_emissao)) {
        // Se não está em DD/MM/YYYY, tentar converter
        try {
          data_emissao_formatada = new Date(data_emissao).toLocaleDateString('pt-BR')
        } catch {
          data_emissao_formatada = new Date().toLocaleDateString('pt-BR')
        }
      }

      // Extrair UF de sacado_cidade (ex: "FORTALEZA - CE" -> "CE")
      const sacado_uf = sacado_cidade.includes('-')
        ? sacado_cidade.split('-')[1].trim().toUpperCase().substring(0, 2)
        : ''

      // **NOVO**: Procurar pela coluna X "Data" e extrair vencimentos
      let vencimentos = []
      const colXNum = colToNum('X')

      // Iterar pelas células do worksheet para encontrar "Data" na coluna X
      let linhaData = null
      for (const cellRef in worksheet) {
        const cell = worksheet[cellRef]
        if (cell && cell.v) {
          const cellValue = String(cell.v).trim().toUpperCase()
          // Verificar se é exatamente "Data" na coluna X
          if (cellValue === 'DATA') {
            const match = cellRef.match(/^X(\d+)$/)
            if (match) {
              linhaData = parseInt(match[1])
              console.log(`[OS] "Data" encontrado na coluna X, linha ${linhaData}`)
              break
            }
          }
        }
      }

      // Se encontrou "Data" na coluna X, extrair vencimentos abaixo
      if (linhaData) {
        console.log(`[OS] Procurando vencimentos abaixo da linha ${linhaData} na coluna X`)
        let linhaAtual = linhaData + 1

        // Extrair datas (vencimentos) nas próximas linhas da coluna X
        while (linhaAtual <= 100) { // Limite razoável de linhas a verificar
          const cellRef = 'X' + linhaAtual
          const cellValue = getCellValue(cellRef)

          if (!cellValue) {
            // Se célula vazia, parar de procurar
            console.log(`[OS] Célula X${linhaAtual} vazia, parando busca de vencimentos`)
            break
          }

          // Tentar converter para data
          const dataFormatada = formatarData(cellValue)

          // Verificar se é uma data válida (não é a data padrão de hoje)
          if (dataFormatada && /^\d{2}\/\d{2}\/\d{4}$/.test(dataFormatada)) {
            vencimentos.push(dataFormatada)
            console.log(`[OS] Vencimento encontrado em X${linhaAtual}: ${dataFormatada}`)
          } else {
            // Se não for data, parar de procurar
            console.log(`[OS] X${linhaAtual} não é uma data válida (${cellValue}), parando busca`)
            break
          }

          linhaAtual++
        }
      }

      console.log(`[OS] Total de vencimentos encontrados: ${vencimentos.length}`)

      // Construir objeto do boleto no mesmo formato dos outros parsers
      let boleto = {
        NUM_TITULO: numero_documento,
        SACADO_NOME: sacado_nome,
        SACADO_CIC: sacado_cic,
        SACADO_ENDERECO: sacado_endereco,
        SACADO_BAIRRO: sacado_bairro,
        SACADO_CIDADE: sacado_cidade,
        SACADO_UF: sacado_uf,
        SACADO_CEP: sacado_cep,
        EMISSAO: data_emissao_formatada,
        VENCIMENTO: vencimentos.length > 0 ? vencimentos[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
        VALOR: valor,
        DESCRICAO: descricao,
        NOSSO_NUMERO: numero_documento, // Usar número do documento como nosso número
        STATUS: 'pendente',
        AVALISTA_NOME: profileName || '',
        AVALISTA_CIC: profileCIC || '',
      }

      // **NOVO**: Se há múltiplos vencimentos, criar parcelas pré-preenchidas
      if (vencimentos.length > 1) {
        const valorParcela = valor / vencimentos.length
        const parcelas = vencimentos.map((vencimento, idx) => ({
          number: `${numero_documento}-${idx + 1}`,
          originalNumber: numero_documento,
          installmentIndex: idx + 1,
          value: valorParcela,
          dueDate: vencimento,
          emission: data_emissao_formatada,
        }))

        // Adicionar parcelas ao objeto do boleto
        boleto._parcelas = parcelas
        boleto._totalParcelas = vencimentos.length

        console.log(`[OS] Boleto com ${vencimentos.length} parcelas criado:`, {
          numero_documento,
          valorTotal: valor,
          valorParcela,
          vencimentos
        })
      } else {
        console.log(`[OS] Boleto sem parcelas (${vencimentos.length} vencimentos encontrados):`, boleto)
      }

      // Retornar como array com um único boleto
      resolve([boleto])
    } catch (error) {
      console.error('[OS] Erro:', error)
      reject(new Error('Erro ao processar arquivo OS: ' + error.message))
    }
  }

  reader.onerror = () => {
    reject(new Error('Erro ao ler arquivo'))
  }

  reader.readAsArrayBuffer(file)
}

/**
 * Desmergar células em um worksheet
 * Preenche as células desmergidas com o valor da célula principal
 * @param {object} worksheet - worksheet do XLSX
 * @returns {object} - worksheet com células desmergidas
 */
function unmergeAndFillCells(worksheet) {
  console.log(`[Unmerge] Iniciando desmeragem de células`)

  if (!worksheet['!mergedCells'] || worksheet['!mergedCells'].length === 0) {
    console.log(`[Unmerge] Nenhuma célula mesclada encontrada`)
    return worksheet
  }

  const mergedCells = worksheet['!mergedCells']
  console.log(`[Unmerge] Encontradas ${mergedCells.length} regiões mescladas`)

  // Processar cada célula mesclada
  mergedCells.forEach((merged, idx) => {
    // Formato: {s: {r: row1, c: col1}, e: {r: row2, c: col2}}
    const startRow = merged.s.r
    const startCol = merged.s.c
    const endRow = merged.e.r
    const endCol = merged.e.c

    // Obter o valor da primeira célula (principal)
    const startCellRef = window.XLSX.utils.encode_cell({ r: startRow, c: startCol })
    const mainValue = worksheet[startCellRef]?.v || ''

    console.log(`[Unmerge] ${idx + 1}. Desmerging ${startCellRef} (${endRow - startRow + 1}x${endCol - startCol + 1})`)

    // Preencher todas as células da região mesclada com o mesmo valor
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const cellRef = window.XLSX.utils.encode_cell({ r, c })
        if (!worksheet[cellRef]) {
          worksheet[cellRef] = { v: mainValue, t: typeof mainValue === 'number' ? 'n' : 's' }
        }
      }
    }
  })

  // Remover informação de merged cells
  delete worksheet['!mergedCells']
  console.log(`[Unmerge] ✓ Desmeragem concluída`)

  return worksheet
}

/**
 * Parser Genérico para OS - Busca por Keywords
 * Procura pelos textos descritos e extrai valores ao lado (pula colunas se necessário)
 * Estratégia inteligente:
 * 1. Procura em TODA a planilha (sem limite de linhas)
 * 2. Ignora valores muito curtos ou que parecem códigos (números puros)
 * 3. Retorna primeiro valor "real" encontrado (texto com length > 5 ou contém letras)
 *
 * @param {object} jsonData - dados convertidos do worksheet
 * @param {string} searchText - texto a procurar
 * @param {number} maxColsAhead - máximo de colunas à frente para procurar
 * @returns {string|null} - valor encontrado ou null
 */
function findValueAfterText(jsonData, searchText, maxColsAhead = 10) {
  // Procurar em TODA a planilha, não apenas primeiras 30 linhas
  // Alguns arquivos têm headers em linhas posteriores
  for (let rowIdx = 0; rowIdx < jsonData.length; rowIdx++) {
    const rowObj = jsonData[rowIdx]
    if (!rowObj) continue

    const rowKeys = Object.keys(rowObj)

    for (let colIdx = 0; colIdx < rowKeys.length; colIdx++) {
      const cellVal = String(rowObj[rowKeys[colIdx]] || '').toUpperCase()

      if (cellVal.includes(searchText.toUpperCase())) {
        // Procurar valor nas próximas colunas (pular até maxColsAhead)
        // Estratégia: Ignorar códigos numéricos, procurar por texto real
        let bestValue = null

        for (let k = colIdx + 1; k < Math.min(colIdx + maxColsAhead, rowKeys.length); k++) {
          const nextVal = String(rowObj[rowKeys[k]] || '').trim()

          if (!nextVal || nextVal.length === 0) {
            continue // Célula vazia, pular
          }

          // Estratégia para "Cliente:" ou nomes
          // Preferir valores com comprimento > 5 ou contendo letras (não só números)
          const isNumericOnly = /^\d+$/.test(nextVal)
          const hasLetters = /[A-Z]/i.test(nextVal)

          // Se for "Cliente:", "Empresa", ou similar: preferir texto com letras
          if (searchText.toUpperCase().includes('CLIENTE') ||
              searchText.toUpperCase().includes('NOME') ||
              searchText.toUpperCase().includes('EMPRESA')) {
            // Ignorar valores puramente numéricos (códigos como 136)
            if (isNumericOnly) {
              console.log(`[OS Generic] "${searchText}" ignorando valor numérico: "${nextVal}"`)
              continue
            }
          }

          // Se chegou aqui, é um valor válido
          bestValue = nextVal
          console.log(`[OS Generic] "${searchText}" encontrado em L${rowIdx + 1}, valor: "${bestValue}"`)
          return bestValue
        }

        // Se não encontrou valor "real", retornar o que achamos (mesmo que seja número)
        if (bestValue) {
          return bestValue
        }
      }
    }
  }

  console.log(`[OS Generic] "${searchText}" não encontrado em toda a planilha`)
  return null
}

/**
 * Extrair parcelas por marcador "BOLETO"
 * Estratégia: Procura linha com "BOLETO", depois extrai vencimento e valor nas colunas à direita
 * - Primeira coluna após BOLETO é desprezada (código)
 * - Segunda é o vencimento (formato DD/MM/YYYY)
 * - Terceira é o valor (número com . ou ,)
 * - Pode haver múltiplas linhas com BOLETO = múltiplas parcelas
 * @param {object} jsonData - dados do worksheet
 * @returns {array} - array com parcelas {vencimento, valor, linha}
 */
function findBoletoParcelasByBoletoMarker(jsonData) {
  const parcelas = []

  console.log(`[OS Generic] Procurando parcelas por marcador "BOLETO"...`)

  for (let rowIdx = 0; rowIdx < jsonData.length; rowIdx++) {
    const rowObj = jsonData[rowIdx]
    if (!rowObj) continue

    const rowKeys = Object.keys(rowObj)
    let boletoFound = false
    let boletoColIdx = -1

    // Procurar "BOLETO" na linha
    for (let colIdx = 0; colIdx < rowKeys.length; colIdx++) {
      const cellVal = String(rowObj[rowKeys[colIdx]] || '').toUpperCase()
      if (cellVal.includes('BOLETO')) {
        boletoFound = true
        boletoColIdx = colIdx
        console.log(`[OS Generic] "BOLETO" encontrado em L${rowIdx + 1}, coluna ${rowKeys[colIdx]}`)
        break
      }
    }

    if (boletoFound) {
      // Encontrou BOLETO, procurar vencimento e valor nas próximas colunas à direita
      let vencimento = null
      let valor = null
      let skipFirst = true // Pular primeiro valor (código)

      for (let colIdx = boletoColIdx + 1; colIdx < rowKeys.length; colIdx++) {
        const cellVal = String(rowObj[rowKeys[colIdx]] || '').trim()

        if (!cellVal) continue

        // Pular primeiro valor não-vazio (código)
        if (skipFirst) {
          console.log(`[OS Generic]   Pulando primeiro valor (código): "${cellVal}"`)
          skipFirst = false
          continue
        }

        // Procurar vencimento (formato DD/MM/YYYY)
        if (!vencimento && /^\d{2}\/\d{2}\/\d{4}$/.test(cellVal)) {
          vencimento = cellVal
          console.log(`[OS Generic]   Vencimento encontrado: "${vencimento}"`)
          continue
        }

        // Procurar valor (número com . ou , como separador decimal)
        // Padrão: 123.456,78 (brasileiro) ou 1234.56 (americano)
        if (!valor && /^\d+[.,]\d+$/.test(cellVal)) {
          valor = cellVal
          console.log(`[OS Generic]   Valor encontrado: "${valor}"`)
          continue
        }

        // Se já temos vencimento e valor, parar
        if (vencimento && valor) break
      }

      // Adicionar parcela se encontrou ambos
      if (vencimento && valor) {
        parcelas.push({
          vencimento,
          valor,
          linha: rowIdx + 1
        })
        console.log(`[OS Generic] Parcela ${parcelas.length} adicionada: ${vencimento} / ${valor}`)
      } else {
        if (!vencimento) console.log(`[OS Generic]   ⚠️ Vencimento não encontrado para BOLETO em L${rowIdx + 1}`)
        if (!valor) console.log(`[OS Generic]   ⚠️ Valor não encontrado para BOLETO em L${rowIdx + 1}`)
      }
    }
  }

  console.log(`[OS Generic] Total de parcelas encontradas por BOLETO: ${parcelas.length}`)
  return parcelas
}

/**
 * Extrair múltiplos valores abaixo de um label (para Valor e Vencimento)
 * Procura em TODA a planilha pelo label, não apenas primeiras linhas
 * @param {object} jsonData - dados do worksheet
 * @param {string} labelText - texto do label a procurar
 * @param {string} fieldName - nome do campo (para logging)
 * @returns {array} - array com os valores encontrados
 */
function findValuesBelow(jsonData, labelText, fieldName = 'Campo') {
  const values = []

  // Procurar pela linha com o label em TODA a planilha
  let labelRowIdx = -1
  let labelColIdx = -1

  for (let rowIdx = 0; rowIdx < jsonData.length; rowIdx++) {
    const rowObj = jsonData[rowIdx]
    if (!rowObj) continue

    const rowKeys = Object.keys(rowObj)
    for (let colIdx = 0; colIdx < rowKeys.length; colIdx++) {
      const cellVal = String(rowObj[rowKeys[colIdx]] || '').toUpperCase()
      if (cellVal.includes(labelText.toUpperCase())) {
        labelRowIdx = rowIdx
        labelColIdx = colIdx
        console.log(`[OS Generic] Label "${labelText}" encontrado em L${rowIdx + 1}, coluna ${rowKeys[colIdx]}`)
        break
      }
    }
    if (labelRowIdx >= 0) break
  }

  // Se encontrou o label, procurar valores abaixo
  if (labelRowIdx >= 0) {
    const labelColName = Object.keys(jsonData[labelRowIdx])[labelColIdx]

    // Procurar valores na mesma coluna, linhas abaixo (até 50 linhas após o label)
    // Se o label estiver em L40, procura até L90
    for (let rowIdx = labelRowIdx + 1; rowIdx < Math.min(jsonData.length, labelRowIdx + 50); rowIdx++) {
      const rowObj = jsonData[rowIdx]
      if (!rowObj) continue

      const cellVal = String(rowObj[labelColName] || '').trim()

      if (!cellVal) {
        // Célula vazia = parar de procurar
        console.log(`[OS Generic] Célula vazia encontrada em L${rowIdx + 1}, parando coleta de ${fieldName}`)
        break
      }

      // Validar se é valor válido (não é label ou contém caracteres especiais de label)
      if (cellVal.length > 0 && !cellVal.toUpperCase().includes(':')) {
        values.push(cellVal)
        console.log(`[OS Generic] ${fieldName} L${rowIdx + 1}: "${cellVal}"`)
      }
    }
  } else {
    console.log(`[OS Generic] Label "${labelText}" não encontrado em nenhuma linha`)
  }

  console.log(`[OS Generic] Total ${fieldName}: ${values.length}`)
  return values
}

/**
 * Parse arquivo OS Tipo B - Novo formato com busca de palavras-chave
 * Mapeamento por keywords em linha por linha
 * @param {File} file - arquivo Excel
 * @param {string} profileName - nome do perfil/conta (avalista nome)
 * @param {string} profileCIC - CNPJ do perfil/conta (avalista CIC)
 */
async function parseOSTypeB(file, profileName, profileCIC) {
  return new Promise((resolve, reject) => {
    if (!window.XLSX) {
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/xlsx/dist/xlsx.full.min.js'
      document.head.appendChild(script)

      script.onload = () => {
        processOSTypeB(file, profileName, profileCIC, resolve, reject)
      }
      script.onerror = () => {
        reject(new Error('Erro ao carregar biblioteca Excel'))
      }
    } else {
      processOSTypeB(file, profileName, profileCIC, resolve, reject)
    }
  })
}

function processOSTypeB(file, profileName, profileCIC, resolve, reject) {
  const reader = new FileReader()

  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result)
      const workbook = window.XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      let worksheet = workbook.Sheets[sheetName]

      console.log(`[OS TypeB] Processando arquivo ${file.name}`)

      // **IMPORTANTE**: Desmergar células se houver mesclagens
      worksheet = unmergeAndFillCells(worksheet)

      // Helper para obter valor de célula por referência
      const getCellValue = (cellRef) => {
        const cell = worksheet[cellRef]
        return cell ? cell.v : ''
      }

      // Converter worksheet para JSON para facilitar busca (com defval para células vazias)
      const jsonData = window.XLSX.utils.sheet_to_json(worksheet, { defval: '' })

      console.log(`[OS Generic] Processando arquivo com parser genérico de keywords`)

      // **1. Extrair NUM_TITULO - procurar "Código:"**
      let numero_documento = findValueAfterText(jsonData, 'Código:')

      // Se não encontrou, tenta do nome do arquivo como fallback
      if (!numero_documento) {
        const fileNameMatch = file.name.match(/OS_(\d+)/)
        numero_documento = fileNameMatch ? fileNameMatch[1] : ''
        console.log(`[OS Generic] NUM_TITULO extraído do nome do arquivo: ${numero_documento}`)
      }

      if (!numero_documento) {
        reject(new Error('Não conseguiu extrair número do título (Código: não encontrado e nome sem padrão)'))
        return
      }

      console.log(`[OS Generic] NUM_TITULO: ${numero_documento}`)

      // **2. Extrair EMISSAO - sugerir data de hoje (conforme instrução)**
      let data_emissao_formatada = new Date().toLocaleDateString('pt-BR')
      console.log(`[OS Generic] EMISSAO (padrão): ${data_emissao_formatada}`)

      // **3. Extrair SACADO (Cliente, CIC, Endereço, Bairro, Cidade, UF, CEP)**
      // Usando busca genérica por keywords
      // NOTA: Labels podem ter variações de espaçamento como "Cliente:" vs "Cliente :"
      let sacado_nome = findValueAfterText(jsonData, 'Cliente') || findValueAfterText(jsonData, 'Cliente:')
      let sacado_cic = findValueAfterText(jsonData, 'Cnpj') || findValueAfterText(jsonData, 'CPF') || findValueAfterText(jsonData, 'Cnpj / Cpf')
      let sacado_endereco = findValueAfterText(jsonData, 'Endereço')
      let sacado_bairro = findValueAfterText(jsonData, 'Bairro')
      let sacado_cep = findValueAfterText(jsonData, 'Cep')

      // Extrair CIDADE e UF da mesma busca (formato: "CIDADE - UF")
      let sacado_cidade = findValueAfterText(jsonData, 'Cidade') || findValueAfterText(jsonData, 'Cidade:')
      let sacado_uf = ''

      if (sacado_cidade) {
        // Formato esperado: "SAO GONCALO DO AMARANTE - CE"
        const cidadeMatch = sacado_cidade.match(/^(.+?)\s*-\s*([A-Z]{2})$/)
        if (cidadeMatch) {
          sacado_cidade = cidadeMatch[1].trim()
          sacado_uf = cidadeMatch[2].trim()
          console.log(`[OS Generic] SACADO_CIDADE: ${sacado_cidade}, SACADO_UF: ${sacado_uf}`)
        }
      }

      // Limpar valores: remover caracteres não numéricos do CIC
      if (sacado_cic) {
        sacado_cic = sacado_cic.replace(/\D/g, '')
      }

      // Limpar CEP: remover caracteres não numéricos
      if (sacado_cep) {
        sacado_cep = sacado_cep.replace(/\D/g, '')
      }

      // **4. Extrair DESCRICAO (Placa / Equip.) - coletar TODA a linha após o campo**
      let descricao = ''
      // Procurar "Placa / Equip." e coletar TODAS as próximas colunas da linha
      for (let rowIdx = 0; rowIdx < jsonData.length; rowIdx++) {
        const rowObj = jsonData[rowIdx]
        if (!rowObj) continue

        const rowKeys = Object.keys(rowObj)
        for (let j = 0; j < rowKeys.length; j++) {
          const val = String(rowObj[rowKeys[j]] || '').toUpperCase()
          if (val.includes('PLACA')) {
            // Coletar TODAS as colunas à frente até o final da linha
            const descParts = []
            for (let k = j + 1; k < rowKeys.length; k++) {
              const part = String(rowObj[rowKeys[k]] || '').trim()
              if (part && part.length > 0 && !part.toUpperCase().includes(':')) {
                descParts.push(part)
              }
            }
            descricao = descParts.join(' ')
            if (descricao) {
              console.log(`[OS Generic] DESCRICAO (toda a linha após Placa/Equip.): ${descricao}`)
            }
            break
          }
        }
        if (descricao) break
      }

      // **5. Extrair VENCIMENTOS (Data) e VALORES - procurar marcador "BOLETO"**
      // Nova estratégia: Buscar "BOLETO" na planilha, depois coletar datas e valores nas colunas à direita
      // Cada linha com BOLETO = uma parcela (suporta múltiplas parcelas)
      const parcelasData = findBoletoParcelasByBoletoMarker(jsonData)

      // Extrair vencimentos e valores dos dados de parcelas
      let vencimentos = []
      let valores = []

      if (parcelasData && parcelasData.length > 0) {
        vencimentos = parcelasData.map(p => p.vencimento)
        valores = parcelasData.map(v => converterValor(v.valor))
        console.log(`[OS Generic] Extraído via BOLETO marker: ${parcelasData.length} parcela(s)`)
      } else {
        console.log(`[OS Generic] Nenhuma parcela encontrada pelo marcador BOLETO, tentando busca fallback`)
        // Fallback: se BOLETO não funcionar, voltar para busca por "Data" e "Valor"
        vencimentos = findValuesBelow(jsonData, 'Data', 'VENCIMENTO')
        valores = findValuesBelow(jsonData, 'Valor', 'VALOR')

        // Converter valores para números (formato brasileiro "2.199,54" → 2199.54)
        valores = valores.map(v => converterValor(v))
        console.log(`[OS Generic] Extraído via fallback Data/Valor: ${vencimentos.length} vencimento(s), ${valores.length} valor(es)`)
      }

      // Se não encontrou vencimentos, usar padrão de 30 dias
      if (vencimentos.length === 0) {
        const defaultDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')
        vencimentos.push(defaultDate)
        console.log(`[OS Generic] VENCIMENTO padrão (30 dias): ${defaultDate}`)
      }

      // Se encontrou vencimentos mas não valores, usar 0 como placeholder
      if (vencimentos.length > 0 && valores.length === 0) {
        valores = vencimentos.map(() => 0)
      }

      console.log(`[OS Generic] Total de vencimentos encontrados: ${vencimentos.length}`)
      console.log(`[OS Generic] Total de valores encontrados: ${valores.length}`)

      // Validações - Log detalhado para debugging
      console.log(`[OS TypeB] VALIDAÇÃO:`)
      console.log(`  NUM_TITULO: ${numero_documento || '(vazio)'}`)
      console.log(`  SACADO_NOME: ${sacado_nome || '(vazio)'}`)
      console.log(`  SACADO_CIC: ${sacado_cic || '(vazio)'}`)
      console.log(`  VENCIMENTOS encontrados: ${vencimentos.length}`)
      console.log(`  VALORES encontrados: ${valores.length}`)
      if (valores.length > 0) {
        console.log(`  VALOR (primeira parcela): ${valores[0]}`)
      }

      if (!numero_documento) {
        reject(new Error('Não conseguiu extrair número do documento (procurou "Código:" na planilha)'))
        return
      }

      if (!sacado_nome) {
        reject(new Error('Não conseguiu extrair nome do cliente (procurou "Cliente:" na planilha)'))
        return
      }

      // Se não encontrou vencimentos específicos, usar padrão (30 dias)
      if (vencimentos.length === 0) {
        const defaultDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')
        vencimentos.push(defaultDate)
        console.log(`[OS TypeB] Nenhum vencimento encontrado, usando padrão de 30 dias: ${defaultDate}`)
      }

      // Se não encontrou valores, usar 0 como placeholder
      if (valores.length === 0) {
        valores = vencimentos.map(() => 0)
        console.log(`[OS TypeB] Nenhum valor encontrado, usando 0 como placeholder`)
      }

      // **7. Construir boleto com parcelas pré-preenchidas**
      let boleto = {
        NUM_TITULO: numero_documento,
        SACADO_NOME: sacado_nome,
        SACADO_CIC: sacado_cic,
        SACADO_ENDERECO: sacado_endereco,
        SACADO_BAIRRO: sacado_bairro,
        SACADO_CIDADE: sacado_cidade,
        SACADO_UF: sacado_uf,
        SACADO_CEP: sacado_cep,
        EMISSAO: data_emissao_formatada,
        VENCIMENTO: vencimentos[0] || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
        VALOR: valores[0] || 0,
        DESCRICAO: descricao,
        NOSSO_NUMERO: numero_documento,
        STATUS: 'pendente',
        AVALISTA_NOME: profileName || '',
        AVALISTA_CIC: profileCIC || '',
      }

      // Se tem múltiplos vencimentos, criar parcelas
      if (vencimentos.length > 1) {
        // Se tem valores individuais, usar eles; senão, será calculado proporcionalmente
        const parcelas = vencimentos.map((vencimento, idx) => ({
          number: `${numero_documento}-${idx + 1}`,
          originalNumber: numero_documento,
          installmentIndex: idx + 1,
          value: valores[idx] || 0,
          dueDate: vencimento,
          emission: data_emissao_formatada,
        }))

        boleto._parcelas = parcelas
        boleto._totalParcelas = vencimentos.length
        console.log(`[OS TypeB] Boleto com ${vencimentos.length} parcelas criado`)
      }

      console.log(`[OS TypeB] Boleto construído:`, boleto)
      resolve([boleto])
    } catch (error) {
      console.error('[OS TypeB] Erro:', error)
      reject(new Error('Erro ao processar arquivo OS TypeB: ' + error.message))
    }
  }

  reader.onerror = () => {
    reject(new Error('Erro ao ler arquivo'))
  }

  reader.readAsArrayBuffer(file)
}

/**
 * Detectar se arquivo é do tipo OS (Ordem de Serviço)
 * Padrão: OS_*.xls (pode vir de qualquer cliente)
 * @param {string} fileName - nome do arquivo
 */
function isOSFile(fileName) {
  const lowerName = fileName.toLowerCase()
  return lowerName.includes('os_') && lowerName.endsWith('.xls')
}

/**
 * Detectar qual tipo de arquivo OS (Tipo A ou Tipo B)
 * Tipo A: Formato original com células fixas (D13, K16, AU54, etc)
 * Tipo B: Formato novo com busca de palavras-chave (Ordem de Serviço, Cliente, etc)
 * @param {File} file - arquivo OS
 * @returns {Promise<string>} - 'A' ou 'B'
 */
async function detectOSFileType(file) {
  return new Promise((resolve, reject) => {
    if (!window.XLSX) {
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/xlsx/dist/xlsx.full.min.js'
      document.head.appendChild(script)

      script.onload = () => {
        performOSTypeDetection(file, resolve, reject)
      }
      script.onerror = () => {
        reject(new Error('Erro ao carregar biblioteca Excel'))
      }
    } else {
      performOSTypeDetection(file, resolve, reject)
    }
  })
}

function performOSTypeDetection(file, resolve, reject) {
  const reader = new FileReader()

  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result)
      const workbook = window.XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = window.XLSX.utils.sheet_to_json(worksheet, { defval: '' })

      console.log(`[OS Detection] Analisando ${file.name}, ${jsonData.length} linhas encontradas`)

      let typeAMarkers = 0
      let typeBMarkers = 0

      // ===== MARCADORES TYPE B (muito específicos) =====

      // Marcador 1: "Ordem de Serviço" na linha 8 → VERY STRONG Type B indicator
      if (jsonData[7]) {
        const row8Text = Object.values(jsonData[7]).join(' ').toUpperCase()
        if (row8Text.includes('ORDEM') && row8Text.includes('SERVIÇO')) {
          console.log(`[OS Detection] ✓ "Ordem de Serviço" encontrado na L8`)
          typeBMarkers += 3 // Peso alto - é um marcador muito específico
        }
      }

      // Marcador 2: "Código:" na linha 13
      if (jsonData[12]) {
        const row13Text = Object.values(jsonData[12]).join(' ').toUpperCase()
        if (row13Text.includes('CÓDIGO')) {
          console.log(`[OS Detection] ✓ "Código:" encontrado na L13`)
          typeBMarkers += 2
        }
      }

      // Marcador 3: "Cliente:" na linha 16
      if (jsonData[15]) {
        const row16Text = Object.values(jsonData[15]).join(' ').toUpperCase()
        if (row16Text.includes('CLIENTE')) {
          console.log(`[OS Detection] ✓ "Cliente:" encontrado na L16`)
          typeBMarkers += 2
        }
      }

      // Marcador 4: "Placa / Equip:" na linha 14
      if (jsonData[13]) {
        const row14Text = Object.values(jsonData[13]).join(' ').toUpperCase()
        if (row14Text.includes('PLACA') || row14Text.includes('EQUIP')) {
          console.log(`[OS Detection] ✓ "Placa/Equip" encontrado na L14`)
          typeBMarkers += 2
        }
      }

      // Marcador 5: "Cnpj / Cpf :" na linha 17
      if (jsonData[16]) {
        const row17Text = Object.values(jsonData[16]).join(' ').toUpperCase()
        if (row17Text.includes('CNPJ') || row17Text.includes('CPF')) {
          console.log(`[OS Detection] ✓ "Cnpj/Cpf" encontrado na L17`)
          typeBMarkers += 2
        }
      }

      // Marcador 6: Múltiplas linhas com "BOLETO"
      let boletoCount = 0
      for (let i = 40; i < Math.min(jsonData.length, 100); i++) {
        const rowText = Object.values(jsonData[i]).join(' ').toUpperCase()
        if (rowText.includes('BOLETO')) {
          boletoCount++
        }
      }
      if (boletoCount > 0) {
        console.log(`[OS Detection] ✓ "${boletoCount}" ocorrência(s) de "BOLETO" encontrada(s)`)
        typeBMarkers += boletoCount // Peso proporcional ao número
      }

      // ===== MARCADORES TYPE A =====

      // Procurar por "Saldo A Receber" na coluna AJ (Type A marker)
      for (const cellRef in worksheet) {
        if (cellRef.startsWith('AJ') && worksheet[cellRef]?.v) {
          const val = String(worksheet[cellRef].v || '').toUpperCase()
          if (val.includes('SALDO')) {
            console.log(`[OS Detection] ✓ "Saldo A Receber" encontrado em ${cellRef}`)
            typeAMarkers += 3
          }
        }
      }

      // Procurar "Data" na coluna X (Type A marker)
      for (const cellRef in worksheet) {
        if (cellRef.match(/^X\d+$/) && worksheet[cellRef]?.v) {
          const val = String(worksheet[cellRef].v || '').toUpperCase()
          if (val === 'DATA') {
            console.log(`[OS Detection] ✓ "Data" encontrado na coluna X em ${cellRef}`)
            typeAMarkers += 2
          }
        }
      }

      console.log(`[OS Detection] Contagem: Type B=${typeBMarkers}, Type A=${typeAMarkers}`)

      // ===== DECIDIR TIPO =====
      // Type B é mais robusto e genérico, deve ser preferido quando há dúvida
      if (typeAMarkers > 10 && typeBMarkers === 0) {
        // Type A MUITO forte (múltiplos marcadores)
        console.log(`[OS Detection] ✓ Tipo A detectado fortemente (Score A: ${typeAMarkers})`)
        resolve('A')
      } else if (typeBMarkers >= 2) {
        // Type B marcadores encontrados - usar Type B (mais robusto)
        console.log(`[OS Detection] ✓ Tipo B detectado (Score: ${typeBMarkers})`)
        resolve('B')
      } else {
        // Padrão: Type B (mais robusto e genérico)
        console.log(`[OS Detection] Padrão Type B (parser genérico mais robusto)`)
        resolve('B')
      }
    } catch (error) {
      console.error('[OS Detection] Erro:', error)
      console.log(`[OS Detection] Fallback para Type A debido a erro`)
      // Se houver erro, tentar novamente com parseOSTypeB que é mais resiliente
      resolve('B')
    }
  }

  reader.onerror = () => {
    console.error('[OS Detection] Erro ao ler arquivo')
    reject(new Error('Erro ao ler arquivo'))
  }

  reader.readAsArrayBuffer(file)
}

/**
 * Process file based on extension
 * @param {File} file - arquivo a processar
 * @param {string} profileName - nome do perfil/conta para avalista (opcional)
 * @param {string} profileCIC - CNPJ do perfil/conta para avalista (opcional)
 */
export async function processFile(file, profileName = '', profileCIC = '') {
  const extension = file.name.split('.').pop().toLowerCase()

  try {
    let data = []

    console.log(`[Import] Processando arquivo: ${file.name} (${extension})`)

    // Detectar arquivo OS (Ordem de Serviço) antes de processar por extensão
    if (isOSFile(file.name)) {
      console.log(`[Import] Arquivo detectado como OS (Ordem de Serviço)`)

      // Detectar tipo de OS (A ou B)
      try {
        const osType = await detectOSFileType(file)

        if (osType === 'B') {
          console.log(`[Import] Usando parser Type B (Keyword-based)`)
          data = await parseOSTypeB(file, profileName, profileCIC)
        } else {
          console.log(`[Import] Usando parser Type A (Hardcoded cells)`)
          data = await parseOSFile(file, profileName, profileCIC)
        }
      } catch (detectionError) {
        console.warn(`[Import] Erro na detecção de tipo OS, usando Type A como fallback:`, detectionError)
        data = await parseOSFile(file, profileName, profileCIC)
      }
    } else {
      switch (extension) {
        case 'csv':
          data = await parseCSVFile(file, profileName, profileCIC)
          break
        case 'txt':
          data = await parseTXTFile(file, profileName, profileCIC)
          break
        case 'xlsx':
        case 'xls':
          data = await parseExcelFile(file, profileName, profileCIC)
          break
        case 'xml':
          data = await parseXMLFile(file)
          break
        default:
          throw new Error(`Formato de arquivo não suportado: .${extension}`)
      }
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
 * @param {File[]} files - arquivos a processar
 * @param {string} profileName - nome do perfil/conta para avalista (opcional)
 * @param {string} profileCIC - CNPJ do perfil/conta para avalista (opcional)
 */
export async function processFilesForPreview(files, profileName = '', profileCIC = '') {
  console.log(`[Import] Processando ${files.length} arquivo(s) para preview`)

  const allData = []
  const errors = []

  for (const file of files) {
    const { success, data, error, fileName } = await processFile(file, profileName, profileCIC)

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
 * @param {File[]} files - arquivos a importar
 * @param {string} userId - ID do usuário/conta
 * @param {string} profileName - nome do perfil/conta para avalista (opcional)
 * @param {string} profileCIC - CNPJ do perfil/conta para avalista (opcional)
 */
export async function importBoletos(files, userId, profileName = '', profileCIC = '') {
  console.log(`[Import] Iniciando importação de ${files.length} arquivo(s) para usuário ${userId}`)

  const results = []
  let totalImported = 0
  let totalUpdated = 0
  let totalUnchanged = 0
  let totalErrors = 0

  for (const file of files) {
    const { success, data, error, fileName } = await processFile(file, profileName, profileCIC)

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
export async function processContaCaptFileForBoletos(file, userType, selectedContaId, profileName = '', profileCIC = '') {
  return new Promise((resolve, reject) => {
    if (!window.XLSX) {
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/xlsx/dist/xlsx.full.min.js'
      document.head.appendChild(script)

      script.onload = () => {
        processContaCaptExcel(file, userType, selectedContaId, profileName, profileCIC, resolve, reject)
      }
      script.onerror = () => {
        reject(new Error('Erro ao carregar biblioteca Excel'))
      }
    } else {
      processContaCaptExcel(file, userType, selectedContaId, profileName, profileCIC, resolve, reject)
    }
  })
}

function processContaCaptExcel(file, userType, selectedContaId, profileName = '', profileCIC = '', resolve, reject) {
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
          VALOR: converterValor(row['Valor do título']),
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
          // Avalista: usar dados da conta selecionada (profileName, profileCIC)
          AVALISTA_NOME: profileName || String(row['Beneficiário final (sacador avalista)'] || '').trim(),
          AVALISTA_CIC: profileCIC || String(row['Documento federal do avalista'] || row['CPF/CNPJ do avalista'] || row['CIC do avalista'] || '').replace(/\D/g, ''),
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
