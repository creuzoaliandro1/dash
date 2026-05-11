import { useState } from 'react'

// Converte registro snake_case do banco para chaves UPPERCASE do formulário
const boletoToFormData = (b) => ({
  EMISSAO:        b.data_emissao     || '',
  NUM_TITULO:     b.numero_documento || '',
  VENCIMENTO:     b.data_vencimento  || '',
  VALOR:          b.valor            ?? '',
  NOSSO_NUMERO:   b.nosso_numero     || '',
  SACADO_NOME:    b.sacado_nome      || '',
  SACADO_CIC:     b.sacado_cic       || '',
  SACADO_CEP:     b.sacado_cep       || '',
  SACADO_ENDERECO:b.sacado_endereco  || '',
  SACADO_BAIRRO:  b.sacado_bairro    || '',
  SACADO_NUMERO:  '',
  SACADO_CIDADE:  b.sacado_cidade    || '',
  SACADO_UF:      b.sacado_uf        || '',
  AVALISTA:       b.avalista_nome    || '',
  AVALISTA_CIC:   b.avalista_cic     || '',
  JUROS_VALOR:    '',
  DESCONTO_VALOR: '',
  DESCONTO_DATA:  '',
  VALOR_PAGO:     b.valor_pagamento  ?? '',
  DATA_PAGO:      b.data_pagamento   || '',
  DESCRICAO:      b.descricao        || '',
  STATUS:         b.status           || 'pendente',
  SITUACAO:       b.situacao         || '',
})

const emptyFormData = {
  EMISSAO: '', NUM_TITULO: '', VENCIMENTO: '', VALOR: '', NOSSO_NUMERO: '',
  SACADO_NOME: '', SACADO_CIC: '', SACADO_CEP: '', SACADO_ENDERECO: '',
  SACADO_BAIRRO: '', SACADO_NUMERO: '', SACADO_CIDADE: '', SACADO_UF: '',
  AVALISTA: '', AVALISTA_CIC: '', JUROS_VALOR: '', DESCONTO_VALOR: '',
  DESCONTO_DATA: '', VALOR_PAGO: '', DATA_PAGO: '', DESCRICAO: '',
  STATUS: 'pendente', SITUACAO: '',
}

export default function BoletoFormModal({ boleto, onSave, onClose }) {
  const [formData, setFormData] = useState(
    boleto ? boletoToFormData(boleto) : emptyFormData
  )

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#1f1f1f] sticky top-0 bg-[#0a0a0a]">
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
                <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">EMISSÃO</label>
                <input
                  type="date"
                  name="EMISSAO"
                  value={formData.EMISSAO}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white focus:bg-[#1a1a1a] outline-none transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">VENCIMENTO</label>
                <input
                  type="date"
                  name="VENCIMENTO"
                  value={formData.VENCIMENTO}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white focus:bg-[#1a1a1a] outline-none transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">DESCONTO DATA</label>
                <input
                  type="date"
                  name="DESCONTO_DATA"
                  value={formData.DESCONTO_DATA}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white focus:bg-[#1a1a1a] outline-none transition"
                />
              </div>
            </div>
          </div>

          {/* Seção: Documento e Valores */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wide">Documento e Valores</h3>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">NÚM. TÍTULO</label>
                <input
                  type="text"
                  name="NUM_TITULO"
                  value={formData.NUM_TITULO}
                  onChange={handleChange}
                  placeholder="DOC-123456"
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white focus:bg-[#1a1a1a] outline-none transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">VALOR</label>
                <input
                  type="number"
                  name="VALOR"
                  value={formData.VALOR}
                  onChange={handleChange}
                  placeholder="0.00"
                  step="0.01"
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white focus:bg-[#1a1a1a] outline-none transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">NOSSO Nº</label>
                <input
                  type="text"
                  name="NOSSO_NUMERO"
                  value={formData.NOSSO_NUMERO}
                  onChange={handleChange}
                  placeholder="001560992"
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white focus:bg-[#1a1a1a] outline-none transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">JUROS R$</label>
                <input
                  type="number"
                  name="JUROS_VALOR"
                  value={formData.JUROS_VALOR}
                  onChange={handleChange}
                  placeholder="0.00"
                  step="0.01"
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white focus:bg-[#1a1a1a] outline-none transition"
                />
              </div>
            </div>
          </div>

          {/* Seção: Sacado (Cliente) */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wide">Sacado / Cliente</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">NOME</label>
                <input
                  type="text"
                  name="SACADO_NOME"
                  value={formData.SACADO_NOME}
                  onChange={handleChange}
                  placeholder="Agro Plantar Ltda"
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white focus:bg-[#1a1a1a] outline-none transition"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">CIC / CNPJ</label>
                  <input
                    type="text"
                    name="SACADO_CIC"
                    value={formData.SACADO_CIC}
                    onChange={handleChange}
                    placeholder="89.012.345/0001-34"
                    className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white focus:bg-[#1a1a1a] outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">CEP</label>
                  <input
                    type="text"
                    name="SACADO_CEP"
                    value={formData.SACADO_CEP}
                    onChange={handleChange}
                    placeholder="00000-000"
                    className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white focus:bg-[#1a1a1a] outline-none transition"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">ENDEREÇO</label>
                  <input
                    type="text"
                    name="SACADO_ENDERECO"
                    value={formData.SACADO_ENDERECO}
                    onChange={handleChange}
                    placeholder="Rua..."
                    className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white focus:bg-[#1a1a1a] outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">BAIRRO</label>
                  <input
                    type="text"
                    name="SACADO_BAIRRO"
                    value={formData.SACADO_BAIRRO}
                    onChange={handleChange}
                    placeholder="Centro"
                    className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white focus:bg-[#1a1a1a] outline-none transition"
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">NÚM.</label>
                  <input
                    type="text"
                    name="SACADO_NUMERO"
                    value={formData.SACADO_NUMERO}
                    onChange={handleChange}
                    placeholder="123"
                    className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white focus:bg-[#1a1a1a] outline-none transition"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">CIDADE</label>
                  <input
                    type="text"
                    name="SACADO_CIDADE"
                    value={formData.SACADO_CIDADE}
                    onChange={handleChange}
                    placeholder="São Paulo"
                    className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white focus:bg-[#1a1a1a] outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">UF</label>
                  <input
                    type="text"
                    name="SACADO_UF"
                    value={formData.SACADO_UF}
                    onChange={handleChange}
                    placeholder="SP"
                    maxLength="2"
                    className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white focus:bg-[#1a1a1a] outline-none transition"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Seção: Avalista */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wide">Avalista</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">NOME</label>
                <input
                  type="text"
                  name="AVALISTA"
                  value={formData.AVALISTA}
                  onChange={handleChange}
                  placeholder="Nome do avalista"
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white focus:bg-[#1a1a1a] outline-none transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">CIC / CNPJ</label>
                <input
                  type="text"
                  name="AVALISTA_CIC"
                  value={formData.AVALISTA_CIC}
                  onChange={handleChange}
                  placeholder="CPF ou CNPJ"
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white focus:bg-[#1a1a1a] outline-none transition"
                />
              </div>
            </div>
          </div>

          {/* Seção: Descontos e Abatimentos */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wide">Descontos e Abatimentos</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">DESCONTO R$</label>
                <input
                  type="number"
                  name="DESCONTO_VALOR"
                  value={formData.DESCONTO_VALOR}
                  onChange={handleChange}
                  placeholder="0.00"
                  step="0.01"
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white focus:bg-[#1a1a1a] outline-none transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">ABATIMENTO R$</label>
                <input
                  type="number"
                  name="ABATIMENTO"
                  value={formData.ABATIMENTO}
                  onChange={handleChange}
                  placeholder="0.00"
                  step="0.01"
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white focus:bg-[#1a1a1a] outline-none transition"
                />
              </div>
            </div>
          </div>

          {/* Seção: Pagamento */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wide">Pagamento</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">VALOR PAGO R$</label>
                <input
                  type="number"
                  name="VALOR_PAGO"
                  value={formData.VALOR_PAGO}
                  onChange={handleChange}
                  placeholder="0.00"
                  step="0.01"
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white focus:bg-[#1a1a1a] outline-none transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">DATA PAGO</label>
                <input
                  type="date"
                  name="DATA_PAGO"
                  value={formData.DATA_PAGO}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white focus:bg-[#1a1a1a] outline-none transition"
                />
              </div>
            </div>
          </div>

          {/* Seção: Status */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wide">Status</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">STATUS</label>
                <select
                  name="STATUS"
                  value={formData.STATUS}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white focus:bg-[#1a1a1a] outline-none transition"
                >
                  <option value="pendente">Pendente</option>
                  <option value="pago">Pago</option>
                  <option value="atrasado">Atrasado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">SITUAÇÃO</label>
                <input
                  type="text"
                  name="SITUACAO"
                  value={formData.SITUACAO}
                  onChange={handleChange}
                  placeholder="Ex: Emitido, Registrado"
                  className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white focus:bg-[#1a1a1a] outline-none transition"
                />
              </div>
            </div>
          </div>

          {/* Seção: Descrição */}
          <div>
            <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">DESCRIÇÃO</label>
            <textarea
              name="DESCRICAO"
              value={formData.DESCRICAO}
              onChange={handleChange}
              placeholder="Observações..."
              rows="3"
              className="w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white focus:bg-[#1a1a1a] outline-none transition resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t border-[#1f1f1f]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-transparent text-white text-sm font-medium border border-[#2a2a2a] rounded hover:bg-[#111111] transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-white text-black text-sm font-medium rounded hover:opacity-90 transition"
            >
              {boleto ? 'Atualizar' : 'Emitir Boleto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
