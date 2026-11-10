import { useState, useEffect, useRef } from 'react'
import { getCedentesRelatorio } from '../services/relatorioBorderosService'
import { getExtratoContaCorrente, dcSaldo } from '../services/relatorioContaCorrenteService'
import { generateExtratoContaCorrentePDF } from '../utils/relatorioContaCorrentePdf'
import CedenteCombo from '../components/Relatorios/CedenteCombo'

const inputCls = 'px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-xs focus:border-white outline-none transition w-full'
const labelCls = 'text-xs font-semibold text-[#a3a3a3] uppercase tracking-wider'
const cardCls = 'bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg'

const fmtValor = (v) =>
  Math.abs(parseFloat(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtData = (d) => {
  const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}
const nomeDe = (c) => (c ? (c.RAZAO_SOCIAL || c.NOME_FANTASIA || '') : '')

const corDC = (dc) => (dc === 'D' ? 'text-[#ff8080]' : 'text-[#7ee2a8]')

export default function RelatorioContaCorrentePage() {
  const [cedentes, setCedentes] = useState([])
  const [codCedente, setCodCedente] = useState('')
  const [dtIni, setDtIni] = useState('') // vazio = desde a última vez que o saldo zerou
  const [extrato, setExtrato] = useState(null)
  const [aplicado, setAplicado] = useState(null) // { codCedente, dtIni, nomeCedente }
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [acoesAberto, setAcoesAberto] = useState(false)
  const [pdfUrl, setPdfUrl] = useState(null)
  const acoesRef = useRef(null)

  useEffect(() => {
    getCedentesRelatorio().then(({ data }) => setCedentes(data))
  }, [])

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl) }, [pdfUrl])

  useEffect(() => {
    const fora = (e) => { if (acoesRef.current && !acoesRef.current.contains(e.target)) setAcoesAberto(false) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [])

  async function gerar(e) {
    e.preventDefault()
    setErro('')
    if (!codCedente) { setErro('Selecione o cedente.'); return }
    setCarregando(true)
    setPdfUrl(null)
    try {
      const { data, error } = await getExtratoContaCorrente(codCedente, dtIni)
      if (error) throw error
      const nomeCedente = nomeDe(cedentes.find((c) => String(c.COD_CEDENTE) === String(codCedente)))
      setExtrato(data)
      setAplicado({ codCedente, dtIni: data.dtIni, desdeZerado: data.desdeZerado, nomeCedente })
    } catch (err) {
      setErro(`Erro ao ler a conta corrente: ${err?.message || err}`)
      setExtrato(null)
    } finally {
      setCarregando(false)
    }
  }

  const imprimir = () => {
    setAcoesAberto(false)
    if (!extrato) return
    const blob = generateExtratoContaCorrentePDF(extrato, aplicado)
    setPdfUrl(URL.createObjectURL(blob))
  }

  const baixar = () => {
    if (!pdfUrl) return
    const a = document.createElement('a')
    a.href = pdfUrl
    a.download = `extrato_conta_corrente_${aplicado.codCedente}_${new Date().toISOString().slice(0, 10)}.pdf`
    a.click()
  }

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <div>
        <h1 className="text-2xl font-bold text-white">Conta Corrente</h1>
        <p className="text-sm text-[#666666] mt-1">Extrato da conta corrente do cedente (CTACORRENTE do Firebird)</p>
      </div>

      {/* Filtros */}
      <form onSubmit={gerar} className={`${cardCls} p-5 flex flex-col gap-4 flex-shrink-0`}>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5 flex-1 min-w-[260px]">
            <span className={labelCls}>Cedente</span>
            <CedenteCombo cedentes={cedentes} value={codCedente} onChange={setCodCedente} permitirTodos={false} />
          </div>
          <div className="flex flex-col gap-1.5 w-48">
            <span className={labelCls}>A partir de</span>
            <div className="flex items-center gap-1">
              <input type="date" value={dtIni} onChange={(e) => setDtIni(e.target.value)} className={inputCls} title="Vazio = desde a última vez que o saldo ficou zerado" />
              {dtIni && (
                <button type="button" onClick={() => setDtIni('')} className="px-1.5 text-[#888] hover:text-white" title="Voltar para o último saldo zerado">×</button>
              )}
            </div>
            <span className="text-[10px] text-[#666]">{dtIni ? 'Data informada' : 'Vazio: desde o último saldo zerado'}</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" disabled={carregando} className="px-4 py-2 bg-white text-black text-sm font-medium rounded hover:opacity-90 transition disabled:opacity-50">
              {carregando ? 'Gerando...' : 'Gerar'}
            </button>
            <div ref={acoesRef} className="relative">
              <button type="button" onClick={() => setAcoesAberto((v) => !v)} className="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-white text-sm font-medium rounded hover:bg-[#222] transition flex items-center gap-2">
                Ações
                <svg className={`w-3 h-3 transition ${acoesAberto ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {acoesAberto && (
                <div className="absolute right-0 z-20 mt-1 w-56 bg-[#111111] border border-[#2a2a2a] rounded shadow-lg py-1">
                  <button type="button" onClick={imprimir} disabled={!extrato} className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#1a1a1a] disabled:text-[#555] disabled:hover:bg-transparent">
                    Imprimir extrato
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        {erro && <p className="text-xs text-[#ff8080]">{erro}</p>}
      </form>

      {/* Extrato */}
      {extrato && (
        <div className={`${cardCls} p-5 flex flex-col gap-3 flex-1 min-h-[300px]`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-white font-semibold">{aplicado.codCedente} - {aplicado.nomeCedente}</p>
            <p className="text-xs text-[#a3a3a3]">
              A partir de {fmtData(aplicado.dtIni)}{aplicado.desdeZerado ? ' (último saldo zerado)' : ''} · {extrato.lancamentos.length} lançamento(s) · saldo atual{' '}
              <span className={corDC(dcSaldo(extrato.saldoFinal))}>{fmtValor(extrato.saldoFinal)} {dcSaldo(extrato.saldoFinal)}</span>
            </p>
          </div>
          <div className="overflow-auto flex-1 min-h-0 border border-[#1f1f1f] rounded">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#0f0f0f] z-10">
                <tr className="text-[#888] uppercase tracking-wider border-b border-[#1f1f1f]">
                  <th className="py-2 px-2 text-left font-semibold">Data</th>
                  <th className="py-2 px-2 text-right font-semibold">Valor</th>
                  <th className="py-2 px-1 w-6" />
                  <th className="py-2 px-2 text-left font-semibold">Histórico</th>
                  <th className="py-2 px-2 text-right font-semibold">Saldo</th>
                  <th className="py-2 px-1 w-6" />
                </tr>
              </thead>
              <tbody>
                {/* Do mais novo para o mais antigo; o saldo anterior fica no fim */}
                {[...extrato.lancamentos].reverse().map((l) => (
                  <tr key={l.ID} className="border-b border-[#161616] text-[#d4d4d4] hover:bg-[#111111]">
                    <td className="py-1.5 px-2 whitespace-nowrap">{fmtData(l.DATA)}</td>
                    <td className="py-1.5 px-2 text-right whitespace-nowrap">{fmtValor(l.VALOR)}</td>
                    <td className={`py-1.5 px-1 text-center ${corDC(l.DC)}`}>{l.DC}</td>
                    <td className="py-1.5 px-2">{l.HISTORICO}</td>
                    <td className="py-1.5 px-2 text-right whitespace-nowrap">{fmtValor(l.SALDO)}</td>
                    <td className={`py-1.5 px-1 text-center ${corDC(dcSaldo(l.SALDO))}`}>{dcSaldo(l.SALDO)}</td>
                  </tr>
                ))}
                {extrato.lancamentos.length === 0 && (
                  <tr><td colSpan={6} className="py-6 text-center text-[#666666]">Nenhum lançamento a partir desta data.</td></tr>
                )}
                <tr className="border-b border-[#161616] text-[#a3a3a3]">
                  <td className="py-1.5 px-2 whitespace-nowrap">{fmtData(extrato.dtSaldoAnterior)}</td>
                  <td />
                  <td />
                  <td className="py-1.5 px-2 italic">Saldo anterior</td>
                  <td className="py-1.5 px-2 text-right whitespace-nowrap">{fmtValor(extrato.saldoAnterior)}</td>
                  <td className={`py-1.5 px-1 text-center ${corDC(dcSaldo(extrato.saldoAnterior))}`}>{dcSaldo(extrato.saldoAnterior)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap justify-between gap-2 text-xs">
            <span className="text-[#a3a3a3]">
              Saldo bloqueado: <span className="text-white">{fmtValor(extrato.saldoBloqueado)} {dcSaldo(extrato.saldoBloqueado, 'C')}</span>
            </span>
            <span className="text-[#a3a3a3]">Lançamentos futuros: <span className="text-white">{extrato.futuros.length}</span></span>
          </div>
          {extrato.futuros.length > 0 && (
            <table className="w-full text-xs border border-[#1f1f1f] rounded">
              <thead>
                <tr className="text-[#888] uppercase tracking-wider border-b border-[#1f1f1f]">
                  <th className="py-2 px-2 text-left font-semibold">Data</th>
                  <th className="py-2 px-2 text-right font-semibold">Valor</th>
                  <th className="py-2 px-1 w-6" />
                  <th className="py-2 px-2 text-left font-semibold">Histórico</th>
                </tr>
              </thead>
              <tbody>
                {extrato.futuros.map((l) => (
                  <tr key={l.ID} className="border-b border-[#161616] text-[#d4d4d4]">
                    <td className="py-1.5 px-2 whitespace-nowrap">{fmtData(l.DATA)}</td>
                    <td className="py-1.5 px-2 text-right whitespace-nowrap">{fmtValor(l.VALOR)}</td>
                    <td className={`py-1.5 px-1 text-center ${corDC(l.DC)}`}>{l.DC}</td>
                    <td className="py-1.5 px-2">{l.HISTORICO}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Pré-visualização da impressão */}
      {pdfUrl && (
        <div className="flex flex-col gap-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#a3a3a3]">Impressão: extrato de {aplicado.codCedente} - {aplicado.nomeCedente}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPdfUrl(null)} className="px-3 py-1.5 text-xs text-[#a3a3a3] hover:text-white transition">Fechar</button>
              <button onClick={baixar} className="px-4 py-1.5 bg-white text-black text-xs font-medium rounded hover:opacity-90 transition">Baixar PDF</button>
            </div>
          </div>
          <iframe title="Extrato conta corrente" src={pdfUrl} className="h-[600px] w-full rounded-lg border border-[#1f1f1f] bg-white" />
        </div>
      )}
    </div>
  )
}
