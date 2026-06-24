import { useState, useRef, useEffect } from 'react'

// ---- Helpers ----
const parseValorFlex = (v) => {
  if (typeof v === 'number') return v
  const s = String(v ?? '').trim()
  if (!s) return 0
  // Formato brasileiro "2.199,54"
  if (s.includes(',')) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
  return parseFloat(s) || 0
}

// Normaliza qualquer entrada de data para dd/mm/aaaa
const toDDMMYYYY = (val) => {
  const s = String(val ?? '').trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (m) return `${m[1]}/${m[2]}/${m[3]}`
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{2})$/)
  if (m) return `${m[1]}/${m[2]}/20${m[3]}`
  return s
}

// Máscara de digitação de data: insere as "/" automaticamente.
// Ex.: "090626" -> "09/06/26" | "09062026" -> "09/06/2026"
const mascararDataDigitada = (value) => {
  const d = String(value || '').replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

// Converte dd/mm/aaaa (ou yyyy-mm-dd) para Date
const parseDateFlex = (str) => {
  const s = String(str ?? '').trim()
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (m) return new Date(+m[3], +m[2] - 1, +m[1])
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{2})$/)
  if (m) return new Date(2000 + +m[3], +m[2] - 1, +m[1])
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3])
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

export default function InstalmentModal({ item, onConfirm, onCancel }) {
  const [numInstalments, setNumInstalments] = useState(1)
  const [frequencyType, setFrequencyType] = useState('days') // 'days' ou 'monthly'
  const [frequencyValue, setFrequencyValue] = useState(30)
  const [monthlyDay, setMonthlyDay] = useState('')
  const [instalments, setInstalments] = useState([])
  const [hasCalculated, setHasCalculated] = useState(false)
  const [editingInstalment, setEditingInstalment] = useState(null)
  const [editValues, setEditValues] = useState({})

  // Data (1º vencimento) e Valor total — vêm da tela anterior e são editáveis.
  const [baseDate, setBaseDate] = useState(toDDMMYYYY(item.VENCIMENTO))
  const [totalValue, setTotalValue] = useState(parseValorFlex(item.VALOR))

  const inputRef = useRef(null)

  // Dia base para parcelamento mensal, derivado da Data (1º vencimento)
  useEffect(() => {
    const d = parseDateFlex(baseDate)
    if (d) setMonthlyDay(String(d.getDate()))
    // só na montagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (editingInstalment !== null && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingInstalment])

  // Constrói as parcelas. A 1ª parcela vence exatamente na Data informada;
  // as seguintes somam o intervalo (dias) ou os meses a partir dessa Data.
  const buildInstalments = () => {
    const base = parseDateFlex(baseDate)
    if (!base) return []

    const baseValue = parseValorFlex(totalValue)
    const total = parseInt(numInstalments) || 1
    const valuePerInstalment = baseValue / total

    const arr = []
    for (let i = 0; i < total; i++) {
      const due = new Date(base)

      if (frequencyType === 'days') {
        const days = parseInt(frequencyValue) || 30
        due.setDate(base.getDate() + days * i) // i=0 -> própria Data
      } else {
        // mensal: 1ª parcela na própria Data; demais somam meses
        if (i > 0) {
          const months = parseInt(frequencyValue) || 1
          const dayToUse = parseInt(monthlyDay) || base.getDate()
          due.setMonth(base.getMonth() + months * i)
          due.setDate(dayToUse)
        }
      }

      arr.push({
        number: `${item.NUM_TITULO}-${i + 1}`,
        originalNumber: item.NUM_TITULO,
        installmentIndex: i + 1,
        value: valuePerInstalment,
        dueDate: due.toLocaleDateString('pt-BR'),
        emission: item.EMISSAO,
      })
    }
    return arr
  }

  const calculateInstalments = () => {
    const next = buildInstalments()
    if (next.length > 0) setInstalments(next)
    setHasCalculated(true)
  }

  // Recalcular automaticamente ao alterar Data, Valor total, quantidade ou frequência
  useEffect(() => {
    if (!hasCalculated) return
    const next = buildInstalments()
    if (next.length > 0) setInstalments(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseDate, totalValue, numInstalments, frequencyType, frequencyValue, monthlyDay, hasCalculated])

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
      // Normaliza para dd/mm/aaaa (ano de 4 dígitos) antes de salvar
      newInstalments[idx].dueDate = toDDMMYYYY(value)
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center z-[60] p-4 pt-20">
      <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg max-w-lg w-full max-h-[75vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-[#1f1f1f] p-6">
          <h3 className="text-lg font-semibold text-white">
            Parcelar: {item.NUM_TITULO}
          </h3>
          <div className="mt-3 flex items-end gap-4">
            {/* Data (1º vencimento) */}
            <div className="flex-1">
              <label className="block text-xs text-[#666666] uppercase font-semibold mb-1 text-center">Data (1º venc.)</label>
              <input
                type="text"
                value={baseDate}
                onChange={(e) => setBaseDate(mascararDataDigitada(e.target.value))}
                placeholder="dd/mm/aaaa"
                className="w-full px-3 py-1.5 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white outline-none transition text-center"
              />
            </div>
            {/* Valor total */}
            <div className="flex-1">
              <label className="block text-xs text-[#666666] uppercase font-semibold mb-1 text-center">Valor total</label>
              <input
                type="text"
                value={typeof totalValue === 'number'
                  ? totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  : String(totalValue)}
                onChange={(e) => {
                  const raw = e.target.value
                  setTotalValue(raw)
                }}
                onBlur={(e) => {
                  setTotalValue(parseValorFlex(e.target.value))
                }}
                className="w-full px-3 py-1.5 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white outline-none transition text-center"
              />
            </div>
            {/* Quantidade de Parcelas */}
            <div className="flex-1">
              <label className="block text-xs text-[#666666] uppercase font-semibold mb-1 text-center">Qtd. de Parcelas</label>
              <input
                type="number"
                min="1"
                max="120"
                value={numInstalments}
                onChange={(e) => setNumInstalments(e.target.value)}
                className="w-full px-3 py-1.5 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white outline-none transition text-center"
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Configuração de Parcelamento */}
          {instalments.length === 0 ? (
            <div className="space-y-6">
              {/* Frequência */}
              <div>
                <label className="block text-sm font-semibold text-white mb-3">
                  Frequência de Vencimento
                </label>
                {/* Linha única: [● A cada ___ dia(s)]  [● Todo mês (mesmo dia) ___] */}
                <div className="flex items-center gap-6">
                  {/* Opção: Dias fixos */}
                  <label className="flex items-center gap-2 cursor-pointer shrink-0">
                    <input
                      type="radio"
                      name="frequencyType"
                      value="days"
                      checked={frequencyType === 'days'}
                      onChange={() => handleFrequencyTypeChange('days')}
                      className="w-4 h-4 cursor-pointer accent-white"
                    />
                    <span className="text-white text-sm whitespace-nowrap">A cada</span>
                    <input
                      type="number"
                      min="1"
                      value={frequencyType === 'days' ? frequencyValue : ''}
                      onChange={(e) => setFrequencyValue(e.target.value)}
                      disabled={frequencyType !== 'days'}
                      className="w-16 px-2 py-1 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white outline-none disabled:opacity-40 text-center"
                    />
                    <span className="text-white text-sm whitespace-nowrap">dia(s)</span>
                  </label>

                  {/* Separador */}
                  <span className="text-[#333333] select-none">|</span>

                  {/* Opção: Mesmo dia do mês */}
                  <label className="flex items-center gap-2 cursor-pointer flex-1">
                    <input
                      type="radio"
                      name="frequencyType"
                      value="monthly"
                      checked={frequencyType === 'monthly'}
                      onChange={() => handleFrequencyTypeChange('monthly')}
                      className="w-4 h-4 cursor-pointer accent-white"
                    />
                    <span className="text-white text-sm whitespace-nowrap">Todo mês (mesmo dia)</span>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={monthlyDay}
                      onChange={(e) => setMonthlyDay(e.target.value)}
                      disabled={frequencyType !== 'monthly'}
                      className="w-14 px-2 py-1 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white outline-none disabled:opacity-40 text-center ml-1"
                    />
                  </label>
                </div>
              </div>

            </div>
          ) : (
            // Exibir Parcelas Calculadas
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-white font-semibold">Parcelas Calculadas</h4>
                <button
                  onClick={() => { setInstalments([]); setHasCalculated(false) }}
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
                          onChange={(e) => setEditValues({ ...editValues, value: mascararDataDigitada(e.target.value) })}
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
                  Total: R$ {instalments.reduce((sum, inst) => sum + inst.value, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} em {instalments.length} parcela{instalments.length > 1 ? 's' : ''}
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
          {instalments.length === 0 ? (
            <button
              onClick={calculateInstalments}
              className="px-6 py-2 bg-[#1a1a1a] text-white text-sm font-medium border border-[#2a2a2a] rounded hover:bg-[#2a2a2a] transition"
            >
              Calcular Parcelas
            </button>
          ) : (
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
