import { useState } from 'react'
import FileAttachment from './FileAttachment'

// Converte registro snake_case do banco para chaves UPPERCASE do formulário
const boletoToFormData = (b) => ({
  EMISSAO:          b.data_emissao          || '',
  NUM_TITULO:       b.numero_documento      || '',
  VENCIMENTO:       b.data_vencimento       || '',
  DATA_LIMITE_PGTO: b.data_limite_pagamento || '',
  VALOR:            b.valor                 ?? '',
  NOSSO_NUMERO:     b.nosso_numero          || '',
  ESPECIE_TITULO:   b.especie_titulo        ?? 2,
  NUMERO_CARTEIRA:  b.numero_carteira       ?? 1,
  ABATIMENTO:       b.valor_abatimento      ?? '',
  SACADO_TIPO_PESSOA: b.sacado_tipo_pessoa  ?? '',
  SACADO_NOME:      b.sacado_nome           || '',
  SACADO_CIC:       b.sacado_cic            || '',
  SACADO_CEP:       b.sacado_cep            || '',
  SACADO_ENDERECO:  b.sacado_endereco       || '',
  SACADO_NUMERO:    b.sacado_numero         || '',
  SACADO_COMPLEMENTO: b.sacado_complemento  || '',
  SACADO_BAIRRO:    b.sacado_bairro         || '',
  SACADO_CIDADE:    b.sacado_cidade         || '',
  SACADO_UF:        b.sacado_uf             || '',
  SACADO_EMAIL:     b.sacado_email          || '',
  SACADO_TELEFONE:  b.sacado_telefone       || '',
  AVALISTA_TIPO:    b.avalista_tipo         ?? '',
  AVALISTA:         b.avalista_nome         || '',
  AVALISTA_CIC:     b.avalista_cic          || '',
  JUROS_TIPO:       b.juros_codigo          || '3',
  JUROS_DATA:       b.juros_data            || '',
  JUROS_VALOR:      b.juros_valor           ?? '',
  MULTA_TIPO:       b.multa_codigo          || '3',
  MULTA_DATA:       b.multa_data            || '',
  MULTA_VALOR:      b.multa                 ?? '',
  DESCONTO_TIPO:    b.desconto_codigo       || '0',
  DESCONTO_DATA:    b.desconto_data         || '',
  DESCONTO_VALOR:   b.desconto              ?? '',
  DESCONTO2_TIPO:   b.desconto2_codigo      || '0',
  DESCONTO2_DATA:   b.desconto2_data        || '',
  DESCONTO2_VALOR:  b.desconto2_valor       ?? '',
  DESCONTO3_TIPO:   b.desconto3_codigo      || '0',
  DESCONTO3_DATA:   b.desconto3_data        || '',
  DESCONTO3_VALOR:  b.desconto3_valor       ?? '',
  MENSAGEM1:        b.mensagem1             || '',
  MENSAGEM2:        b.mensagem2             || '',
  MENSAGEM3:        b.mensagem3             || '',
  DESCRICAO:        b.descricao             || '',
  STATUS:           b.status                || 'pendente',
  SITUACAO:         b.situacao              || '',
})

const emptyFormData = {
  EMISSAO: '', NUM_TITULO: '', VENCIMENTO: '', DATA_LIMITE_PGTO: '', VALOR: '',
  NOSSO_NUMERO: '', ESPECIE_TITULO: 2, NUMERO_CARTEIRA: 1, ABATIMENTO: '',
  SACADO_TIPO_PESSOA: '', SACADO_NOME: '', SACADO_CIC: '', SACADO_CEP: '',
  SACADO_ENDERECO: '', SACADO_NUMERO: '', SACADO_COMPLEMENTO: '', SACADO_BAIRRO: '',
  SACADO_CIDADE: '', SACADO_UF: '', SACADO_EMAIL: '', SACADO_TELEFONE: '',
  AVALISTA_TIPO: '', AVALISTA: '', AVALISTA_CIC: '',
  JUROS_TIPO: '3', JUROS_DATA: '', JUROS_VALOR: '',
  MULTA_TIPO: '3', MULTA_DATA: '', MULTA_VALOR: '',
  DESCONTO_TIPO: '0', DESCONTO_DATA: '', DESCONTO_VALOR: '',
  DESCONTO2_TIPO: '0', DESCONTO2_DATA: '', DESCONTO2_VALOR: '',
  DESCONTO3_TIPO: '0', DESCONTO3_DATA: '', DESCONTO3_VALOR: '',
  MENSAGEM1: '', MENSAGEM2: '', MENSAGEM3: '',
  DESCRICAO: '',
  // Boleto digitado nasce como "Gravado" (só vira "Registrado" via relatório BTG)
  STATUS: 'pendente', SITUACAO: 'Gravado',
}

// Espécies de título (codEspTit - FEBRABAN). Subconjunto mais usado.
const ESPECIES = [
  [1, 'CH - Cheque'],
  [2, 'DM - Duplicata Mercantil'],
  [4, 'DS - Duplicata de Serviço'],
  [6, 'DR - Duplicata Rural'],
  [7, 'LC - Letra de Câmbio'],
  [12, 'NP - Nota Promissória'],
  [17, 'RC - Recibo'],
  [18, 'FAT - Fatura/Bloqueto'],
  [19, 'ND - Nota de Débito'],
  [99, 'Outros'],
]

const inputCls = 'w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white focus:bg-[#1a1a1a] outline-none transition'
const labelCls = 'block text-xs font-medium text-[#a3a3a3] mb-1.5'

export default function BoletoFormModal({ boleto, onSave, onClose, contaId }) {
  const [formData, setFormData] = useState(
    boleto ? boletoToFormData(boleto) : emptyFormData
  )
  // Arquivos selecionados para um boleto NOVO (ainda sem id). Enviados ao salvar.
  const [pendingFiles, setPendingFiles] = useState([])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleAddPendingFiles = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) setPendingFiles(prev => [...prev, ...files])
    e.target.value = ''
  }

  const handleRemovePendingFile = (index) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
  }

  const formatarTamanho = (bytes) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(formData, boleto ? [] : pendingFiles)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#1f1f1f] sticky top-0 bg-[#0a0a0a] z-10">
          <h2 className="text-xl font-semibold text-white">
            {boleto ? 'Editar Boleto' : 'Emitir Novo Boleto'}
          </h2>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-[#a3a3a3] hover:text-white hover:bg-[#1a1a1a] rounded transition"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Seção: Datas */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wide">Datas</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>EMISSÃO</label>
                <input type="date" name="EMISSAO" value={formData.EMISSAO} onChange={handleChange} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>VENCIMENTO</label>
                <input type="date" name="VENCIMENTO" value={formData.VENCIMENTO} onChange={handleChange} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>DATA LIMITE PGTO</label>
                <input type="date" name="DATA_LIMITE_PGTO" value={formData.DATA_LIMITE_PGTO} onChange={handleChange} className={inputCls} />
              </div>
            </div>
          </div>

          {/* Seção: Documento e Valores */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wide">Documento e Valores</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>NÚM. TÍTULO</label>
                <input type="text" name="NUM_TITULO" value={formData.NUM_TITULO} onChange={handleChange} placeholder="DOC-123456" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>VALOR</label>
                <input type="number" name="VALOR" value={formData.VALOR} onChange={handleChange} placeholder="0.00" step="0.01" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>NOSSO Nº</label>
                <input type="text" name="NOSSO_NUMERO" value={formData.NOSSO_NUMERO} onChange={handleChange} placeholder="Gerado ao salvar" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>ESPÉCIE DO TÍTULO</label>
                <select name="ESPECIE_TITULO" value={formData.ESPECIE_TITULO} onChange={handleChange} className={inputCls}>
                  {ESPECIES.map(([code, label]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>CARTEIRA</label>
                <select name="NUMERO_CARTEIRA" value={formData.NUMERO_CARTEIRA} onChange={handleChange} className={inputCls}>
                  <option value={1}>1 - Boleto simples</option>
                  <option value={9}>9 - CNAB</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>ABATIMENTO R$</label>
                <input type="number" name="ABATIMENTO" value={formData.ABATIMENTO} onChange={handleChange} placeholder="0.00" step="0.01" className={inputCls} />
              </div>
            </div>
          </div>

          {/* Seção: Sacado (Pagador) */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wide">Sacado / Pagador</h3>
            <div className="space-y-4">
              {/* Linha 1: Nome + CIC/CNPJ */}
              <div className="flex gap-4">
                <div className="flex-[4] min-w-0">
                  <label className={labelCls}>NOME</label>
                  <input type="text" name="SACADO_NOME" value={formData.SACADO_NOME} onChange={handleChange} placeholder="Agro Plantar Ltda" className={inputCls} />
                </div>
                <div className="flex-1 min-w-0">
                  <label className={labelCls}>CIC / CNPJ</label>
                  <input type="text" name="SACADO_CIC" value={formData.SACADO_CIC} onChange={handleChange} placeholder="89.012.345/0001-34" className={inputCls} />
                </div>
              </div>
              {/* Linha 2: Endereço + NÚM + Bairro + CEP + Cidade + UF */}
              <div className="flex gap-4">
                <div className="flex-[2] min-w-0">
                  <label className={labelCls}>ENDEREÇO</label>
                  <input type="text" name="SACADO_ENDERECO" value={formData.SACADO_ENDERECO} onChange={handleChange} placeholder="Rua..." className={inputCls} />
                </div>
                <div className="flex-1 min-w-0">
                  <label className={labelCls}>NÚM.</label>
                  <input type="text" name="SACADO_NUMERO" value={formData.SACADO_NUMERO} onChange={handleChange} placeholder="123" className={inputCls} />
                </div>
                <div className="flex-1 min-w-0">
                  <label className={labelCls}>BAIRRO</label>
                  <input type="text" name="SACADO_BAIRRO" value={formData.SACADO_BAIRRO} onChange={handleChange} placeholder="Centro" className={inputCls} />
                </div>
                <div className="flex-1 min-w-0">
                  <label className={labelCls}>CEP</label>
                  <input type="text" name="SACADO_CEP" value={formData.SACADO_CEP} onChange={handleChange} placeholder="00000-000" className={inputCls} />
                </div>
                <div className="flex-[0.7] min-w-0">
                  <label className={labelCls}>CIDADE</label>
                  <input type="text" name="SACADO_CIDADE" value={formData.SACADO_CIDADE} onChange={handleChange} placeholder="São Paulo" className={inputCls} />
                </div>
                <div className="flex-[0.3] min-w-0">
                  <label className={labelCls}>UF</label>
                  <input type="text" name="SACADO_UF" value={formData.SACADO_UF} onChange={handleChange} placeholder="SP" maxLength="2" className={inputCls} />
                </div>
              </div>
              {/* Linha 3: Tipo Pessoa + Complemento + Email + Telefone */}
              <div className="flex gap-4">
                <div className="flex-1 min-w-0">
                  <label className={labelCls}>TIPO PESSOA</label>
                  <select name="SACADO_TIPO_PESSOA" value={formData.SACADO_TIPO_PESSOA} onChange={handleChange} className={inputCls}>
                    <option value="">—</option>
                    <option value={1}>Física</option>
                    <option value={2}>Jurídica</option>
                  </select>
                </div>
                <div className="flex-1 min-w-0">
                  <label className={labelCls}>COMPLEMENTO</label>
                  <input type="text" name="SACADO_COMPLEMENTO" value={formData.SACADO_COMPLEMENTO} onChange={handleChange} placeholder="Sala 2" className={inputCls} />
                </div>
                <div className="flex-[1.5] min-w-0">
                  <label className={labelCls}>EMAIL</label>
                  <input type="email" name="SACADO_EMAIL" value={formData.SACADO_EMAIL} onChange={handleChange} placeholder="cliente@email.com" className={inputCls} />
                </div>
                <div className="flex-1 min-w-0">
                  <label className={labelCls}>TELEFONE</label>
                  <input type="text" name="SACADO_TELEFONE" value={formData.SACADO_TELEFONE} onChange={handleChange} placeholder="(11) 90000-0000" className={inputCls} />
                </div>
              </div>
            </div>
          </div>

          {/* Seção: Avalista (Sacador Avalista) */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wide">Sacador Avalista</h3>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className={labelCls}>TIPO</label>
                <select name="AVALISTA_TIPO" value={formData.AVALISTA_TIPO} onChange={handleChange} className={inputCls}>
                  <option value="">—</option>
                  <option value={0}>Isento</option>
                  <option value={1}>CPF</option>
                  <option value={2}>CNPJ</option>
                  <option value={3}>PIS/PASEP</option>
                  <option value={9}>Outros</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>NOME</label>
                <input type="text" name="AVALISTA" value={formData.AVALISTA} onChange={handleChange} placeholder="Nome do avalista" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>IDENTIFICADOR (CIC/CNPJ)</label>
                <input type="text" name="AVALISTA_CIC" value={formData.AVALISTA_CIC} onChange={handleChange} placeholder="CPF ou CNPJ" className={inputCls} />
              </div>
            </div>
          </div>

          {/* Seção: Juros */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wide">Juros</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>TIPO</label>
                <select name="JUROS_TIPO" value={formData.JUROS_TIPO} onChange={handleChange} className={inputCls}>
                  <option value="3">Isento</option>
                  <option value="1">Valor por dia (R$)</option>
                  <option value="2">Taxa mensal (%)</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>DATA INÍCIO</label>
                <input type="date" name="JUROS_DATA" value={formData.JUROS_DATA} onChange={handleChange} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>VALOR / %</label>
                <input type="number" name="JUROS_VALOR" value={formData.JUROS_VALOR} onChange={handleChange} placeholder="0.00" step="0.01" className={inputCls} />
              </div>
            </div>
          </div>

          {/* Seção: Multa */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wide">Multa</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>TIPO</label>
                <select name="MULTA_TIPO" value={formData.MULTA_TIPO} onChange={handleChange} className={inputCls}>
                  <option value="3">Isento</option>
                  <option value="1">Valor fixo (R$)</option>
                  <option value="2">Percentual (%)</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>DATA APLICAÇÃO</label>
                <input type="date" name="MULTA_DATA" value={formData.MULTA_DATA} onChange={handleChange} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>VALOR / %</label>
                <input type="number" name="MULTA_VALOR" value={formData.MULTA_VALOR} onChange={handleChange} placeholder="0.00" step="0.01" className={inputCls} />
              </div>
            </div>
          </div>

          {/* Seção: Descontos (até 3 faixas) */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wide">Descontos</h3>
            <div className="space-y-3">
              {[1, 2, 3].map((n) => {
                const tipo = n === 1 ? 'DESCONTO_TIPO' : `DESCONTO${n}_TIPO`
                const data = n === 1 ? 'DESCONTO_DATA' : `DESCONTO${n}_DATA`
                const valor = n === 1 ? 'DESCONTO_VALOR' : `DESCONTO${n}_VALOR`
                return (
                  <div key={n} className="grid grid-cols-[28px_1fr_1fr_1fr] gap-4 items-end">
                    <span className="text-[#666666] text-sm pb-2">{n}</span>
                    <div>
                      {n === 1 && <label className={labelCls}>TIPO</label>}
                      <select name={tipo} value={formData[tipo]} onChange={handleChange} className={inputCls}>
                        <option value="0">Sem desconto</option>
                        <option value="1">Valor fixo (R$)</option>
                        <option value="2">Percentual (%)</option>
                      </select>
                    </div>
                    <div>
                      {n === 1 && <label className={labelCls}>DATA LIMITE</label>}
                      <input type="date" name={data} value={formData[data]} onChange={handleChange} className={inputCls} />
                    </div>
                    <div>
                      {n === 1 && <label className={labelCls}>VALOR / %</label>}
                      <input type="number" name={valor} value={formData[valor]} onChange={handleChange} placeholder="0.00" step="0.01" className={inputCls} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Seção: Instruções ao beneficiário */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wide">Instruções ao Beneficiário</h3>
            <div className="space-y-3">
              <input type="text" name="MENSAGEM1" value={formData.MENSAGEM1} onChange={handleChange} placeholder="Instrução 1" className={inputCls} />
              <input type="text" name="MENSAGEM2" value={formData.MENSAGEM2} onChange={handleChange} placeholder="Instrução 2" className={inputCls} />
              <input type="text" name="MENSAGEM3" value={formData.MENSAGEM3} onChange={handleChange} placeholder="Instrução 3" className={inputCls} />
            </div>
          </div>

          {/* Seção: Status */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wide">Status</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>STATUS</label>
                <select name="STATUS" value={formData.STATUS} onChange={handleChange} className={inputCls}>
                  <option value="pendente">Pendente</option>
                  <option value="pago">Pago</option>
                  <option value="atrasado">Atrasado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>SITUAÇÃO</label>
                <input type="text" name="SITUACAO" value={formData.SITUACAO} onChange={handleChange} placeholder="Ex: Gravado, Registrado" className={inputCls} />
              </div>
            </div>
          </div>

          {/* Seção: Descrição */}
          <div>
            <label className={labelCls}>DESCRIÇÃO</label>
            <textarea name="DESCRICAO" value={formData.DESCRICAO} onChange={handleChange} placeholder="Observações..." rows="3" className={inputCls + ' resize-none'} />
          </div>

          {/* Seção: Anexos para boleto NOVO — arquivos enviados junto ao emitir */}
          {!boleto && (
            <div>
              <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wide">Documentos</h3>
              <div className="p-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg">
                <div className="mb-4">
                  <label className="block w-full">
                    <input type="file" accept=".xlsx,.xls,.xml,.pdf" multiple onChange={handleAddPendingFiles} className="hidden" />
                    <span className="inline-block px-4 py-2 rounded text-sm font-medium transition cursor-pointer whitespace-nowrap bg-white text-black hover:opacity-90">
                      ➕ Anexar arquivo
                    </span>
                  </label>
                  <p className="text-[#666666] text-xs mt-2">Formatos permitidos: XML, Excel (.xlsx, .xls), PDF — enviados ao emitir o boleto</p>
                </div>
                {pendingFiles.length === 0 ? (
                  <p className="text-[#666666] text-sm">Nenhum anexo selecionado</p>
                ) : (
                  <div className="space-y-2">
                    {pendingFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-[#111111] border border-[#2a2a2a] rounded">
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{file.name}</p>
                          <p className="text-[#666666] text-xs">{formatarTamanho(file.size)}</p>
                        </div>
                        <button type="button" onClick={() => handleRemovePendingFile(idx)} className="p-2 text-[#a3a3a3] hover:text-red-500 transition ml-4 flex-shrink-0" title="Remover">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Seção: Anexos - Mostrar se boleto já existe (foi salvo) */}
          {boleto && boleto.id && (
            <div>
              <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wide">Documentos</h3>
              <FileAttachment boletoId={boleto.id} contaId={contaId || boleto.conta_id} />
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t border-[#1f1f1f]">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-transparent text-white text-sm font-medium border border-[#2a2a2a] rounded hover:bg-[#111111] transition">
              Cancelar
            </button>
            <button type="submit" className="px-4 py-2 bg-white text-black text-sm font-medium rounded hover:opacity-90 transition">
              {boleto ? 'Atualizar' : 'Emitir Boleto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
