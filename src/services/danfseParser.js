// Leitura do DANFSe (Documento Auxiliar da NFS-e) do Padrão Nacional a partir do
// texto do PDF. O layout é fixo: cada campo tem o RÓTULO numa linha e o VALOR
// logo abaixo, na mesma coluna. Lemos por posição (x/y dos itens do pdf.js),
// dentro de cada bloco (Prestador, Tomador, ...), em vez de por ordem de texto.
//
// Não há XML oficial nesse caminho (a API nacional exige certificado de uma das
// partes da nota); os dados vêm só do PDF.

const norm = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().replace(/\s+/g, ' ').replace(/\s*\/\s*/g, '/').trim() // "CNPJ / CPF" = "CNPJ/CPF" (varia por município)

// Rótulos do DANFSe (nunca são valores)
const ROTULOS = new Set([
  'CHAVE DE ACESSO DA NFS-E', 'NUMERO DA NFS-E', 'COMPETENCIA DA NFS-E', 'DATA E HORA DA EMISSAO DA NFS-E',
  'NUMERO DA DPS', 'SERIE DA DPS', 'DATA E HORA DA EMISSAO DA DPS', 'EMITENTE DA NFS-E', 'SITUACAO DA NFS-E',
  'FINALIDADE', 'PRESTADOR/FORNECEDOR', 'TOMADOR/ADQUIRENTE', 'DESTINATARIO', 'INTERMEDIARIO',
  'CNPJ/CPF/NIF', 'INDICADOR MUNICIPAL (INSCRICAO)', 'TELEFONE', 'NOME/NOME EMPRESARIAL', 'MUNICIPIO/SIGLA UF',
  'CODIGO IBGE/CEP', 'ENDERECO', 'E-MAIL', 'SIMPLES NACIONAL DA DATA DE COMPETENCIA',
  'REGIME DE APURACAO TRIBUTARIA PELO SN', 'SERVICO PRESTADO', 'CODIGO DE TRIBUTACAO', 'CODIGO DA NBS',
  'LOCAL DA PRESTACAO/SIGLA UF/PAIS', 'DESCRICAO DO SERVICO', 'VALOR TOTAL DA NFS-E', 'VALOR DA OPERACAO/SERVICO',
  'VALOR LIQUIDO DA NFS-E', 'VALOR LIQUIDO DA NFS-E + IBS/CBS', 'RETENCAO DO ISSQN', 'INFORMACOES COMPLEMENTARES',
])
const ehRotulo = (s) => ROTULOS.has(norm(s))

// Cabeçalhos que abrem blocos (na coluna da esquerda)
const BLOCOS = ['PRESTADOR/FORNECEDOR', 'TOMADOR/ADQUIRENTE', 'DESTINATARIO', 'INTERMEDIARIO', 'SERVICO PRESTADO',
  'TRIBUTACAO MUNICIPAL', 'TRIBUTACAO FEDERAL', 'TRIBUTACAO IBS/CBS', 'VALOR TOTAL DA NFS-E', 'INFORMACOES COMPLEMENTARES']

const limpo = (v) => {
  const s = String(v || '').trim()
  return /^[-*.\s]*$/.test(s) ? '' : s
}

function lerPagina(itens) {
  const its = itens
    .filter(i => i.str && i.str.trim())
    .map(i => ({ s: i.str.trim(), n: norm(i.str), x: i.transform[4], y: i.transform[5] }))

  // y de início de cada bloco (PDF: y maior = mais alto na página)
  const cabecalhos = its
    .filter(i => BLOCOS.some(b => i.n.startsWith(b)))
    .map(i => ({ nome: BLOCOS.find(b => i.n.startsWith(b)), y: i.y }))
    .sort((a, b) => b.y - a.y)
  const faixa = (bloco) => {
    const k = cabecalhos.findIndex(c => c.nome === bloco)
    if (k < 0) return null
    return { topo: cabecalhos[k].y + 1, base: k + 1 < cabecalhos.length ? cabecalhos[k + 1].y + 1 : -Infinity }
  }

  // valor logo abaixo do rótulo, na mesma coluna (opcionalmente dentro de um bloco)
  const valor = (rotulo, bloco) => {
    const f = bloco ? faixa(bloco) : { topo: Infinity, base: -Infinity }
    if (!f) return ''
    const r = its.find(i => i.n === norm(rotulo) && i.y <= f.topo && i.y > f.base)
    if (!r) return ''
    const abaixo = its
      .filter(i => Math.abs(i.x - r.x) <= 8 && r.y - i.y > 3 && r.y - i.y < 16 && !ehRotulo(i.s))
      .sort((a, b) => b.y - a.y)
    return limpo(abaixo[0]?.s)
  }

  const chave = (its.find(i => /^\d{50}$/.test(i.s)) || {}).s
    || ((its.map(i => i.s).join(' ').match(/\b\d{50}\b/) || [])[0]) || ''

  const parte = (bloco) => {
    if (!faixa(bloco)) return null
    const ender = valor('Endereço', bloco)
    const munUf = valor('Município/Sigla UF', bloco).replace(/\s*\/\s*/g, '/') // "Mossoró / RN"
    const ibgeCep = valor('Código IBGE/CEP', bloco)
    // "R JOAQUIM BARROSO, 192, ****, AEROLÂNDIA" = logradouro, número, [complemento], bairro
    const p = ender.split(',').map(limpo)
    const [lgr = '', nro = '', ...resto] = p
    const bairro = resto.length ? resto[resto.length - 1] : ''
    const compl = resto.slice(0, -1).filter(Boolean).join(', ')
    const mu = munUf.match(/^(.*)\/([A-Z]{2})$/i)
    return {
      SACADO_NOME: valor('Nome/Nome Empresarial', bloco),
      SACADO_CIC: valor('CNPJ/CPF/NIF', bloco).replace(/\D/g, ''),
      SACADO_TELEFONE: valor('Telefone', bloco),
      SACADO_EMAIL: valor('E-mail', bloco),
      SACADO_ENDERECO: lgr,
      SACADO_NUMERO: nro,
      SACADO_COMPLEMENTO: compl,
      SACADO_BAIRRO: bairro,
      SACADO_CIDADE: mu ? mu[1].trim() : munUf,
      SACADO_UF: mu ? mu[2].toUpperCase() : '',
      SACADO_CEP: (ibgeCep.split('/')[1] || '').replace(/\D/g, ''),
    }
  }

  // Descrição do Serviço: linhas da coluna esquerda até o bloco seguinte
  const rDesc = its.find(i => i.n === 'DESCRICAO DO SERVICO')
  let descricao = ''
  if (rDesc) {
    const prox = cabecalhos.find(c => c.y < rDesc.y)
    descricao = its
      .filter(i => i.y < rDesc.y - 1 && (!prox || i.y > prox.y + 1) && i.x < 200)
      .sort((a, b) => b.y - a.y || a.x - b.x)
      .map(i => i.s).join('\n')
  }

  const emissao = (valor('Data e Hora da Emissão da NFS-e').match(/\d{2}\/\d{2}\/\d{4}/) || [])[0] || ''
  return {
    chave,
    numero: valor('Número da NFS-e'),
    emissao,
    situacao: valor('Situação da NFS-e'),
    valorLiquido: valor('VALOR LÍQUIDO DA NFS-e'),
    valorServico: valor('VALOR DA OPERAÇÃO/SERVIÇO'),
    descricao,
    prestador: parte('PRESTADOR/FORNECEDOR'),
    tomador: parte('TOMADOR/ADQUIRENTE'),
  }
}

// ---------------------------------------------------------------------------
// NFS-e em layout MUNICIPAL ("Rótulo: valor"), ex.: Caucaia/CE. Blocos
// "PRESTADOR DE SERVIÇOS" e "TOMADOR DE SERVIÇOS" com linhas como
//   "CPF/CNPJ: 11.516.329/0001-26   Inscrição Municipal:"
//   "Endereço: R CONSULMEL 1277 PARQUE POTIRA 61.650-370"
// ---------------------------------------------------------------------------
const ROTULOS_MUN = [
  'CPF/CNPJ', 'CNPJ/CPF', 'CNPJ', 'CPF', 'Inscrição Municipal', 'Inscrição Estadual', 'Razão Social/Nome',
  'Nome/Razão Social', 'Razão Social', 'Nome Fantasia', 'Nome', 'Endereço', 'Logradouro', 'Número', 'Complemento',
  'Bairro', 'CEP', 'Município', 'Cidade', 'UF', 'e-mail', 'E-mail', 'Email', 'Telefone', 'Fone',
]
const ROTULOS_MUN_N = new Set(ROTULOS_MUN.map(norm))
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
// "CPF/CNPJ:" ou "CPF/CNPJ: 11.516..." (rótulo e valor no mesmo item)
const RE_ROT_ITEM = new RegExp(`^(${[...ROTULOS_MUN_N].map(escRe).sort((a, b) => b.length - a.length).join('|')})\\s*:\\s*(.*)$`)

// { ROTULO_NORMALIZADO: valor } dos itens (pdf.js) de um bloco. O valor é o que
// está na mesma faixa horizontal do rótulo (às vezes 1–3pt abaixo), à direita
// dele e antes do próximo rótulo dessa faixa.
function camposPorPosicao(its) {
  const rot = []
  for (const i of its) {
    const m = i.n.match(RE_ROT_ITEM)
    if (m) rot.push({ ...i, rot: m[1], resto: m[2] })
  }
  const ehRot = (i) => rot.some(r => r.x === i.x && r.y === i.y)
  const campos = {}
  for (const r of rot) {
    if (campos[r.rot]) continue
    const prox = rot.filter(o => o !== r && Math.abs(o.y - r.y) <= 4.5 && o.x > r.x).reduce((mn, o) => Math.min(mn, o.x), Infinity)
    const vals = its
      .filter(i => Math.abs(i.y - r.y) <= 4.5 && i.x > r.x - 2 && i.x < prox - 1 && !ehRot(i))
      .sort((a, b) => b.y - a.y || a.x - b.x)
      .map(i => i.s)
    const v = limpo([r.resto && its.find(i => i.x === r.x && i.y === r.y).s.split(':').slice(1).join(':').trim(), ...vals].filter(Boolean).join(' '))
    if (v) campos[r.rot] = v
  }
  return campos
}

const CEP_RE = /(\d{2}\.?\d{3}-?\d{3})\s*$/

// "R CONSULMEL 1277 PARQUE POTIRA 61.650-370" -> logradouro, número, resto (+ CEP no fim)
function quebrarEndereco(texto) {
  let s = String(texto || '').trim()
  let cep = ''
  const mc = s.match(CEP_RE)
  if (mc) { cep = mc[1].replace(/\D/g, ''); s = s.slice(0, mc.index).trim() }
  if (s.includes(',')) {
    const [lgr = '', nro = '', ...resto] = s.split(',').map(limpo)
    return { lgr, nro, resto: resto.filter(Boolean).join(', '), cep }
  }
  const t = s.split(/\s+/)
  // número = 1º token (depois do primeiro) só com dígitos ou S/N
  const k = t.findIndex((tok, i) => i > 0 && /^(\d+[A-Z]?|S\/?N)$/i.test(tok))
  if (k < 0) return { lgr: s, nro: '', resto: '', cep }
  return { lgr: t.slice(0, k).join(' '), nro: t[k].toUpperCase(), resto: t.slice(k + 1).join(' '), cep }
}

function parteMunicipal(its) {
  const c = camposPorPosicao(its)
  const pega = (...ks) => { for (const k of ks) if (c[norm(k)]) return c[norm(k)]; return '' }
  const end = quebrarEndereco(pega('Endereço', 'Logradouro'))
  const bairroCampo = pega('Bairro')
  return {
    SACADO_NOME: pega('Razão Social/Nome', 'Nome/Razão Social', 'Razão Social', 'Nome'),
    NOME_FANTASIA: pega('Nome Fantasia'),
    SACADO_CIC: pega('CPF/CNPJ', 'CNPJ/CPF', 'CNPJ', 'CPF').replace(/\D/g, ''),
    SACADO_TELEFONE: pega('Telefone', 'Fone'),
    SACADO_EMAIL: pega('e-mail', 'Email'),
    SACADO_ENDERECO: end.lgr,
    SACADO_NUMERO: pega('Número') || end.nro,
    // com campo Bairro próprio, o que sobra do endereço é complemento; sem ele, é o bairro
    SACADO_COMPLEMENTO: pega('Complemento') || (bairroCampo ? end.resto : ''),
    SACADO_BAIRRO: bairroCampo || end.resto,
    SACADO_CIDADE: pega('Município', 'Cidade'),
    SACADO_UF: (pega('UF').match(/[A-Z]{2}/i) || [''])[0].toUpperCase(),
    SACADO_CEP: (pega('CEP') || end.cep).replace(/\D/g, ''),
  }
}

// Número da NFS-e dentro da chave nacional (50 dígitos):
// cMun(7) ambGer(1) tpInsc(1) inscFed(14) nNFSe(13) AAMM(4) cód(9) DV(1)
const numeroDaChave = (chave) => (/^\d{50}$/.test(chave) ? String(Number(chave.slice(23, 36))) : '')

/**
 * Lê NFS-e em layout municipal ("Rótulo: valor"), 1ª página do PDF.
 * @param {object} pdf - documento pdf.js
 * @param {string} texto - texto do PDF em linhas (extractTextFromPDF)
 * @returns {Promise<object|null>} nota no mesmo formato de extrairDanfses, ou null
 */
export async function extrairNfseMunicipal(pdf, texto) {
  const t = String(texto || '')
  const T = norm(t)
  if (!/NFS-?E|NOTA FISCAL (ELETRONICA )?DE SERVICO/.test(T) || !/PRESTADOR/.test(T) || !/TOMADOR/.test(T)) return null

  const { items } = await (await pdf.getPage(1)).getTextContent()
  const its = items
    .filter(i => i.str && i.str.trim())
    .map(i => ({ s: i.str.trim(), n: norm(i.str), x: i.transform[4], y: i.transform[5] }))
  const cab = (re, abaixoDe = Infinity) => its.filter(i => i.y < abaixoDe && re.test(i.n)).sort((a, b) => b.y - a.y)[0]
  const hPrest = cab(/^(DADOS DO )?PRESTADOR( DE| DOS)?( SERVICOS?)?$/)
  const hToma = hPrest && cab(/^(DADOS DO )?TOMADOR( DE| DOS)?( SERVICOS?)?$/, hPrest.y)
  if (!hPrest || !hToma) return null
  const hFim = cab(/^(DISCRIMINACAO|INTERMEDIARIO|DESCRICAO|SERVICOS? PRESTADOS?|DETALHAMENTO|TRIBUTOS)/, hToma.y)
  const entre = (topo, base) => its.filter(i => i.y < topo - 1 && i.y > base)
  const prestador = parteMunicipal(entre(hPrest.y, hToma.y))
  const tomador = parteMunicipal(entre(hToma.y, hFim ? hFim.y : -Infinity))
  if (!tomador.SACADO_NOME && !tomador.SACADO_CIC) return null

  const linhas = t.split('\n')
  const idx = (re, de = 0) => { for (let i = de; i < linhas.length; i++) if (re.test(norm(linhas[i]))) return i; return -1 }

  // Discriminação: do título até a próxima seção (código de serviço/tributos/valores)
  let descricao = ''
  const iDisc = idx(/^DISCRIMINACAO (DE|DOS) SERVICOS?|^DESCRICAO (DE|DOS) SERVICOS?/)
  if (iDisc >= 0) {
    const iFimDisc = idx(/^(CODIGO|TRIBUTOS|DETALHAMENTO|VALOR|ITEM DA LISTA|ATIVIDADE)/, iDisc + 1)
    descricao = linhas.slice(iDisc + 1, iFimDisc < 0 ? iDisc + 15 : iFimDisc).map(l => l.trim()).filter(Boolean).join('\n')
  }

  const chave = (t.replace(/[ .]/g, '').match(/\d{50}/) || [''])[0]
  const numNota = (t.match(/N[uú]mero da (?:Nota|NFS-?e)[^\d\n]*\n?[^\d\n]*?(\d{1,15})\b/i) || [])[1] || ''
  const emissao = (t.match(/Emiss[aã]o[^\d\n]{0,40}(\d{2}\/\d{2}\/\d{4})/i) || [])[1] || ''
  const vLiq = (t.match(/Valor\s+L[ií]quido[^\d\n]{0,30}([\d.]+,\d{2})/i) || [])[1] || ''
  const vServ = (t.match(/Valor\s+(?:dos\s+)?Servi[cç]os[^\d\n]{0,30}([\d.]+,\d{2})/i) || [])[1] || ''

  return {
    chave,
    numero: numeroDaChave(chave) || numNota,
    emissao,
    valorLiquido: vLiq,
    valorServico: vServ,
    descricao,
    prestador,
    tomador,
  }
}

/**
 * Lê os DANFSe (Padrão Nacional) de um PDF já aberto no pdf.js.
 * Cada página com "CHAVE DE ACESSO DA NFS-E" é uma nota.
 * @returns {Promise<Array>} notas encontradas (vazio se não for DANFSe com texto)
 */
export async function extrairDanfses(pdf) {
  const notas = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const { items } = await page.getTextContent()
    if (!items.some(it => norm(it.str) === 'CHAVE DE ACESSO DA NFS-E')) continue
    const nota = lerPagina(items)
    if (nota.numero && nota.tomador) notas.push(nota)
  }
  return notas
}
