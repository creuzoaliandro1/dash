import { useState, useEffect } from 'react'
import BoletoFormModal from '../components/Boletos/BoletoFormModal'
import BoletoTable from '../components/Boletos/BoletoTable'
import BuscarLancamentoModal from '../components/Boletos/BuscarLancamentoModal'
import { createBoleto, getBoletos, deleteBoleto, createRemessa, updateContaLastRemessaDate, reconciliateOpeiteWithBoletos, getOpeiteMatchMaps } from '../services/boletoService'
import { generateMultipleBoletoPDFs, generateCNAB400RemittanceFile } from '../utils/boleto'
import { createAndDownloadZip } from '../utils/zipUtils'
import { formatDate, formatCurrency, formatCurrencyWithPrefix } from '../utils/formatters'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function EfactorPage() {
  const [showModal, setShowModal] = useState(false)
  const [boletos, setBoletos] = useState([])
  const [editingBoleto, setEditingBoleto] = useState(null)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [filtroVencidos, setFiltroVencidos] = useState(false)
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [openActionsMenu, setOpenActionsMenu] = useState(false)
  const [showBuscarLancamento, setShowBuscarLancamento] = useState(false)
  const [boletoBusca, setBoletoBusca] = useState(null)
  // Filtros por correspondência no OPEITE (mesmo CIC): valor e/ou vencimento
  const [filtroValorOpeite, setFiltroValorOpeite] = useState(false)
  const [filtroVencOpeite, setFiltroVencOpeite] = useState(false)
  const [opeiteMaps, setOpeiteMaps] = useState(null)
  const [loadingOpeiteMaps, setLoadingOpeiteMaps] = useState(false)
  const [generatingZip, setGeneratingZip] = useState(false)
  const [reconciling, setReconciling] = useState(false)
  const [reconciliationResult, setReconciliationResult] = useState(null)
  const [showComNumLancamento, setShowComNumLancamento] = useState(true)
  const [showSemNumLancamento, setShowSemNumLancamento] = useState(true)
  const [divergenciasCIC, setDivergenciasCIC] = useState([])
  const [divergenciasValor, setDivergenciasValor] = useState([])
  const [divergenciasVencimento, setDivergenciasVencimento] = useState([])
  const [showDivergencias, setShowDivergencias] = useState(false)
  const [divergenciaTipo, setDivergenciaTipo] = useState('cic')  // 'cic' | 'valor' | 'vencimento'
  const [selectedDivergenciasIds, setSelectedDivergenciasIds] = useState(new Set())
  const [conciliating, setConciliating] = useState(false)
  const [openExportMenu, setOpenExportMenu] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null)
  const [filtroStatusDivergencias, setFiltroStatusDivergencias] = useState('todos')
  const [statusOptions, setStatusOptions] = useState([])
  // TODOS: marcado = mostra todos os registros (sem filtro por perfil selecionado)
  const [filtroTodos, setFiltroTodos] = useState(true)

  // Obter user da sessão
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  useEffect(() => {
    if (user.id) {
      loadBoletos()
      loadStatusOptions()
    }
  }, [user.id, filtroTodos])

  const loadStatusOptions = async () => {
    try {
      // Buscar valores únicos de status
      const { data, error } = await supabase
        .from('capt_boletos')
        .select('status')
        .eq('conta_id', user.id)
        .neq('status', null)

      if (error) throw error

      if (!data || data.length === 0) {
        console.log('[StatusFilter] Nenhum boleto encontrado')
        setStatusOptions([])
        return
      }

      // Extrair valores únicos
      const uniqueStatus = [...new Set(data.map(b => b.status).filter(Boolean))].sort()
      setStatusOptions(uniqueStatus)

      console.log('[StatusFilter] Valores únicos de status carregados:', uniqueStatus)
    } catch (error) {
      console.error('[StatusFilter] Erro ao carregar status options:', error)
      setStatusOptions([])
    }
  }

  // Limpar seleções quando muda o tipo de divergência
  useEffect(() => {
    setSelectedDivergenciasIds(new Set())
  }, [divergenciaTipo])

  const loadBoletos = async () => {
    setLoading(true)
    try {
      const resultado = await getBoletos(filtroTodos ? null : user.id)
      setBoletos(resultado.data || [])
      await loadStatusOptions()
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

  // Carrega os conjuntos de valor/vencimento do OPEITE quando um dos filtros é ativado
  useEffect(() => {
    if ((filtroValorOpeite || filtroVencOpeite) && !opeiteMaps && !loadingOpeiteMaps) {
      setLoadingOpeiteMaps(true)
      getOpeiteMatchMaps()
        .then(({ data }) => setOpeiteMaps(data || { valoresPorCic: {}, vencimentosPorCic: {} }))
        .catch(() => setOpeiteMaps({ valoresPorCic: {}, vencimentosPorCic: {} }))
        .finally(() => setLoadingOpeiteMaps(false))
    }
  }, [filtroValorOpeite, filtroVencOpeite, opeiteMaps, loadingOpeiteMaps])

  const getFilteredBoletos = () => {
    console.log('[EFactor] getFilteredBoletos() chamado. filtroVencidos:', filtroVencidos, 'total boletos:', boletos.length)
    let filtered = boletos

    // E-Factor: não exibir boletos com status 'pago'
    filtered = filtered.filter(boleto => boleto.status !== 'pago')

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

    // Filter by Num Lancamento (Com/Sem)
    filtered = filtered.filter(boleto => {
      const temNumLancamento = boleto.num_lancamento && boleto.num_lancamento.toString().trim() !== ''

      if (showComNumLancamento && showSemNumLancamento) {
        // Mostrar todos
        return true
      } else if (showComNumLancamento && !showSemNumLancamento) {
        // Mostrar apenas com Num Lançamento
        return temNumLancamento
      } else if (!showComNumLancamento && showSemNumLancamento) {
        // Mostrar apenas sem Num Lançamento
        return !temNumLancamento
      }
      // Se ambos desmarked (não deveria acontecer), não mostrar nada
      return false
    })

    // Filter by Vencidos: Mostrar APENAS vencidos OU APENAS não-vencidos
    // Obter data de hoje em formato YYYY-MM-DD (horário local)
    const hoje = new Date()
    const anoHoje = hoje.getFullYear()
    const mesHoje = String(hoje.getMonth() + 1).padStart(2, '0')
    const diaHoje = String(hoje.getDate()).padStart(2, '0')
    const hojeStr = `${anoHoje}-${mesHoje}-${diaHoje}`

    console.log(`[EFactor] Filtro Vencidos: ${filtroVencidos ? 'ATIVADO (mostrar vencidos)' : 'DESATIVADO (mostrar não-vencidos)'}. Hoje: ${hojeStr}`)
    filtered = filtered.filter(boleto => {
      if (!boleto.data_vencimento) {
        // Se não tem data de vencimento, mostrar conforme filtro
        return !filtroVencidos // Se filtro ativo (vencidos), não mostrar. Se filtro inativo (não-vencidos), mostrar
      }
      const vencStr = String(boleto.data_vencimento).slice(0, 10)
      const isVencido = vencStr < hojeStr

      if (filtroVencidos) {
        // Filtro ativado: mostrar APENAS vencidos
        return isVencido
      } else {
        // Filtro desativado: mostrar APENAS não-vencidos
        return !isVencido
      }
    })
    console.log(`[EFactor] Boletos após filtro: ${filtered.length}`)

    // Filtro por correspondência no OPEITE (mesmo CIC): valor e/ou vencimento
    if ((filtroValorOpeite || filtroVencOpeite) && opeiteMaps) {
      filtered = filtered.filter(boleto => {
        const cic = String(boleto.sacado_cic || '').replace(/\D/g, '')
        if (!cic) return false
        // Pareia com o OPEITE do MESMO título (CIC + número do documento) e compara
        // valor/vencimento contra ESSE lançamento específico.
        const tit = String(boleto.numero_documento || '').replace(/\D/g, '').replace(/^0+/, '')
        const op = opeiteMaps.porTitulo?.[`${cic}|${tit}`]
        if (!op) return false // sem OPEITE correspondente (mesmo CIC + título)
        // OU: basta um dos filtros marcados corresponder
        let ok = false
        if (filtroValorOpeite) {
          const cents = Math.round((parseFloat(boleto.valor) || 0) * 100)
          if (op.cents === cents) ok = true
        }
        if (filtroVencOpeite) {
          const venc = boleto.data_vencimento ? String(boleto.data_vencimento).slice(0, 10) : ''
          if (venc && op.venc === venc) ok = true
        }
        return ok
      })
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

  const handleBuscarLancamento = () => {
    setOpenActionsMenu(false)
    const filteredBoletos = getFilteredBoletos()
    const selecionados = Array.from(selectedRows)
      .map(index => filteredBoletos[index])
      .filter(b => b && !b.num_lancamento) // só os sem lançamento
    if (selecionados.length === 0) {
      alert('Selecione um boleto SEM número de lançamento.')
      return
    }
    // Considera o primeiro registro selecionado (sem lançamento)
    setBoletoBusca(selecionados[0])
    setShowBuscarLancamento(true)
  }

  const handleConciliarDivergencias = async () => {
    if (selectedDivergenciasIds.size === 0) {
      alert('Selecione pelo menos uma divergência para conciliar')
      return
    }

    setConciliating(true)

    try {
      // Determinar qual array de divergências usar baseado no tipo
      let divergenciasParaConciliar = []
      if (divergenciaTipo === 'cic') {
        divergenciasParaConciliar = divergenciasCIC.filter((div, idx) => selectedDivergenciasIds.has(`cic-${idx}`))
      } else if (divergenciaTipo === 'valor') {
        divergenciasParaConciliar = divergenciasValor.filter((div, idx) => selectedDivergenciasIds.has(`valor-${idx}`))
      } else if (divergenciaTipo === 'vencimento') {
        divergenciasParaConciliar = divergenciasVencimento.filter((div, idx) => selectedDivergenciasIds.has(`vencimento-${idx}`))
      }

      console.log(`[Conciliação] Atualizando ${divergenciasParaConciliar.length} divergências...`)

      // Fazer batch updates
      let successCount = 0
      let errorCount = 0
      const batchSize = 100

      for (let i = 0; i < divergenciasParaConciliar.length; i += batchSize) {
        const batch = divergenciasParaConciliar.slice(i, i + batchSize)

        const updatePromises = batch.map(div =>
          supabase
            .from('capt_boletos')
            .update({ num_lancamento: div.opeite_num_lancamento })
            .eq('id', div.boleto_id)
        )

        const results = await Promise.all(updatePromises)

        results.forEach((result) => {
          if (result.error) {
            errorCount++
            console.error('[Conciliação] Erro ao atualizar:', result.error)
          } else {
            successCount++
          }
        })

        const percentage = (((i + batchSize) / divergenciasParaConciliar.length) * 100).toFixed(0)
        console.log(`[Conciliação] Progresso: ${percentage}% (${Math.min(i + batchSize, divergenciasParaConciliar.length)}/${divergenciasParaConciliar.length})`)
      }

      // Mostrar resultado
      let message = `Conciliação concluída:\n`
      message += `- Atualizados com sucesso: ${successCount}\n`
      if (errorCount > 0) {
        message += `- Erros: ${errorCount}`
      }

      alert(message)

      // Limpar seleções e recarregar
      setSelectedDivergenciasIds(new Set())
      loadBoletos()

    } catch (error) {
      console.error('[Conciliação] Erro:', error)
      alert('Erro ao conciliar divergências: ' + error.message)
    } finally {
      setConciliating(false)
    }
  }

  const getFilteredDivergencias = (divergencias) => {
    let filtered = divergencias

    // Filter by Status
    if (filtroStatusDivergencias !== 'todos') {
      filtered = filtered.filter(div => div.status_banco === filtroStatusDivergencias)
    }

    // Filter by Vencidos: Mostrar APENAS vencidos OU APENAS não-vencidos
    const hoje = new Date()
    const anoHoje = hoje.getFullYear()
    const mesHoje = String(hoje.getMonth() + 1).padStart(2, '0')
    const diaHoje = String(hoje.getDate()).padStart(2, '0')
    const hojeStr = `${anoHoje}-${mesHoje}-${diaHoje}`

    console.log(`[EFactor] Divergências - Filtro Vencidos: ${filtroVencidos ? 'ATIVADO (mostrar vencidos)' : 'DESATIVADO (mostrar não-vencidos)'}. Hoje: ${hojeStr}`)
    filtered = filtered.filter(div => {
      if (!div.boleto_data_vencimento) {
        return !filtroVencidos
      }
      const vencStr = String(div.boleto_data_vencimento).slice(0, 10)
      const isVencido = vencStr < hojeStr

      if (filtroVencidos) {
        // Filtro ativado: mostrar APENAS vencidos
        return isVencido
      } else {
        // Filtro desativado: mostrar APENAS não-vencidos
        return !isVencido
      }
    })
    console.log(`[EFactor] Divergências após filtro: ${filtered.length}`)

    return filtered
  }

  const getSelectedDivergencias = () => {
    let divergenciasParaExportar = []
    if (divergenciaTipo === 'cic') {
      divergenciasParaExportar = divergenciasCIC.filter((div, idx) => selectedDivergenciasIds.has(`cic-${idx}`))
    } else if (divergenciaTipo === 'valor') {
      divergenciasParaExportar = divergenciasValor.filter((div, idx) => selectedDivergenciasIds.has(`valor-${idx}`))
    } else if (divergenciaTipo === 'vencimento') {
      divergenciasParaExportar = divergenciasVencimento.filter((div, idx) => selectedDivergenciasIds.has(`vencimento-${idx}`))
    }
    return divergenciasParaExportar
  }

  const handleExportarCSV = () => {
    const divergenciasParaExportar = getSelectedDivergencias()

    if (divergenciasParaExportar.length === 0) {
      alert('Nenhuma divergência selecionada para exportar')
      setOpenExportMenu(false)
      return
    }

    setExporting(true)

    try {
      // Preparar headers baseado no tipo
      let headers = []
      if (divergenciaTipo === 'cic') {
        headers = ['Num Lançamento', 'Número Doc', 'Valor (Boleto)', 'Vencimento', 'CIC (Boleto)', 'CIC (SACADO)', 'DT Venci (OPEITE)', 'VR Face (OPEITE)', 'Num Título', 'Num Lançamento (OPEITE)']
      } else if (divergenciaTipo === 'valor') {
        headers = ['Num Lançamento', 'Número Doc', 'Vencimento', 'CIC (Boleto)', 'Valor (Boleto)', 'VR Face (OPEITE)', 'CIC (SACADO)', 'DT Venci (OPEITE)', 'Num Título', 'Num Lançamento (OPEITE)']
      } else if (divergenciaTipo === 'vencimento') {
        headers = ['Num Lançamento', 'Número Doc', 'Vencimento (Boleto)', 'CIC (Boleto)', 'Valor (Boleto)', 'Vencimento (Boleto 2)', 'DT Venci (OPEITE)', 'VR Face (OPEITE)', 'CIC (SACADO)', 'Num Título', 'Num Lançamento (OPEITE)']
      }

      // Preparar dados
      let rows = divergenciasParaExportar.map(div => {
        if (divergenciaTipo === 'cic') {
          return [
            div.boleto_num_lancamento || '',
            div.boleto_numero_documento,
            formatCurrency(div.boleto_valor),
            formatDate(div.boleto_data_vencimento),
            div.boleto_sacado_cic,
            div.opeite_cic,
            formatDate(div.opeite_dt_venci),
            formatCurrency(div.opeite_vr_face),
            div.opeite_num_titulo,
            div.opeite_num_lancamento
          ]
        } else if (divergenciaTipo === 'valor') {
          return [
            div.boleto_num_lancamento || '',
            div.boleto_numero_documento,
            formatDate(div.boleto_data_vencimento),
            div.boleto_sacado_cic,
            formatCurrency(div.boleto_valor),
            formatCurrency(div.opeite_vr_face),
            div.opeite_cic,
            formatDate(div.opeite_dt_venci),
            div.opeite_num_titulo,
            div.opeite_num_lancamento
          ]
        } else if (divergenciaTipo === 'vencimento') {
          return [
            div.boleto_num_lancamento || '',
            div.boleto_numero_documento,
            formatDate(div.boleto_data_vencimento),
            div.boleto_sacado_cic,
            formatCurrency(div.boleto_valor),
            formatDate(div.boleto_data_vencimento),
            formatDate(div.opeite_dt_venci),
            formatCurrency(div.opeite_vr_face),
            div.opeite_cic,
            div.opeite_num_titulo,
            div.opeite_num_lancamento
          ]
        }
      })

      // Gerar CSV
      let csv = headers.join(',') + '\n'
      rows.forEach(row => {
        csv += row.map(cell => `"${cell}"`).join(',') + '\n'
      })

      // Download
      const element = document.createElement('a')
      element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv))
      element.setAttribute('download', `divergencias_${divergenciaTipo}_${new Date().toISOString().split('T')[0]}.csv`)
      element.style.display = 'none'
      document.body.appendChild(element)
      element.click()
      document.body.removeChild(element)

      alert(`${divergenciasParaExportar.length} divergência(s) exportada(s) em CSV com sucesso!`)
      setOpenExportMenu(false)
    } catch (error) {
      console.error('[Export] Erro ao exportar CSV:', error)
      alert('Erro ao exportar CSV: ' + error.message)
    } finally {
      setExporting(false)
    }
  }

  const handleExportarPDF = () => {
    const divergenciasParaExportar = getSelectedDivergencias()

    if (divergenciasParaExportar.length === 0) {
      alert('Nenhuma divergência selecionada para exportar')
      setOpenExportMenu(false)
      return
    }

    setExporting(true)

    try {
      // Criar PDF em modo retrato (portrait)
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 10
      let yPosition = margin

      // Cabeçalho
      doc.setFontSize(12)
      doc.setFont(undefined, 'bold')
      doc.text(`RELATÓRIO DE DIVERGÊNCIAS - ${divergenciaTipo.toUpperCase()}`, margin, yPosition)
      yPosition += 6

      doc.setFontSize(9)
      doc.setFont(undefined, 'normal')
      doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')} | Total: ${divergenciasParaExportar.length} registros`, margin, yPosition)
      yPosition += 8

      // Função para calcular largura das colunas (flex 1 = distribuição igual)
      const getColumnHeaders = () => {
        if (divergenciaTipo === 'cic') {
          return ['Num Lanç.', 'Num Doc', 'Valor', 'Vencimento', 'CIC Bol', 'CIC Sac', 'DT Venci', 'VR Face', 'Num Tít', 'Num Lanç.']
        } else if (divergenciaTipo === 'valor') {
          return ['Num Lanç.', 'Num Doc', 'Vencimento', 'CIC Bol', 'Valor Bol', 'VR Face', 'CIC Sac', 'DT Venci', 'Num Tít', 'Num Lanç.']
        } else {
          return ['Num Lanç.', 'Num Doc', 'Vencimento', 'CIC Bol', 'Valor Bol', 'Venc 2', 'DT Venci', 'VR Face', 'CIC Sac', 'Num Tít', 'Num Lanç.']
        }
      }

      // Cabeçalhos das colunas
      const headers = getColumnHeaders()
      const numCols = headers.length
      const colWidth = (pageWidth - margin * 2) / numCols

      doc.setFontSize(8)
      doc.setFont(undefined, 'bold')
      headers.forEach((header, idx) => {
        doc.text(String(header), margin + (idx + 1) * colWidth - 1, yPosition, { maxWidth: colWidth - 1, align: 'right' })
      })
      yPosition += 5

      // Linha separadora
      doc.setLineWidth(0.2)
      doc.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 3

      // Dados
      doc.setFont(undefined, 'normal')
      const lineHeight = 4
      let pageCount = 1

      divergenciasParaExportar.forEach((div, idx) => {
        // Verificar se precisa de nova página
        if (yPosition + lineHeight > pageHeight - margin) {
          doc.addPage()
          yPosition = margin
          pageCount++
        }

        let rowData = []
        if (divergenciaTipo === 'cic') {
          rowData = [
            String(div.boleto_num_lancamento || ''),
            String(div.boleto_numero_documento || ''),
            formatCurrency(div.boleto_valor),
            formatDate(div.boleto_data_vencimento),
            String(div.boleto_sacado_cic || ''),
            String(div.opeite_cic || ''),
            formatDate(div.opeite_dt_venci),
            formatCurrency(div.opeite_vr_face),
            String(div.opeite_num_titulo || ''),
            String(div.opeite_num_lancamento || '')
          ]
        } else if (divergenciaTipo === 'valor') {
          rowData = [
            String(div.boleto_num_lancamento || ''),
            String(div.boleto_numero_documento || ''),
            formatDate(div.boleto_data_vencimento),
            String(div.boleto_sacado_cic || ''),
            formatCurrency(div.boleto_valor),
            formatCurrency(div.opeite_vr_face),
            String(div.opeite_cic || ''),
            formatDate(div.opeite_dt_venci),
            String(div.opeite_num_titulo || ''),
            String(div.opeite_num_lancamento || '')
          ]
        } else {
          rowData = [
            String(div.boleto_num_lancamento || ''),
            String(div.boleto_numero_documento || ''),
            formatDate(div.boleto_data_vencimento),
            String(div.boleto_sacado_cic || ''),
            formatCurrency(div.boleto_valor),
            formatDate(div.boleto_data_vencimento),
            formatDate(div.opeite_dt_venci),
            formatCurrency(div.opeite_vr_face),
            String(div.opeite_cic || ''),
            String(div.opeite_num_titulo || ''),
            String(div.opeite_num_lancamento || '')
          ]
        }

        // Renderizar dados da linha com largura igual (flex 1)
        rowData.forEach((value, colIdx) => {
          const stringValue = String(value || '')
          const truncated = stringValue.length > 10 ? stringValue.substring(0, 10) : stringValue
          doc.text(truncated, margin + (colIdx + 1) * colWidth - 1, yPosition, { maxWidth: colWidth - 1, align: 'right' })
        })

        yPosition += lineHeight
      })

      // Rodapé
      doc.setFontSize(8)
      doc.setFont(undefined, 'normal')
      yPosition = pageHeight - 8
      doc.text(`Página ${pageCount}`, pageWidth / 2, yPosition, { align: 'center' })

      // Salvar PDF
      doc.save(`divergencias_${divergenciaTipo}_${new Date().toISOString().split('T')[0]}.pdf`)

      alert(`${divergenciasParaExportar.length} divergência(s) exportada(s) em PDF com sucesso!`)
      setOpenExportMenu(false)
    } catch (error) {
      console.error('[Export] Erro ao exportar PDF:', error)
      alert('Erro ao exportar PDF: ' + error.message)
    } finally {
      setExporting(false)
    }
  }

  // Exporta os boletos selecionados (tabela principal) num relatório PDF e abre o PREVIEW.
  // Formato retrato, sem quebra de linha (ellipsize) e linhas compactas.
  const handleExportarBoletosPDF = () => {
    const filteredBoletos = getFilteredBoletos()
    const selecionados = Array.from(selectedRows)
      .map(index => filteredBoletos[index])
      .filter(Boolean)

    if (selecionados.length === 0) {
      alert('Selecione pelo menos um registro para exportar')
      setOpenExportMenu(false)
      return
    }

    setExporting(true)
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const margin = 8

      doc.setFontSize(12)
      doc.setFont(undefined, 'bold')
      doc.text('RELATÓRIO E-FACTOR', margin, 12)
      doc.setFontSize(9)
      doc.setFont(undefined, 'normal')
      doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')} | Total: ${selecionados.length} registro(s)`, margin, 17)

      autoTable(doc, {
        startY: 21,
        head: [['Nº Lanç.', 'Documento', 'Sacado', 'CIC', 'Emissão', 'Vencimento', 'Valor', 'Nosso Nº', 'Status']],
        body: selecionados.map(b => [
          String(b.num_lancamento || ''),
          String(b.numero_documento || ''),
          String(b.sacado_nome || ''),
          String(b.sacado_cic || ''),
          formatDate(b.data_emissao),
          formatDate(b.data_vencimento),
          formatCurrency(b.valor),
          String(b.nosso_numero || ''),
          String(b.status || ''),
        ]),
        // overflow 'ellipsize' = não quebra linha (trunca com reticências)
        // cellPadding pequeno = linhas compactas
        styles: { fontSize: 7, cellPadding: 0.8, overflow: 'ellipsize', valign: 'middle', lineWidth: 0.1 },
        headStyles: { fillColor: [26, 26, 26], textColor: 255, fontSize: 7, halign: 'left', cellPadding: 0.8 },
        columnStyles: { 6: { halign: 'right' } },
        margin: { left: margin, right: margin },
        theme: 'grid',
      })

      const blob = doc.output('blob')
      const url = URL.createObjectURL(blob)
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl)
      setPdfPreviewUrl(url)
      setOpenExportMenu(false)
    } catch (error) {
      console.error('[Export] Erro ao gerar PDF dos boletos:', error)
      alert('Erro ao gerar PDF: ' + error.message)
    } finally {
      setExporting(false)
    }
  }

  const closePdfPreview = () => {
    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl)
    setPdfPreviewUrl(null)
  }

  const handleShowDivergencias = async () => {
    // Se já está mostrando divergências, apenas toggle
    if (showDivergencias) {
      setShowDivergencias(false)
      setDivergenciaTipo('cic')
      return
    }

    // Se não está mostrando, precisa executar reconciliação
    setReconciling(true)
    setReconciliationResult(null)

    try {
      console.log('[Divergências] Executando reconciliação automática...')
      const result = await reconciliateOpeiteWithBoletos(user.id)

      if (result.success) {
        setReconciliationResult({
          success: true,
          totalProcessed: result.totalProcessed,
          totalMatched: result.totalMatched,
          totalUpdated: result.totalUpdated,
          totalDivergencias: result.totalDivergencias,
          errors: result.errors
        })

        // Armazenar os 3 tipos de divergências
        setDivergenciasCIC(result.divergenciasCIC || [])
        setDivergenciasValor(result.divergenciasValor || [])
        setDivergenciasVencimento(result.divergenciasVencimento || [])

        console.log('[Divergências] Reconciliação concluída:', result)

        // Reload boletos
        loadBoletos()

        // Mostrar tabela de divergências
        setShowDivergencias(true)
        setDivergenciaTipo('cic')

        // Mostrar resumo
        let message = `Reconciliação concluída:\n`
        message += `- Total processado: ${result.totalProcessed}\n`
        message += `- Com correspondência exata: ${result.totalMatched}\n`
        message += `- Atualizados com NUM_LANCAMENTO: ${result.totalUpdated}\n\n`
        message += `Divergências encontradas:\n`
        message += `- CIC diferente (valor+data OK): ${result.totalDivergenciasCIC}\n`
        message += `- Valor diferente (cic+data OK): ${result.totalDivergenciasValor}\n`
        message += `- Vencimento diferente (cic+valor OK): ${result.totalDivergenciasVencimento}`

        if (result.errors && result.errors.length > 0) {
          message += `\n\n- Erros: ${result.errors.length}`
        }

        alert(message)
      } else {
        setReconciliationResult({
          success: false,
          error: result.error
        })
        alert('Erro na reconciliação: ' + result.error)
      }
    } catch (error) {
      console.error('[Divergências] Erro:', error)
      alert('Erro ao executar reconciliação: ' + error.message)
    } finally {
      setReconciling(false)
    }
  }

  const handleReconciliateWithOpeite = async () => {
    setReconciling(true)
    setReconciliationResult(null)

    try {
      const result = await reconciliateOpeiteWithBoletos(user.id)

      if (result.success) {
        setReconciliationResult({
          success: true,
          totalProcessed: result.totalProcessed,
          totalMatched: result.totalMatched,
          totalUpdated: result.totalUpdated,
          totalDivergencias: result.totalDivergencias,
          errors: result.errors
        })

        // Armazenar os 3 tipos de divergências
        setDivergenciasCIC(result.divergenciasCIC || [])
        setDivergenciasValor(result.divergenciasValor || [])
        setDivergenciasVencimento(result.divergenciasVencimento || [])

        console.log('[Reconciliação] Concluída:', result)

        // Reload boletos
        loadBoletos()

        // Show summary
        let message = `Reconciliação concluída:\n`
        message += `- Total processado: ${result.totalProcessed}\n`
        message += `- Com correspondência exata: ${result.totalMatched}\n`
        message += `- Atualizados com NUM_LANCAMENTO: ${result.totalUpdated}\n`
        message += `- Divergências encontradas (CIC): ${result.totalDivergencias}`

        if (result.errors && result.errors.length > 0) {
          message += `\n- Erros: ${result.errors.length}`
        }

        alert(message)
      } else {
        setReconciliationResult({
          success: false,
          error: result.error
        })
        alert('Erro na reconciliação: ' + result.error)
      }
    } catch (error) {
      console.error('[Reconciliação] Erro:', error)
      alert('Erro ao reconciliar com OPEITE: ' + error.message)
    } finally {
      setReconciling(false)
    }
  }

  return (
    <div className="space-y-6 overflow-y-auto flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">E-Factor</h1>
          <p className="text-sm text-[#666666] mt-1">Consulta e gestão de antecipações</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleReconciliateWithOpeite}
            disabled={reconciling}
            className={`px-4 py-2 text-sm font-medium border rounded transition ${
              reconciling
                ? 'bg-transparent text-[#666666] border-[#2a2a2a] cursor-not-allowed'
                : 'bg-transparent text-white border-[#2a2a2a] hover:bg-[#111111]'
            }`}
          >
            {reconciling ? '⏳ Reconciliando...' : '🔄 Reconciliar OPEITE'}
          </button>
          {/* Botão Exportar com Dropdown */}
          <div className="relative">
            <button
              onClick={() => setOpenExportMenu(!openExportMenu)}
              disabled={exporting}
              className={`px-4 py-2 text-sm font-medium border rounded transition ${
                exporting
                  ? 'bg-transparent text-[#666666] border-[#2a2a2a] cursor-not-allowed'
                  : 'bg-transparent text-white border-[#2a2a2a] hover:bg-[#111111]'
              }`}
            >
              {exporting ? '⏳ Exportando...' : '📥 Exportar'}
            </button>

            {openExportMenu && (
              <div className="absolute right-0 top-full mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded shadow-lg z-50 min-w-48">
                <button
                  onClick={handleExportarCSV}
                  disabled={exporting || selectedDivergenciasIds.size === 0}
                  className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#2a2a2a] transition border-b border-[#2a2a2a] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  📊 Exportar CSV
                </button>
                <button
                  onClick={() => (showDivergencias ? handleExportarPDF() : handleExportarBoletosPDF())}
                  disabled={exporting || (showDivergencias ? selectedDivergenciasIds.size === 0 : selectedRows.size === 0)}
                  className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#2a2a2a] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  📑 Exportar PDF
                </button>
              </div>
            )}
          </div>
          <button
            onClick={handleShowDivergencias}
            disabled={reconciling}
            className={`px-4 py-2 text-sm font-medium border rounded transition ${
              reconciling
                ? 'bg-transparent text-[#666666] border-[#2a2a2a] cursor-not-allowed'
                : 'bg-transparent text-white border-[#2a2a2a] hover:bg-[#111111]'
            }`}
          >
            {reconciling ? '⏳ Reconciliando...' : `🔍 Divergência ${(divergenciasCIC.length + divergenciasValor.length + divergenciasVencimento.length) > 0 ? `(${divergenciasCIC.length + divergenciasValor.length + divergenciasVencimento.length})` : ''}`}
          </button>
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 bg-white text-black text-sm font-medium rounded hover:opacity-90 transition"
          >
            + Novo
          </button>
        </div>
      </div>

      {/* Reconciliation Result Alert */}
      {reconciliationResult && (
        <div className={`p-4 rounded-md border ${
          reconciliationResult.success
            ? 'bg-[#1a1a1a] border-[#2a2a2a] text-white'
            : 'bg-[#1a1a1a] border-[#2a2a2a] text-white'
        }`}>
          {reconciliationResult.success ? (
            <>
              <p className="font-semibold mb-2">✓ Reconciliação concluída com sucesso</p>
              <div className="text-sm space-y-1">
                <p>Total processado: <strong>{reconciliationResult.totalProcessed}</strong></p>
                <p>Com correspondência exata: <strong>{reconciliationResult.totalMatched}</strong></p>
                <p>Atualizados com NUM_LANCAMENTO: <strong>{reconciliationResult.totalUpdated}</strong></p>
                {reconciliationResult.errors && reconciliationResult.errors.length > 0 && (
                  <p className="text-white mt-2">Erros encontrados: {reconciliationResult.errors.length}</p>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="font-semibold">✗ Erro na reconciliação</p>
              <p className="text-sm mt-2">{reconciliationResult.error}</p>
            </>
          )}
        </div>
      )}

      {/* Search and Filter (fixo no topo ao rolar) */}
      <div className="sticky top-0 z-30 bg-[#0a0a0a] flex gap-3 items-center py-3">
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

        {/* Checkbox Vencidos */}
        <div className="flex items-center gap-2 px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-md cursor-pointer hover:bg-[#1a1a1a] transition" onClick={() => { console.log('[EFactor] Clicou no checkbox. Estado atual:', filtroVencidos); setFiltroVencidos(!filtroVencidos); }}>
          <input
            type="checkbox"
            checked={filtroVencidos}
            onChange={(e) => {
              console.log('[EFactor] onChange disparado. Checked:', e.target.checked)
              setFiltroVencidos(e.target.checked)
            }}
            onClick={(e) => {
              console.log('[EFactor] onClick disparado no input')
              e.stopPropagation()
            }}
            className="w-4 h-4 cursor-pointer accent-white"
            style={{ pointerEvents: 'auto' }}
          />
          <span className="text-white text-sm font-medium whitespace-nowrap select-none">Vencidos</span>
        </div>

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
              <button
                onClick={handleBuscarLancamento}
                className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#2a2a2a] transition"
              >
                🔎 Buscar Lançamento
              </button>
            </div>
          )}
        </div>

        {/* Num Lancamento Filter */}
        <div className="flex items-center gap-3 pl-3 border-l border-[#2a2a2a]">
          <span className="text-sm text-[#666666] whitespace-nowrap">Num Lançamento:</span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showComNumLancamento}
              onChange={(e) => setShowComNumLancamento(e.target.checked)}
              className="w-4 h-4 accent-white cursor-pointer"
            />
            <span className="text-sm text-white">Com</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showSemNumLancamento}
              onChange={(e) => setShowSemNumLancamento(e.target.checked)}
              className="w-4 h-4 accent-white cursor-pointer"
            />
            <span className="text-sm text-white">Sem</span>
          </label>
        </div>

        {/* TODOS: sem filtro por perfil selecionado */}
        <div className="flex items-center gap-3 pl-3 border-l border-[#2a2a2a]">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filtroTodos}
              onChange={(e) => setFiltroTodos(e.target.checked)}
              className="w-4 h-4 accent-white cursor-pointer"
            />
            <span className="text-sm text-white">TODOS</span>
          </label>
        </div>

        {/* Filtro por correspondência no OPEITE (mesmo CIC) */}
        <div className="flex items-center gap-3 pl-3 border-l border-[#2a2a2a]">
          <span className="text-sm text-[#666666] whitespace-nowrap">
            OPEITE:{loadingOpeiteMaps ? ' ⏳' : ''}
          </span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filtroValorOpeite}
              onChange={(e) => setFiltroValorOpeite(e.target.checked)}
              className="w-4 h-4 accent-white cursor-pointer"
            />
            <span className="text-sm text-white">Valor</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filtroVencOpeite}
              onChange={(e) => setFiltroVencOpeite(e.target.checked)}
              className="w-4 h-4 accent-white cursor-pointer"
            />
            <span className="text-sm text-white">Vencimento</span>
          </label>
        </div>
      </div>

      {/* Tabela de Boletos */}
      {!showDivergencias && (
        <BoletoTable
          boletos={getFilteredBoletos()}
          onEdit={handleEdit}
          selectedRows={selectedRows}
          onSelectedRowsChange={setSelectedRows}
        />
      )}

      {/* Tabela de Divergências */}
      {showDivergencias && (divergenciasCIC.length > 0 || divergenciasValor.length > 0 || divergenciasVencimento.length > 0) && (
        <div className="space-y-4">
          {/* Radio Box para Filtrar por Tipo de Divergência */}
          <div className="flex items-center justify-between p-4 bg-[#111111] border border-[#2a2a2a] rounded">
            <div className="flex items-center gap-6">
              <span className="text-sm text-[#666666] whitespace-nowrap">Filtrar por:</span>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="divergenciaTipo"
                  value="cic"
                  checked={divergenciaTipo === 'cic'}
                  onChange={(e) => setDivergenciaTipo(e.target.value)}
                  className="w-4 h-4 cursor-pointer"
                />
                <span className="text-sm text-white">CIC</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="divergenciaTipo"
                  value="valor"
                  checked={divergenciaTipo === 'valor'}
                  onChange={(e) => setDivergenciaTipo(e.target.value)}
                  className="w-4 h-4 cursor-pointer"
                />
                <span className="text-sm text-white">Valor</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="divergenciaTipo"
                  value="vencimento"
                  checked={divergenciaTipo === 'vencimento'}
                  onChange={(e) => setDivergenciaTipo(e.target.value)}
                  className="w-4 h-4 cursor-pointer"
                />
                <span className="text-sm text-white">Vencimento</span>
              </label>

              <div className="border-l border-[#2a2a2a] pl-6">
                <label className="text-sm text-[#666666] mr-3">Status:</label>
                <select
                  value={filtroStatusDivergencias}
                  onChange={(e) => {
                    setFiltroStatusDivergencias(e.target.value)
                    setSelectedDivergenciasIds(new Set())
                  }}
                  className="px-3 py-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white text-sm focus:border-white outline-none transition"
                >
                  <option value="todos">Todos os Status</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleConciliarDivergencias}
              disabled={selectedDivergenciasIds.size === 0 || conciliating}
              className={`px-4 py-2 text-sm font-medium border rounded transition ${
                selectedDivergenciasIds.size === 0 || conciliating
                  ? 'bg-transparent text-[#666666] border-[#2a2a2a] cursor-not-allowed'
                  : 'bg-transparent text-white border-[#2a2a2a] hover:bg-[#111111]'
              }`}
            >
              {conciliating ? '⏳ Conciliando...' : `Conciliar (${selectedDivergenciasIds.size})`}
            </button>
          </div>

          {/* Tabela Dinâmica */}
          <div className="overflow-x-auto">
            {divergenciaTipo === 'cic' && (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#111111] border-b border-[#2a2a2a]">
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white">Num Lançamento</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-white w-12">
                      <input
                        type="checkbox"
                        checked={
                          getFilteredDivergencias(divergenciasCIC).length > 0 &&
                          getFilteredDivergencias(divergenciasCIC).every((div) =>
                            selectedDivergenciasIds.has(`cic-${divergenciasCIC.indexOf(div)}`)
                          )
                        }
                        onChange={(e) => {
                          const newSelected = new Set(selectedDivergenciasIds)
                          const filteredDivs = getFilteredDivergencias(divergenciasCIC)
                          filteredDivs.forEach((div) => {
                            const idx = divergenciasCIC.indexOf(div)
                            if (e.target.checked) {
                              newSelected.add(`cic-${idx}`)
                            } else {
                              newSelected.delete(`cic-${idx}`)
                            }
                          })
                          setSelectedDivergenciasIds(newSelected)
                        }}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white">Número Doc</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white">Valor (Boleto)</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white">Vencimento</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white">CIC (Boleto)</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white">CIC (SACADO)</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white">DT Venci (OPEITE)</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white">VR Face (OPEITE)</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white">Num Título</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white">Num Lançamento</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredDivergencias(divergenciasCIC).map((div, idx) => (
                    <tr key={idx} className="border-b border-[#2a2a2a] hover:bg-[#1a1a1a] transition">
                      <td className="px-4 py-3 text-sm text-white text-right">{div.boleto_num_lancamento || '-'}</td>
                      <td className="px-4 py-3 text-center w-12">
                        <input
                          type="checkbox"
                          checked={selectedDivergenciasIds.has(`cic-${idx}`)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedDivergenciasIds)
                            if (e.target.checked) {
                              newSelected.add(`cic-${idx}`)
                            } else {
                              newSelected.delete(`cic-${idx}`)
                            }
                            setSelectedDivergenciasIds(newSelected)
                          }}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-white text-right">{div.boleto_numero_documento}</td>
                      <td className="px-4 py-3 text-sm text-white text-right">{formatCurrencyWithPrefix(div.boleto_valor)}</td>
                      <td className="px-4 py-3 text-sm text-white text-right">{formatDate(div.boleto_data_vencimento)}</td>
                      <td className="px-4 py-3 text-sm text-white text-right">{div.boleto_sacado_cic}</td>
                      <td className="px-4 py-3 text-sm text-white text-right">{div.opeite_cic}</td>
                      <td className="px-4 py-3 text-sm text-white text-right">{formatDate(div.opeite_dt_venci)}</td>
                      <td className="px-4 py-3 text-sm text-white text-right">{formatCurrencyWithPrefix(div.opeite_vr_face)}</td>
                      <td className="px-4 py-3 text-sm text-white text-right">{div.opeite_num_titulo}</td>
                      <td className="px-4 py-3 text-sm text-white text-right">{div.opeite_num_lancamento}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {divergenciaTipo === 'valor' && (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#111111] border-b border-[#2a2a2a]">
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white">Num Lançamento</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-white w-12">
                      <input
                        type="checkbox"
                        checked={
                          getFilteredDivergencias(divergenciasValor).length > 0 &&
                          getFilteredDivergencias(divergenciasValor).every((div) =>
                            selectedDivergenciasIds.has(`valor-${divergenciasValor.indexOf(div)}`)
                          )
                        }
                        onChange={(e) => {
                          const newSelected = new Set(selectedDivergenciasIds)
                          const filteredDivs = getFilteredDivergencias(divergenciasValor)
                          filteredDivs.forEach((div) => {
                            const idx = divergenciasValor.indexOf(div)
                            if (e.target.checked) {
                              newSelected.add(`valor-${idx}`)
                            } else {
                              newSelected.delete(`valor-${idx}`)
                            }
                          })
                          setSelectedDivergenciasIds(newSelected)
                        }}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white">Número Doc</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white">Vencimento</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white">CIC (Boleto)</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white">Valor (Boleto)</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white">VR Face (OPEITE)</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white">CIC (SACADO)</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white">DT Venci (OPEITE)</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white">Num Título</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white">Num Lançamento</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredDivergencias(divergenciasValor).map((div, idx) => (
                    <tr key={idx} className="border-b border-[#2a2a2a] hover:bg-[#1a1a1a] transition">
                      <td className="px-4 py-3 text-sm text-white text-right">{div.boleto_num_lancamento || '-'}</td>
                      <td className="px-4 py-3 text-center w-12">
                        <input
                          type="checkbox"
                          checked={selectedDivergenciasIds.has(`valor-${idx}`)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedDivergenciasIds)
                            if (e.target.checked) {
                              newSelected.add(`valor-${idx}`)
                            } else {
                              newSelected.delete(`valor-${idx}`)
                            }
                            setSelectedDivergenciasIds(newSelected)
                          }}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-white text-right">{div.boleto_numero_documento}</td>
                      <td className="px-4 py-3 text-sm text-white text-right">{formatDate(div.boleto_data_vencimento)}</td>
                      <td className="px-4 py-3 text-sm text-white text-right">{div.boleto_sacado_cic}</td>
                      <td className="px-4 py-3 text-sm text-white text-right">{formatCurrencyWithPrefix(div.boleto_valor)}</td>
                      <td className="px-4 py-3 text-sm text-white text-right">{formatCurrencyWithPrefix(div.opeite_vr_face)}</td>
                      <td className="px-4 py-3 text-sm text-white text-right">{div.opeite_cic}</td>
                      <td className="px-4 py-3 text-sm text-white text-right">{formatDate(div.opeite_dt_venci)}</td>
                      <td className="px-4 py-3 text-sm text-white text-right">{div.opeite_num_titulo}</td>
                      <td className="px-4 py-3 text-sm text-white text-right">{div.opeite_num_lancamento}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {divergenciaTipo === 'vencimento' && (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#111111] border-b border-[#2a2a2a]">
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white">Num Lançamento</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-white w-12">
                      <input
                        type="checkbox"
                        checked={
                          getFilteredDivergencias(divergenciasVencimento).length > 0 &&
                          getFilteredDivergencias(divergenciasVencimento).every((div) =>
                            selectedDivergenciasIds.has(`vencimento-${divergenciasVencimento.indexOf(div)}`)
                          )
                        }
                        onChange={(e) => {
                          const newSelected = new Set(selectedDivergenciasIds)
                          const filteredDivs = getFilteredDivergencias(divergenciasVencimento)
                          filteredDivs.forEach((div) => {
                            const idx = divergenciasVencimento.indexOf(div)
                            if (e.target.checked) {
                              newSelected.add(`vencimento-${idx}`)
                            } else {
                              newSelected.delete(`vencimento-${idx}`)
                            }
                          })
                          setSelectedDivergenciasIds(newSelected)
                        }}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white">Número Doc</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white">Vencimento (Boleto)</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white">CIC (Boleto)</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white">Valor (Boleto)</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white">Vencimento (Boleto 2)</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white">DT Venci (OPEITE)</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white">VR Face (OPEITE)</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white">CIC (SACADO)</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white">Num Título</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white">Num Lançamento</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredDivergencias(divergenciasVencimento).map((div, idx) => (
                    <tr key={idx} className="border-b border-[#2a2a2a] hover:bg-[#1a1a1a] transition">
                      <td className="px-4 py-3 text-sm text-white text-right">{div.boleto_num_lancamento || '-'}</td>
                      <td className="px-4 py-3 text-center w-12">
                        <input
                          type="checkbox"
                          checked={selectedDivergenciasIds.has(`vencimento-${idx}`)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedDivergenciasIds)
                            if (e.target.checked) {
                              newSelected.add(`vencimento-${idx}`)
                            } else {
                              newSelected.delete(`vencimento-${idx}`)
                            }
                            setSelectedDivergenciasIds(newSelected)
                          }}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-white text-right">{div.boleto_numero_documento}</td>
                      <td className="px-4 py-3 text-sm text-white text-right">{formatDate(div.boleto_data_vencimento)}</td>
                      <td className="px-4 py-3 text-sm text-white text-right">{div.boleto_sacado_cic}</td>
                      <td className="px-4 py-3 text-sm text-white text-right">{formatCurrencyWithPrefix(div.boleto_valor)}</td>
                      <td className="px-4 py-3 text-sm text-white text-right">{formatDate(div.boleto_data_vencimento)}</td>
                      <td className="px-4 py-3 text-sm text-white text-right">{formatDate(div.opeite_dt_venci)}</td>
                      <td className="px-4 py-3 text-sm text-white text-right">{formatCurrencyWithPrefix(div.opeite_vr_face)}</td>
                      <td className="px-4 py-3 text-sm text-white text-right">{div.opeite_cic}</td>
                      <td className="px-4 py-3 text-sm text-white text-right">{div.opeite_num_titulo}</td>
                      <td className="px-4 py-3 text-sm text-white text-right">{div.opeite_num_lancamento}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {showDivergencias && divergenciasCIC.length === 0 && divergenciasValor.length === 0 && divergenciasVencimento.length === 0 && (
        <div className="p-4 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] text-white">
          <p className="font-semibold">✓ Nenhuma divergência encontrada</p>
          <p className="text-sm mt-2">Todos os boletos que encontraram correspondência estão corretos.</p>
        </div>
      )}

      {/* Modal de Formulário */}
      {showModal && (
        <BoletoFormModal
          boleto={editingBoleto}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* Modal Buscar Lançamento */}
      {showBuscarLancamento && boletoBusca && (
        <BuscarLancamentoModal
          boleto={boletoBusca}
          onUpdated={loadBoletos}
          onClose={() => { setShowBuscarLancamento(false); loadBoletos() }}
        />
      )}

      {/* Pré-visualização do relatório PDF */}
      {pdfPreviewUrl && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg w-full max-w-5xl h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#1f1f1f]">
              <h2 className="text-white text-sm font-semibold">Pré-visualização do relatório</h2>
              <div className="flex gap-2">
                <a
                  href={pdfPreviewUrl}
                  download={`efactor_${new Date().toISOString().split('T')[0]}.pdf`}
                  className="px-3 py-1.5 bg-white text-black text-xs font-medium rounded hover:opacity-90 transition"
                >
                  ⬇ Baixar
                </a>
                <button
                  onClick={closePdfPreview}
                  className="px-3 py-1.5 bg-[#1a1a1a] text-white text-xs font-medium border border-[#2a2a2a] rounded hover:bg-[#222222] transition"
                >
                  Fechar
                </button>
              </div>
            </div>
            <iframe src={pdfPreviewUrl} title="Pré-visualização PDF" className="flex-1 w-full rounded-b-lg bg-white" />
          </div>
        </div>
      )}
    </div>
  )
}
