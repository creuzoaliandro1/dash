import { useState, useRef, useEffect } from 'react'
import { importContaCaptToRegistrado } from '../../services/boletoService'
import { supabase } from '../../lib/supabase'

export default function ContaCaptPreview({ previewData, onCancel }) {
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [isImporting, setIsImporting] = useState(false)
  const [inlineEditingCell, setInlineEditingCell] = useState(null)
  const [inlineEditValue, setInlineEditValue] = useState('')
  const [editedData, setEditedData] = useState([])
  const [verificando, setVerificando] = useState(true)
  const [duplicadosOcultos, setDuplicadosOcultos] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    if (inlineEditingCell && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [inlineEditingCell])

  // Ao abrir o preview, exibe todos os registros do arquivo (menos duplicados internos).
  // Registros já existentes em capt_registrado serão ATUALIZADOS; novos serão INSERIDOS.
  // Registros duplicados dentro do próprio arquivo (mesma linha digitável) são ocultados.
  useEffect(() => {
    let cancelado = false

    const filtrarNovos = async () => {
      setVerificando(true)

      // Buscar linha digitável já existentes em capt_registrado
      const existentesReg = new Set()
      try {
        const pageSize = 1000
        let from = 0
        while (true) {
          const { data, error } = await supabase
            .from('capt_registrado')
            .select('num_linha_digtvl')
            .range(from, from + pageSize - 1)
          if (error) { console.warn('[ContaCaptPreview] Aviso ao checar capt_registrado:', error.message); break }
          if (!data || data.length === 0) break
          data.forEach(r => {
            if (r.num_linha_digtvl) existentesReg.add(String(r.num_linha_digtvl).replace(/\D/g, ''))
          })
          if (data.length < pageSize) break
          from += pageSize
        }
      } catch (e) {
        console.warn('[ContaCaptPreview] Falha ao carregar capt_registrado:', e.message)
      }
      if (cancelado) return

      // Remover apenas duplicados internos do arquivo (mesma linha digitável)
      const vistosCB = new Set()
      const processados = (previewData || []).filter(row => {
        const cb = String(row?.CODIGO_BARRAS || '').replace(/\D/g, '')
        if (cb && vistosCB.has(cb)) return false
        if (cb) vistosCB.add(cb)
        return true
      })

      // Classificar cada linha: inserir ou atualizar
      const classificados = processados.map(row => {
        const cb = String(row?.CODIGO_BARRAS || '').replace(/\D/g, '')
        return { ...row, _acao: (cb && existentesReg.has(cb)) ? 'atualizar' : 'inserir' }
      })

      const duplicadosInternos = (previewData || []).length - processados.length
      setDuplicadosOcultos(duplicadosInternos)
      setEditedData(classificados)
      setSelectedRows(new Set(classificados.map((_, i) => i)))
      setVerificando(false)

      const aInserir = classificados.filter(r => r._acao === 'inserir').length
      const aAtualizar = classificados.filter(r => r._acao === 'atualizar').length
      console.log(`[ContaCaptPreview] ${aInserir} a inserir, ${aAtualizar} a atualizar em capt_registrado${duplicadosInternos > 0 ? `, ${duplicadosInternos} duplicado(s) interno(s) ocultado(s)` : ''}`)
    }

    filtrarNovos()
    return () => { cancelado = true }
  }, [previewData])

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

    const boletos = Array.from(selectedRows).map(idx => editedData[idx]).filter(Boolean)

    const { data, error } = await importContaCaptToRegistrado(boletos)

    setIsImporting(false)

    if (error) {
      alert(`Erro na importação: ${error.message}`)
      return
    }

    const { inserted = 0, updated = 0, deletedFromBoletos = 0, errors = 0 } = data || {}
    let message = `Importação concluída!\n${inserted} inserido(s) em capt_registrado.\n${updated} atualizado(s) em capt_registrado.`
    if (deletedFromBoletos > 0) message += `\n${deletedFromBoletos} removido(s) de capt_boletos (migrado para capt_registrado).`
    if (errors > 0) message += `\n${errors} erro(s) durante o processo.`
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg max-w-7xl w-full max-h-[90vh] flex flex-col">
        <div className="border-b border-[#1f1f1f] px-5 py-3">
          <h2 className="text-base font-semibold text-white">Visualizar dados para importação - Conta Capt</h2>
          <p className="text-xs text-[#666666]">
            {verificando
              ? 'Verificando registros em capt_registrado...'
              : (() => {
                  const aInserir = editedData.filter(r => r._acao === 'inserir').length
                  const aAtualizar = editedData.filter(r => r._acao === 'atualizar').length
                  const partes = []
                  if (aInserir > 0) partes.push(`${aInserir} a inserir`)
                  if (aAtualizar > 0) partes.push(`${aAtualizar} a atualizar`)
                  const resumo = partes.length ? partes.join(', ') : 'nenhum registro'
                  return `capt_registrado — ${resumo}${duplicadosOcultos > 0 ? ` · ${duplicadosOcultos} duplicado(s) interno(s) ocultado(s)` : ''} · ${selectedRows.size} selecionado(s)`
                })()}
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
                  <div style={{ width: '100px' }}>Ação</div>
                </div>
              </div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-[#1f1f1f]">
              {verificando && (
                <div className="px-4 py-6 text-center text-sm text-[#666666]">Verificando registros já existentes...</div>
              )}
              {!verificando && editedData.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-[#666666]">Nenhum registro válido encontrado no arquivo.</div>
              )}
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
                    {/* Ação: inserir ou atualizar em capt_registrado */}
                    <div style={{ width: '100px' }}>
                      {row._acao === 'atualizar'
                        ? <span className="text-yellow-400 text-xs font-medium">Atualizar</span>
                        : <span className="text-green-400 text-xs font-medium">Inserir</span>}
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
              disabled={isImporting || verificando || selectedRows.size === 0}
              className="px-6 py-2 bg-white text-black text-sm font-medium rounded hover:opacity-90 transition disabled:opacity-50"
            >
              {isImporting ? 'Importando...' : verificando ? 'Verificando...' : `Importar (${selectedRows.size})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
