import { PDFDocument } from 'pdf-lib'
import { jsPDF } from 'jspdf'
import { renderDuplicataOnDoc, renderCessaoDireitos } from './duplicata'
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
    // Página 1: Duplicata (topo) + Cessão de Direitos (baixo)
    try {
      const doc1 = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      await renderDuplicataOnDoc(doc1, boleto, contaData)
      renderCessaoDireitos(doc1, boleto, contaData, CESSAO_START_Y)
      partes.push(doc1.output('blob'))
    } catch (e) {
      console.error('[assinaturaDocs] Erro na pág 1 (Duplicata+Cessão) do boleto', boleto?.id, e)
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
