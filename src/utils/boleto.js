import { jsPDF } from 'jspdf'
import JsBarcode from 'jsbarcode'

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
      .replace(/[^A-Z0-9 ]/g, '')
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

// Calcula digito verificador do Nosso Numero - algoritmo BMP
const calcNNDV = (nossoNumero) => {
    const nn = cleanNum(nossoNumero)
    if (!nn) return '0'
    const weights = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3]
    let sum = 0
    const digits = nn.split('').reverse()
    digits.forEach((d, i) => {
          sum += parseInt(d) * (weights[i % weights.length])
    })
    const remainder = sum % 11
    if (remainder === 0 || remainder === 1) return '0'
    return String(11 - remainder)
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
const buildHeader = (conta, nextSeq) => {
    const nomeEmpresa = padRight(cleanStr(conta.nome_correntista || 'EMPRESA'), 30)
    const cedente = cleanNum(conta.cedente || '0')
    const cedenteFmt = padLeft('1' + cedente, 18, '0')
    const now = new Date()
    const headerDate = String(now.getDate()).padStart(2, '0') +
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
    line += padRight(nomeEmpresa, 30)              // pos 047-076 - nome cedente
    line += '274'                                  // pos 077-079 - codigo banco BMP
    line += padRight('BMP MONEY PLUS', 15)         // pos 080-094 - nome banco
    line += headerDate                             // pos 095-100 - data geracao DDMMAA
    line += '       '                              // pos 101-107 - brancos
    line += 'MX'                                   // pos 108-109 - identificador
    line += padLeft(nextSeq, 7)                    // pos 110-116 - sequencial remessa

    // Brancos ate pos 394, depois sequencial final
    while (line.length < 394) line += ' '
    line += padLeft(nextSeq, 6)                    // pos 395-400 - parte sequencial

    return line.substring(0, 400)
}

// ============================================================
// CNAB400 - Registro DETALHE Linha 1 (1 por titulo)
// ============================================================
const buildDetalhe1 = (boleto, lineSeq) => {
    // Dados do sacado
    const sacadoCic = cleanNum(boleto.sacado_cic || '')
    const tipoPessoa = getTipoPessoa(sacadoCic)
    const sNome = cleanStr(boleto.sacado_nome || '')
    const sEnd = cleanStr(boleto.sacado_endereco || '')
    const sCep = cleanNum(boleto.sacado_cep || '')
    const sBairro = cleanStr(boleto.sacado_bairro || '')
    const sCidade = cleanStr(boleto.sacado_cidade || '')
    const sUf = padRight(cleanStr(boleto.sacado_uf || ''), 2)

    // Avalista
    const avalistaCic = cleanNum(boleto.avalista_cic || '')
    const avalistaNome = cleanStr(boleto.avalista_nome || '')
    const avalistaTipo = avalistaCic ? getTipoPessoa(avalistaCic) : '0'

    // Nosso numero e titulo
    const nossoNum = cleanNum(boleto.nosso_numero || '')
    const digitoNN = calcNNDV(nossoNum)
    const tituloNum = boleto.numero_documento || boleto.nosso_numero || ''

    // Datas
    const dtVenc = fmtDate(boleto.data_vencimento)
    const dtEmis = fmtDate(boleto.data_emissao)

    // Valor
    const valorNum = typeof boleto.valor === 'string'
      ? parseFloat(boleto.valor.replace(/\./g, '').replace(',', '.'))
          : Number(boleto.valor || 0)

    let line = ''
    line += digitoNN                               // pos 001 - DV nosso numero
    line += '0000000000'                           // pos 002-011 - zeros reservado
    line += '2'                                    // pos 012 - codigo registro
    line += 'N'                                    // pos 013 - indicador
    line += '           '                          // pos 014-024 - brancos (11)
    line += '0'                                    // pos 025 - tipo impressao
    line += ' '                                    // pos 026 - branco
    line += '01'                                   // pos 027-028 - codigo carteira
    line += padRight(cleanStr(tituloNum).substring(0, 10), 10) // pos 029-038 - nosso numero 10 dig
    line += dtVenc                                 // pos 039-044 - vencimento DDMMAA
    line += fmtValor(valorNum)                     // pos 045-057 - valor 13 dig
    line += '0'                                    // pos 058 - banco cobrador
    line += '000000002N'                           // pos 059-067 - zeros + id (9)
    line += ' '                                    // pos 068 - branco
    line += dtEmis                                 // pos 069-074 - emissao DDMMAA
    line += '0000'                                 // pos 075-078 - instrucao
    line += fmtValor(0)                            // pos 079-091 - taxa mora 13 dig
    line += '0'                                    // pos 092 - tipo desconto
    line += '0'.repeat(45)                         // pos 093-137 - zeros (45)
    line += tipoPessoa                             // pos 138-139 - tipo pessoa (2 dig) [138-151 na doc tem 14]

    // Ajuste: na doc pos 138-151 tem 14 chars: tipoPessoa (2) + CIC padLeft (14) = 16 -> correto conforme tabela
    // Pos 138-139: tipoPessoa (2)
    // Pos 140-153: sacadoCic padLeft 14
    // Pos 154-193: sNome padRight 40
    // Pos 194-233: sEnd padRight 40
    // Pos 234-245: brancos 12
    // Pos 246-253: sCep padLeft 8
    // Pos 254: avalistaTipo 1
    // Pos 255-269: avalistaCic padRight 15
    // Pos 270-313: avalistaNome padRight 44
    // Pos 314-319: lineSeq padLeft 6

    // Build from tipoPessoa that was already appended above
    line += padLeft(sacadoCic, 14)                 // pos 140-153 - CIC sacado 14 dig
    line += padRight(sNome, 40)                    // pos 154-193 - nome sacado 40
    line += padRight(sEnd, 40)                     // pos 194-233 - endereco 40
    line += '            '                          // pos 234-245 - brancos 12
    line += padLeft(sCep, 8)                       // pos 246-253 - CEP 8 dig
    line += avalistaTipo                           // pos 254 - tipo avalista 1
    line += padRight(avalistaCic, 15)              // pos 255-269 - CIC avalista 15
    line += padRight(avalistaNome, 44)             // pos 270-313 - nome avalista 44
    line += padLeft(lineSeq, 6)                    // pos 314-319 - sequencial linha 6

    // Preenche ate 400
    while (line.length < 400) line += ' '
    return line.substring(0, 400)
}

// ============================================================
// CNAB400 - Registro DETALHE Linha 2 (1 por titulo, apos linha 1)
// ============================================================
const buildDetalhe2 = (boleto, lineSeq) => {
    const msgProtesto = padRight(
          'BOLETO SUJEITO A PROTESTO E NEGATIVACAO APOS VENCIMENTO',
          80
        )
    const msgImportado = padRight(cleanStr(boleto.mensagem1 || boleto.descricao || ''), 80)
    const msgGarantia = padRight(
          'O TITULO PODERA SER USADO COMO GARANTIA EM OPERACOES DE CREDITO',
          80
        )

    const sBairro = padLeft(cleanStr(boleto.sacado_bairro || ''), 20)
    const sUf = padRight(cleanStr(boleto.sacado_uf || ''), 2)
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
export const generateCNAB400RemittanceFile = (boletos, conta, nextSeq) => {
    console.log('[CNAB400] Gerando remessa para', boletos ? boletos.length : 0, 'boletos')

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
    lines.push(buildHeader(contaInfo, seq))
    lineSeq++

    // Detalhe (2 linhas por boleto)
    for (const boleto of boletos) {
          lines.push(buildDetalhe1(boleto, lineSeq))
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
// Geracao de PDF de boleto (mantida para compatibilidade)
// ============================================================

export const generateSingleBoletoPDF = async (record) => {
    try {
          const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
          doc.setFontSize(10)
          doc.text('BOLETO BANCARIO', 105, 15, { align: 'center' })
          doc.setFontSize(8)

      const fields = [
              ['Sacado:', record.sacado_nome || ''],
              ['CPF/CNPJ:', record.sacado_cic || ''],
              ['Endereco:', record.sacado_endereco || ''],
              ['Cidade/UF:', `${record.sacado_cidade || ''} / ${record.sacado_uf || ''}`],
              ['CEP:', record.sacado_cep || ''],
              ['Vencimento:', formatDate(record.data_vencimento)],
              ['Valor:', `R$ ${formatMoeda(record.valor)}`],
              ['Nosso Numero:', record.nosso_numero || ''],
              ['Numero Documento:', record.numero_documento || ''],
              ['Emissao:', formatDate(record.data_emissao)],
            ]

      let y = 30
          fields.forEach(([label, value]) => {
                  doc.setFont(undefined, 'bold')
                  doc.text(label, 15, y)
                  doc.setFont(undefined, 'normal')
                  doc.text(String(value), 55, y)
                  y += 8
          })

      if (record.codigo_barras) {
              try {
                        const canvas = document.createElement('canvas')
                        JsBarcode(canvas, record.codigo_barras, { format: 'CODE128', width: 1.5, height: 40, displayValue: false })
                        const imgData = canvas.toDataURL('image/png')
                        doc.addImage(imgData, 'PNG', 15, y + 5, 180, 20)
                        y += 30
              } catch (e) {
                        console.warn('[PDF] Erro ao gerar codigo de barras:', e)
              }
      }

      const pdfBlob = doc.output('blob')
          return pdfBlob
    } catch (error) {
          console.error('[PDF] Erro ao gerar PDF:', error)
          throw error
    }
}

export const generateMultipleBoletoPDFs = async (records) => {
    const blobs = []
        for (const record of records) {
              const blob = await generateSingleBoletoPDF(record)
              blobs.push({ blob, filename: `boleto_${record.numero_documento || record.id || 'doc'}.pdf` })
        }
    return blobs
}
