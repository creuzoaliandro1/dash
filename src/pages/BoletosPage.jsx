import { useState, useEffect, useCallback, useRef } from 'react'
import BoletoFormModal from '../components/Boletos/BoletoFormModal'
import BoletoTable from '../components/Boletos/BoletoTable'
import FileUpload from '../components/Boletos/FileUpload'
import ImportPreview from '../components/Boletos/ImportPreview'
import { createBoleto, updateBoleto, updateBoletosByLancamentos, getBoletos, deleteBoleto, deletarBoletosJaRegistrados, createRemessa, getContaInfo, incrementContaCnab400, getContaRemessaCount, getAllContas, getOPEITEByCedente, criarAntecipacao, importOpeiteToBoletos, retornarAntecipacao, getBoletosDoBordero, getBorderoData, getBoletosImportadosUnificados, markBoletosRemessa, checkBoletosJaRegistrados, autoImportarParaCapt, insertCaptAssina, uploadAnexoBoleto } from '../services/boletoService'
import { generateMultipleBoletoPDFs, generateCNAB400RemittanceFile } from '../utils/boleto'
import { createAndDownloadZip } from '../utils/zipUtils'
import { generateDuplicataPDF, generateCessaoDireitosBlob } from '../utils/duplicata'
import { criarDocumentoAssinatura, CAPT_SIGNER, syncZapSignPendentes } from '../services/zapsignService'
import { buildDuplicatasBoletosBlob, buildBorderoBlobs, buildPdfCompletoSemBoletos } from '../utils/assinaturaDocs'
import { enviarLinkBorderoWhatsApp } from '../utils/whatsappUtils'
import ZapsignModal from '../components/Boletos/ZapsignModal'
import ContaRegistradoTable from '../components/Boletos/ContaRegistradoTable'

export default function BoletosPage() {
  const [showModal, setShowModal] = useState(false)
  const [boletos, setBoletos] = useState([])
  const [editingBoleto, setEditingBoleto] = useState(null)
  const [loading, setLoading] = useState(false)
  const [importStatus, setImportStatus] = useState(null)
  const [showImportResult, setShowImportResult] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewData, setPreviewData] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [openActionsMenu, setOpenActionsMenu] = useState(false)
  const [generatingZip, setGeneratingZip] = useState(false)
  const [generatingCNAB400, setGeneratingCNAB400] = useState(false)
  const [cnab400Confirm, setCnab400Confirm] = useState(null) // { titulos, tipoOperacao, boletosParaRemessa }
  const [processandoAntecipacao, setProcessandoAntecipacao] = useState(false)
  const [importingOpeite, setImportingOpeite] = useState(false)
  // Modal de importação Efactor (com opção de importar para outro cedente)
  const [showEfactorImportModal, setShowEfactorImportModal] = useState(false)
  const [efactorImportRecords, setEfactorImportRecords] = useState([])
  const [efactorImportStep, setEfactorImportStep] = useState('choice') // 'choice' | 'selectProfile'
  const [efactorImportTargetId, setEfactorImportTargetId] = useState('')
  const [assinandoZapsign, setAssinandoZapsign] = useState(false)
  const [showZapsignModal, setShowZapsignModal] = useState(false)
  const [showAssinarSub, setShowAssinarSub] = useState(false)
  const [showCnab400Sub, setShowCnab400Sub] = useState(false)
  const [assinarMode, setAssinarMode] = useState(null) // 'com' | 'sem'
  const [retornandoAntecipacao, setRetornandoAntecipacao] = useState(false)
  const [contaData, setContaData] = useState(null)
  const [dataEmissaoInicio, setDataEmissaoInicio] = useState('')
  const [dataEmissaoFim, setDataEmissaoFim] = useState('')
  const [dataVencimentoInicio, setDataVencimentoInicio] = useState('')
  const [dataVencimentoFim, setDataVencimentoFim] = useState('')
  const [dataGeradoInicio, setDataGeradoInicio] = useState('')
  const [dataGeradoFim, setDataGeradoFim] = useState('')
  const [filterType, setFilterType] = useState('emissao')
  const [showFiltroMenu, setShowFiltroMenu] = useState(false)
  const [syncingZap, setSyncingZap] = useState(false)
  const [dataRegistroInicio, setDataRegistroInicio] = useState('')
  const [dataRegistroFim, setDataRegistroFim] = useState('')
  const [dataAntecipadoInicio, setDataAntecipadoInicio] = useState('')
  const [dataAntecipadoFim, setDataAntecipadoFim] = useState('')
  // Filtro de STATUS por checkbox (inicia somente "Pendentes" marcado)
  const [statusChecks, setStatusChecks] = useState({ pago: false, cancelado: false, pendente: true })
  const [efactorActive, setEfactorActive] = useState(false)
  const [contaCaptActive, setContaCaptActive] = useState(false)
  const [captReloadKey, setCaptReloadKey] = useState(0)

  // Obter tipo de usuário e conta selecionada
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const userType = user.tipo || 'U'
  const selectedContaId = localStorage.getItem('activeContaId') || user.id
  const [allContas, setAllContas] = useState([])

  // Debug: log do tipo de usuário
  useEffect(() => {
    console.log('[BoletosPage] Debug - userType:', userType, 'user:', user)
  }, [userType])

  // Carregar contas se for Master
  useEffect(() => {
    console.log('[BoletosPage] useEffect getAllContas - userType:', userType)
    if (userType === 'M') {
      console.log('[BoletosPage] Usuário é Master, chamando getAllContas()...')
      getAllContas().then(({ data, error }) => {
        console.log('[BoletosPage] getAllContas retornou:', { dataLength: data?.length, data, error })
        if (error) {
          console.error('[BoletosPage] ERRO na resposta:', error)
          return
        }
        if (data && data.length > 0) {
          console.log('[BoletosPage] ✅ Contas carregadas com sucesso! Total:', data.length)
          console.log('[BoletosPage] PRIMEIRA CONTA - TODOS OS CAMPOS:')
          console.log(JSON.stringify(data[0], null, 2))
          console.log('[BoletosPage] Resumo das 3 primeiras contas:')
          data.slice(0, 3).forEach((c, idx) => {
            console.log(`  Conta ${idx}:`, {
              id: c.id,
              cedente: c.cedente,
              conta: c.conta,
              nome_correntista: c.nome_correntista,
              cic: c.cic,
              all_keys: Object.keys(c)
            })
          })
          console.log('[BoletosPage] Chamando setAllContas com', data.length, 'contas')
          setAllContas(data)
        } else {
          console.warn('[BoletosPage] ⚠️ getAllContas retornou vazio ou undefined:', data)
        }
      }).catch(err => {
        console.error('[BoletosPage] ❌ Erro ao carregar contas:', err)
      })
    } else {
      console.log('[BoletosPage] Usuário NÃO é Master, pulando getAllContas(). userType:', userType)
    }
  }, [userType])

  // Lê o ID ativo sempre do localStorage (sem stale closure)
  // Priorita activeContaId (usado quando tipo M troca de perfil), fallback para user.id
  const getActiveContaId = useRef(() => {
    const stored = localStorage.getItem('activeContaId')
    if (stored) return stored
    const u = JSON.parse(localStorage.getItem('user') || '{}')
    return u.id
  }).current

  const loadContaData = useCallback(async () => {
    const activeId = getActiveContaId()
    if (!activeId) return
    const { data } = await getContaInfo(activeId)
    setContaData(data || null)
  }, [])

  const loadBoletos = useCallback(async () => {
    setLoading(true)
    try {
      const activeId = getActiveContaId()
      console.log('[BoletosPage] loadBoletos para conta:', activeId, 'Efactor:', efactorActive)

      if (efactorActive) {
        // Carregar dados do Efactor (OPEITE)
        const resultado = await carregarOPEITE(activeId, contaData)
        setBoletos(resultado.data || [])
      } else {
        // Modo "Importados": visão unificada de capt_boletos + capt_registrado + OPEITE
        // (match por valor+vencimento+cic; prioridade registrado > OPEITE > boletos).
        // Garante ter o cedente/cod_cedente da conta para filtrar registrado/OPEITE.
        let conta = contaData
        if (!conta && activeId) {
          const { data } = await getContaInfo(activeId)
          conta = data || { id: activeId }
        }
        const resultado = await getBoletosImportadosUnificados(conta || { id: activeId })
        setBoletos(resultado.data || [])
      }
    } catch (err) {
      console.error('Erro ao carregar boletos:', err)
      setBoletos([])
    }
    setLoading(false)
  }, [efactorActive, contaData])

  // Sincroniza tudo: ZapSign (Assina), limpa boletos já registrados (Registro) e recarrega (Antecipa)
  const handleSyncZapSign = async (silent = false) => {
    if (syncingZap) return
    setSyncingZap(true)
    try {
      const activeId = getActiveContaId()
      const msgs = []

      // 1. Assinaturas ZapSign
      const { atualizados, error: zapErr } = await syncZapSignPendentes(activeId)
      if (zapErr) {
        console.warn('[Sync] ZapSign erro:', zapErr)
      } else if (atualizados > 0) {
        msgs.push(`${atualizados} assinatura(s) confirmada(s)`)
      }

      // 2. Remove de capt_boletos os registros que já aparecem em capt_registrado
      const { excluidos, error: regErr } = await deletarBoletosJaRegistrados(activeId)
      if (regErr) {
        console.warn('[Sync] Registro erro:', regErr)
      } else if (excluidos > 0) {
        msgs.push(`${excluidos} boleto(s) migrado(s) para Registrado`)
      }

      // 3. Recarrega tudo (atualiza Antecipa, Registro, Assina)
      await loadBoletos()

      if (!silent) {
        alert(msgs.length > 0 ? `✅ ${msgs.join(' | ')}` : 'Nenhuma atualização encontrada.')
      }
    } finally {
      setSyncingZap(false)
    }
  }

  // Carregar na montagem
  useEffect(() => {
    const activeId = getActiveContaId()
    if (activeId) {
      loadBoletos()
      loadContaData()
      // Sincroniza assinaturas ZapSign em silêncio ao abrir a página
      handleSyncZapSign(true)
    }
  }, [])

  // Recarregar quando usuario tipo M troca de perfil
  useEffect(() => {
    const handleContaSwitched = () => {
      loadBoletos()
      loadContaData()
    }
    window.addEventListener('contaSwitched', handleContaSwitched)
    return () => window.removeEventListener('contaSwitched', handleContaSwitched)
  }, [loadBoletos, loadContaData])

  // Recarregar boletos quando Efactor é acionado
  useEffect(() => {
    loadBoletos()
  }, [efactorActive, loadBoletos])

  const carregarOPEITE = async (contaId, conta) => {
    try {
      if (!conta || !conta.cod_cedente) {
        console.warn('[BoletosPage] Conta não tem cod_cedente definido')
        return { data: [], error: 'Código cedente não configurado' }
      }

      console.log('[BoletosPage] Buscando OPEITE para cod_cedente:', conta.cod_cedente)
      const resultado = await getOPEITEByCedente(conta.cod_cedente)
      return resultado
    } catch (err) {
      console.error('[BoletosPage] Erro ao carregar OPEITE:', err)
      return { data: [], error: err }
    }
  }

  const handleToggleEfactor = () => {
    console.log('[BoletosPage] Toggle Efactor:', !efactorActive)
    setContaCaptActive(false) // modos mutuamente exclusivos
    setEfactorActive(!efactorActive)
    // loadBoletos será chamado automaticamente pelo useEffect quando efactorActive mudar
  }

  const handleToggleContaCapt = () => {
    console.log('[BoletosPage] Toggle Conta Capt:', !contaCaptActive)
    setEfactorActive(false) // modos mutuamente exclusivos
    setContaCaptActive((prev) => !prev)
  }

  // "Importados" = visão padrão (capt_boletos): desliga os demais modos.
  const importadosActive = !efactorActive && !contaCaptActive
  const handleShowImportados = () => {
    console.log('[BoletosPage] Mostrar Importados (capt_boletos)')
    setEfactorActive(false)
    setContaCaptActive(false)
  }

  // Após importar o Relatório para capt_registrado: recarrega a tabela e mostra resultado.
  const handleContaCaptImported = (result) => {
    setCaptReloadKey((k) => k + 1)
    setImportStatus({
      type: 'success',
      title: 'Importação Conta Capt concluída!',
      totalImported: result.inserted,
      importedCount: result.inserted,
    })
    setShowImportResult(true)
  }

  const handleCreateNew = () => {
    setEditingBoleto(null)
    setShowModal(true)
  }

  const handleEdit = (boleto) => {
    // Proteger registros OPEITE
    if (boleto._ORIGEM === 'OPEITE') {
      alert('Não é possível editar registros do Efactor (OPEITE). Eles são gerenciados externamente.')
      return
    }
    // Na visão unificada, só é editável quando há um boleto real em capt_boletos.
    // Linhas vindas apenas de capt_registrado/OPEITE não possuem registro editável.
    if (boleto._fontes && boleto._hasCapt === false) {
      alert('Este registro não está em capt_boletos (origem: ' + boleto._fontes.join(' + ') + '). Não há boleto local para editar.')
      return
    }

    setEditingBoleto(boleto)
    setShowModal(true)
  }

  const handleSave = async (formData, pendingFiles = []) => {
    setLoading(true)
    const activeId = getActiveContaId()
    console.log('[BoletosPage] handleSave para conta:', activeId)

    if (editingBoleto) {
      // Mapear chaves UPPERCASE do formulário para snake_case do banco
      const updates = {
        numero_documento:  formData.NUM_TITULO     || '',
        data_emissao:      formData.EMISSAO        || null,
        data_vencimento:   formData.VENCIMENTO     || null,
        data_limite_pagamento: formData.DATA_LIMITE_PGTO || null,
        valor:             parseFloat(formData.VALOR) || 0,
        nosso_numero:      formData.NOSSO_NUMERO   || '',
        especie_titulo:    formData.ESPECIE_TITULO !== undefined && formData.ESPECIE_TITULO !== '' ? parseInt(formData.ESPECIE_TITULO, 10) : 2,
        numero_carteira:   formData.NUMERO_CARTEIRA !== undefined && formData.NUMERO_CARTEIRA !== '' ? parseInt(formData.NUMERO_CARTEIRA, 10) : 1,
        valor_abatimento:  parseFloat(formData.ABATIMENTO) || 0,
        sacado_tipo_pessoa: formData.SACADO_TIPO_PESSOA !== undefined && formData.SACADO_TIPO_PESSOA !== '' ? parseInt(formData.SACADO_TIPO_PESSOA, 10) : null,
        sacado_nome:       formData.SACADO_NOME    || '',
        sacado_cic:        formData.SACADO_CIC     || '',
        sacado_cep:        formData.SACADO_CEP     || '',
        sacado_endereco:   formData.SACADO_ENDERECO|| '',
        sacado_numero:     formData.SACADO_NUMERO  || '',
        sacado_complemento: formData.SACADO_COMPLEMENTO || '',
        sacado_bairro:     formData.SACADO_BAIRRO  || '',
        sacado_cidade:     formData.SACADO_CIDADE  || '',
        sacado_uf:         formData.SACADO_UF      || '',
        sacado_email:      formData.SACADO_EMAIL   || '',
        sacado_telefone:   formData.SACADO_TELEFONE|| '',
        avalista_tipo:     formData.AVALISTA_TIPO !== undefined && formData.AVALISTA_TIPO !== '' ? parseInt(formData.AVALISTA_TIPO, 10) : null,
        avalista_nome:     formData.AVALISTA        || '',
        avalista_cic:      formData.AVALISTA_CIC   || '',
        juros_codigo:      formData.JUROS_TIPO     || null,
        juros_data:        formData.JUROS_DATA     || null,
        juros_valor:       parseFloat(formData.JUROS_VALOR) || 0,
        multa_codigo:      formData.MULTA_TIPO     || null,
        multa_data:        formData.MULTA_DATA     || null,
        multa:             parseFloat(formData.MULTA_VALOR) || 0,
        desconto_codigo:   formData.DESCONTO_TIPO  || null,
        desconto_data:     formData.DESCONTO_DATA  || null,
        desconto:          parseFloat(formData.DESCONTO_VALOR) || 0,
        desconto2_codigo:  formData.DESCONTO2_TIPO || null,
        desconto2_data:    formData.DESCONTO2_DATA || null,
        desconto2_valor:   parseFloat(formData.DESCONTO2_VALOR) || 0,
        desconto3_codigo:  formData.DESCONTO3_TIPO || null,
        desconto3_data:    formData.DESCONTO3_DATA || null,
        desconto3_valor:   parseFloat(formData.DESCONTO3_VALOR) || 0,
        mensagem1:         formData.MENSAGEM1      || '',
        mensagem2:         formData.MENSAGEM2      || '',
        mensagem3:         formData.MENSAGEM3      || '',
        descricao:         formData.DESCRICAO      || '',
        status:            formData.STATUS         || 'pendente',
        situacao:          formData.SITUACAO       || '',
      }
      const { error } = await updateBoleto(editingBoleto.id, updates)
      if (error) {
        alert('Erro ao atualizar boleto: ' + error.message)
        setLoading(false)
        return
      }
    } else {
      // Criar novo boleto
      const { data: novoBoleto, error } = await createBoleto(activeId, formData)
      if (error) {
        alert('Erro ao salvar boleto: ' + error.message)
        setLoading(false)
        return
      }

      // Enviar arquivos anexados junto ao boleto recém-criado
      if (novoBoleto?.id && pendingFiles && pendingFiles.length > 0) {
        const falhas = []
        for (const file of pendingFiles) {
          const { error: anexoErr } = await uploadAnexoBoleto(novoBoleto.id, file, activeId)
          if (anexoErr) {
            console.error('[BoletosPage] Erro ao anexar arquivo:', file.name, anexoErr)
            falhas.push(file.name)
          }
        }
        if (falhas.length > 0) {
          alert('Boleto criado, mas falha ao anexar: ' + falhas.join(', '))
        }
      }
    }
    setShowModal(false)
    await loadBoletos()
    setLoading(false)
  }

  const handleImportComplete = (result) => {
    setImportStatus({
      type: 'success',
      title: 'Importação concluída!',
      totalImported: result.totalImported,
      results: result.results,
    })
    setShowImportResult(true)
    loadBoletos()
  }

  const handleImportError = (error) => {
    setImportStatus({
      type: 'error',
      title: 'Erro na importação',
      message: error,
    })
    setShowImportResult(true)
  }

  const handleShowPreview = (data) => {
    setPreviewData(data)
    setShowPreview(true)
  }

  const handleImportPreviewComplete = (result) => {
    setShowPreview(false)
    setPreviewData([])
    setImportStatus({
      type: 'success',
      title: 'Importação concluída!',
      totalImported: result.imported,
      importedCount: result.imported,
      errorCount: result.errors,
      totalCount: result.total,
    })
    setShowImportResult(true)
    loadBoletos()
  }

  const handleCancelPreview = () => {
    setShowPreview(false)
    setPreviewData([])
  }

  const getFilteredBoletos = () => {
    let filtered = boletos

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(boleto => {
        return (
          (boleto.numero_documento != null && String(boleto.numero_documento).toLowerCase().includes(term)) ||
          (boleto.sacado_nome && boleto.sacado_nome.toLowerCase().includes(term)) ||
          (boleto.nosso_numero != null && String(boleto.nosso_numero).toLowerCase().includes(term)) ||
          (boleto.sacado_cic != null && String(boleto.sacado_cic).toLowerCase().includes(term))
        )
      })
    }

    // Filter by status
    if (statusFilter !== 'todos') {
      filtered = filtered.filter(boleto => boleto.status === statusFilter)
    }

    // Filtro por STATUS via checkboxes (Pago / Cancelado / Pendentes)
    // 'pago' e 'cancelado' são exatos; qualquer outro status (pendente, atrasado, vazio) entra em "Pendentes"
    filtered = filtered.filter(boleto => {
      const s = (boleto.status || '').toLowerCase()
      if (s === 'pago') return statusChecks.pago
      if (s === 'cancelado') return statusChecks.cancelado
      return statusChecks.pendente
    })

    // Filter by data de vencimento
    if (dataVencimentoInicio) {
      filtered = filtered.filter(boleto => boleto.data_vencimento && boleto.data_vencimento >= dataVencimentoInicio)
    }
    if (dataVencimentoFim) {
      filtered = filtered.filter(boleto => boleto.data_vencimento && boleto.data_vencimento <= dataVencimentoFim)
    }

    // Filter by data de registro (emissão)
    if (dataRegistroInicio) {
      filtered = filtered.filter(boleto => boleto.data_emissao && boleto.data_emissao >= dataRegistroInicio)
    }
    if (dataRegistroFim) {
      filtered = filtered.filter(boleto => boleto.data_emissao && boleto.data_emissao <= dataRegistroFim)
    }

    // Filter by data de antecipação
    if (dataAntecipadoInicio) {
      filtered = filtered.filter(boleto => boleto.data_antecipacao && boleto.data_antecipacao >= dataAntecipadoInicio)
    }
    if (dataAntecipadoFim) {
      filtered = filtered.filter(boleto => boleto.data_antecipacao && boleto.data_antecipacao <= dataAntecipadoFim)
    }

    return filtered
  }

  const handleClearDateFilters = () => {
    setDataEmissaoInicio('')
    setDataEmissaoFim('')
    setDataVencimentoInicio('')
    setDataVencimentoFim('')
    setDataGeradoInicio('')
    setDataGeradoFim('')
  }

  const handleChangePerfil = (contaId) => {
    console.log('[BoletosPage] Mudando para conta:', contaId)
    localStorage.setItem('activeContaId', contaId)
    // Disparar evento para recarregar dados
    window.dispatchEvent(new Event('contaSwitched'))
    // Recarregar dados
    loadBoletos()
    loadContaData()
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

      const pdfList = await generateMultipleBoletoPDFs(boletosParaZip, contaData)

      // Gerar nome do arquivo: boletos+ddmmyy+hhmm
      const now = new Date()
      const dd = String(now.getDate()).padStart(2, '0')
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const yy = String(now.getFullYear()).slice(-2)
      const hh = String(now.getHours()).padStart(2, '0')
      const min = String(now.getMinutes()).padStart(2, '0')
      const zipFilename = `boletos${dd}${mm}${yy}_${hh}${min}.zip`

      await createAndDownloadZip(pdfList, zipFilename)

      alert(`ZIP com ${pdfList.length} boleto(s) gerado com sucesso!`)
      setSelectedRows(new Set())
    } catch (error) {
      console.error('[Ações] Erro ao gerar ZIP:', error)
      alert('Erro ao gerar ZIP: ' + error.message)
    } finally {
      setGeneratingZip(false)
    }
  }

  const handleGenerateRemessaCNAB400 = async (tipoOperacao = '01') => {
    // CNAB400 não é permitido nos modos Conta Capt nem Efactor
    if (efactorActive || contaCaptActive) {
      alert('A geração de CNAB400 não está disponível nos modos Conta Capt ou Efactor.')
      return
    }
    if (selectedRows.size === 0) {
      alert('Selecione pelo menos um boleto')
      return
    }
    setShowCnab400Sub(false)
    setOpenActionsMenu(false)

    const activeId = getActiveContaId()
    const filteredBoletos = getFilteredBoletos()
    const selecionados = Array.from(selectedRows)
      .map(index => filteredBoletos[index])
      .filter(b => b)

    // Separar registros que já estão em capt_boletos dos que precisam ser importados
    const comCapt  = selecionados.filter(b => b._hasCapt !== false)
    const semCapt  = selecionados.filter(b => b._hasCapt === false)

    let boletosParaRemessa = comCapt

    if (semCapt.length > 0) {
      console.log(`[CNAB400] ${semCapt.length} registro(s) sem capt_boletos — importando automaticamente...`)
      const { data: importResult, error: importErr } = await autoImportarParaCapt(activeId, semCapt)

      if (importErr || !importResult) {
        alert('Erro ao importar registros para capt_boletos: ' + (importErr?.message || 'erro desconhecido'))
        return
      }

      if (importResult.errors > 0) {
        const continuar = window.confirm(
          `${importResult.errors} registro(s) não puderam ser importados para capt_boletos.\n` +
          `${importResult.imported} importados, ${importResult.skipped} já existiam.\n\n` +
          `Deseja continuar a geração do CNAB400 com os registros disponíveis?`
        )
        if (!continuar) return
      } else if (importResult.imported > 0 || importResult.skipped > 0) {
        console.log(`[CNAB400] Auto-importação: ${importResult.imported} criados, ${importResult.skipped} já existiam.`)
      }

      // Recarregar lista para manter estado do UI atualizado (não bloqueia o fluxo)
      loadBoletos()

      // Combinar os boletos já em capt com os recém-criados
      boletosParaRemessa = [...comCapt, ...importResult.boletos]
    }

    if (boletosParaRemessa.length === 0) {
      alert('Nenhum boleto disponível para gerar remessa.')
      return
    }

    // Verificar se algum boleto já está registrado em capt_registrado
    try {
      const jaRegistrados = await checkBoletosJaRegistrados(boletosParaRemessa)
      if (jaRegistrados.length > 0) {
        setCnab400Confirm({ titulos: jaRegistrados, tipoOperacao, boletosParaRemessa })
        return
      }
    } catch (e) {
      console.warn('[CNAB400] Erro ao verificar títulos registrados:', e)
    }

    await doGerarRemessaCNAB400(boletosParaRemessa, tipoOperacao)
  }

  const doGerarRemessaCNAB400 = async (boletosParaRemessa, tipoOperacao) => {
    setGeneratingCNAB400(true)
    try {
      console.log('[CNAB400] Gerando remessa para', boletosParaRemessa.length, 'boletos selecionados')

      // Usar contaData ja carregado (ou recarregar se necessario)
            const activeId = getActiveContaId()
            const contaParaRemessa = contaData || (await getContaInfo(activeId)).data

            // nextSeq: usa o contador cnab400 se for numero valido (>= 1);
            // se estiver corrompido (null, string de filename, NaN), conta as remessas ja geradas
            const cnab400Raw = contaParaRemessa?.cnab400
            const cnab400Num = Number(cnab400Raw)
            let nextSeq
            if (!isNaN(cnab400Num) && cnab400Num >= 1) {
                nextSeq = cnab400Num + 1
            } else {
                const { count } = await getContaRemessaCount(contaParaRemessa?.cedente || '')
                nextSeq = count + 1
                console.log(`[CNAB400] cnab400 invalido ('${cnab400Raw}'), usando contagem de REMESSAS: ${count} -> nextSeq=${nextSeq}`)
            }

            const cnab400Blob = generateCNAB400RemittanceFile(boletosParaRemessa, contaParaRemessa, nextSeq, tipoOperacao)

            // Incrementar contador da remessa na conta
            if (contaParaRemessa) {
                      await incrementContaCnab400(activeId, nextSeq)
            }

      // Nome do arquivo: CB[DD][MM][SSSSSSS].REM  (padrao BMP274 - ex: CB11050000001.REM)
      const now = new Date()
      const day = String(now.getDate()).padStart(2, '0')
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const sequence = String(nextSeq).padStart(7, '0')
      const filename = `CB${day}${month}${sequence}.REM`

      // Download the file
      const url = URL.createObjectURL(cnab400Blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      // Track remittance in database (opcional - continua mesmo se falhar)
      const valorTotal = boletosParaRemessa.reduce((sum, b) => sum + (parseFloat(b.valor) || 0), 0)

      try {
        const { error: remessaError } = await createRemessa(activeId, {
          filename,
          quantidadeBoletos: boletosParaRemessa.length,
          valorTotal,
        })

        if (remessaError) {
          console.warn('[CNAB400] Aviso ao registrar remessa (continua mesmo assim):', remessaError)
          // Continue anyway - arquivo foi gerado com sucesso
        } else {
          console.log('[CNAB400] Remessa registrada no banco com sucesso')
        }
      } catch (err) {
        console.warn('[CNAB400] Aviso ao registrar remessa:', err)
        // Continua mesmo com erro - o arquivo já foi gerado
      }

      // Se for Registro (01): marcar boletos como "Remessa" para indicar que aguardam registro
      if (tipoOperacao === '01') {
        const idsParaMarcar = boletosParaRemessa
          .filter(b => b._hasCapt !== false && b.id && !String(b.id).startsWith('reg_') && !String(b.id).startsWith('ope_'))
          .map(b => b.id)
        if (idsParaMarcar.length > 0) {
          await markBoletosRemessa(idsParaMarcar)
        }
      }

      alert(`Remessa CNAB400 "${filename}" gerada com sucesso!`)
      setSelectedRows(new Set())
      await loadContaData()
      await loadBoletos()
    } catch (error) {
      console.error('[CNAB400] Erro ao gerar remessa:', error)
      alert('Erro ao gerar remessa CNAB400: ' + error.message)
    } finally {
      setGeneratingCNAB400(false)
    }
  }

  const handleGerarRelatorio = () => {
    if (selectedRows.size === 0) {
      alert('Selecione pelo menos um boleto')
      return
    }
    setOpenActionsMenu(false)

    const filteredBoletos = getFilteredBoletos()
    const selecionados = Array.from(selectedRows)
      .map(index => filteredBoletos[index])
      .filter(b => b)

    const formatDate = (dateStr) => {
      if (!dateStr) return '—'
      const d = new Date(dateStr + 'T00:00:00')
      return d.toLocaleDateString('pt-BR')
    }

    const formatValor = (val) => {
      if (val == null || val === '') return '—'
      return Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }

    const now = new Date()
    const dataEmissao = now.toLocaleDateString('pt-BR')
    const horaEmissao = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const nomeEmpresa = contaData?.nome_correntista || contaData?.cedente || ''

    const rows = selecionados.map(b => `
      <tr>
        <td>${b.num_lancamento || '—'}</td>
        <td>${formatDate(b.data_emissao)}</td>
        <td>${b.num_titulo || b.numero_documento || '—'}</td>
        <td style="text-align:right">${formatValor(b.valor)}</td>
        <td>${formatDate(b.data_vencimento)}</td>
        <td>${b.sacado_nome || '—'}</td>
        <td>${b.sacado_cic || '—'}</td>
      </tr>
    `).join('')

    const totalValor = selecionados.reduce((sum, b) => sum + (parseFloat(b.valor) || 0), 0)

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Relatório de Boletos</title>
  <style>
    @page { size: A4 portrait; margin: 15mm 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 9pt; color: #000; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; border-bottom: 1.5px solid #000; padding-bottom: 8px; }
    .header-left h1 { font-size: 14pt; font-weight: bold; }
    .header-left .empresa { font-size: 10pt; color: #000; margin-top: 2px; }
    .header-right { text-align: right; font-size: 8pt; color: #000; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    thead tr { background: #fff; color: #000; }
    thead th { padding: 3px 6px; text-align: left; font-size: 8pt; font-weight: bold; border: none; border-bottom: 1.5px solid #000; }
    thead th.right { text-align: right; }
    tbody tr { background: #fff; }
    tbody td { padding: 2px 6px; border: none; color: #000; font-size: 8pt; vertical-align: middle; line-height: 1.2; }
    tbody td.right { text-align: right; }
    .footer { margin-top: 12px; border-top: 1px solid #000; padding-top: 6px; display: flex; justify-content: space-between; font-size: 8pt; }
    .total { font-weight: bold; font-size: 9pt; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>Relatório de Boletos</h1>
      ${nomeEmpresa ? `<div class="empresa">${nomeEmpresa}</div>` : ''}
    </div>
    <div class="header-right">
      <div>Emitido em: ${dataEmissao} às ${horaEmissao}</div>
      <div>${selecionados.length} registro(s)</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>LANC</th>
        <th>EMISSÃO</th>
        <th>DOCUMENTO</th>
        <th class="right">VALOR</th>
        <th>VENCIMENTO</th>
        <th>NOME</th>
        <th>CIC</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  <div class="footer">
    <div></div>
    <div class="total">Total: R$ ${formatValor(totalValor)}</div>
  </div>
</body>
</html>`

    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    win.onload = () => {
      win.print()
    }
  }

  const handleDeleteSingleBoleto = async (boleto) => {
    // Proteger registros OPEITE
    if (boleto._ORIGEM === 'OPEITE') {
      alert('Não é possível deletar registros do Efactor (OPEITE). Eles são gerenciados externamente.')
      return
    }
    // Na visão unificada, só deleta quando há boleto real em capt_boletos.
    if (boleto._fontes && boleto._hasCapt === false) {
      alert('Este registro não está em capt_boletos (origem: ' + boleto._fontes.join(' + ') + '). Não há boleto local para deletar.')
      return
    }

    // Confirmar antes de deletar
    if (!window.confirm(`Tem certeza que deseja deletar o boleto "${boleto.titulo || boleto.numero_nosso || 'sem título'}"? Esta ação não pode ser desfeita.`)) {
      return
    }

    try {
      console.log('[Ações] Deletando boleto individual:', boleto.id)
      const { error } = await deleteBoleto(boleto.id)

      if (error) {
        alert('Erro ao deletar boleto: ' + error.message)
        console.error('[Ações] Erro ao deletar boleto:', boleto.id, error)
      } else {
        alert('Boleto deletado com sucesso!')
        await loadBoletos()
      }
    } catch (error) {
      console.error('[Ações] Erro ao deletar boleto:', error)
      alert('Erro ao deletar boleto: ' + error.message)
    }
  }

  const handleAntecipacao = async () => {
    if (selectedRows.size === 0) {
      alert('Selecione pelo menos um boleto para antecipar')
      return
    }

    // Confirmar antes de antecipar
    if (!window.confirm(`Tem certeza que deseja antecipar ${selectedRows.size} boleto(s)?`)) {
      return
    }

    setOpenActionsMenu(false)
    setProcessandoAntecipacao(true)

    try {
      const filteredBoletos = getFilteredBoletos()
      const boletosParaAntecipar = Array.from(selectedRows)
        .map(index => filteredBoletos[index])
        .filter(boleto => boleto)

      console.log('[Ações] Antecipando', boletosParaAntecipar.length, 'boletos')

      // Chamar função de antecipação
      const { data: resultado, error } = await criarAntecipacao(boletosParaAntecipar, contaData)

      if (error) {
        alert('Erro ao antecipar boletos: ' + error.message)
        console.error('[Ações] Erro ao antecipar:', error)
      } else {
        const mensagem = `✓ Antecipação realizada com sucesso!\n\nCódigo do Borderô: ${resultado.codBordero}\nCódigo da Operação: ${resultado.codOperacao}\nQuantidade: ${resultado.quantidadeBoletos} boleto(s)\nCódigos de Título: ${resultado.codTituloInicio} a ${resultado.codTituloFim}`
        alert(mensagem)
        console.log('[Ações] Resultado da antecipação:', resultado)
        setSelectedRows(new Set())
        // Não precisa recarregar boletos pois são registros diferentes
      }
    } catch (error) {
      console.error('[Ações] Erro ao antecipar boletos:', error)
      alert('Erro ao antecipar boletos: ' + error.message)
    } finally {
      setProcessandoAntecipacao(false)
    }
  }

  // Passo 1: validar seleção e abrir o modal de confirmação
  const handleImportOpeite = () => {
    if (selectedRows.size === 0) {
      alert('Selecione pelo menos um registro do Efactor para importar')
      return
    }

    const filteredBoletos = getFilteredBoletos()
    const registrosSelecionados = Array.from(selectedRows)
      .map(index => filteredBoletos[index])
      .filter(b => b && b._ORIGEM === 'OPEITE')

    if (registrosSelecionados.length === 0) {
      alert('Nenhum registro do Efactor (OPEITE) selecionado para importar.')
      return
    }

    setEfactorImportRecords(registrosSelecionados)
    setEfactorImportStep('choice')
    setEfactorImportTargetId('')
    setOpenActionsMenu(false)
    setShowEfactorImportModal(true)
  }

  // Passo 2: executar a importação para a conta de destino (logado ou outro cedente)
  const executeImportOpeite = async (targetContaId) => {
    const registrosSelecionados = efactorImportRecords
    if (!registrosSelecionados || registrosSelecionados.length === 0) {
      setShowEfactorImportModal(false)
      return
    }
    if (!targetContaId) {
      alert('Conta de destino não identificada.')
      return
    }

    const activeId = getActiveContaId()
    const isMesmoPerfil = String(targetContaId) === String(activeId)

    setShowEfactorImportModal(false)
    setImportingOpeite(true)

    try {
      console.log('[Ações] Importando', registrosSelecionados.length, 'registros OPEITE para conta', targetContaId, isMesmoPerfil ? '(perfil atual)' : '(outro cedente)')

      const { data: resultado, error } = await importOpeiteToBoletos(targetContaId, registrosSelecionados)

      if (error) {
        alert('Erro ao importar registros: ' + error.message)
        console.error('[Ações] Erro ao importar OPEITE:', error)
      } else {
        const contaDestino = allContas.find(c => String(c.id) === String(targetContaId))
        const nomeDestino = isMesmoPerfil
          ? 'perfil atual'
          : (contaDestino?.nome_correntista || contaDestino?.cedente || 'outro cedente')
        let mensagem = `Importação concluída (${nomeDestino}):\n\n`
        mensagem += `✓ Importados: ${resultado.imported}\n`
        mensagem += `⏭ Pulados (já existiam): ${resultado.skipped}\n`
        if (resultado.errors > 0) {
          mensagem += `✗ Erros: ${resultado.errors}`
        }
        alert(mensagem)
        setSelectedRows(new Set())
        // Recarregar a lista apenas se importou para o perfil atualmente exibido
        if (isMesmoPerfil) {
          await loadBoletos()
        }
      }
    } catch (error) {
      console.error('[Ações] Erro ao importar OPEITE:', error)
      alert('Erro ao importar registros: ' + error.message)
    } finally {
      setImportingOpeite(false)
      setEfactorImportRecords([])
      setEfactorImportTargetId('')
      setEfactorImportStep('choice')
    }
  }

  const handleRetornarAntecipacao = async () => {
    if (selectedRows.size === 0) {
      alert('Selecione pelo menos um boleto')
      return
    }
    if (!window.confirm(`Retornar (desfazer) a antecipação de ${selectedRows.size} boleto(s)?`)) {
      return
    }

    setOpenActionsMenu(false)
    setRetornandoAntecipacao(true)

    try {
      const filteredBoletos = getFilteredBoletos()
      const selecionados = Array.from(selectedRows)
        .map(index => filteredBoletos[index])
        .filter(b => b)

      const { data, error } = await retornarAntecipacao(selecionados, contaData)

      if (error) {
        alert('Erro ao retornar antecipação: ' + error.message)
        console.error('[Ações] Erro ao retornar antecipação:', error)
      } else {
        let msg = `Retorno de antecipação:\n\n↩️ Retornados: ${data.retornados}`
        if (data.bloqueados > 0) {
          msg += `\n🔒 Não é possível retornar (borderô não está com STATUS=R): ${data.bloqueados}`
          if (data.bloqueadosTitulos && data.bloqueadosTitulos.length > 0) {
            msg += `\nTítulos: ${data.bloqueadosTitulos.join(', ')}`
          }
        }
        if (data.naoEncontrados > 0) {
          msg += `\nℹ️ Sem antecipação encontrada: ${data.naoEncontrados}`
        }
        alert(msg)
        setSelectedRows(new Set())
        await loadBoletos()
      }
    } catch (error) {
      console.error('[Ações] Erro ao retornar antecipação:', error)
      alert('Erro ao retornar antecipação: ' + error.message)
    } finally {
      setRetornandoAntecipacao(false)
    }
  }

  const handleAssinarZapsign = (mode) => {
    if (selectedRows.size === 0) {
      alert('Selecione pelo menos um boleto para enviar à assinatura')
      return
    }
    setAssinarMode(mode)
    setShowAssinarSub(false)
    setOpenActionsMenu(false)
    setShowZapsignModal(true)
  }

  const handleDownloadCessao = async () => {
    if (selectedRows.size === 0) { alert('Selecione pelo menos um boleto'); return }
    setOpenActionsMenu(false)
    const filteredBoletos = getFilteredBoletos()
    const selecionados = Array.from(selectedRows).map(i => filteredBoletos[i]).filter(Boolean)
    try {
      const blob = generateCessaoDireitosBlob(selecionados, contaData)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const now = new Date()
      const dd = String(now.getDate()).padStart(2, '0')
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const yyyy = now.getFullYear()
      link.href = url
      link.download = `cessao_${dd}${mm}${yyyy}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('Erro ao gerar cessão: ' + e.message)
    }
  }

  // Executa o envio à ZapSign conforme o modo escolhido no ZapsignModal.
  // Retorna { ok, fail, links:[{label,url}], error? } para o modal exibir.
  const runZapsign = async ({ mode, sacado, incluirBoletos }) => {
    const filteredBoletos = getFilteredBoletos()
    const selecionados = Array.from(selectedRows)
      .map(index => filteredBoletos[index])
      .filter(b => b)

    if (selecionados.length === 0) return { ok: 0, fail: 0, links: [], error: 'Nenhum título selecionado.' }

    const activeContaId = getActiveContaId()

    // Auto-importar registros OPEITE sem entrada em capt_boletos (necessário para salvar status ZapSign)
    const semCapt = selecionados.filter(b => !b._hasCapt && b.num_lancamento)
    if (semCapt.length > 0) {
      await autoImportarParaCapt(activeContaId, semCapt)
    }

    // Helper: persiste token ZapSign em capt_boletos via num_lancamento (cobre auto-importados e existentes)
    const persistirZapsign = async (boletos, docToken, signUrl) => {
      const lancamentos = boletos.map(b => b.num_lancamento).filter(Boolean)
      if (lancamentos.length > 0) {
        await updateBoletosByLancamentos(activeContaId, lancamentos, {
          zapsign_doc_token: docToken,
          zapsign_sign_url: signUrl || '',
          zapsign_status: 'pendente',
        })
      }
      // Boletos com id real (sem prefixo) mas sem num_lancamento — fallback por id
      for (const b of boletos) {
        if (b.num_lancamento) continue
        const idReal = b.id && !String(b.id).startsWith('ope_') && !String(b.id).startsWith('reg_')
        if (idReal) {
          await updateBoleto(b.id, { zapsign_doc_token: docToken, zapsign_sign_url: signUrl || '', zapsign_status: 'pendente' })
        }
      }
    }

    // Modo sem boletos: cessão + borderô + duplicatas (2 por página)
    if (incluirBoletos === false) {
      const { blobs, notas: notasPdf } = await buildPdfCompletoSemBoletos(selecionados, contaData)
      let ok = 0, fail = 0
      const links = []
      const captName = (CAPT_SIGNER.name || '').trim().toUpperCase()
      const cedenteSigner0 = {
        name: contaData?.nome_correntista || 'Cedente',
        email: contaData?.email || '',
        phone: contaData?.telefone || '',
      }
      const captSigner0 = { ...CAPT_SIGNER }
      let primeiroDocToken = null
      for (let i = 0; i < blobs.length; i++) {
        const docName = i === 0
          ? `Cessão + Duplicatas (${selecionados.length} títulos)`
          : `Duplicatas parte ${i + 1}`
        const r = await criarDocumentoAssinatura({
          name: docName,
          pdfBlob: blobs[i],
          signers: [cedenteSigner0, captSigner0],
          placements: [],
        })
        if (r.error) {
          fail++
        } else {
          ok++
          ;(r.data?.signers || []).forEach(s => {
            const isCapt = String(s.name || '').trim().toUpperCase() === captName
            if (s.sign_url && !isCapt) links.push({ label: docName + ' — ' + (s.name || ''), url: s.sign_url })
          })
          if (i === 0 && r.data?.doc_token) {
            primeiroDocToken = r.data.doc_token
            await persistirZapsign(selecionados, r.data.doc_token, r.data.sign_url)
            await insertCaptAssina(activeContaId, r.data, selecionados)
          }
        }
      }
      setSelectedRows(new Set())
      await loadBoletos()
      return { ok, fail, links, notes: notasPdf }
    }

    // Posições das assinaturas (coordenadas ZapSign 0–100, origem inferior-esquerda).
    // Convertidas dos valores em mm informados (A4 210×297): left% = mm/210*100; bottom% = (297−mm_topo)/297*100.
    const SZ = { x: 10.37, y: 5 }
    const POS = {
      cedenteCard8: { bottom: 66, left: 4 },
      cedenteCessao: { bottom: 6, left: 9 },
      sacado: { bottom: 53.7, left: 54 },
      captCessao: { bottom: 6, left: 50 },
    }

    // Assinante CEDENTE = conta ativa
    const cedenteSigner = {
      name: contaData?.nome_correntista || 'Cedente',
      email: contaData?.email || '',
      phone: contaData?.telefone || '',
    }
    const sacadoSigner = sacado ? {
      name: sacado.nome || 'Sacado',
      email: '',
      phone: sacado.whatsapp || '',
    } : null
    // CAPT é assinante (para a assinatura ser posicionada), mas o link dela NÃO é exibido.
    const captSigner = { ...CAPT_SIGNER }

    // Posições das assinaturas no Borderô (página 0). bottomPct é dinâmico (a linha varia
    // de altura conforme o nº de títulos). idxCed/idxCapt = índice do assinante.
    const borderoPlacements = (idxCed, idxCapt, bottomPct) => [
      { page: 0, type: 'signature', relative_position_bottom: bottomPct, relative_position_left: 10, relative_size_x: SZ.x, relative_size_y: SZ.y, signer_index: idxCed },
      { page: 0, type: 'signature', relative_position_bottom: bottomPct, relative_position_left: 52, relative_size_x: SZ.x, relative_size_y: SZ.y, signer_index: idxCapt },
    ]
    // Converte a altura (mm do topo) da linha de assinatura do Borderô em bottom% (origem inferior).
    const borderoBottomPct = (bRes) => ((bRes.pageHeight - bRes.signatureLineY) / bRes.pageHeight) * 100

    let ok = 0
    let fail = 0
    const links = []
    let primeiroDocToken = null
    let primeiroSignUrl = ''

    try {
      // Documento principal: Duplicatas + Boletos.
      // Com Sacado -> assinantes: cedente + sacado + CAPT (mostra 2 links: cedente e sacado).
      // Sem Sacado -> assinantes: cedente + CAPT (mostra 1 link: cedente); Borderô vai como ANEXO no MESMO link.
      // Define os boletos que comporão o PDF de Duplicatas+Boletos.
      // Sem Sacado: TODOS os títulos do borderô (operação) do título selecionado.
      // Com Sacado: apenas os selecionados.
      let boletosDoc = selecionados
      if (mode === 'sem') {
        const base = selecionados.find(b => b?.num_lancamento)
        if (base) {
          const { data: todos } = await getBoletosDoBordero(base.num_lancamento)
          if (todos && todos.length > 0) boletosDoc = todos
        }
      }
      const pdfDupBol = await buildDuplicatasBoletosBlob(boletosDoc, contaData)

      // Ordem dos assinantes define o signer_index usado nos placements.
      const signersDupBol = mode === 'com'
        ? [cedenteSigner, sacadoSigner, captSigner]   // 0=cedente, 1=sacado, 2=capt
        : [cedenteSigner, captSigner]                 // 0=cedente, 1=capt
      const idxCedente = 0
      const idxSacado = mode === 'com' ? 1 : -1
      const idxCapt = mode === 'com' ? 2 : 1

      // No PDF mesclado, cada boleto ocupa 2 páginas: Duplicata (par) + Boleto (ímpar).
      const dupPages = boletosDoc.map((_, i) => i * 2)
      const placements = []
      // type 'visto' = só a marca/imagem (sem o texto de validação); 'signature' = assinatura completa.
      const addPos = (signerIndex, pos, type = 'signature') => {
        if (signerIndex < 0) return
        dupPages.forEach(pg => placements.push({
          page: pg,
          type,
          relative_position_bottom: pos.bottom,
          relative_position_left: pos.left,
          relative_size_x: SZ.x,
          relative_size_y: SZ.y,
          signer_index: signerIndex,
        }))
      }
      // Cedente no Card 8 = apenas o VISTO (rubrica), sem o carimbo de validação
      addPos(idxCedente, POS.cedenteCard8, 'visto')
      addPos(idxCedente, POS.cedenteCessao)
      if (mode === 'com') addPos(idxSacado, POS.sacado)
      addPos(idxCapt, POS.captCessao)

      const notes = []
      let extraPdfBlobs
      if (mode === 'sem') {
        // Gera UM borderô por COD_OPERACAO único (vários títulos do mesmo borderô → apenas 1 PDF)
        const bResults = await buildBorderoBlobs(selecionados)
        if (bResults.length > 0) {
          extraPdfBlobs = bResults.map((bRes, i) => ({
            name: bResults.length > 1 ? `Borderô ${i + 1}` : 'Borderô',
            blob: bRes.blob,
            placements: borderoPlacements(idxCedente, idxCapt, borderoBottomPct(bRes)),
          }))
        } else {
          notes.push('Borderô NÃO anexado: nenhum título selecionado tem operação vinculada (num_lancamento / OPECAB BI-LC).')
        }
      }

      const r1 = await criarDocumentoAssinatura({
        name: `Duplicatas e Boletos (${selecionados.length})`,
        pdfBlob: pdfDupBol,
        signers: signersDupBol,
        extraPdfBlobs,
        placements,
      })
      if (r1.error) {
        fail++
        return { ok, fail, links, error: 'Erro ao criar documento: ' + r1.error.message }
      }
      ok++
      primeiroDocToken = r1.data?.doc_token || null
      primeiroSignUrl = r1.data?.sign_url || ''
      // Exibe os links de todos os assinantes, EXCETO a CAPT (assina automaticamente).
      const captName = (CAPT_SIGNER.name || '').trim().toUpperCase()
      const pushLinks = (signersArr, prefix) => (signersArr || []).forEach(s => {
        const isCapt = String(s.name || '').trim().toUpperCase() === captName
        if (s.sign_url && !isCapt) links.push({ label: prefix ? `${prefix} — ${s.name || ''}` : (s.name || 'Assinante'), url: s.sign_url })
      })
      pushLinks(r1.data?.signers)

      // Confirma se o Borderô foi anexado (Sem Sacado)
      if (mode === 'sem' && extraPdfBlobs) {
        const anexados = (r1.data?.extra_docs || []).length
        notes.push(anexados > 0
          ? 'Borderô anexado ao mesmo link (2 PDFs para assinar).'
          : 'Aviso: o Borderô pode não ter sido anexado (verifique os logs do ZapSign).')
      }

      // Persistir token/link nos boletos do documento e gravar em capt_assina
      if (primeiroDocToken) {
        await persistirZapsign(boletosDoc, primeiroDocToken, primeiroSignUrl)
        await insertCaptAssina(activeContaId, r1.data, selecionados)
      }

      setSelectedRows(new Set())
      await loadBoletos()

      // Enviar WhatsApp com link do borderô para o cedente (não-bloqueante)
      if (primeiroSignUrl && contaData?.telefone) {
        try {
          // Obter COD_OPERACAO do primeiro boleto selecionado que tenha num_lancamento
          const boletoComLancamento = boletosDoc.find(b => b.num_lancamento)
          if (boletoComLancamento) {
            // Buscar COD_OPERACAO via getBorderoData (que faz a query ao banco)
            const borderoData = await getBorderoData(boletoComLancamento.num_lancamento)
            const codOperacao = borderoData?.data?.cabecalho?.COD_OPERACAO || 'Operação'

            // Enviar WhatsApp de forma assíncrona (não bloqueia a UI)
            enviarLinkBorderoWhatsApp(contaData.telefone, codOperacao, primeiroSignUrl)
              .then(() => {
                console.log('[Assinatura] WhatsApp com link do borderô enviado com sucesso')
                notes.push('✓ Link do borderô enviado por WhatsApp')
              })
              .catch((error) => {
                console.error('[Assinatura] Erro ao enviar WhatsApp:', error)
                notes.push(`⚠️ Falha ao enviar WhatsApp: ${error.message}`)
              })
          }
        } catch (error) {
          console.error('[Assinatura] Erro ao processar envio de WhatsApp:', error)
        }
      }

      return { ok, fail, links, notes }
    } catch (error) {
      console.error('[ZapSign] Erro geral:', error)
      return { ok, fail, links, error: error.message || String(error) }
    }
  }

  const handleDeleteSelectedBoletos = async () => {
    if (selectedRows.size === 0) {
      alert('Selecione pelo menos um boleto')
      return
    }

    const filteredBoletos = getFilteredBoletos()
    const boletosParaDeletar = Array.from(selectedRows)
      .map(index => filteredBoletos[index])
      .filter(boleto => boleto)

    // Separar registros sem boleto local (OPEITE/capt_registrado) dos boletos locais.
    // Só é possível excluir o que existe de fato em capt_boletos.
    const semBoletoLocal = (b) => b._ORIGEM === 'OPEITE' || (b._fontes && b._hasCapt === false)
    const boletosPorExcluir = boletosParaDeletar.filter(b => !semBoletoLocal(b))
    const boletosOpeite = boletosParaDeletar.filter(b => semBoletoLocal(b))

    // Se houver registros OPEITE, avisar o usuário
    if (boletosOpeite.length > 0) {
      const mensagem = `${boletosOpeite.length} boleto(s) selecionado(s) é do Efactor (OPEITE) e não pode ser deletado. Apenas os ${boletosPorExcluir.length} boleto(s) local(is) serão deletados.`
      if (boletosPorExcluir.length === 0) {
        alert(mensagem)
        return
      }
      alert(mensagem)
    }

    if (boletosPorExcluir.length === 0) {
      return
    }

    // Confirmar antes de deletar
    if (!window.confirm(`Tem certeza que deseja deletar ${boletosPorExcluir.length} boleto(s)? Esta ação não pode ser desfeita.`)) {
      return
    }

    setOpenActionsMenu(false)

    try {
      console.log('[Ações] Deletando', boletosPorExcluir.length, 'boletos selecionados')

      // Deletar cada boleto
      let deletedCount = 0
      for (const boleto of boletosPorExcluir) {
        const { error } = await deleteBoleto(boleto.id)
        if (!error) {
          deletedCount++
        } else {
          console.error('[Ações] Erro ao deletar boleto:', boleto.id, error)
        }
      }

      alert(`${deletedCount} boleto(s) deletado(s) com sucesso!`)
      setSelectedRows(new Set())
      await loadBoletos()
    } catch (error) {
      console.error('[Ações] Erro ao deletar boletos:', error)
      alert('Erro ao deletar boletos: ' + error.message)
    }
  }

  return (
    <div className="flex flex-col gap-2 flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-white">Boletos</h1>
          <p className="text-sm text-[#666666] mt-1">Emissão, consulta e gestão de títulos</p>
        </div>

        {/* Seletor de Perfil Ativo (apenas para Master) */}
        {(() => {
          const shouldShow = userType === 'M' && allContas.length > 0
          console.log('[BoletosPage] render - Perfil Ativo visibility check:', {
            userType,
            allContasLength: allContas.length,
            shouldShow,
            allContasSample: allContas.slice(0, 2)
          })
          return shouldShow && (
            <div className="flex flex-col gap-1 ml-6">
              <label className="text-xs text-[#666666] uppercase font-semibold">Perfil Ativo</label>
              <select
                value={getActiveContaId()}
                onChange={(e) => handleChangePerfil(e.target.value)}
                className="px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white focus:bg-[#1a1a1a] outline-none transition w-72"
              >
                {allContas.map((conta) => (
                  <option key={conta.id} value={conta.id}>
                    {conta.nome_correntista} ({conta.cedente || conta.conta})
                  </option>
                ))}
              </select>
            </div>
          )
        })()}
      </div>

      {/* Upload Area + Action Buttons na mesma linha */}
      <div className="flex items-center gap-3">
        {/* Campo de pesquisa — flex-1, lado esquerdo */}
        {!contaCaptActive && (
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
        )}

        {/* Card Importar + botões de modo (largura definida internamente em cada elemento) */}
        <FileUpload
          userId={getActiveContaId()}
          onShowPreview={handleShowPreview}
          onImportError={handleImportError}
          userType={userType}
          selectedContaId={selectedContaId}
          allContas={allContas}
          contaData={contaData}
          onEfactorToggle={handleToggleEfactor}
          efactorActive={efactorActive}
          onContaCaptClick={handleToggleContaCapt}
          contaCaptActive={contaCaptActive}
          onContaCaptImported={handleContaCaptImported}
          importadosActive={importadosActive}
          onImportadosClick={handleShowImportados}
        />

        {!contaCaptActive && (
          <>
            {/* Botão Ações com Dropdown */}
            <div className="relative">
              <button
                onClick={() => setOpenActionsMenu(!openActionsMenu)}
                disabled={selectedRows.size === 0 || generatingZip}
                style={{ height: '36px', width: '110px' }}
                className={`flex items-center justify-center text-sm font-medium rounded transition ${
                  selectedRows.size === 0 || generatingZip
                    ? 'bg-[#1a1a1a] text-[#666666] border border-[#2a2a2a] cursor-not-allowed'
                    : 'bg-[#1a1a1a] text-white border border-[#2a2a2a] hover:bg-[#222222]'
                }`}
              >
                Ações {selectedRows.size > 0 && `(${selectedRows.size})`}
              </button>

              {openActionsMenu && (
                <div className="absolute right-0 top-full mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded shadow-lg z-50 min-w-56">
                  {efactorActive && (
                    <button
                      onClick={handleImportOpeite}
                      disabled={importingOpeite}
                      className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#2a2a2a] transition border-b border-[#2a2a2a] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {importingOpeite ? '⏳ Importando...' : '📨 Importar'}
                    </button>
                  )}
                  <button
                    onClick={handleGenerateSecondViaZip}
                    disabled={generatingZip}
                    className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#2a2a2a] transition border-b border-[#2a2a2a] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingZip ? '⏳ Gerando ZIP...' : '📥 Gerar segunda via (ZIP)'}
                  </button>
                  <button
                    onClick={handleAntecipacao}
                    disabled={processandoAntecipacao}
                    className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#2a2a2a] transition border-b border-[#2a2a2a] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processandoAntecipacao ? '⏳ Processando...' : '💰 Antecipar'}
                  </button>
                  <button
                    onClick={handleRetornarAntecipacao}
                    disabled={retornandoAntecipacao}
                    className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#2a2a2a] transition border-b border-[#2a2a2a] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {retornandoAntecipacao ? '⏳ Retornando...' : '↩️ Retornar Antecipação'}
                  </button>
                  <button
                    onClick={() => setShowAssinarSub(!showAssinarSub)}
                    disabled={assinandoZapsign}
                    className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#2a2a2a] transition border-b border-[#2a2a2a] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
                  >
                    <span>{assinandoZapsign ? '⏳ Enviando...' : '✍️ Assinar (ZapSign)'}</span>
                    <span className="text-[#666666]">{showAssinarSub ? '▾' : '▸'}</span>
                  </button>
                  {showAssinarSub && (
                    <div className="bg-[#141414] border-b border-[#2a2a2a]">
                      <button
                        onClick={() => handleAssinarZapsign('com')}
                        className="w-full text-left pl-8 pr-4 py-2 text-sm text-white hover:bg-[#2a2a2a] transition"
                      >
                        👤 Com Sacado
                      </button>
                      <button
                        onClick={() => handleAssinarZapsign('sem')}
                        className="w-full text-left pl-8 pr-4 py-2 text-sm text-white hover:bg-[#2a2a2a] transition"
                      >
                        🚫 Sem Sacado
                      </button>
                    </div>
                  )}
                  {/* CNAB400 disponível apenas no modo Importados (não em Conta Capt nem Efactor) */}
                  {!efactorActive && !contaCaptActive && (
                    <>
                      <button
                        onClick={() => setShowCnab400Sub(!showCnab400Sub)}
                        disabled={generatingCNAB400}
                        className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#2a2a2a] transition border-b border-[#2a2a2a] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
                      >
                        <span>{generatingCNAB400 ? '⏳ Gerando...' : '📄 CNAB400'}</span>
                        <span className="text-[#666666]">{showCnab400Sub ? '▾' : '▸'}</span>
                      </button>
                      {showCnab400Sub && (
                        <div className="bg-[#141414] border-b border-[#2a2a2a]">
                          <button
                            onClick={() => handleGenerateRemessaCNAB400('01')}
                            className="w-full text-left pl-8 pr-4 py-2 text-sm text-white hover:bg-[#2a2a2a] transition"
                          >
                            Registro
                          </button>
                          <button
                            onClick={() => handleGenerateRemessaCNAB400('06')}
                            className="w-full text-left pl-8 pr-4 py-2 text-sm text-white hover:bg-[#2a2a2a] transition"
                          >
                            Alterar
                          </button>
                          <button
                            onClick={() => handleGenerateRemessaCNAB400('02')}
                            className="w-full text-left pl-8 pr-4 py-2 text-sm text-white hover:bg-[#2a2a2a] transition"
                          >
                            Baixa
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  <button
                    onClick={handleDownloadCessao}
                    className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#2a2a2a] transition border-b border-[#2a2a2a]"
                  >
                    📋 Cessão de Direitos
                  </button>
                  <button
                    onClick={handleGerarRelatorio}
                    className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#2a2a2a] transition border-b border-[#2a2a2a]"
                  >
                    📊 Gerar Relatório
                  </button>
                  <button
                    onClick={handleDeleteSelectedBoletos}
                    className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#2a2a2a] transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    🗑️ Excluir
                  </button>
                </div>
              )}
            </div>

            {/* Botão Filtro com Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowFiltroMenu(!showFiltroMenu)}
                style={{ height: '36px', width: '110px' }}
                className="flex items-center justify-center text-sm font-medium rounded transition bg-[#1a1a1a] text-white border border-[#2a2a2a] hover:bg-[#222222]"
              >
                Filtro
              </button>

              {showFiltroMenu && (
                <div className="absolute right-0 top-full mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded shadow-lg z-50 p-4 min-w-72">
                  {/* Vencimento */}
                  <div className="mb-3">
                    <label className="text-xs text-[#666666] uppercase font-semibold mb-1 block">Vencimento</label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={dataVencimentoInicio}
                        onChange={(e) => setDataVencimentoInicio(e.target.value)}
                        className="flex-1 px-2 py-1.5 bg-[#111111] border border-[#2a2a2a] rounded text-white text-xs focus:border-white outline-none transition"
                        title="Início"
                      />
                      <input
                        type="date"
                        value={dataVencimentoFim}
                        onChange={(e) => setDataVencimentoFim(e.target.value)}
                        className="flex-1 px-2 py-1.5 bg-[#111111] border border-[#2a2a2a] rounded text-white text-xs focus:border-white outline-none transition"
                        title="Final"
                      />
                    </div>
                  </div>

                  {/* Registro */}
                  <div className="mb-3">
                    <label className="text-xs text-[#666666] uppercase font-semibold mb-1 block">Registro</label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={dataRegistroInicio}
                        onChange={(e) => setDataRegistroInicio(e.target.value)}
                        className="flex-1 px-2 py-1.5 bg-[#111111] border border-[#2a2a2a] rounded text-white text-xs focus:border-white outline-none transition"
                        title="Início"
                      />
                      <input
                        type="date"
                        value={dataRegistroFim}
                        onChange={(e) => setDataRegistroFim(e.target.value)}
                        className="flex-1 px-2 py-1.5 bg-[#111111] border border-[#2a2a2a] rounded text-white text-xs focus:border-white outline-none transition"
                        title="Final"
                      />
                    </div>
                  </div>

                  {/* Antecipado */}
                  <div className="mb-3">
                    <label className="text-xs text-[#666666] uppercase font-semibold mb-1 block">Antecipado</label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={dataAntecipadoInicio}
                        onChange={(e) => setDataAntecipadoInicio(e.target.value)}
                        className="flex-1 px-2 py-1.5 bg-[#111111] border border-[#2a2a2a] rounded text-white text-xs focus:border-white outline-none transition"
                        title="Início"
                      />
                      <input
                        type="date"
                        value={dataAntecipadoFim}
                        onChange={(e) => setDataAntecipadoFim(e.target.value)}
                        className="flex-1 px-2 py-1.5 bg-[#111111] border border-[#2a2a2a] rounded text-white text-xs focus:border-white outline-none transition"
                        title="Final"
                      />
                    </div>
                  </div>

                  {/* Status */}
                  <div className="pt-3 border-t border-[#2a2a2a] flex gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={statusChecks.pendente}
                        onChange={(e) => setStatusChecks({ ...statusChecks, pendente: e.target.checked })}
                        className="w-4 h-4 cursor-pointer accent-white"
                      />
                      <span className="text-xs text-white">Pendentes</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={statusChecks.pago}
                        onChange={(e) => setStatusChecks({ ...statusChecks, pago: e.target.checked })}
                        className="w-4 h-4 cursor-pointer accent-white"
                      />
                      <span className="text-xs text-white">Pagos</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={statusChecks.cancelado}
                        onChange={(e) => setStatusChecks({ ...statusChecks, cancelado: e.target.checked })}
                        className="w-4 h-4 cursor-pointer accent-white"
                      />
                      <span className="text-xs text-white">Cancelado</span>
                    </label>
                  </div>

                  {/* Limpar filtros */}
                  <button
                    onClick={() => {
                      setDataVencimentoInicio(''); setDataVencimentoFim('')
                      setDataRegistroInicio(''); setDataRegistroFim('')
                      setDataAntecipadoInicio(''); setDataAntecipadoFim('')
                      setStatusChecks({ pago: false, cancelado: false, pendente: true })
                    }}
                    className="mt-3 w-full px-3 py-1.5 text-xs text-[#666666] border border-[#2a2a2a] rounded hover:text-white hover:border-[#444444] transition"
                  >
                    Limpar filtros
                  </button>
                </div>
              )}
            </div>

            {/* Botão Novo */}
            <button
              onClick={handleCreateNew}
              style={{ height: '36px', width: '110px' }}
              className="flex items-center justify-center bg-white text-black text-sm font-medium rounded hover:opacity-90 transition"
            >
              + Novo
            </button>

            {/* Botão Sync ZapSign */}
            <button
              onClick={() => handleSyncZapSign(false)}
              disabled={syncingZap}
              style={{ height: '36px', width: '36px' }}
              className="flex items-center justify-center bg-[#1a1a1a] text-white border border-[#2a2a2a] rounded hover:bg-[#222222] transition disabled:opacity-50"
              title={syncingZap ? 'Sincronizando...' : 'Sincronizar (Assina · Registro · Antecipa)'}
            >
              <svg
                className={`w-4 h-4 ${syncingZap ? 'animate-spin' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </>
        )}
      </div>


      {/* Tabela: capt_registrado (modo Conta Capt) ou capt_boletos */}
      {contaCaptActive ? (
        <ContaRegistradoTable reloadKey={captReloadKey} />
      ) : (
        <div className="flex-1 min-h-0 overflow-auto bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg">
          <BoletoTable
            boletos={getFilteredBoletos()}
            onEdit={handleEdit}
            onDelete={handleDeleteSingleBoleto}
            selectedRows={selectedRows}
            onSelectedRowsChange={setSelectedRows}
            contaData={contaData}
            showGerado={!importadosActive}
          />
        </div>
      )}

      {/* Modal de Formulário */}
      {showModal && (
        <BoletoFormModal
          boleto={editingBoleto}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
          contaId={getActiveContaId()}
        />
      )}

      {/* Import Preview Modal */}
      {showPreview && previewData.length > 0 && (
        <ImportPreview
          previewData={previewData}
          userId={getActiveContaId()}
          onImportComplete={handleImportPreviewComplete}
          onCancel={handleCancelPreview}
          userType={userType}
          allContas={allContas}
        />
      )}

      {/* Modal de Importação Efactor — confirmação + escolha de cedente de destino */}
      {showEfactorImportModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-white mb-4">Importar registros do Efactor</h2>

            {efactorImportStep === 'choice' ? (
              <>
                <p className="text-sm text-[#a3a3a3] mb-6">
                  Deseja importar os {efactorImportRecords.length} registro(s) selecionado(s) em <span className="text-white font-medium">outro cedente</span>?
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowEfactorImportModal(false)}
                    className="px-4 py-2 bg-[#1a1a1a] text-white text-sm border border-[#2a2a2a] rounded hover:bg-[#222222] transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => executeImportOpeite(getActiveContaId())}
                    className="px-4 py-2 bg-[#1a1a1a] text-white text-sm border border-[#2a2a2a] rounded hover:bg-[#222222] transition"
                  >
                    Não (perfil atual)
                  </button>
                  <button
                    onClick={() => setEfactorImportStep('selectProfile')}
                    className="px-4 py-2 bg-white text-black text-sm font-medium rounded hover:opacity-90 transition"
                  >
                    Sim
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-[#a3a3a3] mb-3">
                  Selecione o perfil (cedente) que receberá os {efactorImportRecords.length} registro(s):
                </p>
                <select
                  value={efactorImportTargetId}
                  onChange={(e) => {
                    const val = e.target.value
                    setEfactorImportTargetId(val)
                    if (val) {
                      executeImportOpeite(val)
                    }
                  }}
                  className="w-full bg-[#111111] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white mb-2 focus:outline-none focus:border-[#3a3a3a]"
                >
                  <option value="">Selecione um perfil...</option>
                  {allContas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome_correntista || c.cedente || c.conta || c.id}
                    </option>
                  ))}
                </select>
                {allContas.length === 0 && (
                  <p className="text-xs text-[#666666] mb-2">Nenhum perfil disponível para seleção.</p>
                )}
                <div className="flex justify-between gap-3 mt-4">
                  <button
                    onClick={() => setEfactorImportStep('choice')}
                    className="px-4 py-2 bg-[#1a1a1a] text-white text-sm border border-[#2a2a2a] rounded hover:bg-[#222222] transition"
                  >
                    ← Voltar
                  </button>
                  <button
                    onClick={() => setShowEfactorImportModal(false)}
                    className="px-4 py-2 bg-[#1a1a1a] text-white text-sm border border-[#2a2a2a] rounded hover:bg-[#222222] transition"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Import Result Modal */}
      {showImportResult && importStatus && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-white mb-4">{importStatus.title}</h2>

            {importStatus.type === 'success' ? (
              <div className="space-y-4">
                <div className="p-4 bg-[#111111] border border-[#1f1f1f] rounded">
                  <p className="text-2xl font-bold text-white">{importStatus.importedCount || importStatus.totalImported}</p>
                  <p className="text-sm text-[#666666] mt-1">Boleto(s) importado(s) com sucesso</p>
                  {importStatus.errorCount > 0 && (
                    <p className="text-sm text-[#a3a3a3] mt-2">
                      {importStatus.errorCount} erro(s) ao processar
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-[#1a1a1a] border border-[#404040] rounded">
                <p className="text-[#a3a3a3] text-sm whitespace-pre-wrap">{importStatus.message}</p>
              </div>
            )}

            <button
              onClick={() => setShowImportResult(false)}
              className="w-full mt-6 px-4 py-2 bg-white text-black text-sm font-medium rounded hover:opacity-90 transition"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Modal de Assinatura ZapSign (Com/Sem Sacado) */}
      {showZapsignModal && (
        <ZapsignModal
          qtd={selectedRows.size}
          initialMode={assinarMode}
          onClose={() => setShowZapsignModal(false)}
          onSubmit={runZapsign}
        />
      )}

      {/* Modal de confirmação: títulos já registrados no CNAB400 */}
      {cnab400Confirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-white font-semibold text-base">⚠️ Títulos já Registrados</h3>
            <p className="text-[#a3a3a3] text-sm">
              Os seguintes títulos já constam em <span className="text-white font-medium">capt_registrado</span> e podem ter sido processados pelo banco:
            </p>
            <ul className="space-y-1 max-h-48 overflow-y-auto">
              {cnab400Confirm.titulos.map(({ boleto }, i) => (
                <li key={i} className="text-sm text-white bg-[#111111] border border-[#2a2a2a] rounded px-3 py-1.5 font-mono">
                  {boleto.num_titulo || boleto.numero_documento || boleto.id}
                  {boleto.sacado_nome ? <span className="text-[#666666] ml-2 font-sans">{boleto.sacado_nome}</span> : null}
                </li>
              ))}
            </ul>
            <p className="text-[#a3a3a3] text-sm">Deseja gerar a remessa mesmo assim?</p>
            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setCnab400Confirm(null)}
                className="px-5 py-2 text-sm text-white border border-[#2a2a2a] rounded hover:bg-[#111111] transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const { tipoOperacao, boletosParaRemessa } = cnab400Confirm
                  setCnab400Confirm(null)
                  doGerarRemessaCNAB400(boletosParaRemessa, tipoOperacao)
                }}
                className="px-5 py-2 text-sm bg-white text-black font-medium rounded hover:opacity-90 transition"
              >
                Gerar mesmo assim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
