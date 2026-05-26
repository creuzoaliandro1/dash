import { useState, useEffect, useCallback, useRef } from 'react'
import BoletoFormModal from '../components/Boletos/BoletoFormModal'
import BoletoTable from '../components/Boletos/BoletoTable'
import FileUpload from '../components/Boletos/FileUpload'
import ImportPreview from '../components/Boletos/ImportPreview'
import { createBoleto, updateBoleto, getBoletos, deleteBoleto, createRemessa, getContaInfo, incrementContaCnab400, getContaRemessaCount, getAllContas, getOPEITEByCedente, criarAntecipacao, importOpeiteToBoletos } from '../services/boletoService'
import { generateMultipleBoletoPDFs, generateCNAB400RemittanceFile } from '../utils/boleto'
import { createAndDownloadZip } from '../utils/zipUtils'
import { generateDuplicataPDF } from '../utils/duplicata'
import { criarDocumentoAssinatura } from '../services/zapsignService'

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
  const [processandoAntecipacao, setProcessandoAntecipacao] = useState(false)
  const [importingOpeite, setImportingOpeite] = useState(false)
  const [assinandoZapsign, setAssinandoZapsign] = useState(false)
  const [contaData, setContaData] = useState(null)
  const [cnab400MenuOpen, setCnab400MenuOpen] = useState(false)
  const cnab400MenuRef = useRef(null)
  const [dataEmissaoInicio, setDataEmissaoInicio] = useState('')
  const [dataEmissaoFim, setDataEmissaoFim] = useState('')
  const [dataVencimentoInicio, setDataVencimentoInicio] = useState('')
  const [dataVencimentoFim, setDataVencimentoFim] = useState('')
  const [dataGeradoInicio, setDataGeradoInicio] = useState('')
  const [dataGeradoFim, setDataGeradoFim] = useState('')
  const [filterType, setFilterType] = useState('emissao')
  const [efactorActive, setEfactorActive] = useState(false)

  // Obter tipo de usuário e conta selecionada
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const userType = user.tipo || 'U'
  const selectedContaId = localStorage.getItem('activeContaId') || user.id
  const [allContas, setAllContas] = useState([])

  // Debug: log do tipo de usuário
  useEffect(() => {
    console.log('[BoletosPage] Debug - userType:', userType, 'user:', user)
  }, [userType])

  // Fechar menu CNAB400 ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (cnab400MenuRef.current && !cnab400MenuRef.current.contains(event.target)) {
        setCnab400MenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
        // Carregar dados normais (capt_boletos)
        const resultado = await getBoletos(activeId)
        setBoletos(resultado.data || [])
      }
    } catch (err) {
      console.error('Erro ao carregar boletos:', err)
      setBoletos([])
    }
    setLoading(false)
  }, [efactorActive, contaData])

  // Carregar na montagem
  useEffect(() => {
    const activeId = getActiveContaId()
    if (activeId) {
      loadBoletos()
      loadContaData()
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
    setEfactorActive(!efactorActive)
    // loadBoletos será chamado automaticamente pelo useEffect quando efactorActive mudar
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

    setEditingBoleto(boleto)
    setShowModal(true)
  }

  const handleSave = async (formData) => {
    setLoading(true)
    const activeId = getActiveContaId()
    console.log('[BoletosPage] handleSave para conta:', activeId)

    if (editingBoleto) {
      // Mapear chaves UPPERCASE do formulário para snake_case do banco
      const updates = {
        numero_documento:  formData.NUM_TITULO     || '',
        data_emissao:      formData.EMISSAO        || null,
        data_vencimento:   formData.VENCIMENTO     || null,
        valor:             parseFloat(formData.VALOR) || 0,
        nosso_numero:      formData.NOSSO_NUMERO   || '',
        sacado_nome:       formData.SACADO_NOME    || '',
        sacado_cic:        formData.SACADO_CIC     || '',
        sacado_cep:        formData.SACADO_CEP     || '',
        sacado_endereco:   formData.SACADO_ENDERECO|| '',
        sacado_bairro:     formData.SACADO_BAIRRO  || '',
        sacado_cidade:     formData.SACADO_CIDADE  || '',
        sacado_uf:         formData.SACADO_UF      || '',
        avalista_nome:     formData.AVALISTA        || '',
        avalista_cic:      formData.AVALISTA_CIC   || '',
        descricao:         formData.DESCRICAO      || '',
        status:            formData.STATUS         || 'pendente',
        situacao:          formData.SITUACAO       || '',
        valor_pagamento:   parseFloat(formData.VALOR_PAGO) || 0,
        data_pagamento:    formData.DATA_PAGO      || null,
      }
      const { error } = await updateBoleto(editingBoleto.id, updates)
      if (error) {
        alert('Erro ao atualizar boleto: ' + error.message)
        setLoading(false)
        return
      }
    } else {
      // Criar novo boleto
      const { error } = await createBoleto(activeId, formData)
      if (error) {
        alert('Erro ao salvar boleto: ' + error.message)
        setLoading(false)
        return
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

    // Filter by data de emissão
    if (filterType === 'emissao') {
      if (dataEmissaoInicio) {
        filtered = filtered.filter(boleto => {
          if (!boleto.data_emissao) return false
          return boleto.data_emissao >= dataEmissaoInicio
        })
      }
      if (dataEmissaoFim) {
        filtered = filtered.filter(boleto => {
          if (!boleto.data_emissao) return false
          return boleto.data_emissao <= dataEmissaoFim
        })
      }
    }

    // Filter by data de vencimento
    if (filterType === 'vencimento') {
      if (dataVencimentoInicio) {
        filtered = filtered.filter(boleto => {
          if (!boleto.data_vencimento) return false
          return boleto.data_vencimento >= dataVencimentoInicio
        })
      }
      if (dataVencimentoFim) {
        filtered = filtered.filter(boleto => {
          if (!boleto.data_vencimento) return false
          return boleto.data_vencimento <= dataVencimentoFim
        })
      }
    }

    // Filter by data de geração (created_at)
    if (filterType === 'gerado') {
      if (dataGeradoInicio) {
        filtered = filtered.filter(boleto => {
          if (!boleto.created_at) return false
          const boletoDate = boleto.created_at.split('T')[0] // Extrai apenas a data (yyyy-mm-dd)
          return boletoDate >= dataGeradoInicio
        })
      }
      if (dataGeradoFim) {
        filtered = filtered.filter(boleto => {
          if (!boleto.created_at) return false
          const boletoDate = boleto.created_at.split('T')[0] // Extrai apenas a data (yyyy-mm-dd)
          return boletoDate <= dataGeradoFim
        })
      }
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
    if (selectedRows.size === 0) {
      alert('Selecione pelo menos um boleto')
      return
    }
    setCnab400MenuOpen(false)

    setGeneratingCNAB400(true)
    setOpenActionsMenu(false)

    try {
      const filteredBoletos = getFilteredBoletos()
      const boletosParaRemessa = Array.from(selectedRows)
        .map(index => filteredBoletos[index])
        .filter(boleto => boleto)

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

  const handleDeleteSingleBoleto = async (boleto) => {
    // Proteger registros OPEITE
    if (boleto._ORIGEM === 'OPEITE') {
      alert('Não é possível deletar registros do Efactor (OPEITE). Eles são gerenciados externamente.')
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

  const handleImportOpeite = async () => {
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

    if (!window.confirm(`Importar ${registrosSelecionados.length} registro(s) do Efactor para a tabela de boletos?`)) {
      return
    }

    setOpenActionsMenu(false)
    setImportingOpeite(true)

    try {
      const activeId = getActiveContaId()
      console.log('[Ações] Importando', registrosSelecionados.length, 'registros OPEITE para conta', activeId)

      const { data: resultado, error } = await importOpeiteToBoletos(activeId, registrosSelecionados)

      if (error) {
        alert('Erro ao importar registros: ' + error.message)
        console.error('[Ações] Erro ao importar OPEITE:', error)
      } else {
        let mensagem = `Importação concluída:\n\n`
        mensagem += `✓ Importados: ${resultado.imported}\n`
        mensagem += `⏭ Pulados (já existiam): ${resultado.skipped}\n`
        if (resultado.errors > 0) {
          mensagem += `✗ Erros: ${resultado.errors}`
        }
        alert(mensagem)
        setSelectedRows(new Set())
        await loadBoletos()
      }
    } catch (error) {
      console.error('[Ações] Erro ao importar OPEITE:', error)
      alert('Erro ao importar registros: ' + error.message)
    } finally {
      setImportingOpeite(false)
    }
  }

  const handleAssinarZapsign = async () => {
    if (selectedRows.size === 0) {
      alert('Selecione pelo menos um boleto para enviar à assinatura')
      return
    }

    if (!window.confirm(`Enviar ${selectedRows.size} duplicata(s) para assinatura na ZapSign?`)) {
      return
    }

    setOpenActionsMenu(false)
    setAssinandoZapsign(true)

    try {
      const filteredBoletos = getFilteredBoletos()
      const selecionados = Array.from(selectedRows)
        .map(index => filteredBoletos[index])
        .filter(b => b)

      let ok = 0
      let fail = 0
      const links = []

      for (const boleto of selecionados) {
        try {
          // PDF a assinar = Duplicata gerada pelo nosso sistema
          const pdfBlob = await generateDuplicataPDF(boleto, contaData)

          const { data, error } = await criarDocumentoAssinatura({
            name: `Duplicata ${boleto.numero_documento || boleto.nosso_numero || ''}`.trim(),
            pdfBlob,
            signerName: boleto.sacado_nome || 'Sacado',
            signerEmail: boleto.sacado_email || '',
            signerPhone: boleto.sacado_telefone || '',
          })

          if (error) {
            fail++
            console.error('[ZapSign] Erro ao criar documento:', error)
            continue
          }

          ok++
          if (data?.sign_url) {
            links.push(`${boleto.sacado_nome || boleto.numero_documento || ''}: ${data.sign_url}`)
          }

          // Persistir token/link/status no banco
          if (boleto.id && data?.doc_token) {
            await updateBoleto(boleto.id, {
              zapsign_doc_token: data.doc_token,
              zapsign_sign_url: data.sign_url || '',
              zapsign_status: 'pendente',
            })
          }
        } catch (e) {
          fail++
          console.error('[ZapSign] Exceção ao processar boleto:', boleto?.id, e)
        }
      }

      let msg = `Assinatura ZapSign:\n\n✓ Documentos criados: ${ok}\n✗ Falhas: ${fail}`
      if (links.length > 0) {
        msg += `\n\nLinks de assinatura:\n${links.join('\n')}`
      }
      alert(msg)

      setSelectedRows(new Set())
      await loadBoletos()
    } catch (error) {
      console.error('[ZapSign] Erro geral:', error)
      alert('Erro ao enviar para assinatura: ' + error.message)
    } finally {
      setAssinandoZapsign(false)
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

    // Separar registros OPEITE dos registros locais
    const boletosPorExcluir = boletosParaDeletar.filter(b => b._ORIGEM !== 'OPEITE')
    const boletosOpeite = boletosParaDeletar.filter(b => b._ORIGEM === 'OPEITE')

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
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
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
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-transparent text-white text-sm font-medium border border-[#2a2a2a] rounded hover:bg-[#111111] transition">
            Exportar CSV
          </button>
          <div className="relative" ref={cnab400MenuRef}>
            <button
              onClick={() => setCnab400MenuOpen(!cnab400MenuOpen)}
              disabled={selectedRows.size === 0 || generatingCNAB400}
              className={`px-4 py-2 text-sm font-medium border rounded transition ${
                selectedRows.size === 0 || generatingCNAB400
                  ? 'bg-transparent text-[#666666] border-[#2a2a2a] cursor-not-allowed'
                  : 'bg-transparent text-white border-[#2a2a2a] hover:bg-[#111111]'
              }`}
            >
              {generatingCNAB400 ? '⏳ Gerando...' : 'Remessa CNAB400'}
            </button>
            {cnab400MenuOpen && (
              <div className="absolute top-full mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded shadow-lg z-50 min-w-48">
                <button
                  onClick={() => handleGenerateRemessaCNAB400('01')}
                  className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#2a2a2a] transition border-b border-[#2a2a2a]"
                >
                  Registro
                </button>
                <button
                  onClick={() => handleGenerateRemessaCNAB400('06')}
                  className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#2a2a2a] transition border-b border-[#2a2a2a]"
                >
                  Alterar
                </button>
                <button
                  onClick={() => handleGenerateRemessaCNAB400('02')}
                  className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#2a2a2a] transition"
                >
                  Baixa
                </button>
              </div>
            )}
          </div>
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 bg-white text-black text-sm font-medium rounded hover:opacity-90 transition"
          >
            + Emitir boleto
          </button>
        </div>
      </div>

      {/* Upload Area */}
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
      />

      {/* Search and Filter - All in one line */}
      <div className="flex gap-3 items-end">
        {/* Busca por texto */}
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

        {/* Filtro de Status */}
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

        {/* Filtro de Datas - Tipo */}
        <div className="flex gap-2 items-center">
          <label className="flex items-center gap-2 whitespace-nowrap">
            <input
              type="radio"
              name="filterType"
              value="emissao"
              checked={filterType === 'emissao'}
              onChange={(e) => {
                setFilterType(e.target.value)
                setDataVencimentoInicio('')
                setDataVencimentoFim('')
              }}
              className="w-4 h-4 cursor-pointer"
            />
            <span className="text-xs text-white cursor-pointer">Emissão</span>
          </label>
          <label className="flex items-center gap-2 whitespace-nowrap">
            <input
              type="radio"
              name="filterType"
              value="vencimento"
              checked={filterType === 'vencimento'}
              onChange={(e) => {
                setFilterType(e.target.value)
                setDataEmissaoInicio('')
                setDataEmissaoFim('')
                setDataGeradoInicio('')
                setDataGeradoFim('')
              }}
              className="w-4 h-4 cursor-pointer"
            />
            <span className="text-xs text-white cursor-pointer">Vencimento</span>
          </label>
          <label className="flex items-center gap-2 whitespace-nowrap">
            <input
              type="radio"
              name="filterType"
              value="gerado"
              checked={filterType === 'gerado'}
              onChange={(e) => {
                setFilterType(e.target.value)
                setDataEmissaoInicio('')
                setDataEmissaoFim('')
                setDataVencimentoInicio('')
                setDataVencimentoFim('')
              }}
              className="w-4 h-4 cursor-pointer"
            />
            <span className="text-xs text-white cursor-pointer">Gerado</span>
          </label>
        </div>

        {/* Filtro de Datas - Campos */}
        {filterType === 'emissao' ? (
          <>
            <input
              type="date"
              value={dataEmissaoInicio}
              onChange={(e) => setDataEmissaoInicio(e.target.value)}
              className="px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-xs focus:border-white outline-none transition w-32"
              title="Data de início"
            />
            <input
              type="date"
              value={dataEmissaoFim}
              onChange={(e) => setDataEmissaoFim(e.target.value)}
              className="px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-xs focus:border-white outline-none transition w-32"
              title="Data de fim"
            />
          </>
        ) : filterType === 'vencimento' ? (
          <>
            <input
              type="date"
              value={dataVencimentoInicio}
              onChange={(e) => setDataVencimentoInicio(e.target.value)}
              className="px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-xs focus:border-white outline-none transition w-32"
              title="Data de início"
            />
            <input
              type="date"
              value={dataVencimentoFim}
              onChange={(e) => setDataVencimentoFim(e.target.value)}
              className="px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-xs focus:border-white outline-none transition w-32"
              title="Data de fim"
            />
          </>
        ) : (
          <>
            <input
              type="date"
              value={dataGeradoInicio}
              onChange={(e) => setDataGeradoInicio(e.target.value)}
              className="px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-xs focus:border-white outline-none transition w-32"
              title="Data de início"
            />
            <input
              type="date"
              value={dataGeradoFim}
              onChange={(e) => setDataGeradoFim(e.target.value)}
              className="px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-xs focus:border-white outline-none transition w-32"
              title="Data de fim"
            />
          </>
        )}

        {/* Botão Filtrar com Lupa */}
        <button
          onClick={() => {
            // Trigger filter (getFilteredBoletos é chamado automaticamente)
          }}
          className="p-2 bg-white text-black rounded hover:bg-[#e0e0e0] transition flex items-center justify-center"
          title="Filtrar por datas"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>

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
                onClick={handleAssinarZapsign}
                disabled={assinandoZapsign}
                className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#2a2a2a] transition border-b border-[#2a2a2a] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assinandoZapsign ? '⏳ Enviando...' : '✍️ Assinar (ZapSign)'}
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
      </div>

      {/* Tabela de Boletos — overflow-auto gerencia x+y; header da tabela usa sticky top-0 */}
      <div className="flex-1 min-h-0 overflow-auto bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg">
        <BoletoTable
          boletos={getFilteredBoletos()}
          onEdit={handleEdit}
          onDelete={handleDeleteSingleBoleto}
          selectedRows={selectedRows}
          onSelectedRowsChange={setSelectedRows}
          contaData={contaData}
        />
      </div>

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

      {/* Import Result Modal */}
      {showImportResult && importStatus && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
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
    </div>
  )
}
