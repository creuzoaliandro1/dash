import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Field, Feedback, Card, PrimaryButton, SecondaryButton, inputCls, textareaCls, extractError } from './shared'

const novaIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'bmp-' + Date.now() + '-' + Math.random().toString(16).slice(2)
}

const parseLista = (v) =>
  v
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

// A doc do BMP não especifica o schema exato da lista retornada por estes dois
// endpoints (só documenta {sucesso, mensagem}). Por isso procuramos, dentro da
// resposta bruta, o primeiro array de objetos — funciona com qualquer nome de
// campo que o BMP usar (ex.: "boletos", "boletosProtestaveis", "dados"...).
function encontrarPrimeiraLista(obj, profundidadeMax = 3) {
  if (!obj || typeof obj !== 'object' || profundidadeMax < 0) return null
  if (Array.isArray(obj)) {
    return obj.length > 0 && typeof obj[0] === 'object' ? obj : null
  }
  for (const key of Object.keys(obj)) {
    const val = obj[key]
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') return val
    if (val && typeof val === 'object') {
      const encontrada = encontrarPrimeiraLista(val, profundidadeMax - 1)
      if (encontrada) return encontrada
    }
  }
  return null
}

const codigoBarrasDaLinha = (item) =>
  item?.numCodBarras ?? item?.codigoBarras ?? item?.codBarras ?? item?.numeroCodigoBarras ?? null

function RawJson({ data }) {
  if (!data) return null
  return (
    <details className="mt-2 bg-[#111111] border border-[#2a2a2a] rounded-md p-2">
      <summary className="text-xs text-[#a3a3a3] cursor-pointer select-none">Resposta completa (JSON)</summary>
      <pre className="mt-2 text-[11px] text-[#d4d4d4] whitespace-pre-wrap break-all max-h-[420px] overflow-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  )
}

function TabelaGenerica({ linhas, selecionados, onToggle, onToggleTodos, colunas, acoesPorLinha }) {
  return (
    <div className="mt-2 overflow-x-auto border border-[#2a2a2a] rounded-md">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[#141414] text-[#666666] uppercase tracking-wider">
            <th className="text-left px-3 py-2 w-8">
              <input type="checkbox" checked={linhas.length > 0 && selecionados.size === linhas.length} onChange={onToggleTodos} />
            </th>
            {colunas.map((c) => (
              <th key={c.key} className="text-left px-3 py-2">{c.label}</th>
            ))}
            {acoesPorLinha && <th className="text-right px-3 py-2 w-10">Ações</th>}
          </tr>
        </thead>
        <tbody>
          {linhas.map((item, i) => {
            const cb = codigoBarrasDaLinha(item) ?? String(i)
            return (
              <tr key={cb + '-' + i} className="border-t border-[#1a1a1a] text-[#d4d4d4]">
                <td className="px-3 py-2">
                  <input type="checkbox" checked={selecionados.has(cb)} onChange={() => onToggle(cb)} />
                </td>
                {colunas.map((c) => (
                  <td key={c.key} className="px-3 py-2 break-all">{c.render ? c.render(item) : (item?.[c.key] ?? '—')}</td>
                ))}
                {acoesPorLinha && <td className="px-3 py-2 text-right">{acoesPorLinha(item, cb)}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function useSelecao() {
  const [selecionados, setSelecionados] = useState(new Set())
  const toggle = (chave) =>
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(chave)) next.delete(chave)
      else next.add(chave)
      return next
    })
  const toggleTodos = (linhas) =>
    setSelecionados((prev) =>
      prev.size === linhas.length ? new Set() : new Set(linhas.map((item, i) => codigoBarrasDaLinha(item) ?? String(i)))
    )
  const limpar = () => setSelecionados(new Set())
  return { selecionados, toggle, toggleTodos, limpar, setSelecionados }
}

// ---------- Consultar boletos protestáveis + Solicitar protesto (em lote) ----------
function ProtestaveisCard() {
  const [numeroCedente, setNumeroCedente] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resposta, setResposta] = useState(null)
  const [linhas, setLinhas] = useState([])
  const [solicitando, setSolicitando] = useState(false)
  const { selecionados, toggle, toggleTodos, limpar } = useSelecao()

  const handleConsultar = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResposta(null)
    setLinhas([])
    limpar()

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-protesto-consultar-protestaveis', {
        body: { numeroCedente: numeroCedente || undefined },
      })
      const errMsg = extractError(data, error, 'Erro ao consultar boletos protestáveis.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setResposta(data)
        const lista = encontrarPrimeiraLista(data?.raw) ?? []
        setLinhas(lista)
        if (lista.length === 0) {
          setFeedback({ ok: true, message: data?.mensagem || 'Consulta feita — ver JSON completo abaixo (estrutura de lista não documentada pela BMP).' })
        }
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  const handleSolicitarProtesto = async () => {
    if (selecionados.size === 0) return
    const confirmado = window.confirm(`Confirma a solicitação de protesto de ${selecionados.size} boleto(s)? Isso pode levar até 3 dias úteis para entrar em vigência.`)
    if (!confirmado) return

    setSolicitando(true)
    setFeedback(null)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-protesto-solicitar', {
        body: { numCodBarras: Array.from(selecionados), idempotencyKey: novaIdempotencyKey() },
      })
      const errMsg = extractError(data, error, 'Erro ao solicitar protesto.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setFeedback({ ok: true, message: data?.mensagem || 'Protesto solicitado com sucesso.' })
        limpar()
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setSolicitando(false)
    }
  }

  const colunas = [
    { key: 'numCodBarras', label: 'Código de barras', render: (i) => codigoBarrasDaLinha(i) ?? '—' },
    { key: 'nomeSacado', label: 'Pagador', render: (i) => i?.nomeSacado ?? i?.nomePagador ?? i?.nom_RzSocPagdr ?? '—' },
    { key: 'vlrTit', label: 'Valor', render: (i) => (i?.vlrTit ?? i?.valor ?? '—') },
    { key: 'dtVencimento', label: 'Vencimento', render: (i) => i?.dtVencimento ?? i?.dtVencTit ?? '—' },
  ]

  return (
    <Card title="Boletos protestáveis" description="Lista os boletos disponíveis para protesto. Selecione um ou mais e solicite o protesto (até 500 por vez).">
      <form onSubmit={handleConsultar} className="space-y-2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Field label="Número do cedente">
            <input className={inputCls} value={numeroCedente} onChange={(e) => setNumeroCedente(e.target.value)} disabled={loading} />
          </Field>
        </div>
        <Feedback feedback={feedback} />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Consultando...' : 'Consultar'}
        </PrimaryButton>
      </form>

      {linhas.length > 0 && (
        <>
          {selecionados.size > 0 && (
            <div className="mt-2 flex items-center justify-between bg-[#111111] border border-[#2a2a2a] rounded-md px-3 py-2">
              <p className="text-xs text-[#a3a3a3]">{selecionados.size} boleto(s) selecionado(s)</p>
              <SecondaryButton type="button" onClick={handleSolicitarProtesto} disabled={solicitando}>
                {solicitando ? 'Enviando...' : 'Solicitar protesto'}
              </SecondaryButton>
            </div>
          )}
          <TabelaGenerica
            linhas={linhas}
            selecionados={selecionados}
            onToggle={toggle}
            onToggleTodos={() => toggleTodos(linhas)}
            colunas={colunas}
          />
        </>
      )}

      <RawJson data={resposta?.raw} />
    </Card>
  )
}

// ---------- Ações unitárias (Histórico / Instrumento) num modal simples ----------
function HistoricoInstrumentoModal({ codigoBarras, onClose }) {
  const [historico, setHistorico] = useState(null)
  const [instrumentoUrl, setInstrumentoUrl] = useState(null)
  const [loadingHist, setLoadingHist] = useState(false)
  const [loadingInst, setLoadingInst] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const buscarHistorico = async () => {
    setLoadingHist(true)
    setFeedback(null)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-protesto-historico', { body: { numCodBarras: codigoBarras } })
      const errMsg = extractError(data, error, 'Erro ao consultar histórico.')
      if (errMsg) setFeedback({ ok: false, message: errMsg })
      else setHistorico(data)
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoadingHist(false)
    }
  }

  const baixarInstrumento = async () => {
    setLoadingInst(true)
    setFeedback(null)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-protesto-instrumento', { body: { numCodBarras: codigoBarras } })
      const errMsg = extractError(data, error, 'Erro ao baixar instrumento de protesto.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
        return
      }
      const contentType = data?.contentType || ''
      const conteudo = data?.conteudo
      if (typeof conteudo === 'string' && !contentType.toLowerCase().includes('json')) {
        setInstrumentoUrl(`data:${contentType || 'application/pdf'};base64,${conteudo}`)
        setFeedback({ ok: true, message: 'Instrumento gerado com sucesso.' })
      } else {
        setFeedback({ ok: true, message: 'Resposta recebida — ver detalhes no histórico/JSON.' })
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoadingInst(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-white text-sm font-semibold">Protesto — {codigoBarras}</h2>
          <button type="button" onClick={onClose} className="text-[#a3a3a3] hover:text-white text-sm">Fechar ✕</button>
        </div>
        <Card>
          <Feedback feedback={feedback} />
          <div className="flex gap-2 mt-2">
            <SecondaryButton type="button" onClick={buscarHistorico} disabled={loadingHist}>
              {loadingHist ? 'Consultando...' : 'Ver histórico'}
            </SecondaryButton>
            <SecondaryButton type="button" onClick={baixarInstrumento} disabled={loadingInst}>
              {loadingInst ? 'Gerando...' : 'Baixar instrumento'}
            </SecondaryButton>
          </div>

          {instrumentoUrl && (
            <div className="mt-2">
              <a
                href={instrumentoUrl}
                download={`instrumento-protesto-${codigoBarras}.pdf`}
                className="inline-block px-3 py-2 bg-white text-black font-medium rounded-md hover:opacity-90 transition text-sm"
              >
                Abrir/baixar instrumento
              </a>
            </div>
          )}

          <RawJson data={historico?.raw} />
        </Card>
      </div>
    </div>
  )
}

// ---------- Consultar boletos protestados + Cancelar / Anuência / Desistência (em lote) ----------
function ProtestadosCard() {
  const [codigosBarrasTexto, setCodigosBarrasTexto] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resposta, setResposta] = useState(null)
  const [linhas, setLinhas] = useState([])
  const [acaoLote, setAcaoLote] = useState(null)
  const [modalCodigoBarras, setModalCodigoBarras] = useState(null)
  const { selecionados, toggle, toggleTodos, limpar } = useSelecao()

  const handleConsultar = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResposta(null)
    setLinhas([])
    limpar()

    const codigos = parseLista(codigosBarrasTexto)
    if (codigos.length === 0) {
      setFeedback({ ok: false, message: 'Informe ao menos um código de barras (um por linha ou separados por vírgula).' })
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-protesto-consultar-protestados', {
        body: { numCodBarras: codigos },
      })
      const errMsg = extractError(data, error, 'Erro ao consultar boletos protestados.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setResposta(data)
        const lista = encontrarPrimeiraLista(data?.raw) ?? []
        setLinhas(lista)
        if (lista.length === 0) {
          setFeedback({ ok: true, message: data?.mensagem || 'Consulta feita — ver JSON completo abaixo (estrutura de lista não documentada pela BMP).' })
        }
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  const executarAcaoLote = async (funcao, rotulo, mensagemConfirmacao) => {
    if (selecionados.size === 0) return
    if (mensagemConfirmacao && !window.confirm(mensagemConfirmacao)) return

    setAcaoLote(funcao)
    setFeedback(null)
    try {
      const { data, error } = await supabase.functions.invoke(funcao, {
        body: { numCodBarras: Array.from(selecionados), idempotencyKey: novaIdempotencyKey() },
      })
      const errMsg = extractError(data, error, `Erro ao ${rotulo.toLowerCase()}.`)
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setFeedback({ ok: true, message: data?.mensagem || `${rotulo} enviado com sucesso.` })
        limpar()
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setAcaoLote(null)
    }
  }

  const colunas = [
    { key: 'numCodBarras', label: 'Código de barras', render: (i) => codigoBarrasDaLinha(i) ?? '—' },
    { key: 'situacao', label: 'Situação', render: (i) => i?.situacao ?? i?.situacaoProtesto ?? '—' },
    { key: 'dtProtesto', label: 'Data protesto', render: (i) => i?.dtProtesto ?? i?.dataProtesto ?? '—' },
    { key: 'cartorio', label: 'Cartório', render: (i) => i?.cartorio ?? i?.nomeCartorio ?? '—' },
  ]

  return (
    <Card title="Boletos protestados" description="Consulte pelo(s) código(s) de barras (um por linha ou separados por vírgula) e gerencie os protestos já solicitados.">
      <form onSubmit={handleConsultar} className="space-y-2">
        <Field label="Código(s) de barras">
          <textarea className={textareaCls} rows={3} value={codigosBarrasTexto} onChange={(e) => setCodigosBarrasTexto(e.target.value)} disabled={loading} />
        </Field>
        <Feedback feedback={feedback} />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Consultando...' : 'Consultar'}
        </PrimaryButton>
      </form>

      {linhas.length > 0 && (
        <>
          {selecionados.size > 0 && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 bg-[#111111] border border-[#2a2a2a] rounded-md px-3 py-2">
              <p className="text-xs text-[#a3a3a3]">{selecionados.size} boleto(s) selecionado(s)</p>
              <div className="flex gap-2">
                <SecondaryButton
                  type="button"
                  disabled={!!acaoLote}
                  onClick={() =>
                    executarAcaoLote('bmp-protesto-cancelar', 'Cancelamento de protesto', `Cancelar o protesto de ${selecionados.size} boleto(s)?`)
                  }
                >
                  {acaoLote === 'bmp-protesto-cancelar' ? 'Enviando...' : 'Cancelar protesto'}
                </SecondaryButton>
                <SecondaryButton
                  type="button"
                  disabled={!!acaoLote}
                  onClick={() =>
                    executarAcaoLote('bmp-protesto-solicitar-anuencia', 'Solicitação de anuência', `Solicitar anuência para ${selecionados.size} boleto(s)?`)
                  }
                >
                  {acaoLote === 'bmp-protesto-solicitar-anuencia' ? 'Enviando...' : 'Solicitar anuência'}
                </SecondaryButton>
                <SecondaryButton
                  type="button"
                  disabled={!!acaoLote}
                  onClick={() =>
                    executarAcaoLote(
                      'bmp-protesto-solicitar-desistencia',
                      'Solicitação de desistência',
                      `Solicitar desistência para ${selecionados.size} boleto(s)? Só é aceito para boletos "Em protesto".`
                    )
                  }
                >
                  {acaoLote === 'bmp-protesto-solicitar-desistencia' ? 'Enviando...' : 'Solicitar desistência'}
                </SecondaryButton>
              </div>
            </div>
          )}
          <TabelaGenerica
            linhas={linhas}
            selecionados={selecionados}
            onToggle={toggle}
            onToggleTodos={() => toggleTodos(linhas)}
            colunas={colunas}
            acoesPorLinha={(item, cb) => (
              <button
                type="button"
                onClick={() => setModalCodigoBarras(cb)}
                className="w-7 h-7 inline-flex items-center justify-center rounded-md text-[#a3a3a3] hover:text-white hover:bg-[#1f1f1f] transition"
                title="Histórico / Instrumento"
              >
                ⋯
              </button>
            )}
          />
        </>
      )}

      <RawJson data={resposta?.raw} />

      {modalCodigoBarras && (
        <HistoricoInstrumentoModal codigoBarras={modalCodigoBarras} onClose={() => setModalCodigoBarras(null)} />
      )}
    </Card>
  )
}

export default function ProtestoTab() {
  return (
    <div className="space-y-2 w-full">
      <ProtestaveisCard />
      <ProtestadosCard />
    </div>
  )
}
