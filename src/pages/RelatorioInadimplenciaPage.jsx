import { Fragment, useState, useEffect, useMemo, useRef } from 'react'
import { getCedentesRelatorio } from '../services/relatorioBorderosService'
import { getTitulosInadimplentes, getStatusPorCedente, statusSelecionados, nomeRelatorio, totaisPorCedente, corrigidoOuValor, agruparTitulos, getBorderosCedente, getAnaliseSacados, somaLinhas, AGRUPAMENTOS, TIPOS_INADIMPLENCIA } from '../services/relatorioInadimplenciaService'
import CedenteCombo from '../components/Relatorios/CedenteCombo'
import { generateRelatorioInadimplenciaPDF, generateInadimplenciaTotalPDF, generateAnaliseSacadosPDF } from '../utils/relatorioInadimplenciaPdf'

const FILTROS_INICIAIS = {
  codCedente: '',
  codOperacao: '',
  dtVenciIni: '', dtVenciFim: '',
  vrFaceMin: '', vrFaceMax: '',
  dtEmissaoIni: '', dtEmissaoFim: '',
  tipos: [...TIPOS_INADIMPLENCIA],
  inadimplencia: true, // STATUS IN
  responsabilidade: false, // STATUS DO e PR
  analise: false, // análise dos sacados do borderô selecionado
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

const ANALISE_COLUNAS = [
  { label: 'Ced.', cls: 'text-center' },
  { label: 'Oper.', cls: 'text-center' },
  { label: 'Nº Título' },
  { label: 'Tipo', cls: 'text-center' },
  { label: 'Status', cls: 'text-center' },
  { label: 'Emissão', cls: 'text-center' },
  { label: 'Vencimento', cls: 'text-center' },
  { label: 'Dias atraso', cls: 'text-center' },
  { label: 'Valor', cls: 'text-right' },
  { label: 'Corrigido', cls: 'text-right' },
]

// Bloco detalhado da Análise (DO/PR ou IN) com subtotal.
function SecaoAnalise({ titulo, rows, soma }) {
  return (
    <>
      <tr className="border-b border-[#1a1a1a]">
        <td colSpan={ANALISE_COLUNAS.length} className="pt-2 pb-1 px-2 pl-4 text-[#a3a3a3] font-semibold">{titulo}</td>
      </tr>
      {rows.map((r) => (
        <tr key={r.KEY} className={`border-b border-[#161616] ${r.DO_BORDERO ? 'text-white' : 'text-[#c4c4c4]'}`}>
          <td className="py-1 px-2 text-center" title={r.NOME_CEDENTE}>{r.DO_BORDERO ? '► ' : ''}{r.COD_CEDENTE}</td>
          <td className="py-1 px-2 text-center">{r.COD_OPERACAO}</td>
          <td className="py-1 px-2">{r.NUM_TITULO}</td>
          <td className="py-1 px-2 text-center">{r.TIPO_TITULO}</td>
          <td className="py-1 px-2 text-center">{r.STATUS}</td>
          <td className="py-1 px-2 text-center">{fmtData(r.DT_LANCA)}</td>
          <td className="py-1 px-2 text-center whitespace-nowrap" title={r.PRORROGADO ? `Original: ${fmtData(r.DT_VENCI)}` : undefined}>{fmtData(r.VENCIMENTO)}{r.PRORROGADO ? '*' : ''}</td>
          <td className="py-1 px-2 text-center">{r.DIAS_ATRASO}</td>
          <td className="py-1 px-2 text-right whitespace-nowrap">{fmtMoeda(r.VR_FACE)}</td>
          <td className="py-1 px-2 text-right whitespace-nowrap">{r.VR_CORRIGIDO == null ? '—' : fmtMoeda(r.VR_CORRIGIDO)}</td>
        </tr>
      ))}
      {rows.length === 0 && (
        <tr className="border-b border-[#161616]"><td colSpan={ANALISE_COLUNAS.length} className="py-1 px-2 pl-6 text-[#666666]">Nenhum título</td></tr>
      )}
      <tr className="border-b border-[#2a2a2a] text-white font-semibold">
        <td colSpan={ANALISE_COLUNAS.length - 2} className="py-1.5 px-2 text-right">Subtotal ({soma.qtd} título{soma.qtd === 1 ? '' : 's'})</td>
        <td className="py-1.5 px-2 text-right whitespace-nowrap">{fmtMoeda(soma.total)}</td>
        <td className="py-1.5 px-2 text-right whitespace-nowrap">{fmtMoeda(soma.corrigido)}</td>
      </tr>
    </>
  )
}

// Linha de total (sem detalhar títulos) dos CO.
function ResumoCO({ titulo, r }) {
  return (
    <tr className="border-b border-[#2a2a2a] text-[#d4d4d4]">
      <td colSpan={ANALISE_COLUNAS.length - 2} className="py-1.5 px-2 pl-4"><span className="font-semibold">{titulo}</span> — {r.qtd} título{r.qtd === 1 ? '' : 's'}</td>
      <td className="py-1.5 px-2 text-right whitespace-nowrap font-semibold text-white">{fmtMoeda(r.total)}</td>
      <td className="py-1.5 px-2" />
    </tr>
  )
}

// Combobox dos borderôs do cedente (mais recente primeiro): nº, data, valor e qtd de títulos.
function BorderoCombo({ borderos, carregando, value, onChange }) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const fora = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [])
  const atual = borderos.find((b) => String(b.COD_OPERACAO) === String(value))
  const descricao = (b) => `Nº ${b.COD_OPERACAO} · ${fmtData(b.DATA)} · ${fmtMoeda(b.VR_FACE)} · ${b.QTD_TITULOS} título${b.QTD_TITULOS === 1 ? '' : 's'}`
  const escolher = (v) => { onChange(v); setAberto(false) }
  const texto = carregando ? 'Carregando borderôs...' : value === '' ? `Todos (${borderos.length} borderô${borderos.length === 1 ? '' : 's'})` : atual ? descricao(atual) : `Nº ${value}`

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setAberto((v) => !v)} className={`${inputCls} text-left flex items-center justify-between gap-2`}>
        <span className="truncate">{texto}</span>
        <svg className={`w-3 h-3 flex-shrink-0 transition ${aberto ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {aberto && (
        <div className="absolute z-20 mt-1 w-full min-w-[22rem] max-h-72 overflow-auto bg-[#111111] border border-[#2a2a2a] rounded shadow-lg">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#111111] text-[#666666] uppercase tracking-wider">
              <tr>
                <th className="text-left py-1.5 px-3 font-semibold">Nº</th>
                <th className="text-center py-1.5 px-2 font-semibold">Data</th>
                <th className="text-right py-1.5 px-2 font-semibold">Valor total</th>
                <th className="text-center py-1.5 px-3 font-semibold">Títulos</th>
              </tr>
            </thead>
            <tbody>
              <tr onClick={() => escolher('')} className={`cursor-pointer hover:bg-[#1a1a1a] ${value === '' ? 'text-white font-semibold' : 'text-[#a3a3a3]'}`}>
                <td colSpan={4} className="py-1.5 px-3">Todos</td>
              </tr>
              {borderos.map((b) => (
                <tr key={b.COD_OPERACAO} onClick={() => escolher(String(b.COD_OPERACAO))} className={`cursor-pointer hover:bg-[#1a1a1a] ${String(b.COD_OPERACAO) === String(value) ? 'text-white font-semibold' : 'text-[#d4d4d4]'}`}>
                  <td className="py-1.5 px-3">{b.COD_OPERACAO}</td>
                  <td className="py-1.5 px-2 text-center">{fmtData(b.DATA)}</td>
                  <td className="py-1.5 px-2 text-right whitespace-nowrap">{fmtMoeda(b.VR_FACE)}</td>
                  <td className="py-1.5 px-3 text-center">{b.QTD_TITULOS}</td>
                </tr>
              ))}
              {!carregando && borderos.length === 0 && (
                <tr><td colSpan={4} className="py-1.5 px-3 text-[#666666]">Nenhum borderô para este cedente</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function RelatorioInadimplenciaPage() {
  const [f, setF] = useState(FILTROS_INICIAIS)
  const [aplicado, setAplicado] = useState(FILTROS_INICIAIS) // filtros da última busca
  const [todosCedentes, setTodosCedentes] = useState([])
  const [statusPorCedente, setStatusPorCedente] = useState(null) // Map(cod -> Set(status))
  const [rows, setRows] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [sel, setSel] = useState(new Set())
  const [selCed, setSelCed] = useState(new Set()) // cedentes marcados no somatório (filtro = Todos)
  const [sort, setSort] = useState({ key: 'VENCIMENTO', dir: 'asc' })
  const [agrupamento, setAgrupamento] = useState('nenhum') // nenhum | cedente | sacado
  const [borderos, setBorderos] = useState([]) // borderôs do cedente escolhido
  const [carregandoBorderos, setCarregandoBorderos] = useState(false)
  const [analise, setAnalise] = useState([]) // resultado da Análise (por sacado)

  useEffect(() => {
    if (f.codCedente === '') { setBorderos([]); return }
    let ativo = true
    setCarregandoBorderos(true)
    getBorderosCedente(f.codCedente).then(({ data }) => {
      if (ativo) { setBorderos(data || []); setCarregandoBorderos(false) }
    })
    return () => { ativo = false }
  }, [f.codCedente])
  const [acoesAberto, setAcoesAberto] = useState(false)
  const [pdfUrl, setPdfUrl] = useState(null)
  const acoesRef = useRef(null)

  useEffect(() => {
    Promise.all([getCedentesRelatorio(), getStatusPorCedente()]).then(([ced, st]) => {
      setTodosCedentes(ced.data || [])
      setStatusPorCedente(st.data)
    })
    buscar(FILTROS_INICIAIS)
  }, [])

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl) }, [pdfUrl])

  useEffect(() => {
    const fora = (e) => { if (acoesRef.current && !acoesRef.current.contains(e.target)) setAcoesAberto(false) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [])

  // Combobox: só os cedentes com títulos nos status marcados (IN e/ou DO/PR)
  const cedentes = useMemo(() => {
    if (!statusPorCedente || f.analise) return todosCedentes
    const status = statusSelecionados(f)
    return todosCedentes.filter((c) => {
      const st = statusPorCedente.get(Number(c.COD_CEDENTE))
      return st && status.some((x) => st.has(x))
    })
  }, [todosCedentes, statusPorCedente, f.inadimplencia, f.responsabilidade, f.analise])

  const set = (k) => (v) => setF((prev) => ({ ...prev, [k]: v }))
  const toggle = (k) => () => setF((prev) => ({ ...prev, [k]: !prev[k] }))
  const toggleTipo = (t) =>
    setF((prev) => ({ ...prev, tipos: prev.tipos.includes(t) ? prev.tipos.filter((x) => x !== t) : [...prev.tipos, t] }))

  async function buscar(filtros) {
    setErro('')
    if (filtros.tipos.length === 0) { setErro('Selecione ao menos um tipo de título.'); return }
    if (filtros.analise) {
      if (filtros.codCedente === '' || filtros.codOperacao === '') { setErro('Para a Análise, escolha um cedente e um borderô.'); return }
      setCarregando(true)
      try {
        const { data, error, parametrosOk } = await getAnaliseSacados(filtros)
        if (error) throw error
        setAviso(parametrosOk ? '' : 'Não foi possível ler todas as taxas de atraso no Firebird — alguns títulos estão sem valor corrigido.')
        setAnalise(data)
        setRows([]); setSel(new Set()); setSelCed(new Set())
        setAplicado(filtros)
        setPdfUrl(null)
      } catch (err) {
        setErro(`Erro na análise: ${err?.message || err}`)
      } finally {
        setCarregando(false)
      }
      return
    }
    if (!filtros.inadimplencia && !filtros.responsabilidade) { setErro('Marque Inadimplência e/ou Responsabilidade.'); return }
    setCarregando(true)
    try {
      setAnalise([])
      const { data, error, parametrosOk } = await getTitulosInadimplentes(filtros)
      if (error) throw error
      setAviso(parametrosOk ? '' : 'Não foi possível ler todas as taxas de atraso no Firebird — alguns títulos estão sem valor corrigido.')
      setRows(data)
      setAplicado(filtros)
      setSel(new Set(data.map((r) => r.KEY))) // começa com todos selecionados
      setSelCed(new Set(data.map((r) => r.COD_CEDENTE)))
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

  const grupos = useMemo(() => agruparTitulos(ordenados, agrupamento), [ordenados, agrupamento])
  const agrupado = agrupamento !== 'nenhum'
  // Ordem de impressão = ordem da tela (agrupada, se for o caso)
  const selecionados = grupos.flatMap((g) => g.rows).filter((r) => sel.has(r.KEY))
  const rotuloGrupo = (g) => (agrupamento === 'cedente'
    ? `Cedente ${g.cod} - ${g.nome || '—'}`
    : `Sacado: ${g.nome || '(sem sacado)'}${g.cic ? ` · ${fmtCic(g.cic)}` : ''}`)
  const totalSel = selecionados.reduce((s, r) => s + r.VR_FACE, 0)
  const totalGeral = rows.reduce((s, r) => s + r.VR_FACE, 0)
  const corrigidoSel = selecionados.reduce((s, r) => s + corrigidoOuValor(r), 0)
  const corrigidoGeral = rows.reduce((s, r) => s + corrigidoOuValor(r), 0)
  const porCedente = useMemo(() => (aplicado.codCedente === '' ? totaisPorCedente(rows) : []), [rows, aplicado.codCedente])

  const nomeAplicado = nomeRelatorio(aplicado)
  const nomeCedenteAplicado = nomeDe(todosCedentes.find((c) => String(c.COD_CEDENTE) === String(aplicado.codCedente)))

  const todosCedSel = porCedente.length > 0 && porCedente.every((g) => selCed.has(g.COD_CEDENTE))
  const algunsCedSel = !todosCedSel && porCedente.some((g) => selCed.has(g.COD_CEDENTE))
  const toggleTodosCed = () => setSelCed(todosCedSel ? new Set() : new Set(porCedente.map((g) => g.COD_CEDENTE)))
  const toggleCed = (c) => setSelCed((prev) => {
    const n = new Set(prev)
    n.has(c) ? n.delete(c) : n.add(c)
    return n
  })
  const cedentesSel = porCedente.filter((g) => selCed.has(g.COD_CEDENTE))

  const [tituloPdf, setTituloPdf] = useState('')

  const imprimir = () => {
    setAcoesAberto(false)
    if (selecionados.length === 0) { setErro('Selecione ao menos um título para imprimir.'); return }
    const blob = generateRelatorioInadimplenciaPDF(selecionados, aplicado, nomeCedenteAplicado, agrupamento)
    setTituloPdf(`Impressão: ${selecionados.length} título(s) · ${fmtMoeda(totalSel)}`)
    setPdfUrl(URL.createObjectURL(blob))
  }

  const imprimirTotal = () => {
    setAcoesAberto(false)
    if (cedentesSel.length === 0) { setErro('Marque ao menos um cedente para imprimir o total.'); return }
    const blob = generateInadimplenciaTotalPDF(cedentesSel, aplicado)
    setTituloPdf(`Impressão: ${nomeAplicado} total · ${cedentesSel.length} cedente(s) · ${fmtMoeda(cedentesSel.reduce((s, g) => s + g.total, 0))}`)
    setPdfUrl(URL.createObjectURL(blob))
  }

  const totaisAnalise = useMemo(() => analise.map((s) => ({ ...s, somaAVencer: somaLinhas(s.aVencer), somaIN: somaLinhas(s.inadimplentes) })), [analise])

  const imprimirAnalise = () => {
    setAcoesAberto(false)
    if (totaisAnalise.length === 0) { setErro('Nenhum sacado na análise para imprimir.'); return }
    const blob = generateAnaliseSacadosPDF(totaisAnalise, aplicado, nomeCedenteAplicado)
    setTituloPdf(`Impressão: Análise · ${totaisAnalise.length} sacado(s) · borderô ${aplicado.codOperacao}`)
    setPdfUrl(URL.createObjectURL(blob))
  }

  const baixar = () => {
    if (!pdfUrl) return
    const a = document.createElement('a')
    a.href = pdfUrl
    a.download = `relatorio_${nomeAplicado.toLowerCase().normalize('NFD').replace(/[^a-z]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
    a.click()
  }

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <div>
        <h1 className="text-2xl font-bold text-white">{nomeAplicado}</h1>
        <p className="text-sm text-[#666666] mt-1">Títulos de OPEITE (DUP, CHE e PRO) — Inadimplência: status IN · Responsabilidade: status DO e PR</p>
      </div>

      {/* Filtros */}
      <form onSubmit={filtrar} className={`${cardCls} p-5 flex flex-col gap-4 flex-shrink-0`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <span className={labelCls}>Cedente</span>
            <CedenteCombo
              cedentes={cedentes}
              value={f.codCedente}
              onChange={(v) => setF((prev) => (String(prev.codCedente) === String(v) ? prev : { ...prev, codCedente: v, codOperacao: '' }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={labelCls}>Borderô</span>
            {f.codCedente !== ''
              ? <BorderoCombo borderos={borderos} carregando={carregandoBorderos} value={f.codOperacao} onChange={set('codOperacao')} />
              : <input type="number" min="1" step="1" value={f.codOperacao} onChange={(e) => set('codOperacao')(e.target.value)} className={inputCls} placeholder="Nº do borderô (COD_OPERACAO)" />}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={labelCls}>Agrupamento</span>
            <div className="flex flex-col gap-1">
              {AGRUPAMENTOS.map((a) => (
                <label key={a.value} className="flex items-center gap-1.5 text-sm text-white cursor-pointer">
                  <input type="radio" name="agrupamento" value={a.value} checked={agrupamento === a.value} onChange={() => setAgrupamento(a.value)} className="w-4 h-4 accent-white cursor-pointer" />
                  {a.label}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <span className="w-px h-5 bg-[#2a2a2a] mx-1" />
            <label className="flex items-center gap-1.5 text-sm text-white cursor-pointer" title="Títulos com status IN">
              <input type="checkbox" checked={f.inadimplencia} onChange={toggle('inadimplencia')} className="w-4 h-4 accent-white cursor-pointer" />
              Inadimplência
            </label>
            <label className="flex items-center gap-1.5 text-sm text-white cursor-pointer" title="Títulos com status DO e PR">
              <input type="checkbox" checked={f.responsabilidade} onChange={toggle('responsabilidade')} className="w-4 h-4 accent-white cursor-pointer" />
              Responsabilidade
            </label>
            <label className="flex items-center gap-1.5 text-sm text-white cursor-pointer" title="Analisa os sacados do borderô selecionado (exige cedente e borderô)">
              <input type="checkbox" checked={f.analise} onChange={toggle('analise')} className="w-4 h-4 accent-white cursor-pointer" />
              Análise
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { setF(FILTROS_INICIAIS); setErro('') }} className="px-3 py-2 text-xs text-[#a3a3a3] hover:text-white transition">
              Limpar filtros
            </button>
            <button type="submit" disabled={carregando} className="px-4 py-2 bg-white text-black text-sm font-medium rounded hover:opacity-90 transition disabled:opacity-50">
              {carregando ? 'Filtrando...' : 'Filtrar'}
            </button>
            <div ref={acoesRef} className="relative">
              <button type="button" onClick={() => setAcoesAberto((v) => !v)} className="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-white text-sm font-medium rounded hover:bg-[#222] transition flex items-center gap-2">
                Ações
                <svg className={`w-3 h-3 transition ${acoesAberto ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {acoesAberto && (
                <div className="absolute right-0 z-20 mt-1 w-72 bg-[#111111] border border-[#2a2a2a] rounded shadow-lg py-1">
                  {aplicado.analise ? (
                  <button type="button" onClick={imprimirAnalise} disabled={analise.length === 0} className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#1a1a1a] disabled:text-[#555] disabled:hover:bg-transparent">
                    Imprimir análise ({analise.length} sacado{analise.length === 1 ? '' : 's'})
                  </button>
                  ) : (<>
                  <button type="button" onClick={imprimir} disabled={sel.size === 0} className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#1a1a1a] disabled:text-[#555] disabled:hover:bg-transparent">
                    Imprimir títulos selecionados ({sel.size})
                  </button>
                  <button
                    type="button"
                    onClick={imprimirTotal}
                    disabled={aplicado.codCedente !== '' || cedentesSel.length === 0}
                    title={aplicado.codCedente !== '' ? 'Disponível quando o filtro de cedente é Todos' : undefined}
                    className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#1a1a1a] disabled:text-[#555] disabled:hover:bg-transparent"
                  >
                    Imprimir total por cedente ({cedentesSel.length} cedente{cedentesSel.length === 1 ? '' : 's'})
                  </button>
                  </>)}
                </div>
              )}
            </div>
          </div>
        </div>
        {erro && <p className="text-xs text-[#ff8080]">{erro}</p>}
        {aviso && <p className="text-xs text-[#e0b050]">{aviso}</p>}
      </form>

      {/* Somatório por cedente (cedente = Todos) */}
      {aplicado.codCedente === '' && porCedente.length > 0 && (
        <div className={`${cardCls} p-5 flex flex-col gap-3 flex-shrink-0`}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">{nomeAplicado} por cedente</h2>
            <span className="text-xs text-[#a3a3a3]">{porCedente.length} cedente(s) — <span className="text-white">{cedentesSel.length} marcado(s)</span></span>
          </div>
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#0a0a0a]">
                <tr className="text-[#666666] uppercase tracking-wider border-b border-[#1f1f1f]">
                  <th className="py-2 px-2 w-8">
                    <input
                      type="checkbox"
                      checked={todosCedSel}
                      ref={(el) => { if (el) el.indeterminate = algunsCedSel }}
                      onChange={toggleTodosCed}
                      className="w-4 h-4 accent-white cursor-pointer"
                      title="Marcar todos os cedentes"
                    />
                  </th>
                  <th className="text-left py-2 px-2 font-semibold">Cód.</th>
                  <th className="text-left py-2 px-2 font-semibold">Cedente</th>
                  <th className="text-center py-2 px-2 font-semibold">Títulos</th>
                  <th className="text-right py-2 px-2 font-semibold">Total</th>
                  <th className="text-right py-2 px-2 font-semibold">Corrigido</th>
                </tr>
              </thead>
              <tbody>
                {porCedente.map((g) => (
                  <tr key={g.COD_CEDENTE} onClick={() => toggleCed(g.COD_CEDENTE)} className={`border-b border-[#161616] cursor-pointer hover:bg-[#111111] ${selCed.has(g.COD_CEDENTE) ? 'text-[#d4d4d4]' : 'text-[#666]'}`}>
                    <td className="py-1.5 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selCed.has(g.COD_CEDENTE)} onChange={() => toggleCed(g.COD_CEDENTE)} className="w-4 h-4 accent-white cursor-pointer" />
                    </td>
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
                  <td className="py-2 px-2" colSpan={3}>Total geral</td>
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
      {!aplicado.analise && (
      <div className={`${cardCls} p-5 flex flex-col gap-3 flex-1 min-h-[300px]`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-[#a3a3a3]">
            {rows.length} título(s) · {fmtMoeda(totalGeral)} (corrigido {fmtMoeda(corrigidoGeral)}) — <span className="text-white">{sel.size} selecionado(s) · {fmtMoeda(totalSel)} (corrigido {fmtMoeda(corrigidoSel)})</span>
          </p>
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
              {grupos.map((g) => (
                <Fragment key={g.chave}>
                {agrupado && (
                  <tr className="bg-[#141414] border-b border-[#1f1f1f]">
                    <td colSpan={COLUNAS.length + 1} className="py-2 px-2 text-white font-semibold">{rotuloGrupo(g)}</td>
                  </tr>
                )}
                {g.rows.map((r) => (
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
                    title={r.ORIGEM_TAXA === 'A VENCER' ? 'A vencer: corrigido = valor' : r.TAXA_ATRASO == null ? 'Taxa de atraso não definida em OPEITE nem em CEDENTE' : `${r.TAXA_ATRASO}% a.m. (${r.ORIGEM_TAXA}) sobre ${fmtMoeda(r.BASE_CORRECAO)}`}
                  >
                    {r.VR_CORRIGIDO == null ? '—' : fmtMoeda(r.VR_CORRIGIDO)}
                  </td>
                </tr>
                ))}
                {agrupado && (
                  <tr className="border-b border-[#2a2a2a] text-white font-semibold">
                    <td colSpan={COLUNAS.length - 1} className="py-1.5 px-2 text-right">Subtotal ({g.qtd} título{g.qtd === 1 ? '' : 's'})</td>
                    <td className="py-1.5 px-2 text-right whitespace-nowrap">{fmtMoeda(g.total)}</td>
                    <td className="py-1.5 px-2 text-right whitespace-nowrap">{fmtMoeda(g.corrigido)}</td>
                  </tr>
                )}
                </Fragment>
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
      )}

      {/* Análise dos sacados do borderô */}
      {aplicado.analise && (
        <div className={`${cardCls} p-5 flex flex-col gap-3 flex-1 min-h-[300px]`}>
          <p className="text-xs text-[#a3a3a3]">
            Análise dos sacados do borderô <span className="text-white">{aplicado.codOperacao}</span> do cedente <span className="text-white">{aplicado.codCedente} - {nomeCedenteAplicado}</span> — {analise.length} sacado(s). Considera todos os títulos de cada sacado, em todos os cedentes.
          </p>
          <div className="overflow-auto flex-1 min-h-0 border border-[#1f1f1f] rounded">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#0f0f0f] z-10">
                <tr className="text-[#888] uppercase tracking-wider border-b border-[#1f1f1f]">
                  {ANALISE_COLUNAS.map((c) => <th key={c.label} className={`py-2 px-2 font-semibold whitespace-nowrap ${c.cls || 'text-left'}`}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {totaisAnalise.map((s) => (
                  <Fragment key={s.COD_SACADO}>
                    <tr className="bg-[#161616] border-b border-[#1f1f1f]">
                      <td colSpan={ANALISE_COLUNAS.length} className="py-2 px-2 text-white font-semibold">
                        Sacado: {s.NOME_SACADO || '(sem nome)'}{s.CIC_SACADO ? ` · ${fmtCic(s.CIC_SACADO)}` : ''}
                      </td>
                    </tr>
                    <SecaoAnalise titulo="A vencer / Responsabilidade (DO, PR)" rows={s.aVencer} soma={s.somaAVencer} />
                    {s.inadimplentes.length > 0 && <SecaoAnalise titulo="Inadimplência (IN)" rows={s.inadimplentes} soma={s.somaIN} />}
                    <ResumoCO titulo="Pagos até o vencimento (CO)" r={s.coEmDia} />
                    <ResumoCO titulo="Pagos após o vencimento (CO)" r={s.coAtraso} />
                  </Fragment>
                ))}
                {!carregando && analise.length === 0 && (
                  <tr><td colSpan={ANALISE_COLUNAS.length} className="py-8 text-center text-[#666666]">Nenhum sacado encontrado neste borderô.</td></tr>
                )}
                {carregando && (
                  <tr><td colSpan={ANALISE_COLUNAS.length} className="py-8 text-center text-[#666666]">Carregando...</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-[#555]">► título deste borderô. CO em dia = pago (OPEITE.DT_OCORRE) até o vencimento; vencimento em sábado/domingo vale até a segunda-feira. Dados dos sacados lidos do Firebird.</p>
        </div>
      )}

      {/* Pré-visualização da impressão */}
      {pdfUrl && (
        <div className="flex flex-col gap-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#a3a3a3]">{tituloPdf}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPdfUrl(null)} className="px-3 py-1.5 text-xs text-[#a3a3a3] hover:text-white transition">Fechar</button>
              <button onClick={baixar} className="px-4 py-1.5 bg-white text-black text-xs font-medium rounded hover:opacity-90 transition">Baixar PDF</button>
            </div>
          </div>
          <iframe title={`Relatório de ${nomeAplicado}`} src={pdfUrl} className="h-[600px] w-full rounded-lg border border-[#1f1f1f] bg-white" />
        </div>
      )}
    </div>
  )
}
