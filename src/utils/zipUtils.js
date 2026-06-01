import JSZip from 'jszip'
import { saveAs } from 'file-saver'

export const createAndDownloadZip = async (pdfList, zipFileName = 'boletos.zip') => {
  console.log('[ZIP] Criando ZIP com', pdfList.length, 'PDFs')

  try {
    const zip = new JSZip()

    // Adicionar cada PDF ao ZIP
    for (const pdfItem of pdfList) {
      zip.file(pdfItem.filename, pdfItem.blob)
      console.log('[ZIP] Adicionado ao ZIP:', pdfItem.filename)
    }

    // Gerar o arquivo ZIP
    console.log('[ZIP] Gerando arquivo ZIP...')
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    console.log('[ZIP] ZIP gerado com sucesso, tamanho:', zipBlob.size, 'bytes')

    // Fazer download
    console.log('[ZIP] Iniciando download do ZIP...')
    saveAs(zipBlob, zipFileName)
    console.log('[ZIP] Download iniciado!')

    return zipBlob
  } catch (error) {
    console.error('[ZIP] ERRO ao criar ZIP:', error)
    throw error
  }
}
