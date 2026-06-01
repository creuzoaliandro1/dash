import { useState, useRef, useEffect } from 'react'
import { createBoleto, getAllContas, uploadAnexoBoleto } from '../../services/boletoService'
import { verificarCodigoBarrasExistente, gerarRelatorioPDFErros, downloadPDFRelatorio } from '../../services/boletoImportService'
import InstalmentModal from './InstalmentModal'

// Função para formatar valor em padrão brasileiro (55.457,87)
function formatarValorBrasileiro(valor) {
  if (!valor && valor !== 0) return '—'
  const num = typeof valor === 'string' ? parseFloat(valor.replace(/[^\d.-]/g, '').replace(',', '.')) : valor
  if (isNaN(num)) return '—'
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Função para formatar data em padrão brasileiro dd/mm/aa (ano com 2 dígitos)
function formatarDataBrasileira(data) {
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

export default function ImportPreview({ previewData, userId, onImportComplete, onCancel, userType, allContas }) {
  // Avalista padrão = dados do perfil logado (conta ativa, ou usuário do localStorage)
  const _loggedUser = JSON.parse(localStorage.getItem('user') || '{}')
  const _activeId = localStorage.getItem('activeContaId') || userId || _loggedUser.id
  const _activeConta = (allContas || []).find(c => String(c.id) === String(_activeId))
  const avalistaNome = _activeConta?.nome_correntista || _loggedUser.name || _loggedUser.nome || ''
  const avalistaCic = String(_activeConta?.cic || _loggedUser.cic || '').replace(/\D/g, '')

  const [dataWithInstalments, setDataWithInstalments] = useState(
    previewData.map(item => {
      // Preenche AVALISTA com o perfil logado por padrão
      const base = { ...item, AVALISTA_NOME: avalistaNome, AVALISTA_CIC: avalistaCic }
      // Se o item já tem parcelas pré-preenchidas (de arquivo OS com múltiplos vencimentos)
      if (base._parcelas && base._parcelas.length > 0) {
        return {
          ...base,
          _records: base._parcelas.map(parcela => ({
            ...base,
            NUM_TITULO: parcela.number,
            VENCIMENTO: parcela.dueDate,
            VALOR: parcela.value,
            EMISSAO: parcela.emission,
          }))
        }
      }
      return {
        ...base,
        _records: [base]
      }
    })
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
  const [errosImportacao, setErrosImportacao] = useState([])
  const [relatorioPDF, setRelatorioPDF] = useState(null)
  const [arquivosAnexados, setArquivosAnexados] = useState({}) // { itemIdx: [files] }
  const inputRef = useRef(null)
  const fileInputRefs = useRef({})

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

  // Funções para gerenciar anexos
  const handleAnexoFileSelect = (itemIdx, event) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    const novosArquivos = [...(arquivosAnexados[itemIdx] || [])]
    files.forEach(file => {
      // Validar tipo
      if (!['application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/xml', 'application/xml'].includes(file.type)) {
        alert(`Tipo de arquivo não permitido: ${file.type}`)
        return
      }
      novosArquivos.push(file)
    })

    setArquivosAnexados({
      ...arquivosAnexados,
      [itemIdx]: novosArquivos
    })

    // Limpar input
    event.target.value = ''
  }

  const handleRemoverAnexo = (itemIdx, fileIndex) => {
    const novosArquivos = [...(arquivosAnexados[itemIdx] || [])]
    novosArquivos.splice(fileIndex, 1)
    setArquivosAnexados({
      ...arquivosAnexados,
      [itemIdx]: novosArquivos
    })
  }

  const handleImport = async () => {
    setIsImporting(true)
    let imported = 0
    let errors = 0
    const erros = [] // Rastrear detalhes dos erros

    // Se é Master, usar mapa de contas para vincular boletos
    let contaMap = {}
    console.log(`[ImportPreview] DEBUG: userType="${userType}", allContas=${allContas ? allContas.length : 'null'}`)
    if (userType === 'M' && allContas && allContas.length > 0) {
      console.log('[ImportPreview] Criando mapa de contas. Total:', allContas.length)
      allContas.forEach(conta => {
        const contaValue = String(conta.conta || '').trim()
        if (contaValue) {
          const contaFull = contaValue.padStart(8, '0')
          const codigo = contaFull.substring(0, 7)
          contaMap[codigo] = conta.id
        }
      })
    }

    let linhaAtual = 2 // Começar em 2 (linha 1 é header)

    for (const rowId of selectedRows) {
      const [itemIdx, recordIdx] = rowId.split('-').map(Number)
      const boletoData = dataWithInstalments[itemIdx]?._records?.[recordIdx]

      if (!boletoData) {
        console.error(`[ImportPreview] Dados do boleto não encontrados: itemIdx=${itemIdx}, recordIdx=${recordIdx}`)
        errors++
        linhaAtual++
        continue
      }

      try {
        // 1. Verificar se código de barras já existe (DUPLICADO)
        const codigoBarras = boletoData.CODIGO_BARRAS || ''
        if (codigoBarras) {
          const jáExiste = await verificarCodigoBarrasExistente(codigoBarras)
          if (jáExiste) {
            console.warn(`[ImportPreview] Código de barras duplicado: ${codigoBarras}`)
            erros.push({
              linha: linhaAtual,
              numero_documento: boletoData.NUM_TITULO,
              sacado_nome: boletoData.SACADO_NOME,
              codigo_barras: codigoBarras,
              valor: boletoData.VALOR,
              motivo: 'duplicado'
            })
            errors++
            linhaAtual++
            continue
          }
        }

        // 2. Determinar qual userId usar
        let targetUserId = userId

        if (userType === 'M' && boletoData.CONTA_CODIGO) {
          // Master: procurar a conta correta
          const contaId = contaMap[boletoData.CONTA_CODIGO]
          if (!contaId) {
            console.warn(`[ImportPreview] Conta não encontrada para: ${boletoData.CONTA_CODIGO}`)
            erros.push({
              linha: linhaAtual,
              numero_documento: boletoData.NUM_TITULO,
              sacado_nome: boletoData.SACADO_NOME,
              codigo_barras: codigoBarras,
              valor: boletoData.VALOR,
              motivo: 'conta_nao_encontrada'
            })
            errors++
            linhaAtual++
            continue
          }
          targetUserId = contaId
        }

        // 3. Importar boleto
        const { data: boletoResult, error } = await createBoleto(targetUserId, boletoData)
        if (error) {
          console.error('[ImportPreview] Erro ao salvar boleto:', error)
          errors++
        } else {
          imported++

          // 4. Upload dos anexos se houver
          if (arquivosAnexados[itemIdx] && arquivosAnexados[itemIdx].length > 0 && boletoResult && boletoResult.id) {
            console.log(`[ImportPreview] Fazendo upload de ${arquivosAnexados[itemIdx].length} arquivo(s) para boleto ${boletoResult.id}`)
            for (const file of arquivosAnexados[itemIdx]) {
              try {
                await uploadAnexoBoleto(boletoResult.id, file, targetUserId)
                console.log(`[ImportPreview] ✓ Arquivo ${file.name} anexado com sucesso`)
              } catch (erroAnexo) {
                console.warn(`[ImportPreview] Erro ao anexar ${file.name}:`, erroAnexo)
              }
            }
          }
        }
      } catch (err) {
        console.error('[ImportPreview] Erro ao importar boleto:', err)
        errors++
      }

      linhaAtual++
    }

    // Gerar relatório PDF se houver erros
    if (erros.length > 0) {
      const pdfBlob = gerarRelatorioPDFErros(erros)
      setRelatorioPDF(pdfBlob)
      setErrosImportacao(erros)
    }

    setIsImporting(false)
    onImportComplete({
      imported,
      errors,
      total: selectedRows.size,
      erros, // Passar erros detalhados
      pdfRelatorio: erros.length > 0 ? relatorioPDF : null
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg max-w-[95vw] w-full max-h-[90vh] flex flex-col">
        <div className="border-b border-[#1f1f1f] px-5 py-3">
          <h2 className="text-base font-semibold text-white">Visualizar dados para importação</h2>
          <p className="text-xs text-[#666666]">
            Revise os registros e selecione quais deseja importar ({selectedRows.size} de {getTotalRecords()} selecionado(s))
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
          {dataWithInstalments.map((item, itemIdx) => {
            const firstRecord = item._records[0]
            const firstRowId = `${itemIdx}-0`
            const isFirstSelected = selectedRows.has(firstRowId)
            const isFirstExpanded = expandedRows.has(firstRowId)
            const hasMultiple = item._records.length > 1

            return (
              <div key={`group-${itemIdx}`} className="border-2 border-[#444444] rounded-lg overflow-hidden">
                {/* HEADER: Todas as linhas (correntista + parcelas) */}
                <div className="bg-[#151515]">

                  {/* LINHA 1: Dados do Correntista */}
                  <div className="px-4 py-2 border-b border-[#000000] flex items-start gap-2 text-sm overflow-x-auto">
                    {/* Nome */}
                    <div
                      className="flex-1 flex-shrink-0 cursor-pointer hover:opacity-80 transition"
                      onClick={() => handleInlineEdit(itemIdx, 0, 'SACADO_NOME', firstRecord.SACADO_NOME || '')}
                    >
                      <p className="text-sm text-[#707070] uppercase font-semibold leading-none mb-0.5">Nome</p>
                      {inlineEditingCell === `${itemIdx}-0-SACADO_NOME` ? (
                        <input ref={inputRef} type="text" value={inlineEditValue}
                          onChange={(e) => setInlineEditValue(e.target.value)}
                          onBlur={() => handleInlineBlur(itemIdx, 0, 'SACADO_NOME')}
                          onKeyDown={(e) => handleInlineKeyDown(e, itemIdx, 0, 'SACADO_NOME')}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-2 py-0.5 bg-[#1a1a1a] border border-white rounded text-white text-sm"
                        />
                      ) : (
                        <p className="text-white text-sm truncate">{firstRecord.SACADO_NOME || '—'}</p>
                      )}
                    </div>
                    {/* CPF/CNPJ */}
                    <div
                      className="flex-1 cursor-pointer hover:opacity-80 transition"
                      onClick={() => handleInlineEdit(itemIdx, 0, 'SACADO_CIC', firstRecord.SACADO_CIC || '')}
                    >
                      <p className="text-sm text-[#707070] uppercase font-semibold leading-none mb-0.5">CPF/CNPJ</p>
                      {inlineEditingCell === `${itemIdx}-0-SACADO_CIC` ? (
                        <input ref={inputRef} type="text" value={inlineEditValue}
                          onChange={(e) => setInlineEditValue(e.target.value)}
                          onBlur={() => handleInlineBlur(itemIdx, 0, 'SACADO_CIC')}
                          onKeyDown={(e) => handleInlineKeyDown(e, itemIdx, 0, 'SACADO_CIC')}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-2 py-0.5 bg-[#1a1a1a] border border-white rounded text-white text-sm"
                        />
                      ) : (
                        <p className="text-white text-sm font-mono">{firstRecord.SACADO_CIC || '—'}</p>
                      )}
                    </div>
                    {/* Telefone */}
                    <div
                      className="flex-1 cursor-pointer hover:opacity-80 transition"
                      onClick={() => handleInlineEdit(itemIdx, 0, 'SACADO_TELEFONE', firstRecord.SACADO_TELEFONE || '')}
                    >
                      <p className="text-sm text-[#707070] uppercase font-semibold leading-none mb-0.5">Telefone</p>
                      {inlineEditingCell === `${itemIdx}-0-SACADO_TELEFONE` ? (
                        <input ref={inputRef} type="text" value={inlineEditValue}
                          onChange={(e) => setInlineEditValue(e.target.value)}
                          onBlur={() => handleInlineBlur(itemIdx, 0, 'SACADO_TELEFONE')}
                          onKeyDown={(e) => handleInlineKeyDown(e, itemIdx, 0, 'SACADO_TELEFONE')}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-2 py-0.5 bg-[#1a1a1a] border border-white rounded text-white text-sm"
                        />
                      ) : (
                        <p className="text-white text-sm">{firstRecord.SACADO_TELEFONE || '—'}</p>
                      )}
                    </div>
                    {/* Email */}
                    <div
                      className="flex-1 cursor-pointer hover:opacity-80 transition"
                      onClick={() => handleInlineEdit(itemIdx, 0, 'SACADO_EMAIL', firstRecord.SACADO_EMAIL || '')}
                    >
                      <p className="text-sm text-[#707070] uppercase font-semibold leading-none mb-0.5">Email</p>
                      {inlineEditingCell === `${itemIdx}-0-SACADO_EMAIL` ? (
                        <input ref={inputRef} type="text" value={inlineEditValue}
                          onChange={(e) => setInlineEditValue(e.target.value)}
                          onBlur={() => handleInlineBlur(itemIdx, 0, 'SACADO_EMAIL')}
                          onKeyDown={(e) => handleInlineKeyDown(e, itemIdx, 0, 'SACADO_EMAIL')}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-2 py-0.5 bg-[#1a1a1a] border border-white rounded text-white text-sm"
                        />
                      ) : (
                        <p className="text-white text-sm truncate">{firstRecord.SACADO_EMAIL || '—'}</p>
                      )}
                    </div>
                    {/* Endereço */}
                    <div
                      className="flex-1 cursor-pointer hover:opacity-80 transition"
                      onClick={() => handleInlineEdit(itemIdx, 0, 'SACADO_ENDERECO', firstRecord.SACADO_ENDERECO || '')}
                    >
                      <p className="text-sm text-[#707070] uppercase font-semibold leading-none mb-0.5">Endereço</p>
                      {inlineEditingCell === `${itemIdx}-0-SACADO_ENDERECO` ? (
                        <input ref={inputRef} type="text" value={inlineEditValue}
                          onChange={(e) => setInlineEditValue(e.target.value)}
                          onBlur={() => handleInlineBlur(itemIdx, 0, 'SACADO_ENDERECO')}
                          onKeyDown={(e) => handleInlineKeyDown(e, itemIdx, 0, 'SACADO_ENDERECO')}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-2 py-0.5 bg-[#1a1a1a] border border-white rounded text-white text-sm"
                        />
                      ) : (
                        <p className="text-white text-sm truncate whitespace-nowrap">{String(firstRecord.SACADO_ENDERECO || '—').substring(0, 30)}</p>
                      )}
                    </div>
                    {/* Bairro */}
                    <div
                      className="flex-1 cursor-pointer hover:opacity-80 transition"
                      onClick={() => handleInlineEdit(itemIdx, 0, 'SACADO_BAIRRO', firstRecord.SACADO_BAIRRO || '')}
                    >
                      <p className="text-sm text-[#707070] uppercase font-semibold leading-none mb-0.5">Bairro</p>
                      {inlineEditingCell === `${itemIdx}-0-SACADO_BAIRRO` ? (
                        <input ref={inputRef} type="text" value={inlineEditValue}
                          onChange={(e) => setInlineEditValue(e.target.value)}
                          onBlur={() => handleInlineBlur(itemIdx, 0, 'SACADO_BAIRRO')}
                          onKeyDown={(e) => handleInlineKeyDown(e, itemIdx, 0, 'SACADO_BAIRRO')}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-2 py-0.5 bg-[#1a1a1a] border border-white rounded text-white text-sm"
                        />
                      ) : (
                        <p className="text-white text-sm truncate">{firstRecord.SACADO_BAIRRO || '—'}</p>
                      )}
                    </div>
                    {/* CEP */}
                    <div
                      className="flex-1 cursor-pointer hover:opacity-80 transition"
                      onClick={() => handleInlineEdit(itemIdx, 0, 'SACADO_CEP', firstRecord.SACADO_CEP || '')}
                    >
                      <p className="text-sm text-[#707070] uppercase font-semibold leading-none mb-0.5">CEP</p>
                      {inlineEditingCell === `${itemIdx}-0-SACADO_CEP` ? (
                        <input ref={inputRef} type="text" value={inlineEditValue}
                          onChange={(e) => setInlineEditValue(e.target.value)}
                          onBlur={() => handleInlineBlur(itemIdx, 0, 'SACADO_CEP')}
                          onKeyDown={(e) => handleInlineKeyDown(e, itemIdx, 0, 'SACADO_CEP')}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-2 py-0.5 bg-[#1a1a1a] border border-white rounded text-white text-sm"
                        />
                      ) : (
                        <p className="text-white text-sm font-mono">{firstRecord.SACADO_CEP || '—'}</p>
                      )}
                    </div>
                    {/* Cidade */}
                    <div
                      className="flex-1 cursor-pointer hover:opacity-80 transition"
                      onClick={() => handleInlineEdit(itemIdx, 0, 'SACADO_CIDADE', firstRecord.SACADO_CIDADE || '')}
                    >
                      <p className="text-sm text-[#707070] uppercase font-semibold leading-none mb-0.5">Cidade</p>
                      {inlineEditingCell === `${itemIdx}-0-SACADO_CIDADE` ? (
                        <input ref={inputRef} type="text" value={inlineEditValue}
                          onChange={(e) => setInlineEditValue(e.target.value)}
                          onBlur={() => handleInlineBlur(itemIdx, 0, 'SACADO_CIDADE')}
                          onKeyDown={(e) => handleInlineKeyDown(e, itemIdx, 0, 'SACADO_CIDADE')}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-2 py-0.5 bg-[#1a1a1a] border border-white rounded text-white text-sm"
                        />
                      ) : (
                        <p className="text-white text-sm truncate">{firstRecord.SACADO_CIDADE || '—'}</p>
                      )}
                    </div>
                    {/* UF */}
                    <div
                      className="flex-1 cursor-pointer hover:opacity-80 transition"
                      onClick={() => handleInlineEdit(itemIdx, 0, 'SACADO_UF', firstRecord.SACADO_UF || '')}
                    >
                      <p className="text-sm text-[#707070] uppercase font-semibold leading-none mb-0.5">UF</p>
                      {inlineEditingCell === `${itemIdx}-0-SACADO_UF` ? (
                        <input ref={inputRef} type="text" value={inlineEditValue}
                          onChange={(e) => setInlineEditValue(e.target.value)}
                          onBlur={() => handleInlineBlur(itemIdx, 0, 'SACADO_UF')}
                          onKeyDown={(e) => handleInlineKeyDown(e, itemIdx, 0, 'SACADO_UF')}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-2 py-0.5 bg-[#1a1a1a] border border-white rounded text-white text-sm"
                        />
                      ) : (
                        <p className="text-white text-sm font-mono">{firstRecord.SACADO_UF || '—'}</p>
                      )}
                    </div>
                    {/* Avalista */}
                    <div
                      className="flex-1 cursor-pointer hover:opacity-80 transition"
                      onClick={() => handleInlineEdit(itemIdx, 0, 'AVALISTA_NOME', firstRecord.AVALISTA_NOME || '')}
                    >
                      <p className="text-sm text-[#707070] uppercase font-semibold leading-none mb-0.5">Avalista</p>
                      {inlineEditingCell === `${itemIdx}-0-AVALISTA_NOME` ? (
                        <input ref={inputRef} type="text" value={inlineEditValue}
                          onChange={(e) => setInlineEditValue(e.target.value)}
                          onBlur={() => handleInlineBlur(itemIdx, 0, 'AVALISTA_NOME')}
                          onKeyDown={(e) => handleInlineKeyDown(e, itemIdx, 0, 'AVALISTA_NOME')}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-2 py-0.5 bg-[#1a1a1a] border border-white rounded text-white text-sm"
                        />
                      ) : (
                        <p className="text-white text-sm truncate">{firstRecord.AVALISTA_NOME || '—'}</p>
                      )}
                    </div>
                    {/* Avalista CIC */}
                    <div
                      className="flex-1 cursor-pointer hover:opacity-80 transition"
                      onClick={() => handleInlineEdit(itemIdx, 0, 'AVALISTA_CIC', firstRecord.AVALISTA_CIC || '')}
                    >
                      <p className="text-sm text-[#707070] uppercase font-semibold leading-none mb-0.5">Av. CIC</p>
                      {inlineEditingCell === `${itemIdx}-0-AVALISTA_CIC` ? (
                        <input ref={inputRef} type="text" value={inlineEditValue}
                          onChange={(e) => setInlineEditValue(e.target.value)}
                          onBlur={() => handleInlineBlur(itemIdx, 0, 'AVALISTA_CIC')}
                          onKeyDown={(e) => handleInlineKeyDown(e, itemIdx, 0, 'AVALISTA_CIC')}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-2 py-0.5 bg-[#1a1a1a] border border-white rounded text-white text-sm"
                        />
                      ) : (
                        <p className="text-white text-sm font-mono">{firstRecord.AVALISTA_CIC || '—'}</p>
                      )}
                    </div>
                  </div>

                  {/* LINHAS DE PARCELAS */}
                  {item._records.map((record, recordIdx) => {
                    const rowId = `${itemIdx}-${recordIdx}`
                    const isSelected = selectedRows.has(rowId)

                    return (
                      <div
                        key={rowId}
                        className={`transition flex items-center gap-3 px-4 py-2 border-b border-[#1a1a1a] text-sm ${
                          recordIdx > 0 ? 'border-t-2 border-[#444444]' : 'border-t-2 border-[#333333]'
                        } ${isSelected ? 'bg-[#151515]' : 'bg-[#151515]'}`}
                      >
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation()
                            toggleRow(rowId)
                          }}
                          className="w-3 h-3 cursor-pointer accent-white flex-shrink-0"
                        />

                        {/* Emissão */}
                        <div
                          className="w-[60px] flex-shrink-0 cursor-pointer hover:opacity-80 transition text-center"
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
                              <p className="text-sm text-[#707070] uppercase font-semibold leading-none mb-0.5">Emissão</p>
                              <p className="text-white text-sm">{formatarDataBrasileira(record.EMISSAO) || '—'}</p>
                            </>
                          )}
                        </div>

                        {/* Título */}
                        <div
                          className="w-20 flex-shrink-0 cursor-pointer hover:opacity-80 transition text-center"
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
                              <p className="text-sm text-[#707070] uppercase font-semibold leading-none mb-0.5">Número</p>
                              <p className="text-white text-sm font-mono">{record.NUM_TITULO || '—'}</p>
                            </>
                          )}
                        </div>

                        {/* Vencimento */}
                        <div
                          className="w-[60px] flex-shrink-0 cursor-pointer hover:opacity-80 transition text-center"
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
                              <p className="text-sm text-[#707070] uppercase font-semibold leading-none mb-0.5">Data</p>
                              <p className="text-white text-sm">{formatarDataBrasileira(record.VENCIMENTO) || '—'}</p>
                            </>
                          )}
                        </div>

                        {/* Valor */}
                        <div
                          className="w-20 flex-shrink-0 cursor-pointer hover:opacity-80 transition text-center"
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
                              <p className="text-sm text-[#707070] uppercase font-semibold leading-none mb-0.5">Valor</p>
                              <p className="text-white text-sm font-mono">
                                {formatarValorBrasileiro(record.VALOR)}
                              </p>
                            </>
                          )}
                        </div>

                        {/* Descrição */}
                        <div
                          className="w-[600px] flex-shrink-0 cursor-pointer hover:opacity-80 transition"
                          onClick={() => handleInlineEdit(itemIdx, recordIdx, 'DESCRICAO', record.DESCRICAO || '')}
                        >
                          {inlineEditingCell === `${itemIdx}-${recordIdx}-DESCRICAO` ? (
                            <input
                              ref={inputRef}
                              type="text"
                              value={inlineEditValue}
                              onChange={(e) => setInlineEditValue(e.target.value)}
                              onBlur={() => handleInlineBlur(itemIdx, recordIdx, 'DESCRICAO')}
                              onKeyDown={(e) => handleInlineKeyDown(e, itemIdx, recordIdx, 'DESCRICAO')}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full px-2 py-1 bg-[#1a1a1a] border border-white rounded text-white text-sm"
                            />
                          ) : (
                            <>
                              <p className="text-sm text-[#707070] uppercase font-semibold leading-none mb-0.5">Descrição</p>
                              <p className="text-white text-sm truncate line-clamp-1">{record.DESCRICAO || '—'}</p>
                            </>
                          )}
                        </div>

                        {/* Botão lixeira para deletar parcela */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            const newData = [...dataWithInstalments]
                            newData[itemIdx]._records.splice(recordIdx, 1)
                            // Se não sobrou nenhuma parcela, remove o item inteiro
                            if (newData[itemIdx]._records.length === 0) {
                              newData.splice(itemIdx, 1)
                            }
                            setDataWithInstalments(newData)
                            // Atualizar selectedRows
                            const newSelected = new Set(selectedRows)
                            newSelected.delete(rowId)
                            setSelectedRows(newSelected)
                          }}
                          className="w-[10px] h-[10px] flex items-center justify-center text-white hover:text-red-400 text-xs flex-shrink-0"
                          title="Deletar parcela"
                        >
                          ×
                        </button>

                        {/* Botão + apenas na primeira parcela */}
                        {recordIdx === 0 && inlineEditingCell === null && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const currentRecord = dataWithInstalments[itemIdx]._records[0]
                              const updatedItem = {
                                ...dataWithInstalments[itemIdx],
                                ...currentRecord
                              }
                              setInstalmentModal({ itemIdx, item: updatedItem })
                            }}
                            className="w-[10px] h-[10px] flex items-center justify-center text-white hover:text-[#a3a3a3] text-lg flex-shrink-0"
                            title="Adicionar parcelas"
                          >
                            +
                          </button>
                        )}

                        {/* Anexar — ao lado direito do + (apenas na 1ª parcela) */}
                        {recordIdx === 0 && (
                          <label className="cursor-pointer shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="file"
                              accept=".pdf,.xlsx,.xls,.xml"
                              multiple
                              onChange={(e) => handleAnexoFileSelect(itemIdx, e)}
                              ref={el => fileInputRefs.current[itemIdx] = el}
                              className="hidden"
                            />
                            <span className="inline-flex items-center gap-1 text-xs text-white font-medium hover:opacity-80 whitespace-nowrap">
                              <span className="text-base leading-none">➕</span> Anexar
                            </span>
                          </label>
                        )}
                      </div>
                    )
                  })}

                  {/* Arquivos anexados — abaixo das últimas parcelas */}
                  {arquivosAnexados[itemIdx] && arquivosAnexados[itemIdx].length > 0 && (
                    <div className="px-4 py-2 border-t border-[#1a1a1a] flex flex-wrap gap-1 bg-[#0a0a0a]">
                      {arquivosAnexados[itemIdx].map((file, fileIdx) => (
                        <div
                          key={`${itemIdx}-${fileIdx}`}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-[#1a7f1a] text-white rounded text-xs"
                        >
                          <span className="truncate max-w-xs">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoverAnexo(itemIdx, fileIdx)}
                            className="ml-1 text-[#cccccc] hover:text-white transition"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="border-t border-[#1f1f1f] px-5 py-3 flex gap-3 justify-between items-center">
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
            {relatorioPDF && (
              <button
                onClick={() => downloadPDFRelatorio(relatorioPDF, `relatorio_importacao_${new Date().getTime()}.pdf`)}
                className="px-6 py-2 bg-[#1a5490] text-white text-sm font-medium border border-[#2a5a8a] rounded hover:bg-[#145480] transition"
              >
                📄 Baixar Relatório de Erros
              </button>
            )}
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
          item={instalmentModal.item || dataWithInstalments[instalmentModal.itemIdx]}
          onConfirm={handleInstalmentConfirm}
          onCancel={() => setInstalmentModal(null)}
        />
      )}
    </div>
  )
}
