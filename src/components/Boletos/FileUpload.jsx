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
      className={`bg-[#0a0a0a] border-2 border-dashed rounded-lg px-6 py-3 transition ${
        isDragging
          ? 'border-white bg-[#111111]'
          : 'border-[#2a2a2a] hover:border-[#333333]'
      } ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
    >
      {uploadProgress ? (
        <div className="flex items-center justify-center gap-3 py-1">
          <div className="animate-spin">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-white text-sm font-medium">
            Processando {uploadProgress.current} de {uploadProgress.total} arquivo(s)...
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <svg className="w-5 h-5 text-[#666666] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
          <div className="flex-1 min-w-0">
            <span className="text-white font-semibold text-sm">Importar boletos em lote</span>
            <span className="text-[#666666] text-xs ml-2 hidden sm:inline">
              Arraste Excel (.xlsx, .xls), CSV (.csv), TXT (.txt) ou XML (NFe, NFSe, CTe, MDFe)
            </span>
          </div>
          <label className="shrink-0">
            <input
              type="file"
              multiple
              accept={acceptedFormats.join(',')}
              onChange={handleFileInput}
              disabled={isLoading}
              className="hidden"
            />
            <span className="px-4 py-1.5 bg-white text-black text-xs font-medium rounded hover:opacity-90 transition cursor-pointer inline-block whitespace-nowrap">
              Selecionar arquivos
            </span>
          </label>
        </div>
      )}
    </div>
  )
}
