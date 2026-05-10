import { useState, useRef, useEffect } from 'react'

export default function InstalmentModal({ item, onConfirm, onCancel }) {
  const [numInstalments, setNumInstalments] = useState(1)
  const [frequencyType, setFrequencyType] = useState('days') // 'days' ou 'monthly'
  const [frequencyValue, setFrequencyValue] = useState(30)
  const [monthlyDay, setMonthlyDay] = useState('')
  const [instalments, setInstalments] = useState([])
  const [editingInstalment, setEditingInstalment] = useState(null)
  const [editValues, setEditValues] = useState({})
  const inputRef = useRef(null)

  // Extrair dia da emissão
  useEffect(() => {
    if (typeof item.EMISSAO === 'string') {
      const [day] = item.EMISSAO.split('/')
      setMonthlyDay(day)
    }
  }, [item])

  useEffect(() => {
    if (editingInstalment !== null && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingInstalment])

  // Calcular parcelas
  const calculateInstalments = () => {
    // Parse EMISSAO in DD/MM/YYYY format
    let baseDate
    if (typeof item.EMISSAO === 'string') {
      const [day, month, year] = item.EMISSAO.split('/')
      baseDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    } else {
      baseDate = new Date(item.EMISSAO)
    }

    const baseValue = parseFloat(item.VALOR) || 0
    const totalInstalments = parseInt(numInstalments) || 1
    const valuePerInstalment = baseValue / totalInstalments

    const newInstalments = []

    for (let i = 0; i < totalInstalments; i++) {
      let dueDate = new Date(baseDate)

      if (frequencyType === 'days') {
        // Adicionar dias
        const days = parseInt(frequencyValue) || 30
        dueDate.setDate(dueDate.getDate() + days * (i + 1))
      } else {
        // Adicionar meses - usar o dia selecionado
        const months = parseInt(frequencyValue) || 1
        const dayToUse = parseInt(monthlyDay) || baseDate.getDate()
        dueDate.setMonth(dueDate.getMonth() + months * (i + 1))
        dueDate.setDate(dayToUse)
      }

      const dueDateStr = dueDate.toLocaleDateString('pt-BR')

      newInstalments.push({
        number: `${item.NUM_TITULO}-${i + 1}`,
        originalNumber: item.NUM_TITULO,
        installmentIndex: i + 1,
        value: valuePerInstalment,
        dueDate: dueDateStr,
        emission: item.EMISSAO,
      })
    }

    setInstalments(newInstalments)
  }

  const handleFrequencyTypeChange = (type) => {
    setFrequencyType(type)
    setFrequencyValue(type === 'days' ? 30 : 1)
  }

  const handleEditInstalment = (idx, field, value) => {
    setEditingInstalment(`${idx}-${field}`)
    setEditValues({ idx, field, value })
  }

  const handleSaveEdit = () => {
    const { idx, field, value } = editValues
    const newInstalments = [...instalments]

    if (field === 'value') {
      newInstalments[idx].value = parseFloat(value) || 0
    } else if (field === 'dueDate') {
      newInstalments[idx].dueDate = value
    } else if (field === 'number') {
      newInstalments[idx].number = value
    }

    setInstalments(newInstalments)
    setEditingInstalment(null)
  }

  const handleConfirm = () => {
    if (instalments.length === 0) {
      calculateInstalments()
      return
    }
    onConfirm(instalments)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-[60] p-4 pt-20">
      <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg max-w-lg w-full max-h-[75vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-[#1f1f1f] p-6">
          <h3 className="text-lg font-semibold text-white">
            Parcelar: {item.NUM_TITULO}
          </h3>
          <p className="text-sm text-[#666666] mt-1">
            Valor total: R$ {parseFloat(item.VALOR).toFixed(2)}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Configuração de Parcelamento */}
          {instalments.length === 0 ? (
            <div className="space-y-6">
              {/* Número de Parcelas */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Quantidade de Parcelas
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={numInstalments}
                  onChange={(e) => setNumInstalments(e.target.value)}
                  className="w-full px-4 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white focus:border-white outline-none transition"
                />
              </div>

              {/* Frequência */}
              <div>
                <label className="block text-sm font-semibold text-white mb-3">
                  Frequência de Vencimento
                </label>
                <div className="space-y-3">
                  {/* Tipo: Dias fixos */}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="frequencyType"
                      value="days"
                      checked={frequencyType === 'days'}
                      onChange={() => handleFrequencyTypeChange('days')}
                      className="w-4 h-4 cursor-pointer accent-white"
                    />
                    <span className="text-white text-sm">A cada</span>
                    <input
                      type="number"
                      min="1"
                      value={frequencyValue}
                      onChange={(e) => setFrequencyValue(e.target.value)}
                      disabled={frequencyType !== 'days'}
                      className="w-20 px-3 py-1 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white outline-none disabled:opacity-50"
                    />
                    <span className="text-white text-sm">dia(s)</span>
                  </label>

                  {/* Tipo: Mesmo dia do mês */}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="frequencyType"
                      value="monthly"
                      checked={frequencyType === 'monthly'}
                      onChange={() => handleFrequencyTypeChange('monthly')}
                      className="w-4 h-4 cursor-pointer accent-white"
                    />
                    <span className="text-white text-sm">Todo mês (mesmo dia)</span>
                    {frequencyType === 'monthly' && (
                      <div className="ml-auto flex items-center gap-2">
                        <label className="text-sm text-[#666666]">Dia:</label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={monthlyDay}
                          onChange={(e) => setMonthlyDay(e.target.value)}
                          className="w-16 px-3 py-1 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white outline-none"
                        />
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Botão Calcular */}
              <button
                onClick={calculateInstalments}
                className="w-full px-4 py-2 bg-[#1a1a1a] text-white text-sm font-medium border border-[#2a2a2a] rounded hover:bg-[#2a2a2a] transition"
              >
                Calcular Parcelas
              </button>
            </div>
          ) : (
            // Exibir Parcelas Calculadas
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-white font-semibold">Parcelas Calculadas</h4>
                <button
                  onClick={() => setInstalments([])}
                  className="text-[#666666] hover:text-white text-sm transition"
                >
                  ← Voltar
                </button>
              </div>

              {instalments.map((inst, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-[#111111] border border-[#1f1f1f] rounded-lg"
                >
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div
                      className="cursor-pointer hover:opacity-80 transition"
                      onClick={() => handleEditInstalment(idx, 'number', inst.number)}
                    >
                      <p className="text-[#666666] text-xs uppercase mb-1">Número</p>
                      {editingInstalment === `${idx}-number` ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={editValues.value || ''}
                          onChange={(e) => setEditValues({ ...editValues, value: e.target.value })}
                          onBlur={handleSaveEdit}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                          className="w-full px-2 py-1 bg-[#1a1a1a] border border-white rounded text-white text-sm"
                        />
                      ) : (
                        <p className="text-white font-mono font-semibold">{inst.number}</p>
                      )}
                    </div>
                    <div
                      className="cursor-pointer hover:opacity-80 transition"
                      onClick={() => handleEditInstalment(idx, 'value', inst.value)}
                    >
                      <p className="text-[#666666] text-xs uppercase mb-1">Valor</p>
                      {editingInstalment === `${idx}-value` ? (
                        <input
                          ref={inputRef}
                          type="number"
                          step="0.01"
                          value={editValues.value || ''}
                          onChange={(e) => setEditValues({ ...editValues, value: e.target.value })}
                          onBlur={handleSaveEdit}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                          className="w-full px-2 py-1 bg-[#1a1a1a] border border-white rounded text-white text-sm"
                        />
                      ) : (
                        <p className="text-white font-mono">R$ {inst.value.toFixed(2)}</p>
                      )}
                    </div>
                    <div
                      className="cursor-pointer hover:opacity-80 transition"
                      onClick={() => handleEditInstalment(idx, 'dueDate', inst.dueDate)}
                    >
                      <p className="text-[#666666] text-xs uppercase mb-1">Vencimento</p>
                      {editingInstalment === `${idx}-dueDate` ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={editValues.value || ''}
                          onChange={(e) => setEditValues({ ...editValues, value: e.target.value })}
                          onBlur={handleSaveEdit}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                          className="w-full px-2 py-1 bg-[#1a1a1a] border border-white rounded text-white text-sm"
                        />
                      ) : (
                        <p className="text-white">{inst.dueDate}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[#666666] text-xs uppercase mb-1">Parcela</p>
                      <p className="text-white">{inst.installmentIndex} de {instalments.length}</p>
                    </div>
                  </div>
                </div>
              ))}

              <div className="pt-4 border-t border-[#1f1f1f]">
                <p className="text-sm text-[#a3a3a3]">
                  Total: R$ {instalments.reduce((sum, inst) => sum + inst.value, 0).toFixed(2)} em {instalments.length} parcela{instalments.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#1f1f1f] p-6 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-6 py-2 bg-transparent text-white text-sm font-medium border border-[#2a2a2a] rounded hover:bg-[#111111] transition"
          >
            Cancelar
          </button>
          {instalments.length > 0 && (
            <button
              onClick={handleConfirm}
              className="px-6 py-2 bg-white text-black text-sm font-medium rounded hover:opacity-90 transition"
            >
              Confirmar Parcelamento
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
