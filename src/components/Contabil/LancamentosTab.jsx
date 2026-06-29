import { useState, useEffect, useMemo } from 'react'
import * as ctb from '../../services/contabilService'
import { formatDate, formatCurrency } from '../../utils/formatters'

const inputCls = 'px-2 py-1.5 bg-[#111111] border border-[#2a2a2a] rounded text-white text-xs focus:border-[#444] outline-none'

const STATUS_BADGE = {
  rascunho: 'text-yellow-400 border-yellow-900',
  contabilizado: 'text-green-400 border-green-900',
  estornado: 'text-red-400 border-red-900',
}

const novaLinha = () => ({ conta_id: '', tipo: 'D', valor: '' })

export default function LancamentosTab() {
  const [lancamentos, setLancamentos] = useState([])
  const [contas, setContas] = useState([])
  const [historicos, setHistoricos] = useState([])
  const [filtros, setFiltros] = useState({ de: '', ate: '', status: '', busca: '' })
  const [expandido, setExpandido] = useState(null)
  const [modal, setModal] = useState(false)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({
    dataCompetencia: new Date().toISOString().slice(0, 10),
    historico: '', historicoPadraoId: '',
    itens: [novaLinha(), { ...novaLinha(), tipo: 'C' }],
  })

  const analiticas = useMemo(() => contas.filter(c => c.aceita_lancamento && c.ativo), [contas])

  const carregar = async () => {
    try {
      const [l, c, h] = await Promise.all([
        ctb.getLancamentos(filtros), ctb.getContas(), ctb.getHistoricos(),
      ])
      setLancamentos(l); setContas(c); setHistoricos(h)
    } catch (e) { setErro(ctb.mensagemErro(e)) }
  }
  useEffect(() => { carregar() }, [filtros.de, filtros.ate, filtros.status])

  // equilíbrio em tempo real
  const totais = useMemo(() => {
    let d = 0, c = 0
    for (const i of form.itens) {
      const v = ctb.parseValorBR(i.valor)
      if (i.tipo === 'D') d += v; else c += v
    }
    return { d: Math.round(d * 100) / 100, c: Math.round(c * 100) / 100 }
  }, [form.itens])
  const equilibrado = totais.d > 0 && Math.abs(totais.d - totais.c) < 0.005

  const setItem = (idx, campo, valor) => {
    const itens = form.itens.map((it, i) => i === idx ? { ...it, [campo]: valor } : it)
    setForm({ ...form, itens })
  }

  const salvar = async (contabilizar) => {
    setErro('')
    try {
      const itens = form.itens
        .filter(i => i.conta_id && ctb.parseValorBR(i.valor) > 0)
        .map(i => ({ conta_id: Number(i.conta_id), tipo: i.tipo, valor: ctb.parseValorBR(i.valor) }))
      if (itens.length < 2) throw new Error('Informe ao menos 2 partidas com conta e valor')
      if (contabilizar && !equilibrado) throw new Error(`Débitos (${formatCurrency(totais.d)}) diferem dos créditos (${formatCurrency(totais.c)})`)
      if (!form.historico || form.historico.trim().length < 5) throw new Error('Histórico deve ter ao menos 5 caracteres')
      setSalvando(true)
      await ctb.criarLancamento({ ...form, itens, contabilizar })
      setModal(false)
      setForm({ dataCompetencia: new Date().toISOString().slice(0, 10), historico: '', historicoPadraoId: '', itens: [novaLinha(), { ...novaLinha(), tipo: 'C' }] })
      carregar()
    } catch (e) { setErro(ctb.mensagemErro(e)) } finally { setSalvando(false) }
  }

  const contabilizar = async (l) => {
    try { await ctb.contabilizarLancamento(l.id); carregar() } catch (e) { window.alert(ctb.mensagemErro(e)) }
  }
  const estornar = async (l) => {
    const motivo = window.prompt(`Estornar lançamento ${l.numero || l.id}? Informe o motivo:`)
    if (motivo === null) return
    try { await ctb.estornarLancamento(l.id, motivo) ; carregar() } catch (e) { window.alert(ctb.mensagemErro(e)) }
  }
  const excluir = async (l) => {
    if (!window.confirm('Excluir este rascunho?')) return
    try { await ctb.excluirRascunho(l.id); carregar() } catch (e) { window.alert(ctb.mensagemErro(e)) }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="text-xs text-[#666666] block mb-1">De</label>
          <input type="date" value={filtros.de} onChange={e => setFiltros({ ...filtros, de: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-[#666666] block mb-1">Até</label>
          <input type="date" value={filtros.ate} onChange={e => setFiltros({ ...filtros, ate: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-[#666666] block mb-1">Status</label>
          <select value={filtros.status} onChange={e => setFiltros({ ...filtros, status: e.target.value })} className={inputCls}>
            <option value="">Todos</option>
            <option value="rascunho">Rascunho</option>
            <option value="contabilizado">Contabilizado</option>
            <option value="estornado">Estornado</option>
          </select>
        </div>
        <input value={filtros.busca} onChange={e => setFiltros({ ...filtros, busca: e.target.value })}
          onKeyDown={e => e.key === 'Enter' && carregar()} placeholder="Buscar no histórico (Enter)"
          className={inputCls + ' flex-1 min-w-[160px]'} />
        <button onClick={() => { setErro(''); setModal(true) }}
          className="px-3 py-1.5 bg-white text-black rounded text-xs font-semibold hover:bg-gray-200 transition">
          + Novo Lançamento
        </button>
      </div>

      {erro && !modal && <p className="text-xs text-red-400 mb-3">{erro}</p>}

      <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1f1f1f] text-[#666666] uppercase tracking-wider">
              <th className="text-left px-4 py-2.5 font-semibold">Nº</th>
              <th className="text-left px-3 py-2.5 font-semibold">Competência</th>
              <th className="text-left px-3 py-2.5 font-semibold">Histórico</th>
              <th className="text-right px-3 py-2.5 font-semibold">Valor</th>
              <th className="text-left px-3 py-2.5 font-semibold">Origem</th>
              <th className="text-left px-3 py-2.5 font-semibold">Status</th>
              <th className="text-right px-4 py-2.5 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lancamentos.map(l => (
              <>
                <tr key={l.id} className="border-b border-[#141414] hover:bg-[#111111] cursor-pointer"
                  onClick={() => setExpandido(expandido === l.id ? null : l.id)}>
                  <td className="px-4 py-2 text-[#a3a3a3]">{l.numero || '—'}</td>
                  <td className="px-3 py-2 text-white">{formatDate(l.data_competencia)}</td>
                  <td className="px-3 py-2 text-[#a3a3a3] max-w-[320px] truncate">{l.historico}</td>
                  <td className="px-3 py-2 text-right text-white">{formatCurrency(l.valor_total)}</td>
                  <td className="px-3 py-2 text-[#666666]">{l.origem_tipo}</td>
                  <td className="px-3 py-2">
                    <span className={`border rounded px-1.5 py-0.5 text-[10px] uppercase ${STATUS_BADGE[l.status]}`}>{l.status}</span>
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    {l.status === 'rascunho' && (
                      <>
                        <button onClick={() => contabilizar(l)} className="text-green-400 hover:underline mr-3">Contabilizar</button>
                        <button onClick={() => excluir(l)} className="text-[#666666] hover:text-red-400">Excluir</button>
                      </>
                    )}
                    {l.status === 'contabilizado' && l.origem_tipo !== 'estorno' && (
                      <button onClick={() => estornar(l)} className="text-[#666666] hover:text-red-400">Estornar</button>
                    )}
                  </td>
                </tr>
                {expandido === l.id && (
                  <tr key={`${l.id}-det`} className="bg-[#0d0d0d] border-b border-[#141414]">
                    <td colSpan="7" className="px-8 py-3">
                      <table className="w-full text-xs">
                        <tbody>
                          {(l.ctb_lancamento_item || []).map(i => (
                            <tr key={i.id}>
                              <td className="py-1 text-[#666666] w-10">{i.tipo}</td>
                              <td className="py-1 text-[#a3a3a3]">
                                {i.ctb_conta_contabil?.codigo} — {i.ctb_conta_contabil?.nome}
                              </td>
                              <td className="py-1 text-right text-white">{formatCurrency(i.valor)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {lancamentos.length === 0 && (
              <tr><td colSpan="7" className="px-4 py-8 text-center text-[#666666]">Nenhum lançamento encontrado</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setModal(false)}>
          <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-5 w-[680px] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-white mb-4">Novo Lançamento Contábil</h3>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className="text-xs text-[#666666] block mb-1">Competência</label>
                <input type="date" value={form.dataCompetencia}
                  onChange={e => setForm({ ...form, dataCompetencia: e.target.value })} className={inputCls + ' w-full'} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-[#666666] block mb-1">Histórico padrão (opcional)</label>
                <select value={form.historicoPadraoId} onChange={e => {
                  const h = historicos.find(x => String(x.id) === e.target.value)
                  setForm({ ...form, historicoPadraoId: e.target.value, historico: h ? h.descricao.replace(/\{\w+\}/g, '').trim() : form.historico })
                }} className={inputCls + ' w-full'}>
                  <option value="">— texto livre —</option>
                  {historicos.filter(h => h.ativo).map(h => <option key={h.id} value={h.id}>{h.codigo} — {h.descricao}</option>)}
                </select>
              </div>
            </div>
            <div className="mb-3">
              <label className="text-xs text-[#666666] block mb-1">Histórico</label>
              <input value={form.historico} onChange={e => setForm({ ...form, historico: e.target.value })}
                placeholder="Descrição do fato contábil (mín. 5 caracteres)" className={inputCls + ' w-full'} />
            </div>

            <p className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-2">Partidas</p>
            {form.itens.map((item, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <select value={item.conta_id} onChange={e => setItem(idx, 'conta_id', e.target.value)} className={inputCls + ' flex-1'}>
                  <option value="">— conta analítica —</option>
                  {analiticas.map(c => <option key={c.id} value={c.id}>{c.codigo} — {c.nome}</option>)}
                </select>
                <select value={item.tipo} onChange={e => setItem(idx, 'tipo', e.target.value)} className={inputCls + ' w-24'}>
                  <option value="D">Débito</option>
                  <option value="C">Crédito</option>
                </select>
                <input value={item.valor} onChange={e => setItem(idx, 'valor', e.target.value)}
                  placeholder="0,00" className={inputCls + ' w-28 text-right'} />
                <button onClick={() => setForm({ ...form, itens: form.itens.filter((_, i) => i !== idx) })}
                  disabled={form.itens.length <= 2}
                  className="text-[#666666] hover:text-red-400 disabled:opacity-30 px-1">✕</button>
              </div>
            ))}
            <button onClick={() => setForm({ ...form, itens: [...form.itens, novaLinha()] })}
              className="text-xs text-[#a3a3a3] hover:text-white transition mb-3">+ adicionar partida</button>

            <div className={`flex justify-between items-center border rounded px-3 py-2 mb-3 text-xs ${equilibrado ? 'border-green-900 text-green-400' : 'border-yellow-900 text-yellow-400'}`}>
              <span>Débitos: {formatCurrency(totais.d)}</span>
              <span>Créditos: {formatCurrency(totais.c)}</span>
              <span>{equilibrado ? '✓ Equilibrado' : `Diferença: ${formatCurrency(Math.abs(totais.d - totais.c))}`}</span>
            </div>

            {erro && <p className="text-xs text-red-400 mb-3">{erro}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setModal(false)} className="px-3 py-1.5 border border-[#2a2a2a] text-[#a3a3a3] rounded text-xs hover:text-white transition">Cancelar</button>
              <button onClick={() => salvar(false)} disabled={salvando}
                className="px-3 py-1.5 border border-[#2a2a2a] text-white rounded text-xs hover:bg-[#1a1a1a] transition disabled:opacity-50">
                Salvar Rascunho
              </button>
              <button onClick={() => salvar(true)} disabled={salvando || !equilibrado}
                className="px-3 py-1.5 bg-white text-black rounded text-xs font-semibold hover:bg-gray-200 transition disabled:opacity-40">
                Contabilizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
