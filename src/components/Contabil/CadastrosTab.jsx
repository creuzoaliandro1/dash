import { useState, useEffect } from 'react'
import * as ctb from '../../services/contabilService'

const inputCls = 'px-2 py-1.5 bg-[#111111] border border-[#2a2a2a] rounded text-white text-xs focus:border-[#444] outline-none'

function ListaCrud({ titulo, colunas, linhas, onSalvar, formVazio, renderForm, renderLinha }) {
  const [form, setForm] = useState(null)
  const [erro, setErro] = useState('')

  const salvar = async () => {
    setErro('')
    try { await onSalvar(form); setForm(null) } catch (e) { setErro(ctb.mensagemErro(e)) }
  }

  return (
    <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">{titulo}</h3>
        <button onClick={() => { setErro(''); setForm(formVazio()) }}
          className="px-2 py-1 bg-white text-black rounded text-xs font-semibold hover:bg-gray-200 transition">+ Novo</button>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#1f1f1f] text-[#666666] uppercase tracking-wider">
            {colunas.map(c => <th key={c} className="text-left py-2 font-semibold">{c}</th>)}
            <th className="text-right py-2 font-semibold">Ações</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(l => renderLinha(l, () => { setErro(''); setForm({ ...l }) }))}
          {linhas.length === 0 && <tr><td colSpan={colunas.length + 1} className="py-6 text-center text-[#666666]">Nenhum registro</td></tr>}
        </tbody>
      </table>
      {form && (
        <div className="mt-3 border-t border-[#1f1f1f] pt-3">
          {renderForm(form, setForm)}
          {erro && <p className="text-xs text-red-400 mt-2">{erro}</p>}
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setForm(null)} className="px-3 py-1.5 border border-[#2a2a2a] text-[#a3a3a3] rounded text-xs hover:text-white transition">Cancelar</button>
            <button onClick={salvar} className="px-3 py-1.5 bg-white text-black rounded text-xs font-semibold hover:bg-gray-200 transition">Salvar</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CadastrosTab() {
  const [centros, setCentros] = useState([])
  const [historicos, setHistoricos] = useState([])

  const carregar = async () => {
    const [cc, h] = await Promise.all([ctb.getCentrosCusto(), ctb.getHistoricos()])
    setCentros(cc); setHistoricos(h)
  }
  useEffect(() => { carregar() }, [])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ListaCrud
        titulo="Centros de Custo"
        colunas={['Código', 'Nome', 'Ativo']}
        linhas={centros}
        formVazio={() => ({ codigo: '', nome: '', ativo: true, aceita_lancamento: true })}
        onSalvar={async (f) => {
          if (!f.codigo || !f.nome) throw new Error('Código e nome são obrigatórios')
          await ctb.saveCentroCusto({ id: f.id, codigo: f.codigo, nome: f.nome, ativo: f.ativo, aceita_lancamento: f.aceita_lancamento })
          carregar()
        }}
        renderLinha={(l, editar) => (
          <tr key={l.id} className={`border-b border-[#141414] ${!l.ativo ? 'opacity-40' : ''}`}>
            <td className="py-2 text-[#a3a3a3]">{l.codigo}</td>
            <td className="py-2 text-white">{l.nome}</td>
            <td className="py-2 text-[#666666]">{l.ativo ? 'Sim' : 'Não'}</td>
            <td className="py-2 text-right"><button onClick={editar} className="text-[#666666] hover:text-white">Editar</button></td>
          </tr>
        )}
        renderForm={(f, set) => (
          <div className="grid grid-cols-3 gap-3">
            <input value={f.codigo} onChange={e => set({ ...f, codigo: e.target.value })} placeholder="Código (ex.: 04)" className={inputCls} />
            <input value={f.nome} onChange={e => set({ ...f, nome: e.target.value })} placeholder="Nome" className={inputCls} />
            <label className="text-xs text-[#a3a3a3] flex items-center gap-2">
              <input type="checkbox" checked={f.ativo} onChange={e => set({ ...f, ativo: e.target.checked })} /> Ativo
            </label>
          </div>
        )}
      />

      <ListaCrud
        titulo="Históricos Padrão"
        colunas={['Código', 'Descrição', 'Compl.']}
        linhas={historicos}
        formVazio={() => ({ codigo: '', descricao: '', exige_complemento: false, ativo: true })}
        onSalvar={async (f) => {
          if (!f.codigo || !f.descricao) throw new Error('Código e descrição são obrigatórios')
          await ctb.saveHistorico({ id: f.id, codigo: f.codigo, descricao: f.descricao, exige_complemento: f.exige_complemento, ativo: f.ativo })
          carregar()
        }}
        renderLinha={(l, editar) => (
          <tr key={l.id} className={`border-b border-[#141414] ${!l.ativo ? 'opacity-40' : ''}`}>
            <td className="py-2 text-[#a3a3a3]">{l.codigo}</td>
            <td className="py-2 text-white max-w-[260px] truncate" title={l.descricao}>{l.descricao}</td>
            <td className="py-2 text-[#666666]">{l.exige_complemento ? 'Sim' : 'Não'}</td>
            <td className="py-2 text-right"><button onClick={editar} className="text-[#666666] hover:text-white">Editar</button></td>
          </tr>
        )}
        renderForm={(f, set) => (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-3">
              <input value={f.codigo} onChange={e => set({ ...f, codigo: e.target.value })} placeholder="Código (ex.: H07)" className={inputCls} />
              <label className="text-xs text-[#a3a3a3] flex items-center gap-2 col-span-2">
                <input type="checkbox" checked={f.exige_complemento} onChange={e => set({ ...f, exige_complemento: e.target.checked })} />
                Exige complemento
              </label>
            </div>
            <input value={f.descricao} onChange={e => set({ ...f, descricao: e.target.value })}
              placeholder="Descrição — placeholders: {documento} {sacado} {valor} {parcela} {data}" className={inputCls} />
          </div>
        )}
      />
    </div>
  )
}
