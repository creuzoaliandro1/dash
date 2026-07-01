import { jsPDF } from 'jspdf'

// ============================================================
// Nota Fiscal (DANFE / DANFSe) — geração a partir do XML anexado ao boleto
// ============================================================
// Este módulo faz duas coisas:
//   1) Faz o parse completo do XML (NFe modelo 55 - produtos/peças, ou
//      NFSe - serviços, nos formatos legado Ginfes/SPED e no novo padrão
//      nacional DPS/NFS-e) extraindo TODOS os campos necessários para o
//      documento auxiliar (DANFE / DANFSe).
//   2) Renderiza o PDF no layout oficial (réplica fiel), incluindo o
//      código de barras Code128 da chave de acesso (DANFE) e o QR Code
//      de consulta (DANFSe).
//
// Bibliotecas de código de barras/QR são carregadas dinamicamente via CDN
// (mesmo padrão já usado no projeto para a lib XLSX em importService.js),
// para não depender de pacotes npm que podem não estar instalados.
// ============================================================

// ---------- Formatação ----------

const formatMoeda = (value) => {
  const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value
  if (value === undefined || value === null || isNaN(num)) return '0,00'
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatCNPJCPF = (doc) => {
  const d = String(doc || '').replace(/\D/g, '')
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  return d
}

const formatCEP = (cep) => {
  const d = String(cep || '').replace(/\D/g, '')
  if (d.length === 8) return d.replace(/(\d{5})(\d{3})/, '$1-$2')
  return d
}

// dd/mm/aaaa a partir de ISO (YYYY-MM-DDThh:mm:ss) sem problema de fuso
const formatDataHoraBR = (iso) => {
  if (!iso) return ''
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2}))?/)
  if (!m) return String(iso)
  const [, y, mo, d, h, mi, s] = m
  return h !== undefined ? `${d}/${mo}/${y} ${h}:${mi}:${s || '00'}` : `${d}/${mo}/${y}`
}

const formatDataBR = (iso) => {
  if (!iso) return ''
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso)
}

// Formata a chave de acesso em blocos de 4 dígitos separados por espaço
const formatChaveAcesso = (chave) => {
  const d = String(chave || '').replace(/\D/g, '')
  return d.replace(/(.{4})/g, '$1 ').trim()
}

// ---------- Helpers de leitura de XML (tolerantes a namespace) ----------

const txt = (el) => (el ? (el.textContent || '').trim() : '')

const first = (root, tag) => {
  if (!root) return null
  const els = root.getElementsByTagName(tag)
  return els.length > 0 ? els[0] : null
}

const firstText = (root, tag) => txt(first(root, tag))

// Busca um elemento por várias tags possíveis (variações de leiaute), retorna o primeiro que existir
const firstOf = (root, tags) => {
  for (const tag of tags) {
    const el = first(root, tag)
    if (el) return el
  }
  return null
}

const firstTextOf = (root, tags) => txt(firstOf(root, tags))

// ============================================================
// Detecção do tipo de documento
// ============================================================

export const detectarTipoDocumento = (xmlDoc) => {
  if (first(xmlDoc, 'infNFe') || first(xmlDoc, 'NFe')) return 'nfe'

  // NFS-e padrão nacional (DPS/NFSe) — tags características
  if (first(xmlDoc, 'infDPS') || first(xmlDoc, 'infNFSe') || first(xmlDoc, 'DPS')) return 'nfse-nacional'

  // NFS-e legado Ginfes (ABRASF) — PrestadorServico/TomadorServico
  if (first(xmlDoc, 'PrestadorServico') || first(xmlDoc, 'TomadorServico') || first(xmlDoc, 'InfNfse') || first(xmlDoc, 'Nfse')) {
    return 'nfse-legado'
  }

  // NFS-e legado SPED (toma/emit) — usado por alguns provedores
  if (first(xmlDoc, 'toma') && first(xmlDoc, 'Servico')) return 'nfse-legado'

  // Fallbacks genéricos
  if (first(xmlDoc, 'CTe')) return 'cte'
  if (first(xmlDoc, 'MDFe')) return 'mdfe'

  return null
}

// ============================================================
// Parser completo da NFe (produtos/peças) — para o DANFE
// ============================================================

const parseEndereco = (root, tagEndereco) => {
  const end = first(root, tagEndereco)
  if (!end) return null
  return {
    xLgr: firstText(end, 'xLgr'),
    nro: firstText(end, 'nro'),
    xCpl: firstText(end, 'xCpl'),
    xBairro: firstText(end, 'xBairro'),
    xMun: firstText(end, 'xMun'),
    UF: firstText(end, 'UF'),
    CEP: firstText(end, 'CEP'),
    fone: firstText(end, 'fone'),
  }
}

const enderecoLinha1 = (end) => {
  if (!end) return ''
  return [end.xLgr, end.nro, end.xCpl].filter(Boolean).join(', ')
}

export const parseNFeCompleto = (xmlDoc) => {
  const infNFe = first(xmlDoc, 'infNFe')
  const ide = first(xmlDoc, 'ide')
  const emit = first(xmlDoc, 'emit')
  const dest = first(xmlDoc, 'dest')
  const total = first(xmlDoc, 'total')
  const icmsTot = total ? first(total, 'ICMSTot') : null
  const issqnTot = total ? first(total, 'ISSQNtot') : null
  const transp = first(xmlDoc, 'transp')
  const cobr = first(xmlDoc, 'cobr')
  const infAdic = first(xmlDoc, 'infAdic')
  const protNFe = first(xmlDoc, 'protNFe')
  const infProt = protNFe ? first(protNFe, 'infProt') : null

  // Chave de acesso: atributo Id de infNFe, formato "NFe" + 44 dígitos
  let chaveAcesso = ''
  if (infNFe && infNFe.getAttribute) {
    chaveAcesso = (infNFe.getAttribute('Id') || '').replace(/^NFe/i, '')
  }
  if (!chaveAcesso && infProt) {
    chaveAcesso = firstText(infProt, 'chNFe')
  }

  // Itens (det)
  const detEls = Array.from(xmlDoc.getElementsByTagName('det'))
  const itens = detEls.map((det) => {
    const prod = first(det, 'prod')
    const imposto = first(det, 'imposto')
    // Grupo ICMS: procura qualquer subtag ICMSxx dentro de imposto/ICMS
    let cst = '', csosn = '', vBC = '', pICMS = '', vICMS = ''
    const icmsGroup = imposto ? first(imposto, 'ICMS') : null
    if (icmsGroup) {
      // primeiro filho do grupo ICMS é o subgrupo real (ICMS00, ICMS40, ICMSSN101, etc.)
      const sub = icmsGroup.firstElementChild
      if (sub) {
        cst = firstText(sub, 'CST')
        csosn = firstText(sub, 'CSOSN')
        vBC = firstText(sub, 'vBC')
        pICMS = firstText(sub, 'pICMS')
        vICMS = firstText(sub, 'vICMS')
      }
    }
    let vIPI = '', pIPI = ''
    const ipiGroup = imposto ? first(imposto, 'IPI') : null
    if (ipiGroup) {
      const ipiTrib = first(ipiGroup, 'IPITrib')
      if (ipiTrib) {
        vIPI = firstText(ipiTrib, 'vIPI')
        pIPI = firstText(ipiTrib, 'pIPI')
      }
    }
    return {
      cProd: firstText(prod, 'cProd'),
      xProd: firstText(prod, 'xProd'),
      NCM: firstText(prod, 'NCM'),
      CFOP: firstText(prod, 'CFOP'),
      uCom: firstText(prod, 'uCom'),
      qCom: firstText(prod, 'qCom'),
      vUnCom: firstText(prod, 'vUnCom'),
      vProd: firstText(prod, 'vProd'),
      CST: cst || csosn,
      vBC, pICMS, vICMS, vIPI, pIPI,
    }
  })

  return {
    tipo: 'nfe',
    chaveAcesso,
    ide: {
      natOp: firstText(ide, 'natOp'),
      nNF: firstText(ide, 'nNF'),
      serie: firstText(ide, 'serie'),
      mod: firstText(ide, 'mod'),
      tpNF: firstText(ide, 'tpNF'), // 0=entrada 1=saída
      dhEmi: firstText(ide, 'dhEmi') || firstText(ide, 'dEmi'),
      dhSaiEnt: firstText(ide, 'dhSaiEnt') || firstText(ide, 'dSaiEnt'),
    },
    emit: {
      xNome: firstText(emit, 'xNome'),
      CNPJ: firstText(emit, 'CNPJ') || firstText(emit, 'CPF'),
      IE: firstText(emit, 'IE'),
      IEST: firstText(emit, 'IEST'),
      endereco: parseEndereco(emit, 'enderEmit'),
    },
    dest: {
      xNome: firstText(dest, 'xNome'),
      CNPJ: firstText(dest, 'CNPJ') || firstText(dest, 'CPF'),
      IE: firstText(dest, 'IE'),
      endereco: parseEndereco(dest, 'enderDest'),
    },
    itens,
    totais: {
      vBC: firstText(icmsTot, 'vBC'),
      vICMS: firstText(icmsTot, 'vICMS'),
      vBCST: firstText(icmsTot, 'vBCST'),
      vST: firstText(icmsTot, 'vST'),
      vProd: firstText(icmsTot, 'vProd'),
      vFrete: firstText(icmsTot, 'vFrete'),
      vSeg: firstText(icmsTot, 'vSeg'),
      vDesc: firstText(icmsTot, 'vDesc'),
      vOutro: firstText(icmsTot, 'vOutro'),
      vIPI: firstText(icmsTot, 'vIPI'),
      vTotTrib: firstText(icmsTot, 'vTotTrib'),
      vNF: firstText(icmsTot, 'vNF'),
      issqn: issqnTot ? {
        vServ: firstText(issqnTot, 'vServ'),
        vBC: firstText(issqnTot, 'vBC'),
        vISS: firstText(issqnTot, 'vISS'),
      } : null,
    },
    transp: transp ? {
      modFrete: firstText(transp, 'modFrete'),
      transportador: (() => {
        const t = first(transp, 'transporta')
        return t ? { xNome: firstText(t, 'xNome'), CNPJ: firstText(t, 'CNPJ') || firstText(t, 'CPF'), IE: firstText(t, 'IE'), xEnder: firstText(t, 'xEnder'), xMun: firstText(t, 'xMun'), UF: firstText(t, 'UF') } : null
      })(),
      veiculo: (() => {
        const v = first(transp, 'veicTransp')
        return v ? { placa: firstText(v, 'placa'), UF: firstText(v, 'UF'), RNTC: firstText(v, 'RNTC') } : null
      })(),
      volumes: (() => {
        const v = first(transp, 'vol')
        return v ? { qVol: firstText(v, 'qVol'), esp: firstText(v, 'esp'), marca: firstText(v, 'marca'), nVol: firstText(v, 'nVol'), pesoB: firstText(v, 'pesoB'), pesoL: firstText(v, 'pesoL') } : null
      })(),
    } : null,
    fatura: cobr ? (() => {
      const fat = first(cobr, 'fat')
      const dups = Array.from(cobr.getElementsByTagName('dup')).map((d) => ({
        nDup: firstText(d, 'nDup'), dVenc: firstText(d, 'dVenc'), vDup: firstText(d, 'vDup'),
      }))
      return { nFat: fat ? firstText(fat, 'nFat') : '', vOrig: fat ? firstText(fat, 'vOrig') : '', vDesc: fat ? firstText(fat, 'vDesc') : '', vLiq: fat ? firstText(fat, 'vLiq') : '', duplicatas: dups }
    })() : null,
    infAdic: {
      infCpl: firstText(infAdic, 'infCpl'),
      infAdFisco: firstText(infAdic, 'infAdFisco'),
    },
    protocolo: infProt ? {
      nProt: firstText(infProt, 'nProt'),
      dhRecbto: firstText(infProt, 'dhRecbto'),
      cStat: firstText(infProt, 'cStat'),
      xMotivo: firstText(infProt, 'xMotivo'),
    } : null,
  }
}

// ============================================================
// Parser completo da NFS-e (serviços) — para o DANFSe
// Cobre 3 variações de leiaute encontradas na prática:
//   - Nacional (DPS/NFSe, gov.br/nfse) — Fortaleza-CE e Mossoró-RN a partir de 2026
//   - Legado ABRASF/Ginfes (PrestadorServico/TomadorServico)
//   - Legado SPED (toma/emit) — alguns provedores antigos
// A extração busca as tags em qualquer nível (não exige caminho exato),
// pelo mesmo motivo que o parser de importação (importService.js) já faz:
// municípios/provedores variam a estrutura de aninhamento.
// ============================================================

const parseEnderecoGenerico = (root) => {
  if (!root) return null
  const end = firstOf(root, ['Endereco', 'endNac', 'end']) || root
  return {
    xLgr: firstTextOf(end, ['Endereco', 'xLgr', 'Logradouro']),
    nro: firstTextOf(end, ['Numero', 'nro']),
    xBairro: firstTextOf(end, ['Bairro', 'xBairro']),
    xMun: firstTextOf(end, ['xMun', 'Cidade']) || '',
    UF: firstTextOf(end, ['UF', 'Uf']),
    CEP: firstTextOf(end, ['CEP', 'Cep']),
  }
}

export const parseNFSeCompleto = (xmlDoc, subtipo) => {
  // --- Identificação / cabeçalho ---
  const numero = firstTextOf(xmlDoc, ['nNFSe', 'Numero', 'numero'])
  const codigoVerificacao = firstTextOf(xmlDoc, ['codVerificacao', 'CodigoVerificacao', 'verificationCode'])
  const dataEmissao = firstTextOf(xmlDoc, ['dhEmi', 'DataEmissao', 'dhProc'])
  const competencia = firstTextOf(xmlDoc, ['dCompet', 'Competencia'])

  // Chave de acesso (50 dígitos) — padrão nacional
  let chaveAcesso = ''
  const infNFSe = first(xmlDoc, 'infNFSe')
  if (infNFSe && infNFSe.getAttribute) {
    chaveAcesso = infNFSe.getAttribute('Id') || infNFSe.getAttribute('chaveacesso') || ''
  }
  if (!chaveAcesso) chaveAcesso = firstTextOf(xmlDoc, ['chNFSe', 'chaveAcesso'])

  // --- Prestador ---
  const prestEl = firstOf(xmlDoc, ['prest', 'Prestador', 'PrestadorServico'])
  const prestador = {
    razaoSocial: firstTextOf(prestEl, ['xNome', 'RazaoSocial', 'nome']),
    cnpjCpf: firstTextOf(prestEl, ['CNPJ', 'Cnpj', 'CPF', 'Cpf']),
    inscricaoMunicipal: firstTextOf(prestEl, ['IM', 'InscricaoMunicipal']),
    endereco: parseEnderecoGenerico(prestEl),
    email: firstTextOf(prestEl, ['email', 'Email']),
    telefone: firstTextOf(prestEl, ['fone', 'Telefone']),
  }

  // --- Tomador ---
  const tomaEl = firstOf(xmlDoc, ['toma', 'Tomador', 'TomadorServico'])
  const tomador = {
    razaoSocial: firstTextOf(tomaEl, ['xNome', 'RazaoSocial', 'nome']),
    cnpjCpf: firstTextOf(tomaEl, ['CNPJ', 'Cnpj', 'CPF', 'Cpf']),
    inscricaoMunicipal: firstTextOf(tomaEl, ['IM', 'InscricaoMunicipal']),
    endereco: parseEnderecoGenerico(tomaEl),
    email: firstTextOf(tomaEl, ['email', 'Email']),
    telefone: firstTextOf(tomaEl, ['fone', 'Telefone']),
  }

  // --- Serviço / discriminação ---
  const servEl = firstOf(xmlDoc, ['serv', 'Servico'])
  const discriminacao = firstTextOf(servEl || xmlDoc, ['xDescServ', 'Discriminacao', 'discriminacao'])
  const municipioPrestacao = firstTextOf(servEl || xmlDoc, ['cLocPrestacao', 'CodigoMunicipio', 'xMunPrestacao']) || (prestador.endereco ? prestador.endereco.xMun : '')
  const codigoServico = firstTextOf(servEl || xmlDoc, ['cTribNac', 'ItemListaServico', 'CodigoServico'])

  // --- Valores ---
  const valEl = firstOf(xmlDoc, ['valores', 'Valores'])
  const valorServicos = firstTextOf(valEl || xmlDoc, ['vServPrest', 'vServ', 'ValorServicos'])
  const valorDeducoes = firstTextOf(valEl || xmlDoc, ['vDescIncond', 'ValorDeducoes', 'DescontoIncondicionado'])
  const baseCalculo = firstTextOf(valEl || xmlDoc, ['vBC', 'BaseCalculo'])
  const aliquotaISS = firstTextOf(valEl || xmlDoc, ['pAliqAplic', 'Aliquota', 'pIss'])
  const valorISS = firstTextOf(valEl || xmlDoc, ['vISSQN', 'vISS', 'ValorIss'])
  const issRetidoRaw = firstTextOf(valEl || xmlDoc, ['tpRetISSQN', 'IssRetido'])
  const issRetido = issRetidoRaw === '1' || String(issRetidoRaw).toUpperCase() === 'SIM'
  const valorLiquido = firstTextOf(valEl || xmlDoc, ['vLiq', 'vLiqNFSe', 'ValorLiquidoNfse'])

  // Tributos federais retidos (quando existirem)
  const tributosFederais = {
    pis: firstTextOf(valEl || xmlDoc, ['vPis', 'ValorPis']),
    cofins: firstTextOf(valEl || xmlDoc, ['vCofins', 'ValorCofins']),
    inss: firstTextOf(valEl || xmlDoc, ['vInss', 'ValorInss']),
    ir: firstTextOf(valEl || xmlDoc, ['vIr', 'ValorIr']),
    csll: firstTextOf(valEl || xmlDoc, ['vCsll', 'ValorCsll']),
  }

  // Tributos IBS/CBS (reforma tributária — presentes apenas em notas emitidas já no padrão v2.0/2026)
  const ibsCbs = {
    vIBS: firstTextOf(xmlDoc, ['vIBS']),
    vCBS: firstTextOf(xmlDoc, ['vCBS']),
    pIBS: firstTextOf(xmlDoc, ['pIBS']),
    pCBS: firstTextOf(xmlDoc, ['pCBS']),
  }
  const temIBSCBS = !!(ibsCbs.vIBS || ibsCbs.vCBS)

  return {
    tipo: 'nfse',
    subtipo,
    numero,
    codigoVerificacao,
    chaveAcesso,
    dataEmissao,
    competencia,
    prestador,
    tomador,
    discriminacao,
    municipioPrestacao,
    codigoServico,
    valores: {
      valorServicos, valorDeducoes, baseCalculo, aliquotaISS, valorISS, issRetido, valorLiquido,
    },
    tributosFederais,
    ibsCbs: temIBSCBS ? ibsCbs : null,
  }
}

// ============================================================
// Parse do texto XML (string) -> objeto estruturado (NFe ou NFS-e)
// ============================================================

export const parseNotaFiscalXML = (xmlText) => {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml')

  const parserError = xmlDoc.getElementsByTagName('parsererror')[0]
  if (parserError) {
    throw new Error('XML inválido ou corrompido')
  }

  const tipoDetectado = detectarTipoDocumento(xmlDoc)

  if (tipoDetectado === 'nfe') return parseNFeCompleto(xmlDoc)
  if (tipoDetectado === 'nfse-nacional' || tipoDetectado === 'nfse-legado') {
    return parseNFSeCompleto(xmlDoc, tipoDetectado)
  }

  throw new Error('Não foi possível identificar o tipo do documento fiscal no XML (esperado NF-e ou NFS-e).')
}

// ============================================================
// Carregamento dinâmico de bibliotecas via CDN (mesmo padrão já usado
// no projeto para XLSX em importService.js) — evita depender de pacotes
// npm que podem não estar instalados no ambiente do usuário.
// ============================================================

const carregarScript = (src, globalCheck) => {
  return new Promise((resolve, reject) => {
    if (globalCheck()) { resolve(); return }
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Erro ao carregar biblioteca: ' + src))
    document.head.appendChild(script)
  })
}

const carregarJsBarcode = () => carregarScript(
  'https://unpkg.com/jsbarcode@3.11.6/dist/JsBarcode.all.min.js',
  () => !!window.JsBarcode
)

const carregarQRCode = () => carregarScript(
  'https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js',
  () => !!window.QRCode
)

// Gera um data URL PNG do código de barras Code128 a partir de uma string numérica (ex.: chave de acesso de 44 dígitos)
const gerarBarcodeDataURL = async (valor) => {
  await carregarJsBarcode()
  const canvas = document.createElement('canvas')
  window.JsBarcode(canvas, valor, {
    format: 'CODE128',
    displayValue: false,
    margin: 0,
    height: 50,
    width: 2,
  })
  return canvas.toDataURL('image/png')
}

// Gera um data URL PNG de QR Code a partir de uma URL/texto
const gerarQRCodeDataURL = async (valor) => {
  await carregarQRCode()
  return new Promise((resolve, reject) => {
    window.QRCode.toDataURL(valor, { margin: 1, width: 200 }, (err, url) => {
      if (err) reject(err)
      else resolve(url)
    })
  })
}

// ============================================================
// Renderização do DANFE (NF-e — produtos/peças), modelo retrato
// ============================================================

const MX = 5 // margem lateral (mm)
const PAGE_W = 210
const PAGE_H = 297
const CW = PAGE_W - MX * 2 // largura útil do conteúdo

// Desenha uma caixa com borda e um rótulo pequeno no canto superior esquerdo
function caixa(pdf, x, y, w, h, rotulo) {
  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.15)
  pdf.rect(x, y, w, h)
  if (rotulo) {
    pdf.setFontSize(5.5)
    pdf.setFont(undefined, 'normal')
    pdf.text(rotulo, x + 1, y + 2.2)
  }
}

function campo(pdf, x, y, rotulo, valor, opts = {}) {
  pdf.setFontSize(5.5)
  pdf.setFont(undefined, 'normal')
  pdf.text(rotulo, x, y)
  pdf.setFontSize(opts.fontSize || 7.5)
  pdf.setFont(undefined, opts.bold ? 'bold' : 'normal')
  const texto = String(valor || '').toUpperCase()
  pdf.text(texto, x, y + 3.6, opts.maxWidth ? { maxWidth: opts.maxWidth } : undefined)
}

// Usa fallback do perfil (conta) vinculado ao boleto quando o XML não traz o dado
// (na prática cobre o caso de emit/prestador == a própria empresa do usuário)
function comFallback(valorXML, valorConta) {
  return valorXML && String(valorXML).trim() ? valorXML : (valorConta || '')
}

export const generateDANFEPdf = async (nfe, conta) => {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  let y = MX

  const emitNome = comFallback(nfe.emit?.xNome, conta?.nome_correntista)
  const emitCNPJ = comFallback(nfe.emit?.CNPJ, conta?.cic || conta?.cnpj)
  const emitEnd = nfe.emit?.endereco

  // ---------- Faixa superior: 3 blocos ----------
  const bloco1W = CW * 0.35
  const bloco2W = CW * 0.34
  const bloco3W = CW - bloco1W - bloco2W
  const alturaTopo = 32

  // Bloco 1 — Emitente
  caixa(pdf, MX, y, bloco1W, alturaTopo)
  pdf.setFontSize(9)
  pdf.setFont(undefined, 'bold')
  pdf.text(String(emitNome || '').toUpperCase(), MX + 2, y + 6, { maxWidth: bloco1W - 4 })
  pdf.setFontSize(6.5)
  pdf.setFont(undefined, 'normal')
  let ey = y + 12
  if (emitEnd) {
    pdf.text((enderecoLinha1(emitEnd) || '').toUpperCase(), MX + 2, ey, { maxWidth: bloco1W - 4 }); ey += 3.5
    pdf.text(`${emitEnd.xBairro || ''}  ${emitEnd.xMun || ''}-${emitEnd.UF || ''}  CEP ${formatCEP(emitEnd.CEP)}`.toUpperCase(), MX + 2, ey, { maxWidth: bloco1W - 4 }); ey += 3.5
    if (emitEnd.fone) { pdf.text(`FONE: ${emitEnd.fone}`, MX + 2, ey); ey += 3.5 }
  }

  // Bloco 2 — DANFE / Chave de acesso
  const x2 = MX + bloco1W
  caixa(pdf, x2, y, bloco2W, alturaTopo)
  pdf.setFontSize(13)
  pdf.setFont(undefined, 'bold')
  pdf.text('DANFE', x2 + bloco2W / 2, y + 5, { align: 'center' })
  pdf.setFontSize(5.5)
  pdf.setFont(undefined, 'normal')
  pdf.text('Documento Auxiliar da Nota Fiscal Eletrônica', x2 + bloco2W / 2, y + 8, { align: 'center', maxWidth: bloco2W - 4 })
  const tpNF = nfe.ide?.tpNF === '0' ? '0 - ENTRADA' : '1 - SAÍDA'
  pdf.setFontSize(6.5)
  pdf.text(tpNF, x2 + 2, y + 12)
  pdf.text(`Nº ${nfe.ide?.nNF || ''}   SÉRIE ${nfe.ide?.serie || ''}`, x2 + bloco2W - 2, y + 12, { align: 'right' })
  pdf.setFontSize(6)
  pdf.text('CHAVE DE ACESSO', x2 + bloco2W / 2, y + 16, { align: 'center' })
  pdf.setFontSize(7)
  pdf.setFont(undefined, 'bold')
  pdf.text(formatChaveAcesso(nfe.chaveAcesso), x2 + bloco2W / 2, y + 19.5, { align: 'center' })

  // Código de barras (Code128) da chave de acesso
  if (nfe.chaveAcesso) {
    try {
      const barcodeUrl = await gerarBarcodeDataURL(nfe.chaveAcesso.replace(/\D/g, ''))
      pdf.addImage(barcodeUrl, 'PNG', x2 + 3, y + 21, bloco2W - 6, 8)
    } catch (e) {
      console.warn('[DANFE] Não foi possível gerar código de barras:', e)
    }
  }
  pdf.setFontSize(5)
  pdf.setFont(undefined, 'normal')
  pdf.text('Consulta em www.nfe.fazenda.gov.br/portal', x2 + bloco2W / 2, y + alturaTopo - 1, { align: 'center' })

  // Bloco 3 — Natureza da operação / protocolo
  const x3 = x2 + bloco2W
  caixa(pdf, x3, y, bloco3W, alturaTopo)
  campo(pdf, x3 + 2, y + 5, 'NATUREZA DA OPERAÇÃO', nfe.ide?.natOp, { maxWidth: bloco3W - 4 })
  campo(pdf, x3 + 2, y + 12, 'INSCRIÇÃO ESTADUAL', nfe.emit?.IE)
  campo(pdf, x3 + 2, y + 19, 'CNPJ', formatCNPJCPF(emitCNPJ))
  if (nfe.protocolo && nfe.protocolo.nProt) {
    pdf.setFontSize(5.5)
    pdf.text('PROTOCOLO DE AUTORIZAÇÃO DE USO', x3 + 2, y + 25)
    pdf.setFontSize(6.5)
    pdf.setFont(undefined, 'bold')
    pdf.text(`${nfe.protocolo.nProt} - ${formatDataHoraBR(nfe.protocolo.dhRecbto)}`, x3 + 2, y + 29, { maxWidth: bloco3W - 4 })
  } else {
    pdf.setFontSize(6)
    pdf.setTextColor(180, 0, 0)
    pdf.text('SEM PROTOCOLO DE AUTORIZAÇÃO NO XML', x3 + 2, y + 27, { maxWidth: bloco3W - 4 })
    pdf.setTextColor(0, 0, 0)
  }
  y += alturaTopo

  // ---------- Destinatário/Remetente ----------
  const alturaDest = 22
  caixa(pdf, MX, y, CW, alturaDest, 'DESTINATÁRIO / REMETENTE')
  const destEnd = nfe.dest?.endereco
  campo(pdf, MX + 2, y + 6, 'NOME/RAZÃO SOCIAL', nfe.dest?.xNome, { maxWidth: CW * 0.55 })
  campo(pdf, MX + CW * 0.6, y + 6, 'CNPJ/CPF', formatCNPJCPF(nfe.dest?.CNPJ))
  campo(pdf, MX + CW * 0.82, y + 6, 'DATA EMISSÃO', formatDataBR((nfe.ide?.dhEmi || '').split('T')[0]))
  campo(pdf, MX + 2, y + 13, 'ENDEREÇO', enderecoLinha1(destEnd), { maxWidth: CW * 0.45 })
  campo(pdf, MX + CW * 0.5, y + 13, 'BAIRRO', destEnd?.xBairro, { maxWidth: CW * 0.2 })
  campo(pdf, MX + CW * 0.72, y + 13, 'CEP', formatCEP(destEnd?.CEP))
  campo(pdf, MX + 2, y + 19.5, 'MUNICÍPIO', destEnd ? `${destEnd.xMun || ''} - ${destEnd.UF || ''}` : '', { maxWidth: CW * 0.45 })
  campo(pdf, MX + CW * 0.5, y + 19.5, 'FONE', destEnd?.fone)
  campo(pdf, MX + CW * 0.72, y + 19.5, 'INSCRIÇÃO ESTADUAL', nfe.dest?.IE)
  y += alturaDest

  // ---------- Fatura/Duplicatas ----------
  if (nfe.fatura && nfe.fatura.duplicatas && nfe.fatura.duplicatas.length > 0) {
    const alturaFat = 16
    caixa(pdf, MX, y, CW, alturaFat, 'FATURA / DUPLICATAS')
    let dx = MX + 2
    pdf.setFontSize(6)
    pdf.text('Nº', dx, y + 5.5)
    pdf.text('VENCIMENTO', dx + 25, y + 5.5)
    pdf.text('VALOR', dx + 55, y + 5.5)
    let linhaY = y + 9
    nfe.fatura.duplicatas.slice(0, 3).forEach((dup) => {
      pdf.setFont(undefined, 'normal')
      pdf.setFontSize(6.5)
      pdf.text(String(dup.nDup || ''), dx, linhaY)
      pdf.text(formatDataBR(dup.dVenc), dx + 25, linhaY)
      pdf.text(formatMoeda(dup.vDup), dx + 55, linhaY)
      dx += 85
      if (dx > MX + CW - 85) { dx = MX + 2; linhaY += 3.6 }
    })
    y += alturaFat
  }

  // ---------- Cálculo do Imposto ----------
  const alturaImp = 20
  caixa(pdf, MX, y, CW, alturaImp, 'CÁLCULO DO IMPOSTO')
  const t = nfe.totais
  const col = CW / 6
  const linha1Y = y + 6, linha2Y = y + 16
  campo(pdf, MX + 2 + col * 0, linha1Y, 'BASE CÁLC. ICMS', formatMoeda(t.vBC))
  campo(pdf, MX + 2 + col * 1, linha1Y, 'VALOR DO ICMS', formatMoeda(t.vICMS))
  campo(pdf, MX + 2 + col * 2, linha1Y, 'BASE CÁLC. ICMS ST', formatMoeda(t.vBCST))
  campo(pdf, MX + 2 + col * 3, linha1Y, 'VALOR ICMS ST', formatMoeda(t.vST))
  campo(pdf, MX + 2 + col * 4, linha1Y, 'VALOR TOTAL PRODUTOS', formatMoeda(t.vProd))
  campo(pdf, MX + 2 + col * 5, linha1Y, 'VALOR DO FRETE', formatMoeda(t.vFrete))
  campo(pdf, MX + 2 + col * 0, linha2Y, 'VALOR DO SEGURO', formatMoeda(t.vSeg))
  campo(pdf, MX + 2 + col * 1, linha2Y, 'DESCONTO', formatMoeda(t.vDesc))
  campo(pdf, MX + 2 + col * 2, linha2Y, 'OUTRAS DESP.', formatMoeda(t.vOutro))
  campo(pdf, MX + 2 + col * 3, linha2Y, 'VALOR DO IPI', formatMoeda(t.vIPI))
  campo(pdf, MX + 2 + col * 4, linha2Y, 'VALOR TOTAL DA NOTA', formatMoeda(t.vNF), { bold: true, fontSize: 8.5 })
  y += alturaImp

  // ---------- Transportador ----------
  if (nfe.transp && (nfe.transp.transportador || nfe.transp.volumes)) {
    const alturaTransp = 14
    caixa(pdf, MX, y, CW, alturaTransp, 'TRANSPORTADOR / VOLUMES TRANSPORTADOS')
    const tr = nfe.transp.transportador
    const modFreteLabel = { '0': 'CIF (EMITENTE)', '1': 'FOB (DESTINATÁRIO)', '2': 'TERCEIROS', '3': 'PRÓPRIO REMETENTE', '4': 'PRÓPRIO DESTINATÁRIO', '9': 'SEM TRANSPORTE' }[nfe.transp.modFrete] || ''
    campo(pdf, MX + 2, y + 6, 'NOME/RAZÃO SOCIAL', tr?.xNome, { maxWidth: CW * 0.4 })
    campo(pdf, MX + CW * 0.45, y + 6, 'FRETE POR CONTA', modFreteLabel)
    campo(pdf, MX + CW * 0.7, y + 6, 'PLACA', nfe.transp.veiculo?.placa)
    const vol = nfe.transp.volumes
    if (vol) {
      campo(pdf, MX + 2, y + 12.5, 'QTD. VOLUMES', vol.qVol)
      campo(pdf, MX + CW * 0.25, y + 12.5, 'ESPÉCIE', vol.esp)
      campo(pdf, MX + CW * 0.5, y + 12.5, 'PESO BRUTO', vol.pesoB)
      campo(pdf, MX + CW * 0.75, y + 12.5, 'PESO LÍQUIDO', vol.pesoL)
    }
    y += alturaTransp
  }

  // ---------- Tabela de Produtos/Serviços ----------
  const headerH = 12
  caixa(pdf, MX, y, CW, headerH, 'DADOS DOS PRODUTOS/SERVIÇOS')
  const colunas = [
    { label: 'CÓDIGO', w: 0.09, align: 'left' },
    { label: 'DESCRIÇÃO', w: 0.29, align: 'left' },
    { label: 'NCM', w: 0.07, align: 'center' },
    { label: 'CST', w: 0.05, align: 'center' },
    { label: 'CFOP', w: 0.06, align: 'center' },
    { label: 'UN', w: 0.05, align: 'center' },
    { label: 'QTDE', w: 0.07, align: 'right' },
    { label: 'VL. UNIT.', w: 0.09, align: 'right' },
    { label: 'VL. TOTAL', w: 0.09, align: 'right' },
    { label: 'VL. ICMS', w: 0.07, align: 'right' },
    { label: 'ALQ. ICMS', w: 0.07, align: 'right' },
  ]
  let cx = MX
  pdf.setFontSize(5.5)
  pdf.setFont(undefined, 'bold')
  colunas.forEach((c) => {
    const w = c.w * CW
    pdf.text(c.label, c.align === 'right' ? cx + w - 1 : cx + 1, y + 5, { align: c.align === 'right' ? 'right' : 'left' })
    cx += w
  })
  pdf.setLineWidth(0.1)
  pdf.line(MX, y + headerH - 2, MX + CW, y + headerH - 2)
  y += headerH

  pdf.setFont(undefined, 'normal')
  pdf.setFontSize(6)
  const rowH = 5
  const rodapeH = 45 // espaço reservado para dados adicionais + margem
  nfe.itens.forEach((item) => {
    if (y + rowH > PAGE_H - rodapeH) {
      pdf.addPage()
      y = MX
      caixa(pdf, MX, y, CW, headerH, 'DADOS DOS PRODUTOS/SERVIÇOS (CONTINUAÇÃO)')
      y += headerH
    }
    cx = MX
    const valores = [item.cProd, item.xProd, item.NCM, item.CST, item.CFOP, item.uCom, item.qCom, formatMoeda(item.vUnCom), formatMoeda(item.vProd), formatMoeda(item.vICMS), item.pICMS ? `${item.pICMS}%` : '']
    colunas.forEach((c, i) => {
      const w = c.w * CW
      const texto = String(valores[i] || '').toUpperCase()
      pdf.text(texto, c.align === 'right' ? cx + w - 1 : cx + 1, y + 3.5, {
        align: c.align === 'right' ? 'right' : 'left',
        maxWidth: w - 2,
      })
      cx += w
    })
    pdf.setLineWidth(0.05)
    pdf.setDrawColor(150, 150, 150)
    pdf.line(MX, y + rowH, MX + CW, y + rowH)
    pdf.setDrawColor(0, 0, 0)
    y += rowH
  })

  // ---------- Dados adicionais ----------
  const alturaAdic = Math.min(30, PAGE_H - y - MX)
  caixa(pdf, MX, y, CW, alturaAdic, 'DADOS ADICIONAIS — INFORMAÇÕES COMPLEMENTARES')
  pdf.setFontSize(6.5)
  pdf.setFont(undefined, 'normal')
  pdf.text(String(nfe.infAdic?.infCpl || '').toUpperCase(), MX + 2, y + 6, { maxWidth: CW - 4, maxHeight: alturaAdic - 8 })
  if (nfe.protocolo && nfe.protocolo.cStat && nfe.protocolo.cStat !== '100') {
    pdf.setTextColor(180, 0, 0)
    pdf.setFontSize(7)
    pdf.text(`SEM VALOR FISCAL — ${nfe.protocolo.xMotivo || 'STATUS: ' + nfe.protocolo.cStat}`, MX + 2, y + alturaAdic - 3)
    pdf.setTextColor(0, 0, 0)
  }

  return pdf.output('blob')
}

// ============================================================
// Renderização do DANFSe (NFS-e — serviços), padrão nacional v2.0 (NT 008/2026)
// Também usado para NFS-e em formato legado (Ginfes/SPED), com o mesmo
// layout de blocos, omitindo campos que não existem nesses formatos
// (chave de 50 dígitos, IBS/CBS).
// ============================================================

export const generateDANFSePdf = async (nfse, conta) => {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  let y = MX

  const prestNome = comFallback(nfse.prestador?.razaoSocial, conta?.nome_correntista)
  const prestCNPJ = comFallback(nfse.prestador?.cnpjCpf, conta?.cic || conta?.cnpj)
  const prestEnd = nfse.prestador?.endereco

  // ---------- Cabeçalho ----------
  const alturaHeader = 18
  pdf.setFillColor(235, 235, 235)
  pdf.rect(MX, y, CW, alturaHeader, 'F')
  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.15)
  pdf.rect(MX, y, CW, alturaHeader)
  pdf.setFont(undefined, 'bold')
  pdf.setFontSize(13)
  pdf.text('DANFSe', MX + 3, y + 8)
  pdf.setFontSize(7)
  pdf.setFont(undefined, 'normal')
  pdf.text(nfse.subtipo === 'nfse-nacional' ? 'Documento Auxiliar da NFS-e — Padrão Nacional v2.0' : 'Documento Auxiliar da Nota Fiscal de Serviços Eletrônica', MX + 3, y + 13)

  pdf.setFontSize(7)
  pdf.setFont(undefined, 'bold')
  pdf.text(`Nº ${nfse.numero || ''}`, MX + CW - 3, y + 8, { align: 'right' })
  pdf.setFont(undefined, 'normal')
  pdf.setFontSize(6)
  pdf.text(`Emissão: ${formatDataHoraBR(nfse.dataEmissao)}`, MX + CW - 3, y + 12, { align: 'right' })
  if (nfse.competencia) pdf.text(`Competência: ${formatDataBR(nfse.competencia)}`, MX + CW - 3, y + 15.5, { align: 'right' })
  y += alturaHeader

  // ---------- Identificação (chave/código de verificação + QR Code) ----------
  const alturaIdent = 22
  caixa(pdf, MX, y, CW, alturaIdent, 'IDENTIFICAÇÃO DA NFS-e')
  if (nfse.chaveAcesso) {
    campo(pdf, MX + 2, y + 8, 'CHAVE DE ACESSO (50 DÍGITOS)', formatChaveAcesso(nfse.chaveAcesso), { maxWidth: CW - 30 })
  }
  campo(pdf, MX + 2, y + 16, 'CÓDIGO DE VERIFICAÇÃO', nfse.codigoVerificacao)
  campo(pdf, MX + CW * 0.45, y + 16, 'MUNICÍPIO DE PRESTAÇÃO', nfse.municipioPrestacao, { maxWidth: CW * 0.3 })

  // QR Code (>= 1,52cm conforme NT 008/2026) — aponta para consulta pública nacional quando há chave
  if (nfse.chaveAcesso) {
    try {
      const qrUrl = await gerarQRCodeDataURL(`https://www.nfse.gov.br/consultapublica?chave=${nfse.chaveAcesso.replace(/\D/g, '')}`)
      pdf.addImage(qrUrl, 'PNG', MX + CW - 20, y + 2, 18, 18)
    } catch (e) {
      console.warn('[DANFSe] Não foi possível gerar QR Code:', e)
    }
  }
  y += alturaIdent

  // ---------- Prestador ----------
  const alturaPrest = 20
  caixa(pdf, MX, y, CW, alturaPrest, 'PRESTADOR DE SERVIÇOS')
  campo(pdf, MX + 2, y + 6, 'NOME/RAZÃO SOCIAL', prestNome, { maxWidth: CW * 0.55 })
  campo(pdf, MX + CW * 0.6, y + 6, 'CNPJ/CPF', formatCNPJCPF(prestCNPJ))
  campo(pdf, MX + CW * 0.82, y + 6, 'INSC. MUNICIPAL', nfse.prestador?.inscricaoMunicipal)
  campo(pdf, MX + 2, y + 13, 'ENDEREÇO', prestEnd ? enderecoLinha1(prestEnd) : (conta?.endereco || ''), { maxWidth: CW * 0.55 })
  campo(pdf, MX + CW * 0.6, y + 13, 'MUNICÍPIO/UF', prestEnd ? `${prestEnd.xMun || ''}-${prestEnd.UF || ''}` : '')
  campo(pdf, MX + 2, y + 18.5, 'E-MAIL', nfse.prestador?.email)
  campo(pdf, MX + CW * 0.5, y + 18.5, 'TELEFONE', nfse.prestador?.telefone)
  y += alturaPrest

  // ---------- Tomador ----------
  const alturaToma = 20
  caixa(pdf, MX, y, CW, alturaToma, 'TOMADOR DE SERVIÇOS')
  const tomaEnd = nfse.tomador?.endereco
  campo(pdf, MX + 2, y + 6, 'NOME/RAZÃO SOCIAL', nfse.tomador?.razaoSocial, { maxWidth: CW * 0.55 })
  campo(pdf, MX + CW * 0.6, y + 6, 'CNPJ/CPF', formatCNPJCPF(nfse.tomador?.cnpjCpf))
  campo(pdf, MX + CW * 0.82, y + 6, 'INSC. MUNICIPAL', nfse.tomador?.inscricaoMunicipal)
  campo(pdf, MX + 2, y + 13, 'ENDEREÇO', tomaEnd ? enderecoLinha1(tomaEnd) : '', { maxWidth: CW * 0.55 })
  campo(pdf, MX + CW * 0.6, y + 13, 'MUNICÍPIO/UF', tomaEnd ? `${tomaEnd.xMun || ''}-${tomaEnd.UF || ''}` : '')
  campo(pdf, MX + 2, y + 18.5, 'E-MAIL', nfse.tomador?.email)
  campo(pdf, MX + CW * 0.5, y + 18.5, 'TELEFONE', nfse.tomador?.telefone)
  y += alturaToma

  // ---------- Discriminação do Serviço ----------
  const alturaServ = 28
  caixa(pdf, MX, y, CW, alturaServ, 'DISCRIMINAÇÃO DOS SERVIÇOS')
  pdf.setFontSize(6.5)
  pdf.setFont(undefined, 'normal')
  pdf.text(String(nfse.discriminacao || '').toUpperCase(), MX + 2, y + 6, { maxWidth: CW - 4, maxHeight: alturaServ - 8 })
  if (nfse.codigoServico) {
    pdf.setFontSize(5.5)
    pdf.text(`CÓDIGO DO SERVIÇO: ${nfse.codigoServico}`, MX + 2, y + alturaServ - 2)
  }
  y += alturaServ

  // ---------- Tributos / Valores ----------
  const alturaTrib = 30
  caixa(pdf, MX, y, CW, alturaTrib, 'TRIBUTOS MUNICIPAIS (ISSQN)')
  const v = nfse.valores
  const col = CW / 4
  campo(pdf, MX + 2 + col * 0, y + 7, 'VALOR DOS SERVIÇOS', formatMoeda(v.valorServicos))
  campo(pdf, MX + 2 + col * 1, y + 7, 'BASE DE CÁLCULO ISS', formatMoeda(v.baseCalculo))
  campo(pdf, MX + 2 + col * 2, y + 7, 'ALÍQUOTA ISS', v.aliquotaISS ? `${v.aliquotaISS}%` : '')
  campo(pdf, MX + 2 + col * 3, y + 7, 'VALOR DO ISS', formatMoeda(v.valorISS))
  campo(pdf, MX + 2 + col * 0, y + 14, 'ISS RETIDO', v.issRetido ? 'SIM' : 'NÃO')
  campo(pdf, MX + 2 + col * 1, y + 14, 'DEDUÇÕES', formatMoeda(v.valorDeducoes))

  const tf = nfse.tributosFederais
  const temFederais = tf && (tf.pis || tf.cofins || tf.inss || tf.ir || tf.csll)
  if (temFederais) {
    pdf.setFontSize(5.5)
    pdf.text('TRIBUTOS FEDERAIS RETIDOS', MX + 2, y + 20)
    const colf = CW / 5
    campo(pdf, MX + 2 + colf * 0, y + 25, 'PIS', formatMoeda(tf.pis))
    campo(pdf, MX + 2 + colf * 1, y + 25, 'COFINS', formatMoeda(tf.cofins))
    campo(pdf, MX + 2 + colf * 2, y + 25, 'INSS', formatMoeda(tf.inss))
    campo(pdf, MX + 2 + colf * 3, y + 25, 'IR', formatMoeda(tf.ir))
    campo(pdf, MX + 2 + colf * 4, y + 25, 'CSLL', formatMoeda(tf.csll))
  }

  if (nfse.ibsCbs) {
    pdf.setFontSize(5.5)
    pdf.text(`IBS: ${formatMoeda(nfse.ibsCbs.vIBS)} (${nfse.ibsCbs.pIBS || 0}%)   CBS: ${formatMoeda(nfse.ibsCbs.vCBS)} (${nfse.ibsCbs.pCBS || 0}%)`, MX + CW * 0.55, y + 20, { maxWidth: CW * 0.43 })
  }
  y += alturaTrib

  // ---------- Valor Líquido (destaque em cinza, conforme NT 008/2026) ----------
  const alturaLiq = 14
  pdf.setFillColor(235, 235, 235)
  pdf.rect(MX, y, CW, alturaLiq, 'F')
  pdf.setDrawColor(0, 0, 0)
  pdf.rect(MX, y, CW, alturaLiq)
  pdf.setFontSize(7)
  pdf.setFont(undefined, 'normal')
  pdf.text('VALOR LÍQUIDO DA NFS-e' + (nfse.ibsCbs ? ' + IBS/CBS' : ''), MX + 3, y + 6)
  pdf.setFontSize(11)
  pdf.setFont(undefined, 'bold')
  pdf.text(`R$ ${formatMoeda(v.valorLiquido)}`, MX + CW - 3, y + 9.5, { align: 'right' })
  y += alturaLiq

  // ---------- Rodapé: totais aproximados de tributos (Lei 12.741/2012) ----------
  pdf.setFontSize(5.5)
  pdf.setFont(undefined, 'normal')
  const totalTributosAprox = [v.valorISS, tf?.pis, tf?.cofins, tf?.inss, tf?.ir, tf?.csll, nfse.ibsCbs?.vIBS, nfse.ibsCbs?.vCBS]
    .map((n) => parseFloat(String(n || '0').replace(',', '.')) || 0)
    .reduce((a, b) => a + b, 0)
  pdf.text(
    `Totais aproximados de tributos (Lei nº 12.741/2012): R$ ${formatMoeda(totalTributosAprox)} — valor estimado com base nos tributos informados no XML.`,
    MX + 2, y + 4, { maxWidth: CW - 4 }
  )

  return pdf.output('blob')
}

// ============================================================
// Função principal: recebe o texto do XML e o perfil/conta vinculado ao
// boleto, detecta o tipo de documento e gera o PDF correspondente.
// ============================================================

export const generateNotaFiscalPdfFromXML = async (xmlText, conta) => {
  const dados = parseNotaFiscalXML(xmlText)

  if (dados.tipo === 'nfe') {
    const blob = await generateDANFEPdf(dados, conta)
    return { blob, tipo: 'nfe', dados }
  }
  if (dados.tipo === 'nfse') {
    const blob = await generateDANFSePdf(dados, conta)
    return { blob, tipo: 'nfse', dados }
  }
  throw new Error('Tipo de documento fiscal não suportado para geração de PDF.')
}
