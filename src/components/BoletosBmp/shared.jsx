// Estilos e pequenos componentes compartilhados entre as abas de Conta (BMP).
// Segue o padrão visual do restante do app (AcessosPage / CadastroPage).

import { useState, useEffect, useRef } from 'react'

export const inputCls =
  'w-full px-2.5 py-1 bg-[#111111] border border-[#2a2a2a] rounded-md text-white placeholder-[#666666] outline-none focus:border-white transition text-sm leading-tight'

export const selectCls =
  'w-full px-2.5 py-1 bg-[#111111] border border-[#2a2a2a] rounded-md text-white outline-none focus:border-white transition text-sm leading-tight'

export const textareaCls =
  'w-full px-2.5 py-1 bg-[#111111] border border-[#2a2a2a] rounded-md text-white placeholder-[#666666] outline-none focus:border-white transition text-sm leading-tight resize-y'

export const labelCls = 'block text-xs font-medium text-[#a3a3a3] mb-0.5'

export function Field({ label, children }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  )
}

export function Feedback({ feedback }) {
  if (!feedback) return null
  return (
    <div
      className={`p-2 rounded-md text-xs border ${
        feedback.ok
          ? 'bg-emerald-900/20 border-emerald-800 text-emerald-200'
          : 'bg-red-900/20 border-red-800 text-red-200'
      }`}
    >
      {feedback.message}
    </div>
  )
}

export function Card({ title, description, children }) {
  return (
    <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-4">
      {title && <h2 className="text-sm font-semibold text-white mb-0.5">{title}</h2>}
      {description && <p className="text-xs text-[#a3a3a3] mb-2">{description}</p>}
      {children}
    </div>
  )
}

export function PrimaryButton({ children, ...props }) {
  return (
    <button
      {...props}
      className="px-3 py-1 bg-white text-black font-medium rounded-md hover:opacity-90 disabled:opacity-50 transition text-sm leading-tight"
    >
      {children}
    </button>
  )
}

export function SecondaryButton({ children, ...props }) {
  return (
    <button
      {...props}
      className="px-3 py-1 bg-[#111111] border border-[#2a2a2a] text-white font-medium rounded-md hover:border-white disabled:opacity-50 transition text-sm leading-tight"
    >
      {children}
    </button>
  )
}

// Extrai uma mensagem de erro amigável de uma resposta supabase.functions.invoke,
// cobrindo tanto o erro de transporte (error) quanto o erro de negócio
// (data?.sucesso === false / data?.mensagem), igual ao padrão de AcessosPage.jsx.
export function extractError(data, error, fallback) {
  if (error) return error.message || fallback
  if (data?.sucesso === false) return data.mensagem || fallback
  if (data?.error) return data.error
  return null
}

export function formatMoeda(v) {
  const n = Number(v)
  if (Number.isNaN(n)) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatDataHora(v) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleString('pt-BR')
}

export function formatData(v) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString('pt-BR')
}

// ---------- Input de data com mascara dd/mm/aa ----------
// Mantem o valor externo (value/onChange) em ISO (yyyy-mm-dd), igual a um
// <input type="date">, mas exibe e captura digitacao no formato dd/mm/aa
// (ano com 2 digitos, assumido como 20xx). Drop-in replacement para os
// inputs de data das abas de Boletos BMP.
function isoParaMascara(iso) {
  if (!iso) return ''
  const partes = String(iso).split('-')
  if (partes.length < 3) return ''
  const [ano, mes, dia] = partes
  if (!ano || !mes || !dia) return ''
  return `${dia.slice(0, 2)}/${mes.slice(0, 2)}/${ano.slice(-2)}`
}

function aplicarMascaraData(valorDigitado) {
  const digitos = valorDigitado.replace(/\D/g, '').slice(0, 6)
  const dia = digitos.slice(0, 2)
  const mes = digitos.slice(2, 4)
  const ano = digitos.slice(4, 6)
  let out = dia
  if (mes) out += '/' + mes
  if (ano) out += '/' + ano
  return out
}

function mascaraParaIso(mascara) {
  const digitos = mascara.replace(/\D/g, '')
  if (digitos.length !== 6) return ''
  const dia = digitos.slice(0, 2)
  const mes = digitos.slice(2, 4)
  const ano = '20' + digitos.slice(4, 6)
  return `${ano}-${mes}-${dia}`
}

export function DateInput({ value, onChange, disabled, className }) {
  const [texto, setTexto] = useState(() => isoParaMascara(value))
  const ultimoEmitidoRef = useRef(value ?? '')

  useEffect(() => {
    if ((value ?? '') !== ultimoEmitidoRef.current) {
      setTexto(isoParaMascara(value))
      ultimoEmitidoRef.current = value ?? ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const handleChange = (e) => {
    const mascarado = aplicarMascaraData(e.target.value)
    setTexto(mascarado)
    const iso = mascaraParaIso(mascarado)
    ultimoEmitidoRef.current = iso
    onChange({ target: { value: iso } })
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="dd/mm/aa"
      maxLength={8}
      className={className || inputCls}
      value={texto}
      onChange={handleChange}
      disabled={disabled}
    />
  )
}
