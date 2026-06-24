import { useState, useEffect } from 'react'
import { getAnexosBoleto, getDownloadUrlAnexo } from '../../services/boletoService'

const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  let date
  if (typeof dateStr === 'string') {
    if (dateStr.includes('/')) {
      const [day, month, year] = dateStr.split('/')
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    } else if (dateStr.includes('-')) {
      const [year, month, day] = dateStr.split('-')
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    } else {
      return dateStr
    }
  } else {
    date = new Date(dateStr)
  }
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = String(date.getFullYear()).slice(-2)
  return `${day}/${month}/${year}`
}

const formatCurrency = (value) => {
  const num = parseFloat(value) || 0
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const formatBytes = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

export default function BoletoDetailsModal({ boleto, isOpen, onClose }) {
  const [anexos, setAnexos] = useState([])
  const [isLoadingAnexos, setIsLoadingAnexos] = useState(false)
  const [viewMode, setViewMode] = useState('details') // 'details' ou 'preview'
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileUrl, setFileUrl] = useState(null)
  const [fileContent, setFileContent] = useState(null)
  const [fileType, setFileType] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen && boleto?.id) {
      loadAnexos()
    }
  }, [isOpen, boleto?.id])

  const loadAnexos = async () => {
    setIsLoadingAnexos(true)
    const { data } = await getAnexosBoleto(boleto.id)
    setAnexos(data || [])
    setIsLoadingAnexos(false)
  }

  const handleDownload = async (anexo) => {
    const { data: urlSignada, error } = await getDownloadUrlAnexo(anexo.caminho_storage)
    if (error) {
      alert('Erro ao gerar download: ' + error.message)
      return
    }
    window.open(urlSignada, '_blank')
  }

  const handleViewFile = async (anexo) => {
    const fileName = anexo.nome_arquivo.toLowerCase()
    let type = null

    if (fileName.endsWith('.pdf')) {
      type = 'pdf'
    } else if (fileName.endsWith('.xml')) {
      type = 'xml'
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      type = 'excel'
    } else {
      alert('Preview não disponível para este tipo de arquivo')
      return
    }

    setError(null)
    setFileContent(null)
    setFileUrl(null)

    const { data: urlSignada, error: urlError } = await getDownloadUrlAnexo(anexo.caminho_storage)
    if (urlError) {
      setError('Erro ao carregar arquivo: ' + urlError.message)
      return
    }

    setSelectedFile(anexo)
    setFileType(type)

    if (type === 'pdf') {
      setFileUrl(urlSignada)
      setViewMode('preview')
    } else if (type === 'xml') {
      try {
        const response = await fetch(urlSignada)
        const text = await response.text()
        setFileContent(text)
        setViewMode('preview')
      } catch (err) {
        setError('Erro ao carregar XML: ' + err.message)
      }
    } else if (type === 'excel') {
      setFileContent('Excel')
      setViewMode('preview')
    }
  }

  if (!isOpen || !boleto) return null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-[#2a2a2a] bg-[#0a0a0a]">
          <h2 className="text-white text-xl font-medium">
            {viewMode === 'details' ? 'Detalhes do Boleto' : `Preview - ${selectedFile?.nome_arquivo}`}
          </h2>
          <button
            onClick={onClose}
            className="text-[#666666] hover:text-white transition text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {viewMode === 'preview' ? (
            <div className="space-y-4">
              <button
                onClick={() => setViewMode('details')}
                className="px-4 py-2 bg-[#2a2a2a] text-white rounded hover:bg-[#3a3a3a] transition"
              >
                ← Voltar para Detalhes
              </button>

              {error && (
                <div className="p-4 bg-[#3d1f1f] text-[#ff6b6b] rounded">
                  {error}
                </div>
              )}

              {fileType === 'pdf' && fileUrl && (
                <iframe
                  src={fileUrl}
                  className="w-full h-[600px] border border-[#2a2a2a] rounded"
                  title="PDF Preview"
                />
              )}

              {fileType === 'xml' && fileContent && (
                <pre className="bg-[#111111] border border-[#2a2a2a] rounded p-4 text-[#51cf66] text-sm overflow-auto max-h-[600px] font-mono">
                  {fileContent}
                </pre>
              )}

              {fileType === 'excel' && (
                <div className="p-6 bg-[#111111] border border-[#2a2a2a] rounded text-center">
                  <p className="text-[#a3a3a3]">📊 Preview de Excel não está disponível</p>
                  <p className="text-[#666666] text-sm mt-2">Use o botão de download para abrir o arquivo</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Informações do Boleto */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[#666666] text-sm">Número do Documento</label>
                  <p className="text-white font-medium">{boleto.numero_documento || '—'}</p>
                </div>
                <div>
                  <label className="text-[#666666] text-sm">Nosso Número</label>
                  <p className="text-white font-medium">{boleto.nosso_numero || '—'}</p>
                </div>
                <div>
                  <label className="text-[#666666] text-sm">Data de Emissão</label>
                  <p className="text-white font-medium">{formatDate(boleto.data_emissao)}</p>
                </div>
                <div>
                  <label className="text-[#666666] text-sm">Data de Vencimento</label>
                  <p className="text-white font-medium">{formatDate(boleto.data_vencimento)}</p>
                </div>
                <div>
                  <label className="text-[#666666] text-sm">Valor</label>
                  <p className="text-white font-medium">R$ {formatCurrency(boleto.valor)}</p>
                </div>
                <div>
                  <label className="text-[#666666] text-sm">Juros</label>
                  <p className="text-white font-medium">R$ {formatCurrency(boleto.juros)}</p>
                </div>
                <div>
                  <label className="text-[#666666] text-sm">Status</label>
                  <p className="text-white font-medium capitalize">{boleto.status || '—'}</p>
                </div>
                <div>
                  <label className="text-[#666666] text-sm">Situação</label>
                  <p className="text-white font-medium">{boleto.situacao || '—'}</p>
                </div>
              </div>

              {/* Dados do Sacado */}
              <div className="border-t border-[#2a2a2a] pt-4">
                <h3 className="text-white font-medium mb-4">Dados do Sacado</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[#666666] text-sm">Nome</label>
                    <p className="text-white">{boleto.sacado_nome || '—'}</p>
                  </div>
                  <div>
                    <label className="text-[#666666] text-sm">CIC/CPF</label>
                    <p className="text-white">{boleto.sacado_cic || '—'}</p>
                  </div>
                  <div>
                    <label className="text-[#666666] text-sm">Endereço</label>
                    <p className="text-white">{boleto.sacado_endereco || '—'}</p>
                  </div>
                  <div>
                    <label className="text-[#666666] text-sm">Bairro</label>
                    <p className="text-white">{boleto.sacado_bairro || '—'}</p>
                  </div>
                  <div>
                    <label className="text-[#666666] text-sm">Cidade</label>
                    <p className="text-white">{boleto.sacado_cidade || '—'}</p>
                  </div>
                  <div>
                    <label className="text-[#666666] text-sm">UF</label>
                    <p className="text-white">{boleto.sacado_uf || '—'}</p>
                  </div>
                  <div>
                    <label className="text-[#666666] text-sm">CEP</label>
                    <p className="text-white">{boleto.sacado_cep || '—'}</p>
                  </div>
                  <div>
                    <label className="text-[#666666] text-sm">Telefone</label>
                    <p className="text-white">{boleto.sacado_telefone || '—'}</p>
                  </div>
                  <div>
                    <label className="text-[#666666] text-sm">Email</label>
                    <p className="text-white">{boleto.sacado_email || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Dados do Avalista */}
              {(boleto.avalista_nome || boleto.avalista_cic) && (
                <div className="border-t border-[#2a2a2a] pt-4">
                  <h3 className="text-white font-medium mb-4">Dados do Avalista</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[#666666] text-sm">Nome</label>
                      <p className="text-white">{boleto.avalista_nome || '—'}</p>
                    </div>
                    <div>
                      <label className="text-[#666666] text-sm">CIC/CPF</label>
                      <p className="text-white">{boleto.avalista_cic || '—'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Código de Barras */}
              {boleto.codigo_barras && (
                <div className="border-t border-[#2a2a2a] pt-4">
                  <label className="text-[#666666] text-sm">Código de Barras</label>
                  <p className="text-white font-mono text-sm break-all">{boleto.codigo_barras}</p>
                </div>
              )}

              {/* Anexos */}
              <div className="border-t border-[#2a2a2a] pt-4">
                <h3 className="text-white font-medium mb-4">📎 Arquivos Anexados</h3>
                {isLoadingAnexos ? (
                  <p className="text-[#666666] text-sm">Carregando anexos...</p>
                ) : anexos.length === 0 ? (
                  <p className="text-[#666666] text-sm">Nenhum arquivo anexado</p>
                ) : (
                  <div className="space-y-2">
                    {anexos.map((anexo) => (
                      <div
                        key={anexo.id}
                        className="flex items-center justify-between p-3 bg-[#111111] border border-[#2a2a2a] rounded"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{anexo.nome_arquivo}</p>
                          <p className="text-[#666666] text-xs">
                            {formatBytes(anexo.tamanho_bytes)} • {formatDate(anexo.data_upload)}
                          </p>
                        </div>
                        <div className="flex gap-2 ml-4 flex-shrink-0">
                          <button
                            onClick={() => handleViewFile(anexo)}
                            className="px-3 py-1 text-sm bg-[#2a2a2a] text-white rounded hover:bg-[#3a3a3a] transition"
                            title="Visualizar arquivo"
                          >
                            👁️ Ver
                          </button>
                          <button
                            onClick={() => handleDownload(anexo)}
                            className="p-2 text-[#a3a3a3] hover:text-white transition"
                            title="Download"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
