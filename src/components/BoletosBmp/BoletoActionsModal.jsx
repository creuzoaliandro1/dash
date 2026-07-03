import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Field, Feedback, Card, PrimaryButton, DateInput, inputCls, textareaCls, extractError, formatMoeda, formatData, formatDataHora } from './shared'

const novaIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'bmp-' + Date.now() + '-' + Math.random().toString(16).slice(2)
}

const parseLista = (v) =>
  v
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

const codigoDoBoleto = (boleto) => boleto?.codigo ?? boleto?.codigoRegistroBoleto ?? ''
const barrasDoBoleto = (boleto) => boleto?.codigoBarras ?? boleto?.numCodBarras ?? ''

// ---------- Consultar Registro ----------
function ConsultarRegistroAction({ boleto }) {
  const [codigoRegistroBoleto, setCodigoRegistroBoleto] = useState(codigoDoBoleto(boleto))
  const [codigoBarras, setCodigoBarras] = useState(barrasDoBoleto(boleto))
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [registro, setRegistro] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setRegistro(null)

    if (!codigoRegistroBoleto && !codigoBarras) {
      setFeedback({ ok: false, message: 'Informe o código de registro do boleto ou o código de barras.' })
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-boleto-consultar-registro', {
        body: { codigoRegistroBoleto: codigoRegistroBoleto || undefined, codigoBarras: codigoBarras || undefined },
      })
      const errMsg = extractError(data, error, 'Erro ao consultar o registro do boleto.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        const raw = data?.raw || {}
        setRegistro(raw)
        if (!raw || Object.keys(raw).length === 0) {
          setFeedback({ ok: true, message: 'Nenhum registro encontrado.' })
        }
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  const rows = registro
    ? [
        ['Código do registro', registro.codigo],
        ['Situação do boleto', registro.situacaoBoleto],
        ['Mensagem da situação', registro.msgSituacao],
        ['Data da situação', formatData(registro.dtSituacao)],
        ['Número do cedente', registro.numeroCedente],
        ['Carteira', registro.codCartTit],
        ['Data de inclusão', formatData(registro.dtInclusao)],
        ['Data de emissão', formatData(registro.dtEmsTit)],
        ['Data de vencimento', formatData(registro.dtVencTit)],
        ['Data limite p/ pagamento', formatData(registro.dtLimPgtoTit)],
        ['Valor do título', formatMoeda(registro.vlrTit)],
        ['Valor de abatimento', formatMoeda(registro.vlrAbattTit)],
        ['Número do documento', registro.numDocTit ?? registro.numeroDocumento],
        ['Nosso número', registro.identdNossoNum],
        ['Código de barras', registro.numCodBarras],
        ['Linha digitável', registro.numLinhaDigtvl],
      ]
    : []

  return (
    <Card title="Consultar registro" description="Situação atual do boleto no BMP.">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Field label="Código de registro do boleto">
            <input className={inputCls} value={codigoRegistroBoleto} onChange={(e) => setCodigoRegistroBoleto(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Código de barras">
            <input className={inputCls} value={codigoBarras} onChange={(e) => setCodigoBarras(e.target.value)} disabled={loading} />
          </Field>
        </div>
        <Feedback feedback={feedback} />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Consultando...' : 'Consultar'}
        </PrimaryButton>
      </form>

      {registro && rows.length > 0 && (
        <div className="mt-2 border border-[#2a2a2a] rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <tbody>
              {rows.map(([label, value], i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-[#0a0a0a]' : 'bg-[#111111]'}>
                  <td className="px-3 py-2 text-[#a3a3a3] w-1/3">{label}</td>
                  <td className="px-3 py-2 text-white break-all">{value === null || value === undefined || value === '' ? '—' : String(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ---------- Cancelar ----------
function CancelarAction({ boleto }) {
  const [listaCodigos, setListaCodigos] = useState(codigoDoBoleto(boleto))
  const [listaCodigosBarras, setListaCodigosBarras] = useState(barrasDoBoleto(boleto))
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resultado, setResultado] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResultado(null)

    const codigos = parseLista(listaCodigos)
    const codigosBarras = parseLista(listaCodigosBarras)

    if (codigos.length === 0 && codigosBarras.length === 0) {
      setFeedback({ ok: false, message: 'Informe ao menos um código de registro ou código de barras.' })
      return
    }

    const confirmado = window.confirm('Tem certeza que deseja cancelar o(s) registro(s) informado(s)? Essa ação não pode ser desfeita.')
    if (!confirmado) return

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-boleto-cancelar', {
        body: {
          listaCodigos: codigos.length ? codigos : undefined,
          listaCodigosBarras: codigosBarras.length ? codigosBarras : undefined,
          idempotencyKey: novaIdempotencyKey(),
        },
      })
      const errMsg = extractError(data, error, 'Erro ao cancelar o registro do boleto.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setResultado(data)
        setFeedback({ ok: true, message: data?.mensagem || 'Solicitação de cancelamento enviada.' })
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  const itens = Array.isArray(resultado?.listaCodigosCancelamento) ? resultado.listaCodigosCancelamento : []

  return (
    <Card title="Cancelar registro" description="Ação destrutiva — pede confirmação antes de enviar.">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Field label="Código(s) de registro do boleto">
            <textarea className={textareaCls} rows={3} value={listaCodigos} onChange={(e) => setListaCodigos(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Código(s) de barras">
            <textarea className={textareaCls} rows={3} value={listaCodigosBarras} onChange={(e) => setListaCodigosBarras(e.target.value)} disabled={loading} />
          </Field>
        </div>
        <Feedback feedback={feedback} />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Cancelando...' : 'Cancelar Registro'}
        </PrimaryButton>
      </form>

      {itens.length > 0 && (
        <div className="mt-2 overflow-x-auto border border-[#2a2a2a] rounded-md">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#141414] text-[#666666] uppercase tracking-wider">
                <th className="text-left px-3 py-2">Código de registro</th>
                <th className="text-left px-3 py-2">Código de cancelamento</th>
                <th className="text-left px-3 py-2">Situação</th>
                <th className="text-left px-3 py-2">Sucesso</th>
                <th className="text-left px-3 py-2">Mensagem</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item, i) => (
                <tr key={i} className="border-t border-[#1a1a1a] text-[#d4d4d4]">
                  <td className="px-3 py-2">{item.codigoRegistroBoleto ?? '—'}</td>
                  <td className="px-3 py-2">{item.codigoCancelamento ?? '—'}</td>
                  <td className="px-3 py-2">{item.situacaoBoleto ?? '—'}</td>
                  <td className="px-3 py-2">{item.sucesso === false ? 'Não' : 'Sim'}</td>
                  <td className="px-3 py-2">{item.mensagem ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ---------- Consultar Cancelamento ----------
function ConsultarCancelamentoAction({ boleto }) {
  const [listaCodigos, setListaCodigos] = useState(codigoDoBoleto(boleto))
  const [listaCodigosBarras, setListaCodigosBarras] = useState(barrasDoBoleto(boleto))
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [cancelamentos, setCancelamentos] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setCancelamentos(null)

    const codigos = parseLista(listaCodigos)
    const codigosBarras = parseLista(listaCodigosBarras)

    if (codigos.length === 0 && codigosBarras.length === 0) {
      setFeedback({ ok: false, message: 'Informe ao menos um código ou código de barras.' })
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-boleto-consultar-cancelamento', {
        body: {
          listaCodigos: codigos.length ? codigos : undefined,
          listaCodigosBarras: codigosBarras.length ? codigosBarras : undefined,
        },
      })
      const errMsg = extractError(data, error, 'Erro ao consultar o cancelamento do boleto.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        const lista = Array.isArray(data?.cancelamentos) ? data.cancelamentos : []
        setCancelamentos(lista)
        if (lista.length === 0) {
          setFeedback({ ok: true, message: data?.mensagem || 'Nenhum cancelamento encontrado.' })
        }
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="Consultar cancelamento" description="Consulta a situação de um cancelamento já solicitado.">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Field label="Código(s) de registro/cancelamento">
            <textarea className={textareaCls} rows={3} value={listaCodigos} onChange={(e) => setListaCodigos(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Código(s) de barras">
            <textarea className={textareaCls} rows={3} value={listaCodigosBarras} onChange={(e) => setListaCodigosBarras(e.target.value)} disabled={loading} />
          </Field>
        </div>
        <Feedback feedback={feedback} />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Consultando...' : 'Consultar'}
        </PrimaryButton>
      </form>

      {cancelamentos && cancelamentos.length > 0 && (
        <div className="mt-2 overflow-x-auto border border-[#2a2a2a] rounded-md">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#141414] text-[#666666] uppercase tracking-wider">
                <th className="text-left px-3 py-2">Código de cancelamento</th>
                <th className="text-left px-3 py-2">Situação</th>
                <th className="text-left px-3 py-2">Código de barras</th>
              </tr>
            </thead>
            <tbody>
              {cancelamentos.map((item, i) => (
                <tr key={i} className="border-t border-[#1a1a1a] text-[#d4d4d4]">
                  <td className="px-3 py-2">{item.codigoCancelamento ?? '—'}</td>
                  <td className="px-3 py-2">{item.situacao ?? '—'}</td>
                  <td className="px-3 py-2 break-all">{item.numCodBarras ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ---------- Atualizar ----------
const TIPO_JUROS_OPTIONS = [
  { value: '', label: '—' },
  { value: '1', label: 'Isento (1)' },
  { value: '2', label: 'Valor por dia (2)' },
  { value: '3', label: 'Taxa mensal (3)' },
]

const TIPO_MULTA_OPTIONS = [
  { value: '', label: '—' },
  { value: '1', label: 'Isento (1)' },
  { value: '2', label: 'Valor fixo (2)' },
  { value: '3', label: 'Percentual (3)' },
]

function AtualizarAction({ boleto }) {
  const [form, setForm] = useState({
    codigoRegistroBoleto: codigoDoBoleto(boleto),
    codigoBarras: barrasDoBoleto(boleto),
    dtVencimento: '',
    vlrTit: '',
    dtLimPgto: '',
    vlrAbatimento: '',
    numDocTit: '',
    numeroDocumento: '',
    tipoJuros: '',
    vlrJuros: '',
    tipoMulta: '',
    vlrMulta: '',
    tipoDesconto: '',
    vlrDesconto: '',
    dtLimiteDesconto: '',
    identificadorCliente: '',
    instrucoesBeneficiario: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resultado, setResultado] = useState(null)

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResultado(null)

    if (!form.codigoRegistroBoleto && !form.codigoBarras) {
      setFeedback({ ok: false, message: 'Informe o código de registro do boleto ou o código de barras.' })
      return
    }

    setSubmitting(true)
    try {
      const dadosBoleto = {}
      if (form.dtVencimento) dadosBoleto.dtVencimento = form.dtVencimento
      if (form.vlrTit) dadosBoleto.vlrTit = Number(form.vlrTit)
      if (form.dtLimPgto) dadosBoleto.dtLimPgto = form.dtLimPgto
      if (form.vlrAbatimento) dadosBoleto.vlrAbatimento = Number(form.vlrAbatimento)
      if (form.numDocTit) dadosBoleto.numDocTit = form.numDocTit
      if (form.numeroDocumento) dadosBoleto.numeroDocumento = form.numeroDocumento

      const juros = form.tipoJuros
        ? { tipoJuros: Number(form.tipoJuros), vlrJuros: form.vlrJuros ? Number(form.vlrJuros) : undefined }
        : undefined
      const multa = form.tipoMulta
        ? { tipoMulta: Number(form.tipoMulta), vlrMulta: form.vlrMulta ? Number(form.vlrMulta) : undefined }
        : undefined
      const desconto = form.tipoDesconto
        ? {
            tipoDesconto: Number(form.tipoDesconto),
            vlrDesconto: form.vlrDesconto ? Number(form.vlrDesconto) : undefined,
            dtLimiteDesconto: form.dtLimiteDesconto || undefined,
          }
        : undefined

      const body = {
        codigoRegistroBoleto: form.codigoRegistroBoleto || undefined,
        codigoBarras: form.codigoBarras || undefined,
        dadosBoleto: Object.keys(dadosBoleto).length > 0 ? dadosBoleto : undefined,
        juros,
        multa,
        desconto,
        identificadorCliente: form.identificadorCliente || undefined,
        instrucoesBeneficiario: form.instrucoesBeneficiario || undefined,
      }

      const { data, error } = await supabase.functions.invoke('bmp-boleto-atualizar', { body })
      const errMsg = extractError(data, error, 'Erro ao atualizar o boleto.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setFeedback({ ok: true, message: data?.mensagem || 'Boleto atualizado com sucesso.' })
        setResultado(data)
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card title="Atualizar boleto" description="Preencha apenas os campos que deseja alterar.">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Field label="Código de registro do boleto">
            <input className={inputCls} value={form.codigoRegistroBoleto} onChange={set('codigoRegistroBoleto')} disabled={submitting} />
          </Field>
          <Field label="Código de barras">
            <input className={inputCls} value={form.codigoBarras} onChange={set('codigoBarras')} disabled={submitting} />
          </Field>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-[#a3a3a3] uppercase mb-2">Dados do título</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <Field label="Novo vencimento">
              <DateInput value={form.dtVencimento} onChange={set('dtVencimento')} disabled={submitting} />
            </Field>
            <Field label="Novo valor do título">
              <input type="number" step="0.01" className={inputCls} value={form.vlrTit} onChange={set('vlrTit')} disabled={submitting} />
            </Field>
            <Field label="Data limite de pagamento">
              <DateInput value={form.dtLimPgto} onChange={set('dtLimPgto')} disabled={submitting} />
            </Field>
            <Field label="Valor de abatimento">
              <input type="number" step="0.01" className={inputCls} value={form.vlrAbatimento} onChange={set('vlrAbatimento')} disabled={submitting} />
            </Field>
            <Field label="Número do documento (numDocTit)">
              <input className={inputCls} value={form.numDocTit} onChange={set('numDocTit')} disabled={submitting} />
            </Field>
            <Field label="Número do documento">
              <input className={inputCls} value={form.numeroDocumento} onChange={set('numeroDocumento')} disabled={submitting} />
            </Field>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-[#a3a3a3] uppercase mb-2">Juros</h3>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tipo de juros">
              <select className={inputCls} value={form.tipoJuros} onChange={set('tipoJuros')} disabled={submitting}>
                {TIPO_JUROS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Valor/percentual de juros">
              <input type="number" step="0.01" className={inputCls} value={form.vlrJuros} onChange={set('vlrJuros')} disabled={submitting} />
            </Field>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-[#a3a3a3] uppercase mb-2">Multa</h3>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tipo de multa">
              <select className={inputCls} value={form.tipoMulta} onChange={set('tipoMulta')} disabled={submitting}>
                {TIPO_MULTA_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Valor/percentual de multa">
              <input type="number" step="0.01" className={inputCls} value={form.vlrMulta} onChange={set('vlrMulta')} disabled={submitting} />
            </Field>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-[#a3a3a3] uppercase mb-2">Desconto</h3>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Tipo de desconto">
              <input className={inputCls} value={form.tipoDesconto} onChange={set('tipoDesconto')} disabled={submitting} placeholder="1, 2, 3..." />
            </Field>
            <Field label="Valor/percentual de desconto">
              <input type="number" step="0.01" className={inputCls} value={form.vlrDesconto} onChange={set('vlrDesconto')} disabled={submitting} />
            </Field>
            <Field label="Data limite do desconto">
              <DateInput value={form.dtLimiteDesconto} onChange={set('dtLimiteDesconto')} disabled={submitting} />
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <Field label="Identificador do cliente">
            <input className={inputCls} value={form.identificadorCliente} onChange={set('identificadorCliente')} disabled={submitting} />
          </Field>
          <Field label="Instruções ao beneficiário">
            <textarea rows={3} className={textareaCls} value={form.instrucoesBeneficiario} onChange={set('instrucoesBeneficiario')} disabled={submitting} />
          </Field>
        </div>

        <Feedback feedback={feedback} />

        <PrimaryButton type="submit" disabled={submitting}>
          {submitting ? 'Atualizando...' : 'Atualizar boleto'}
        </PrimaryButton>
      </form>

      {resultado && (
        <pre className="mt-2 p-3 bg-[#111111] border border-[#2a2a2a] rounded-md text-[#d4d4d4] text-xs overflow-auto max-h-[420px]">
          {JSON.stringify(resultado, null, 2)}
        </pre>
      )}
    </Card>
  )
}

// ---------- Alteracoes (consultar + ultima) ----------
function AlteracoesAction({ boleto }) {
  const [codigoRegistroBoleto, setCodigoRegistroBoleto] = useState(codigoDoBoleto(boleto))
  const [codigoBarras, setCodigoBarras] = useState(barrasDoBoleto(boleto))
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [alteracoes, setAlteracoes] = useState(null)
  const [ultima, setUltima] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setAlteracoes(null)
    setUltima(null)

    if (!codigoRegistroBoleto && !codigoBarras) {
      setFeedback({ ok: false, message: 'Informe o código de registro do boleto ou o código de barras.' })
      return
    }

    setLoading(true)
    try {
      const [respLista, respUltima] = await Promise.all([
        supabase.functions.invoke('bmp-boleto-consultar-alteracoes', { body: { codigoRegistroBoleto, codigoBarras } }),
        supabase.functions.invoke('bmp-boleto-consultar-ultima-alteracao', { body: { codigoRegistroBoleto, codigoBarras } }),
      ])

      const errLista = extractError(respLista.data, respLista.error, 'Erro ao consultar alterações do boleto.')
      if (errLista) {
        setFeedback({ ok: false, message: errLista })
      } else {
        const lista = Array.isArray(respLista.data?.alteracoes) ? respLista.data.alteracoes : []
        setAlteracoes(lista)

        const listaUltima = Array.isArray(respUltima.data?.alteracoes) ? respUltima.data.alteracoes : []
        setUltima(listaUltima[0] ?? null)

        if (lista.length === 0) {
          setFeedback({ ok: true, message: 'Nenhuma alteração encontrada para este boleto.' })
        }
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="Alterações do boleto" description="Histórico completo e última alteração registrada.">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Field label="Código de registro do boleto">
            <input className={inputCls} value={codigoRegistroBoleto} onChange={(e) => setCodigoRegistroBoleto(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Código de barras">
            <input className={inputCls} value={codigoBarras} onChange={(e) => setCodigoBarras(e.target.value)} disabled={loading} />
          </Field>
        </div>
        <Feedback feedback={feedback} />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Consultando...' : 'Consultar'}
        </PrimaryButton>
      </form>

      {ultima && (
        <div className="mt-2">
          <p className="text-xs text-[#a3a3a3] mb-2">Última alteração</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            <div className="p-3 bg-[#111111] border border-[#2a2a2a] rounded-md">
              <div className="text-[#a3a3a3] mb-1">Situação</div>
              <div className="text-white">{ultima?.situacao ?? '—'}</div>
            </div>
            <div className="p-3 bg-[#111111] border border-[#2a2a2a] rounded-md">
              <div className="text-[#a3a3a3] mb-1">Vencimento</div>
              <div className="text-white">{formatData(ultima?.dtVencTit)}</div>
            </div>
            <div className="p-3 bg-[#111111] border border-[#2a2a2a] rounded-md">
              <div className="text-[#a3a3a3] mb-1">Valor do título</div>
              <div className="text-white">{formatMoeda(ultima?.vlrTit)}</div>
            </div>
            <div className="p-3 bg-[#111111] border border-[#2a2a2a] rounded-md">
              <div className="text-[#a3a3a3] mb-1">Data do movimento</div>
              <div className="text-white">{formatDataHora(ultima?.dtMovto)}</div>
            </div>
            <div className="p-3 bg-[#111111] border border-[#2a2a2a] rounded-md col-span-2">
              <div className="text-[#a3a3a3] mb-1">Mensagem</div>
              <div className="text-white">{ultima?.msgSituacao ?? '—'}</div>
            </div>
          </div>
        </div>
      )}

      {alteracoes && alteracoes.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-[#a3a3a3] mb-2">Histórico completo</p>
          <div className="overflow-auto max-h-[320px] border border-[#2a2a2a] rounded-md">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#2a2a2a] text-[#a3a3a3] text-left">
                  <th className="py-2 px-3">Código</th>
                  <th className="py-2 px-3">Situação</th>
                  <th className="py-2 px-3">Vencimento</th>
                  <th className="py-2 px-3">Valor</th>
                  <th className="py-2 px-3">Data movimento</th>
                </tr>
              </thead>
              <tbody>
                {alteracoes.map((item, idx) => (
                  <tr key={item?.codigo ?? idx} className="border-b border-[#1a1a1a] text-[#d4d4d4]">
                    <td className="py-2 px-3">{item?.codigo ?? '—'}</td>
                    <td className="py-2 px-3">{item?.situacao ?? '—'}</td>
                    <td className="py-2 px-3">{formatData(item?.dtVencTit)}</td>
                    <td className="py-2 px-3">{formatMoeda(item?.vlrTit)}</td>
                    <td className="py-2 px-3">{formatDataHora(item?.dtMovto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  )
}

// ---------- Imprimir ----------
function ImprimirAction({ boleto }) {
  const [codigoRegistroBoleto, setCodigoRegistroBoleto] = useState(codigoDoBoleto(boleto))
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [downloadUrl, setDownloadUrl] = useState(null)
  const [downloadContentType, setDownloadContentType] = useState(null)
  const [jsonConteudo, setJsonConteudo] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setDownloadUrl(null)
    setDownloadContentType(null)
    setJsonConteudo(null)

    if (!codigoRegistroBoleto) {
      setFeedback({ ok: false, message: 'Informe o código de registro do boleto.' })
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-boleto-imprimir', { body: { codigoRegistroBoleto } })
      const errMsg = extractError(data, error, 'Erro ao imprimir o boleto.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
        return
      }

      const contentType = data?.contentType || ''
      const conteudo = data?.conteudo
      const isPdfOrBinary =
        contentType.toLowerCase().includes('pdf') || (typeof conteudo === 'string' && !contentType.toLowerCase().includes('json'))

      if (isPdfOrBinary && typeof conteudo === 'string') {
        const mime = contentType || 'application/pdf'
        setDownloadUrl(`data:${mime};base64,${conteudo}`)
        setDownloadContentType(mime)
        setFeedback({ ok: true, message: 'Boleto gerado com sucesso.' })
      } else if (conteudo && typeof conteudo === 'object') {
        setJsonConteudo(conteudo)
        setFeedback({ ok: true, message: 'Boleto consultado com sucesso.' })
      } else {
        setFeedback({ ok: false, message: 'Resposta inesperada ao imprimir o boleto.' })
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  const isPdf = downloadContentType?.toLowerCase().includes('pdf')
  const fileExt = isPdf ? 'pdf' : 'bin'

  return (
    <Card title="Imprimir boleto" description="Gera a impressão (PDF) do boleto a partir do código de registro.">
      <form onSubmit={handleSubmit} className="space-y-2">
        <Field label="Código de registro do boleto">
          <input className={inputCls} value={codigoRegistroBoleto} onChange={(e) => setCodigoRegistroBoleto(e.target.value)} disabled={loading} />
        </Field>
        <Feedback feedback={feedback} />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Gerando...' : 'Imprimir boleto'}
        </PrimaryButton>
      </form>

      {downloadUrl && (
        <div className="mt-2">
          <a
            href={downloadUrl}
            download={`boleto-${codigoRegistroBoleto}.${fileExt}`}
            className="inline-block px-3 py-2 bg-white text-black font-medium rounded-md hover:opacity-90 transition text-sm"
          >
            Abrir/baixar boleto
          </a>
        </div>
      )}

      {jsonConteudo && (
        <pre className="mt-2 p-3 bg-[#111111] border border-[#2a2a2a] rounded-md text-[#d4d4d4] text-xs overflow-auto max-h-[420px]">
          {JSON.stringify(jsonConteudo, null, 2)}
        </pre>
      )}
    </Card>
  )
}

// ---------- Menu (3 pontinhos) e Modal ----------
const ACTION_LABELS = {
  'consultar-registro': 'Consultar Registro',
  cancelar: 'Cancelar',
  'consultar-cancelamento': 'Consultar Cancelamento',
  atualizar: 'Atualizar',
  alteracoes: 'Alterações',
  imprimir: 'Imprimir',
}

const ROW_ACTIONS = Object.entries(ACTION_LABELS).map(([id, label]) => ({ id, label }))

export function BoletoActionsMenu({ boleto, onSelect }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-7 h-7 flex items-center justify-center rounded-md text-[#a3a3a3] hover:text-white hover:bg-[#1f1f1f] transition"
        title="Ações"
      >
        ⋯
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-52 bg-[#141414] border border-[#2a2a2a] rounded-md shadow-lg py-1">
            {ROW_ACTIONS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setOpen(false)
                  onSelect(a.id)
                }}
                className="w-full text-left px-3 py-2 text-xs text-[#d4d4d4] hover:bg-[#1f1f1f] hover:text-white transition"
              >
                {a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function BoletoActionModal({ action, boleto, onClose }) {
  if (!action) return null
  const label = ACTION_LABELS[action] ?? action

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-white text-sm font-semibold">{label}</h2>
          <button type="button" onClick={onClose} className="text-[#a3a3a3] hover:text-white text-sm">
            Fechar ✕
          </button>
        </div>
        {action === 'consultar-registro' && <ConsultarRegistroAction boleto={boleto} />}
        {action === 'cancelar' && <CancelarAction boleto={boleto} />}
        {action === 'consultar-cancelamento' && <ConsultarCancelamentoAction boleto={boleto} />}
        {action === 'atualizar' && <AtualizarAction boleto={boleto} />}
        {action === 'alteracoes' && <AlteracoesAction boleto={boleto} />}
        {action === 'imprimir' && <ImprimirAction boleto={boleto} />}
      </div>
    </div>
  )
}
