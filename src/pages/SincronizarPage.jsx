import { useState, useRef, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { supabase } from '../lib/supabase'
import { smartFrom } from '../services/firebirdQuery'
import { firebirdConfig } from '../config/firebird'
import { generateCNAB400RemittanceFile } from '../utils/boleto'
import { incrementContaCnab400, getContaRemessaCount, uploadRemessaCNAB400, createRemessa } from '../services/boletoService'

// Sincronizar (Operações · Master): TODA a OPEITE (sem paginar, exceto STATUS='DC'),
// lida do Firebird (com fallback Supabase). Colunas:
// LANC · Nosso Número · Documento · Valor · Vencimento · Nome · CIC · Linha Digitável.
// Nosso Número e Linha Digitável vêm de capt_registrado, cruzando OPEITE x
// capt_registrado por valor+vencimento+cic (identd_nosso_num / num_linha_digtvl).
// O filtro de vencimento já inicia em HOJE para reduzir o volume enriquecido.

const API_PAGE = 500
const hojeISO = () => new Date().toISOString().slice(0, 10)

const fmtValor = (v) => (parseFloat(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtData = (d) => {
  if (!d) return ''
  const s = String(d).slice(0, 10)
  const [a, m, dia] = s.split('-')
  return a && m && dia ? `${dia}/${m}/${a}` : s
}

const _cents = (v) => Math.round((parseFloat(v) || 0) * 100)
const _iso = (d) => (d ? String(d).slice(0, 10) : '')
const _dig = (v) => String(v ?? '').replace(/\D/g, '')
const chaveVVC = (valor, venc, cic) => `${_cents(valor)}|${_iso(venc)}|${_dig(cic)}`

// Soma n dias a uma data ISO (YYYY-MM-DD), preservando o formato.
const addDays = (iso, n) => {
  if (!iso) return iso
  const d = new Date(String(iso).slice(0, 10) + 'T00:00:00')
  if (isNaN(d)) return iso
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
// Diferença em dias (bIso - aIso).
const daysDiff = (aIso, bIso) => {
  const a = new Date(String(aIso).slice(0, 10) + 'T00:00:00')
  const b = new Date(String(bIso).slice(0, 10) + 'T00:00:00')
  if (isNaN(a) || isNaN(b)) return 0
  return Math.round((b - a) / 86400000)
}
// Extrai o número do endereço (último número do texto); 'SN' quando não há.
const extractNumero = (end) => {
  const m = String(end || '').match(/(\d+)\s*$/)
  return m ? m[1] : 'SN'
}
// Mapeia uma linha de capt_registrado + a nova data + os dados do SACADO
// (endereço completo do pagador) para o formato de "boleto" do CNAB400.
const captParaBoletoRemessa = (c, novaData, sac) => {
  // Endereço/cidade/UF/CEP: capt_registrado (SACADO só como reserva).
  const endereco = c.lograd_pagdr || (sac && sac.endereco) || ''
  // Número do pagador: capt_registrado.numero_endereco_pagdr; se vazio,
  // extrai do fim do endereço do SACADO (para não voltar em branco ao BMP).
  const numero = c.numero_endereco_pagdr || extractNumero((sac && sac.endereco) || endereco)
  return {
    numero_documento: c.numero_documento || c.num_doc_tit || '',
    nosso_numero: c.identd_nosso_num || '',
    data_vencimento: novaData,
    data_emissao: c.dt_ems_tit || '',
    valor: c.vlr_tit,
    sacado_cic: c.cnpj_cpf_pagdr || '',
    sacado_nome: c.nom_rz_soc_pagdr || '',
    sacado_endereco: endereco,
    sacado_numero: numero,
    sacado_cep: c.cep_pagdr || (sac && sac.cep) || '',
    sacado_bairro: (sac && sac.bairro) || '',        // bairro: SACADO (via OPEITE)
    sacado_uf: c.uf_pagdr || (sac && sac.uf) || '',
    sacado_cidade: c.cid_pagdr || (sac && sac.cidade) || '',
    avalista_cic: '',
    avalista_nome: c.nome_sacador_avalista || '',
    descricao: c.descricao || '',
  }
}

// capt_registrado indexada por valor+venc+cic -> { nosso, linha }
async function carregarRegIndex() {
  const idx = {}
  let from = 0
  const ps = 1000
  while (true) {
    const { data, error } = await supabase
      .from('capt_registrado')
      .select('vlr_tit, dt_venc_tit, cnpj_cpf_pagdr, identd_nosso_num, num_linha_digtvl')
      .range(from, from + ps - 1)
    if (error || !data || data.length === 0) break
    data.forEach((r) => {
      const k = chaveVVC(r.vlr_tit, r.dt_venc_tit, r.cnpj_cpf_pagdr)
      if (!(k in idx)) idx[k] = { nosso: r.identd_nosso_num ?? '', linha: r.num_linha_digtvl ?? '' }
    })
    if (data.length < ps) break
    from += ps
  }
  return idx
}

export default function SincronizarPage() {
  const [rawRows, setRawRows] = useState([])       // toda a OPEITE (menos DC), cru
  const [displayRows, setDisplayRows] = useState([]) // subconjunto filtrado + enriquecido
  const [loading, setLoading] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [erro, setErro] = useState(null)
  const [showFiltro, setShowFiltro] = useState(false)
  const [showAcoes, setShowAcoes] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [showProrrogacao, setShowProrrogacao] = useState(false)
  const [carregandoPR, setCarregandoPR] = useState(false)
  const [prRegistros, setPrRegistros] = useState([])
  const [prSel, setPrSel] = useState([])
  const [showRemessaPR, setShowRemessaPR] = useState(false)
  const [gerandoRem, setGerandoRem] = useState(false)
  const [remRows, setRemRows] = useState([])
  const F0 = { vencDe: hojeISO(), vencAte: '', lancaDe: '', lancaAte: '', numDe: '', numAte: '', debitavel: false }
  const [f, setF] = useState(F0)
  const [sort, setSort] = useState({ col: 'lanc', dir: 'desc' })
  const toggleSort = (c) => setSort((x) => x.col === c ? { col: c, dir: x.dir === 'asc' ? 'desc' : 'asc' } : { col: c, dir: 'asc' })
  const sacadoCache = useRef({})
  const regIdx = useRef({})

  // Carga inicial: índice do capt_registrado + TODA a OPEITE (menos DC).
  useEffect(() => {
    let cancel = false
    ;(async () => {
      setLoading(true); setErro(null); setProgresso(0)
      try {
        regIdx.current = await carregarRegIndex()
        const todas = []
        for (let p = 0; p < 600; p++) {
          const { data, error } = await smartFrom('OPEITE')
            .select('NUM_LANCAMENTO, NUM_TITULO, VR_FACE, DT_VENCI, DT_VENCI_NOVO, DT_LANCA, COD_SACADO, COD_CEDENTE, STATUS')
            .range(p * API_PAGE, p * API_PAGE + API_PAGE - 1)
          if (error) throw error
          const lote = data || []
          for (const o of lote) {
            if (String(o.STATUS || '').trim().toUpperCase() !== 'DC') todas.push(o)
          }
          if (!cancel) setProgresso(todas.length)
          if (lote.length < API_PAGE) break
        }
        if (!cancel) setRawRows(todas)
      } catch (e) {
        if (!cancel) setErro(e?.message || String(e))
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => { cancel = true }
  }, [])

  // Pré-filtro (vencimento/lançamento/nº) sobre o cru — não precisa de enriquecimento.
  const preFiltrados = useMemo(() => {
    const dstr = (d) => (d ? String(d).slice(0, 10) : '')
    return rawRows.filter((o) => {
      const v = dstr(o.DT_VENCI), l = dstr(o.DT_LANCA), n = parseInt(o.NUM_LANCAMENTO)
      if (f.vencDe && v < f.vencDe) return false
      if (f.vencAte && v > f.vencAte) return false
      if (f.lancaDe && l < f.lancaDe) return false
      if (f.lancaAte && l > f.lancaAte) return false
      if (f.numDe !== '' && !(n >= parseInt(f.numDe))) return false
      if (f.numAte !== '' && !(n <= parseInt(f.numAte))) return false
      return true
    })
  }, [rawRows, f.vencDe, f.vencAte, f.lancaDe, f.lancaAte, f.numDe, f.numAte])

  // Enriquece só o pré-filtrado: nome/CIC (SACADO) + nosso número/linha (capt_registrado).
  useEffect(() => {
    let cancel = false
    ;(async () => {
      if (rawRows.length === 0) { setDisplayRows([]); return }
      setEnriching(true)
      try {
        const cods = [...new Set(preFiltrados.map((o) => o.COD_SACADO)
          .filter((v) => v != null && !(v in sacadoCache.current)))]
        if (cods.length) {
          const { data: sac } = await smartFrom('SACADO')
            .select('COD_SACADO, NOME_CORRENTISTA, CIC').in('COD_SACADO', cods)
          ;(sac || []).forEach((s) => { sacadoCache.current[s.COD_SACADO] = { nome: s.NOME_CORRENTISTA, cic: s.CIC } })
          cods.forEach((c) => { if (!(c in sacadoCache.current)) sacadoCache.current[c] = { nome: '', cic: '' } })
        }
        if (cancel) return
        const enr = preFiltrados.map((o) => {
          const cic = sacadoCache.current[o.COD_SACADO]?.cic || ''
          const reg = regIdx.current[chaveVVC(o.VR_FACE, o.DT_VENCI, cic)]
          return {
            lanc: o.NUM_LANCAMENTO,
            nosso: reg?.nosso || '',
            doc: o.NUM_TITULO || '',
            valor: o.VR_FACE,
            venc: o.DT_VENCI,
            lanca: o.DT_LANCA,
            nome: sacadoCache.current[o.COD_SACADO]?.nome || '',
            cic,
            linha: reg?.linha || '',
            temCodigo: !!reg,
          }
        })
        if (!cancel) setDisplayRows(enr)
      } finally {
        if (!cancel) setEnriching(false)
      }
    })()
    return () => { cancel = true }
  }, [preFiltrados])

  // Debitável (desmarcado = só os sem linha digitável) + ordenação.
  const rowsFiltrados = displayRows.filter((r) => (f.debitavel ? true : !r.temCodigo))
  const numCols = new Set(['lanc', 'valor'])
  const rowsOrdenados = [...rowsFiltrados].sort((a, b) => {
    const c = sort.col
    let r
    if (numCols.has(c)) r = (parseFloat(a[c]) || 0) - (parseFloat(b[c]) || 0)
    else r = String(a[c] || '').localeCompare(String(b[c] || ''))
    return sort.dir === 'asc' ? r : -r
  })
  const arrow = (c) => (sort.col === c ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '')

  // Exporta (Excel) os títulos que AINDA constam em capt_registrado como ativos
  // (não devolvido, não pago, não cancelado) e que possuem correspondência em
  // OPEITE com STATUS = 'CO' (cruzando por valor+vencimento+cic).
  const exportarRegistradosCO = async () => {
    if (loading || rawRows.length === 0) {
      alert('Aguarde o carregamento da OPEITE antes de exportar.')
      return
    }
    setExportando(true)
    setShowAcoes(false)
    try {
      // 1) Linhas OPEITE com STATUS = 'CO'
      const coRows = rawRows.filter((o) => String(o.STATUS || '').trim().toUpperCase() === 'CO')

      // 2) Garante CIC (via SACADO) para os COD_SACADO das linhas CO
      const faltantes = [...new Set(coRows.map((o) => o.COD_SACADO)
        .filter((v) => v != null && !(v in sacadoCache.current)))]
      for (let i = 0; i < faltantes.length; i += 300) {
        const chunk = faltantes.slice(i, i + 300)
        const { data: sac } = await smartFrom('SACADO')
          .select('COD_SACADO, NOME_CORRENTISTA, CIC').in('COD_SACADO', chunk)
        ;(sac || []).forEach((sx) => { sacadoCache.current[sx.COD_SACADO] = { nome: sx.NOME_CORRENTISTA, cic: sx.CIC } })
        chunk.forEach((c) => { if (!(c in sacadoCache.current)) sacadoCache.current[c] = { nome: '', cic: '' } })
      }

      // 3) Mapa chave (valor+venc+cic) -> NUM_TITULO da linha CO
      const coByNum = new Map()
      for (const o of coRows) {
        const cic = sacadoCache.current[o.COD_SACADO]?.cic || ''
        if (!cic) continue
        const k = chaveVVC(o.VR_FACE, o.DT_VENCI, cic)
        if (!coByNum.has(k)) coByNum.set(k, o.NUM_TITULO || '')
      }

      // 4) Carrega capt_registrado (exclui devolvidos já no banco) e filtra ativos
      const ehAtivo = (r) => {
        if (String(r.status || 'ativo').toLowerCase() === 'devolvido') return false
        const sit = String(r.situacao_boleto || '').toLowerCase()
        if (sit.includes('pago') || sit.includes('cancel')) return false
        return true
      }
      const registros = []
      {
        let from = 0
        const ps = 1000
        while (true) {
          const { data, error } = await supabase
            .from('capt_registrado')
            .select('identd_nosso_num, numero_documento, num_doc_tit, nom_rz_soc_pagdr, cnpj_cpf_pagdr, vlr_tit, dt_venc_tit, num_linha_digtvl, situacao_boleto, status')
            .neq('status', 'devolvido')
            .range(from, from + ps - 1)
          if (error || !data || data.length === 0) break
          registros.push(...data)
          if (data.length < ps) break
          from += ps
        }
      }

      // 5) Mantém apenas os ativos que casam com uma linha CO da OPEITE
      const relatorio = registros
        .filter(ehAtivo)
        .filter((r) => coByNum.has(chaveVVC(r.vlr_tit, r.dt_venc_tit, r.cnpj_cpf_pagdr)))

      if (relatorio.length === 0) {
        alert('Nenhum registrado ativo com STATUS CO em OPEITE encontrado.')
        return
      }

      // 6) Monta e baixa a planilha Excel
      const linhas = relatorio.map((r) => ({
        'Nosso Número': r.identd_nosso_num || '',
        'Número': coByNum.get(chaveVVC(r.vlr_tit, r.dt_venc_tit, r.cnpj_cpf_pagdr)) || '',
        'Nome': r.nom_rz_soc_pagdr || '',
        'CIC': r.cnpj_cpf_pagdr || '',
        'Valor': parseFloat(r.vlr_tit) || 0,
        'Vencimento': fmtData(r.dt_venc_tit),
        'Código de Barras': r.num_linha_digtvl || '',
      }))
      const ws = XLSX.utils.json_to_sheet(linhas)
      ws['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 34 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 52 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Registrados CO')
      XLSX.writeFile(wb, `Registrados_CO_OPEITE_${hojeISO()}.xlsx`)
    } catch (e) {
      alert('Erro ao exportar: ' + (e?.message || String(e)))
    } finally {
      setExportando(false)
    }
  }

  // Carrega as linhas OPEITE STATUS='PR' que possuem NUM_LANCAMENTO correspondente
  // em capt_registrado (por num_lanca). Reaproveitado pelo modal e pela remessa.
  const carregarPRRegistros = async () => {
    const prRows = rawRows.filter((o) => String(o.STATUS || '').trim().toUpperCase() === 'PR')
    const lancs = [...new Set(prRows.map((o) => o.NUM_LANCAMENTO).filter((v) => v != null))]
    const capById = {}
    for (let i = 0; i < lancs.length; i += 200) {
      const chunk = lancs.slice(i, i + 200)
      const { data } = await supabase
        .from('capt_registrado')
        .select('num_lanca, id, identd_nosso_num, numero_documento, num_doc_tit, nom_rz_soc_pagdr, cnpj_cpf_pagdr, vlr_tit, dt_venc_tit, dt_ems_tit, lograd_pagdr, numero_endereco_pagdr, cep_pagdr, cid_pagdr, uf_pagdr, nome_sacador_avalista, descricao, cod_cedente_titular, dt_juros_tit, data_multa, dt_desct_tit_1, dt_desct_tit_2, dt_desct_tit_3')
        .in('num_lanca', chunk)
      ;(data || []).forEach((r) => { if (r.num_lanca != null && !(r.num_lanca in capById)) capById[r.num_lanca] = r })
    }
    return prRows
      .filter((o) => o.NUM_LANCAMENTO in capById)
      .map((o) => {
        const r = capById[o.NUM_LANCAMENTO]
        return {
          lanc: o.NUM_LANCAMENTO,
          numero: o.NUM_TITULO || '',
          nosso: r.identd_nosso_num || '',
          nome: r.nom_rz_soc_pagdr || '',
          cic: r.cnpj_cpf_pagdr || '',
          valor: r.vlr_tit,
          vencCapt: r.dt_venc_tit,
          vencEfactor: o.DT_VENCI,
          vencEfactorNovo: o.DT_VENCI_NOVO,
          cedente: String(r.cod_cedente_titular ?? '').trim(),
          cod_sacado: o.COD_SACADO,
          cod_cedente: o.COD_CEDENTE,
          _capt: r,
        }
      })
      .sort((a, b) => (parseInt(a.lanc) || 0) - (parseInt(b.lanc) || 0))
  }

  // Abre o modal "Registros com prorrogação".
  const abrirProrrogacao = async () => {
    if (loading || rawRows.length === 0) {
      alert('Aguarde o carregamento da OPEITE antes de abrir a prorrogação.')
      return
    }
    setShowAcoes(false)
    setCarregandoPR(true)
    setPrRegistros([])
    setPrSel([])
    setShowProrrogacao(true)
    try {
      const registros = await carregarPRRegistros()
      setPrRegistros(registros)
      setPrSel(registros.map(() => true))
    } catch (e) {
      alert('Erro ao carregar prorrogações: ' + (e?.message || String(e)))
      setShowProrrogacao(false)
    } finally {
      setCarregandoPR(false)
    }
  }

  // Exporta (Excel) apenas os registros de prorrogação marcados na tabela.
  const exportarProrrogacao = () => {
    const selecionados = prRegistros.filter((_, i) => prSel[i])
    if (selecionados.length === 0) return
    const linhas = selecionados.map((r) => ({
      'NUM LANCAMENTO': r.lanc,
      'NUMERO': r.numero,
      'NOSSO NUMERO': r.nosso,
      'NOME': r.nome,
      'CIC': r.cic,
      'VALOR': parseFloat(r.valor) || 0,
      'VENCIMENTO CAPT': fmtData(r.vencCapt),
      'VENCIMENTO EFACTOR': fmtData(r.vencEfactor),
      'VENCIMENTO EFACTOR NOVO': fmtData(r.vencEfactorNovo),
    }))
    const ws = XLSX.utils.json_to_sheet(linhas)
    ws['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 34 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 20 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Prorrogacao')
    XLSX.writeFile(wb, `Prorrogacao_OPEITE_${hojeISO()}.xlsx`)
  }

  // Abre o popup "Remessa Prorrogação": parte da seleção de prorrogação (ou carrega
  // tudo se ainda não foi aberto), com a nova data editável (default = DT_VENCI_NOVO).
  const abrirRemessaProrrogacao = async () => {
    if (loading || rawRows.length === 0) {
      alert('Aguarde o carregamento da OPEITE antes de gerar a remessa.')
      return
    }
    setShowAcoes(false)
    let base = prRegistros.filter((_, i) => prSel[i])
    if (base.length === 0) {
      setCarregandoPR(true)
      try {
        const carregados = await carregarPRRegistros()
        setPrRegistros(carregados)
        setPrSel(carregados.map(() => true))
        base = carregados
      } catch (e) {
        alert('Erro ao carregar prorrogações: ' + (e?.message || String(e)))
        return
      } finally {
        setCarregandoPR(false)
      }
    }
    if (base.length === 0) {
      alert('Nenhum registro de prorrogação com correspondência para gerar remessa.')
      return
    }
    setRemRows(base.map((r) => ({
      lanc: r.lanc,
      numero: r.numero,
      nosso: r.nosso,
      nome: r.nome,
      cic: r.cic,
      valor: r.valor,
      cod_sacado: r.cod_sacado,
      cod_cedente: r.cod_cedente,
      anterior: r.vencCapt ? String(r.vencCapt).slice(0, 10) : '',
      nova: (r.vencEfactorNovo || r.vencCapt) ? String(r.vencEfactorNovo || r.vencCapt).slice(0, 10) : '',
      sel: true,
      _capt: r._capt,
    })))
    setShowRemessaPR(true)
  }

  // Gera a(s) remessa(s) CNAB400 de alteração de vencimento (ocorrência 06),
  // um arquivo .rem/.zip por conta (cedente), e um .zip unificado quando há mais
  // de uma conta. Também move (no cadastro) as datas de juros/multa/desconto.
  const gerarRemessaProrrogacao = async () => {
    const selec = remRows.filter((r) => r.sel)
    if (selec.length === 0) { alert('Selecione ao menos um título.'); return }
    for (const r of selec) {
      if (!r.nova || !/^\d{4}-\d{2}-\d{2}$/.test(r.nova)) {
        alert(`Informe a nova data de vencimento do lançamento ${r.lanc}.`)
        return
      }
    }
    setGerandoRem(true)
    try {
      // 1) Resolve o cedente ORIGINAL de cada título (OPEITE.COD_CEDENTE), buscando
      //    direto na OPEITE por Nº de lançamento — robusto a recargas da tela.
      //    O header do arquivo será sempre a CAPT CAPITAL; as linhas de detalhe
      //    mantêm a conta original (onde o título está registrado no BMP).
      const lancsSel = [...new Set(selec.map((r) => r.lanc).filter((v) => v != null))]
      const codCedByLanc = {}
      for (let i = 0; i < lancsSel.length; i += 300) {
        const chunk = lancsSel.slice(i, i + 300)
        const { data: ops } = await smartFrom('OPEITE').select('NUM_LANCAMENTO, COD_CEDENTE').in('NUM_LANCAMENTO', chunk)
        ;(ops || []).forEach((o) => { if (o.NUM_LANCAMENTO != null) codCedByLanc[String(o.NUM_LANCAMENTO)] = o.COD_CEDENTE })
      }
      const porOrigem = {}
      for (const r of selec) {
        const co = (r.cod_cedente != null && r.cod_cedente !== '') ? r.cod_cedente : codCedByLanc[String(r.lanc)]
        if (co == null || co === '') continue
        ;(porOrigem[String(co)] = porOrigem[String(co)] || []).push(r)
      }
      const origCods = Object.keys(porOrigem)
      if (origCods.length === 0) { alert('Nenhum título com cedente de origem (OPEITE.COD_CEDENTE) identificado.'); return }

      // 1b) Carrega os dados de endereço do pagador (SACADO) por COD_SACADO
      const codsSacado = [...new Set(selec.map((r) => r.cod_sacado).filter((v) => v != null))]
      const sacadoMap = {}
      for (let i = 0; i < codsSacado.length; i += 300) {
        const chunk = codsSacado.slice(i, i + 300)
        const { data: sacs } = await smartFrom('SACADO')
          .select('COD_SACADO, BAIRRO, CIDADE, UF, ENDERECO, CEP').in('COD_SACADO', chunk)
        ;(sacs || []).forEach((sx) => {
          sacadoMap[sx.COD_SACADO] = { bairro: sx.BAIRRO, cidade: sx.CIDADE, uf: sx.UF, endereco: sx.ENDERECO, cep: sx.CEP }
        })
      }

      // 2) Carrega as contas de cada cedente de origem (por cod_cedente). Cada conta
      //    gera a SUA própria remessa (header e detalhe = a mesma conta), como um
      //    registro CNAB normal, porém com ocorrência 06 (alteração de vencimento).
      const { data: contasOrig } = await supabase
        .from('CONTAS')
        .select('id, nome_correntista, conta, cedente, cic, cnab400, agencia, cod_cedente')
        .in('cod_cedente', origCods.map((c) => Number(c)))
      const contaByCod = {}
      ;(contasOrig || []).forEach((c) => { if (c.cod_cedente != null) contaByCod[String(c.cod_cedente)] = c })
      const semConta = origCods.filter((c) => !contaByCod[c])
      if (semConta.length > 0) {
        alert('Cedente(s) de origem sem conta em CONTAS (cod_cedente): ' + semConta.join(', ') + '. Esses títulos não serão incluídos.')
      }

      // 3) Gera um .rem/.zip por conta, usando a numeração de cada conta.
      const now = new Date()
      const p2 = (n) => String(n).padStart(2, '0')
      const dd = p2(now.getDate()), mm = p2(now.getMonth() + 1)
      const zips = []
      for (const co of origCods) {
        const conta = contaByCod[co]
        if (!conta) continue
        const boletos = porOrigem[co].map((r) => captParaBoletoRemessa(r._capt, r.nova, sacadoMap[r.cod_sacado]))
        const cnab400Num = Number(conta.cnab400)
        let nextSeq
        if (!isNaN(cnab400Num) && cnab400Num >= 1) nextSeq = cnab400Num + 1
        else { const { count } = await getContaRemessaCount(conta.cedente || ''); nextSeq = (count || 0) + 1 }
        // Registro CNAB normal (header = detalhe = a própria conta), ocorrência 06
        const blob = await generateCNAB400RemittanceFile(boletos, conta, nextSeq, '06')
        const seq = String(nextSeq).padStart(7, '0')
        const remName = `CB${dd}${mm}${seq}.REM`
        try { await incrementContaCnab400(conta.id, nextSeq) } catch (e) { /* best-effort */ }
        let caminhoStorage = null
        try { const { data: up } = await uploadRemessaCNAB400(conta.id, remName, blob); caminhoStorage = up?.caminho || null } catch (e) { /* best-effort */ }
        try {
          const valorTotal = boletos.reduce((sm, b) => sm + (parseFloat(b.valor) || 0), 0)
          await createRemessa(conta.id, { filename: remName, quantidadeBoletos: boletos.length, valorTotal, caminhoStorage })
        } catch (e) { /* best-effort */ }
        const zip = new JSZip()
        zip.file(remName, blob)
        const zipBlob = await zip.generateAsync({ type: 'blob' })
        zips.push({ name: `CB${dd}${mm}${seq}.zip`, blob: zipBlob })
      }

      if (zips.length === 0) { alert('Nenhuma remessa gerada (contas não encontradas).'); return }

      // 4) Download: 1 conta => o próprio .zip; várias => .zip unificado
      if (zips.length === 1) {
        saveAs(zips[0].blob, zips[0].name)
      } else {
        const uni = new JSZip()
        zips.forEach((z) => uni.file(z.name, z.blob))
        const uniBlob = await uni.generateAsync({ type: 'blob' })
        saveAs(uniBlob, `Remessa_Prorrogacao_${dd}${mm}${now.getFullYear()}.zip`)
      }

      // 5) Move as datas no cadastro (vencimento + juros/multa/desconto) pela mesma diferença
      for (const r of selec) {
        const c = r._capt
        if (!c?.id) continue
        const delta = daysDiff(r.anterior || c.dt_venc_tit, r.nova)
        const upd = { dt_venc_tit: r.nova }
        if (delta !== 0) {
          if (c.dt_juros_tit) upd.dt_juros_tit = addDays(c.dt_juros_tit, delta)
          if (c.data_multa) upd.data_multa = addDays(c.data_multa, delta)
          if (c.dt_desct_tit_1) upd.dt_desct_tit_1 = addDays(c.dt_desct_tit_1, delta)
          if (c.dt_desct_tit_2) upd.dt_desct_tit_2 = addDays(c.dt_desct_tit_2, delta)
          if (c.dt_desct_tit_3) upd.dt_desct_tit_3 = addDays(c.dt_desct_tit_3, delta)
        }
        try { await supabase.from('capt_registrado').update(upd).eq('id', c.id) } catch (e) { /* best-effort */ }
      }

      alert(`Remessa(s) de prorrogação gerada(s): ${zips.length} arquivo(s) .zip.`)
      setShowRemessaPR(false)
    } catch (e) {
      alert('Erro ao gerar remessa de prorrogação: ' + (e?.message || String(e)))
    } finally {
      setGerandoRem(false)
    }
  }

  const th = 'text-left px-3 py-2 font-semibold text-[#a3a3a3] uppercase text-xs whitespace-nowrap'
  const td = 'px-3 py-2 whitespace-nowrap border-t border-[#1f1f1f]'
  const thc = 'cursor-pointer select-none hover:text-white'

  return (
    <div className="text-white">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold">Sincronizar</h1>
          <p className="text-sm text-[#a3a3a3]">
            OPEITE (exceto STATUS DC) ·{' '}
            {firebirdConfig.enabled
              ? <span className="text-green-400">Firebird</span>
              : <span className="text-yellow-400">Supabase (Firebird desativado)</span>}
            {loading && <span className="text-[#666666]"> · carregando {progresso} registros…</span>}
            {!loading && <span className="text-[#666666]"> · {rawRows.length} carregados · {rowsOrdenados.length} exibidos</span>}
            {enriching && <span className="text-[#666666]"> · buscando nomes…</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowAcoes((x) => !x)}
              disabled={exportando}
              className={`px-3 py-2 rounded border text-sm ${showAcoes ? 'bg-white text-black border-white' : 'bg-[#1a1a1a] border-[#2a2a2a] hover:bg-[#222]'} ${exportando ? 'opacity-60 cursor-wait' : ''}`}
            >{exportando ? 'Exportando…' : 'Ações'}</button>
            {showAcoes && (
              <div className="absolute right-0 mt-1 w-72 bg-[#111111] border border-[#2a2a2a] rounded-lg shadow-lg z-20 p-1">
                <button
                  onClick={exportarRegistradosCO}
                  disabled={exportando || loading}
                  className="w-full text-left px-3 py-2 text-sm rounded hover:bg-[#1f1f1f] disabled:opacity-50"
                >Exportar Registrados com status CO em OPEITE</button>
                <button
                  onClick={abrirProrrogacao}
                  disabled={exportando || loading}
                  className="w-full text-left px-3 py-2 text-sm rounded hover:bg-[#1f1f1f] disabled:opacity-50"
                >Registros com prorrogação</button>
                <button
                  onClick={abrirRemessaProrrogacao}
                  disabled={exportando || loading}
                  className="w-full text-left px-3 py-2 text-sm rounded hover:bg-[#1f1f1f] disabled:opacity-50"
                >Remessa Prorrogação</button>
              </div>
            )}
          </div>
          <button
            onClick={() => setShowFiltro((x) => !x)}
            className={`px-3 py-2 rounded border text-sm ${showFiltro ? 'bg-white text-black border-white' : 'bg-[#1a1a1a] border-[#2a2a2a] hover:bg-[#222]'}`}
          >Filtro</button>
        </div>
      </div>

      {erro && <div className="mb-3 text-sm text-red-400">Erro: {erro}</div>}

      {showFiltro && (
        <div className="mb-4 p-4 bg-[#111111] border border-[#1f1f1f] rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <label className="block text-xs text-[#666666] uppercase mb-1">Vencimento (DT_VENCI)</label>
            <div className="flex gap-2">
              <input type="date" value={f.vencDe} onChange={(e) => setF({ ...f, vencDe: e.target.value })} className="bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-1 w-full" />
              <input type="date" value={f.vencAte} onChange={(e) => setF({ ...f, vencAte: e.target.value })} className="bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-1 w-full" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#666666] uppercase mb-1">Lançamento (DT_LANCA)</label>
            <div className="flex gap-2">
              <input type="date" value={f.lancaDe} onChange={(e) => setF({ ...f, lancaDe: e.target.value })} className="bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-1 w-full" />
              <input type="date" value={f.lancaAte} onChange={(e) => setF({ ...f, lancaAte: e.target.value })} className="bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-1 w-full" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#666666] uppercase mb-1">Nº Lançamento (intervalo)</label>
            <div className="flex gap-2">
              <input type="number" placeholder="de" value={f.numDe} onChange={(e) => setF({ ...f, numDe: e.target.value })} className="bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-1 w-full" />
              <input type="number" placeholder="até" value={f.numAte} onChange={(e) => setF({ ...f, numAte: e.target.value })} className="bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-1 w-full" />
            </div>
          </div>
          <div className="sm:col-span-3 flex items-center justify-between">
            <label className="flex items-center gap-2 text-[#a3a3a3]">
              <input type="checkbox" checked={f.debitavel} onChange={(e) => setF({ ...f, debitavel: e.target.checked })} />
              Debitável <span className="text-[#666666]">(desmarcado = só sem linha digitável)</span>
            </label>
            <button onClick={() => setF(F0)} className="px-3 py-1 rounded bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222]">Limpar</button>
          </div>
        </div>
      )}

      <div className="overflow-auto max-h-[70vh] border border-[#1f1f1f] rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-[#111111] sticky top-0 z-10">
            <tr>
              <th className={`${th} ${thc}`} onClick={() => toggleSort('lanc')}>LANC{arrow('lanc')}</th>
              <th className={`${th} ${thc}`} onClick={() => toggleSort('nosso')}>Nosso Número{arrow('nosso')}</th>
              <th className={`${th} ${thc}`} onClick={() => toggleSort('doc')}>Documento{arrow('doc')}</th>
              <th className={`${th} text-right ${thc}`} onClick={() => toggleSort('valor')}>Valor{arrow('valor')}</th>
              <th className={`${th} ${thc}`} onClick={() => toggleSort('venc')}>Vencimento{arrow('venc')}</th>
              <th className={`${th} ${thc}`} onClick={() => toggleSort('nome')}>Nome{arrow('nome')}</th>
              <th className={`${th} ${thc}`} onClick={() => toggleSort('cic')}>CIC{arrow('cic')}</th>
              <th className={`${th} ${thc}`} onClick={() => toggleSort('linha')}>Linha Digitável{arrow('linha')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td className={td} colSpan={8}>Carregando OPEITE do Firebird… {progresso} registros</td></tr>
            )}
            {!loading && rowsOrdenados.length === 0 && (
              <tr><td className={td} colSpan={8}>Nenhum registro para o filtro atual.</td></tr>
            )}
            {!loading && rowsOrdenados.map((r, i) => (
              <tr key={`${r.lanc}-${i}`} className="hover:bg-[#0d0d0d]">
                <td className={td}>{r.lanc}</td>
                <td className={td}>{r.nosso}</td>
                <td className={td}>{r.doc}</td>
                <td className={`${td} text-right`}>{fmtValor(r.valor)}</td>
                <td className={td}>{fmtData(r.venc)}</td>
                <td className={td}>{r.nome}</td>
                <td className={td}>{r.cic}</td>
                <td className={td}>{r.linha}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showProrrogacao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowProrrogacao(false)}>
          <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg w-full max-w-5xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f1f1f]">
              <div>
                <h2 className="text-white font-semibold">Registros com prorrogação</h2>
                <p className="text-xs text-[#666666]">OPEITE STATUS=PR com correspondência em capt_registrado (por Nº de lançamento) · {prRegistros.length} registro(s)</p>
              </div>
              <button onClick={() => setShowProrrogacao(false)} className="text-[#666666] hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="bg-[#111111] sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 w-8">
                      <input type="checkbox"
                        checked={prRegistros.length > 0 && prSel.length > 0 && prSel.every(Boolean)}
                        onChange={(e) => setPrSel(prRegistros.map(() => e.target.checked))} />
                    </th>
                    <th className={th}>Nº Lançamento</th>
                    <th className={th}>Número</th>
                    <th className={th}>Nosso Número</th>
                    <th className={th}>Nome</th>
                    <th className={th}>CIC</th>
                    <th className={`${th} text-right`}>Valor</th>
                    <th className={th}>Venc. CAPT</th>
                    <th className={th}>Venc. Efactor</th>
                    <th className={th}>Venc. Efactor Novo</th>
                  </tr>
                </thead>
                <tbody>
                  {prRegistros.length === 0 && (
                    <tr><td className={td} colSpan={10}>{carregandoPR ? 'Carregando…' : 'Nenhum registro com prorrogação e correspondência encontrado.'}</td></tr>
                  )}
                  {prRegistros.map((r, i) => (
                    <tr key={`${r.lanc}-${i}`} className="hover:bg-[#0d0d0d]">
                      <td className="px-3 py-2 border-t border-[#1f1f1f]">
                        <input type="checkbox" checked={!!prSel[i]}
                          onChange={() => setPrSel((prev) => prev.map((v, j) => (j === i ? !v : v)))} />
                      </td>
                      <td className={td}>{r.lanc}</td>
                      <td className={td}>{r.numero}</td>
                      <td className={td}>{r.nosso}</td>
                      <td className={td}>{r.nome}</td>
                      <td className={td}>{r.cic}</td>
                      <td className={`${td} text-right`}>{fmtValor(r.valor)}</td>
                      <td className={td}>{fmtData(r.vencCapt)}</td>
                      <td className={td}>{fmtData(r.vencEfactor)}</td>
                      <td className={td}>{fmtData(r.vencEfactorNovo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#1f1f1f]">
              <span className="text-xs text-[#666666]">{prSel.filter(Boolean).length} selecionado(s)</span>
              <div className="flex gap-2">
                <button onClick={() => setShowProrrogacao(false)} className="px-3 py-2 rounded border border-[#2a2a2a] text-sm hover:bg-[#1a1a1a]">Fechar</button>
                <button onClick={exportarProrrogacao} disabled={prSel.filter(Boolean).length === 0}
                  className="px-3 py-2 rounded border border-white bg-white text-black text-sm hover:bg-[#e5e5e5] disabled:opacity-50">Exportar Excel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRemessaPR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !gerandoRem && setShowRemessaPR(false)}>
          <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg w-full max-w-5xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f1f1f]">
              <div>
                <h2 className="text-white font-semibold">Remessa Prorrogação (CNAB400 · alteração)</h2>
                <p className="text-xs text-[#666666]">Altera o vencimento (ocorrência 06) · 1 arquivo .rem/.zip por conta · edite a nova data se necessário</p>
              </div>
              <button onClick={() => !gerandoRem && setShowRemessaPR(false)} className="text-[#666666] hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="bg-[#111111] sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 w-8">
                      <input type="checkbox"
                        checked={remRows.length > 0 && remRows.every((r) => r.sel)}
                        onChange={(e) => setRemRows((prev) => prev.map((r) => ({ ...r, sel: e.target.checked })))} />
                    </th>
                    <th className={th}>Nº Lançamento</th>
                    <th className={th}>Número</th>
                    <th className={th}>Nosso Número</th>
                    <th className={th}>Nome</th>
                    <th className={th}>CIC</th>
                    <th className={`${th} text-right`}>Valor</th>
                    <th className={th}>Venc. anterior</th>
                    <th className={th}>Nova data</th>
                  </tr>
                </thead>
                <tbody>
                  {remRows.length === 0 && (
                    <tr><td className={td} colSpan={9}>Nenhum título para gerar remessa.</td></tr>
                  )}
                  {remRows.map((r, i) => (
                    <tr key={`${r.lanc}-${i}`} className="hover:bg-[#0d0d0d]">
                      <td className="px-3 py-2 border-t border-[#1f1f1f]">
                        <input type="checkbox" checked={!!r.sel}
                          onChange={() => setRemRows((prev) => prev.map((x, j) => (j === i ? { ...x, sel: !x.sel } : x)))} />
                      </td>
                      <td className={td}>{r.lanc}</td>
                      <td className={td}>{r.numero}</td>
                      <td className={td}>{r.nosso}</td>
                      <td className={td}>{r.nome}</td>
                      <td className={td}>{r.cic}</td>
                      <td className={`${td} text-right`}>{fmtValor(r.valor)}</td>
                      <td className={td}>{fmtData(r.anterior)}</td>
                      <td className={td}>
                        <input type="date" value={r.nova}
                          onChange={(e) => setRemRows((prev) => prev.map((x, j) => (j === i ? { ...x, nova: e.target.value } : x)))}
                          className="bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-1 text-white" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#1f1f1f]">
              <span className="text-xs text-[#666666]">{remRows.filter((r) => r.sel).length} selecionado(s) · gera 1 .zip por conta</span>
              <div className="flex gap-2">
                <button onClick={() => setShowRemessaPR(false)} disabled={gerandoRem} className="px-3 py-2 rounded border border-[#2a2a2a] text-sm hover:bg-[#1a1a1a] disabled:opacity-50">Fechar</button>
                <button onClick={gerarRemessaProrrogacao} disabled={gerandoRem || remRows.filter((r) => r.sel).length === 0}
                  className="px-3 py-2 rounded border border-white bg-white text-black text-sm hover:bg-[#e5e5e5] disabled:opacity-50">{gerandoRem ? 'Gerando…' : 'Gerar remessa'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
