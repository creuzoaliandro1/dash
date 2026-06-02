import { useState, useEffect, useRef } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { parseExtratoXLSX, importExtrato, getExtratos } from '../services/extratoService'

const formatDataBR = (data) => {
  if (!data) return '—'
  const s = String(data)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  return s
}

const formatValorBR = (v) => {
  const n = parseFloat(v)
  if (isNaN(n)) return '0,00'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ExtratoPage() {
  const [extratos, setExtratos] = useState([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [dataIni, setDataIni] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [openActionsMenu, setOpenActionsMenu] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [sortColumn, setSortColumn] = useState('DATA')
  const [sortDirection, setSortDirection] = useState('desc')
  const fileInputRef = useRef(null)

  useEffect(() => {
    loadExtratos()
  }, [])

  const loadExtratos = async () => {
    setLoading(true)
    const { data } = await getExtratos()
    setExtratos(data || [])
    setLoading(false)
  }

  const handleFiles = async (files) => {
    const xlsxFiles = files.filter((f) => /\.xlsx?$/i.test(f.name))
    if (xlsxFiles.length === 0) {
      alert('Selecione um arquivo .xlsx do Extrato.')
      return
    }
    setImporting(true)
    setImportResult(null)
    try {
      let totalImported = 0
      let totalSkipped = 0
      let totalErrors = 0
      let totalRegistros = 0
      for (const file of xlsxFiles) {
        const registros = await parseExtratoXLSX(file)
        totalRegistros += registros.length
        const { data: res, error } = await importExtrato(registros)
        if (error) {
          alert('Erro ao importar: ' + error.message)
          continue
        }
        totalImported += res.imported
        totalSkipped += res.skipped
        totalErrors += res.errors
      }
      setImportResult({ imported: totalImported, skipped: totalSkipped, errors: totalErrors, total: totalRegistros })
      await loadExtratos()
    } catch (err) {
      alert('Erro ao processar arquivo: ' + err.message)
    } finally {
      setImporting(false)
    }
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
    e.target.value = ''
  }

  const getFiltered = () => {
    let list = extratos
    const term = searchTerm.trim().toLowerCase()
    if (term) {
      list = list.filter((e) =>
        (e.NOME && e.NOME.toLowerCase().includes(term)) ||
        (e.OPERACAO && e.OPERACAO.toLowerCase().includes(term)) ||
        (e.OBSERVACAO && e.OBSERVACAO.toLowerCase().includes(term)) ||
        (e.TRANSACAO && String(e.TRANSACAO).toLowerCase().includes(term)) ||
        (e.CIC && e.CIC.toLowerCase().includes(term)) ||
        (e.CONTROLE && e.CONTROLE.toLowerCase().includes(term)) ||
        (e.INSTITUICAO && e.INSTITUICAO.toLowerCase().includes(term))
      )
    }
    if (dataIni) list = list.filter((e) => e.DATA && e.DATA >= dataIni)
    if (dataFim) list = list.filter((e) => e.DATA && e.DATA <= dataFim)
    return list
  }

  const getSorted = () => {
    const list = [...getFiltered()]
    list.sort((a, b) => {
      let av = a[sortColumn]
      let bv = b[sortColumn]
      if (av == null) av = ''
      if (bv == null) bv = ''
      if (sortColumn === 'VALOR') {
        av = parseFloat(av) || 0
        bv = parseFloat(bv) || 0
        return sortDirection === 'asc' ? av - bv : bv - av
      }
      if (sortColumn === 'DATA') {
        return sortDirection === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
      }
      return sortDirection === 'asc'
        ? String(av).localeCompare(String(bv), 'pt-BR')
        : String(bv).localeCompare(String(av), 'pt-BR')
    })
    return list
  }

  const handleSort = (col) => {
    if (sortColumn === col) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(col)
      setSortDirection('asc')
    }
  }

  const toggleRow = (id) => {
    const next = new Set(selectedRows)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelectedRows(next)
  }

  const toggleAll = () => {
    const filtered = getFiltered()
    if (selectedRows.size === filtered.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(filtered.map((e) => e.ID)))
    }
  }

  // Função para mapear operações para nomes curtos
  const mapeadorOperacoes = (operacao) => {
    const mapeamento = {
      'CUSTO REGISTRO BOLETO ONLINE': 'REGISTRO',
      'RECEBIMENTO': 'BOLETO',
      'RECEBIMENTO BOLETO': 'BOLETO',
      'TRANSFERÊNCIA ENTRE CONTAS DÉBITO': 'TRANSFERÊNCIA',
      'PAGAMENTO BOLETO': 'PAGAMENTO',
      'CUSTO ENVIO PIX': 'CUSTO PIX'
    }
    return mapeamento[operacao] || operacao
  }

  // Função para formatar data em padrão dd/mm/aa
  const formatarDataDDMMAA = (data) => {
    if (!data) return '—'
    const s = String(data).trim()
    // yyyy-mm-dd -> dd/mm/aa
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) return `${m[3]}/${m[2]}/${m[1].slice(-2)}`
    // dd/mm/yyyy ou dd/mm/aa -> dd/mm/aa
    m = s.match(/^(\d{2})\/(\d{2})\/(\d{2,4})/)
    if (m) return `${m[1]}/${m[2]}/${m[3].slice(-2)}`
    return s
  }

  // Função para extrair Nosso Número da observação
  const extrairNossoNumero = (observacao) => {
    if (!observacao) return ''
    const match = String(observacao).match(/Nosso Número:\s*(\d+)/)
    if (match && match[1]) {
      return match[1]
    }
    return (String(observacao) || '').substring(0, 30)
  }

  const handleExportarPDF = () => {
    if (selectedRows.size === 0) {
      alert('Selecione pelo menos um lançamento para exportar')
      return
    }
    setOpenActionsMenu(false)
    const filtered = getSorted().filter((e) => selectedRows.has(e.ID))
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    doc.setFontSize(12)
    doc.setFont(undefined, 'bold')
    doc.text('EXTRATO - LANÇAMENTOS SELECIONADOS', 10, 12)
    doc.setFontSize(9)
    doc.setFont(undefined, 'normal')
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} — ${filtered.length} registro(s)`, 10, 18)

    autoTable(doc, {
      startY: 22,
      head: [['Data', 'Tipo', 'Operação', 'Nome', 'CIC', 'Valor (R$)', 'ID Transação', 'Observação']],
      body: filtered.map((e) => [
        formatarDataDDMMAA(e.DATA),
        e.TIPO || '',
        mapeadorOperacoes(e.OPERACAO || ''),
        (e.NOME || '').substring(0, 35),
        e.CIC || '',
        formatValorBR(e.VALOR),
        e.TRANSACAO || '',
        extrairNossoNumero(e.OBSERVACAO),
      ]),
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        overflow: 'hidden',
        cellWidth: 'wrap'
      },
      headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255] },
      columnStyles: {
        3: { overflow: 'hidden', cellWidth: 30 }, // Nome: não quebra, limite 30mm
        5: { halign: 'right' },
        7: { overflow: 'hidden' } // Observação: não quebra
      },
      theme: 'grid',
    })

    const now = new Date()
    const stamp = `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getFullYear()).slice(-2)}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
    doc.save(`extrato_${stamp}.pdf`)
  }

  const handleLimparFiltros = () => {
    setSearchTerm('')
    setDataIni('')
    setDataFim('')
  }

  const filtered = getFiltered()
  const sorted = getSorted()

  const SortIcon = ({ col }) => {
    if (sortColumn !== col) return null
    return <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-white">Extrato</h1>
          <p className="text-sm text-[#666666] mt-1">Importação e consulta de lançamentos bancários</p>
        </div>
      </div>

      {/* Upload Card */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
        onDrop={handleDrop}
        className={`bg-[#0a0a0a] border-2 border-dashed rounded-lg px-6 py-3 transition ${
          isDragging ? 'border-white bg-[#111111]' : 'border-[#2a2a2a] hover:border-[#333333]'
        } ${importing ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <div className="flex items-center gap-4">
          <svg className="w-5 h-5 text-[#666666] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
          <div className="flex-1 min-w-0">
            <span className="text-white font-semibold text-sm">Importar Extrato</span>
            <span className="text-[#666666] text-xs ml-2 hidden sm:inline">
              Arraste o .xlsx do extrato (Últimas Transações) ou clique em Selecionar arquivo
            </span>
          </div>
          <label className="shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileInput}
              disabled={importing}
              className="hidden"
            />
            <span className="px-4 py-1.5 bg-white text-black text-xs font-medium rounded hover:opacity-90 transition cursor-pointer inline-block whitespace-nowrap">
              {importing ? 'Importando...' : 'Selecionar arquivo'}
            </span>
          </label>
        </div>
        {importResult && (
          <div className="mt-2 text-xs text-[#a3a3a3]">
            <span className="text-white">✓ Importados:</span> {importResult.imported} ·{' '}
            <span className="text-white">⏭ Pulados (já existiam):</span> {importResult.skipped} ·{' '}
            {importResult.errors > 0 && <span className="text-[#ff8080]">✗ Erros: {importResult.errors} · </span>}
            <span className="text-[#666666]">Total no arquivo: {importResult.total}</span>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 items-end">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Buscar por nome, operação, ID, CIC, observação..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 bg-[#111111] border border-[#2a2a2a] rounded-md text-white placeholder-[#666666] focus:border-white focus:bg-[#1a1a1a] outline-none transition text-sm"
          />
          <svg className="absolute right-3 top-2.5 w-4 h-4 text-[#666666]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#666666]">Período:</span>
          <input
            type="date"
            value={dataIni}
            onChange={(e) => setDataIni(e.target.value)}
            className="px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-xs focus:border-white outline-none transition w-36"
            title="Data início"
          />
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-xs focus:border-white outline-none transition w-36"
            title="Data fim"
          />
          {(searchTerm || dataIni || dataFim) && (
            <button
              onClick={handleLimparFiltros}
              className="px-3 py-2 text-xs text-[#a3a3a3] hover:text-white transition"
              title="Limpar filtros"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Botão Ações */}
        <div className="relative">
          <button
            onClick={() => setOpenActionsMenu(!openActionsMenu)}
            disabled={selectedRows.size === 0}
            className={`px-4 py-2 text-sm font-medium rounded transition ${
              selectedRows.size === 0
                ? 'bg-[#1a1a1a] text-[#666666] border border-[#2a2a2a] cursor-not-allowed'
                : 'bg-[#1a1a1a] text-white border border-[#2a2a2a] hover:bg-[#222222]'
            }`}
          >
            Ações {selectedRows.size > 0 && `(${selectedRows.size})`}
          </button>
          {openActionsMenu && (
            <div className="absolute right-0 top-full mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded shadow-lg z-50 min-w-48">
              <button
                onClick={handleExportarPDF}
                className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#2a2a2a] transition"
              >
                📑 Exportar PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="flex-1 min-h-0 overflow-auto bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg">
        {loading ? (
          <div className="p-6 text-center text-[#666666] text-sm">Carregando...</div>
        ) : sorted.length === 0 ? (
          <div className="p-6 text-center text-[#666666] text-sm">Nenhum lançamento encontrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#111111] border-b border-[#2a2a2a] z-10">
              <tr>
                <th className="px-3 py-2 text-center w-10">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedRows.size === filtered.length}
                    onChange={toggleAll}
                    className="w-4 h-4 cursor-pointer accent-white"
                  />
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-white cursor-pointer hover:opacity-80" onClick={() => handleSort('DATA')}>
                  Data <SortIcon col="DATA" />
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-white cursor-pointer hover:opacity-80" onClick={() => handleSort('TIPO')}>
                  Tipo <SortIcon col="TIPO" />
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-white cursor-pointer hover:opacity-80" onClick={() => handleSort('OPERACAO')}>
                  Operação <SortIcon col="OPERACAO" />
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-white cursor-pointer hover:opacity-80" onClick={() => handleSort('NOME')}>
                  Nome / Razão Social <SortIcon col="NOME" />
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-white">CIC</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-white cursor-pointer hover:opacity-80" onClick={() => handleSort('VALOR')}>
                  Valor (R$) <SortIcon col="VALOR" />
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-white">ID Transação</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-white">Origem</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-white">Observação</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((e) => {
                const isSelected = selectedRows.has(e.ID)
                return (
                  <tr
                    key={e.ID}
                    className={`border-b border-[#1a1a1a] hover:bg-[#111111] transition ${isSelected ? 'bg-[#111111]' : ''}`}
                  >
                    <td className="px-3 py-2 text-center w-10">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(e.ID)}
                        className="w-4 h-4 cursor-pointer accent-white"
                      />
                    </td>
                    <td className="px-3 py-2 text-white whitespace-nowrap">{formatDataBR(e.DATA)}</td>
                    <td className="px-3 py-2 text-white">{e.TIPO || '—'}</td>
                    <td className="px-3 py-2 text-[#a3a3a3]">{e.OPERACAO || '—'}</td>
                    <td className="px-3 py-2 text-white truncate max-w-xs">{e.NOME || '—'}</td>
                    <td className="px-3 py-2 text-[#a3a3a3] font-mono text-xs">{e.CIC || '—'}</td>
                    <td className="px-3 py-2 text-white font-mono text-right whitespace-nowrap">{formatValorBR(e.VALOR)}</td>
                    <td className="px-3 py-2 text-[#a3a3a3] font-mono text-xs">{e.TRANSACAO || '—'}</td>
                    <td className="px-3 py-2 text-[#a3a3a3] text-xs">{e.ORIGEM || '—'}</td>
                    <td className="px-3 py-2 text-[#a3a3a3] text-xs truncate max-w-xs">{e.OBSERVACAO || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer com total */}
      <div className="flex items-center justify-between text-xs text-[#666666] px-1">
        <span>{sorted.length} registro(s) listado(s) · {selectedRows.size} selecionado(s)</span>
        <span>Ordenado por {sortColumn} {sortDirection === 'asc' ? '↑' : '↓'}</span>
      </div>
    </div>
  )
}
