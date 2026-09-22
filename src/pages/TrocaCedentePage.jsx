import { useState, useEffect, useRef } from 'react'
import {
  parseTrocaCedenteFile,
  resolverBairroTroca,
  gravarTrocaCedente,
  getTrocaCedente,
} from '../services/trocaCedenteService'

export default function TrocaCedentePage() {
  const [registros, setRegistros] = useState([])
  const [loading, setLoading] = useState(false)
  const [importando, setImportando] = useState(false)
  const [busca, setBusca] = useState('')
  const fileRef = useRef(null)

  const carregar = async () => {
    setLoading(true)
    try {
      setRegistros(await getTrocaCedente())
    } catch (e) {
      console.error('[TrocaCedente] carregar:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar() }, [])

  const handleArquivo = async (e) => {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    setImportando(true)
    try {
      const linhas = await parseTrocaCedenteFile(file)
      if (!linhas.length) { alert('Nenhuma linha válida encontrada no arquivo.'); return }
      const comBairro = await resolverBairroTroca(linhas)
      const res = await gravarTrocaCedente(comBairro)
      await carregar()
      if (res.error) {
        alert('Erro ao gravar: ' + (res.error.message || res.error))
      } else {
        const comBairroN = comBairro.filter((r) => r.bairro).length
        alert(
          `Arquivo processado: ${res.total} linha(s).\n` +
          `Novos: ${res.inseridos} · Atualizados: ${res.atualizados} · Ignorados (sem alteração): ${res.ignorados}` +
          (res.duplicadosInternos ? `\nDuplicados internos no arquivo (mesma linha digitável): ${res.duplicadosInternos}` : '') +
          (res.falhas ? `\nFalhas: ${res.falhas}` : '') +
          `\nBairro preenchido: ${comBairroN}/${comBairro.length}`
        )
      }
    } catch (err) {
      console.error('[TrocaCedente] import:', err)
      alert('Erro ao importar: ' + (err?.message || err))
    } finally {
      setImportando(false)
    }
  }

  const termo = busca.trim().toLowerCase()
  const filtrados = termo
    ? registros.filter((r) =>
        [r.nosso_numero, r.linha_digitavel, r.nome_pagador, r.cidade_pagador, r.bairro, r.numero_documento, r.status_negociacao]
          .some((v) => String(v || '').toLowerCase().includes(termo)))
    : registros

  const fmtData = (v) => {
    if (!v) return '—'
    const d = new Date(v)
    return isNaN(d.getTime()) ? String(v) : d.toLocaleString('pt-BR')
  }

  const COLS = ['Nosso número', 'Nº documento', 'Pagador', 'Cidade/UF', 'Bairro', 'Valor', 'Vencimento', 'St. boleto', 'St. negociação', 'Cedente', 'Atualizado']

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Troca Cedente</h1>
          <p className="text-sm text-[#a3a3a3] mt-1 max-w-2xl">
            Importe o Relatório de Gestão de Boletos Negociados (BMP). Os registros são gravados em
            <span className="text-white"> capt_troca_cedente</span>: duplicados são ignorados e linhas alteradas são atualizadas.
            O bairro é resolvido a partir de capt_boletos / capt_registrado usando a linha digitável / nosso número.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleArquivo} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importando}
            className={`flex items-center gap-2 px-4 h-10 text-sm font-medium rounded transition ${
              importando
                ? 'bg-[#1a1a1a] text-[#666666] border border-[#2a2a2a] cursor-not-allowed'
                : 'bg-white text-black hover:bg-[#e5e5e5]'
            }`}
          >
            {importando ? '⏳ Importando...' : '📄 Selecionar Excel'}
          </button>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between gap-3">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nosso número, pagador, cidade, bairro, título..."
          className="w-80 max-w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-3 h-9 text-sm text-white placeholder-[#666666] focus:outline-none focus:border-[#3a3a3a]"
        />
        <span className="text-xs text-[#666666]">
          {filtrados.length} registro(s){termo ? ` de ${registros.length}` : ''}
        </span>
      </div>

      <div className="border border-[#1f1f1f] rounded overflow-auto max-h-[calc(100vh-240px)]">
        <table className="w-full text-[12px] text-left border-collapse">
          <thead className="sticky top-0 bg-[#111111] text-[#a3a3a3]">
            <tr>
              {COLS.map((h) => (
                <th key={h} className="px-3 py-2 whitespace-nowrap font-medium border-b border-[#1f1f1f]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={COLS.length} className="px-3 py-6 text-center text-[#666666]">Carregando...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={COLS.length} className="px-3 py-6 text-center text-[#666666]">Nenhum registro. Importe um arquivo Excel para começar.</td></tr>
            ) : (
              filtrados.map((r) => (
                <tr key={r.id} className="hover:bg-[#0f0f0f] border-b border-[#161616]">
                  <td className="px-3 py-1.5 whitespace-nowrap text-white">{r.nosso_numero || '—'}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-[#a3a3a3]">{r.numero_documento || '—'}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-[#a3a3a3] max-w-[220px] truncate" title={r.nome_pagador || ''}>{r.nome_pagador || '—'}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-[#a3a3a3]">{[r.cidade_pagador, r.uf_pagador].filter(Boolean).join(' / ') || '—'}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-[#a3a3a3]">{r.bairro || '—'}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-[#a3a3a3]">{r.valor_titulo || '—'}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-[#a3a3a3]">{r.data_vencimento || '—'}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-[#a3a3a3]">{r.status_boleto || '—'}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-[#a3a3a3] max-w-[200px] truncate" title={r.status_negociacao || ''}>{r.status_negociacao || '—'}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-[#a3a3a3]">{r.cod_cedente_titular || '—'}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-[#666666]">{fmtData(r.updated_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
