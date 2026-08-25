import { useState, useEffect, useMemo } from 'react'
import { getRemessas, getDownloadUrlRemessa, getAllContas } from '../services/boletoService'
import { createAndDownloadZip } from '../utils/zipUtils'

const formatDataHora = (v) => {
  if (!v) return '—'
  const d = new Date(String(v).replace(' ', 'T'))
  if (isNaN(d.getTime())) return String(v)
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// YYYY-MM-DD (para comparar com os inputs de data)
const soData = (v) => (v ? String(v).slice(0, 10) : '')

export default function RemessasPage() {
  const [remessas, setRemessas] = useState([])
  const [contasMap, setContasMap] = useState({})
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [dataIni, setDataIni] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [page, setPage] = useState(1)
  const [baixando, setBaixando] = useState(null)
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [openActionsMenu, setOpenActionsMenu] = useState(false)
  const [zipping, setZipping] = useState(false)
  const [zipProgress, setZipProgress] = useState(null)
  const pageSize = 50

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const [{ data: rem }, { data: contas }] = await Promise.all([getRemessas(), getAllContas()])
      setRemessas(rem || [])
      const map = {}
      ;(contas || []).forEach((c) => {
        const cod = String(c.cedente || '').trim()
        if (cod) map[cod] = c.nome_correntista || cod
      })
      setContasMap(map)
    } catch (err) {
      console.error('[RemessasPage] erro ao carregar:', err)
    } finally {
      setLoading(false)
    }
  }

  const nomeCedente = (cod) => contasMap[String(cod || '').trim()] || null

  const filtradas = useMemo(() => {
    let list = remessas
    const term = searchTerm.trim().toLowerCase()
    if (term) {
      list = list.filter((r) => {
        const arq = String(r.ARQUIVO_REMESSA || '').toLowerCase()
        const cod = String(r.CONTA || '').toLowerCase()
        const nome = String(nomeCedente(r.CONTA) || '').toLowerCase()
        return arq.includes(term) || cod.includes(term) || nome.includes(term)
      })
    }
    if (dataIni) list = list.filter((r) => soData(r.DATA_ENVIO || r.DATA_REMESSA) >= dataIni)
    if (dataFim) list = list.filter((r) => soData(r.DATA_ENVIO || r.DATA_REMESSA) <= dataFim)
    return list
  }, [remessas, searchTerm, dataIni, dataFim, contasMap])

  useEffect(() => { setPage(1) }, [searchTerm, dataIni, dataFim])

  const totalPages = Math.max(1, Math.ceil(filtradas.length / pageSize))
  const pagina = filtradas.slice((page - 1) * pageSize, page * pageSize)

  const todasFiltradasSelecionadas = filtradas.length > 0 && filtradas.every((r) => selectedRows.has(r.ID))

  const toggleRow = (id) => {
    setSelectedRows((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const toggleTodas = () => {
    setSelectedRows((prev) => {
      const n = new Set(prev)
      if (filtradas.every((r) => n.has(r.ID))) {
        filtradas.forEach((r) => n.delete(r.ID))
      } else {
        filtradas.forEach((r) => n.add(r.ID))
      }
      return n
    })
  }

  const handleDownload = async (r) => {
    if (!r.CAMINHO_STORAGE) {
      alert('Esta remessa não tem arquivo salvo no storage.')
      return
    }
    setBaixando(r.ID)
    try {
      const { data: url, error } = await getDownloadUrlRemessa(r.CAMINHO_STORAGE, r.ARQUIVO_REMESSA)
      if (error || !url) {
        alert('Não foi possível gerar o link de download: ' + (error?.message || 'erro'))
        return
      }
      const a = document.createElement('a')
      a.href = url
      a.download = r.ARQUIVO_REMESSA || 'remessa.REM'
      document.body.appendChild(a)
      a.click()
      a.remove()
    } finally {
      setBaixando(null)
    }
  }

  const handleBaixarZip = async () => {
    setOpenActionsMenu(false)
    const alvos = remessas.filter((r) => selectedRows.has(r.ID) && r.CAMINHO_STORAGE)
    if (alvos.length === 0) {
      alert('Selecione ao menos uma remessa que tenha arquivo no storage.')
      return
    }
    if (alvos.length > 100 && !window.confirm(`Você selecionou ${alvos.length} remessas. Gerar o ZIP pode demorar. Continuar?`)) {
      return
    }
    setZipping(true)
    setZipProgress({ done: 0, total: alvos.length })
    try {
      const usados = new Map()
      const nomeUnico = (r) => {
        let nome = r.ARQUIVO_REMESSA || `remessa_${r.ID}.REM`
        if (usados.has(nome)) {
          usados.set(nome, usados.get(nome) + 1)
          const dot = nome.lastIndexOf('.')
          nome = dot > 0 ? `${nome.slice(0, dot)}_${r.ID}${nome.slice(dot)}` : `${nome}_${r.ID}`
        } else {
          usados.set(nome, 1)
        }
        return nome
      }
      const arquivos = []
      let idx = 0
      let done = 0
      const CONC = 5
      const worker = async () => {
        while (idx < alvos.length) {
          const r = alvos[idx++]
          try {
            const { data: url } = await getDownloadUrlRemessa(r.CAMINHO_STORAGE)
            if (url) {
              const resp = await fetch(url)
              const blob = await resp.blob()
              arquivos.push({ filename: nomeUnico(r), blob })
            }
          } catch (e) {
            console.warn('[ZIP remessa] falha ao baixar', r.ARQUIVO_REMESSA, e)
          }
          done++
          setZipProgress({ done, total: alvos.length })
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONC, alvos.length) }, worker))

      if (arquivos.length === 0) {
        alert('Não foi possível baixar nenhum arquivo das remessas selecionadas.')
        return
      }
      const now = new Date()
      const stamp = `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getFullYear()).slice(-2)}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
      await createAndDownloadZip(arquivos, `remessas_${stamp}.zip`)
      if (arquivos.length < alvos.length) {
        alert(`ZIP gerado com ${arquivos.length} de ${alvos.length} arquivos (alguns não puderam ser baixados).`)
      }
    } catch (e) {
      console.error('[RemessasPage] erro ao gerar ZIP:', e)
      alert('Erro ao gerar ZIP: ' + (e?.message || e))
    } finally {
      setZipping(false)
      setZipProgress(null)
    }
  }

  const handleLimpar = () => { setSearchTerm(''); setDataIni(''); setDataFim('') }

  const acoesLabel = zipping
    ? `Gerando ZIP...${zipProgress ? ` (${zipProgress.done}/${zipProgress.total})` : ''}`
    : `Ações${selectedRows.size ? ` (${selectedRows.size})` : ''}`

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-white">Remessas</h1>
          <p className="text-sm text-[#666666] mt-1">Arquivos de remessa CNAB400 (.REM) gerados — download individual ou em .zip</p>
        </div>
        <button
          onClick={load}
          className="px-3 py-2 text-xs text-[#a3a3a3] hover:text-white border border-[#2a2a2a] rounded transition"
          title="Recarregar"
        >
          Atualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 items-end flex-wrap">
        <div className="flex-1 relative min-w-[220px]">
          <input
            type="text"
            placeholder="Buscar por arquivo, cedente ou código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 bg-[#111111] border border-[#2a2a2a] rounded-md text-white placeholder-[#666666] focus:border-white focus:bg-[#1a1a1a] outline-none transition text-sm"
          />
          <svg className="absolute right-3 top-2.5 w-4 h-4 text-[#666666]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#666666]">Período:</span>
          <input
            type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)}
            className="px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-xs focus:border-white outline-none transition w-36"
            title="Data início"
          />
          <input
            type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
            className="px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-xs focus:border-white outline-none transition w-36"
            title="Data fim"
          />
          {(searchTerm || dataIni || dataFim) && (
            <button onClick={handleLimpar} className="px-3 py-2 text-xs text-[#a3a3a3] hover:text-white transition">Limpar</button>
          )}

          {/* Ações */}
          <div className="relative">
            <button
              onClick={() => setOpenActionsMenu((o) => !o)}
              disabled={selectedRows.size === 0 || zipping}
              className="px-4 py-2 bg-white text-black text-xs font-medium rounded hover:opacity-90 transition disabled:opacity-40 whitespace-nowrap"
            >
              {acoesLabel}
            </button>
            {openActionsMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setOpenActionsMenu(false)} />
                <div className="absolute right-0 mt-1 w-60 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg shadow-lg z-20 py-1">
                  <button
                    onClick={handleBaixarZip}
                    disabled={selectedRows.size === 0}
                    className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#111111] transition disabled:opacity-40"
                  >
                    Baixar .zip das selecionadas ({selectedRows.size})
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Contagem */}
      <div className="text-xs text-[#666666]">
        {loading ? 'Carregando...' : `${filtradas.length} remessa(s)`}
        {selectedRows.size > 0 && <span className="text-[#a3a3a3]"> · {selectedRows.size} selecionada(s)</span>}
      </div>

      {/* Tabela */}
      <div className="flex-1 min-h-0 overflow-auto border border-[#1f1f1f] rounded-lg">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[#0a0a0a] z-10">
            <tr className="text-left text-[#666666] border-b border-[#1f1f1f]">
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={todasFiltradasSelecionadas}
                  onChange={toggleTodas}
                  className="accent-white cursor-pointer"
                  title="Selecionar todas (filtradas)"
                />
              </th>
              <th className="px-4 py-3 font-medium">Arquivo</th>
              <th className="px-4 py-3 font-medium">Cedente</th>
              <th className="px-4 py-3 font-medium">Data / Hora</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {!loading && pagina.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[#666666]">Nenhuma remessa encontrada.</td></tr>
            )}
            {pagina.map((r) => (
              <tr key={r.ID} className={`border-b border-[#141414] hover:bg-[#111111] transition ${selectedRows.has(r.ID) ? 'bg-[#0d0d0d]' : ''}`}>
                <td className="px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={selectedRows.has(r.ID)}
                    onChange={() => toggleRow(r.ID)}
                    className="accent-white cursor-pointer"
                  />
                </td>
                <td className="px-4 py-2.5 font-mono text-white whitespace-nowrap">{r.ARQUIVO_REMESSA || '—'}</td>
                <td className="px-4 py-2.5 text-[#e5e5e5]">
                  {nomeCedente(r.CONTA) || <span className="text-[#666666]">—</span>}
                  {r.CONTA ? <span className="text-[#666666] ml-2 text-xs font-mono">{r.CONTA}</span> : null}
                </td>
                <td className="px-4 py-2.5 text-[#a3a3a3] whitespace-nowrap">{formatDataHora(r.DATA_ENVIO || r.DATA_REMESSA)}</td>
                <td className="px-4 py-2.5">
                  <span className="px-2 py-0.5 rounded text-xs bg-[#111111] border border-[#2a2a2a] text-[#a3a3a3]">{r.STATUS || '—'}</span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  {r.CAMINHO_STORAGE ? (
                    <button
                      onClick={() => handleDownload(r)}
                      disabled={baixando === r.ID}
                      className="px-3 py-1.5 text-xs bg-white text-black font-medium rounded hover:opacity-90 transition disabled:opacity-50"
                    >
                      {baixando === r.ID ? 'Baixando...' : 'Baixar .REM'}
                    </button>
                  ) : (
                    <span className="text-xs text-[#666666]">sem arquivo</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-[#a3a3a3]">
          <span>Página {page} de {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              className="px-3 py-1.5 border border-[#2a2a2a] rounded hover:bg-[#111111] transition disabled:opacity-40"
            >Anterior</button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="px-3 py-1.5 border border-[#2a2a2a] rounded hover:bg-[#111111] transition disabled:opacity-40"
            >Próxima</button>
          </div>
        </div>
      )}
    </div>
  )
}
