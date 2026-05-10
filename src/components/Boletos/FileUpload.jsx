import { useState } from 'react'
import { processFilesForPreview } from '../../services/importService'

export default function FileUpload({ userId, onShowPreview, onImportError }) {
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)

  const acceptedFormats = [
    '.csv', '.txt', '.xlsx', '.xls',
    '.xml', '.nfe', '.nfse', '.cte', '.mdfe'
  ]

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    await handleFiles(files)
  }

  const handleFileInput = (e) => {
    const files = Array.from(e.target.files)
    handleFiles(files)
  }

  const handleFiles = async (files) => {
    // Validar formatos
    const validFiles = files.filter(file => {
      const ext = '.' + file.name.split('.').pop().toLowerCase()
      return acceptedFormats.includes(ext)
    })

    if (validFiles.length === 0) {
      onImportError('Nenhum arquivo com formato válido foi selecionado.')
      return
    }

    if (validFiles.length < files.length) {
      const skipped = files.length - validFiles.length
      console.warn(`${skipped} arquivo(s) ignorado(s) por formato inválido`)
    }

    setIsLoading(true)
    setUploadProgress({ current: 0, total: validFiles.length })

    try {
      const result = await processFilesForPreview(validFiles)

      // Atualizar progresso
      setUploadProgress(null)

      if (result.errors.length > 0) {
        const errorMessages = result.errors
          .map(e => `${e.fileName}: ${e.message}`)
          .join('\n')
        onImportError(`Erros ao processar arquivos:\n${errorMessages}`)
        return
      }

      if (result.total > 0) {
        onShowPreview(result.data)
      } else {
        onImportError('Nenhum dado válido foi extraído dos arquivos.')
      }
    } catch (error) {
      setUploadProgress(null)
      onImportError('Erro ao processar arquivos: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`bg-[#0a0a0a] border-2 border-dashed rounded-lg p-4 text-center transition ${
        isDragging
          ? 'border-white bg-[#111111]'
          : 'border-[#2a2a2a] hover:border-[#1f1f1f]'
      } ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
    >
      {uploadProgress ? (
        <div className="space-y-3">
          <div className="flex items-center justify-center">
            <div className="animate-spin">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          </div>
          <p className="text-white font-medium">
            Processando {uploadProgress.current} de {uploadProgress.total} arquivo(s)...
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <svg className="w-12 h-12 mx-auto text-[#666666]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <h3 className="text-white font-semibold text-lg mb-2">Importar boletos em lote</h3>
          <p className="text-[#a3a3a3] text-sm mb-4">
            Arraste arquivos ou clique para selecionar • Excel (.xlsx, .xls), CSV (.csv), TXT (.txt) ou nota fiscal XML (NFe, NFSe, CTe, MDFe) • vários ao mesmo tempo
          </p>

          <label className="inline-block">
            <input
              type="file"
              multiple
              accept={acceptedFormats.join(',')}
              onChange={handleFileInput}
              disabled={isLoading}
              className="hidden"
            />
            <span className="px-6 py-2 bg-white text-black text-sm font-medium rounded hover:opacity-90 transition cursor-pointer inline-block">
              Selecionar arquivos
            </span>
          </label>
        </>
      )}
    </div>
  )
}
