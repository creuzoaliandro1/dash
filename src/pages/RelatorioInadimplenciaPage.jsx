import { useState, useEffect, useMemo, useRef } from 'react'
import { getCedentesRelatorio } from '../services/relatorioBorderosService'
import { getTitulosInadimplentes, getCodCedentesInadimplentes, totaisPorCedente, corrigidoOuValor, TIPOS_INADIMPLENCIA } from '../services/relatorioInadimplenciaService'
import { generateRelatorioInadimplenciaPDF } from '../utils/relatorioInadimplenciaPdf'

const FILTROS_INICIAIS = {
  codCedente: '',
  dtVenciIni: '', dtVenciFim: '',
  vrFaceMin: '', vrFaceMax: '',
  dtEmissaoIni: '', dtEmissaoFim: '',
  tipos: [...TIPOS_INADIMPLENCIA],
}

const inputCls = 'px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-xs focus:border-white outline-none transition w-full'
const labelCls = 'text-xs font-semibold text-[#a3a3a3] uppercase tracking-wider'
const cardCls = 'bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg'

const fmtMoeda = (v) => (parseFloat(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtData = (d) => {
  if (!d) return '—'
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d)
}
const fmtCic = (cic) => {
  const d = String(cic || '').replace(/\D/g, '')
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  return cic || ''
}
const nomeDe = (c) => (c ? (c.RAZAO_SOCIAL || c.NOME_FANTASIA || '') : '')

const COLUNAS = [
  { key: 'COD_OPERACAO', label: 'Oper.', cls: 'text-center' },
  { key: 'NUM_LANCAMENTO', label: 'Nº Lanç.', cls: 'text-center' },
  { key: 'NUM_TITULO', label: 'Nº Título' },
  { key: 'TIPO_TITULO', label: 'Tipo', cls: 'text-center' },
  { key: 'NOME_SACADO', label: 'Sacado' },
  { key: 'CIC_SACADO', label: 'CPF/CNPJ' },
  { key: 'DT_LANCA', label: 'Emissão', cls: 'text-center' },
  { key: 'VENCIMENTO', label: 'Vencimento', cls: 'text-center' },
  { key: 'DIAS_ATRASO', label: 'Dias atraso', cls: 'text-center' },
  { key: 'VR_FACE', label: 'Valor', cls: 'text-right' },
  { key: 'VR_CORRIGIDO', label: 'Corrigido', cls: 'text-right' },
]

function Intervalo({ label, tipo, de, ate, onDe, onAte, step }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={labelCls}>{label}</span>
      <div className="flex items-center gap-2">
        <input type={tipo} step={step} value={de} onChange={(e) => onDe(e.target.value)} className={inputCls} placeholder="De" />
        <span className="text-xs text-[#666666]">até</span>
        <input type={tipo} step={step} value={ate} onChange={(e) => onAte(e.target.value)} className={inputCls} placeholder="Até" />
      </div>
    </div>
  )
}

// Combobox de cedente: digite o código (COD_CEDENTE) ou parte do nome.
function CedenteCombo({ cedentes, value, onChange }) {
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
        placeholder="Todos — digite o código ou o nome"
      />
      {aberto && (
        <ul className="absolute z-20 mt-1 w-full max-h-64 overflow-auto bg-[#111111] border border-[#2a2a2a] rounded shadow-lg">
          <li>
            <button type="button" onClick={() => escolher(null)} className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#1a1a1a] ${value === '' ? 'text-white font-semibold' : 'text-[#a3a3a3]'}`}>
              Todos
            </button>
          </li>
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

export default function RelatorioInadimplenciaPage() {
  const [f, setF] = useState(FILTROS_INICIAIS)
  const [aplicado, setAplicado] = useState(FILTROS_INICIAIS) // filtros da última busca
  const [cedentes, setCedentes] = useState([])
  const [rows, setRows] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [sel, setSel] = useState(new Set())
  const [sort, setSort] = useState({ key: 'VENCIMENTO', dir: 'asc' })
  const [acoesAberto, setAcoesAberto] = useState(false)
  const [pdfUrl, setPdfUrl] = useState(null)
  const acoesRef = useRef(null)

  useEffect(() => {
    // Combobox: só os cedentes com títulos inadimplentes
    Promise.all([getCedentesRelatorio(), getCodCedentesInadimplentes()]).then(([ced, inad]) => {
      const todos = ced.data || []
      setCedentes(inad.data ? todos.filter((c) => inad.data.has(Number(c.COD_CEDENTE))) : todos)
    })
    buscar(FILTROS_INICIAIS)
  }, [])

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl) }, [pdfUrl])

  useEffect(() => {
    const fora = (e) => { if (acoesRef.current && !acoesRef.current.contains(e.target)) setAcoesAberto(false) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [])

  const set = (k) => (v) => setF((prev) => ({ ...prev, [k]: v }))
  const toggleTipo = (t) =>
    setF((prev) => ({ ...prev, tipos: prev.tipos.includes(t) ? prev.tipos.filter((x) => x !== t) : [...prev.tipos, t] }))

  async function buscar(filtros) {
    setErro('')
    if (filtros.tipos.length === 0) { setErro('Selecione ao menos um tipo de título.'); return }
    setCarregando(true)
    try {
      const { data, error, parametrosOk } = await getTitulosInadimplentes(filtros)
      if (error) throw error
      setAviso(parametrosOk ? '' : 'Não foi possível ler todas as taxas de atraso no Firebird — alguns títulos estão sem valor corrigido.')
      setRows(data)
      setAplicado(filtros)
      setSel(new Set(data.map((r) => r.KEY))) // começa com todos selecionados
      setPdfUrl(null)
    } catch (err) {
      setErro(`Erro ao buscar títulos: ${err?.message || err}`)
    } finally {
      setCarregando(false)
    }
  }

  const filtrar = (e) => { e.preventDefault(); buscar(f) }

  const ordenados = useMemo(() => {
    const { key, dir } = sort
    const mult = dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      let x = a[key], y = b[key]
      if (x == null || x === '') return 1
      if (y == null || y === '') return -1
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * mult
      return String(x).localeCompare(String(y), 'pt-BR', { numeric: true }) * mult
    })
  }, [rows, sort])

  const ordenarPor = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))

  const todosSel = rows.length > 0 && sel.size === rows.length
  const algunsSel = sel.size > 0 && !todosSel
  const toggleTodos = () => setSel(todosSel ? new Set() : new Set(rows.map((r) => r.KEY)))
  const toggleUm = (k) => setSel((prev) => {
    const n = new Set(prev)
    n.has(k) ? n.delete(k) : n.add(k)
    return n
  })

  const selecionados = ordenados.filter((r) => sel.has(r.KEY))
  const totalSel = selecionados.reduce((s, r) => s + r.VR_FACE, 0)
  const totalGeral = rows.reduce((s, r) => s + r.VR_FACE, 0)
  const corrigidoSel = selecionados.reduce((s, r) => s + corrigidoOuValor(r), 0)
  const corrigidoGeral = rows.reduce((s, r) => s + corrigidoOuValor(r), 0)
  const porCedente = useMemo(() => (aplicado.codCedente === '' ? totaisPorCedente(rows) : []), [rows, aplicado.codCedente])

  const nomeCedenteAplicado = nomeDe(cedentes.find((c) => String(c.COD_CEDENTE) === String(aplicado.codCedente)))

  const imprimir = () => {
    setAcoesAberto(false)
    if (selecionados.length === 0) { setErro('Selecione ao menos um título para imprimir.'); return }
    const blob = generateRelatorioInadimplenciaPDF(selecionados, aplicado, nomeCedenteAplicado)
    setPdfUrl(URL.createObjectURL(blob))
  }

  const baixar = () => {
    if (!pdfUrl) return
    const a = document.createElement('a')
    a.href = pdfUrl
    a.download = `relatorio_inadimplencia_${new Date().toISOString().slice(0, 10)}.pdf`
    a.click()
  }

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <div>
        <h1 className="text-2xl font-bold text-white">Inadimplência</h1>
        <p className="text-sm text-[#666666] mt-1">Títulos de OPEITE com status IN (DUP, CHE e PRO)</p>
      </div>

      {/* Filtros */}
      <form onSubmit={filtrar} className={`${cardCls} p-5 flex flex-col gap-4 flex-shrink-0`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <span className={labelCls}>Cedente</span>
            <CedenteCombo cedentes={cedentes} value={f.codCedente} onChange={set('codCedente')} />
          </div>
          <Intervalo label="Vencimento" tipo="date" de={f.dtVenciIni} ate={f.dtVenciFim} onDe={set('dtVenciIni')} onAte={set('dtVenciFim')} />
          <Intervalo label="Valor" tipo="number" step="0.01" de={f.vrFaceMin} ate={f.vrFaceMax} onDe={set('vrFaceMin')} onAte={set('vrFaceMax')} />
          <Intervalo label="Emissão" tipo="date" de={f.dtEmissaoIni} ate={f.dtEmissaoFim} onDe={set('dtEmissaoIni')} onAte={set('dtEmissaoFim')} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className={labelCls}>Tipo</span>
            {TIPOS_INADIMPLENCIA.map((t) => (
              <label key={t} className="flex items-center gap-1.5 text-sm text-white cursor-pointer">
                <input type="checkbox" checked={f.tipos.includes(t)} onChange={() => toggleTipo(t)} className="w-4 h-4 accent-white cursor-pointer" />
                {t}
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { setF(FILTROS_INICIAIS); setErro('') }} className="px-3 py-2 text-xs text-[#a3a3a3] hover:text-white transition">
              Limpar filtros
            </button>
            <button type="submit" disabled={carregando} className="px-4 py-2 bg-white text-black text-sm font-medium rounded hover:opacity-90 transition disabled:opacity-50">
              {carregando ? 'Filtrando...' : 'Filtrar'}
            </button>
          </div>
        </div>
        {erro && <p className="text-xs text-[#ff8080]">{erro}</p>}
        {aviso && <p className="text-xs text-[#e0b050]">{aviso}</p>}
      </form>

      {/* Somatório por cedente (cedente = Todos) */}
      {aplicado.codCedente === '' && porCedente.length > 0 && (
        <div className={`${cardCls} p-5 flex flex-col gap-3 flex-shrink-0`}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Inadimplência por cedente</h2>
            <span className="text-xs text-[#a3a3a3]">{porCedente.length} cedente(s)</span>
          </div>
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#0a0a0a]">
                <tr className="text-[#666666] uppercase tracking-wider border-b border-[#1f1f1f]">
                  <th className="text-left py-2 px-2 font-semibold">Cód.</th>
                  <th className="text-left py-2 px-2 font-semibold">Cedente</th>
                  <th className="text-center py-2 px-2 font-semibold">Títulos</th>
                  <th className="text-right py-2 px-2 font-semibold">Total</th>
                  <th className="text-right py-2 px-2 font-semibold">Corrigido</th>
                </tr>
              </thead>
              <tbody>
                {porCedente.map((g) => (
                  <tr key={g.COD_CEDENTE} className="border-b border-[#161616] text-[#d4d4d4]">
                    <td className="py-1.5 px-2">{g.COD_CEDENTE}</td>
                    <td className="py-1.5 px-2">{g.NOME_CEDENTE}</td>
                    <td className="py-1.5 px-2 text-center">{g.qtd}</td>
                    <td className="py-1.5 px-2 text-right">{fmtMoeda(g.total)}</td>
                    <td className="py-1.5 px-2 text-right">{fmtMoeda(g.corrigido)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="text-white font-semibold">
                  <td className="py-2 px-2" colSpan={2}>Total geral</td>
                  <td className="py-2 px-2 text-center">{rows.length}</td>
                  <td className="py-2 px-2 text-right">{fmtMoeda(totalGeral)}</td>
                  <td className="py-2 px-2 text-right">{fmtMoeda(corrigidoGeral)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Títulos */}
      <div className={`${cardCls} p-5 flex flex-col gap-3 flex-1 min-h-[300px]`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-[#a3a3a3]">
            {rows.length} título(s) · {fmtMoeda(totalGeral)} (corrigido {fmtMoeda(corrigidoGeral)}) — <span className="text-white">{sel.size} selecionado(s) · {fmtMoeda(totalSel)} (corrigido {fmtMoeda(corrigidoSel)})</span>
          </p>
          <div ref={acoesRef} className="relative">
            <button type="button" onClick={() => setAcoesAberto((v) => !v)} className="px-4 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] text-white text-xs font-medium rounded hover:bg-[#222] transition flex items-center gap-2">
              Ações
              <svg className={`w-3 h-3 transition ${acoesAberto ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {acoesAberto && (
              <div className="absolute right-0 z-20 mt-1 w-56 bg-[#111111] border border-[#2a2a2a] rounded shadow-lg py-1">
                <button type="button" onClick={imprimir} disabled={sel.size === 0} className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#1a1a1a] disabled:text-[#555] disabled:hover:bg-transparent">
                  Imprimir selecionados ({sel.size})
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-auto flex-1 min-h-0 border border-[#1f1f1f] rounded">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#0f0f0f] z-10">
              <tr className="text-[#888] uppercase tracking-wider border-b border-[#1f1f1f]">
                <th className="py-2 px-2 w-8">
                  <input
                    type="checkbox"
                    checked={todosSel}
                    ref={(el) => { if (el) el.indeterminate = algunsSel }}
                    onChange={toggleTodos}
                    className="w-4 h-4 accent-white cursor-pointer"
                    title="Selecionar todos"
                  />
                </th>
                {COLUNAS.map((c) => (
                  <th key={c.key} onClick={() => ordenarPor(c.key)} className={`py-2 px-2 font-semibold cursor-pointer select-none hover:text-white whitespace-nowrap ${c.cls || 'text-left'}`}>
                    {c.label}
                    <span className="ml-1 text-white">{sort.key === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordenados.map((r) => (
                <tr key={r.KEY} onClick={() => toggleUm(r.KEY)} className={`border-b border-[#161616] cursor-pointer ${sel.has(r.KEY) ? 'text-[#e5e5e5]' : 'text-[#666]'} hover:bg-[#111111]`}>
                  <td className="py-1.5 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={sel.has(r.KEY)} onChange={() => toggleUm(r.KEY)} className="w-4 h-4 accent-white cursor-pointer" />
                  </td>
                  <td className="py-1.5 px-2 text-center">{r.COD_OPERACAO}</td>
                  <td className="py-1.5 px-2 text-center">{r.NUM_LANCAMENTO}</td>
                  <td className="py-1.5 px-2">{r.NUM_TITULO}</td>
                  <td className="py-1.5 px-2 text-center">{r.TIPO_TITULO}</td>
                  <td className="py-1.5 px-2">{r.NOME_SACADO || '—'}</td>
                  <td className="py-1.5 px-2 whitespace-nowrap">{fmtCic(r.CIC_SACADO)}</td>
                  <td className="py-1.5 px-2 text-center">{fmtData(r.DT_LANCA)}</td>
                  <td className="py-1.5 px-2 text-center whitespace-nowrap" title={r.PRORROGADO ? `Original: ${fmtData(r.DT_VENCI)}` : undefined}>
                    {fmtData(r.VENCIMENTO)}{r.PRORROGADO ? '*' : ''}
                  </td>
                  <td className="py-1.5 px-2 text-center">{r.DIAS_ATRASO}</td>
                  <td className="py-1.5 px-2 text-right whitespace-nowrap">{fmtMoeda(r.VR_FACE)}</td>
                  <td
                    className="py-1.5 px-2 text-right whitespace-nowrap"
                    title={r.TAXA_ATRASO == null ? 'Taxa de atraso não definida em OPEITE nem em CEDENTE' : `${r.TAXA_ATRASO}% a.m. (${r.ORIGEM_TAXA}) sobre ${fmtMoeda(r.BASE_CORRECAO)}`}
                  >
                    {r.VR_CORRIGIDO == null ? '—' : fmtMoeda(r.VR_CORRIGIDO)}
                  </td>
                </tr>
              ))}
              {!carregando && rows.length === 0 && (
                <tr><td colSpan={COLUNAS.length + 1} className="py-8 text-center text-[#666666]">Nenhum título inadimplente com esses filtros.</td></tr>
              )}
              {carregando && (
                <tr><td colSpan={COLUNAS.length + 1} className="py-8 text-center text-[#666666]">Carregando...</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-[#555]">* vencimento prorrogado (DT_VENCI_NOVO). Emissão = data de lançamento (DT_LANCA). Corrigido = saldo × (1 + taxa)^(dias/30), com a taxa % a.m. de OPEITE.TAXA_OCORRE ou, se vazia, CEDENTE.TAXA_OCORRENCIA.</p>
      </div>

      {/* Pré-visualização da impressão */}
      {pdfUrl && (
        <div className="flex flex-col gap-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#a3a3a3]">Impressão: {selecionados.length} título(s) · {fmtMoeda(totalSel)}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPdfUrl(null)} className="px-3 py-1.5 text-xs text-[#a3a3a3] hover:text-white transition">Fechar</button>
              <button onClick={baixar} className="px-4 py-1.5 bg-white text-black text-xs font-medium rounded hover:opacity-90 transition">Baixar PDF</button>
            </div>
          </div>
          <iframe title="Relatório de Inadimplência" src={pdfUrl} className="h-[600px] w-full rounded-lg border border-[#1f1f1f] bg-white" />
        </div>
      )}
    </div>
  )
}
