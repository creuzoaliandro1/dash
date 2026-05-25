import { useState, useEffect } from 'react'
import { uploadAnexoBoleto, getAnexosBoleto, deleteAnexoBoleto, getDownloadUrlAnexo } from '../../services/boletoService'

export default function FileAttachment({ boletoId, contaId, onAttachmentsChange }) {
  const [anexos, setAnexos] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [mensagem, setMensagem] = useState(null)

  // Carregar anexos ao montar ou quando boletoId mudar
  useEffect(() => {
    if (boletoId) {
      carregarAnexos()
    }
  }, [boletoId])

  const carregarAnexos = async () => {
    setIsLoading(true)
    const { data } = await getAnexosBoleto(boletoId)
    setAnexos(data || [])
    if (onAttachmentsChange) {
      onAttachmentsChange(data || [])
    }
    setIsLoading(false)
  }

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!boletoId) {
      setMensagem({ tipo: 'aviso', texto: 'Salve o boleto primeiro para anexar arquivos' })
      return
    }

    setUploading(true)
    setMensagem(null)

    const { data, error } = await uploadAnexoBoleto(boletoId, file, contaId)

    if (error) {
      setMensagem({ tipo: 'erro', texto: 'Erro ao anexar arquivo: ' + error.message })
    } else {
      setMensagem({ tipo: 'sucesso', texto: 'Arquivo anexado com sucesso!' })
      await carregarAnexos()
    }

    setUploading(false)
    // Limpar input
    event.target.value = ''
  }

  const handleDeleteAnexo = async (anexoId, caminhoStorage) => {
    if (!window.confirm('Tem certeza que deseja deletar este anexo?')) return

    const { error } = await deleteAnexoBoleto(anexoId, caminhoStorage)

    if (error) {
      setMensagem({ tipo: 'erro', texto: 'Erro ao deletar: ' + error.message })
    } else {
      setMensagem({ tipo: 'sucesso', texto: 'Anexo deletado!' })
      await carregarAnexos()
    }
  }

  const handleDownloadAnexo = async (anexo) => {
    const { data: urlSignada, error } = await getDownloadUrlAnexo(anexo.caminho_storage)

    if (error) {
      setMensagem({ tipo: 'erro', texto: 'Erro ao gerar download: ' + error.message })
      return
    }

    // Abrir em nova aba
    window.open(urlSignada, '_blank')
  }

  const formatarTamaho = (bytes) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const formatarData = (dataStr) => {
    const data = new Date(dataStr)
    return data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  if (!boletoId) {
    return (
      <div className="p-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg">
        <p className="text-[#666666] text-sm">💾 Salve o boleto primeiro para adicionar anexos</p>
      </div>
    )
  }

  return (
    <div className="p-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg">
      <h3 className="text-white font-medium mb-4">📎 Anexos</h3>

      {/* Mensagem de status */}
      {mensagem && (
        <div className={`p-3 rounded mb-4 text-sm ${
          mensagem.tipo === 'erro' ? 'bg-[#3d1f1f] text-[#ff6b6b]' :
          mensagem.tipo === 'sucesso' ? 'bg-[#1f3d1f] text-[#51cf66]' :
          'bg-[#1f2d3d] text-[#74b1ff]'
        }`}>
          {mensagem.texto}
        </div>
      )}

      {/* Upload input */}
      <div className="mb-4">
        <label className="block w-full">
          <input
            type="file"
            accept=".xlsx,.xls,.xml,.pdf"
            onChange={handleFileSelect}
            disabled={uploading}
            className="hidden"
          />
          <span className={`inline-block px-4 py-2 rounded text-sm font-medium transition cursor-pointer whitespace-nowrap ${
            uploading
              ? 'bg-[#2a2a2a] text-[#666666] cursor-not-allowed'
              : 'bg-white text-black hover:opacity-90'
          }`}>
            {uploading ? '⏳ Anexando...' : '➕ Anexar arquivo'}
          </span>
        </label>
        <p className="text-[#666666] text-xs mt-2">Formatos permitidos: XML, Excel (.xlsx, .xls), PDF</p>
      </div>

      {/* Lista de anexos */}
      {isLoading ? (
        <p className="text-[#666666] text-sm">Carregando anexos...</p>
      ) : anexos.length === 0 ? (
        <p className="text-[#666666] text-sm">Nenhum anexo ainda</p>
      ) : (
        <div className="space-y-2">
          {anexos.map((anexo) => (
            <div key={anexo.id} className="flex items-center justify-between p-3 bg-[#111111] border border-[#2a2a2a] rounded">
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{anexo.nome_arquivo}</p>
                <p className="text-[#666666] text-xs">
                  {formatarTamaho(anexo.tamanho_bytes)} • {formatarData(anexo.data_upload)}
                </p>
              </div>
              <div className="flex gap-2 ml-4 flex-shrink-0">
                <button
                  onClick={() => handleDownloadAnexo(anexo)}
                  className="p-2 text-[#a3a3a3] hover:text-white transition"
                  title="Download"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDeleteAnexo(anexo.id, anexo.caminho_storage)}
                  className="p-2 text-[#a3a3a3] hover:text-red-500 transition"
                  title="Deletar"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
