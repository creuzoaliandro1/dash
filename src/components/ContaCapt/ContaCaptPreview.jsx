import { useState, useRef, useEffect } from 'react'
import { createBoleto } from '../../services/boletoService'

export default function ContaCaptPreview({ previewData, onCancel }) {
  const [selectedRows, setSelectedRows] = useState(
    new Set(previewData.map((_, idx) => idx))
  )
  const [isImporting, setIsImporting] = useState(false)
  const [inlineEditingCell, setInlineEditingCell] = useState(null)
  const [inlineEditValue, setInlineEditValue] = useState('')
  const [editedData, setEditedData] = useState([...previewData])
  const inputRef = useRef(null)

  useEffect(() => {
    if (inlineEditingCell && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [inlineEditingCell])

  const handleInlineEdit = (rowIdx, field, value) => {
    setInlineEditingCell(`${rowIdx}-${field}`)
    setInlineEditValue(value)
  }

  const handleInlineBlur = (rowIdx, field) => {
    const newData = [...editedData]
    newData[rowIdx] = {
      ...newData[rowIdx],
      [field]: inlineEditValue,
    }
    setEditedData(newData)
    setInlineEditingCell(null)
  }

  const handleInlineKeyDown = (e, rowIdx, field) => {
    if (e.key === 'Enter') {
      handleInlineBlur(rowIdx, field)
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

  const toggleAll = () => {
    if (selectedRows.size === editedData.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(editedData.map((_, idx) => idx)))
    }
  }

  const handleImport = async () => {
    setIsImporting(true)
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    const activeId = localStorage.getItem('activeContaId') || user.id

    let imported = 0
    let errors = 0

    for (const idx of selectedRows) {
      const boletoData = editedData[idx]

      try {
        const { error } = await createBoleto(activeId, boletoData)
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

    const message = `Importação concluída!\n${imported} boleto(s) importado(s) com sucesso.\n${errors} erro(s) durante o processo.`
    alert(message)
    onCancel()
  }

  const formatCurrency = (value) => {
    if (!value || value === '—') return '—'
    const num = parseFloat(String(value).replace(/[^\d.-]/g, '')) || 0
    return 'R$ ' + num.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg max-w-7xl w-full max-h-[90vh] flex flex-col">
        <div className="border-b border-[#1f1f1f] px-5 py-3">
          <h2 className="text-base font-semibold text-white">Visualizar dados para importação - Conta Capt</h2>
          <p className="text-xs text-[#666666]">
            Revise os registros e selecione quais deseja importar ({selectedRows.size} de {editedData.length} selecionado(s))
          </p>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="min-w-max">
            {/* Header */}
            <div className="sticky top-0 z-10">
              <div className="flex items-center gap-3 bg-[#111111] border-b border-[#1f1f1f] px-4 py-2">
                <input
                  type="checkbox"
                  checked={selectedRows.size === editedData.length && editedData.length > 0}
                  onChange={toggleAll}
                  className="w-4 h-4 cursor-pointer accent-white flex-shrink-0"
                />
                <div className="flex gap-2 text-xs font-semibold text-[#666666] uppercase tracking-wider">
                  <div style={{ width: '120px' }}>Documento</div>
                  <div style={{ width: '180px' }}>Sacado</div>
                  <div style={{ width: '100px' }}>CPF/CNPJ</div>
                  <div style={{ width: '100px' }}>Valor</div>
                  <div style={{ width: '100px' }}>Emissão</div>
                  <div style={{ width: '100px' }}>Vencimento</div>
                  <div style={{ width: '150px' }}>Email</div>
                  <div style={{ width: '120px' }}>Telefone</div>
                  <div style={{ width: '200px' }}>Endereço</div>
                  <div style={{ width: '80px' }}>Cidade</div>
                  <div style={{ width: '50px' }}>UF</div>
                </div>
              </div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-[#1f1f1f]">
              {editedData.map((row, idx) => (
                <div key={idx} className={`flex items-center gap-3 px-4 py-2 ${selectedRows.has(idx) ? 'bg-[#111111]' : 'hover:bg-[#0f0f0f]'}`}>
                  <input
                    type="checkbox"
                    checked={selectedRows.has(idx)}
                    onChange={() => toggleRow(idx)}
                    className="w-4 h-4 cursor-pointer accent-white flex-shrink-0"
                  />
                  <div className="flex gap-2 text-xs">
                    {/* Documento */}
                    <div
                      style={{ width: '120px' }}
                      className="cursor-pointer hover:opacity-80"
                      onClick={() => handleInlineEdit(idx, 'NUMERO_DOCUMENTO', row.NUMERO_DOCUMENTO)}
                    >
                      {inlineEditingCell === `${idx}-NUMERO_DOCUMENTO` ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={inlineEditValue}
                          onChange={(e) => setInlineEditValue(e.target.value)}
                          onBlur={() => handleInlineBlur(idx, 'NUMERO_DOCUMENTO')}
                          onKeyDown={(e) => handleInlineKeyDown(e, idx, 'NUMERO_DOCUMENTO')}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-2 py-0.5 bg-[#1a1a1a] border border-white rounded text-white text-xs"
                        />
                      ) : (
                        <p className="text-white truncate">{row.NUMERO_DOCUMENTO || '—'}</p>
                      )}
                    </div>

                    {/* Sacado */}
                    <div
                      style={{ width: '180px' }}
                      className="cursor-pointer hover:opacity-80"
                      onClick={() => handleInlineEdit(idx, 'SACADO_NOME', row.SACADO_NOME)}
                    >
                      {inlineEditingCell === `${idx}-SACADO_NOME` ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={inlineEditValue}
                          onChange={(e) => setInlineEditValue(e.target.value)}
                          onBlur={() => handleInlineBlur(idx, 'SACADO_NOME')}
                          onKeyDown={(e) => handleInlineKeyDown(e, idx, 'SACADO_NOME')}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-2 py-0.5 bg-[#1a1a1a] border border-white rounded text-white text-xs"
                        />
                      ) : (
                        <p className="text-white truncate">{row.SACADO_NOME || '—'}</p>
                      )}
                    </div>

                    {/* CPF/CNPJ */}
                    <div style={{ width: '100px' }} className="text-[#a3a3a3]">
                      <p className="truncate">{row.SACADO_CIC || '—'}</p>
                    </div>

                    {/* Valor */}
                    <div style={{ width: '100px' }} className="text-[#a3a3a3] text-right">
                      {formatCurrency(row.VALOR)}
                    </div>

                    {/* Emissão */}
                    <div style={{ width: '100px' }} className="text-[#a3a3a3]">
                      <p className="text-xs">{row.EMISSAO || '—'}</p>
                    </div>

                    {/* Vencimento */}
                    <div style={{ width: '100px' }} className="text-[#a3a3a3]">
                      <p className="text-xs">{row.VENCIMENTO || '—'}</p>
                    </div>

                    {/* Email */}
                    <div style={{ width: '150px' }} className="text-[#a3a3a3]">
                      <p className="text-xs truncate">{row.SACADO_EMAIL || '—'}</p>
                    </div>

                    {/* Telefone */}
                    <div style={{ width: '120px' }} className="text-[#a3a3a3]">
                      <p className="text-xs">{row.SACADO_TELEFONE || '—'}</p>
                    </div>

                    {/* Endereço */}
                    <div style={{ width: '200px' }} className="text-[#a3a3a3]">
                      <p className="text-xs truncate">{row.SACADO_ENDERECO || '—'}</p>
                    </div>

                    {/* Cidade */}
                    <div style={{ width: '80px' }} className="text-[#a3a3a3]">
                      <p className="text-xs">{row.SACADO_CIDADE || '—'}</p>
                    </div>

                    {/* UF */}
                    <div style={{ width: '50px' }} className="text-[#a3a3a3]">
                      <p className="text-xs">{row.SACADO_UF || '—'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#1f1f1f] px-5 py-3 flex gap-3 justify-between items-center">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedRows.size === editedData.length && editedData.length > 0}
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
    </div>
  )
}
