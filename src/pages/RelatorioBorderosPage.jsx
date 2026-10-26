import { useState, useEffect } from 'react'
import { getCedentesRelatorio, getTitulosRelatorioBorderos, STATUS_RELATORIO } from '../services/relatorioBorderosService'
import { generateRelatorioBorderosPDF } from '../utils/relatorioBorderosPdf'

const FILTROS_INICIAIS = {
  dtLancaIni: '', dtLancaFim: '',
  vrFaceMin: '', vrFaceMax: '',
  dtVenciIni: '', dtVenciFim: '',
  dtVenciNovoIni: '', dtVenciNovoFim: '',
  codOperacao: '', codCedente: '',
  status: STATUS_RELATORIO.map((s) => s.value),
}

const inputCls = 'px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-xs focus:border-white outline-none transition w-full'
const labelCls = 'text-xs font-semibold text-[#a3a3a3] uppercase tracking-wider'

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

export default function RelatorioBorderosPage() {
  const [f, setF] = useState(FILTROS_INICIAIS)
  const [cedentes, setCedentes] = useState([])
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState('')
  const [pdfUrl, setPdfUrl] = useState(null)
  const [resumo, setResumo] = useState(null)

  useEffect(() => {
    getCedentesRelatorio().then(({ data }) => setCedentes(data))
  }, [])

  // Libera o blob anterior ao trocar/desmontar
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl) }, [pdfUrl])

  const set = (k) => (v) => setF((prev) => ({ ...prev, [k]: v }))

  const toggleStatus = (s) =>
    setF((prev) => ({
      ...prev,
      status: prev.status.includes(s) ? prev.status.filter((x) => x !== s) : [...prev.status, s],
    }))

  const nomeCedente = (cod) => {
    const c = cedentes.find((x) => String(x.COD_CEDENTE) === String(cod))
    return c ? (c.RAZAO_SOCIAL || c.NOME_FANTASIA || '') : ''
  }

  const gerar = async (e) => {
    e.preventDefault()
    setErro('')
    if (f.status.length === 0) { setErro('Selecione ao menos um status.'); return }
    setGerando(true)
    try {
      const { data, error } = await getTitulosRelatorioBorderos(f)
      if (error) throw error
      if (data.length === 0) {
        setErro('Nenhum título encontrado com esses filtros.')
        setPdfUrl(null)
        setResumo(null)
        return
      }
      const blob = generateRelatorioBorderosPDF(data, f, nomeCedente(f.codCedente))
      setPdfUrl(URL.createObjectURL(blob))
      const borderos = new Set(data.map((r) => `${r.COD_CEDENTE}|${r.COD_OPERACAO}`)).size
      const total = data.reduce((s, r) => s + (parseFloat(r.VR_FACE) || 0), 0)
      setResumo({ titulos: data.length, borderos, total })
    } catch (err) {
      setErro(`Erro ao gerar relatório: ${err?.message || err}`)
    } finally {
      setGerando(false)
    }
  }

  const baixar = () => {
    if (!pdfUrl) return
    const a = document.createElement('a')
    a.href = pdfUrl
    a.download = `relatorio_borderos_${new Date().toISOString().slice(0, 10)}.pdf`
    a.click()
  }

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <div>
        <h1 className="text-2xl font-bold text-white">Relatório de Borderôs</h1>
        <p className="text-sm text-[#666666] mt-1">Títulos agrupados por borderô e vencimento — PDF em modo retrato</p>
      </div>

      <form onSubmit={gerar} className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-5 flex flex-col gap-4 flex-shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Intervalo label="Data de lançamento" tipo="date" de={f.dtLancaIni} ate={f.dtLancaFim} onDe={set('dtLancaIni')} onAte={set('dtLancaFim')} />
          <Intervalo label="Valor de face" tipo="number" step="0.01" de={f.vrFaceMin} ate={f.vrFaceMax} onDe={set('vrFaceMin')} onAte={set('vrFaceMax')} />
          <Intervalo label="Vencimento" tipo="date" de={f.dtVenciIni} ate={f.dtVenciFim} onDe={set('dtVenciIni')} onAte={set('dtVenciFim')} />
          <Intervalo label="Vencimento novo (prorrogação)" tipo="date" de={f.dtVenciNovoIni} ate={f.dtVenciNovoFim} onDe={set('dtVenciNovoIni')} onAte={set('dtVenciNovoFim')} />

          <div className="flex flex-col gap-1.5">
            <span className={labelCls}>Operação (borderô)</span>
            <input type="number" value={f.codOperacao} onChange={(e) => set('codOperacao')(e.target.value)} className={inputCls} placeholder="Todas" />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={labelCls}>Cedente</span>
            <select value={f.codCedente} onChange={(e) => set('codCedente')(e.target.value)} className={`${inputCls} cursor-pointer`}>
              <option value="">Todos</option>
              {cedentes.map((c) => (
                <option key={c.COD_CEDENTE} value={String(c.COD_CEDENTE)}>
                  {c.COD_CEDENTE} - {c.RAZAO_SOCIAL || c.NOME_FANTASIA || ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className={labelCls}>Status</span>
            {STATUS_RELATORIO.map((s) => (
              <label key={s.value} className="flex items-center gap-1.5 text-sm text-white cursor-pointer">
                <input type="checkbox" checked={f.status.includes(s.value)} onChange={() => toggleStatus(s.value)} className="w-4 h-4 accent-white cursor-pointer" />
                {s.label}
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { setF(FILTROS_INICIAIS); setErro('') }} className="px-3 py-2 text-xs text-[#a3a3a3] hover:text-white transition">
              Limpar filtros
            </button>
            <button type="submit" disabled={gerando} className="px-4 py-2 bg-white text-black text-sm font-medium rounded hover:opacity-90 transition disabled:opacity-50">
              {gerando ? 'Gerando...' : 'Gerar relatório'}
            </button>
          </div>
        </div>

        {erro && <p className="text-xs text-[#ff8080]">{erro}</p>}
      </form>

      {pdfUrl && (
        <div className="flex flex-col gap-2 flex-1 min-h-0">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#a3a3a3]">
              {resumo.borderos} borderô(s) · {resumo.titulos} título(s) · Total{' '}
              {resumo.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            <button onClick={baixar} className="px-4 py-1.5 bg-white text-black text-xs font-medium rounded hover:opacity-90 transition">
              Baixar PDF
            </button>
          </div>
          <iframe title="Relatório de Borderôs" src={pdfUrl} className="flex-1 min-h-[400px] w-full rounded-lg border border-[#1f1f1f] bg-white" />
        </div>
      )}
    </div>
  )
}
