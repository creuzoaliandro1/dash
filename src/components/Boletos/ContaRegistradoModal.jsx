import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'

// Colunas de capt_registrado (84 campos do Relatório de Gestão de Boletos).
// key = coluna no Supabase | label = rótulo original do Excel.
const COLUMNS = [
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

// Colunas exibidas com destaque/largura fixa logo no início (as demais seguem na rolagem horizontal)
const SEARCH_KEYS = ['identd_nosso_num', 'num_doc_tit', 'numero_documento', 'nom_rz_soc_pagdr', 'cnpj_cpf_pagdr', 'situacao_boleto']

function fmt(value) {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

export default function ContaRegistradoModal({ onClose }) {
  const [registros, setRegistros] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    let ativo = true
    const carregar = async () => {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('capt_registrado')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(2000)
      if (!ativo) return
      if (error) {
        console.error('[ContaRegistrado] Erro ao carregar:', error)
        setError(error.message)
        setRegistros([])
      } else {
        setRegistros(data || [])
      }
      setLoading(false)
    }
    carregar()
    return () => { ativo = false }
  }, [])

  const filtrados = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return registros
    return registros.filter((r) =>
      SEARCH_KEYS.some((k) => String(r[k] || '').toLowerCase().includes(term))
    )
  }, [registros, searchTerm])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg w-full max-w-[95vw] h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f1f1f]">
          <div>
            <h2 className="text-lg font-semibold text-white">Conta Capt — Registros</h2>
            <p className="text-xs text-[#666666] mt-0.5">
              Tabela capt_registrado · {loading ? 'carregando…' : `${filtrados.length} de ${registros.length} registro(s)`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-[#1a1a1a] text-white text-sm border border-[#2a2a2a] rounded hover:bg-[#222222] transition"
          >
            Fechar
          </button>
        </div>

        {/* Busca */}
        <div className="px-6 py-3 border-b border-[#1f1f1f]">
          <input
            type="text"
            placeholder="Buscar por nosso número, seu número, documento, pagador, CPF/CNPJ, status…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 bg-[#111111] border border-[#2a2a2a] rounded-md text-white placeholder-[#666666] focus:border-white focus:bg-[#1a1a1a] outline-none transition text-sm"
          />
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-h-0 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full text-[#666666] text-sm">Carregando registros…</div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-[#a3a3a3] text-sm px-6 text-center">
              Erro ao carregar: {error}
            </div>
          ) : filtrados.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[#666666] text-sm">
              {registros.length === 0 ? 'Nenhum registro em capt_registrado.' : 'Nenhum registro corresponde à busca.'}
            </div>
          ) : (
            <table className="text-xs text-white border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#141414]">
                  {COLUMNS.map((c) => (
                    <th
                      key={c.key}
                      className="text-left font-semibold text-[#a3a3a3] px-3 py-2 border-b border-[#2a2a2a] whitespace-nowrap"
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((r) => (
                  <tr key={r.id} className="hover:bg-[#111111] border-b border-[#1a1a1a]">
                    {COLUMNS.map((c) => (
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
    </div>
  )
}
