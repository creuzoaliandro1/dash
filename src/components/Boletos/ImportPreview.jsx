import { useState, useRef, useEffect } from 'react'
import { createBoleto, getAllContas, uploadAnexoBoleto, linhaDigitavelParaBarcode, reconciliarBTGExistentes } from '../../services/boletoService'
import { gerarRelatorioPDFErros, downloadPDFRelatorio } from '../../services/boletoImportService'
import InstalmentModal from './InstalmentModal'
import { validarDadosSacado } from '../../utils/validarSacado'
import { processFilesForPreview } from '../../services/importService'

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

// Data que não existe no calendário (ex.: 29/02/2027, 31/04/2026): devolve as
// duas datas válidas vizinhas — último dia do mês e 1º dia do mês seguinte.
// Aceita dd/mm/aaaa, dd/mm/aa e aaaa-mm-dd; retorna null se a data existe.
function dataInexistente(valor) {
  const s = String(valor || '').trim()
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  let dia, mes, ano
  if (m) { dia = +m[1]; mes = +m[2]; ano = m[3].length === 2 ? 2000 + +m[3] : +m[3] }
  else {
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!m) return null
    ano = +m[1]; mes = +m[2]; dia = +m[3]
  }
  if (mes < 1 || mes > 12 || dia < 1) return null
  const ultimoDia = new Date(ano, mes, 0).getDate()
  if (dia <= ultimoDia) return null
  const fmt = (d, mm, a) => `${String(d).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${a}`
  return {
    anterior: fmt(ultimoDia, mes, ano),
    posterior: mes === 12 ? fmt(1, 1, ano + 1) : fmt(1, mes + 1, ano),
  }
}

// ---- "Unir NF" -------------------------------------------------------------
// Valor em centavos (aceita número ou texto "1.425,00" / "1425.5")
function centavos(v) {
  if (typeof v === 'number') return Math.round(v * 100)
  const s = String(v || '').replace(/[^\d.,-]/g, '')
  const n = s.includes(',') ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s)
  return Math.round((isNaN(n) ? 0 : n) * 100)
}
// Divide um total (centavos) em k partes; sobra de centavos vai nas primeiras
function dividirCentavos(total, k) {
  const base = Math.floor(total / k), resto = total - base * k
  return Array.from({ length: k }, (_, i) => base + (i < resto ? 1 : 0))
}
// Nº da NF de um item (título "6570-1" -> "6570")
const numeroNF = (item) => String(item?._records?.[0]?.NUM_TITULO || item?.NUM_TITULO || '').split('-')[0] || '?'
const resumoParcelas = (item) => item._records.map(r => formatarDataBrasileira(r.VENCIMENTO)).join(', ')
const soDigitos = (s) => String(s || '').replace(/\D/g, '')

// Une a NF "novo" ao item "alvo" (mesmo cliente). As parcelas e vencimentos vêm
// da NF escolhida ("regra"); o valor da outra NF é somado a elas — parcela a
// parcela quando as quantidades batem, senão dividido igualmente. Os dados do
// cliente/avalista (inclusive edições manuais) são os do item já na lista.
function unirItens(alvo, novo, regra) {
  const recsA = alvo._records, recsB = novo._records
  const base = regra === 'novo' ? recsB : recsA
  const outro = regra === 'novo' ? recsA : recsB
  const somar = outro.length === base.length
    ? outro.map(r => centavos(r.VALOR))
    : dividirCentavos(outro.reduce((s, r) => s + centavos(r.VALOR), 0), base.length)
  const comum = recsA[0]
  const arquivos = [...(comum._arquivosUnidos || []), novo._xmlFile, ...(novo._records[0]?._arquivosUnidos || [])].filter(Boolean)
  const nfs = [...(comum._NFS_UNIDAS || [numeroNF(alvo)]), numeroNF(novo)]
  const descricao = [comum.DESCRICAO, `NF ${numeroNF(novo)}: ${recsB[0]?.DESCRICAO || ''}`.trim()].filter(Boolean).join('\n')
  const records = base.map((r, i) => ({
    ...comum,
    NUM_TITULO: r.NUM_TITULO,
    NOSSO_NUMERO: r.NUM_TITULO,
    VENCIMENTO: r.VENCIMENTO,
    VALOR: (centavos(r.VALOR) + somar[i]) / 100,
    DESCRICAO: descricao,
    _arquivosUnidos: arquivos,
    _NFS_UNIDAS: nfs,
  }))
  return { ...alvo, DESCRICAO: descricao, _records: records }
}

// Nome do avalista quando é o emissor da NF: "Nome Fantasia - Razão Social",
// cortado no tamanho do campo no Firebird (OPEITE.NOME_AVALISTA varchar(25)).
// Sem fantasia (ou igual/contida na razão social), só a razão social.
const TAM_NOME_AVALISTA = 25
function nomeAvalistaEmitente(emit) {
  const razao = String(emit?.SACADO_NOME || '').replace(/\s+/g, ' ').trim()
  const fant = String(emit?.NOME_FANTASIA || '').replace(/\s+/g, ' ').trim()
  const n = (s) => s.toUpperCase()
  const nome = fant && !n(razao).includes(n(fant)) ? `${fant} - ${razao}` : razao
  return nome.slice(0, TAM_NOME_AVALISTA).trim()
}

// Campo editável do popup — salva no blur, máscara automática para datas
function DetailField({ label, field, isDate, currentValue, onSave, required, invalid }) {
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
      <label className="block text-[10px] text-[#666666] uppercase font-semibold mb-0.5">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      <input
        type="text"
        value={local}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={isDate ? 'dd/mm/aa' : ''}
        className={`w-full px-2 py-1.5 bg-[#0a0a0a] border rounded text-white text-xs focus:border-white outline-none transition ${invalid ? 'border-red-600' : 'border-[#2a2a2a]'}`}
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

  const baixarArquivo = (file) => {
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // Item do preview (cadastro + parcelas em _records) a partir de um registro lido do arquivo
  const montarItem = (item) => {
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
  }
  const [dataWithInstalments, setDataWithInstalments] = useState(() => previewData.map(montarItem))
  // "Unir NF": lendo a 2ª NF / pergunta de qual NF puxar parcelas e vencimentos
  const [unindo, setUnindo] = useState(false)
  const [msgUniao, setMsgUniao] = useState(null) // { tipo: 'ok' | 'erro', texto }
  const [uniaoPendente, setUniaoPendente] = useState(null) // { alvoIdx, novo }
  const unirInputRef = useRef(null)

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
  // Checkbox "Emissor da NF" no Avalista: avalista = nome/CIC do emitente da NF
  const [avalistaEmitente, setAvalistaEmitente] = useState(false)
  const [avalistaAnterior, setAvalistaAnterior] = useState(null)
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
      // Parcelas herdam o sacado da 1ª linha (com o que já foi corrigido no popup)
      const { _records: recsAtuais, ...itemBase } = newData[itemIdx]
      newData[itemIdx]._records = instalments.map(inst => ({
        ...itemBase,
        ...(recsAtuais?.[0] || {}),
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
    setAvalistaEmitente(!!base._AVALISTA_EMITENTE)
    setAvalistaAnterior(base._AVALISTA_EMITENTE ? (base._AVALISTA_ANTERIOR || null) : null)
    setDetailEditData({
      SACADO_NOME: base.SACADO_NOME || '',
      SACADO_CIC: base.SACADO_CIC || '',
      SACADO_TELEFONE: base.SACADO_TELEFONE || '',
      SACADO_EMAIL: base.SACADO_EMAIL || '',
      SACADO_ENDERECO: base.SACADO_ENDERECO || '',
      SACADO_NUMERO: base.SACADO_NUMERO || '',
      SACADO_BAIRRO: base.SACADO_BAIRRO || '',
      SACADO_CEP: base.SACADO_CEP || '',
      SACADO_CIDADE: base.SACADO_CIDADE || '',
      SACADO_UF: base.SACADO_UF || '',
      SACADO_COMPLEMENTO: base.SACADO_COMPLEMENTO || '',
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
    // Dados em comum de todos os registros da mesma NF (sacado, endereço, contato,
    // avalista, emissão, descrição). Número do título, valor e vencimento são de cada parcela.
    const comuns = {
      SACADO_NOME: detailEditData.SACADO_NOME,
      SACADO_CIC: detailEditData.SACADO_CIC,
      SACADO_TELEFONE: detailEditData.SACADO_TELEFONE,
      SACADO_EMAIL: detailEditData.SACADO_EMAIL,
      SACADO_ENDERECO: detailEditData.SACADO_ENDERECO,
      SACADO_NUMERO: detailEditData.SACADO_NUMERO,
      SACADO_BAIRRO: detailEditData.SACADO_BAIRRO,
      SACADO_CEP: detailEditData.SACADO_CEP,
      SACADO_CIDADE: detailEditData.SACADO_CIDADE,
      SACADO_UF: detailEditData.SACADO_UF,
      SACADO_COMPLEMENTO: detailEditData.SACADO_COMPLEMENTO,
      AVALISTA_NOME: detailEditData.AVALISTA_NOME,
      AVALISTA_CIC: detailEditData.AVALISTA_CIC,
      EMISSAO: normalizarDataAno4(detailEditData.EMISSAO),
      DESCRICAO: detailEditData.DESCRICAO,
      _AVALISTA_EMITENTE: avalistaEmitente,
      _AVALISTA_ANTERIOR: avalistaEmitente ? avalistaAnterior : null,
    }
    // Mesma NF = mesmo arquivo XML de origem (XML importado ou chave consultada);
    // sem XML, o grupo é o próprio item (parcelas do mesmo cadastro).
    const xmlDaNF = dataWithInstalments[itemIdx]?._xmlFile
    const mesmaNF = (item, idx) => idx === itemIdx || (xmlDaNF && item._xmlFile === xmlDaNF)
    const newData = dataWithInstalments.map((item, idx) => (
      mesmaNF(item, idx)
        ? { ...item, ...comuns, _records: item._records.map(r => ({ ...r, ...comuns })) }
        : item
    ))
    // Campos próprios da parcela editada
    newData[itemIdx]._records[recordIdx] = {
      ...newData[itemIdx]._records[recordIdx],
      NUM_TITULO: detailEditData.NUM_TITULO,
      VENCIMENTO: normalizarDataAno4(detailEditData.VENCIMENTO),
      VALOR: detailEditData.VALOR,
    }
    setDataWithInstalments(newData)
    setDetailPopup(null)
  }

  const handleImport = async () => {
    if (datasInexistentes.length > 0) return // a gravação falharia: escolher a data antes
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

        // Endereço/contato do sacado incompletos: não grava (as linhas válidas seguem)
        const validacaoSacado = validarDadosSacado(boletoData)
        if (!validacaoSacado.ok) {
          erros.push({
            linha: linhaAtual,
            numero_documento: boletoData.NUM_TITULO,
            sacado_nome: boletoData.SACADO_NOME,
            codigo_barras: boletoData.CODIGO_BARRAS || '',
            valor: boletoData.VALOR,
            motivo: 'sacado_incompleto',
            detalhe: validacaoSacado.mensagens.join(', '),
          })
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
            if (error.code === 'SACADO_INCOMPLETO') {
              erros.push({
                linha: linhaAtual,
                numero_documento: boletoData.NUM_TITULO,
                sacado_nome: boletoData.SACADO_NOME,
                codigo_barras: boletoData.CODIGO_BARRAS || '',
                valor: boletoData.VALOR,
                motivo: 'sacado_incompleto',
                detalhe: (error.faltando || []).join(', '),
              })
            }
            errors++
          } else {
            imported++

            // 4. Upload dos anexos: XML de origem (automático, salvo em cada parcela
            //    gerada a partir do arquivo) + anexos manuais selecionados pelo usuário.
            const arquivosParaAnexar = [
              ...(boletoData._xmlFile ? [boletoData._xmlFile] : []),
              ...(boletoData._arquivosUnidos || []), // NFs unidas ("Unir NF")
              ...(arquivosAnexados[itemIdx] || [])
            ]
            if (arquivosParaAnexar.length > 0 && boletoResult && boletoResult.id) {
              console.log(`[ImportPreview] Fazendo upload de ${arquivosParaAnexar.length} arquivo(s) para boleto ${boletoResult.id}`)
              try {
                await Promise.all(
                  arquivosParaAnexar.map(file =>
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

  // Linhas com endereço/contato do sacado incompleto (não serão gravadas)
  let totalIncompletos = 0
  let selecionadosValidos = 0
  dataWithInstalments.forEach((item, itemIdx) => item._records.forEach((record, recordIdx) => {
    const ok = validarDadosSacado(record).ok
    if (!ok) totalIncompletos++
    else if (selectedRows.has(`${itemIdx}-${recordIdx}`)) selecionadosValidos++
  }))
  const faltasPopup = detailPopup ? validarDadosSacado(detailEditData).faltando.map(f => f.campo) : []

  // ---- Unir NF ----
  const aplicarUniao = (alvoIdx, novo, regra) => {
    const unido = unirItens(dataWithInstalments[alvoIdx], novo, regra)
    setDataWithInstalments(prev => prev.map((it, i) => (i === alvoIdx ? unido : it)))
    // seleção das parcelas desse item passa a ser a nova lista de parcelas
    setSelectedRows(prev => {
      const s = new Set([...prev].filter(id => !id.startsWith(`${alvoIdx}-`)))
      unido._records.forEach((_, r) => s.add(`${alvoIdx}-${r}`))
      return s
    })
    const total = unido._records.reduce((s, r) => s + centavos(r.VALOR), 0) / 100
    setMsgUniao({
      tipo: 'ok',
      texto: `NF ${numeroNF(novo)} unida à NF ${numeroNF(dataWithInstalments[alvoIdx])}: ${unido._records.length} parcela(s), total ${formatarValorBrasileiro(total)}.`,
    })
    setUniaoPendente(null)
  }

  const handleUnirArquivo = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setMsgUniao(null)
    setUnindo(true)
    try {
      const r = await processFilesForPreview([file])
      if (r.errors?.length) throw new Error(r.errors.map(x => x.message).join(' '))
      if (!r.data?.length) throw new Error('Nenhuma NF encontrada no arquivo.')
      if (r.data.length > 1) throw new Error(`O arquivo tem ${r.data.length} NFs — para unir, selecione um arquivo com uma NF só.`)
      const novo = montarItem(r.data[0])
      const cic = soDigitos(novo._records[0]?.SACADO_CIC)
      const alvoIdx = cic ? dataWithInstalments.findIndex(it => soDigitos(it._records[0]?.SACADO_CIC) === cic) : -1
      if (alvoIdx < 0) {
        throw new Error(`A NF ${numeroNF(novo)} é de outro cliente (${novo._records[0]?.SACADO_NOME || 'sem nome'}${cic ? ` — ${cic}` : ''}) e não foi unida.`)
      }
      const alvo = dataWithInstalments[alvoIdx]
      if (novo._xmlFile && xmlsOrigem.some(f => f.name === novo._xmlFile.name)) {
        throw new Error(`O arquivo ${novo._xmlFile.name} já está nesta importação.`)
      }
      const mesmaRegra = alvo._records.length === novo._records.length &&
        alvo._records.every((rec, i) => formatarDataBrasileira(rec.VENCIMENTO) === formatarDataBrasileira(novo._records[i].VENCIMENTO))
      if (mesmaRegra) aplicarUniao(alvoIdx, novo, 'alvo')
      else setUniaoPendente({ alvoIdx, novo })
    } catch (err) {
      setMsgUniao({ tipo: 'erro', texto: err?.message || String(err) })
    } finally {
      setUnindo(false)
    }
  }

  // Arquivos de origem (XML/PDF importados, Chave NF/Serpro e NFs unidas). Ficam
  // anexados a cada boleto ao importar; aqui o usuário já pode baixá-los.
  const xmlsOrigem = [...new Set(dataWithInstalments.flatMap(item => [
    item._xmlFile,
    ...item._records.flatMap(r => [r._xmlFile, ...(r._arquivosUnidos || [])]),
  ]).filter(Boolean))]

  // Datas que não existem (ex.: 29/02/2027): a gravação falharia e o registro seria
  // perdido. Pergunta, uma por vez, qual data válida adotar.
  const datasInexistentes = []
  dataWithInstalments.forEach((item, itemIdx) => item._records.forEach((record, recordIdx) => {
    for (const [campo, rotulo] of [['VENCIMENTO', 'vencimento'], ['EMISSAO', 'data de emissão']]) {
      const sugestao = dataInexistente(record[campo])
      if (sugestao) datasInexistentes.push({ itemIdx, recordIdx, campo, rotulo, valor: record[campo], titulo: record.NUM_TITULO, sacado: record.SACADO_NOME, ...sugestao })
    }
  }))
  const dataPendente = !checkingDedup && !detailPopup && !instalmentModal && !uniaoPendente ? datasInexistentes[0] : null

  const adotarData = ({ itemIdx, recordIdx, campo }, novaData) => {
    const newData = [...dataWithInstalments]
    newData[itemIdx] = {
      ...newData[itemIdx],
      _records: newData[itemIdx]._records.map((r, i) => (i === recordIdx ? { ...r, [campo]: novaData } : r)),
    }
    setDataWithInstalments(newData)
  }

  const saveDetailField = (field, val) => {
    setDetailEditData(prev => ({ ...prev, [field]: val }))
  }

  // Emitente da NF (só existe em registros vindos de NF-e: XML ou chave consultada)
  const emitentePopup = detailPopup ? dataWithInstalments[detailPopup.itemIdx]?._records?.[0]?._EMITENTE : null

  // Marcado: avalista = emissor da NF (nome e CIC); desmarcado: volta o avalista anterior
  const toggleAvalistaEmitente = (marcado) => {
    if (!emitentePopup) return
    setAvalistaEmitente(marcado)
    if (marcado) {
      setAvalistaAnterior({ AVALISTA_NOME: detailEditData.AVALISTA_NOME || '', AVALISTA_CIC: detailEditData.AVALISTA_CIC || '' })
      setDetailEditData(prev => ({
        ...prev,
        AVALISTA_NOME: nomeAvalistaEmitente(emitentePopup),
        AVALISTA_CIC: emitentePopup.SACADO_CIC || '',
      }))
    } else if (avalistaAnterior) {
      setDetailEditData(prev => ({ ...prev, ...avalistaAnterior }))
      setAvalistaAnterior(null)
    }
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
          {(xmlsOrigem.length > 0 || dataWithInstalments.length > 0) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs">
              {xmlsOrigem.length > 0 && <span className="text-[#666666]">Arquivo{xmlsOrigem.length > 1 ? 's' : ''}:</span>}
              {xmlsOrigem.map((file, i) => (
                <button
                  key={`${file.name}-${i}`}
                  type="button"
                  onClick={() => baixarArquivo(file)}
                  className="text-white font-mono hover:underline truncate max-w-full"
                  title="Baixar arquivo"
                >
                  📄 {file.name}
                </button>
              ))}
              {dataWithInstalments.length > 0 && (
                <>
                  <input ref={unirInputRef} type="file" accept=".xml,.pdf" className="hidden" onChange={handleUnirArquivo} />
                  <button
                    type="button"
                    onClick={() => unirInputRef.current?.click()}
                    disabled={unindo || isImporting || checkingDedup}
                    className="px-2 py-0.5 border border-[#2a2a2a] rounded text-white hover:bg-[#1a1a1a] transition disabled:opacity-50"
                    title="Somar outra NF do mesmo cliente a esta importação"
                  >
                    {unindo ? 'Lendo NF...' : '+ Unir NF'}
                  </button>
                </>
              )}
            </div>
          )}
          {msgUniao && (
            <p className={`text-xs mt-0.5 ${msgUniao.tipo === 'erro' ? 'text-red-400' : 'text-[#1a7f1a]'}`}>{msgUniao.texto}</p>
          )}
          {!checkingDedup && dedupOcultos > 0 && (
            <p className="text-xs text-[#1a7f1a] mt-0.5">
              {dedupOcultos} registro(s) ocultado(s) (já existentes ou pagos/cancelados)
              {dedupAtualizados > 0 ? `, ${dedupAtualizados} atualizado(s)` : ''} — exibindo apenas o que será criado.
            </p>
          )}
          {!checkingDedup && totalIncompletos > 0 && (
            <p className="text-xs text-red-400 mt-0.5">
              {totalIncompletos} registro(s) em vermelho com endereço/contato do sacado incompleto não serão importados — clique na linha para completar
              (logradouro, número, bairro, CEP, cidade, UF, e-mail e telefone são obrigatórios).
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
              const faltasSacado = validarDadosSacado(record).mensagens
              const incompleto = faltasSacado.length > 0
              return (
                <div
                  key={rowId}
                  onClick={() => openDetailPopup(itemIdx, recordIdx)}
                  title={incompleto ? `Não será importado — falta: ${faltasSacado.join(', ')}. Clique para editar.` : undefined}
                  className={`flex items-center gap-2 px-4 py-px border-b border-[#1a1a1a] cursor-pointer hover:bg-[#111111] transition text-xs ${incompleto ? 'bg-red-950/30 border-l-2 border-l-red-600' : isSelected ? 'bg-[#0d0d0d]' : ''}`}
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
                  <div className={`w-[58px] flex-shrink-0 ${dataInexistente(record.EMISSAO) ? 'text-red-400 font-semibold' : 'text-[#a3a3a3]'}`}>{formatarDataBrasileira(record.EMISSAO) || '—'}</div>
                  {/* Número */}
                  <div className="w-[90px] flex-shrink-0 text-white font-mono truncate">{record.NUM_TITULO || '—'}</div>
                  {/* Vencimento */}
                  <div className={`w-[58px] flex-shrink-0 ${dataInexistente(record.VENCIMENTO) ? 'text-red-400 font-semibold' : 'text-white'}`}>{formatarDataBrasileira(record.VENCIMENTO) || '—'}</div>
                  {/* Valor */}
                  <div className="w-[80px] flex-shrink-0 text-white font-mono text-right">{formatarValorBrasileiro(record.VALOR)}</div>
                  {/* Nome */}
                  <div className="flex-1 min-w-0 truncate">
                    <span className="text-white">{record.SACADO_NOME || '—'}</span>
                    {incompleto && (
                      <span className="ml-2 text-[10px] text-red-400">⚠ falta: {faltasSacado.join(', ')}</span>
                    )}
                  </div>
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
            <button onClick={handleImport} disabled={isImporting || checkingDedup || selecionadosValidos === 0 || datasInexistentes.length > 0}
              title={datasInexistentes.length > 0 ? 'Há data que não existe no calendário — escolha a data a adotar' : undefined}
              className="px-6 py-2 bg-white text-black text-sm font-medium rounded hover:opacity-90 transition disabled:opacity-50">
              {isImporting ? 'Importando...' : checkingDedup ? 'Consultando...' : `Importar (${selecionadosValidos})`}
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
                  <DetailField label="Telefone (com DDD)" field="SACADO_TELEFONE" required invalid={faltasPopup.includes('SACADO_TELEFONE')} currentValue={detailEditData.SACADO_TELEFONE} onSave={saveDetailField} />
                  <div className="col-span-2"><DetailField label="Email" field="SACADO_EMAIL" required invalid={faltasPopup.includes('SACADO_EMAIL')} currentValue={detailEditData.SACADO_EMAIL} onSave={saveDetailField} /></div>
                  <DetailField label="Logradouro" field="SACADO_ENDERECO" required invalid={faltasPopup.includes('SACADO_ENDERECO')} currentValue={detailEditData.SACADO_ENDERECO} onSave={saveDetailField} />
                  <DetailField label="Número" field="SACADO_NUMERO" required invalid={faltasPopup.includes('SACADO_NUMERO')} currentValue={detailEditData.SACADO_NUMERO} onSave={saveDetailField} />
                  <DetailField label="Bairro" field="SACADO_BAIRRO" required invalid={faltasPopup.includes('SACADO_BAIRRO')} currentValue={detailEditData.SACADO_BAIRRO} onSave={saveDetailField} />
                  <DetailField label="CEP" field="SACADO_CEP" required invalid={faltasPopup.includes('SACADO_CEP')} currentValue={detailEditData.SACADO_CEP} onSave={saveDetailField} />
                  <DetailField label="Cidade" field="SACADO_CIDADE" required invalid={faltasPopup.includes('SACADO_CIDADE')} currentValue={detailEditData.SACADO_CIDADE} onSave={saveDetailField} />
                  <DetailField label="UF" field="SACADO_UF" required invalid={faltasPopup.includes('SACADO_UF')} currentValue={detailEditData.SACADO_UF} onSave={saveDetailField} />
                </div>
                {faltasPopup.length > 0 && (
                  <p className="text-[11px] text-red-400 mt-2">
                    Sem estes dados o registro não será importado: {validarDadosSacado(detailEditData).mensagens.join(', ')}
                  </p>
                )}
              </div>

              {/* Avalista */}
              <div>
                <div className="flex items-center justify-between mb-2 border-b border-[#1f1f1f] pb-1">
                  <p className="text-[10px] text-[#444444] uppercase font-semibold">Avalista</p>
                  {emitentePopup && (
                    <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-[#a3a3a3]" title={`Usar o emissor da NF como avalista: ${nomeAvalistaEmitente(emitentePopup)}`}>
                      <input
                        type="checkbox"
                        checked={avalistaEmitente}
                        onChange={(e) => toggleAvalistaEmitente(e.target.checked)}
                        className="w-3 h-3 cursor-pointer accent-white"
                      />
                      Emissor da NF
                    </label>
                  )}
                </div>
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

      {/* Unir NF: parcelas/vencimentos diferentes -> de qual NF puxar a regra */}
      {uniaoPendente && (() => {
        const alvo = dataWithInstalments[uniaoPendente.alvoIdx]
        const novo = uniaoPendente.novo
        const opcao = (item, regra) => (
          <button
            onClick={() => aplicarUniao(uniaoPendente.alvoIdx, novo, regra)}
            className="w-full text-left px-4 py-3 border border-[#2a2a2a] rounded hover:bg-[#1a1a1a] hover:border-white transition"
          >
            <span className="block text-sm font-semibold text-white">NF {numeroNF(item)} — {item._records.length} parcela{item._records.length > 1 ? 's' : ''}</span>
            <span className="block text-xs text-[#a3a3a3] font-mono mt-0.5">{resumoParcelas(item)}</span>
          </button>
        )
        return (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
            <div className="bg-[#111111] border border-[#2a2a2a] rounded-lg w-full max-w-md shadow-2xl">
              <div className="px-5 py-3 border-b border-[#2a2a2a]">
                <h3 className="text-sm font-semibold text-white">Unir NF {numeroNF(novo)} à NF {numeroNF(alvo)}</h3>
              </div>
              <div className="p-5 space-y-3 text-sm">
                <p className="text-[#d4d4d4]">As NFs têm quantidade de parcelas ou vencimentos diferentes. De qual NF puxar a quantidade de parcelas e os vencimentos?</p>
                {opcao(alvo, 'alvo')}
                {opcao(novo, 'novo')}
                <p className="text-[11px] text-[#666666]">O valor da outra NF é somado às parcelas escolhidas (dividido igualmente).</p>
                <div className="flex justify-end pt-1">
                  <button onClick={() => setUniaoPendente(null)} className="px-4 py-1.5 text-xs text-white border border-[#2a2a2a] rounded hover:bg-[#1a1a1a] transition">
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Data inexistente no calendário: escolher a data válida a adotar */}
      {dataPendente && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-lg w-full max-w-md shadow-2xl">
            <div className="px-5 py-3 border-b border-[#2a2a2a]">
              <h3 className="text-sm font-semibold text-white">Data inexistente</h3>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <p className="text-[#d4d4d4]">
                O {dataPendente.rotulo} <span className="text-red-400 font-mono font-semibold">{dataPendente.valor}</span> não existe no calendário.
              </p>
              <p className="text-xs text-[#888888]">
                Título <span className="text-white font-mono">{dataPendente.titulo || '—'}</span>
                {dataPendente.sacado ? <> — {dataPendente.sacado}</> : null}
              </p>
              <p className="text-[#d4d4d4]">Qual data deseja adotar?</p>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => adotarData(dataPendente, dataPendente.anterior)}
                  className="flex-1 px-4 py-2.5 bg-white text-black font-mono font-semibold rounded hover:opacity-90 transition"
                >
                  {dataPendente.anterior}
                </button>
                <button
                  onClick={() => adotarData(dataPendente, dataPendente.posterior)}
                  className="flex-1 px-4 py-2.5 bg-white text-black font-mono font-semibold rounded hover:opacity-90 transition"
                >
                  {dataPendente.posterior}
                </button>
              </div>
              {datasInexistentes.length > 1 && (
                <p className="text-[11px] text-[#666666]">Mais {datasInexistentes.length - 1} data(s) inexistente(s) para ajustar em seguida.</p>
              )}
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
