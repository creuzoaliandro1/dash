import { useState, useEffect, useMemo, useRef } from 'react'

const inputCls = 'px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-xs focus:border-white outline-none transition w-full'
const nomeDe = (c) => (c ? (c.RAZAO_SOCIAL || c.NOME_FANTASIA || '') : '')

// Combobox de cedente: digite o código (COD_CEDENTE) ou parte do nome.
export default function CedenteCombo({ cedentes, value, onChange, permitirTodos = true, placeholder }) {
  const [texto, setTexto] = useState('')
  const [aberto, setAberto] = useState(false)
  const ref = useRef(null)

  const rotulo = (c) => `${c.COD_CEDENTE} - ${nomeDe(c)}`

  // Sincroniza o texto quando o valor muda por fora (ex.: Limpar filtros)
  useEffect(() => {
    if (value === '') setTexto('')
    else {
      const c = cedentes.find((x) => String(x.COD_CEDENTE) === String(value))
      if (c) setTexto(rotulo(c))
    }
  }, [value, cedentes])

  useEffect(() => {
    const fora = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [])

  const opcoes = useMemo(() => {
    const t = texto.trim().toLowerCase()
    const selecionado = cedentes.find((x) => String(x.COD_CEDENTE) === String(value))
    if (!t || (selecionado && texto === rotulo(selecionado))) return cedentes
    return cedentes.filter((c) => String(c.COD_CEDENTE).startsWith(t) || nomeDe(c).toLowerCase().includes(t))
  }, [texto, cedentes, value])

  const escolher = (c) => {
    onChange(c ? String(c.COD_CEDENTE) : '')
    setTexto(c ? rotulo(c) : '')
    setAberto(false)
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && aberto) {
      e.preventDefault()
      const t = texto.trim()
      const exato = cedentes.find((c) => String(c.COD_CEDENTE) === t)
      if (exato) escolher(exato)
      else if (opcoes.length === 1) escolher(opcoes[0])
    } else if (e.key === 'Escape') setAberto(false)
  }

  return (
    <div ref={ref} className="relative">
      <input
        value={texto}
        onChange={(e) => { setTexto(e.target.value); setAberto(true); if (e.target.value === '') onChange('') }}
        onFocus={(e) => { setAberto(true); e.target.select() }}
        onKeyDown={onKeyDown}
        className={inputCls}
        placeholder={placeholder || (permitirTodos ? 'Todos — digite o código ou o nome' : 'Digite o código ou o nome do cedente')}
      />
      {aberto && (
        <ul className="absolute z-20 mt-1 w-full max-h-64 overflow-auto bg-[#111111] border border-[#2a2a2a] rounded shadow-lg">
          {permitirTodos && <li>
            <button type="button" onClick={() => escolher(null)} className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#1a1a1a] ${value === '' ? 'text-white font-semibold' : 'text-[#a3a3a3]'}`}>
              Todos
            </button>
          </li>}
          {opcoes.map((c) => (
            <li key={c.COD_CEDENTE}>
              <button type="button" onClick={() => escolher(c)} className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#1a1a1a] ${String(c.COD_CEDENTE) === String(value) ? 'text-white font-semibold' : 'text-[#d4d4d4]'}`}>
                <span className="text-[#888] mr-2">{c.COD_CEDENTE}</span>{nomeDe(c)}
              </button>
            </li>
          ))}
          {opcoes.length === 0 && <li className="px-3 py-1.5 text-xs text-[#666666]">Nenhum cedente encontrado</li>}
        </ul>
      )}
    </div>
  )
}
