import { useState, useRef, useEffect } from 'react'
import { createBoleto, getAllContas, uploadAnexoBoleto, linhaDigitavelParaBarcode, reconciliarBTGExistentes } from '../../services/boletoService'
import { gerarRelatorioPDFErros, downloadPDFRelatorio } from '../../services/boletoImportService'
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

// Máscara de digitação de data: insere as "/" automaticamente.
// Ex.: "090626" -> "09/06/26" | "09062026" -> "09/06/2026"
function mascararDataDigitada(value) {
  const d = String(value || '').replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

// Normaliza para dd/mm/aaaa (ano de 4 dígitos) ao confirmar a edição,
// para que a importação não caia no fallback de data (convertDateToPG exige aaaa).
function normalizarDataAno4(value) {
  const d = String(value || '').replace(/\D/g, '')
  if (d.length < 6) return value // incompleto: mantém o que foi digitado
  const dd = d.slice(0, 2)
  const mm = d.slice(2, 4)
  let yy = d.slice(4)
  if (yy.length === 2) yy = '20' + yy
  return `${dd}/${mm}/${yy.slice(0, 4)}`
}

// Campo editável do popup — salva no blur, máscara automática para datas
function DetailField({ label, field, isDate, currentValue, onSave }) {
  const [local, setLocal] = useState(currentValue ?? '')

  // Sincroniza quando o popup abre (currentValue muda)
  useEffect(() => {
    setLocal(currentValue ?? '')
  }, [currentValue, field])

  const handleChange = (e) => {
    const raw = e.target.value
    setLocal(isDate ? mascararDataDigitada(raw) : raw)
  }

  const handleBlur = () => {
    const val = isDate ? normalizarDataAno4(local) : local
    onSave(field, val)
  }

  return (
    <div>
      <label className="block text-[10px] text-[#666666] uppercase font-semibold mb-0.5">{label}</label>
      <input
        type="text"
        value={local}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={isDate ? 'dd/mm/aa' : ''}
        className="w-full px-2 py-1.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-white text-xs focus:border-white outline-none transition"
      />
    </div>
  )
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
      // Relatório BTG: mantém o avalista vindo da coluna AD e NÃO preenche o CIC.
      // Demais origens (OS/digitação): preenche AVALISTA com o perfil logado por padrão.
      const base = item._ORIGEM_BTG
        ? { ...item, AVALISTA_NOME: item.AVALISTA_NOME || '', AVALISTA_CIC: '' }
        : { ...item, AVALISTA_NOME: avalistaNome, AVALISTA_CIC: avalistaCic }
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
  // Pré-filtro por código de barras: só exibe registros que serão de fato importados
  const [checkingDedup, setCheckingDedup] = useState(true)
  const [dedupOcultos, setDedupOcultos] = useState(0)
  const [dedupAtualizados, setDedupAtualizados] = useState(0)
  // Popup de detalhe/edição
  const [detailPopup, setDetailPopup] = useState(null) // { itemIdx, recordIdx }
  const [detailEditData, setDetailEditData] = useState({})
  const inputRef = useRef(null)
  const fileInputRefs = useRef({})

  useEffect(() => {
    if (inlineEditingCell && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [inlineEditingCell])

  // Ao abrir o preview: consulta o codigo_barras de cada registro.
  // - Registros que já existem em capt_boletos são ocultados da lista (a lista exibe
  //   apenas o que será de fato criado).
  // - Para os já existentes vindos do relatório BTG, reconcilia o boleto: marca
  //   situacao='Registrado' e, se houve mudança, atualiza status (col G), valor (col AU
  //   "Valor pago") e data_pagamento (col AV) — estes dois últimos só quando há pagamento.
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const registros = dataWithInstalments.map(item => {
          const raw = String(item.CODIGO_BARRAS || item._records?.[0]?.CODIGO_BARRAS || '').replace(/\D/g, '')
          const variants = raw ? Array.from(new Set([raw, linhaDigitavelParaBarcode(raw)].filter(Boolean))) : []
          return {
            variants,
            isBTG: item._ORIGEM_BTG === true || String(item.SITUACAO || '').toLowerCase() === 'registrado',
            status: item.STATUS,
            valorPago: item.VALOR_PAGO,
            dataPagamento: item.DATA_PAGAMENTO,
          }
        })

        const comBarcode = registros.filter(r => r.variants.length > 0)
        if (comBarcode.length === 0) {
          if (!cancelled) setCheckingDedup(false)
          return
        }

        const { existentes, atualizados } = await reconciliarBTGExistentes(comBarcode)

        const manter = []
        let ocultos = 0
        dataWithInstalments.forEach((item, idx) => {
          const variants = registros[idx].variants
          const existe = variants.length > 0 && variants.some(v => existentes.has(v))
          // Oculta os que não serão criados: já existentes (reconciliados) ou
          // pagos/cancelados (_SKIP_CREATE) — a lista mostra só o que será criado.
          if (existe || item._SKIP_CREATE) ocultos++
          else manter.push(item)
        })

        if (cancelled) return
        if (ocultos > 0) {
          setDataWithInstalments(manter)
          const ids = new Set()
          manter.forEach((item, idx) => item._records.forEach((_, ridx) => ids.add(`${idx}-${ridx}`)))
          setSelectedRows(ids)
          setDedupOcultos(ocultos)
        }
        setDedupAtualizados(atualizados || 0)
      } catch (err) {
        console.error('[ImportPreview] Erro no pré-filtro por código de barras:', err)
      } finally {
        if (!cancelled) setCheckingDedup(false)
      }
    }
    run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleInlineEdit = (itemIdx, recordIdx, field, value) => {
    setInlineEditingCell(`${itemIdx}-${recordIdx}-${field}`)
    setInlineEditValue(value)
  }

  const handleInlineBlur = (itemIdx, recordIdx, field) => {
    // Campos de data: normaliza ano para 4 dígitos antes de salvar
    const valorFinal = (field === 'VENCIMENTO' || field === 'EMISSAO')
      ? normalizarDataAno4(inlineEditValue)
      : inlineEditValue
    const newData = [...dataWithInstalments]
    newData[itemIdx]._records[recordIdx] = {
      ...newData[itemIdx]._records[recordIdx],
      [field]: valorFinal
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

  const openDetailPopup = (itemIdx, recordIdx) => {
    const item = dataWithInstalments[itemIdx]
    const record = item._records[recordIdx]
    const base = item._records[0] // dados do correntista sempre no primeiro
    setDetailEditData({
      SACADO_NOME: base.SACADO_NOME || '',
      SACADO_CIC: base.SACADO_CIC || '',
      SACADO_TELEFONE: base.SACADO_TELEFONE || '',
      SACADO_EMAIL: base.SACADO_EMAIL || '',
      SACADO_ENDERECO: base.SACADO_ENDERECO || '',
      SACADO_BAIRRO: base.SACADO_BAIRRO || '',
      SACADO_CEP: base.SACADO_CEP || '',
      SACADO_CIDADE: base.SACADO_CIDADE || '',
      SACADO_UF: base.SACADO_UF || '',
      AVALISTA_NOME: base.AVALISTA_NOME || '',
      AVALISTA_CIC: base.AVALISTA_CIC || '',
      EMISSAO: record.EMISSAO || '',
      NUM_TITULO: record.NUM_TITULO || '',
      VENCIMENTO: record.VENCIMENTO || '',
      VALOR: String(record.VALOR || ''),
      DESCRICAO: record.DESCRICAO || '',
    })
    setDetailPopup({ itemIdx, recordIdx })
  }

  const saveDetailPopup = () => {
    if (!detailPopup) return
    const { itemIdx, recordIdx } = detailPopup
    const newData = [...dataWithInstalments]
    // Atualiza campos do correntista em TODOS os records do grupo
    newData[itemIdx]._records = newData[itemIdx]._records.map(r => ({
      ...r,
      SACADO_NOME: detailEditData.SACADO_NOME,
      SACADO_CIC: detailEditData.SACADO_CIC,
      SACADO_TELEFONE: detailEditData.SACADO_TELEFONE,
      SACADO_EMAIL: detailEditData.SACADO_EMAIL,
      SACADO_ENDERECO: detailEditData.SACADO_ENDERECO,
      SACADO_BAIRRO: detailEditData.SACADO_BAIRRO,
      SACADO_CEP: detailEditData.SACADO_CEP,
      SACADO_CIDADE: detailEditData.SACADO_CIDADE,
      SACADO_UF: detailEditData.SACADO_UF,
      AVALISTA_NOME: detailEditData.AVALISTA_NOME,
      AVALISTA_CIC: detailEditData.AVALISTA_CIC,
    }))
    // Atualiza campos da parcela específica
    newData[itemIdx]._records[recordIdx] = {
      ...newData[itemIdx]._records[recordIdx],
      EMISSAO: normalizarDataAno4(detailEditData.EMISSAO),
      NUM_TITULO: detailEditData.NUM_TITULO,
      VENCIMENTO: normalizarDataAno4(detailEditData.VENCIMENTO),
      VALOR: detailEditData.VALOR,
      DESCRICAO: detailEditData.DESCRICAO,
    }
    setDataWithInstalments(newData)
    setDetailPopup(null)
  }

  const handleImport = async () => {
    setIsImporting(true)
    const inicioImport = Date.now()
    console.log(`[ImportPreview] ⏱️ Iniciando importação de ${selectedRows.size} boletos`)

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

    // ===== OTIMIZAÇÃO: Processar em paralelo (50 boletos por vez) =====
    const rowArray = Array.from(selectedRows)
    const BATCH_SIZE = 50
    const inicioProcessamento = Date.now()

    for (let batchIdx = 0; batchIdx < rowArray.length; batchIdx += BATCH_SIZE) {
      const batchEnd = Math.min(batchIdx + BATCH_SIZE, rowArray.length)
      const batch = rowArray.slice(batchIdx, batchEnd)

      console.log(`[ImportPreview] 📦 Processando lote ${Math.floor(batchIdx / BATCH_SIZE) + 1}/${Math.ceil(rowArray.length / BATCH_SIZE)} (${batch.length} boletos)`)

      // Processar batch em PARALELO (não sequencial!)
      const promessas = batch.map(async (rowId) => {
        const [itemIdx, recordIdx] = rowId.split('-').map(Number)
        const boletoData = dataWithInstalments[itemIdx]?._records?.[recordIdx]
        const linhaAtual = 2 + rowArray.indexOf(rowId)

        if (!boletoData) {
          console.error(`[ImportPreview] Dados do boleto não encontrados: itemIdx=${itemIdx}, recordIdx=${recordIdx}`)
          errors++
          return
        }

        try {
          // 1. Duplicidade por código de barras já foi tratada no pré-filtro (ao abrir
          //    o preview): os já existentes foram ocultados (e, no caso do BTG, marcados
          //    como Registrado). Aqui só restam registros novos, que serão criados.

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
                codigo_barras: boletoData.CODIGO_BARRAS || '',
                valor: boletoData.VALOR,
                motivo: 'conta_nao_encontrada'
              })
              errors++
              return
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
              try {
                await Promise.all(
                  arquivosAnexados[itemIdx].map(file =>
                    uploadAnexoBoleto(boletoResult.id, file, targetUserId)
                      .then(() => console.log(`[ImportPreview] ✓ Arquivo ${file.name} anexado`))
                      .catch(err => console.warn(`[ImportPreview] Erro ao anexar ${file.name}:`, err))
                  )
                )
              } catch (erroAnexos) {
                console.warn(`[ImportPreview] Erro no upload de anexos:`, erroAnexos)
              }
            }
          }
        } catch (err) {
          console.error('[ImportPreview] Erro ao importar boleto:', err)
          errors++
        }
      })

      // Aguardar TODO o batch terminar antes de próximo lote
      await Promise.all(promessas)
    }

    const durracaoProcessamento = ((Date.now() - inicioProcessamento) / 1000).toFixed(2)
    console.log(`[ImportPreview] ⏱️ Processamento concluído em ${durracaoProcessamento}s`)
    const durracaoTotal = ((Date.now() - inicioImport) / 1000).toFixed(2)
    console.log(`[ImportPreview] ✅ Importação concluída em ${durracaoTotal}s`)

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

  const saveDetailField = (field, val) => {
    setDetailEditData(prev => ({ ...prev, [field]: val }))
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg max-w-3xl w-full max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="border-b border-[#1f1f1f] px-5 py-3">
          <h2 className="text-base font-semibold text-white">Visualizar dados para importação</h2>
          <p className="text-xs text-[#666666]">
            {checkingDedup
              ? 'Consultando código de barras...'
              : `Revise os registros e selecione quais deseja importar (${selectedRows.size} de ${getTotalRecords()} selecionado(s)) — clique em uma linha para editar`}
          </p>
          {!checkingDedup && dedupOcultos > 0 && (
            <p className="text-xs text-[#1a7f1a] mt-0.5">
              {dedupOcultos} registro(s) ocultado(s) (já existentes ou pagos/cancelados)
              {dedupAtualizados > 0 ? `, ${dedupAtualizados} atualizado(s)` : ''} — exibindo apenas o que será criado.
            </p>
          )}
        </div>

        {/* Tabela compacta */}
        <div className="flex-1 overflow-y-auto">
          {/* Cabeçalho fixo */}
          <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-1 bg-[#111111] border-b border-[#1f1f1f] text-[10px] font-semibold text-[#666666] uppercase tracking-wider">
            <div className="w-4 flex-shrink-0" />
            <div className="w-[58px] flex-shrink-0">Emissão</div>
            <div className="w-[90px] flex-shrink-0">Número</div>
            <div className="w-[58px] flex-shrink-0">Vencimento</div>
            <div className="w-[80px] flex-shrink-0 text-right">Valor</div>
            <div className="flex-1">Nome</div>
            <div className="w-[60px] flex-shrink-0" />
          </div>

          {!checkingDedup && dataWithInstalments.length === 0 && (
            <div className="h-32 flex items-center justify-center text-center">
              <p className="text-sm text-[#666666]">Nenhum registro novo para importar — todos já existem no sistema.</p>
            </div>
          )}

          {dataWithInstalments.map((item, itemIdx) =>
            item._records.map((record, recordIdx) => {
              const rowId = `${itemIdx}-${recordIdx}`
              const isSelected = selectedRows.has(rowId)
              return (
                <div
                  key={rowId}
                  onClick={() => openDetailPopup(itemIdx, recordIdx)}
                  className={`flex items-center gap-2 px-4 py-px border-b border-[#1a1a1a] cursor-pointer hover:bg-[#111111] transition text-xs ${isSelected ? 'bg-[#0d0d0d]' : ''}`}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => { e.stopPropagation(); toggleRow(rowId) }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-3 h-3 cursor-pointer accent-white flex-shrink-0"
                  />
                  {/* Emissão */}
                  <div className="w-[58px] flex-shrink-0 text-[#a3a3a3]">{formatarDataBrasileira(record.EMISSAO) || '—'}</div>
                  {/* Número */}
                  <div className="w-[90px] flex-shrink-0 text-white font-mono truncate">{record.NUM_TITULO || '—'}</div>
                  {/* Vencimento */}
                  <div className="w-[58px] flex-shrink-0 text-white">{formatarDataBrasileira(record.VENCIMENTO) || '—'}</div>
                  {/* Valor */}
                  <div className="w-[80px] flex-shrink-0 text-white font-mono text-right">{formatarValorBrasileiro(record.VALOR)}</div>
                  {/* Nome */}
                  <div className="flex-1 text-white truncate">{record.SACADO_NOME || '—'}</div>
                  {/* Ações */}
                  <div className="w-[60px] flex-shrink-0 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {/* Lixeira */}
                    <button
                      onClick={() => {
                        const newData = [...dataWithInstalments]
                        newData[itemIdx]._records.splice(recordIdx, 1)
                        if (newData[itemIdx]._records.length === 0) newData.splice(itemIdx, 1)
                        setDataWithInstalments(newData)
                        const newSelected = new Set(selectedRows)
                        newSelected.delete(rowId)
                        setSelectedRows(newSelected)
                      }}
                      className="text-[#666666] hover:text-red-400 transition"
                      title="Excluir registro"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    {/* + parcelas (só 1ª parcela) */}
                    {recordIdx === 0 && (
                      <button
                        onClick={() => {
                          const currentRecord = dataWithInstalments[itemIdx]._records[0]
                          setInstalmentModal({ itemIdx, item: { ...dataWithInstalments[itemIdx], ...currentRecord } })
                        }}
                        className="text-[#666666] hover:text-white transition text-base leading-none"
                        title="Adicionar parcelas"
                      >+</button>
                    )}
                    {/* Anexar (só 1ª parcela) */}
                    {recordIdx === 0 && (
                      <label className="cursor-pointer text-[#666666] hover:text-white transition" title="Anexar arquivo">
                        <input
                          type="file"
                          accept=".pdf,.xlsx,.xls,.xml"
                          multiple
                          onChange={(e) => handleAnexoFileSelect(itemIdx, e)}
                          ref={el => fileInputRefs.current[itemIdx] = el}
                          className="hidden"
                        />
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      </label>
                    )}
                    {/* Badge de anexos */}
                    {recordIdx === 0 && arquivosAnexados[itemIdx]?.length > 0 && (
                      <span className="text-[10px] text-[#1a7f1a] font-medium">{arquivosAnexados[itemIdx].length}</span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
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
            <button onClick={onCancel} disabled={isImporting}
              className="px-6 py-2 bg-transparent text-white text-sm font-medium border border-[#2a2a2a] rounded hover:bg-[#111111] transition disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={handleImport} disabled={isImporting || checkingDedup || selectedRows.size === 0}
              className="px-6 py-2 bg-white text-black text-sm font-medium rounded hover:opacity-90 transition disabled:opacity-50">
              {isImporting ? 'Importando...' : checkingDedup ? 'Consultando...' : `Importar (${selectedRows.size})`}
            </button>
          </div>
        </div>
      </div>

      {/* Popup de detalhe/edição */}
      {detailPopup && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={() => setDetailPopup(null)}>
          <div
            className="bg-[#111111] border border-[#2a2a2a] rounded-lg w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-[#2a2a2a] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Editar Registro</h3>
              <button onClick={() => setDetailPopup(null)} className="text-[#666666] hover:text-white transition text-lg">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Dados da Parcela */}
              <div>
                <p className="text-[10px] text-[#444444] uppercase font-semibold mb-2 border-b border-[#1f1f1f] pb-1">Título</p>
                <div className="grid grid-cols-2 gap-3">
                  <DetailField label="Emissão" field="EMISSAO" isDate currentValue={detailEditData.EMISSAO} onSave={saveDetailField} />
                  <DetailField label="Número" field="NUM_TITULO" currentValue={detailEditData.NUM_TITULO} onSave={saveDetailField} />
                  <DetailField label="Vencimento" field="VENCIMENTO" isDate currentValue={detailEditData.VENCIMENTO} onSave={saveDetailField} />
                  <DetailField label="Valor" field="VALOR" currentValue={detailEditData.VALOR} onSave={saveDetailField} />
                  <div className="col-span-2"><DetailField label="Descrição" field="DESCRICAO" currentValue={detailEditData.DESCRICAO} onSave={saveDetailField} /></div>
                </div>
              </div>

              {/* Dados do Sacado */}
              <div>
                <p className="text-[10px] text-[#444444] uppercase font-semibold mb-2 border-b border-[#1f1f1f] pb-1">Sacado</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><DetailField label="Nome" field="SACADO_NOME" currentValue={detailEditData.SACADO_NOME} onSave={saveDetailField} /></div>
                  <DetailField label="CPF/CNPJ" field="SACADO_CIC" currentValue={detailEditData.SACADO_CIC} onSave={saveDetailField} />
                  <DetailField label="Telefone" field="SACADO_TELEFONE" currentValue={detailEditData.SACADO_TELEFONE} onSave={saveDetailField} />
                  <div className="col-span-2"><DetailField label="Email" field="SACADO_EMAIL" currentValue={detailEditData.SACADO_EMAIL} onSave={saveDetailField} /></div>
                  <div className="col-span-2"><DetailField label="Endereço" field="SACADO_ENDERECO" currentValue={detailEditData.SACADO_ENDERECO} onSave={saveDetailField} /></div>
                  <DetailField label="Bairro" field="SACADO_BAIRRO" currentValue={detailEditData.SACADO_BAIRRO} onSave={saveDetailField} />
                  <DetailField label="CEP" field="SACADO_CEP" currentValue={detailEditData.SACADO_CEP} onSave={saveDetailField} />
                  <DetailField label="Cidade" field="SACADO_CIDADE" currentValue={detailEditData.SACADO_CIDADE} onSave={saveDetailField} />
                  <DetailField label="UF" field="SACADO_UF" currentValue={detailEditData.SACADO_UF} onSave={saveDetailField} />
                </div>
              </div>

              {/* Avalista */}
              <div>
                <p className="text-[10px] text-[#444444] uppercase font-semibold mb-2 border-b border-[#1f1f1f] pb-1">Avalista</p>
                <div className="grid grid-cols-2 gap-3">
                  <DetailField label="Nome" field="AVALISTA_NOME" currentValue={detailEditData.AVALISTA_NOME} onSave={saveDetailField} />
                  <DetailField label="CPF/CNPJ" field="AVALISTA_CIC" currentValue={detailEditData.AVALISTA_CIC} onSave={saveDetailField} />
                </div>
              </div>

              {/* Anexos (se houver) */}
              {arquivosAnexados[detailPopup.itemIdx]?.length > 0 && (
                <div>
                  <p className="text-[10px] text-[#444444] uppercase font-semibold mb-2 border-b border-[#1f1f1f] pb-1">Arquivos Anexados</p>
                  <div className="flex flex-wrap gap-1">
                    {arquivosAnexados[detailPopup.itemIdx].map((file, fileIdx) => (
                      <div key={fileIdx} className="inline-flex items-center gap-1 px-2 py-1 bg-[#1a7f1a] text-white rounded text-xs">
                        <span className="truncate max-w-xs">{file.name}</span>
                        <button onClick={() => handleRemoverAnexo(detailPopup.itemIdx, fileIdx)} className="ml-1 text-[#cccccc] hover:text-white">✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-[#2a2a2a] flex gap-3 justify-end">
              <button onClick={() => setDetailPopup(null)}
                className="px-5 py-2 text-sm text-white border border-[#2a2a2a] rounded hover:bg-[#1a1a1a] transition">
                Cancelar
              </button>
              <button onClick={saveDetailPopup}
                className="px-5 py-2 text-sm bg-white text-black font-medium rounded hover:opacity-90 transition">
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

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
