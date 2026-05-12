import { useState } from 'react'

export default function ContaCaptUpload({ onShowPreview }) {
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const mapExcelToBoleto = (excelRow) => {
    // Mapear colunas do Excel para campos de boleto
    const row = {
      NUMERO_DOCUMENTO: excelRow['Número do documento'] || '',
      SACADO_NOME: excelRow['Nome do pagador'] || '',
      SACADO_CIC: excelRow['Documento federal do pagador'] || '',
      SACADO_CEP: excelRow['CEP do pagador'] || '',
      SACADO_ENDERECO: excelRow['Logradouro do pagador'] || '',
      SACADO_NUMERO: excelRow['Número do endereço do pagador'] || '',
      SACADO_COMPLEMENTO: excelRow['Complemento do endereço do pagador'] || '',
      SACADO_CIDADE: excelRow['Cidade do pagador'] || '',
      SACADO_UF: excelRow['UF do pagador'] || '',
      SACADO_EMAIL: excelRow['Email do pagador'] || '',
      SACADO_TELEFONE: excelRow['Telefone do pagador'] || '',
      NOSSO_NUMERO: excelRow['Nosso número'] || '',
      VALOR: excelRow['Valor do título'] || 0,
      EMISSAO: excelRow['Data de emissão'] || '',
      VENCIMENTO: excelRow['Data de vencimento'] || '',
      AVALISTA_NOME: excelRow['Beneficiário final (sacador avalista)'] || '',
      DESCRICAO: excelRow['Descrição'] || '',
      STATUS: mapStatus(excelRow['Status do boleto']),
    }
    return row
  }

  const mapStatus = (excelStatus) => {
    if (!excelStatus) return 'pendente'
    const status = String(excelStatus).toLowerCase().trim()
    if (status.includes('pago')) return 'pago'
    if (status.includes('vencer')) return 'pendente'
    if (status.includes('atraso')) return 'atrasado'
    if (status.includes('cancel')) return 'cancelado'
    return 'pendente'
  }

  const processFile = async (file) => {
    if (!file) return

    // Validar tipo de arquivo
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setError('Por favor, selecione um arquivo Excel (.xlsx ou .xls)')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Carregar biblioteca XLSX dinamicamente
      if (!window.XLSX) {
        const script = document.createElement('script')
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.min.js'
        script.async = true

        await new Promise((resolve, reject) => {
          script.onload = resolve
          script.onerror = reject
          document.head.appendChild(script)
        })
      }

      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result)
          const workbook = window.XLSX.read(data, { type: 'array' })
          const sheet = workbook.Sheets[workbook.SheetNames[0]]
          const jsonData = window.XLSX.utils.sheet_to_json(sheet)

          if (jsonData.length === 0) {
            setError('O arquivo está vazio')
            setIsLoading(false)
            return
          }

          // Mapear dados do Excel para formato de boleto
          const mappedData = jsonData
            .map(row => mapExcelToBoleto(row))
            .filter(row => row.SACADO_NOME)

          if (mappedData.length === 0) {
            setError('Nenhum dado válido encontrado no arquivo')
            setIsLoading(false)
            return
          }

          onShowPreview(mappedData)
          setIsLoading(false)
        } catch (error) {
          setError('Erro ao processar arquivo: ' + error.message)
          setIsLoading(false)
        }
      }

      reader.onerror = () => {
        setError('Erro ao ler o arquivo')
        setIsLoading(false)
      }

      reader.readAsArrayBuffer(file)
    } catch (err) {
      setError('Erro ao carregar biblioteca: ' + err.message)
      setIsLoading(false)
    }
  }

  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      processFile(files[0])
    }
  }

  const handleFileSelect = (e) => {
    const files = e.target.files
    if (files.length > 0) {
      processFile(files[0])
    }
  }

  return (
    <div className="space-y-4">
      {/* Upload Card */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-lg p-12 text-center transition ${
          isDragging
            ? 'border-white bg-[#111111]'
            : 'border-[#2a2a2a] bg-[#0f0f0f] hover:border-[#3a3a3a]'
        }`}
      >
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileSelect}
          className="absolute inset-0 opacity-0 cursor-pointer"
          disabled={isLoading}
        />

        <div className="space-y-3">
          <div className="flex justify-center">
            <svg
              className={`w-12 h-12 transition ${isDragging ? 'text-white' : 'text-[#666666]'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </div>

          {isLoading ? (
            <>
              <p className="text-white font-medium">Processando arquivo...</p>
              <p className="text-[#666666] text-sm">Por favor, aguarde</p>
            </>
          ) : (
            <>
              <p className="text-white font-medium">
                Arraste um arquivo Excel aqui ou clique para selecionar
              </p>
              <p className="text-[#666666] text-sm">
                Formatos aceitos: .xlsx, .xls
              </p>
            </>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-[#1a1a1a] border border-[#404040] rounded text-[#ff6b6b] text-sm">
          {error}
        </div>
      )}

      {/* Info Card */}
      <div className="p-4 bg-[#111111] border border-[#2a2a2a] rounded">
        <p className="text-[#a3a3a3] text-sm">
          <strong>ℹ️ Dica:</strong> Use o relatório de gestão de boletos exportado da Capt Capital.
          O sistema irá mapear automaticamente os campos e permitir revisão antes de importar.
        </p>
      </div>
    </div>
  )
}
