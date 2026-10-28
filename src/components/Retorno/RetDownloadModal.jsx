import { useEffect, useMemo, useState } from 'react'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { listRetFiles, downloadRetFile } from '../../services/boletoService'

// Lista os arquivos .RET salvos no bucket 'retornos' (sem paginação), com
// checkbox por arquivo e Ações › baixar os marcados (ou todos) num único .zip.

const fmtData = (d) => {
  if (!d) return '—'
  const x = new Date(d)
  if (isNaN(x)) return '—'
  return x.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
const fmtTam = (n) => {
  if (n == null) return '—'
  if (n < 1024) return `${n} B`
  return `${(n / 1024).toFixed(1).replace('.', ',')} KB`
}
const p2 = (n) => String(n).padStart(2, '0')

export default function RetDownloadModal({ onClose }) {
  const [arquivos, setArquivos] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [sel, setSel] = useState(new Set())
  const [openMenu, setOpenMenu] = useState(false)
  const [progresso, setProgresso] = useState('')

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const { data, error } = await listRetFiles()
      if (!vivo) return
      if (error) setErro(error.message || String(error))
      setArquivos(data || [])
      setLoading(false)
    })()
    return () => { vivo = false }
  }, [])

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase()
    if (!t) return arquivos
    return arquivos.filter(a => a.nome.toLowerCase().includes(t) || fmtData(a.data).includes(t))
  }, [arquivos, busca])

  const todosMarcados = lista.length > 0 && lista.every(a => sel.has(a.key))
  const toggleTodos = () => {
    const n = new Set(sel)
    if (todosMarcados) lista.forEach(a => n.delete(a.key))
    else lista.forEach(a => n.add(a.key))
    setSel(n)
  }
  const toggle = (key) => {
    const n = new Set(sel)
    n.has(key) ? n.delete(key) : n.add(key)
    setSel(n)
  }

  const baixarZip = async (alvo) => {
    setOpenMenu(false)
    if (!alvo.length) { alert('Nenhum arquivo para baixar.'); return }
    const zip = new JSZip()
    const usados = new Set()
    const falhas = []
    const blobs = new Array(alvo.length)
    // Baixa em paralelo (8 por vez) — o bucket tem milhares de arquivos.
    let prox = 0, feitos = 0
    const worker = async () => {
      while (prox < alvo.length) {
        const i = prox++
        const { data, error } = await downloadRetFile(alvo[i].key)
        if (error || !data) falhas.push(`${alvo[i].nome}: ${error?.message || 'falha no download'}`)
        else blobs[i] = data
        setProgresso(`Baixando ${++feitos} de ${alvo.length}...`)
      }
    }
    await Promise.all(Array.from({ length: Math.min(8, alvo.length) }, worker))
    alvo.forEach((a, i) => {
      if (!blobs[i]) return
      // Homônimos (mesmo nome, conteúdo diferente) mantêm a chave com o hash.
      const nome = usados.has(a.nome.toLowerCase()) ? a.key : a.nome
      usados.add(nome.toLowerCase())
      zip.file(nome, blobs[i])
    })
    const ok = alvo.length - falhas.length
    if (ok > 0) {
      setProgresso('Compactando...')
      const now = new Date()
      const zipName = `RETORNOS_${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}_${p2(now.getHours())}${p2(now.getMinutes())}${p2(now.getSeconds())}.zip`
      saveAs(await zip.generateAsync({ type: 'blob' }), zipName)
    }
    setProgresso('')
    if (falhas.length) alert(`${ok} arquivo(s) baixado(s). Falhas (${falhas.length}):\n${falhas.join('\n')}`)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#1f1f1f]">
          <div>
            <h2 className="text-white font-semibold text-sm">Arquivos de retorno (.RET)</h2>
            <p className="text-[#666666] text-xs mt-0.5">
              {loading ? 'Carregando...' : `${lista.length} arquivo(s)${lista.length !== arquivos.length ? ` de ${arquivos.length}` : ''}`}
              {sel.size > 0 && ` · ${sel.size} sel.`}
            </p>
          </div>
          <button onClick={onClose} className="text-[#666666] hover:text-white transition" title="Fechar">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Barra: busca + Ações */}
        <div className="flex items-center gap-2 px-5 py-3">
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar..."
            className="flex-1 px-3 py-1 bg-[#111111] border border-[#2a2a2a] rounded text-white placeholder-[#666666] text-xs focus:border-white outline-none transition"
          />
          <div className="relative">
            <button
              onClick={() => setOpenMenu(o => !o)}
              disabled={!!progresso || loading}
              className="text-xs text-[#a3a3a3] hover:text-white border border-[#2a2a2a] rounded px-2.5 py-1 transition disabled:opacity-50"
            >
              {progresso || 'Ações ▾'}
            </button>
            {openMenu && (
              <div className="absolute right-0 mt-1 w-60 bg-[#111111] border border-[#2a2a2a] rounded-lg shadow-lg z-20">
                {sel.size > 0 && (
                  <button
                    onClick={() => baixarZip(arquivos.filter(a => sel.has(a.key)))}
                    className="block w-full text-left px-3 py-2 text-xs text-[#a3a3a3] hover:bg-[#1a1a1a] hover:text-white transition"
                  >
                    📦 Baixar selecionados em .zip ({sel.size})
                  </button>
                )}
                <button
                  onClick={() => baixarZip(lista)}
                  className="block w-full text-left px-3 py-2 text-xs text-[#a3a3a3] hover:bg-[#1a1a1a] hover:text-white transition"
                >
                  📦 Baixar todos em .zip ({lista.length})
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4">
          {erro && <p className="text-red-400 text-xs mb-2">Erro ao listar arquivos: {erro}</p>}
          {!loading && !lista.length && !erro && <p className="text-[#666666] text-xs py-6 text-center">Nenhum arquivo encontrado.</p>}
          {lista.length > 0 && (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#0a0a0a]">
                <tr className="text-[#666666] text-left border-b border-[#1f1f1f]">
                  <th className="py-2 w-8">
                    <input type="checkbox" checked={todosMarcados} onChange={toggleTodos} className="w-4 h-4 cursor-pointer accent-white" />
                  </th>
                  <th className="py-2 font-semibold">Arquivo</th>
                  <th className="py-2 font-semibold w-40">Salvo em</th>
                  <th className="py-2 font-semibold w-20 text-right">Tamanho</th>
                </tr>
              </thead>
              <tbody>
                {lista.map(a => (
                  <tr key={a.key} onClick={() => toggle(a.key)} className={`border-b border-[#141414] cursor-pointer hover:bg-[#111111] ${sel.has(a.key) ? 'bg-[#141414]' : ''}`}>
                    <td className="py-1.5">
                      <input type="checkbox" checked={sel.has(a.key)} onChange={() => toggle(a.key)} onClick={(e) => e.stopPropagation()} className="w-4 h-4 cursor-pointer accent-white" />
                    </td>
                    <td className="py-1.5 text-white" title={a.key}>{a.nome}</td>
                    <td className="py-1.5 text-[#a3a3a3]">{fmtData(a.data)}</td>
                    <td className="py-1.5 text-[#a3a3a3] text-right">{fmtTam(a.tamanho)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
