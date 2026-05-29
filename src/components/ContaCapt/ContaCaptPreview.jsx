import { useState, useRef, useEffect } from 'react'
import { createBoleto, createBoletosBulk } from '../../services/boletoService'
import { supabase } from '../../lib/supabase'

export default function ContaCaptPreview({ previewData, onCancel }) {
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [isImporting, setIsImporting] = useState(false)
  const [inlineEditingCell, setInlineEditingCell] = useState(null)
  const [inlineEditValue, setInlineEditValue] = useState('')
  const [editedData, setEditedData] = useState([])
  const [verificando, setVerificando] = useState(true)
  const [duplicadosOcultos, setDuplicadosOcultos] = useState(0)
  const [contaMap, setContaMap] = useState({}) // código (7 díg.) -> { id, nome }
  const inputRef = useRef(null)

  // Carrega o mapa de contas (código da linha digitável -> conta) p/ exibir e vincular
  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const { data } = await supabase.from('CONTAS').select('id, conta, nome_correntista')
        if (cancel) return
        const m = {}
        ;(data || []).forEach(c => {
          const cod = String(c.conta || '').replace(/\D/g, '').padStart(8, '0').substring(0, 7)
          if (cod) m[cod] = { id: c.id, nome: c.nome_correntista || c.conta || cod }
        })
        setContaMap(m)
      } catch (e) {
        console.warn('[ContaCaptPreview] Falha ao carregar mapa de contas:', e.message)
      }
    })()
    return () => { cancel = true }
  }, [])

  useEffect(() => {
    if (inlineEditingCell && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [inlineEditingCell])

  // Ao abrir o preview, mostra apenas os registros que SERÃO gravados:
  // remove os que já existem em capt_boletos (por Linha digitável OU número do documento)
  // e também os duplicados internos do próprio arquivo.
  useEffect(() => {
    let cancelado = false
    const normDoc = (d) => String(d || '').trim().replace(/^0+/, '').toLowerCase()

    const filtrarNovos = async () => {
      setVerificando(true)
      const existentesCB = new Set()
      const existentesDoc = new Set()
      try {
        const pageSize = 1000
        let from = 0
        while (true) {
          const { data, error } = await supabase
            .from('capt_boletos')
            .select('codigo_barras, numero_documento')
            .range(from, from + pageSize - 1)
          if (error) { console.warn('[ContaCaptPreview] Aviso ao checar duplicados:', error.message); break }
          if (!data || data.length === 0) break
          data.forEach(b => {
            if (b.codigo_barras) existentesCB.add(String(b.codigo_barras).replace(/\D/g, ''))
            if (b.numero_documento) existentesDoc.add(normDoc(b.numero_documento))
          })
          if (data.length < pageSize) break
          from += pageSize
        }
      } catch (e) {
        console.warn('[ContaCaptPreview] Falha ao carregar duplicados:', e.message)
      }
      if (cancelado) return

      const vistosCB = new Set()
      const vistosDoc = new Set()
      const novos = (previewData || []).filter(row => {
        const cb = String(row?.CODIGO_BARRAS || '').replace(/\D/g, '')
        const doc = normDoc(row?.NUMERO_DOCUMENTO || row?.NUM_TITULO)
        // já existe no banco?
        if ((cb && existentesCB.has(cb)) || (doc && existentesDoc.has(doc))) return false
        // duplicado dentro do próprio arquivo?
        if ((cb && vistosCB.has(cb)) || (doc && vistosDoc.has(doc))) return false
        if (cb) vistosCB.add(cb)
        if (doc) vistosDoc.add(doc)
        return true
      })

      setDuplicadosOcultos((previewData || []).length - novos.length)
      setEditedData(novos)
      setSelectedRows(new Set(novos.map((_, i) => i)))
      setVerificando(false)
      console.log(`[ContaCaptPreview] ${novos.length} novo(s) de ${(previewData || []).length} (ocultados ${(previewData || []).length - novos.length} já existentes/duplicados)`)

      // Nenhum registro novo: informa que não há nada a inserir
      if (novos.length === 0) {
        alert('Não há registros a serem inseridos. Todos os boletos do arquivo já existem em capt_boletos.')
      }
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
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    const activeId = localStorage.getItem('activeContaId') || user.id

    // O preview já mostra apenas registros novos (duplicados foram filtrados na abertura).
    const boletos = Array.from(selectedRows).map(idx => editedData[idx]).filter(Boolean)

    // Agrupa cada boleto na conta correspondente (extraída da linha digitável).
    // Usa o mapa já carregado (contaMap). Se não encontrar, cai na conta ativa.
    const grupos = {}
    let semConta = 0
    for (const b of boletos) {
      const cod = String(b.CONTA_CODIGO || '').replace(/\D/g, '')
      const contaId = contaMap[cod]?.id || activeId
      if (!contaMap[cod]) semConta++
      if (!grupos[contaId]) grupos[contaId] = []
      grupos[contaId].push(b)
    }

    // Inserção em lote por conta (otimizada)
    let imported = 0
    let errors = 0
    for (const [contaId, lista] of Object.entries(grupos)) {
      try {
        const { data, error } = await createBoletosBulk(contaId, lista)
        if (error) {
          errors += lista.length
          console.error('[ContaCaptPreview] Erro no import em lote (conta', contaId, '):', error.message)
        } else {
          imported += data.imported
          errors += data.errors
        }
      } catch (err) {
        errors += lista.length
        console.error('[ContaCaptPreview] Exceção no import em lote (conta', contaId, '):', err)
      }
    }

    setIsImporting(false)

    let message = `Importação concluída!\n${imported} boleto(s) importado(s) com sucesso.\n${errors} erro(s) durante o processo.`
    if (semConta > 0) {
      message += `\n${semConta} sem conta correspondente — gravado(s) na conta ativa.`
    }
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
            {verificando
              ? 'Verificando registros já existentes...'
              : `Apenas registros novos: ${selectedRows.size} de ${editedData.length} selecionado(s)${duplicadosOcultos > 0 ? ` · ${duplicadosOcultos} já existente(s)/duplicado(s) ocultado(s)` : ''}`}
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
                  <div style={{ width: '180px' }}>Conta</div>
                </div>
              </div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-[#1f1f1f]">
              {verificando && (
                <div className="px-4 py-6 text-center text-sm text-[#666666]">Verificando registros já existentes...</div>
              )}
              {!verificando && editedData.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-[#666666]">Nenhum registro novo para importar — todos já existem em capt_boletos.</div>
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
                    {/* Conta vinculada (extraída da linha digitável) */}
                    <div style={{ width: '180px' }}>
                      {(() => {
                        const cod = String(row.CONTA_CODIGO || '').replace(/\D/g, '')
                        const c = contaMap[cod]
                        return c
                          ? <p className="text-white text-xs truncate" title={c.nome}>{c.nome}</p>
                          : <p className="text-[#ef4444] text-xs truncate" title="Conta não encontrada — usará a conta ativa">— (conta ativa)</p>
                      })()}
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
