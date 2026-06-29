import { jsPDF } from 'jspdf'
import JsBarcode from 'jsbarcode'

// URL publica da logomarca ContaCapt DIGITAL (Supabase Storage)
const CONTACAPT_LOGO_URL =
  'https://nkqiurrgrylrwvreybzh.supabase.co/storage/v1/object/sign/logo/logoboleto.png' +
  '?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jMjMwODVjNS1hYzIzLTQxMzAtYjc3YS1hMWU1ZDU1OTc0YzMiLCJhbGciOiJIUzI1NiJ9' +
  '.eyJ1cmwiOiJsb2dvL2xvZ29ib2xldG8ucG5nIiwiaWF0IjoxNzc4NDU0MDMxLCJleHAiOjMzMzE0NDU0MDMxfQ' +
  '.jhzGKWef0IbfL2mfdMBPwJtILNBE_1bDbeuNiFlXOu8'

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
          // YYYY-MM-DD format - parse as local date to avoid timezone offset
          const [year, month, day] = date.split('-')
          return `${day}/${month}/${year}`
    }

    const d = new Date(date)
    if (isNaN(d.getTime())) {
          if (typeof date === 'string') {
                  const parts = date.split(/[-/]/)
                  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
          }
          return ''
    }
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}/${month}/${year}`
}

// ============================================================
// CNAB400 - Funcoes auxiliares (padrao BMP 274)
// ============================================================

// Remove acentos, converte para maiusculas, mantem alfanumerico e espacos
const cleanStr = (str) => {
    if (!str) return ''
    return String(str)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, ' ')
}

// Remove tudo exceto digitos
const cleanNum = (str) => {
    if (!str) return ''
    return String(str).replace(/[^0-9]/g, '')
}

// Converte data (YYYY-MM-DD ou DD/MM/YYYY ou ISO) para DDMMAA
const fmtDate = (dateStr) => {
    if (!dateStr) return '000000'
    let d = String(dateStr)
    // ISO format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(d)) {
          const parts = d.substring(0, 10).split('-')
          return parts[2] + parts[1] + parts[0].substring(2)
    }
    // DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
          const parts = d.split('/')
          return parts[0] + parts[1] + parts[2].substring(2)
    }
    // DD/MM/YY
    if (/^\d{2}\/\d{2}\/\d{2}$/.test(d)) {
          const parts = d.split('/')
          return parts[0] + parts[1] + parts[2]
    }
    return '000000'
}

// Converte valor decimal para centavos com 13 digitos (zeros a esquerda)
const fmtValor = (v) => {
    if (!v && v !== 0) return '0000000000000'
    const num = typeof v === 'string'
      ? parseFloat(v.replace(/\./g, '').replace(',', '.'))
          : Number(v)
    if (isNaN(num)) return '0000000000000'
    const centavos = Math.round(num * 100)
    return String(centavos).padStart(13, '0')
}

// Preenche a esquerda com char (default '0')
const padLeft = (text, size, char = '0') => {
    const s = String(text === null || text === undefined ? '' : text)
    if (s.length >= size) return s.substring(s.length - size)
    return s.padStart(size, char)
}

// Preenche a direita com espacos (trunca se maior)
const padRight = (text, size, char = ' ') => {
    const s = String(text === null || text === undefined ? '' : text)
    if (s.length >= size) return s.substring(0, size)
    return s.padEnd(size, char)
}

// Calcula digito verificador do Nosso Numero - algoritmo BMP274 (CNAB400)
// Algoritmo oficial BMP (Banco Nossa Caixa):
// 1. Prefixar com "0900" + nosso_numero (ex: 313500015 → 0900313500015)
// 2. Usar TODOS os 13 dígitos com pesos [2,7,6,5,4,3,2,7,6,5,4,3,2]
// 3. Multiplicar, somar, dividir por 11
// 4. Se resto=0: DV="0", Se resto=1: DV="P", Senão: DV=11-resto
export const calcNNDV = (nossoNumero) => {
    const num = String(nossoNumero || '').replace(/\D/g, '')

    // Prefixar com "0900" para o cálculo
    const prefixado = '0900' + num.padStart(9, '0')  // Garante 13 dígitos total

    // Usar TODOS os 13 dígitos (não usar slice!)
    const base13 = prefixado

    // Pesos oficiais BMP274 - 13 pesos para 13 dígitos
    const pesos = [2, 7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2]

    // Multiplicar e somar
    let soma = 0
    for (let i = 0; i < 13; i++) {
        soma += parseInt(base13.charAt(i), 10) * pesos[i]
    }

    // Dividir por 11 e calcular resto
    const quociente = Math.floor(soma / 11)
    const resto = soma - (quociente * 11)

    // Calcular DV conforme regra BMP274
    if (resto === 0) {
        return '0'
    } else if (resto === 1) {
        return 'P'  // Letra P quando resto = 1
    } else {
        return String(11 - resto)
    }
}

// Determina tipo pessoa pelo CIC: '01' CPF (11 dig), '02' CNPJ (14 dig)
const getTipoPessoa = (cic) => {
    const num = cleanNum(cic)
    if (num.length <= 11) return '01'
    return '02'
}

// ============================================================
// CNAB400 - Registro HEADER (Tipo 0) - 400 caracteres
// ============================================================
const buildHeader = (conta, nextSeq, tipoOperacao = '01') => {
    // Dados do beneficiario/cedente vindos de CONTAS
    const nomeEmpresa  = padRight(cleanStr(conta.nome_correntista || 'EMPRESA'), 30)
    const cpfCnpjConta = cleanNum(conta.cpf_cnpj || conta.cic || '0')
    // Codigo cedente: usa campo 'cedente' se disponivel; fallback para convenio ou cpf_cnpj
    const cedenteCod   = cleanNum(conta.cedente || conta.convenio || cpfCnpjConta || '0')
    const cedenteFmt   = padLeft('1' + cedenteCod, 18, '0')
    const now          = new Date()
    const headerDate   = String(now.getDate()).padStart(2, '0') +
          String(now.getMonth() + 1).padStart(2, '0') +
          String(now.getFullYear()).substring(2)

    let line = ''
    line += '0'                                    // pos 001 - tipo registro
    line += '1'                                    // pos 002 - codigo remessa
    line += 'REMESSA'                              // pos 003-009 - literal
    line += '01'                                   // pos 010-011 - codigo servico
    line += padRight('COBRANCA', 15)               // pos 012-026 - tipo servico
    line += cedenteFmt                             // pos 027-044 - codigo cedente (18)
    line += '09'                                   // pos 045-046 - codigo banco
    line += padRight(nomeEmpresa, 30)              // pos 047-076 - nome cedente (CONTAS.nome_correntista)
    line += '274'                                  // pos 077-079 - codigo banco BMP
    line += padRight('BMP MONEY PLUS', 15)         // pos 080-094 - nome banco
    line += headerDate                             // pos 095-100 - data geracao DDMMAA
    line += '        '                             // pos 101-108 - brancos (8 espacos)
    line += 'MX'                                   // pos 109-110 - identificador sistema
    line += padLeft(nextSeq, 7)                    // pos 111-117 - sequencial remessa

    // Brancos ate pos 394, depois sequencial de linha (header e sempre linha 1)
    while (line.length < 394) line += ' '
    line += '000001'                               // pos 395-400 - nr sequencial registro

    return line.substring(0, 400)
}

// ============================================================
// CNAB400 - Registro DETALHE Linha 1 (Tipo 1) - 400 caracteres
// Conforme documentacao BMP 274 / FEBRABAN CNAB400
// ============================================================
const buildDetalhe1 = (boleto, conta, lineSeq, tipoOperacao = '01') => {
    // --- Sacado ---
    const sacadoCic  = cleanNum(boleto.sacado_cic || '')
    const tipoPessoa = getTipoPessoa(sacadoCic)           // '01' CPF / '02' CNPJ
    const sNome      = cleanStr(boleto.sacado_nome || '')
    const sEnd       = cleanStr(boleto.sacado_endereco || '')
    const sCep       = cleanNum(boleto.sacado_cep || '')

    // --- Avalista ---
    const avalistaCic  = cleanNum(boleto.avalista_cic || '')
    const avalistaNome = cleanStr(boleto.avalista_nome || '')
    // '1' CPF / '2' CNPJ / ' ' sem avalista
    const avalistaTipo = avalistaCic
        ? (avalistaCic.length <= 11 ? '1' : '2')
        : ' '

    // --- Nosso Numero: campo armazenado = base (11-12 caracteres) ---
    // IMPORTANTE: SEMPRE recalcular o DV com algoritmo BMP274
    // Não confiar no DV armazenado no banco (pode estar incorreto)
    // CNAB: pos 071-081 = base padded a 11 zeros; pos 082 = DV recalculado
    const nossoCompleto = cleanNum(boleto.nosso_numero || '')

    // Extrair apenas a base (11 dígitos), desprezando DV se armazenado
    let nossoBase = ''
    if (nossoCompleto.length >= 11) {
        nossoBase = nossoCompleto.substring(0, 11)  // Pega os 11 primeiros dígitos
    } else if (nossoCompleto.length > 0) {
        nossoBase = nossoCompleto  // Se tiver menos de 11, usa como está
    } else {
        nossoBase = '0'
    }

    const nossoBaseFull = padLeft(nossoBase, 11, '0')      // garante exatamente 11 dígitos para CNAB
    const dvNN          = calcNNDV(nossoBase)              // DV: passa apenas a base (9 dígitos), não a versão padronizada!
    const nossoFmt      = nossoBaseFull                    // 11 digitos para posição CNAB 071-081

    // --- Numero do titulo (Seu Numero) ---
    const tituloNum = cleanNum(boleto.numero_documento || boleto.nosso_numero || '')

    // --- Dados do cedente (CONTAS) ---
    // pos 030-037: CONTAS.conta (8 chars, zeros a esquerda) — conta corrente + DV
    const contaField     = padLeft(cleanNum(conta?.conta || '0'), 8, '0')
    // CPF/CNPJ do cedente — pode ser usado em instrucoes ou identificacao interna
    const cpfCnpjCedente = cleanNum(conta?.cpf_cnpj || conta?.cic || '0')

    // --- Datas ---
    const dtVenc = fmtDate(boleto.data_vencimento)
    const dtEmis = fmtDate(boleto.data_emissao)

    // --- Valor e juros (0,2% ao dia) ---
    const valorNum = typeof boleto.valor === 'string'
        ? parseFloat(boleto.valor.replace(/\./g, '').replace(',', '.'))
        : Number(boleto.valor || 0)
    const jurosNum = valorNum * 0.002

    let line = ''
    line += '1'                                    // pos 001        - tipo registro
    line += '00000'                                // pos 002-006    - agencia (zeros)
    line += ' '                                    // pos 007        - digito agencia (espaco)
    line += '000000000000'                         // pos 008-019    - razao da conta (12 zeros)
    line += ' '                                    // pos 020        - espaco
    line += '000900001'                            // pos 021-029    - carteira + variacao
    line += contaField                             // pos 030-037    - CONTAS.conta (8 dig)
    line += padLeft(tituloNum, 15)                 // pos 038-052    - numero do titulo (15)
    line += '          '                           // pos 053-062    - brancos (10)
    line += '00000000'                             // pos 063-070    - zeros (8)
    line += nossoFmt                               // pos 071-081    - nosso numero (11)
    line += dvNN                                   // pos 082        - digito verificador
    line += '0000000000'                           // pos 083-092    - zeros (10)
    line += '2'                                    // pos 093        - tipo impressao (banco emite)
    line += 'N'                                    // pos 094        - identificacao emissao
    line += '           '                          // pos 095-105    - brancos (11)
    line += '0'                                    // pos 106        - operacao banco
    line += '  '                                   // pos 107-108    - brancos (2)
    line += ['01', '02', '06'].includes(tipoOperacao) ? tipoOperacao : '01' // pos 109-110 - codigo ocorrencia (01=entrada/registro, 02=baixa, 06=alteracao)
    line += padRight(tituloNum.slice(0, 10), 10)   // pos 111-120    - seu numero (10)
    line += dtVenc                                 // pos 121-126    - vencimento DDMMAA
    line += fmtValor(valorNum)                     // pos 127-139    - valor (13 centavos)
    line += '0'                                    // pos 140        - carteira
    line += '000000002N'                           // pos 141-150    - id operacao (10)
    line += dtEmis                                 // pos 151-156    - emissao DDMMAA
    line += '0000'                                 // pos 157-160    - primeira instrucao
    line += fmtValor(jurosNum)                     // pos 161-173    - juros mora 0,2%/dia (13)
    line += '0'.repeat(45)                         // pos 174-218    - zeros (45)
    line += tipoPessoa                             // pos 219-220    - tipo sacado (2)
    line += padLeft(sacadoCic, 14)                 // pos 221-234    - CPF/CNPJ sacado (14)
    line += padRight(sNome, 40)                    // pos 235-274    - nome sacado (40)
    line += padRight(sEnd, 40)                     // pos 275-314    - endereco sacado (40)
    line += '            '                         // pos 315-326    - brancos (12)
    line += padLeft(sCep, 8)                       // pos 327-334    - CEP (8)
    line += avalistaTipo                           // pos 335        - tipo avalista (1)
    line += padRight(avalistaCic, 15)              // pos 336-350    - CPF/CNPJ avalista (15)
    line += padRight(avalistaNome, 44)             // pos 351-394    - nome avalista (44)
    line += padLeft(lineSeq, 6)                    // pos 395-400    - nr sequencial linha (6)

    return line.substring(0, 400)
}

// ============================================================
// CNAB400 - Registro DETALHE Linha 2 (1 por titulo, apos linha 1)
// ============================================================
const buildDetalhe2 = (boleto, lineSeq) => {
    const msgProtesto = padRight(
        'BOLETO SUJEITO A PROTESTO E NEGATIVACAO APOS O VENCIMENTO DUVIDAS 85 3264 1850',
        80
    )
    const msgImportado = padRight(cleanStr(boleto.mensagem1 || boleto.descricao || ''), 80)
    const msgGarantia = padRight(
        'O TITULO PODERA SER USADO COMO GARANTIA OU CAUCAO EM OPERACOES DE CREDITO',
        80
    )

    const sBairro = padLeft(cleanStr(boleto.sacado_bairro || ''), 20, ' ')  // alinhado a direita (padrao BMP)
    const sUf     = padRight(cleanStr(boleto.sacado_uf || ''), 2)
    const sCidade = padRight(cleanStr(boleto.sacado_cidade || ''), 30)

    let line = ''
    line += '2'                                    // pos 001 - tipo registro
    line += msgProtesto                            // pos 002-081 - mensagem protesto 80
    line += msgImportado                           // pos 082-161 - mensagem1 80
    line += '                                                                                ' // pos 162-241 - brancos 80
    line += msgGarantia                            // pos 242-321 - mensagem garantia 80
    line += '      '                               // pos 322-327 - brancos 6
    line += sBairro                                // pos 328-347 - bairro 20
    line += sUf                                    // pos 348-349 - UF 2
    line += sCidade                                // pos 350-379 - cidade 30
    line += '               '                      // pos 380-394 - brancos 15
    line += padLeft(lineSeq, 6)                    // pos 395-400 - sequencial linha 6

    while (line.length < 400) line += ' '
    return line.substring(0, 400)
}

// ============================================================
// CNAB400 - Registro TRAILER (Tipo 9)
// ============================================================
const buildTrailer = (totalLines) => {
    let line = '9'
    while (line.length < 394) line += ' '
    line += padLeft(totalLines, 6)
    return line.substring(0, 400)
}

// ============================================================
// Funcao principal: gera o arquivo CNAB400 a partir de boletos
// da tabela capt_boletos. Aceita um objeto "conta" com campos
// da tabela CONTAS (nome_correntista, conta_corrente, convenio,
// cpf_cnpj, cedente, cnab400) e o nextSeq (numero da remessa).
// Se conta nao for fornecido, usa valores padrao.
// ============================================================
export const generateCNAB400RemittanceFile = (boletos, conta, nextSeq, tipoOperacao = '01') => {
    console.log('[CNAB400] Gerando remessa para', boletos ? boletos.length : 0, 'boletos, tipo:', tipoOperacao)

    if (!boletos || boletos.length === 0) {
          throw new Error('Nenhum boleto fornecido para gerar remessa CNAB400')
    }

    // Conta padrao se nao fornecida
    const contaInfo = conta || {
          nome_correntista: 'EMPRESA',
          conta_corrente: '00000000',
          convenio: '000000',
          cpf_cnpj: '00000000000000',
          cedente: '0',
          cnab400: 0,
    }

    const seq = nextSeq || (contaInfo.cnab400 ? Number(contaInfo.cnab400) + 1 : 1)

    let lines = []
        let lineSeq = 1

    // Header
    lines.push(buildHeader(contaInfo, seq, tipoOperacao))
    lineSeq++

    // Detalhe (2 linhas por boleto)
    for (const boleto of boletos) {
          lines.push(buildDetalhe1(boleto, contaInfo, lineSeq, tipoOperacao))
          lineSeq++
          lines.push(buildDetalhe2(boleto, lineSeq))
          lineSeq++
    }

    // Trailer
    const totalLines = lineSeq // header + detalhes ja contados + trailer = lineSeq
    lines.push(buildTrailer(totalLines))

    // Substitui pontos por espacos no conteudo final (padrao BMP)
    let content = lines.join('\r\n').replace(/\./g, ' ')

    console.log('[CNAB400] Remessa gerada:', lines.length, 'linhas, seq:', seq)

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    return blob
}

// ============================================================
// PDF - Helpers para geracao de codigo de barras
// ============================================================

const getValorForBarcode = (value) => {
    let num = 0
    if (typeof value === 'number') num = value
    else if (typeof value === 'string') {
        const normalized = value.replace(/\./g, '').replace(',', '.')
        num = parseFloat(normalized)
    }
    if (isNaN(num)) return '0000000000'
    return num.toFixed(2).replace('.', '').padStart(10, '0')
}

const calcularFatorVencimento = (vencimentoStr) => {
    if (!vencimentoStr) return '0000'
    const vencimento = new Date(vencimentoStr)
    if (isNaN(vencimento.getTime())) return '0000'
    const dataBase = new Date('1997-10-07T00:00:00Z')
    const v = new Date(Date.UTC(vencimento.getUTCFullYear(), vencimento.getUTCMonth(), vencimento.getUTCDate()))
    const b = new Date(Date.UTC(dataBase.getUTCFullYear(), dataBase.getUTCMonth(), dataBase.getUTCDate()))
    let dias = Math.floor((v.getTime() - b.getTime()) / (1000 * 60 * 60 * 24))
    if (dias >= 10000) dias = ((dias - 10000) % 9000) + 1000
    if (dias < 0) return '0000'
    return String(dias).padStart(4, '0')
}

const modulo10 = (numero) => {
    let soma = 0, peso = 2
    for (let i = numero.length - 1; i >= 0; i--) {
        let termo = parseInt(numero.charAt(i)) * peso
        if (termo > 9) termo = Math.floor(termo / 10) + (termo % 10)
        soma += termo
        peso = peso === 2 ? 1 : 2
    }
    const resto = soma % 10
    return resto === 0 ? '0' : String(10 - resto)
}

const modulo11Barcode = (numero) => {
    const pesos = [2, 3, 4, 5, 6, 7, 8, 9]
    let soma = 0, pesoIndex = 0
    for (let i = numero.length - 1; i >= 0; i--) {
        soma += parseInt(numero.charAt(i)) * pesos[pesoIndex]
        pesoIndex = (pesoIndex + 1) % pesos.length
    }
    const resto = soma % 11
    const dv = 11 - resto
    if (dv === 0 || dv === 10 || dv === 11) return '1'
    return String(dv)
}

// Gera string de 44 digitos do codigo de barras BMP (banco 274)
// usando campos diretos de capt_boletos + CONTAS
export const generateBarcodeFromBoleto = (boleto, contaData) => {
    const banco = '274'
    const moeda = '9'
    const fator = calcularFatorVencimento(boleto.data_vencimento)
    const valorStr = getValorForBarcode(boleto.valor)
    const agencia = '0001'

    // nosso_numero: armazenado SEM DV (ex: "313500015" - 9 dígitos)
    // Para o código de barras, usa exatamente 11 dígitos padronizados
    let nossoNumeroRaw = String(boleto.nosso_numero || '').replace(/[^0-9]/g, '')
    // Se tiver mais de 11, pega os últimos 11; se tiver menos, preenche com zeros
    const nossoNumeroParaBarcode = nossoNumeroRaw.slice(-11).padStart(11, '0')

    // conta_corrente: ex "09535097" (8 dig com DV) → usa primeiros 7 + "0"
    // Para barcode/linha digitável, substitui último dígito (DV) por "0"
    // Se CONTAS.conta="09535097", usa "09535090"
    let contaRaw = String(contaData?.conta || contaData?.conta_corrente || '00000000').replace(/[^0-9]/g, '')
    // Garante exatamente 7 primeiros dígitos + "0" = 8 dígitos
    const conta = contaRaw.slice(0, 7).padStart(7, '0') + '0'

    // Campo Livre (25 dígitos): agencia(4) + "09"(2) + nossoNumero(11) + conta(8) = 25 dígitos
    // Barcode total: banco(3) + moeda(1) + DV(1) + fator(4) + valor(10) + campoLivre(25) = 44 dígitos
    const freeField = `${agencia}09${nossoNumeroParaBarcode}${conta}`
    const block = `${banco}${moeda}${fator}${valorStr}${freeField}`
    const dv = modulo11Barcode(block)
    const barcode = `${banco}${moeda}${dv}${fator}${valorStr}${freeField}`

    // Validação: garantir que o barcode tem exatamente 44 dígitos
    if (barcode.length !== 44) {
        console.warn(`[generateBarcodeFromBoleto] ⚠️ Barcode tem ${barcode.length} dígitos, esperado 44. Barcode: ${barcode}`)
    }

    return barcode
}

// Gera linha digitavel formatada (47 digitos)
const formatLinhaDigitavel = (barcode) => {
    const field1Raw = barcode.substring(0, 4) + barcode.substring(19, 24)
    const dv1 = modulo10(field1Raw)
    const field1 = `${field1Raw.substring(0, 5)}.${field1Raw.substring(5)}${dv1}`

    const field2Raw = barcode.substring(24, 34)
    const dv2 = modulo10(field2Raw)
    const field2 = `${field2Raw.substring(0, 5)}.${field2Raw.substring(5)}${dv2}`

    const field3Raw = barcode.substring(34, 44)
    const dv3 = modulo10(field3Raw)
    const field3 = `${field3Raw.substring(0, 5)}.${field3Raw.substring(5)}${dv3}`

    const field4 = barcode.charAt(4)
    const field5 = barcode.substring(5, 19) // fator(4) + valor(10) = 14 digitos

    return `${field1} ${field2} ${field3} ${field4} ${field5}`
}

// Comprime imagem para reduzir tamanho do PDF
const compressImageForPDF = (imageData, maxWidth = 400, quality = 0.7) => {
    return new Promise((resolve) => {
        try {
            if (!imageData || imageData.length < 10000) { resolve(imageData); return }
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            const img = new Image()
            img.onload = () => {
                const aspectRatio = img.height / img.width
                canvas.width = Math.min(img.width, maxWidth)
                canvas.height = canvas.width * aspectRatio
                if (ctx) {
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
                    resolve(canvas.toDataURL('image/jpeg', quality))
                } else resolve(imageData)
            }
            img.onerror = () => resolve(imageData)
            img.src = imageData
        } catch { resolve(imageData) }
    })
}

// Monta string de endereco do sacado a partir de campos de capt_boletos
const montarEnderecoSacado = (boleto) => {
    const partes = []
    if (boleto.sacado_endereco) partes.push(boleto.sacado_endereco)
    if (boleto.sacado_bairro) partes.push(boleto.sacado_bairro)
    const cidUf = [boleto.sacado_cidade, boleto.sacado_uf].filter(Boolean).join(' / ')
    if (cidUf) partes.push(cidUf)
    return partes.join(', ')
}

// ============================================================
// PDF - Renderiza parte superior: fatura / demonstrativo
// ============================================================
// Extrai e normaliza dados do beneficiário (CONTAS) para uso no PDF
const extrairDadosBeneficiario = (contaData) => {
    const c = contaData || {}
    const nome      = c.nome_correntista || ''
    const cpfCnpj   = c.cpf_cnpj || c.cic || ''
    const email     = c.email || ''
    const telefone  = c.telefone || c.fone || c.tel || ''
    const logoUrl   = c.logo || null
    const conta     = c.conta_corrente || ''
    const convenio  = c.convenio || ''

    // Endereço — tenta múltiplos nomes de campo que diferentes setups podem usar
    const logradouro  = c.logradouro || c.endereco || c.rua || ''
    const numero      = c.numero || ''
    const complemento = c.complemento || ''
    const bairro      = c.bairro || ''
    const cidade      = c.cidade || c.municipio || ''
    const uf          = c.uf || c.estado || ''
    const cep         = c.cep || ''

    // Monta linha de endereço
    let endParts = []
    if (logradouro) {
        endParts.push(numero ? `${logradouro}, ${numero}` : logradouro)
    }
    if (complemento) endParts.push(complemento)
    if (bairro)      endParts.push(bairro)
    const cidadeUf = [cidade, uf].filter(Boolean).join(' - ')
    if (cidadeUf)    endParts.push(cidadeUf)
    if (cep)         endParts.push(`CEP: ${cep}`)
    const enderecoCompleto = endParts.join(', ')

    return { nome, cpfCnpj, email, telefone, logoUrl, conta, convenio,
             logradouro, numero, complemento, bairro, cidade, uf, cep, enderecoCompleto }
}

export const renderFatura = async (doc, boleto, contaData, boletoStartY) => {
    const M = 10, CW = 190

    const benef = extrairDadosBeneficiario(contaData)

    const sacadoNome    = boleto.sacado_nome     || ''
    const sacadoCic     = boleto.sacado_cic      || ''
    const sacadoEnd     = boleto.sacado_endereco || ''
    const sacadoBairro  = boleto.sacado_bairro   || ''
    const sacadoCep     = boleto.sacado_cep      || ''
    const sacadoCidade  = boleto.sacado_cidade   || ''
    const sacadoUf      = boleto.sacado_uf       || ''
    const emissao       = boleto.data_emissao
    const vencimento    = boleto.data_vencimento
    const valor         = boleto.valor
    const numDoc        = boleto.numero_documento || ''
    const descricao     = boleto.descricao || ''

    // Logo encostado no topo; textos da empresa com recuo normal
    const logoY  = 1    // borda superior do logo rente ao topo da pagina
    let y        = 10   // base para textos e calculo de altura (mesma distancia anterior)

    // --- Layout: zona esquerda (logo + empresa) | zona direita (FATURA + data) ---
    const LOGO_W = 36, LOGO_H = 36
    const DADOS_X = M + LOGO_W + 3   // empresa logo apos o logo

    if (benef.logoUrl) {
        const compressed = await compressImageForPDF(benef.logoUrl, 300, 0.7)
        doc.addImage(compressed, 'JPEG', M, logoY, LOGO_W, LOGO_H)
    } else {
        doc.setDrawColor(180); doc.setLineWidth(0.3)
        doc.rect(M, logoY, LOGO_W, LOGO_H)
        doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 80, 80)
        doc.text('ContaCapt', M + LOGO_W / 2, logoY + LOGO_H / 2 - 2, { align: 'center' })
        doc.text('DIGITAL',   M + LOGO_W / 2, logoY + LOGO_H / 2 + 2, { align: 'center' })
        doc.setTextColor(0, 0, 0)
    }

    // Dados da empresa (beneficiario) — coluna esquerda, endereco em 2 linhas sem quebra
    let dadosY = y + 4
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
    doc.text(benef.nome, DADOS_X, dadosY); dadosY += 4.5
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5)
    if (benef.cpfCnpj) { doc.text(`CNPJ/CPF: ${benef.cpfCnpj}`, DADOS_X, dadosY); dadosY += 3.8 }

    // Linha 1 do endereco: logradouro + numero (sem quebra)
    const endL1Parts = []
    if (benef.logradouro) endL1Parts.push(benef.numero ? `${benef.logradouro}, ${benef.numero}` : benef.logradouro)
    if (benef.complemento) endL1Parts.push(benef.complemento)
    const endL1 = endL1Parts.join(' - ')
    if (endL1) { doc.text(endL1, DADOS_X, dadosY); dadosY += 3.8 }

    // Linha 2 do endereco: bairro, cidade - UF, CEP (sem quebra)
    const endL2Parts = []
    if (benef.bairro) endL2Parts.push(benef.bairro)
    const cidUfBenef = [benef.cidade, benef.uf].filter(Boolean).join(' - ')
    if (cidUfBenef) endL2Parts.push(cidUfBenef)
    if (benef.cep) endL2Parts.push(`CEP: ${benef.cep}`)
    const endL2 = endL2Parts.join(', ')
    if (endL2) { doc.text(endL2, DADOS_X, dadosY); dadosY += 3.8 }

    if (benef.telefone) { doc.text(`Tel: ${benef.telefone}`, DADOS_X, dadosY); dadosY += 3.8 }
    if (benef.email)    { doc.text(benef.email, DADOS_X, dadosY); dadosY += 3.8 }

    // FATURA + data de emissao — coluna direita, alinhada com base dos textos
    doc.setFontSize(14); doc.setFont('helvetica', 'bold')
    doc.text('FATURA', M + CW, y + 6, { align: 'right' })
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal')
    doc.text(`Data de Emissão: ${formatDate(emissao)}`, M + CW, y + 12, { align: 'right' })

    // Linha divisoria abaixo do maior entre: logo (logoY+LOGO_H) ou bloco de texto (dadosY)
    y = Math.max(logoY + LOGO_H, dadosY) + 5

    // Linha divisoria
    doc.setDrawColor(0); doc.setLineWidth(0.2)
    doc.line(M, y, M + CW, y); y += 3

    // --- DADOS DO CLIENTE (sacado / pagador) ---
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(0, 0, 0)
    doc.text('DADOS DO CLIENTE', M, y); y += 4.5
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8)

    if (sacadoNome) { doc.text(sacadoNome.toUpperCase(), M, y); y += 4 }
    if (sacadoCic)  { doc.text(`CPF/CNPJ: ${sacadoCic}`, M, y); y += 4 }

    // Endereco do sacado: logradouro + bairro numa linha; cidade + uf + cep na seguinte
    if (sacadoEnd) {
        const endBairro = sacadoBairro ? `${sacadoEnd}, ${sacadoBairro}` : sacadoEnd
        doc.text(endBairro.toUpperCase(), M, y); y += 4
    }
    const cidadeUfCep = [
        sacadoCidade && sacadoUf ? `${sacadoCidade} - ${sacadoUf}` : (sacadoCidade || sacadoUf),
        sacadoCep ? `CEP: ${sacadoCep}` : ''
    ].filter(Boolean).join('   ')
    if (cidadeUfCep) { doc.text(cidadeUfCep.toUpperCase(), M, y); y += 4 }

    doc.setLineWidth(0.2); doc.line(M, y, M + CW, y); y += 5

    // Descricao dos servicos
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
    doc.text('DESCRIÇÃO DOS SERVIÇOS / PRODUTOS', M, y); y += 5

    // Cabecalho tabela (cinza)
    doc.setFillColor(209, 209, 209)
    doc.rect(M, y, CW, 6, 'F')
    doc.setFontSize(7); doc.setTextColor(0, 0, 0)
    doc.text('ITEM / DESCRIÇÃO', M + 2, y + 4)
    doc.text('VALOR', M + CW - 2, y + 4, { align: 'right' }); y += 6

    // Linha do titulo
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
    const descItem = `Título: ${numDoc} - Vencimento: ${formatDate(vencimento)}`
    doc.text(descItem, M + 2, y + 4)
    doc.text(formatMoeda(valor), M + CW - 2, y + 4, { align: 'right' })
    doc.setLineWidth(0.2); doc.line(M, y + 6, M + CW, y + 6); y += 10

    // Total a pagar
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
    doc.text('TOTAL A PAGAR', M + CW - 45, y)
    doc.text(formatMoeda(valor), M + CW - 2, y, { align: 'right' }); y += 6

    // Descricao/mensagem do boleto (campo descricao de capt_boletos)
    if (descricao) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
        const descClean = String(descricao).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
        doc.text(descClean, M, y, { maxWidth: CW }); y += 5
    }

    // Observacoes (posicao fixa antes da linha de corte)
    const obsY = boletoStartY - 20
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
    doc.text('OBSERVAÇÕES:', M, obsY)
    doc.text(
        'Esta fatura serve apenas como demonstrativo. Utilize o boleto abaixo para pagamento. ' +
        'O título poderá ser usado como garantia ou caução em operações de crédito.',
        M, obsY + 3.5, { maxWidth: CW }
    )
    doc.text(
        'Em caso de dúvidas, entre em contato com a ContaCapt pelos canais oficiais de atendimento. (85)-3264.1850.',
        M, obsY + 7, { maxWidth: CW }
    )

    // Linha de corte tracejada
    doc.setDrawColor(0); doc.setLineDash([3, 3], 0)
    doc.line(M, boletoStartY - 8, M + CW, boletoStartY - 8)
    doc.setFontSize(6)
    doc.text('Destaque aqui para pagamento', M + CW / 2, boletoStartY - 10, { align: 'center' })
    doc.setLineDash([], 0)
}

// ============================================================
// PDF - Renderiza ficha de compensacao (parte inferior)
// ============================================================
export const renderFichaCompensacao = async (doc, boleto, contaData, startY) => {
    const M = 10, CW = 190
    const ROW_H = 6.5, INST_H = ROW_H * 3  // 3 sub-linhas direita, mesma altura das demais

    const benef = extrairDadosBeneficiario(contaData)
    const nomeCorrentista = benef.nome
    const cicCorrentista  = benef.cpfCnpj
    const contaCorrente   = benef.conta
    const logoUrl         = benef.logoUrl

    const sacadoNome = boleto.sacado_nome || ''
    const sacadoCic  = boleto.sacado_cic  || ''
    const sacadoEnd  = montarEnderecoSacado(boleto)
    const sacadoCep  = boleto.sacado_cep  || ''
    const vencimento = boleto.data_vencimento
    const emissao    = boleto.data_emissao
    const valor      = boleto.valor
    const nossoNum   = boleto.nosso_numero || ''
    const numDoc     = boleto.numero_documento || ''
    const descricao  = boleto.descricao || ''

    const barcodeStr     = generateBarcodeFromBoleto(boleto, contaData)
    const linhaDigitavel = formatLinhaDigitavel(barcodeStr)

    const valorNum = typeof valor === 'number'
        ? valor
        : parseFloat(String(valor).replace(/\./g, '').replace(',', '.')) || 0
    const moraStr = (valorNum * 0.002).toFixed(2).replace('.', ',')

    let bY = startY

    // --- Cabecalho: logo ContaCapt DIGITAL | 274 | linha digitavel ---
    // Tenta carregar logomarca do Supabase; fallback em texto se falhar
    try {
        const logoData = await compressImageForPDF(CONTACAPT_LOGO_URL, 400, 0.95)
        // Imagem: fundo branco, alinhada a direita dentro dos 40mm (x=M, w=40, h=8)
        doc.addImage(logoData, 'JPEG', M, bY, 40, 8)
    } catch (_e) {
        // Fallback: texto preto, alinhado a direita
        doc.setTextColor(0, 0, 0)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10.5)
        doc.text('ContaCapt', M + 40, bY + 4.5, { align: 'right' })
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6)
        doc.text('by BMP', M + 40, bY + 7.5, { align: 'right' })
    }
    doc.line(M + 42, bY, M + 42, bY + 8)
    doc.setFontSize(14); doc.setFont('helvetica', 'bold')
    doc.text('274', M + 45, bY + 6)
    doc.line(M + 60, bY, M + 60, bY + 8)
    doc.setFontSize(10)
    doc.text(linhaDigitavel, M + CW, bY + 6, { align: 'right' })
    doc.line(M, bY + 9, M + CW, bY + 9)

    let lY = bY + 9
    const rightX = M + CW - 45
    const rightW = 45
    const leftW  = CW - 45
    const colW   = leftW / 5

    // Linha 1: Local de Pagamento / Vencimento
    const vLineH = (ROW_H * 4) + INST_H + 16
    doc.line(rightX, lY, rightX, lY + vLineH)

    doc.setFontSize(6); doc.setFont('helvetica', 'normal')
    doc.text('Local de Pagamento', M + 1, lY + 2.5)
    doc.setFontSize(8)
    doc.text('PAGÁVEL EM QUALQUER BANCO ATÉ O VENCIMENTO', M + 1, lY + 5.5)
    doc.setFontSize(6)
    doc.text('Vencimento', rightX + 1, lY + 2.5)
    doc.setFontSize(8); doc.setFont('helvetica', 'bold')
    doc.text(formatDate(vencimento), rightX + rightW - 1, lY + 5.5, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.line(M, lY + ROW_H, M + CW, lY + ROW_H); lY += ROW_H

    // Linha 2: Beneficiario / Agencia-Codigo
    doc.setFontSize(6)
    doc.text('Beneficiário', M + 1, lY + 2.5)
    doc.setFontSize(8)
    const benefText = cicCorrentista
        ? `${nomeCorrentista} - ${cicCorrentista}`
        : nomeCorrentista
    doc.text(benefText, M + 1, lY + 5.5)
    doc.setFontSize(6)
    doc.text('Agência/Código Beneficiário', rightX + 1, lY + 2.5)
    doc.setFontSize(8)
    doc.text(`0001 / ${contaCorrente}`, rightX + rightW - 1, lY + 5.5, { align: 'right' })
    doc.line(M, lY + ROW_H, M + CW, lY + ROW_H); lY += ROW_H

    // Linha 3: Datas / Nosso Numero
    doc.setFontSize(6)
    doc.text('Data Documento',     M + 1,           lY + 2.5)
    doc.text('Nº do Documento',    M + colW + 1,    lY + 2.5)
    doc.text('Espécie Doc.',       M + colW * 2 + 1, lY + 2.5)
    doc.text('Aceite',             M + colW * 3 + 1, lY + 2.5)
    doc.text('Data Processamento', M + colW * 4 + 1, lY + 2.5)
    doc.setFontSize(8)
    doc.text(formatDate(emissao),       M + 1,           lY + 5.5)
    doc.text(String(numDoc),            M + colW + 1,    lY + 5.5)
    doc.text('DM',                      M + colW * 2 + 1, lY + 5.5)
    doc.text('N',                       M + colW * 3 + 1, lY + 5.5)
    doc.text(formatDate(new Date()),    M + colW * 4 + 1, lY + 5.5)
    doc.setFontSize(6)
    doc.text('Nosso Número', rightX + 1, lY + 2.5)
    doc.setFontSize(8)
    doc.text(String(nossoNum), rightX + rightW - 1, lY + 5.5, { align: 'right' })
    doc.line(M, lY + ROW_H, M + CW, lY + ROW_H); lY += ROW_H

    // Linha 4: Carteira / Especie / Valor
    doc.setFontSize(6)
    doc.text('Carteira', M + colW + 1,    lY + 2.5)
    doc.text('Espécie',  M + colW * 2 + 1, lY + 2.5)
    doc.setFontSize(8)
    doc.text('09', M + colW + 1,    lY + 5.5)
    doc.text('R$', M + colW * 2 + 1, lY + 5.5)
    doc.setFontSize(6)
    doc.text('(=) Valor do Documento', rightX + 1, lY + 2.5)
    doc.setFontSize(8); doc.setFont('helvetica', 'bold')
    doc.text(formatMoeda(valor), rightX + rightW - 1, lY + 5.5, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.line(M, lY + ROW_H, M + CW, lY + ROW_H); lY += ROW_H

    // Instrucoes / colunas de valores
    doc.setFontSize(6)
    doc.text('Instruções (Texto de responsabilidade do beneficiário)', M + 1, lY + 2.5)
    doc.setFontSize(7)
    doc.text(`APÓS VENCIMENTO COBRAR MORA DE R$ ${moraStr} POR DIA`, M + 1, lY + 6)
    if (descricao) {
        const msgClean = String(descricao).replace(/[\r\n]+/g, ' ').trim()
        doc.text(msgClean, M + 1, lY + 9.5, { maxWidth: leftW - 2 })
    }
    doc.line(rightX, lY + ROW_H,       M + CW, lY + ROW_H)
    doc.setFontSize(6)
    doc.text('(-) Desconto / Abatimento', rightX + 1, lY + 2.5)
    doc.line(rightX, lY + ROW_H * 2,   M + CW, lY + ROW_H * 2)
    doc.text('(-) Outras deduções',       rightX + 1, lY + ROW_H + 2.5)
    doc.text('(+) Mora / Multa',          rightX + 1, lY + ROW_H * 2 + 2.5)
    doc.line(M, lY + INST_H, M + CW, lY + INST_H); lY += INST_H

    // Pagador
    const pagadorAvailW = rightX - M - 3   // largura disponivel no lado esquerdo
    doc.setFontSize(6)
    doc.text('Pagador', M + 1, lY + 2.5)
    doc.text('(+) Outros acréscimos', rightX + 1, lY + 2.5)
    doc.line(rightX, lY + ROW_H,     M + CW, lY + ROW_H)
    doc.text('(=) Valor Cobrado',     rightX + 1, lY + ROW_H + 2.5)

    let pY = lY + 6
    doc.setFontSize(8); doc.setFont('helvetica', 'bold')
    if (sacadoNome) { doc.text(sacadoNome.toUpperCase(), M + 1, pY, { maxWidth: pagadorAvailW }); pY += 4 }
    doc.setFont('helvetica', 'normal')
    if (sacadoCic)  { doc.text(`CPF/CNPJ: ${sacadoCic}`, M + 1, pY); pY += 4 }

    // Endereco + bairro na mesma linha
    const sacEndBairro = [boleto.sacado_endereco, boleto.sacado_bairro].filter(Boolean).join(', ')
    if (sacEndBairro) { doc.text(sacEndBairro.toUpperCase(), M + 1, pY, { maxWidth: pagadorAvailW }); pY += 4 }

    // Cidade - UF + CEP na linha seguinte
    const sacCidade = boleto.sacado_cidade || ''
    const sacUf     = boleto.sacado_uf     || ''
    const cidUfCep  = [
        sacCidade && sacUf ? `${sacCidade} - ${sacUf}` : (sacCidade || sacUf),
        sacadoCep ? `CEP: ${sacadoCep}` : ''
    ].filter(Boolean).join('   ')
    if (cidUfCep) { doc.text(cidUfCep.toUpperCase(), M + 1, pY, { maxWidth: pagadorAvailW }); pY += 4 }

    lY = Math.max(lY + 20, pY + 2)

    doc.line(M, lY, M + CW, lY)
    doc.setFontSize(6)
    doc.text('Sacador/Avalista', M + 1, lY + 2.5)

    // Dados do avalista (quando presentes)
    const avalistaNome = boleto.avalista_nome || ''
    const avalistaCic  = boleto.avalista_cic  || ''
    if (avalistaNome || avalistaCic) {
        let aY = lY + 6
        doc.setFontSize(8); doc.setFont('helvetica', 'bold')
        if (avalistaNome) { doc.text(avalistaNome, M + 1, aY, { maxWidth: pagadorAvailW }); aY += 4 }
        doc.setFont('helvetica', 'normal')
        if (avalistaCic)  { doc.text(`CPF/CNPJ: ${avalistaCic}`, M + 1, aY); aY += 4 }
        lY = aY
    } else {
        lY += 7
    }

    // Codigo de barras
    try {
        const canvas = document.createElement('canvas')
        const scale = 1.5
        canvas.width  = 1200 * scale
        canvas.height = 150 * scale
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.scale(scale, scale)
        JsBarcode(canvas, barcodeStr, {
            format: 'ITF', displayValue: false,
            width: 3, height: 120, margin: 10,
            fontSize: 0, background: '#ffffff', lineColor: '#000000',
        })
        doc.addImage(canvas.toDataURL('image/png', 0.85), 'PNG', M + 5, lY, CW - 10, 15)
    } catch (e) {
        console.error('[PDF] Erro ao gerar barcode:', e)
    }
}

// ============================================================
// PDF - Funcoes exportadas (usam capt_boletos + CONTAS)
// Assinatura: generateSingleBoletoPDF(boleto, contaData)
//   boleto    = registro de capt_boletos (snake_case)
//   contaData = registro de CONTAS (nome_correntista, cpf_cnpj,
//               conta_corrente, cedente, email, logo?)
// ============================================================

const BOLETO_START_Y = 183 // Posicao Y da ficha de compensacao (mm); A4=297mm, ficha ~110mm

export const generateSingleBoletoPDF = async (boleto, contaData) => {
    try {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
        await renderFatura(doc, boleto, contaData, BOLETO_START_Y)
        await renderFichaCompensacao(doc, boleto, contaData, BOLETO_START_Y)
        return doc.output('blob')
    } catch (error) {
        console.error('[PDF] Erro ao gerar PDF:', error)
        throw error
    }
}

export const generateMultipleBoletoPDFs = async (boletos, contaData) => {
    const blobs = []
    for (const boleto of boletos) {
        try {
            const blob = await generateSingleBoletoPDF(boleto, contaData)
            blobs.push({ blob, filename: `boleto_${boleto.num_titulo || boleto.numero_documento || boleto.id || 'doc'}.pdf` })
        } catch (error) {
            console.error('[PDF] Erro ao gerar PDF para boleto:', boleto.numero_documento, error)
        }
    }
    return blobs
}
