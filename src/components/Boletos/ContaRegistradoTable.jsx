import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'

// Colunas de capt_registrado (84 campos do Relatório de Gestão de Boletos).
// key = coluna no Supabase | label = rótulo original do Excel.
const COLUMNS = [
  { key: 'num_lanca', label: 'Nº Lançamento' },
  { key: 'doc_federal_titular', label: 'Documento federal do titular da conta' },
  { key: 'nome_titular', label: 'Nome do titular da conta' },
  { key: 'cod_cedente_titular', label: 'Código cedente do titular da conta' },
  { key: 'banco_titular', label: 'Banco do titular' },
  { key: 'agencia_titular', label: 'Agência do titular' },
  { key: 'conta_titular', label: 'Número da conta do titular' },
  { key: 'situacao_boleto', label: 'Status do boleto' },
  { key: 'identd_nosso_num', label: 'Nosso número' },
  { key: 'num_doc_tit', label: 'Seu número' },
  { key: 'numero_documento', label: 'Número do documento' },
  { key: 'nom_rz_soc_pagdr', label: 'Nome do pagador' },
  { key: 'cnpj_cpf_pagdr', label: 'Documento federal do pagador' },
  { key: 'cep_pagdr', label: 'CEP do pagador' },
  { key: 'lograd_pagdr', label: 'Logradouro do pagador' },
  { key: 'numero_endereco_pagdr', label: 'Número do endereço do pagador' },
  { key: 'complemento_endereco_pagdr', label: 'Complemento do endereço do pagador' },
  { key: 'cid_pagdr', label: 'Cidade do pagador' },
  { key: 'uf_pagdr', label: 'UF do pagador' },
  { key: 'email_pagdr', label: 'Email do pagador' },
  { key: 'telefone_pagdr', label: 'Telefone do pagador' },
  { key: 'dt_ems_tit', label: 'Data de emissão' },
  { key: 'dt_inclusao', label: 'Data de registro' },
  { key: 'vlr_tit', label: 'Valor do título' },
  { key: 'dt_venc_tit', label: 'Data de vencimento' },
  { key: 'dt_lim_pgto_tit', label: 'Data limite de pagamento' },
  { key: 'tipo_boleto', label: 'Tipo de boleto' },
  { key: 'num_linha_digtvl', label: 'Linha digitável' },
  { key: 'emv', label: 'PIX copia e cola' },
  { key: 'cod_cart_tit', label: 'Carteira' },
  { key: 'nome_sacador_avalista', label: 'Beneficiário final (sacador avalista)' },
  { key: 'parametrizacao_multa', label: 'Parametrização multa' },
  { key: 'valor_multa', label: 'Valor de multa' },
  { key: 'data_multa', label: 'Data multa' },
  { key: 'cod_juros_tit', label: 'Parametrização juros' },
  { key: 'vlr_perc_juros_tit', label: 'Valor de juros' },
  { key: 'dt_juros_tit', label: 'Data juros' },
  { key: 'cod_desct_tit_1', label: 'Parametrização desconto (primeira faixa)' },
  { key: 'vlr_perc_desct_tit_1', label: 'Valor de desconto (primeira faixa)' },
  { key: 'dt_desct_tit_1', label: 'Data de desconto (primeira faixa)' },
  { key: 'cod_desct_tit_2', label: 'Parametrização desconto (segunda faixa)' },
  { key: 'vlr_perc_desct_tit_2', label: 'Valor de desconto (segunda faixa)' },
  { key: 'dt_desct_tit_2', label: 'Data de desconto (segunda faixa)' },
  { key: 'cod_desct_tit_3', label: 'Parametrização desconto (terceira faixa)' },
  { key: 'vlr_perc_desct_tit_3', label: 'Valor de desconto (terceira faixa)' },
  { key: 'dt_desct_tit_3', label: 'Data de desconto (terceira faixa)' },
  { key: 'vlr_abatt_tit', label: 'Abatimento' },
  { key: 'vlr_baixa_operac_tit', label: 'Valor pago' },
  { key: 'dt_pagamento', label: 'Data de pagamento' },
  { key: 'dt_credito_boleto', label: 'Data do crédito' },
  { key: 'canal_pagamento', label: 'Canal do pagamento' },
  { key: 'cod_esp_tit', label: 'Espécie' },
  { key: 'modalidade', label: 'Modalidade' },
  { key: 'descricao', label: 'Descrição' },
  { key: 'cobranca_compartilhada', label: 'Cobrança compartilhada' },
  { key: 'benef1_nome', label: 'Nome do beneficiário 1 de cobrança compartilhada' },
  { key: 'benef1_doc_federal', label: 'Documento federal do beneficiário 1 de cobrança compartilhada' },
  { key: 'benef1_cod_cedente', label: 'Código cedente de beneficiário 1' },
  { key: 'benef1_conta', label: 'Conta do beneficiário 1 de cobrança compartilhada' },
  { key: 'benef1_percentual', label: 'Percentual para beneficiário 1' },
  { key: 'benef2_nome', label: 'Nome do beneficiário 2 de cobrança compartilhada' },
  { key: 'benef2_doc_federal', label: 'Documento federal do beneficiário 2 de cobrança compartilhada' },
  { key: 'benef2_cod_cedente', label: 'Código cedente de beneficiário 2' },
  { key: 'benef2_conta', label: 'Conta do beneficiário 2 de cobrança compartilhada' },
  { key: 'benef2_percentual', label: 'Percentual para beneficiário 2' },
  { key: 'benef3_nome', label: 'Nome do beneficiário 3 de cobrança compartilhada' },
  { key: 'benef3_doc_federal', label: 'Documento federal do beneficiário 3 de cobrança compartilhada' },
  { key: 'benef3_cod_cedente', label: 'Código cedente de beneficiário 3' },
  { key: 'benef3_conta', label: 'Conta do beneficiário 3 de cobrança compartilhada' },
  { key: 'benef3_percentual', label: 'Percentual para beneficiário 3' },
  { key: 'benef4_nome', label: 'Nome do beneficiário 4 de cobrança compartilhada' },
  { key: 'benef4_doc_federal', label: 'Documento federal do beneficiário 4 de cobrança compartilhada' },
  { key: 'benef4_cod_cedente', label: 'Código cedente de beneficiário 4' },
  { key: 'benef4_conta', label: 'Conta do beneficiário 4 de cobrança compartilhada' },
  { key: 'benef4_percentual', label: 'Percentual para beneficiário 4' },
  { key: 'benef5_nome', label: 'Nome do beneficiário 5 de cobrança compartilhada' },
  { key: 'benef5_doc_federal', label: 'Documento federal do beneficiário 5 de cobrança compartilhada' },
  { key: 'benef5_cod_cedente', label: 'Código cedente de beneficiário 5' },
  { key: 'benef5_conta', label: 'Conta do beneficiário 5 de cobrança compartilhada' },
  { key: 'benef5_percentual', label: 'Percentual para beneficiário 5' },
  { key: 'status_negociacao', label: 'Status de negociação' },
  { key: 'data_ultima_instrucao', label: 'Data da última instrução' },
  { key: 'canal_instrucao', label: 'Canal de instrução' },
  { key: 'ultima_instrucao', label: 'Última instrução' },
  { key: 'usuario_ultima_instrucao', label: 'Usuário da última instrução' },
]

// Colunas ocultas no Modo Conta Capt (definição completa mantida acima)
const HIDDEN_KEYS = new Set([
  'doc_federal_titular', 'nome_titular', 'cod_cedente_titular',
  'banco_titular', 'agencia_titular', 'conta_titular',
  'cep_pagdr', 'lograd_pagdr', 'numero_endereco_pagdr', 'complemento_endereco_pagdr',
  'cid_pagdr', 'uf_pagdr', 'email_pagdr', 'telefone_pagdr',
  'tipo_boleto', 'emv', 'cod_cart_tit', 'cod_esp_tit',
  'cobranca_compartilhada',
  'benef1_nome', 'benef1_doc_federal', 'benef1_cod_cedente', 'benef1_conta', 'benef1_percentual',
  'benef2_nome', 'benef2_doc_federal', 'benef2_cod_cedente', 'benef2_conta', 'benef2_percentual',
  'benef3_nome', 'benef3_doc_federal', 'benef3_cod_cedente', 'benef3_conta', 'benef3_percentual',
  'benef4_nome', 'benef4_doc_federal', 'benef4_cod_cedente', 'benef4_conta', 'benef4_percentual',
  'benef5_nome', 'benef5_doc_federal', 'benef5_cod_cedente', 'benef5_conta', 'benef5_percentual',
])
const VISIBLE_COLUMNS = COLUMNS.filter((c) => !HIDDEN_KEYS.has(c.key))

const SEARCH_KEYS = ['identd_nosso_num', 'num_doc_tit', 'numero_documento', 'nom_rz_soc_pagdr', 'cnpj_cpf_pagdr', 'situacao_boleto']

function fmt(value) {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

// Tabela inline de capt_registrado. Re-busca os dados quando `reloadKey` muda.
export default function ContaRegistradoTable({ reloadKey = 0 }) {
  const [registros, setRegistros] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [tick, setTick] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [showFilter, setShowFilter] = useState(false)
  // Filtro "Num Lançamento": marcado = mostra todos; desmarcado = só os SEM num_lanca
  const [filtrarComNumLanca, setFiltrarComNumLanca] = useState(true)
  const [statusOcultos, setStatusOcultos] = useState(() => new Set())
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  useEffect(() => {
    let ativo = true
    const carregar = async () => {
      setLoading(true)
      setError(null)
      // PostgREST limita ~1000 linhas por request; paginamos com range() p/ trazer tudo
      const pageSize = 1000
      let from = 0
      let todos = []
      let erro = null
      while (true) {
        const { data, error } = await supabase
          .from('capt_registrado')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1)
        if (error) { erro = error; break }
        if (!data || data.length === 0) break
        todos = todos.concat(data)
        if (data.length < pageSize) break
        from += pageSize
      }
      if (!ativo) return
      if (erro) {
        console.error('[ContaRegistrado] Erro ao carregar:', erro)
        setError(erro.message)
        setRegistros([])
      } else {
        setRegistros(todos)
      }
      setLoading(false)
    }
    carregar()
    return () => { ativo = false }
  }, [reloadKey, tick])

  const handleSync = async () => {
    setSyncing(true)
    setSyncMsg('')
    try {
      const { data, error } = await supabase.rpc('sync_num_lanca_capt_registrado')
      if (error) {
        console.error('[ContaRegistrado] Erro no sync num_lanca:', error)
        setSyncMsg('Erro ao sincronizar: ' + error.message)
      } else {
        setSyncMsg(`${data ?? 0} registro(s) preenchido(s) com Nº Lançamento.`)
        setTick((t) => t + 1)
      }
    } catch (e) {
      setSyncMsg('Erro ao sincronizar: ' + e.message)
    } finally {
      setSyncing(false)
    }
  }

  // Valores distintos de Status do boleto presentes nos dados (para o filtro)
  const statusDisponiveis = useMemo(() => {
    const set = new Set()
    registros.forEach((r) => set.add(r.situacao_boleto ?? ''))
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'))
  }, [registros])

  const toggleStatus = (valor) => {
    setStatusOcultos((prev) => {
      const next = new Set(prev)
      if (next.has(valor)) next.delete(valor)
      else next.add(valor)
      return next
    })
  }

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filtrados = useMemo(() => {
    let base = registros
    if (!filtrarComNumLanca) {
      base = base.filter((r) => r.num_lanca === null || r.num_lanca === undefined || r.num_lanca === '')
    }
    // Filtro por Status do boleto: oculta os desmarcados
    if (statusOcultos.size > 0) {
      base = base.filter((r) => !statusOcultos.has(r.situacao_boleto ?? ''))
    }
    const term = searchTerm.trim().toLowerCase()
    if (term) {
      base = base.filter((r) =>
        SEARCH_KEYS.some((k) => String(r[k] || '').toLowerCase().includes(term))
      )
    }
    // Ordenação por cabeçalho
    if (sortKey) {
      const dir = sortDir === 'asc' ? 1 : -1
      const isVazio = (v) => v === null || v === undefined || v === ''
      base = [...base].sort((ra, rb) => {
        const a = ra[sortKey], b = rb[sortKey]
        if (isVazio(a) && isVazio(b)) return 0
        if (isVazio(a)) return 1
        if (isVazio(b)) return -1
        const na = Number(a), nb = Number(b)
        const ambosNum = !isNaN(na) && !isNaN(nb) && String(a).trim() !== '' && String(b).trim() !== ''
        if (ambosNum) return (na - nb) * dir
        return String(a).localeCompare(String(b), 'pt-BR', { numeric: true }) * dir
      })
    }
    return base
  }, [registros, searchTerm, filtrarComNumLanca, statusOcultos, sortKey, sortDir])

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Buscar por nosso número, seu número, documento, pagador, CPF/CNPJ, status…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 bg-[#111111] border border-[#2a2a2a] rounded-md text-white placeholder-[#666666] focus:border-white focus:bg-[#1a1a1a] outline-none transition text-sm"
        />
        <span className="text-xs text-[#666666] whitespace-nowrap">
          {loading ? 'carregando…' : `${filtrados.length} de ${registros.length} registro(s)`}
        </span>

        {/* Sync: preenche num_lanca a partir de OPEITE (match único) */}
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing || loading}
          title="Sincronizar Nº Lançamento (OPEITE)"
          className="flex items-center gap-1.5 px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-md text-white text-sm hover:border-white hover:bg-[#1a1a1a] transition disabled:opacity-50 whitespace-nowrap"
        >
          <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {syncing ? 'Sincronizando…' : 'Sync'}
        </button>

        {/* Filtro com submenu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowFilter((v) => !v)}
            title="Filtros"
            className="flex items-center gap-1.5 px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-md text-white text-sm hover:border-white hover:bg-[#1a1a1a] transition whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L14 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 018 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            Filtro
          </button>
          {showFilter && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowFilter(false)} />
              <div className="absolute right-0 mt-1 z-20 w-64 max-h-96 overflow-auto bg-[#0f0f0f] border border-[#2a2a2a] rounded-md shadow-lg p-3">
                <p className="text-[11px] uppercase tracking-wider text-[#666666] mb-2">Filtros</p>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-white">
                  <input
                    type="checkbox"
                    checked={filtrarComNumLanca}
                    onChange={(e) => setFiltrarComNumLanca(e.target.checked)}
                    className="w-4 h-4 cursor-pointer accent-white"
                  />
                  Num Lançamento
                </label>
                <p className="text-[11px] text-[#666666] mt-2 leading-snug">
                  {filtrarComNumLanca
                    ? 'Marcado: mostra todos os registros importados.'
                    : 'Desmarcado: mostra só os sem Nº Lançamento.'}
                </p>
                <div className="my-2 border-t border-[#1f1f1f]" />
                <p className="text-[11px] uppercase tracking-wider text-[#666666] mb-2">Status do boleto</p>
                <div className="flex flex-col gap-1.5">
                  {statusDisponiveis.length === 0 && (
                    <span className="text-[11px] text-[#666666]">Sem dados.</span>
                  )}
                  {statusDisponiveis.map((st) => (
                    <label key={st || '(vazio)'} className="flex items-center gap-2 cursor-pointer text-sm text-white">
                      <input
                        type="checkbox"
                        checked={!statusOcultos.has(st)}
                        onChange={() => toggleStatus(st)}
                        className="w-4 h-4 cursor-pointer accent-white"
                      />
                      {st === '' ? '(vazio)' : st}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {syncMsg && (
        <div className="text-xs text-[#a3a3a3] -mt-1">{syncMsg}</div>
      )}

      <div className="flex-1 min-h-0 overflow-auto bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg">
        {loading ? (
          <div className="flex items-center justify-center h-full text-[#666666] text-sm">Carregando registros…</div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-[#a3a3a3] text-sm px-6 text-center">Erro ao carregar: {error}</div>
        ) : filtrados.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#666666] text-sm px-6 text-center">
            {registros.length === 0
              ? 'Nenhum registro em capt_registrado. Importe o Relatório de Gestão de Boletos (Excel) pelo card acima.'
              : 'Nenhum registro corresponde à busca.'}
          </div>
        ) : (
          <table className="text-xs text-white border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#141414]">
                {VISIBLE_COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => toggleSort(c.key)}
                    title="Ordenar"
                    className="text-left font-semibold text-[#a3a3a3] px-3 py-2 border-b border-[#2a2a2a] whitespace-nowrap cursor-pointer select-none hover:text-white"
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.label}
                      {sortKey === c.key && <span className="text-white">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r) => (
                <tr key={r.id} className="hover:bg-[#111111] border-b border-[#1a1a1a]">
                  {VISIBLE_COLUMNS.map((c) => (
                    <td key={c.key} className="px-3 py-1.5 whitespace-nowrap text-[#d4d4d4]">
                      {fmt(r[c.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
