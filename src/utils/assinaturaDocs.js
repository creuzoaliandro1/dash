import { PDFDocument } from 'pdf-lib'
import { generateDuplicataPDF } from './duplicata'
import { generateSingleBoletoPDF } from './boleto'
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
 * a Duplicata seguida do Boleto.
 * @returns {Promise<Blob>}
 */
export async function buildDuplicatasBoletosBlob(boletos, contaData) {
  const partes = []
  for (const boleto of boletos) {
    try {
      const dup = await generateDuplicataPDF(boleto, contaData, null)
      partes.push(dup)
    } catch (e) {
      console.error('[assinaturaDocs] Erro na Duplicata do boleto', boleto?.id, e)
    }
    try {
      const bol = await generateSingleBoletoPDF(boleto, contaData)
      partes.push(bol)
    } catch (e) {
      console.error('[assinaturaDocs] Erro no Boleto', boleto?.id, e)
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
// Retorna { blob, signatureLineY, pageHeight } ou null.
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
