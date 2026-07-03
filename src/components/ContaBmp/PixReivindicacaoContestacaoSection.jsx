import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Field, Feedback, Card, PrimaryButton, SecondaryButton, inputCls, selectCls, extractError, formatMoeda, formatDataHora } from './shared'

const novaIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'bmp-' + Date.now() + '-' + Math.random().toString(16).slice(2)
}

// A doc do BMP não especifica com 100% de detalhe o schema de algumas respostas
// (ex.: paginação de "transações aptas"). Por isso procuramos, dentro da resposta
// bruta, o primeiro array de objetos — funciona com qualquer nome de campo que o
// BMP usar (ex.: "items", "dados", "transacoes"...).
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

const chaveDaLinha = (item, i) =>
  item?.codigo ?? item?.codigoContestacao ?? item?.codigoReivindicacao ?? item?.codigoTransacao ?? item?.id ?? String(i)

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
            const ck = chaveDaLinha(item, i)
            return (
              <tr key={ck + '-' + i} className="border-t border-[#1a1a1a] text-[#d4d4d4]">
                <td className="px-3 py-2">
                  <input type="checkbox" checked={selecionados.has(ck)} onChange={() => onToggle(ck)} />
                </td>
                {colunas.map((c) => (
                  <td key={c.key} className="px-3 py-2 break-all">{c.render ? c.render(item) : (item?.[c.key] ?? '—')}</td>
                ))}
                {acoesPorLinha && <td className="px-3 py-2 text-right">{acoesPorLinha(item, ck)}</td>}
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
      prev.size === linhas.length ? new Set() : new Set(linhas.map((item, i) => chaveDaLinha(item, i)))
    )
  const limpar = () => setSelecionados(new Set())
  return { selecionados, toggle, toggleTodos, limpar, setSelecionados }
}

const contaVazia = { agencia: '', agenciaDigito: '', conta: '', contaDigito: '', contaPgto: '', tipoConta: '', modeloConta: '' }

function montarContaDto(c) {
  const dto = {}
  if (c.agencia) dto.agencia = c.agencia
  if (c.agenciaDigito) dto.agenciaDigito = c.agenciaDigito
  if (c.conta) dto.conta = c.conta
  if (c.contaDigito) dto.contaDigito = c.contaDigito
  if (c.contaPgto) dto.contaPgto = c.contaPgto
  if (c.tipoConta) dto.tipoConta = Number(c.tipoConta)
  if (c.modeloConta) dto.modeloConta = Number(c.modeloConta)
  return dto
}

function CamposConta({ conta, setConta, disabled }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      <Field label="Agência">
        <input className={inputCls} value={conta.agencia} onChange={(e) => setConta({ ...conta, agencia: e.target.value })} disabled={disabled} />
      </Field>
      <Field label="Dígito agência">
        <input className={inputCls} value={conta.agenciaDigito} onChange={(e) => setConta({ ...conta, agenciaDigito: e.target.value })} disabled={disabled} />
      </Field>
      <Field label="Conta com dígito">
        <input className={inputCls} value={conta.contaPgto} onChange={(e) => setConta({ ...conta, contaPgto: e.target.value })} disabled={disabled} placeholder="ex.: 1234567-8" />
      </Field>
      <Field label="Tipo de conta">
        <select className={selectCls} value={conta.tipoConta} onChange={(e) => setConta({ ...conta, tipoConta: e.target.value })} disabled={disabled}>
          <option value="">—</option>
          <option value="1">1 - Corrente</option>
          <option value="2">2 - Poupança</option>
          <option value="3">3 - Pagamento</option>
          <option value="4">4 - Salário</option>
        </select>
      </Field>
    </div>
  )
}

const TIPOS_CHAVE = [
  { value: '0', label: '0 - CPF' },
  { value: '1', label: '1 - CNPJ' },
  { value: '2', label: '2 - Telefone' },
  { value: '3', label: '3 - Email' },
  { value: '4', label: '4 - EVP' },
]

const TIPOS_MFA = [
  { value: '1', label: '1 - App' },
  { value: '2', label: '2 - SMS' },
  { value: '3', label: '3 - Email' },
  { value: '6', label: '6 - DBS Retaguarda' },
  { value: '7', label: '7 - WhatsApp' },
]

const STATUS_REIVINDICACAO = { 0: 'Aberta', 1: 'Aguardando resolução', 2: 'Confirmada', 3: 'Cancelada', 4: 'Concluída', 5: 'Expirada' }

// ---------- Solicitar MFA + Solicitar Reivindicação de chave ----------
function SolicitarReivindicacaoCard() {
  const [conta, setConta] = useState(contaVazia)
  const [tipoMfa, setTipoMfa] = useState('3')
  const [destinoEnvio, setDestinoEnvio] = useState('')
  const [chave, setChave] = useState('')
  const [tipoChave, setTipoChave] = useState('3')
  const [codigoAutenticacao, setCodigoAutenticacao] = useState('')
  const [codigoMFA, setCodigoMFA] = useState('')
  const [loadingMfa, setLoadingMfa] = useState(false)
  const [loadingSolicitar, setLoadingSolicitar] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resposta, setResposta] = useState(null)

  const handleSolicitarMfa = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setLoadingMfa(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-pix-reivindicacao-mfa-solicitar', {
        body: { conta: montarContaDto(conta), tipoMfa: Number(tipoMfa), destinoEnvio: destinoEnvio || undefined, idempotencyKey: novaIdempotencyKey() },
      })
      const errMsg = extractError(data, error, 'Erro ao solicitar MFA.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setResposta(data)
        if (data?.codigoAutenticacao) setCodigoAutenticacao(data.codigoAutenticacao)
        setFeedback({ ok: true, message: data?.mensagem || 'MFA solicitado. Informe o código recebido e o código de autenticação abaixo.' })
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoadingMfa(false)
    }
  }

  const handleSolicitarReivindicacao = async (e) => {
    e.preventDefault()
    setFeedback(null)
    const confirmado = window.confirm(`Confirma a solicitação de reivindicação da chave "${chave}"?`)
    if (!confirmado) return

    setLoadingSolicitar(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-pix-reivindicacao-solicitar', {
        body: {
          conta: montarContaDto(conta),
          chave: chave || undefined,
          tipoChave: chave ? Number(tipoChave) : undefined,
          codigoAutenticacao: codigoAutenticacao || undefined,
          codigoMFA: codigoMFA || undefined,
          idempotencyKey: novaIdempotencyKey(),
        },
      })
      const errMsg = extractError(data, error, 'Erro ao solicitar reivindicação.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setResposta(data)
        setFeedback({ ok: true, message: data?.mensagem || `Reivindicação solicitada com sucesso${data?.codigoReivindicacao ? ` (código ${data.codigoReivindicacao})` : ''}.` })
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoadingSolicitar(false)
    }
  }

  return (
    <Card title="Solicitar reivindicação de chave Pix" description="Fluxo em duas etapas: (1) solicitar MFA para comprovar a titularidade da chave, (2) solicitar a reivindicação usando o código de autenticação e o código MFA recebido.">
      <div className="space-y-2">
        <CamposConta conta={conta} setConta={setConta} disabled={loadingMfa || loadingSolicitar} />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Field label="Tipo MFA">
            <select className={selectCls} value={tipoMfa} onChange={(e) => setTipoMfa(e.target.value)} disabled={loadingMfa}>
              {TIPOS_MFA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Destino do envio (email/telefone)">
            <input className={inputCls} value={destinoEnvio} onChange={(e) => setDestinoEnvio(e.target.value)} disabled={loadingMfa} />
          </Field>
          <div className="flex items-end">
            <SecondaryButton type="button" onClick={handleSolicitarMfa} disabled={loadingMfa}>
              {loadingMfa ? 'Enviando...' : '1. Solicitar MFA'}
            </SecondaryButton>
          </div>
        </div>

        <form onSubmit={handleSolicitarReivindicacao} className="space-y-2 border-t border-[#1a1a1a] pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Field label="Chave Pix">
              <input className={inputCls} value={chave} onChange={(e) => setChave(e.target.value)} disabled={loadingSolicitar} />
            </Field>
            <Field label="Tipo da chave">
              <select className={selectCls} value={tipoChave} onChange={(e) => setTipoChave(e.target.value)} disabled={loadingSolicitar}>
                {TIPOS_CHAVE.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Código de autenticação (MFA)">
              <input className={inputCls} value={codigoAutenticacao} onChange={(e) => setCodigoAutenticacao(e.target.value)} disabled={loadingSolicitar} placeholder="UUID retornado pelo passo 1" />
            </Field>
            <Field label="Código MFA recebido">
              <input className={inputCls} value={codigoMFA} onChange={(e) => setCodigoMFA(e.target.value)} disabled={loadingSolicitar} />
            </Field>
          </div>
          <Feedback feedback={feedback} />
          <PrimaryButton type="submit" disabled={loadingSolicitar}>
            {loadingSolicitar ? 'Enviando...' : '2. Solicitar reivindicação'}
          </PrimaryButton>
        </form>
      </div>

      <RawJson data={resposta?.raw} />
    </Card>
  )
}

// ---------- Listar reivindicações + Consultar detalhe + Cancelar (em lote) ----------
function ReivindicacoesCard() {
  const [conta, setConta] = useState(contaVazia)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resposta, setResposta] = useState(null)
  const [linhas, setLinhas] = useState([])
  const [cancelando, setCancelando] = useState(false)
  const [codigoConsulta, setCodigoConsulta] = useState('')
  const [loadingConsulta, setLoadingConsulta] = useState(false)
  const [detalheConsulta, setDetalheConsulta] = useState(null)
  const { selecionados, toggle, toggleTodos, limpar } = useSelecao()

  const handleListar = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResposta(null)
    setLinhas([])
    limpar()

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-pix-reivindicacao-listar', {
        body: montarContaDto(conta),
      })
      const errMsg = extractError(data, error, 'Erro ao listar reivindicações.')
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

  const handleConsultarDetalhe = async () => {
    if (!codigoConsulta) return
    setLoadingConsulta(true)
    setFeedback(null)
    setDetalheConsulta(null)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-pix-reivindicacao-consultar', {
        body: { codigoReivindicacao: codigoConsulta },
      })
      const errMsg = extractError(data, error, 'Erro ao consultar reivindicação.')
      if (errMsg) setFeedback({ ok: false, message: errMsg })
      else setDetalheConsulta(data)
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoadingConsulta(false)
    }
  }

  const handleCancelar = async () => {
    if (selecionados.size === 0) return
    const confirmado = window.confirm(`Cancelar ${selecionados.size} reivindicação(ões) selecionada(s)? Só é possível cancelar reivindicações ainda não efetivadas.`)
    if (!confirmado) return

    setCancelando(true)
    setFeedback(null)
    try {
      const codigos = Array.from(selecionados)
      const contaDto = montarContaDto(conta)
      const resultados = await Promise.all(
        codigos.map((codigo) =>
          supabase.functions.invoke('bmp-pix-reivindicacao-cancelar', {
            body: { codigo, conta: contaDto, idempotencyKey: novaIdempotencyKey() },
          })
        )
      )
      const falhas = resultados.filter(({ data, error }) => extractError(data, error, null))
      if (falhas.length > 0) {
        setFeedback({ ok: false, message: `${falhas.length} de ${codigos.length} cancelamento(s) falharam. Ver detalhes no console.` })
        console.error('[ReivindicacoesCard] falhas ao cancelar', falhas)
      } else {
        setFeedback({ ok: true, message: `${codigos.length} reivindicação(ões) cancelada(s) com sucesso.` })
        limpar()
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setCancelando(false)
    }
  }

  const colunas = [
    { key: 'codigo', label: 'Código', render: (i) => i?.codigo ?? '—' },
    { key: 'chave', label: 'Chave', render: (i) => i?.chave ?? '—' },
    { key: 'tipoReivindicacao', label: 'Tipo', render: (i) => (i?.tipoReivindicacao === 1 ? 'Portabilidade' : i?.tipoReivindicacao === 2 ? 'Posse' : i?.tipoReivindicacao ?? '—') },
    { key: 'participanteReivindicador', label: 'Reivindicador', render: (i) => i?.participanteReivindicador ?? '—' },
    { key: 'participanteDoador', label: 'Doador', render: (i) => i?.participanteDoador ?? '—' },
    { key: 'dtInclusao', label: 'Data inclusão', render: (i) => formatDataHora(i?.dtInclusao) },
  ]

  return (
    <Card title="Reivindicações de chave Pix" description="Liste as reivindicações da conta, consulte o status de uma reivindicação específica ou cancele reivindicações pendentes (seleção em lote).">
      <form onSubmit={handleListar} className="space-y-2">
        <CamposConta conta={conta} setConta={setConta} disabled={loading} />
        <Feedback feedback={feedback} />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Consultando...' : 'Listar reivindicações'}
        </PrimaryButton>
      </form>

      {linhas.length > 0 && (
        <>
          {selecionados.size > 0 && (
            <div className="mt-2 flex items-center justify-between bg-[#111111] border border-[#2a2a2a] rounded-md px-3 py-2">
              <p className="text-xs text-[#a3a3a3]">{selecionados.size} reivindicação(ões) selecionada(s)</p>
              <SecondaryButton type="button" onClick={handleCancelar} disabled={cancelando}>
                {cancelando ? 'Enviando...' : 'Cancelar selecionadas'}
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

      <div className="mt-3 border-t border-[#1a1a1a] pt-4">
        <p className="text-xs font-medium text-[#a3a3a3] mb-2">Consultar reivindicação específica</p>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Field label="Código da reivindicação (UUID)">
              <input className={inputCls} value={codigoConsulta} onChange={(e) => setCodigoConsulta(e.target.value)} disabled={loadingConsulta} />
            </Field>
          </div>
          <SecondaryButton type="button" onClick={handleConsultarDetalhe} disabled={loadingConsulta || !codigoConsulta}>
            {loadingConsulta ? 'Consultando...' : 'Consultar'}
          </SecondaryButton>
        </div>

        {detalheConsulta && (
          <div className="mt-2 text-xs text-[#d4d4d4] bg-[#111111] border border-[#2a2a2a] rounded-md p-2 space-y-1">
            <p><span className="text-[#666666]">Chave:</span> {detalheConsulta?.raw?.chave ?? '—'}</p>
            <p><span className="text-[#666666]">Status:</span> {STATUS_REIVINDICACAO[detalheConsulta?.raw?.statusReivindicacao] ?? detalheConsulta?.raw?.statusReivindicacao ?? '—'}</p>
            <p><span className="text-[#666666]">Prazo resolução:</span> {formatDataHora(detalheConsulta?.raw?.prazoResolucao)}</p>
            <p><span className="text-[#666666]">Prazo conclusão:</span> {formatDataHora(detalheConsulta?.raw?.prazoConclusao)}</p>
            <RawJson data={detalheConsulta?.raw} />
          </div>
        )}
      </div>
    </Card>
  )
}

const MOTIVOS_CONTESTACAO = [
  { value: '1', label: '1 - Golpe/Estelionato' },
  { value: '2', label: '2 - Transação não autorizada' },
  { value: '3', label: '3 - Crime de coerção' },
  { value: '4', label: '4 - Acesso e autorização fraudulenta' },
  { value: '5', label: '5 - Outros' },
  { value: '6', label: '6 - Sem conhecimento' },
]

const SITUACAO_CONTESTACAO = { 0: 'Aberta', 1: 'Em análise', 2: 'Aguardando resposta', 3: 'Aprovada', 4: 'Reprovada', 5: 'Cancelada', 6: 'Concluída' }

// ---------- Listar contestações + Detalhes + Cancelar (em lote) ----------
function ContestacoesCard() {
  const [conta, setConta] = useState(contaVazia)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resposta, setResposta] = useState(null)
  const [linhas, setLinhas] = useState([])
  const [cancelando, setCancelando] = useState(false)
  const [motivoCancelamento, setMotivoCancelamento] = useState('')
  const [codigoConsulta, setCodigoConsulta] = useState('')
  const [loadingConsulta, setLoadingConsulta] = useState(false)
  const [detalheConsulta, setDetalheConsulta] = useState(null)
  const { selecionados, toggle, toggleTodos, limpar } = useSelecao()

  const handleListar = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResposta(null)
    setLinhas([])
    limpar()

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-pix-contestacao-listar', {
        body: montarContaDto(conta),
      })
      const errMsg = extractError(data, error, 'Erro ao listar contestações.')
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

  const handleConsultarDetalhe = async () => {
    if (!codigoConsulta) return
    setLoadingConsulta(true)
    setFeedback(null)
    setDetalheConsulta(null)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-pix-contestacao-detalhes', {
        body: { codigoContestacao: codigoConsulta },
      })
      const errMsg = extractError(data, error, 'Erro ao consultar detalhes da contestação.')
      if (errMsg) setFeedback({ ok: false, message: errMsg })
      else setDetalheConsulta(data)
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoadingConsulta(false)
    }
  }

  const handleCancelar = async () => {
    if (selecionados.size === 0) return
    const confirmado = window.confirm(`Cancelar ${selecionados.size} contestação(ões) selecionada(s)? Só é possível cancelar contestações que não estejam Aprovadas/Reprovadas.`)
    if (!confirmado) return

    setCancelando(true)
    setFeedback(null)
    try {
      const codigos = Array.from(selecionados)
      const contaDto = montarContaDto(conta)
      const resultados = await Promise.all(
        codigos.map((codigo) =>
          supabase.functions.invoke('bmp-pix-contestacao-cancelar', {
            body: {
              codigoContestacao: codigo,
              motivoCancelamento: motivoCancelamento || undefined,
              conta: contaDto,
              idempotencyKey: novaIdempotencyKey(),
            },
          })
        )
      )
      const falhas = resultados.filter(({ data, error }) => extractError(data, error, null))
      if (falhas.length > 0) {
        setFeedback({ ok: false, message: `${falhas.length} de ${codigos.length} cancelamento(s) falharam. Ver detalhes no console.` })
        console.error('[ContestacoesCard] falhas ao cancelar', falhas)
      } else {
        setFeedback({ ok: true, message: `${codigos.length} contestação(ões) cancelada(s) com sucesso.` })
        limpar()
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setCancelando(false)
    }
  }

  const colunas = [
    { key: 'codigo', label: 'Código', render: (i) => i?.codigo ?? '—' },
    { key: 'codigoTicket', label: 'Ticket', render: (i) => i?.codigoTicket ?? '—' },
    { key: 'numPedido', label: 'Nº pedido', render: (i) => i?.numPedido ?? '—' },
    { key: 'nomeRecebedor', label: 'Recebedor', render: (i) => i?.nomeRecebedor ?? '—' },
    { key: 'valor', label: 'Valor', render: (i) => formatMoeda(i?.valor) },
    { key: 'situacao', label: 'Situação', render: (i) => SITUACAO_CONTESTACAO[i?.situacao] ?? i?.situacao ?? '—' },
  ]

  return (
    <Card title="Contestações Pix" description="Liste as contestações da conta, consulte os detalhes de uma contestação específica ou cancele contestações pendentes (seleção em lote).">
      <form onSubmit={handleListar} className="space-y-2">
        <CamposConta conta={conta} setConta={setConta} disabled={loading} />
        <Feedback feedback={feedback} />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Consultando...' : 'Listar contestações'}
        </PrimaryButton>
      </form>

      {linhas.length > 0 && (
        <>
          {selecionados.size > 0 && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 bg-[#111111] border border-[#2a2a2a] rounded-md px-3 py-2">
              <p className="text-xs text-[#a3a3a3]">{selecionados.size} contestação(ões) selecionada(s)</p>
              <div className="flex gap-2 items-center">
                <input
                  className={inputCls + ' w-56'}
                  placeholder="Motivo do cancelamento (opcional)"
                  value={motivoCancelamento}
                  onChange={(e) => setMotivoCancelamento(e.target.value)}
                  disabled={cancelando}
                />
                <SecondaryButton type="button" onClick={handleCancelar} disabled={cancelando}>
                  {cancelando ? 'Enviando...' : 'Cancelar selecionadas'}
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
          />
        </>
      )}

      <RawJson data={resposta?.raw} />

      <div className="mt-3 border-t border-[#1a1a1a] pt-4">
        <p className="text-xs font-medium text-[#a3a3a3] mb-2">Consultar contestação específica</p>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Field label="Código da contestação (UUID)">
              <input className={inputCls} value={codigoConsulta} onChange={(e) => setCodigoConsulta(e.target.value)} disabled={loadingConsulta} />
            </Field>
          </div>
          <SecondaryButton type="button" onClick={handleConsultarDetalhe} disabled={loadingConsulta || !codigoConsulta}>
            {loadingConsulta ? 'Consultando...' : 'Consultar'}
          </SecondaryButton>
        </div>

        {detalheConsulta && (
          <div className="mt-2 text-xs text-[#d4d4d4] bg-[#111111] border border-[#2a2a2a] rounded-md p-2 space-y-1">
            <p><span className="text-[#666666]">Ticket:</span> {detalheConsulta?.raw?.codigoTicket ?? '—'}</p>
            <p><span className="text-[#666666]">Nº pedido:</span> {detalheConsulta?.raw?.numPedido ?? '—'}</p>
            <p><span className="text-[#666666]">Recebedor:</span> {detalheConsulta?.raw?.nomeRecebedor ?? '—'}</p>
            <p><span className="text-[#666666]">Valor:</span> {formatMoeda(detalheConsulta?.raw?.valor)}</p>
            <p><span className="text-[#666666]">Situação:</span> {SITUACAO_CONTESTACAO[detalheConsulta?.raw?.situacao] ?? detalheConsulta?.raw?.situacao ?? '—'}</p>
            <p><span className="text-[#666666]">Prazo resposta:</span> {formatDataHora(detalheConsulta?.raw?.prazoResposta)}</p>
            <p><span className="text-[#666666]">Data inclusão:</span> {formatDataHora(detalheConsulta?.raw?.dtInclusao)}</p>
            <RawJson data={detalheConsulta?.raw} />
          </div>
        )}
      </div>
    </Card>
  )
}

// ---------- Transações aptas a contestação + Solicitar contestação (em lote) ----------
function TransacoesAptasCard() {
  const [conta, setConta] = useState(contaVazia)
  const [tipoOperacaoPix, setTipoOperacaoPix] = useState('')
  const [dtInicial, setDtInicial] = useState('')
  const [dtFinal, setDtFinal] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resposta, setResposta] = useState(null)
  const [linhas, setLinhas] = useState([])
  const [motivoContestacao, setMotivoContestacao] = useState('1')
  const [motivoDescricao, setMotivoDescricao] = useState('')
  const [solicitando, setSolicitando] = useState(false)
  const [modalTransacao, setModalTransacao] = useState(null)
  const { selecionados, toggle, toggleTodos, limpar } = useSelecao()

  const handleConsultar = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResposta(null)
    setLinhas([])
    limpar()

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-pix-contestacao-transacoes-aptas', {
        body: {
          conta: montarContaDto(conta),
          tipoOperacaoPix: tipoOperacaoPix || undefined,
          dtInicial: dtInicial || undefined,
          dtFinal: dtFinal || undefined,
        },
      })
      const errMsg = extractError(data, error, 'Erro ao consultar transações aptas a contestação.')
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

  const codigoTransacaoDaLinha = (item) => item?.codigoTransacao ?? item?.codigo ?? null

  const handleSolicitarContestacao = async () => {
    if (selecionados.size === 0) return
    if (Number(motivoContestacao) === 5 && !motivoDescricao) {
      setFeedback({ ok: false, message: "Informe a descrição do motivo quando o motivo for 'Outros'." })
      return
    }
    const confirmado = window.confirm(`Confirma a solicitação de contestação para ${selecionados.size} transação(ões)?`)
    if (!confirmado) return

    setSolicitando(true)
    setFeedback(null)
    try {
      const codigos = Array.from(selecionados)
      const contaDto = montarContaDto(conta)
      const resultados = await Promise.all(
        codigos.map((codigoTransacao) =>
          supabase.functions.invoke('bmp-pix-contestacao-solicitar', {
            body: {
              codigoTransacao,
              motivoContestacao: Number(motivoContestacao),
              motivoDescricao: motivoDescricao || undefined,
              contaDto,
              idempotencyKey: novaIdempotencyKey(),
            },
          })
        )
      )
      const falhas = resultados.filter(({ data, error }) => extractError(data, error, null))
      if (falhas.length > 0) {
        setFeedback({ ok: false, message: `${falhas.length} de ${codigos.length} contestação(ões) falharam. Ver detalhes no console.` })
        console.error('[TransacoesAptasCard] falhas ao solicitar', falhas)
      } else {
        setFeedback({ ok: true, message: `${codigos.length} contestação(ões) solicitada(s) com sucesso.` })
        limpar()
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setSolicitando(false)
    }
  }

  const abrirDetalhes = async (item) => {
    const codigoTransacao = codigoTransacaoDaLinha(item)
    if (!codigoTransacao) return
    setModalTransacao({ codigoTransacao, loading: true, data: null, feedback: null })
    try {
      const { data, error } = await supabase.functions.invoke('bmp-pix-contestacao-transacoes-aptas-detalhes', {
        body: { codigoTransacao, contaDto: montarContaDto(conta) },
      })
      const errMsg = extractError(data, error, 'Erro ao consultar detalhes da transação.')
      setModalTransacao({ codigoTransacao, loading: false, data, feedback: errMsg ? { ok: false, message: errMsg } : null })
    } catch (err) {
      setModalTransacao({ codigoTransacao, loading: false, data: null, feedback: { ok: false, message: err.message || 'Erro ao conectar.' } })
    }
  }

  const colunas = [
    { key: 'codigoTransacao', label: 'Código transação', render: (i) => codigoTransacaoDaLinha(i) ?? '—' },
    { key: 'nomeRecebedor', label: 'Recebedor/Pagador', render: (i) => i?.nomeRecebedor ?? i?.nome ?? '—' },
    { key: 'valor', label: 'Valor', render: (i) => formatMoeda(i?.valor) },
    { key: 'dtMovimento', label: 'Data', render: (i) => formatDataHora(i?.dtMovimento ?? i?.dtTransacao) },
  ]

  return (
    <Card title="Transações aptas a contestação" description="Consulte as transações Pix elegíveis para contestação, filtre por período/tipo de operação, e solicite a contestação em lote informando o motivo.">
      <form onSubmit={handleConsultar} className="space-y-2">
        <CamposConta conta={conta} setConta={setConta} disabled={loading} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Field label="Tipo de operação">
            <select className={selectCls} value={tipoOperacaoPix} onChange={(e) => setTipoOperacaoPix(e.target.value)} disabled={loading}>
              <option value="">—</option>
              <option value="1">1 - Envio</option>
              <option value="2">2 - Recebimento</option>
            </select>
          </Field>
          <Field label="Data inicial">
            <input type="date" className={inputCls} value={dtInicial} onChange={(e) => setDtInicial(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Data final">
            <input type="date" className={inputCls} value={dtFinal} onChange={(e) => setDtFinal(e.target.value)} disabled={loading} />
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
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 bg-[#111111] border border-[#2a2a2a] rounded-md px-3 py-2">
              <p className="text-xs text-[#a3a3a3]">{selecionados.size} transação(ões) selecionada(s)</p>
              <div className="flex gap-2 items-center flex-wrap">
                <select className={selectCls + ' w-64'} value={motivoContestacao} onChange={(e) => setMotivoContestacao(e.target.value)} disabled={solicitando}>
                  {MOTIVOS_CONTESTACAO.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                {Number(motivoContestacao) === 5 && (
                  <input
                    className={inputCls + ' w-64'}
                    placeholder="Descrição do motivo (obrigatório)"
                    value={motivoDescricao}
                    onChange={(e) => setMotivoDescricao(e.target.value)}
                    disabled={solicitando}
                  />
                )}
                <SecondaryButton type="button" onClick={handleSolicitarContestacao} disabled={solicitando}>
                  {solicitando ? 'Enviando...' : 'Solicitar contestação'}
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
            acoesPorLinha={(item) => (
              <button
                type="button"
                onClick={() => abrirDetalhes(item)}
                className="w-7 h-7 inline-flex items-center justify-center rounded-md text-[#a3a3a3] hover:text-white hover:bg-[#1f1f1f] transition"
                title="Ver detalhes"
              >
                ⋯
              </button>
            )}
          />
        </>
      )}

      <RawJson data={resposta?.raw} />

      {modalTransacao && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8">
          <div className="w-full max-w-2xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-white text-sm font-semibold">Transação — {modalTransacao.codigoTransacao}</h2>
              <button type="button" onClick={() => setModalTransacao(null)} className="text-[#a3a3a3] hover:text-white text-sm">Fechar ✕</button>
            </div>
            <Card>
              <Feedback feedback={modalTransacao.feedback} />
              {modalTransacao.loading && <p className="text-xs text-[#a3a3a3]">Consultando...</p>}
              {!modalTransacao.loading && modalTransacao.data && (
                <RawJson data={modalTransacao.data?.raw} />
              )}
            </Card>
          </div>
        </div>
      )}
    </Card>
  )
}

export default function PixReivindicacaoContestacaoSection() {
  return (
    <div className="space-y-3 w-full">
      <SolicitarReivindicacaoCard />
      <ReivindicacoesCard />
      <ContestacoesCard />
      <TransacoesAptasCard />
    </div>
  )
}
