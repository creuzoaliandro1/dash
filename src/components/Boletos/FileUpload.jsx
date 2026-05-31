import { useState, useRef } from 'react'
import { processFilesForPreview, processContaCaptFileForBoletos } from '../../services/importService'

export default function FileUpload({ userId, onShowPreview, onImportError, userType, selectedContaId, allContas, contaData, onEfactorToggle, efactorActive }) {
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const fileInputRef = useRef(null)

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

  const handleOpenEfactorModal = () => {
    console.log('[FileUpload] Acionando Efactor...')
    if (onEfactorToggle) {
      onEfactorToggle()
    }
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
      // Obter dados do perfil selecionado para avalista
      let profileName = ''
      let profileCIC = ''

      // Tentar obter de allContas (para Master)
      if (allContas && allContas.length > 0 && selectedContaId) {
        const selectedConta = allContas.find(c => String(c.id) === String(selectedContaId))
        if (selectedConta) {
          profileName = selectedConta.nome_correntista || ''
          profileCIC = selectedConta.cic || selectedConta.cpf_cnpj || selectedConta.cnpj || selectedConta.documento || ''
          console.log(`[FileUpload] ✅ Usando perfil (allContas) para avalista: ${profileName}${profileCIC ? ' (' + profileCIC + ')' : ''}`)
        }
      }

      // Se não encontrou em allContas, tentar usar contaData (para usuários não-Master)
      if (!profileName && !profileCIC && contaData) {
        profileName = contaData.nome_correntista || ''
        profileCIC = contaData.cic || contaData.cpf_cnpj || contaData.cnpj || contaData.documento || ''
        console.log(`[FileUpload] ℹ️ Usando perfil (contaData) para avalista: ${profileName}${profileCIC ? ' (' + profileCIC + ')' : ''}`)
      }

      let result = null

      // Se há apenas um arquivo .xlsx e é provavelmente do Capt Capital
      if (validFiles.length === 1 && validFiles[0].name.endsWith('.xlsx')) {
        const file = validFiles[0]
        try {
          result = await processContaCaptFileForBoletos(file, userType, selectedContaId, profileName, profileCIC)
          // Converter resultado para formato compatível
          result = {
            data: result.data,
            errors: [],
            total: result.total,
          }
        } catch (err) {
          // Se falhar com processamento ContaCapt, tentar processamento genérico
          console.warn('[FileUpload] Processamento ContaCapt falhou, tentando processamento genérico:', err)
          result = await processFilesForPreview(validFiles, profileName, profileCIC)
        }
      } else {
        // Usar processamento genérico para múltiplos arquivos ou outros formatos
        result = await processFilesForPreview(validFiles, profileName, profileCIC)
      }

      // Atualizar progresso
      setUploadProgress(null)

      if (result.errors && result.errors.length > 0) {
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
    <div className="flex items-center gap-3">
      {/* Hidden file input compartilhado (acionado pelo clique no card) */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedFormats.join(',')}
        onChange={handleFileInput}
        disabled={isLoading}
        className="hidden"
      />

      <div
        onClick={() => { if (!isLoading) fileInputRef.current?.click() }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex-1 bg-[#0a0a0a] border-2 border-dashed rounded-lg px-6 py-3 transition cursor-pointer ${
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
          <div className="flex items-center justify-center gap-4">
            <svg className="w-5 h-5 text-[#666666] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            <div className="min-w-0 text-center">
              <span className="text-white font-semibold text-sm">Importar</span>
              <span className="text-[#666666] text-xs ml-2 hidden sm:inline">
                Clique ou arraste Excel, CSV, TXT ou XML
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Botão Efactor — fora do card, apenas para Master */}
      {userType === 'M' && (
        <button
          onClick={handleOpenEfactorModal}
          disabled={isLoading}
          className={`shrink-0 px-4 py-2.5 text-xs font-medium border rounded transition cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${
            efactorActive
              ? 'bg-[#1a7f1a] text-white border-[#2a9a2a] hover:bg-[#1d8a1d]'
              : 'bg-[#1a1a1a] text-white border-[#2a2a2a] hover:bg-[#222222]'
          }`}
          title={efactorActive ? 'Desativar Efactor' : 'Ativar Efactor'}
        >
          {efactorActive ? '✓ Efactor' : 'Efactor'}
        </button>
      )}
    </div>
  )
}
