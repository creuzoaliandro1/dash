import { useState, useEffect } from 'react'
import { buscarOpeitePorCic, updateBoleto } from '../../services/boletoService'

const normData = (d) => (d ? String(d).slice(0, 10) : '')
const fmtData = (d) => {
  const s = normData(d)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (s || '')
}
const fmtValor = (v) => {
  const n = parseFloat(v)
  return isNaN(n) ? '' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Recebe UM boleto (o selecionado) e mostra os lançamentos OPEITE do mesmo CIC.
export default function BuscarLancamentoModal({ boleto, onClose, onUpdated }) {
  const [opeites, setOpeites] = useState([])
  const [loading, setLoading] = useState(true)
  const [fValor, setFValor] = useState(false)
  const [fVenc, setFVenc] = useState(false)
  const [selecionado, setSelecionado] = useState(null) // OPEITE.NUM_LANCAMENTO
  const [salvando, setSalvando] = useState(false)
  const [sortCol, setSortCol] = useState('NUM_LANCAMENTO')
  const [sortDir, setSortDir] = useState('asc')

  const boletoValor = parseFloat(boleto?.valor) || 0
  const boletoVenc = normData(boleto?.data_vencimento)
  const boletoCic = String(boleto?.sacado_cic || '').replace(/\D/g, '')

  useEffect(() => {
    let cancel = false
    ;(async () => {
      setLoading(true)
      const { data } = await buscarOpeitePorCic(boletoCic)
      if (!cancel) {
        setOpeites(data || [])
        setLoading(false)
      }
    })()
    return () => { cancel = true }
  }, [boletoCic])

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const filtrados = opeites.filter((o) => {
    if (fValor && (parseFloat(o.VR_FACE) || 0) !== boletoValor) return false
    if (fVenc && normData(o.DT_VENCI) !== boletoVenc) return false
    return true
  })

  const ordenados = [...filtrados].sort((a, b) => {
    let av = a[sortCol]
    let bv = b[sortCol]
    if (sortCol === 'VR_FACE') { av = parseFloat(av) || 0; bv = parseFloat(bv) || 0; return sortDir === 'asc' ? av - bv : bv - av }
    if (sortCol === 'DT_VENCI') { av = normData(av); bv = normData(bv) }
    av = String(av ?? ''); bv = String(bv ?? '')
    if (sortCol === 'NUM_LANCAMENTO') {
      const na = Number(av) || 0, nb = Number(bv) || 0
      return sortDir === 'asc' ? na - nb : nb - na
    }
    return sortDir === 'asc' ? av.localeCompare(bv, 'pt-BR') : bv.localeCompare(av, 'pt-BR')
  })

  const handleAtualizar = async () => {
    if (selecionado == null) {
      alert('Selecione um lançamento na lista.')
      return
    }
    setSalvando(true)
    try {
      const { error } = await updateBoleto(boleto.id, {
        num_lancamento: Number(selecionado),
        status_efactor: 'Antecipado',
      })
      if (error) {
        alert('Erro ao atualizar: ' + error.message)
      } else {
        alert(`Num Lançamento ${selecionado} aplicado ao boleto.`)
        if (onUpdated) onUpdated()
        onClose()
      }
    } catch (e) {
      alert('Erro ao atualizar: ' + e.message)
    } finally {
      setSalvando(false)
    }
  }

  const Seta = ({ col }) => (sortCol === col ? <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span> : null)
  const th = 'px-3 py-2 text-left text-xs font-semibold text-white cursor-pointer hover:opacity-80 select-none'

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="border-b border-[#1f1f1f] px-5 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Buscar Lançamento</h2>
            <p className="text-xs text-[#666666]">
              Boleto: doc {boleto?.numero_documento || '—'} · CIC {boletoCic || '—'} · valor {fmtValor(boletoValor)} · venc {fmtData(boletoVenc)}
            </p>
          </div>
          <button onClick={onClose} className="text-[#666666] hover:text-white text-2xl leading-none">×</button>
        </div>

        {/* Filtros */}
        <div className="px-5 py-3 flex items-center gap-4 border-b border-[#1f1f1f]">
          <span className="text-xs text-[#666666]">Filtrar OPEITE pelo boleto:</span>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={fValor} onChange={(e) => setFValor(e.target.checked)} className="w-4 h-4 accent-white cursor-pointer" />
            <span className="text-xs text-white">Valor</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={fVenc} onChange={(e) => setFVenc(e.target.checked)} className="w-4 h-4 accent-white cursor-pointer" />
            <span className="text-xs text-white">Vencimento</span>
          </label>
          <span className="ml-auto text-xs text-[#666666]">{loading ? 'Buscando...' : `${ordenados.length} lançamento(s)`}</span>
        </div>

        {/* Tabela */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#111111] z-10">
              <tr>
                <th className="px-3 py-2 w-10"></th>
                <th className={th} onClick={() => handleSort('NUM_LANCAMENTO')}>Num Lançamento <Seta col="NUM_LANCAMENTO" /></th>
                <th className={th} onClick={() => handleSort('NUM_TITULO')}>Num Título <Seta col="NUM_TITULO" /></th>
                <th className={`${th} text-right`} onClick={() => handleSort('VR_FACE')}>VR Face <Seta col="VR_FACE" /></th>
                <th className={th} onClick={() => handleSort('DT_VENCI')}>DT Venci <Seta col="DT_VENCI" /></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="px-3 py-6 text-center text-[#666666]">Buscando...</td></tr>}
              {!loading && ordenados.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-[#666666]">Nenhum lançamento OPEITE para este CIC.</td></tr>
              )}
              {ordenados.map((o, i) => {
                const sel = selecionado === o.NUM_LANCAMENTO
                return (
                  <tr
                    key={`${o.NUM_LANCAMENTO}-${i}`}
                    onClick={() => setSelecionado(o.NUM_LANCAMENTO)}
                    className={`border-b border-[#1a1a1a] cursor-pointer transition ${sel ? 'bg-[#1a2a1a]' : 'hover:bg-[#111111]'}`}
                  >
                    <td className="px-3 py-2 text-center">
                      <input type="radio" name="opeiteSel" checked={sel} onChange={() => setSelecionado(o.NUM_LANCAMENTO)} className="w-4 h-4 accent-white cursor-pointer" />
                    </td>
                    <td className="px-3 py-2 text-white font-mono">{o.NUM_LANCAMENTO}</td>
                    <td className="px-3 py-2 text-[#a3a3a3]">{o.NUM_TITULO || '—'}</td>
                    <td className="px-3 py-2 text-white font-mono text-right">{fmtValor(o.VR_FACE)}</td>
                    <td className="px-3 py-2 text-[#a3a3a3]">{fmtData(o.DT_VENCI)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t border-[#1f1f1f] px-5 py-3 flex justify-between items-center gap-3">
          <span className="text-xs text-[#666666]">{selecionado != null ? `Selecionado: ${selecionado}` : 'Selecione um lançamento'}</span>
          <div className="flex gap-3">
            <button onClick={onClose} disabled={salvando} className="px-5 py-2 bg-transparent text-white text-sm font-medium border border-[#2a2a2a] rounded hover:bg-[#111111] transition disabled:opacity-50">
              Cancelar
            </button>
            <button
              onClick={handleAtualizar}
              disabled={salvando || selecionado == null}
              className="px-5 py-2 bg-white text-black text-sm font-medium rounded hover:opacity-90 transition disabled:opacity-50"
            >
              {salvando ? 'Atualizando...' : 'Atualizar Num Lançamento'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
