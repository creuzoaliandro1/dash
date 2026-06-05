import { useState, useEffect, useMemo } from 'react'
import * as ctb from '../../services/contabilService'
import { formatCurrency } from '../../utils/formatters'

const inputCls = 'px-2 py-1.5 bg-[#111111] border border-[#2a2a2a] rounded text-white text-xs focus:border-[#444] outline-none'

const STATUS_BADGE = {
  pendente: 'text-yellow-400 border-yellow-900',
  processado: 'text-green-400 border-green-900',
  erro: 'text-red-400 border-red-900',
  descartado: 'text-[#666666] border-[#2a2a2a]',
}

export default function IntegracaoTab() {
  const [mapeamentos, setMapeamentos] = useState([])
  const [pendencias, setPendencias] = useState([])
  const [resumo, setResumo] = useState({})
  const [contas, setContas] = useState([])
  const [filtroStatus, setFiltroStatus] = useState('')
  const [formMap, setFormMap] = useState(null)
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')
  const [processando, setProcessando] = useState(false)

  const analiticas = useMemo(() => contas.filter(c => c.aceita_lancamento && c.ativo), [contas])

  const carregar = async () => {
    try {
      const [m, p, r, c] = await Promise.all([
        ctb.getMapeamentos(), ctb.getPendencias(filtroStatus || undefined), ctb.getPendenciasResumo(), ctb.getContas(),
      ])
      setMapeamentos(m); setPendencias(p); setResumo(r); setContas(c)
    } catch (e) { setErro(ctb.mensagemErro(e)) }
  }
  useEffect(() => { carregar() }, [filtroStatus])

  const capturar = async () => {
    setMsg(''); setErro(''); setProcessando(true)
    try {
      const r = await ctb.capturarEventos()
      setMsg(`Captura concluída: ${r.emitidos} emissão(ões) e ${r.liquidados} liquidação(ões) novas na fila.`)
      carregar()
    } catch (e) { setErro(ctb.mensagemErro(e)) } finally { setProcessando(false) }
  }

  const processar = async () => {
    setMsg(''); setErro(''); setProcessando(true)
    try {
      const r = await ctb.processarPendencias()
      setMsg(`Processamento: ${r.processados} contabilizado(s), ${r.erros} erro(s), ${r.sem_mapeamento} sem mapeamento.`)
      carregar()
    } catch (e) { setErro(ctb.mensagemErro(e)) } finally { setProcessando(false) }
  }

  const salvarMap = async () => {
    setErro('')
    try {
      if (!formMap.evento || !formMap.conta_debito_id || !formMap.conta_credito_id)
        throw new Error('Evento, conta débito e conta crédito são obrigatórios')
      await ctb.saveMapeamento(formMap)
      setFormMap(null); carregar()
    } catch (e) { setErro(ctb.mensagemErro(e)) }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Ações */}
      <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={capturar} disabled={processando}
            className="px-3 py-1.5 bg-white text-black rounded text-xs font-semibold hover:bg-gray-200 transition disabled:opacity-50">
            1. Capturar eventos dos Boletos
          </button>
          <button onClick={processar} disabled={processando}
            className="px-3 py-1.5 bg-white text-black rounded text-xs font-semibold hover:bg-gray-200 transition disabled:opacity-50">
            2. Processar pendências → Lançamentos
          </button>
          <div className="flex gap-2 ml-auto text-[10px]">
            {Object.entries(resumo).map(([s, n]) => (
              <span key={s} className={`border rounded px-2 py-1 uppercase ${STATUS_BADGE[s]}`}>{s}: {n}</span>
            ))}
          </div>
        </div>
        <p className="text-[10px] text-[#666666] mt-2">
          Idempotente (RI-02): reprocessar não duplica lançamentos. Eventos sem mapeamento permanecem na fila (RI-04).
        </p>
        {msg && <p className="text-xs text-green-400 mt-2">{msg}</p>}
        {erro && !formMap && <p className="text-xs text-red-400 mt-2">{erro}</p>}
      </div>

      {/* Mapeamentos */}
      <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Mapeamentos Financeiro → Contábil</h3>
          <button onClick={() => { setErro(''); setFormMap({ evento: '', conta_debito_id: '', conta_credito_id: '', ativo: true }) }}
            className="px-2 py-1 bg-white text-black rounded text-xs font-semibold hover:bg-gray-200 transition">+ Novo</button>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1f1f1f] text-[#666666] uppercase tracking-wider">
              <th className="text-left py-2 font-semibold">Evento</th>
              <th className="text-left py-2 font-semibold">Débito</th>
              <th className="text-left py-2 font-semibold">Crédito</th>
              <th className="text-left py-2 font-semibold">Ativo</th>
              <th className="text-right py-2 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {mapeamentos.map(m => (
              <tr key={m.id} className={`border-b border-[#141414] ${!m.ativo ? 'opacity-40' : ''}`}>
                <td className="py-2 text-white">{m.evento}</td>
                <td className="py-2 text-[#a3a3a3]">{m.debito?.codigo} — {m.debito?.nome}</td>
                <td className="py-2 text-[#a3a3a3]">{m.credito?.codigo} — {m.credito?.nome}</td>
                <td className="py-2 text-[#666666]">{m.ativo ? 'Sim' : 'Não'}</td>
                <td className="py-2 text-right">
                  <button onClick={() => { setErro(''); setFormMap({ id: m.id, evento: m.evento, conta_debito_id: m.conta_debito_id, conta_credito_id: m.conta_credito_id, ativo: m.ativo }) }}
                    className="text-[#666666] hover:text-white">Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {formMap && (
          <div className="mt-3 border-t border-[#1f1f1f] pt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
            <input value={formMap.evento} onChange={e => setFormMap({ ...formMap, evento: e.target.value })}
              placeholder="Evento (ex.: boleto.liquidado)" className={inputCls} />
            <select value={formMap.conta_debito_id} onChange={e => setFormMap({ ...formMap, conta_debito_id: Number(e.target.value) })} className={inputCls}>
              <option value="">— conta débito —</option>
              {analiticas.map(c => <option key={c.id} value={c.id}>{c.codigo} — {c.nome}</option>)}
            </select>
            <select value={formMap.conta_credito_id} onChange={e => setFormMap({ ...formMap, conta_credito_id: Number(e.target.value) })} className={inputCls}>
              <option value="">— conta crédito —</option>
              {analiticas.map(c => <option key={c.id} value={c.id}>{c.codigo} — {c.nome}</option>)}
            </select>
            <div className="flex items-center gap-2">
              <label className="text-xs text-[#a3a3a3] flex items-center gap-1">
                <input type="checkbox" checked={formMap.ativo} onChange={e => setFormMap({ ...formMap, ativo: e.target.checked })} /> Ativo
              </label>
              <button onClick={salvarMap} className="px-2 py-1 bg-white text-black rounded text-xs font-semibold ml-auto">Salvar</button>
              <button onClick={() => setFormMap(null)} className="px-2 py-1 border border-[#2a2a2a] text-[#a3a3a3] rounded text-xs">✕</button>
            </div>
            {erro && <p className="text-xs text-red-400 md:col-span-4">{erro}</p>}
          </div>
        )}
      </div>

      {/* Pendências */}
      <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Fila de Pendências</h3>
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} className={inputCls}>
            <option value="">Todas</option>
            <option value="pendente">Pendentes</option>
            <option value="processado">Processadas</option>
            <option value="erro">Com erro</option>
          </select>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1f1f1f] text-[#666666] uppercase tracking-wider">
              <th className="text-left py-2 font-semibold">Evento</th>
              <th className="text-left py-2 font-semibold">Documento</th>
              <th className="text-left py-2 font-semibold">Sacado</th>
              <th className="text-right py-2 font-semibold">Valor</th>
              <th className="text-left py-2 font-semibold pl-3">Status</th>
              <th className="text-left py-2 font-semibold">Erro</th>
            </tr>
          </thead>
          <tbody>
            {pendencias.map(p => (
              <tr key={p.id} className="border-b border-[#141414] hover:bg-[#111111]">
                <td className="py-2 text-white">{p.evento}</td>
                <td className="py-2 text-[#a3a3a3]">{p.payload_json?.documento || '—'}</td>
                <td className="py-2 text-[#a3a3a3] max-w-[200px] truncate">{p.payload_json?.sacado || '—'}</td>
                <td className="py-2 text-right text-white">{formatCurrency(p.payload_json?.valor)}</td>
                <td className="py-2 pl-3">
                  <span className={`border rounded px-1.5 py-0.5 text-[10px] uppercase ${STATUS_BADGE[p.status]}`}>{p.status}</span>
                </td>
                <td className="py-2 text-red-400 max-w-[220px] truncate" title={p.erro_msg || ''}>{p.erro_msg || ''}</td>
              </tr>
            ))}
            {pendencias.length === 0 && (
              <tr><td colSpan="6" className="py-6 text-center text-[#666666]">Nenhuma pendência — clique em "Capturar eventos"</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
