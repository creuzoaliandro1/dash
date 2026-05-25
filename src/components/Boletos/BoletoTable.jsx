import { useState, useRef, useEffect } from 'react'
import { generateSingleBoletoPDF } from '../../utils/boleto'
import { generateDuplicataPDF } from '../../utils/duplicata'
import { getContaInfo } from '../../services/boletoService'
import BoletoDetailsModal from './BoletoDetailsModal'

const formatDate = (dateStr) => {
  if (!dateStr) return '—'

  // Handle different date formats
  let date
  if (typeof dateStr === 'string') {
    if (dateStr.includes('/')) {
      // DD/MM/YYYY format
      const [day, month, year] = dateStr.split('/')
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    } else if (dateStr.includes('-')) {
      // YYYY-MM-DD format - parse as local date, not UTC
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

export default function BoletoTable({ boletos, onEdit, onDelete, selectedRows: propsSelectedRows, onSelectedRowsChange, contaData }) {
  console.log('[BoletoTable] Renderizando com', boletos?.length || 0, 'boletos')

  // Se não recebeu selectedRows (compatibilidade com versão anterior), usar estado local
  const [localSelectedRows, setLocalSelectedRows] = useState(new Set())
  const isControlled = propsSelectedRows !== undefined && onSelectedRowsChange !== undefined
  const rows = isControlled ? propsSelectedRows : localSelectedRows
  const setRows = isControlled ? onSelectedRowsChange : setLocalSelectedRows

  const [openMenu, setOpenMenu] = useState(null)
  const menuRef = useRef(null)

  // Estado para o modal de detalhes
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [selectedBoletoDetail, setSelectedBoletoDetail] = useState(null)

  // Estado para preview de PDF da 2ª via
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false)
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null)

  // Estado para preview de PDF da Duplicata
  const [duplicataPdfOpen, setDuplicataPdfOpen] = useState(false)
  const [duplicataPdfUrl, setDuplicataPdfUrl] = useState(null)
  const [generatingDuplicata, setGeneratingDuplicata] = useState(false)

  // Estado para ordenação
  const [sortColumn, setSortColumn] = useState('data_emissao')
  const [sortDirection, setSortDirection] = useState('desc')


  const getStatusBadge = (status) => {
    const statusMap = {
      pago: { bg: 'bg-white', text: 'text-black', label: 'Pago' },
      pendente: { bg: 'bg-[#1a1a1a]', text: 'text-white border border-[#2a2a2a]', label: 'Pendente' },
      atrasado: { bg: 'bg-[#262626]', text: 'text-white border border-[#404040]', label: 'Atrasado' },
      cancelado: { bg: 'bg-transparent', text: 'text-[#666666] border border-[#1f1f1f] line-through', label: 'Cancelado' },
    }
    const config = statusMap[status] || statusMap.pendente
    return `${config.bg} ${config.text}`
  }

  const toggleRow = (index) => {
    const newSelected = new Set(rows)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setRows(newSelected)
  }

  const handleMenuToggle = (index) => {
    console.log('[Menu] Clicou no botão ⋮, index:', index, 'openMenu atual:', openMenu)
    setOpenMenu(openMenu === index ? null : index)
    console.log('[Menu] openMenu depois:', openMenu === index ? null : index)
  }

  const toggleAll = () => {
    if (rows.size === boletos.length) {
      setRows(new Set())
    } else {
      setRows(new Set(boletos.map((_, i) => i)))
    }
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenu(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Função para ordenar
  const handleSort = (column) => {
    if (sortColumn === column) {
      // Se clicou na mesma coluna, inverte a direção
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // Se clicou em coluna diferente, começa com ascendente
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  // Função para ordenar os boletos
  const getSortedBoletos = () => {
    const sorted = [...boletos].sort((a, b) => {
      let aValue = a[sortColumn]
      let bValue = b[sortColumn]

      // Lidar com valores nulos/undefined
      if (aValue === null || aValue === undefined) aValue = ''
      if (bValue === null || bValue === undefined) bValue = ''

      // Ordenação numérica para valor
      if (sortColumn === 'valor') {
        aValue = parseFloat(String(aValue).replace(/\./g, '').replace(',', '.')) || 0
        bValue = parseFloat(String(bValue).replace(/\./g, '').replace(',', '.')) || 0
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
      }

      // Ordenação de data
      if (sortColumn === 'data_emissao' || sortColumn === 'data_vencimento' || sortColumn === 'created_at') {
        const dateA = new Date(aValue)
        const dateB = new Date(bValue)
        if (isNaN(dateA.getTime())) return sortDirection === 'asc' ? 1 : -1
        if (isNaN(dateB.getTime())) return sortDirection === 'asc' ? -1 : 1
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA
      }

      // Ordenação alfabética (padrão)
      const strA = String(aValue).toLowerCase()
      const strB = String(bValue).toLowerCase()

      if (sortDirection === 'asc') {
        return strA.localeCompare(strB, 'pt-BR')
      } else {
        return strB.localeCompare(strA, 'pt-BR')
      }
    })

    return sorted
  }

  // Obter boletos ordenados
  const sortedBoletos = getSortedBoletos()

  // Componente do header com seta
  const SortableHeader = ({ column, label, flex, align = 'text-right' }) => {
    const isActive = sortColumn === column
    const icon = isActive ? (sortDirection === 'asc' ? '↑' : '↓') : ''

    return (
      <div
        style={{ flex }}
        className={`${align} cursor-pointer hover:text-white transition select-none`}
        onClick={() => handleSort(column)}
        title={`Ordenar por ${label}`}
      >
        {label} {icon && <span className="ml-1">{icon}</span>}
      </div>
    )
  }

  const handleDelete = (boleto) => {
    if (onDelete) {
      onDelete(boleto)
      setOpenMenu(null)
    }
  }

  const handleOpenDetails = (boleto) => {
    setSelectedBoletoDetail(boleto)
    setDetailsModalOpen(true)
    setOpenMenu(null)
  }

  const handleGenerateSecondWay = async (boleto) => {
    console.log('[PDF] Clique no botão 2ª via - iniciando...')
    try {
      console.log('[PDF] Boleto recebido:', boleto)
      // generateSingleBoletoPDF agora usa diretamente o registro capt_boletos (snake_case)
      // e contaData (CONTAS) passado como prop
      const pdfBlob = await generateSingleBoletoPDF(boleto, contaData)
      console.log('[PDF] PDF gerado, tamanho:', pdfBlob?.size, 'bytes')

      // Criar URL para preview
      const url = URL.createObjectURL(pdfBlob)
      setPdfPreviewUrl(url)
      setPdfPreviewOpen(true)

      setOpenMenu(null)
      console.log('[PDF] Sucesso! Preview aberto')
    } catch (error) {
      console.error('[PDF] ERRO CAPTURADO:', error)
      console.error('[PDF] Message:', error.message)
      console.error('[PDF] Stack:', error.stack)
      alert('Erro ao gerar boleto: ' + error.message)
      setOpenMenu(null)
    }
  }

  const handleGenerateDuplicata = async (boleto) => {
    console.log('[Duplicata] Clique no botão Duplicata - iniciando...')
    setGeneratingDuplicata(true)
    try {
      console.log('[Duplicata] Boleto recebido:', boleto.id)

      // Mapear dados do boleto para a Duplicata
      const boletoForDuplicata = {
        numero_documento: boleto.numero_documento || '',
        valor: boleto.valor || 0,
        data_emissao: boleto.data_emissao || '',
        data_vencimento: boleto.data_vencimento || '',
        sacado_nome: boleto.sacado_nome || '',
        sacado_cic: boleto.sacado_cic || '',
        sacado_endereco: boleto.sacado_endereco || '',
        sacado_cidade: boleto.sacado_cidade || '',
        sacado_uf: boleto.sacado_uf || '',
        sacado_cep: boleto.sacado_cep || '',
        sacado_celular: boleto.sacado_celular || '',
        sacado_telefone: boleto.sacado_telefone || '',
      }

      // Obter dados da conta (se contaData não foi passado, buscar)
      let contaInfo = contaData
      if (!contaInfo) {
        const { data } = await getContaInfo(boleto.conta_id)
        contaInfo = data || {}
      }

      console.log('[Duplicata] Conta info:', { id: contaInfo?.id, tem_logo: !!contaInfo?.logo })

      // Gerar Duplicata PDF (passa null como logoUrl - será usado logo da conta)
      const duplicataBlob = await generateDuplicataPDF(boletoForDuplicata, contaInfo, null)
      console.log('[Duplicata] PDF gerado, tamanho:', duplicataBlob?.size, 'bytes')

      // Criar URL para preview
      const url = URL.createObjectURL(duplicataBlob)
      setDuplicataPdfUrl(url)
      setDuplicataPdfOpen(true)

      setOpenMenu(null)
      console.log('[Duplicata] Sucesso! Preview aberto')
    } catch (error) {
      console.error('[Duplicata] ERRO CAPTURADO:', error)
      console.error('[Duplicata] Message:', error.message)
      console.error('[Duplicata] Stack:', error.stack)
      alert('Erro ao gerar Duplicata: ' + error.message)
      setOpenMenu(null)
    } finally {
      setGeneratingDuplicata(false)
    }
  }

  if (boletos.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-[#a3a3a3] text-sm font-medium">Nenhum boleto emitido ainda</p>
        <p className="text-[#666666] text-xs mt-2">Clique em "Emitir boleto" para começar</p>
      </div>
    )
  }

  return (
    <div className="min-w-max w-full">
      {/* Header — sticky dentro do container overflow-auto do pai */}
      <div className="sticky top-0 z-10">
        <div className="flex items-center gap-4 bg-[#111111] border-b border-[#1f1f1f] px-4 py-3">
          <input
            type="checkbox"
            checked={rows.size === boletos.length && boletos.length > 0}
            onChange={toggleAll}
            className="w-4 h-4 cursor-pointer accent-white flex-shrink-0"
          />
          <div className="flex-1 flex gap-4 text-xs font-semibold text-[#666666] uppercase tracking-wider">
            <SortableHeader column="num_lancamento" label="Num Lançamento" flex="1" align="text-right" />
            <SortableHeader column="created_at" label="Gerado" flex="1" align="text-right" />
            <SortableHeader column="data_emissao" label="Emissão" flex="1" align="text-right" />
            <SortableHeader column="numero_documento" label="Documento" flex="1" align="text-right" />
            <SortableHeader column="valor" label="Valor" flex="1" align="text-right" />
            <SortableHeader column="data_vencimento" label="Vencimento" flex="1" align="text-right" />
            <SortableHeader column="sacado_nome" label="Nome Sacado" flex="3" align="text-center" />
            <SortableHeader column="sacado_cic" label="CIC Sacado" flex="1" align="text-right" />
            <div style={{ flex: '0.5' }} className="text-center">Status</div>
            <div style={{ flex: '1' }} className="text-center">Antecipação</div>
            <div style={{ flex: '1' }} className="text-center">Registro</div>
            <div style={{ flex: '0.5' }} className="text-center">Ações</div>
          </div>
        </div>
      </div>{/* fim sticky */}

      {/* Rows */}
      <div className="divide-y divide-[#1f1f1f]">
          {sortedBoletos.map((boleto, index) => (
            <div
              key={index}
              className={`flex items-center gap-4 px-4 py-3 hover:bg-[#111111] transition ${
                rows.has(index) ? 'bg-[#111111]' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={rows.has(index)}
                onChange={() => toggleRow(index)}
                className="w-4 h-4 cursor-pointer accent-white flex-shrink-0"
              />
              <div className="flex-1 flex gap-4 text-sm items-center">
                <div style={{ flex: '1' }} className="text-white text-right">
                  {boleto.num_lancamento || '—'}
                </div>
                <div style={{ flex: '1' }} className="text-white text-right">
                  {boleto.created_at ? formatDate(boleto.created_at) : '—'}
                </div>
                <div style={{ flex: '1' }} className="text-white text-right">
                  {boleto.data_emissao ? formatDate(boleto.data_emissao) : '—'}
                </div>
                <div style={{ flex: '1' }} className="text-white font-medium text-right">
                  {boleto.numero_documento || '—'}
                </div>
                <div style={{ flex: '1' }} className="text-white font-mono text-right">
                  {boleto.valor ? formatCurrency(boleto.valor) : '0,00'}
                </div>
                <div style={{ flex: '1' }} className="text-[#a3a3a3] text-right">
                  {boleto.data_vencimento ? formatDate(boleto.data_vencimento) : '—'}
                </div>
                <div style={{ flex: '3' }} className="text-white truncate text-left">
                  {boleto.sacado_nome || '—'}
                </div>
                <div style={{ flex: '1' }} className="text-[#a3a3a3] font-mono text-right">
                  {boleto.sacado_cic || '—'}
                </div>
                <div style={{ flex: '0.5' }} className="text-center">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium ${getStatusBadge(boleto.status)}`}>
                    {boleto.status ? boleto.status.charAt(0).toUpperCase() + boleto.status.slice(1) : 'Pendente'}
                  </span>
                </div>
                <div style={{ flex: '1' }} className="text-center text-white">
                  {boleto.status_efactor || '—'}
                </div>
                <div style={{ flex: '1' }} className="text-center text-white">
                  {boleto.status_efator || '—'}
                </div>
                <div style={{ flex: '0.5' }} className="flex justify-center relative" ref={menuRef}>
                  <button
                    onClick={() => handleMenuToggle(index)}
                    className="text-[#a3a3a3] hover:text-white transition p-1"
                    title="Ações"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="5" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="12" cy="19" r="2" />
                    </svg>
                  </button>

                  {openMenu === index && (
                    <>
                      {console.log('[Menu] Menu aberto para index:', index)}
                      <div
                        className="absolute right-0 top-full mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded shadow-lg z-50 min-w-48"
                        onMouseDown={(e) => {
                          console.log('[Menu] Clique detectado dentro do menu')
                          e.stopPropagation()
                        }}
                      >
                        <button
                          onClick={() => handleGenerateSecondWay(boleto)}
                          className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#2a2a2a] transition border-b border-[#2a2a2a]"
                        >
                          2ª via do boleto
                        </button>
                        <button
                          onClick={() => handleGenerateDuplicata(boleto)}
                          className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#2a2a2a] transition border-b border-[#2a2a2a]"
                        >
                          📄 Duplicata
                        </button>
                        <button
                          onClick={() => handleOpenDetails(boleto)}
                          className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#2a2a2a] transition border-b border-[#2a2a2a]"
                        >
                          📋 Detalhes
                        </button>
                      <button
                        onClick={() => {
                          onEdit(boleto)
                          setOpenMenu(null)
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#2a2a2a] transition border-b border-[#2a2a2a]"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(boleto)}
                        className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#2a2a2a] transition"
                      >
                        🗑️ Excluir
                      </button>
                    </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Modal de Detalhes */}
        <BoletoDetailsModal
          boleto={selectedBoletoDetail}
          isOpen={detailsModalOpen}
          onClose={() => setDetailsModalOpen(false)}
        />

        {/* Modal de Preview da 2ª Via */}
        {pdfPreviewOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 flex items-center justify-between p-3 border-b border-[#2a2a2a] bg-[#0a0a0a]">
                <h2 className="text-white text-sm font-medium">2ª Via do Boleto</h2>
                <button
                  onClick={() => setPdfPreviewOpen(false)}
                  className="text-[#666666] hover:text-white transition text-2xl"
                >
                  ✕
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                <iframe
                  src={pdfPreviewUrl + '#navpanes=0&zoom=75'}
                  className="w-full h-[950px] border border-[#2a2a2a] rounded"
                  title="2ª Via Boleto"
                />
              </div>
            </div>
          </div>
        )}

        {/* Modal de Preview da Duplicata */}
        {duplicataPdfOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 flex items-center justify-between p-3 border-b border-[#2a2a2a] bg-[#0a0a0a]">
                <h2 className="text-white text-sm font-medium">Duplicata</h2>
                <button
                  onClick={() => setDuplicataPdfOpen(false)}
                  className="text-[#666666] hover:text-white transition text-2xl"
                >
                  ✕
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                {generatingDuplicata ? (
                  <div className="flex items-center justify-center h-[950px]">
                    <p className="text-[#a3a3a3]">Gerando Duplicata...</p>
                  </div>
                ) : (
                  <iframe
                    src={duplicataPdfUrl + '#navpanes=0&zoom=75'}
                    className="w-full h-[950px] border border-[#2a2a2a] rounded"
                    title="Duplicata"
                  />
                )}
              </div>
            </div>
          </div>
        )}
    </div>
  )
}
