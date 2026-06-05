import { useState, useEffect } from 'react'
import * as ctb from '../../services/contabilService'
import { formatCurrency } from '../../utils/formatters'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const STATUS_BADGE = {
  aberto: 'text-green-400 border-green-900',
  fechado: 'text-[#a3a3a3] border-[#2a2a2a]',
  bloqueado: 'text-red-400 border-red-900',
}

export default function PeriodosTab() {
  const [ano, setAno] = useState(new Date().getFullYear())
  const [periodos, setPeriodos] = useState([])
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')
  const [processando, setProcessando] = useState(false)

  const carregar = async () => {
    setErro('')
    try {
      let p = await ctb.getPeriodos(ano)
      if (p.length === 0) { await ctb.criarPeriodosAno(ano); p = await ctb.getPeriodos(ano) }
      setPeriodos(p)
    } catch (e) { setErro(ctb.mensagemErro(e)) }
  }
  useEffect(() => { carregar() }, [ano])

  const encerrar = async (p) => {
    if (!window.confirm(`Encerrar o período ${MESES[p.mes - 1]}/${p.ano}? Lançamentos nesta competência serão bloqueados.`)) return
    setErro(''); setMsg(''); setProcessando(true)
    try {
      const r = await ctb.encerrarPeriodo(p.ano, p.mes)
      setMsg(`Período ${r.periodo} encerrado — ${r.contas_consolidadas} conta(s) consolidada(s), débitos ${formatCurrency(r.total_debitos)} = créditos ${formatCurrency(r.total_creditos)}`)
      carregar()
    } catch (e) { setErro(ctb.mensagemErro(e)) } finally { setProcessando(false) }
  }

  const reabrir = async (p) => {
    const motivo = window.prompt(`Reabrir ${MESES[p.mes - 1]}/${p.ano}? A reabertura é auditada e invalida saldos consolidados posteriores.\n\nMotivo:`)
    if (!motivo) return
    setErro(''); setMsg(''); setProcessando(true)
    try {
      await ctb.reabrirPeriodo(p.ano, p.mes, motivo)
      setMsg(`Período ${p.mes}/${p.ano} reaberto.`)
      carregar()
    } catch (e) { setErro(ctb.mensagemErro(e)) } finally { setProcessando(false) }
  }

  const encerrarAno = async () => {
    if (!window.confirm(`Encerrar o exercício ${ano}? As contas de resultado serão zeradas contra a ARE e o resultado transferido para Lucros/Prejuízos Acumulados (competência 31/12/${ano}).`)) return
    setErro(''); setMsg(''); setProcessando(true)
    try {
      const r = await ctb.encerrarExercicio(ano)
      setMsg(r.mensagem || `Exercício ${ano} encerrado — resultado ${formatCurrency(r.resultado)} (${Number(r.resultado) >= 0 ? 'lucro' : 'prejuízo'})`)
      carregar()
    } catch (e) { setErro(ctb.mensagemErro(e)) } finally { setProcessando(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setAno(ano - 1)} className="px-2 py-1 border border-[#2a2a2a] rounded text-[#a3a3a3] text-xs hover:text-white">←</button>
          <span className="text-white text-sm font-semibold w-14 text-center">{ano}</span>
          <button onClick={() => setAno(ano + 1)} className="px-2 py-1 border border-[#2a2a2a] rounded text-[#a3a3a3] text-xs hover:text-white">→</button>
        </div>
        <button onClick={encerrarAno} disabled={processando}
          className="px-3 py-1.5 border border-red-900 text-red-400 rounded text-xs font-semibold hover:bg-red-950/40 transition disabled:opacity-50">
          Encerrar Exercício {ano}
        </button>
      </div>

      {msg && <p className="text-xs text-green-400 mb-3">{msg}</p>}
      {erro && <p className="text-xs text-red-400 mb-3">{erro}</p>}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {periodos.map(p => (
          <div key={p.id} className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white font-medium">{MESES[p.mes - 1]}</span>
              <span className={`border rounded px-1.5 py-0.5 text-[10px] uppercase ${STATUS_BADGE[p.status]}`}>{p.status}</span>
            </div>
            {p.fechado_em && <p className="text-[10px] text-[#666666] mb-1">Fechado em {new Date(p.fechado_em).toLocaleDateString('pt-BR')}</p>}
            {p.motivo_reabertura && <p className="text-[10px] text-yellow-600 mb-1 truncate" title={p.motivo_reabertura}>Reaberto: {p.motivo_reabertura}</p>}
            <div className="mt-2">
              {p.status === 'aberto'
                ? <button onClick={() => encerrar(p)} disabled={processando} className="text-xs text-[#a3a3a3] hover:text-white transition disabled:opacity-50">Encerrar →</button>
                : <button onClick={() => reabrir(p)} disabled={processando} className="text-xs text-[#666666] hover:text-yellow-400 transition disabled:opacity-50">Reabrir</button>}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-[#666666] mt-4">
        Encerramento sequencial (RF-02): um mês só pode ser encerrado se os anteriores com movimento estiverem fechados.
        Períodos fechados rejeitam novos lançamentos e estornos na competência (RF-04).
      </p>
    </div>
  )
}
