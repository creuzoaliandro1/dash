import { PDFDocument } from 'pdf-lib'
import { jsPDF } from 'jspdf'
import { renderDuplicataOnDoc, renderCessaoDireitos, render2DuplicatasOnPage, renderCessaoDireitosPageCompleta } from './duplicata'
import { renderFatura, renderFichaCompensacao } from './boleto'
import { generateBorderoPDF } from './bordero'
import { getBorderoData } from '../services/boletoService'

// Mescla uma lista de Blobs de PDF num único PDF de várias páginas (pdf-lib).
async function mergeBlobs(blobs) {
  const merged = await PDFDocument.create()
  for (const b of blobs) {
    if (!b) continue
    const bytes = await b.arrayBuffer()
    const src = await PDFDocument.load(bytes)
    const pages = await merged.copyPages(src, src.getPageIndices())
    pages.forEach(p => merged.addPage(p))
  }
  const out = await merged.save()
  return new Blob([out], { type: 'application/pdf' })
}

/**
 * Monta um único PDF de várias páginas contendo, para cada boleto selecionado,
 * duas páginas:
 *   Página 1: Duplicata (topo, Y=10) + Cessão de Direitos (baixo, Y=150)
 *   Página 2: Fatura (topo, até Y=148) + Ficha de Compensação/Boleto (baixo, Y=183)
 * @returns {Promise<Blob>}
 */
export async function buildDuplicatasBoletosBlob(boletos, contaData) {
  const partes = []
  const FATURA_END_Y = 148
  const BOLETO_START_Y = 183
  const CESSAO_START_Y = 150

  for (const boleto of boletos) {
    // Página 1: apenas Duplicata (sem Cessão de Direitos)
    try {
      const doc1 = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      await renderDuplicataOnDoc(doc1, boleto, contaData)
      partes.push(doc1.output('blob'))
    } catch (e) {
      console.error('[assinaturaDocs] Erro na pág 1 (Duplicata) do boleto', boleto?.id, e)
    }

    // Página 2: Fatura (topo) + Boleto (baixo)
    try {
      const doc2 = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      await renderFatura(doc2, boleto, contaData, FATURA_END_Y)
      await renderFichaCompensacao(doc2, boleto, contaData, BOLETO_START_Y)
      partes.push(doc2.output('blob'))
    } catch (e) {
      console.error('[assinaturaDocs] Erro na pág 2 (Fatura+Boleto) do boleto', boleto?.id, e)
    }
  }
  if (partes.length === 0) throw new Error('Não foi possível gerar nenhuma Duplicata/Boleto.')
  return mergeBlobs(partes)
}

/**
 * Monta o PDF do Borderô da operação dos boletos selecionados.
 * Usa o primeiro boleto que tenha num_lancamento.
 * @returns {Promise<Blob|null>} null se nenhum boleto estiver vinculado a um borderô.
 */
// Retorna { blob, signatureLineY, pageHeight } ou null — usa o primeiro título encontrado.
export async function buildBorderoBlob(boletos) {
  const comLanc = boletos.find(b => b?.num_lancamento)
  if (!comLanc) return null
  const { data, error } = await getBorderoData(comLanc.num_lancamento)
  if (error || !data) {
    console.warn('[assinaturaDocs] Borderô indisponível:', error?.message)
    return null
  }
  return generateBorderoPDF(data) // { blob, signatureLineY, pageHeight }
}

/**
 * Gera UM borderô por COD_OPERACAO único entre os boletos fornecidos.
 * Evita duplicar o mesmo borderô quando vários títulos têm num_lancamento diferentes
 * mas pertencem à mesma operação (COD_OPERACAO no OPECAB).
 * @returns {Promise<Array<{ blob, signatureLineY, pageHeight, codOperacao }>>}
 */
export async function buildBorderoBlobs(boletos) {
  const seenOps = new Set()
  const results = []
  for (const b of boletos) {
    if (!b?.num_lancamento) continue
    const { data, error } = await getBorderoData(b.num_lancamento)
    if (error || !data) continue
    const opKey = data.cabecalho?.COD_OPERACAO
    if (!opKey || seenOps.has(String(opKey))) continue
    seenOps.add(String(opKey))
    const result = generateBorderoPDF(data)
    if (result?.blob) results.push({ ...result, codOperacao: opKey })
  }
  return results
}

/**
 * Monta um PDF completo sem os boletos em si:
 *   Blob 1: Cessão de Direitos + Borderô(s) + primeiras duplicatas (até 10 págs)
 *   Blobs extras: restante das duplicatas (10 págs cada)
 * Cada página de duplicatas contém 2 duplicatas (render2DuplicatasOnPage).
 * @returns {Promise<{ blobs: Blob[], notas: string[] }>}
 */
export async function buildPdfCompletoSemBoletos(boletos, contaData) {
  const notas = []

  // 1. Cessão de direitos como blob
  const docCessao = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  renderCessaoDireitosPageCompleta(docCessao, boletos, contaData)
  const cessaoBlob = docCessao.output('blob')

  // 2. Borderôs — um por COD_OPERACAO único (evita duplicar borderos do mesmo lote)
  const borderoResults = await buildBorderoBlobs(boletos)
  const borderoBlobs = borderoResults.map(r => r.blob)

  // 3. Duplicatas 2 por página como blobs individuais
  const dupBlobs = []
  for (let i = 0; i < boletos.length; i += 2) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    await render2DuplicatasOnPage(doc, boletos[i], boletos[i + 1] || null, contaData)
    dupBlobs.push(doc.output('blob'))
  }

  // 4. Montar blobs de até 10 páginas cada
  // Página 1 = cessão (1 pág), borderos (N pags), depois duplicatas
  const nBorderos = borderoBlobs.length
  const paginasBase = 1 + nBorderos // cessão + borderos
  const paginasParaDupsNoBlob1 = Math.max(0, 10 - paginasBase)

  const finalBlobs = []

  // Blob 1: cessão + borderos + primeiras duplicatas
  const primeiraParte = [cessaoBlob, ...borderoBlobs, ...dupBlobs.slice(0, paginasParaDupsNoBlob1)]
  finalBlobs.push(await mergeBlobs(primeiraParte))

  // Blobs extras: 10 páginas de duplicatas cada (cada blob = 10 dupBlobs = 20 duplicatas)
  const dupBlobsRestantes = dupBlobs.slice(paginasParaDupsNoBlob1)
  for (let i = 0; i < dupBlobsRestantes.length; i += 10) {
    finalBlobs.push(await mergeBlobs(dupBlobsRestantes.slice(i, i + 10)))
  }

  return { blobs: finalBlobs, notas }
}
