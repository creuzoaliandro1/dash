// Leitura do DANFSe (Documento Auxiliar da NFS-e) do Padrão Nacional a partir do
// texto do PDF. O layout é fixo: cada campo tem o RÓTULO numa linha e o VALOR
// logo abaixo, na mesma coluna. Lemos por posição (x/y dos itens do pdf.js),
// dentro de cada bloco (Prestador, Tomador, ...), em vez de por ordem de texto.
//
// Não há XML oficial nesse caminho (a API nacional exige certificado de uma das
// partes da nota); os dados vêm só do PDF.

const norm = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().replace(/\s+/g, ' ').trim()

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
    const munUf = valor('Município/Sigla UF', bloco)
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
