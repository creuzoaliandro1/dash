import { useState, useRef, useEffect } from 'react'
import { createBoleto } from '../../services/boletoService'
import InstalmentModal from './InstalmentModal'

export default function ImportPreview({ previewData, userId, onImportComplete, onCancel }) {
  const [dataWithInstalments, setDataWithInstalments] = useState(
    previewData.map(item => ({
      ...item,
      _records: [item]
    }))
  )

  const [selectedRows, setSelectedRows] = useState(
    new Set(
      dataWithInstalments.flatMap((_, idx) =>
        dataWithInstalments[idx]._records.map((_, ridx) => `${idx}-${ridx}`)
      )
    )
  )
  const [expandedRows, setExpandedRows] = useState(new Set())
  const [isImporting, setIsImporting] = useState(false)
  const [editingIndex, setEditingIndex] = useState(null)
  const [editData, setEditData] = useState({})
  const [instalmentModal, setInstalmentModal] = useState(null)
  const [inlineEditingCell, setInlineEditingCell] = useState(null)
  const [inlineEditValue, setInlineEditValue] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (inlineEditingCell && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [inlineEditingCell])

  const handleInlineEdit = (itemIdx, recordIdx, field, value) => {
    setInlineEditingCell(`${itemIdx}-${recordIdx}-${field}`)
    setInlineEditValue(value)
  }

  const handleInlineBlur = (itemIdx, recordIdx, field) => {
    const newData = [...dataWithInstalments]
    newData[itemIdx]._records[recordIdx] = {
      ...newData[itemIdx]._records[recordIdx],
      [field]: inlineEditValue
    }
    setDataWithInstalments(newData)
    setInlineEditingCell(null)
  }

  const handleInlineKeyDown = (e, itemIdx, recordIdx, field) => {
    if (e.key === 'Enter') {
      handleInlineBlur(itemIdx, recordIdx, field)
    } else if (e.key === 'Escape') {
      setInlineEditingCell(null)
    }
  }

  const toggleRow = (rowId) => {
    const newSelected = new Set(selectedRows)
    if (newSelected.has(rowId)) {
      newSelected.delete(rowId)
    } else {
      newSelected.add(rowId)
    }
    setSelectedRows(newSelected)
  }

  const toggleExpanded = (rowId) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(rowId)) {
      newExpanded.delete(rowId)
    } else {
      newExpanded.add(rowId)
    }
    setExpandedRows(newExpanded)
  }

  const toggleAll = () => {
    if (selectedRows.size === getTotalRecords()) {
      setSelectedRows(new Set())
    } else {
      const allIds = new Set()
      dataWithInstalments.forEach((item, idx) => {
        item._records.forEach((_, ridx) => {
          allIds.add(`${idx}-${ridx}`)
        })
      })
      setSelectedRows(allIds)
    }
  }

  const getTotalRecords = () => {
    return dataWithInstalments.reduce((sum, item) => sum + item._records.length, 0)
  }

  const handleInstalmentConfirm = (instalments) => {
    if (instalmentModal) {
      const { itemIdx } = instalmentModal
      const newData = [...dataWithInstalments]
      newData[itemIdx]._records = instalments.map(inst => ({
        ...newData[itemIdx],
        NUM_TITULO: inst.number,
        VALOR: inst.value,
        VENCIMENTO: inst.dueDate,
        EMISSAO: inst.emission,
      }))
      setDataWithInstalments(newData)
      setInstalmentModal(null)

      const allIds = new Set()
      dataWithInstalments.forEach((item, idx) => {
        item._records.forEach((_, ridx) => {
          allIds.add(`${idx}-${ridx}`)
        })
      })
      setSelectedRows(allIds)
    }
  }

  const handleImport = async () => {
    setIsImporting(true)
    let imported = 0
    let errors = 0

    for (const rowId of selectedRows) {
      const [itemIdx, recordIdx] = rowId.split('-').map(Number)
      const boletoData = dataWithInstalments[itemIdx]._records[recordIdx]

      try {
        const { error } = await createBoleto(userId, boletoData)
        if (error) {
          errors++
        } else {
          imported++
        }
      } catch (err) {
        errors++
      }
    }

    setIsImporting(false)
    onImportComplete({
      imported,
      errors,
      total: selectedRows.size,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg max-w-6xl w-full max-h-[90vh] flex flex-col">
        <div className="border-b border-[#1f1f1f] p-6">
          <h2 className="text-xl font-semibold text-white mb-2">Visualizar dados para importação</h2>
          <p className="text-sm text-[#666666]">
            Revise os registros e selecione quais deseja importar ({selectedRows.size} de {getTotalRecords()} selecionado(s))
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-2">
          {dataWithInstalments.map((item, itemIdx) => {
            const firstRecord = item._records[0]
            const firstRowId = `${itemIdx}-0`
            const isFirstSelected = selectedRows.has(firstRowId)
            const isFirstExpanded = expandedRows.has(firstRowId)
            const hasMultiple = item._records.length > 1

            return (
              <div key={`group-${itemIdx}`} className="border border-[#1f1f1f] rounded-lg overflow-hidden">
                {/* Sacado Information Section - Always at top */}
                <div className="bg-[#0f0f0f] p-6 space-y-4 border-b border-[#1f1f1f]">
                  <div className="grid grid-cols-2 gap-4">
                    <div
                      className="cursor-pointer hover:opacity-80 transition"
                      onClick={() => handleInlineEdit(itemIdx, 0, 'SACADO_NOME', firstRecord.SACADO_NOME || '')}
                    >
                      <p className="text-xs text-[#666666] uppercase font-semibold">Nome do Sacado</p>
                      {inlineEditingCell === `${itemIdx}-0-SACADO_NOME` ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={inlineEditValue}
                          onChange={(e) => setInlineEditValue(e.target.value)}
                          onBlur={() => handleInlineBlur(itemIdx, 0, 'SACADO_NOME')}
                          onKeyDown={(e) => handleInlineKeyDown(e, itemIdx, 0, 'SACADO_NOME')}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-2 py-1 bg-[#1a1a1a] border border-white rounded text-white text-sm mt-1"
                        />
                      ) : (
                        <p className="text-white text-sm">{firstRecord.SACADO_NOME || '—'}</p>
                      )}
                    </div>
                    <div
                      className="cursor-pointer hover:opacity-80 transition"
                      onClick={() => handleInlineEdit(itemIdx, 0, 'SACADO_CIC', firstRecord.SACADO_CIC || '')}
                    >
                      <p className="text-xs text-[#666666] uppercase font-semibold">CPF/CNPJ</p>
                      {inlineEditingCell === `${itemIdx}-0-SACADO_CIC` ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={inlineEditValue}
                          onChange={(e) => setInlineEditValue(e.target.value)}
                          onBlur={() => handleInlineBlur(itemIdx, 0, 'SACADO_CIC')}
                          onKeyDown={(e) => handleInlineKeyDown(e, itemIdx, 0, 'SACADO_CIC')}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-2 py-1 bg-[#1a1a1a] border border-white rounded text-white text-sm mt-1"
                        />
                      ) : (
                        <p className="text-white text-sm font-mono">{firstRecord.SACADO_CIC || '—'}</p>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-[#1f1f1f] pt-4">
                    <div
                      className="cursor-pointer hover:opacity-80 transition"
                      onClick={() => handleInlineEdit(itemIdx, 0, 'SACADO_ENDERECO', firstRecord.SACADO_ENDERECO || '')}
                    >
                      <p className="text-xs text-[#666666] uppercase font-semibold mb-2">Endereço</p>
                      {inlineEditingCell === `${itemIdx}-0-SACADO_ENDERECO` ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={inlineEditValue}
                          onChange={(e) => setInlineEditValue(e.target.value)}
                          onBlur={() => handleInlineBlur(itemIdx, 0, 'SACADO_ENDERECO')}
                          onKeyDown={(e) => handleInlineKeyDown(e, itemIdx, 0, 'SACADO_ENDERECO')}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-2 py-1 bg-[#1a1a1a] border border-white rounded text-white text-sm"
                        />
                      ) : (
                        <>
                          <p className="text-white text-sm">
                            {firstRecord.SACADO_ENDERECO}
                            {firstRecord.SACADO_BAIRRO && `, ${firstRecord.SACADO_BAIRRO}`}
                          </p>
                          <p className="text-[#a3a3a3] text-sm mt-1">
                            {firstRecord.SACADO_CEP && `${firstRecord.SACADO_CEP}`}
                            {firstRecord.SACADO_CIDADE && ` - ${firstRecord.SACADO_CIDADE}`}
                            {firstRecord.SACADO_UF && ` - ${firstRecord.SACADO_UF}`}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-[#1f1f1f] pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div
                        className="cursor-pointer hover:opacity-80 transition"
                        onClick={() => handleInlineEdit(itemIdx, 0, 'SACADO_TELEFONE', firstRecord.SACADO_TELEFONE || '')}
                      >
                        <p className="text-xs text-[#666666] uppercase font-semibold">Telefone</p>
                        {inlineEditingCell === `${itemIdx}-0-SACADO_TELEFONE` ? (
                          <input
                            ref={inputRef}
                            type="text"
                            value={inlineEditValue}
                            onChange={(e) => setInlineEditValue(e.target.value)}
                            onBlur={() => handleInlineBlur(itemIdx, 0, 'SACADO_TELEFONE')}
                            onKeyDown={(e) => handleInlineKeyDown(e, itemIdx, 0, 'SACADO_TELEFONE')}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full px-2 py-1 bg-[#1a1a1a] border border-white rounded text-white text-sm mt-1"
                          />
                        ) : (
                          <p className="text-white text-sm">{firstRecord.SACADO_TELEFONE || '—'}</p>
                        )}
                      </div>
                      <div
                        className="cursor-pointer hover:opacity-80 transition"
                        onClick={() => handleInlineEdit(itemIdx, 0, 'SACADO_EMAIL', firstRecord.SACADO_EMAIL || '')}
                      >
                        <p className="text-xs text-[#666666] uppercase font-semibold">Email</p>
                        {inlineEditingCell === `${itemIdx}-0-SACADO_EMAIL` ? (
                          <input
                            ref={inputRef}
                            type="text"
                            value={inlineEditValue}
                            onChange={(e) => setInlineEditValue(e.target.value)}
                            onBlur={() => handleInlineBlur(itemIdx, 0, 'SACADO_EMAIL')}
                            onKeyDown={(e) => handleInlineKeyDown(e, itemIdx, 0, 'SACADO_EMAIL')}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full px-2 py-1 bg-[#1a1a1a] border border-white rounded text-white text-sm mt-1"
                          />
                        ) : (
                          <p className="text-white text-sm">{firstRecord.SACADO_EMAIL || '—'}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Parcels Section - Below Sacado */}
                <div className="space-y-0">
                  {/* All parcels displayed as simple rows */}
                  {item._records.map((record, recordIdx) => {
                    const rowId = `${itemIdx}-${recordIdx}`
                    const isSelected = selectedRows.has(rowId)

                    return (
                      <div
                        key={rowId}
                        className={`border-t transition ${
                          isSelected ? 'border-white/30 bg-[#111111]' : 'border-[#1f1f1f] bg-[#0f0f0f]'
                        }`}
                      >
                        <div className="flex items-center gap-3 p-4 group">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation()
                              toggleRow(rowId)
                            }}
                            className="w-4 h-4 cursor-pointer accent-white flex-shrink-0"
                          />

                          <div className="flex-1 flex gap-4 text-sm items-start">
                            {/* Emissão - flex 0.5 */}
                            <div
                              style={{ flex: '0.5' }}
                              className="cursor-pointer hover:opacity-80 transition"
                              onClick={() => handleInlineEdit(itemIdx, recordIdx, 'EMISSAO', record.EMISSAO || '')}
                            >
                              {inlineEditingCell === `${itemIdx}-${recordIdx}-EMISSAO` ? (
                                <input
                                  ref={inputRef}
                                  type="text"
                                  value={inlineEditValue}
                                  onChange={(e) => setInlineEditValue(e.target.value)}
                                  onBlur={() => handleInlineBlur(itemIdx, recordIdx, 'EMISSAO')}
                                  onKeyDown={(e) => handleInlineKeyDown(e, itemIdx, recordIdx, 'EMISSAO')}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full px-2 py-1 bg-[#1a1a1a] border border-white rounded text-white text-sm"
                                />
                              ) : (
                                <>
                                  <p className="text-[#666666] text-xs">Emissão</p>
                                  <p className="text-white font-medium">{record.EMISSAO || '—'}</p>
                                </>
                              )}
                            </div>

                            {/* Título - flex 0.5 */}
                            <div
                              style={{ flex: '0.5' }}
                              className="cursor-pointer hover:opacity-80 transition"
                              onClick={() => handleInlineEdit(itemIdx, recordIdx, 'NUM_TITULO', record.NUM_TITULO || '')}
                            >
                              {inlineEditingCell === `${itemIdx}-${recordIdx}-NUM_TITULO` ? (
                                <input
                                  ref={inputRef}
                                  type="text"
                                  value={inlineEditValue}
                                  onChange={(e) => setInlineEditValue(e.target.value)}
                                  onBlur={() => handleInlineBlur(itemIdx, recordIdx, 'NUM_TITULO')}
                                  onKeyDown={(e) => handleInlineKeyDown(e, itemIdx, recordIdx, 'NUM_TITULO')}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full px-2 py-1 bg-[#1a1a1a] border border-white rounded text-white text-sm"
                                />
                              ) : (
                                <>
                                  <p className="text-[#666666] text-xs">Título</p>
                                  <p className="text-white font-mono font-medium">{record.NUM_TITULO || '—'}</p>
                                </>
                              )}
                            </div>

                            {/* Vencimento - flex 0.5 */}
                            <div
                              style={{ flex: '0.5' }}
                              className="cursor-pointer hover:opacity-80 transition"
                              onClick={() => handleInlineEdit(itemIdx, recordIdx, 'VENCIMENTO', record.VENCIMENTO || '')}
                            >
                              {inlineEditingCell === `${itemIdx}-${recordIdx}-VENCIMENTO` ? (
                                <input
                                  ref={inputRef}
                                  type="text"
                                  value={inlineEditValue}
                                  onChange={(e) => setInlineEditValue(e.target.value)}
                                  onBlur={() => handleInlineBlur(itemIdx, recordIdx, 'VENCIMENTO')}
                                  onKeyDown={(e) => handleInlineKeyDown(e, itemIdx, recordIdx, 'VENCIMENTO')}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full px-2 py-1 bg-[#1a1a1a] border border-white rounded text-white text-sm"
                                />
                              ) : (
                                <>
                                  <p className="text-[#666666] text-xs">Vencimento</p>
                                  <p className="text-white font-medium">{record.VENCIMENTO || '—'}</p>
                                </>
                              )}
                            </div>

                            {/* Valor - flex 0.5 */}
                            <div
                              style={{ flex: '0.5' }}
                              className="cursor-pointer hover:opacity-80 transition"
                              onClick={() => handleInlineEdit(itemIdx, recordIdx, 'VALOR', record.VALOR || '')}
                            >
                              {inlineEditingCell === `${itemIdx}-${recordIdx}-VALOR` ? (
                                <input
                                  ref={inputRef}
                                  type="text"
                                  value={inlineEditValue}
                                  onChange={(e) => setInlineEditValue(e.target.value)}
                                  onBlur={() => handleInlineBlur(itemIdx, recordIdx, 'VALOR')}
                                  onKeyDown={(e) => handleInlineKeyDown(e, itemIdx, recordIdx, 'VALOR')}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full px-2 py-1 bg-[#1a1a1a] border border-white rounded text-white text-sm"
                                />
                              ) : (
                                <>
                                  <p className="text-[#666666] text-xs">Valor</p>
                                  <p className="text-white font-mono font-medium">
                                    R$ {record.VALOR ? parseFloat(record.VALOR).toFixed(2) : '0,00'}
                                  </p>
                                </>
                              )}
                            </div>

                            {/* Sacado - flex 1 */}
                            <div
                              style={{ flex: '1' }}
                              className="flex items-center justify-between cursor-pointer hover:opacity-80 transition"
                              onClick={() => handleInlineEdit(itemIdx, recordIdx, 'SACADO_NOME', record.SACADO_NOME || '')}
                            >
                              <div className="flex-1">
                                {inlineEditingCell === `${itemIdx}-${recordIdx}-SACADO_NOME` ? (
                                  <input
                                    ref={inputRef}
                                    type="text"
                                    value={inlineEditValue}
                                    onChange={(e) => setInlineEditValue(e.target.value)}
                                    onBlur={() => handleInlineBlur(itemIdx, recordIdx, 'SACADO_NOME')}
                                    onKeyDown={(e) => handleInlineKeyDown(e, itemIdx, recordIdx, 'SACADO_NOME')}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full px-2 py-1 bg-[#1a1a1a] border border-white rounded text-white text-sm"
                                  />
                                ) : (
                                  <>
                                    <p className="text-[#666666] text-xs">Sacado</p>
                                    <p className="text-white font-medium truncate">{record.SACADO_NOME || '—'}</p>
                                  </>
                                )}
                              </div>
                              {recordIdx === 0 && inlineEditingCell !== `${itemIdx}-${recordIdx}-SACADO_NOME` && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setInstalmentModal({ itemIdx })
                                  }}
                                  className="ml-4 px-2 py-1 text-white hover:text-[#a3a3a3] text-lg flex-shrink-0"
                                  title="Adicionar parcelas"
                                >
                                  +
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <div className="border-t border-[#1f1f1f] p-6 flex gap-3 justify-between items-center">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedRows.size === getTotalRecords() && getTotalRecords() > 0}
              onChange={toggleAll}
              className="w-4 h-4 cursor-pointer accent-white"
            />
            <span className="text-sm text-[#666666]">Selecionar todos</span>
          </label>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={isImporting}
              className="px-6 py-2 bg-transparent text-white text-sm font-medium border border-[#2a2a2a] rounded hover:bg-[#111111] transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleImport}
              disabled={isImporting || selectedRows.size === 0}
              className="px-6 py-2 bg-white text-black text-sm font-medium rounded hover:opacity-90 transition disabled:opacity-50"
            >
              {isImporting ? 'Importando...' : `Importar (${selectedRows.size})`}
            </button>
          </div>
        </div>
      </div>

      {instalmentModal && (
        <InstalmentModal
          item={dataWithInstalments[instalmentModal.itemIdx]}
          onConfirm={handleInstalmentConfirm}
          onCancel={() => setInstalmentModal(null)}
        />
      )}
    </div>
  )
}
