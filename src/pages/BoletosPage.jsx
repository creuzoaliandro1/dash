import { useState, useEffect } from 'react'
import BoletoFormModal from '../components/Boletos/BoletoFormModal'
import BoletoTable from '../components/Boletos/BoletoTable'
import FileUpload from '../components/Boletos/FileUpload'
import ImportPreview from '../components/Boletos/ImportPreview'
import { createBoleto, getBoletos, deleteBoleto, createRemessa, updateContaLastRemessaDate } from '../services/boletoService'
import { generateMultipleBoletoPDFs, generateCNAB400RemittanceFile } from '../utils/boleto'
import { createAndDownloadZip } from '../utils/zipUtils'

export default function BoletosPage() {
  const [showModal, setShowModal] = useState(false)
  const [boletos, setBoletos] = useState([])
  const [editingBoleto, setEditingBoleto] = useState(null)
  const [loading, setLoading] = useState(false)
  const [importStatus, setImportStatus] = useState(null)
  const [showImportResult, setShowImportResult] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewData, setPreviewData] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [openActionsMenu, setOpenActionsMenu] = useState(false)
  const [generatingZip, setGeneratingZip] = useState(false)
  const [generatingCNAB400, setGeneratingCNAB400] = useState(false)

  // Obter user da sessão
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  useEffect(() => {
    if (user.id) {
      loadBoletos()
    }
  }, [user.id])

  const loadBoletos = async () => {
    setLoading(true)
    try {
      const resultado = await getBoletos(user.id)
      setBoletos(resultado.data || [])
    } catch (err) {
      console.error('Erro ao carregar boletos:', err)
      setBoletos([])
    }
    setLoading(false)
  }

  const handleCreateNew = () => {
    setEditingBoleto(null)
    setShowModal(true)
  }

  const handleEdit = (boleto) => {
    setEditingBoleto(boleto)
    setShowModal(true)
  }

  const handleSave = async (formData) => {
    setLoading(true)
    if (editingBoleto) {
      // Atualizar
      // await updateBoleto(editingBoleto.ID, formData)
    } else {
      // Criar novo
      const { data, error } = await createBoleto(user.id, formData)
      if (!error) {
        setBoletos([...boletos, data])
      } else {
        alert('Erro ao salvar boleto: ' + error.message)
      }
    }
    setShowModal(false)
    loadBoletos()
    setLoading(false)
  }

  const handleImportComplete = (result) => {
    setImportStatus({
      type: 'success',
      title: 'Importação concluída!',
      totalImported: result.totalImported,
      results: result.results,
    })
    setShowImportResult(true)
    loadBoletos()
  }

  const handleImportError = (error) => {
    setImportStatus({
      type: 'error',
      title: 'Erro na importação',
      message: error,
    })
    setShowImportResult(true)
  }

  const handleShowPreview = (data) => {
    setPreviewData(data)
    setShowPreview(true)
  }

  const handleImportPreviewComplete = (result) => {
    setShowPreview(false)
    setPreviewData([])
    setImportStatus({
      type: 'success',
      title: 'Importação concluída!',
      totalImported: result.imported,
      importedCount: result.imported,
      errorCount: result.errors,
      totalCount: result.total,
    })
    setShowImportResult(true)
    loadBoletos()
  }

  const handleCancelPreview = () => {
    setShowPreview(false)
    setPreviewData([])
  }

  const getFilteredBoletos = () => {
    let filtered = boletos

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(boleto => {
        return (
          (boleto.numero_documento && boleto.numero_documento.toLowerCase().includes(term)) ||
          (boleto.sacado_nome && boleto.sacado_nome.toLowerCase().includes(term)) ||
          (boleto.nosso_numero && boleto.nosso_numero.toLowerCase().includes(term)) ||
          (boleto.sacado_cic && boleto.sacado_cic.toLowerCase().includes(term))
        )
      })
    }

    // Filter by status
    if (statusFilter !== 'todos') {
      filtered = filtered.filter(boleto => boleto.status === statusFilter)
    }

    return filtered
  }

  const handleGenerateSecondViaZip = async () => {
    if (selectedRows.size === 0) {
      alert('Selecione pelo menos um boleto')
      return
    }

    setGeneratingZip(true)
    setOpenActionsMenu(false)

    try {
      const filteredBoletos = getFilteredBoletos()
      const boletosParaZip = Array.from(selectedRows)
        .map(index => filteredBoletos[index])
        .filter(boleto => boleto)

      console.log('[Ações] Gerando ZIP para', boletosParaZip.length, 'boletos selecionados')

      const pdfList = await generateMultipleBoletoPDFs(boletosParaZip)
      await createAndDownloadZip(pdfList, 'boletos.zip')

      alert(`ZIP com ${pdfList.length} boleto(s) gerado com sucesso!`)
      setSelectedRows(new Set())
    } catch (error) {
      console.error('[Ações] Erro ao gerar ZIP:', error)
      alert('Erro ao gerar ZIP: ' + error.message)
    } finally {
      setGeneratingZip(false)
    }
  }

  const handleGenerateRemessaCNAB400 = async () => {
    if (selectedRows.size === 0) {
      alert('Selecione pelo menos um boleto')
      return
    }

    setGeneratingCNAB400(true)
    setOpenActionsMenu(false)

    try {
      const filteredBoletos = getFilteredBoletos()
      const boletosParaRemessa = Array.from(selectedRows)
        .map(index => filteredBoletos[index])
        .filter(boleto => boleto)

      console.log('[CNAB400] Gerando remessa para', boletosParaRemessa.length, 'boletos selecionados')

      const cnab400Blob = generateCNAB400RemittanceFile(boletosParaRemessa)

      // Generate filename: CB[DDMM][SSSSSSS].REM
      const now = new Date()
      const day = String(now.getDate()).padStart(2, '0')
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const sequence = String(Math.floor(Math.random() * 9999999)).padStart(7, '0')
      const filename = `CB${day}${month}${sequence}.REM`

      // Download the file
      const url = URL.createObjectURL(cnab400Blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      // Track remittance in database
      const valorTotal = boletosParaRemessa.reduce((sum, b) => sum + (parseFloat(b.valor) || 0), 0)

      const { error: remessaError } = await createRemessa(user.id, {
        filename,
        quantidadeBoletos: boletosParaRemessa.length,
        valorTotal,
        conta: user.conta || '',
        agencia: user.agencia || '',
      })

      if (remessaError) {
        console.error('[CNAB400] Erro ao registrar remessa:', remessaError)
        // Continue anyway - file was generated
      }

      // Update conta's remittance filename
      const { error: contaError } = await updateContaLastRemessaDate(user.id, filename)
      if (contaError) {
        console.error('[CNAB400] Erro ao atualizar data da conta:', contaError)
      }

      alert(`Remessa CNAB400 "${filename}" gerada com sucesso!`)
      setSelectedRows(new Set())
    } catch (error) {
      console.error('[CNAB400] Erro ao gerar remessa:', error)
      alert('Erro ao gerar remessa CNAB400: ' + error.message)
    } finally {
      setGeneratingCNAB400(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Boletos</h1>
          <p className="text-sm text-[#666666] mt-1">Emissão, consulta e gestão de títulos</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-transparent text-white text-sm font-medium border border-[#2a2a2a] rounded hover:bg-[#111111] transition">
            Exportar CSV
          </button>
          <button
            onClick={handleGenerateRemessaCNAB400}
            disabled={selectedRows.size === 0 || generatingCNAB400}
            className={`px-4 py-2 text-sm font-medium border rounded transition ${
              selectedRows.size === 0 || generatingCNAB400
                ? 'bg-transparent text-[#666666] border-[#2a2a2a] cursor-not-allowed'
                : 'bg-transparent text-white border-[#2a2a2a] hover:bg-[#111111]'
            }`}
          >
            {generatingCNAB400 ? '⏳ Gerando...' : 'Remessa CNAB400'}
          </button>
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 bg-white text-black text-sm font-medium rounded hover:opacity-90 transition"
          >
            + Emitir boleto
          </button>
        </div>
      </div>

      {/* Upload Area */}
      <FileUpload
        userId={user.id}
        onShowPreview={handleShowPreview}
        onImportError={handleImportError}
      />

      {/* Search and Filter */}
      <div className="flex gap-3 items-center">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Buscar por documento, cliente, nosso número..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 bg-[#111111] border border-[#2a2a2a] rounded-md text-white placeholder-[#666666] focus:border-white focus:bg-[#1a1a1a] outline-none transition text-sm"
          />
          <svg className="absolute right-3 top-2.5 w-4 h-4 text-[#666666]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-[#111111] border border-[#2a2a2a] rounded-md text-white text-sm focus:border-white outline-none transition"
        >
          <option value="todos">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
          <option value="atrasado">Atrasado</option>
          <option value="cancelado">Cancelado</option>
        </select>

        {/* Botão Ações com Dropdown */}
        <div className="relative">
          <button
            onClick={() => setOpenActionsMenu(!openActionsMenu)}
            disabled={selectedRows.size === 0 || generatingZip}
            className={`px-4 py-2 text-sm font-medium rounded transition ${
              selectedRows.size === 0 || generatingZip
                ? 'bg-[#1a1a1a] text-[#666666] border border-[#2a2a2a] cursor-not-allowed'
                : 'bg-[#1a1a1a] text-white border border-[#2a2a2a] hover:bg-[#222222]'
            }`}
          >
            Ações {selectedRows.size > 0 && `(${selectedRows.size})`}
          </button>

          {openActionsMenu && (
            <div className="absolute right-0 top-full mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded shadow-lg z-50 min-w-56">
              <button
                onClick={handleGenerateSecondViaZip}
                disabled={generatingZip}
                className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#2a2a2a] transition border-b border-[#2a2a2a] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingZip ? '⏳ Gerando ZIP...' : '📥 Gerar segunda via (ZIP)'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabela de Boletos */}
      <BoletoTable
        boletos={getFilteredBoletos()}
        onEdit={handleEdit}
        selectedRows={selectedRows}
        onSelectedRowsChange={setSelectedRows}
      />

      {/* Modal de Formulário */}
      {showModal && (
        <BoletoFormModal
          boleto={editingBoleto}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* Import Preview Modal */}
      {showPreview && previewData.length > 0 && (
        <ImportPreview
          previewData={previewData}
          userId={user.id}
          onImportComplete={handleImportPreviewComplete}
          onCancel={handleCancelPreview}
        />
      )}

      {/* Import Result Modal */}
      {showImportResult && importStatus && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-white mb-4">{importStatus.title}</h2>

            {importStatus.type === 'success' ? (
              <div className="space-y-4">
                <div className="p-4 bg-[#111111] border border-[#1f1f1f] rounded">
                  <p className="text-2xl font-bold text-white">{importStatus.importedCount || importStatus.totalImported}</p>
                  <p className="text-sm text-[#666666] mt-1">Boleto(s) importado(s) com sucesso</p>
                  {importStatus.errorCount > 0 && (
                    <p className="text-sm text-[#a3a3a3] mt-2">
                      {importStatus.errorCount} erro(s) ao processar
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-[#1a1a1a] border border-[#404040] rounded">
                <p className="text-[#a3a3a3] text-sm whitespace-pre-wrap">{importStatus.message}</p>
              </div>
            )}

            <button
              onClick={() => setShowImportResult(false)}
              className="w-full mt-6 px-4 py-2 bg-white text-black text-sm font-medium rounded hover:opacity-90 transition"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
