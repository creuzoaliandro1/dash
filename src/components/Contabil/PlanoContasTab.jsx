import { useState, useEffect } from 'react'
import * as ctb from '../../services/contabilService'

const TIPOS = ['ativo', 'passivo', 'patrimonio_liquido', 'receita', 'custo', 'despesa', 'apuracao']

const inputCls = 'w-full px-2 py-1.5 bg-[#111111] border border-[#2a2a2a] rounded text-white text-xs focus:border-[#444] outline-none'

export default function PlanoContasTab() {
  const [contas, setContas] = useState([])
  const [gruposDre, setGruposDre] = useState([])
  const [gruposBal, setGruposBal] = useState([])
  const [filtro, setFiltro] = useState('')
  const [modal, setModal] = useState(false)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState({ codigo: '', nome: '', tipo: 'ativo', natureza: 'devedora', aceita_lancamento: true, grupo_dre_id: '', grupo_balanco_id: '' })

  const carregar = async () => {
    try {
      const [c, d, b] = await Promise.all([ctb.getContas(), ctb.getGruposDre(), ctb.getGruposBalanco()])
      setContas(c); setGruposDre(d); setGruposBal(b)
    } catch (e) { setErro(ctb.mensagemErro(e)) }
  }
  useEffect(() => { carregar() }, [])

  const salvar = async () => {
    setErro('')
    try {
      if (!/^\d+(\.\d+)*$/.test(form.codigo)) throw new Error('Código inválido — use o formato 9.9.9.999')
      if (!form.nome || form.nome.length < 3) throw new Error('Nome da conta é obrigatório')
      const ehResultado = ['receita', 'custo', 'despesa'].includes(form.tipo)
      await ctb.createConta({
        ...form,
        grupo_dre_id: ehResultado ? form.grupo_dre_id || null : null,
        grupo_balanco_id: !ehResultado && form.tipo !== 'apuracao' ? form.grupo_balanco_id || null : null,
      })
      setModal(false)
      setForm({ codigo: '', nome: '', tipo: 'ativo', natureza: 'devedora', aceita_lancamento: true, grupo_dre_id: '', grupo_balanco_id: '' })
      carregar()
    } catch (e) { setErro(ctb.mensagemErro(e)) }
  }

  const inativar = async (conta) => {
    if (!window.confirm(`Inativar a conta ${conta.codigo} ${conta.nome}? Lançamentos existentes são preservados.`)) return
    try { await ctb.updateConta(conta.id, { ativo: false }); carregar() } catch (e) { setErro(ctb.mensagemErro(e)) }
  }
  const reativar = async (conta) => {
    try { await ctb.updateConta(conta.id, { ativo: true }); carregar() } catch (e) { setErro(ctb.mensagemErro(e)) }
  }

  const visiveis = contas.filter(c =>
    !filtro || c.codigo.includes(filtro) || c.nome.toLowerCase().includes(filtro.toLowerCase()))

  const ehResultado = ['receita', 'custo', 'despesa'].includes(form.tipo)

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Buscar por código ou nome..."
          className={inputCls + ' max-w-xs'} />
        <button onClick={() => { setErro(''); setModal(true) }}
          className="px-3 py-1.5 bg-white text-black rounded text-xs font-semibold hover:bg-gray-200 transition whitespace-nowrap">
          + Nova Conta
        </button>
      </div>

      {erro && !modal && <p className="text-xs text-red-400 mb-3">{erro}</p>}

      <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1f1f1f] text-[#666666] uppercase tracking-wider">
              <th className="text-left px-4 py-2.5 font-semibold">Código / Conta</th>
              <th className="text-left px-3 py-2.5 font-semibold">Tipo</th>
              <th className="text-left px-3 py-2.5 font-semibold">Natureza</th>
              <th className="text-left px-3 py-2.5 font-semibold">DRE/BP</th>
              <th className="text-center px-3 py-2.5 font-semibold">Analítica</th>
              <th className="text-right px-4 py-2.5 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map(c => (
              <tr key={c.id} className={`border-b border-[#141414] hover:bg-[#111111] ${!c.ativo ? 'opacity-40' : ''}`}>
                <td className="px-4 py-2" style={{ paddingLeft: `${16 + (c.nivel - 1) * 16}px` }}>
                  <span className="text-[#666666] mr-2">{c.codigo}</span>
                  <span className={c.aceita_lancamento ? 'text-white' : 'text-[#a3a3a3] font-semibold'}>{c.nome}</span>
                </td>
                <td className="px-3 py-2 text-[#a3a3a3]">{c.tipo.replace('_', ' ')}</td>
                <td className="px-3 py-2 text-[#a3a3a3]">{c.natureza}</td>
                <td className="px-3 py-2 text-[#666666]">
                  {c.ctb_grupo_dre?.codigo || c.ctb_grupo_balanco?.codigo || '—'}
                </td>
                <td className="px-3 py-2 text-center">{c.aceita_lancamento ? '●' : ''}</td>
                <td className="px-4 py-2 text-right">
                  {c.ativo
                    ? <button onClick={() => inativar(c)} className="text-[#666666] hover:text-red-400 transition">Inativar</button>
                    : <button onClick={() => reativar(c)} className="text-[#666666] hover:text-green-400 transition">Reativar</button>}
                </td>
              </tr>
            ))}
            {visiveis.length === 0 && (
              <tr><td colSpan="6" className="px-4 py-8 text-center text-[#666666]">Nenhuma conta encontrada</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setModal(false)}>
          <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-5 w-[440px]" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-white mb-4">Nova Conta Contábil</h3>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#666666] block mb-1">Código (ex.: 1.1.1.003)</label>
                  <input value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-[#666666] block mb-1">Tipo</label>
                  <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value, natureza: ['ativo', 'custo', 'despesa', 'apuracao'].includes(e.target.value) ? 'devedora' : 'credora' })} className={inputCls}>
                    {TIPOS.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-[#666666] block mb-1">Nome</label>
                <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#666666] block mb-1">Natureza</label>
                  <select value={form.natureza} onChange={e => setForm({ ...form, natureza: e.target.value })} className={inputCls}>
                    <option value="devedora">devedora</option>
                    <option value="credora">credora</option>
                  </select>
                </div>
                <div className="flex items-end pb-1.5">
                  <label className="text-xs text-[#a3a3a3] flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.aceita_lancamento}
                      onChange={e => setForm({ ...form, aceita_lancamento: e.target.checked })} />
                    Analítica (aceita lançamento)
                  </label>
                </div>
              </div>
              {ehResultado ? (
                <div>
                  <label className="text-xs text-[#666666] block mb-1">Grupo DRE (obrigatório p/ analítica)</label>
                  <select value={form.grupo_dre_id} onChange={e => setForm({ ...form, grupo_dre_id: e.target.value })} className={inputCls}>
                    <option value="">— sem mapeamento —</option>
                    {gruposDre.filter(g => g.tipo_operacao !== 'subtotal').map(g =>
                      <option key={g.id} value={g.id}>{g.codigo} — {g.descricao}</option>)}
                  </select>
                </div>
              ) : form.tipo !== 'apuracao' && (
                <div>
                  <label className="text-xs text-[#666666] block mb-1">Grupo Balanço (obrigatório p/ analítica)</label>
                  <select value={form.grupo_balanco_id} onChange={e => setForm({ ...form, grupo_balanco_id: e.target.value })} className={inputCls}>
                    <option value="">— sem mapeamento —</option>
                    {gruposBal.map(g => <option key={g.id} value={g.id}>{g.codigo} — {g.descricao}</option>)}
                  </select>
                </div>
              )}
              {erro && <p className="text-xs text-red-400">{erro}</p>}
              <div className="flex justify-end gap-2 mt-1">
                <button onClick={() => setModal(false)} className="px-3 py-1.5 border border-[#2a2a2a] text-[#a3a3a3] rounded text-xs hover:text-white transition">Cancelar</button>
                <button onClick={salvar} className="px-3 py-1.5 bg-white text-black rounded text-xs font-semibold hover:bg-gray-200 transition">Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
