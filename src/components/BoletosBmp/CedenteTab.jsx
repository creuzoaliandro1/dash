import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Field, Feedback, Card, PrimaryButton, inputCls, selectCls, extractError, formatMoeda } from './shared'

const TIPO_CONTA_OPTIONS = [
  { value: '3', label: 'Corrente (3)' },
  { value: '2', label: 'Poupança (2)' },
  { value: '-1', label: 'Pagamento (-1)' },
  { value: '4', label: 'Salário (4)' },
]

function ConsultarCedenteCard() {
  const [form, setForm] = useState({
    agencia: '',
    agenciaDigito: '',
    conta: '',
    contaDigito: '',
    contaPgto: '',
    tipoConta: '3',
    modeloConta: '',
  })
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resultado, setResultado] = useState(null)

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResultado(null)

    if (!form.agencia || !form.conta) {
      setFeedback({ ok: false, message: 'Informe ao menos a agência e a conta.' })
      return
    }

    setLoading(true)
    try {
      const body = {
        agencia: form.agencia || undefined,
        agenciaDigito: form.agenciaDigito || undefined,
        conta: form.conta || undefined,
        contaDigito: form.contaDigito || undefined,
        contaPgto: form.contaPgto || undefined,
        tipoConta: form.tipoConta ? Number(form.tipoConta) : undefined,
        modeloConta: form.modeloConta || undefined,
      }
      const { data, error } = await supabase.functions.invoke('bmp-cedente-consultar', { body })
      const errMsg = extractError(data, error, 'Erro ao consultar o cedente.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setResultado(data)
        setFeedback({ ok: true, message: data?.mensagem || 'Cedente consultado com sucesso.' })
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  const carteiras = Array.isArray(resultado?.carteiras) ? resultado.carteiras : []

  return (
    <Card title="Consultar cedente" description="Consulta os dados do cedente vinculado a uma conta e as carteiras associadas.">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Field label="Agência">
            <input className={inputCls} value={form.agencia} onChange={set('agencia')} disabled={loading} />
          </Field>
          <Field label="Dígito da agência">
            <input className={inputCls} value={form.agenciaDigito} onChange={set('agenciaDigito')} disabled={loading} />
          </Field>
          <Field label="Conta">
            <input className={inputCls} value={form.conta} onChange={set('conta')} disabled={loading} />
          </Field>
          <Field label="Dígito da conta">
            <input className={inputCls} value={form.contaDigito} onChange={set('contaDigito')} disabled={loading} />
          </Field>
          <Field label="Conta de pagamento">
            <input className={inputCls} value={form.contaPgto} onChange={set('contaPgto')} disabled={loading} />
          </Field>
          <Field label="Tipo de conta">
            <select className={selectCls} value={form.tipoConta} onChange={set('tipoConta')} disabled={loading}>
              {TIPO_CONTA_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Modelo de conta">
            <input className={inputCls} value={form.modeloConta} onChange={set('modeloConta')} disabled={loading} />
          </Field>
        </div>

        <Feedback feedback={feedback} />

        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Consultando...' : 'Consultar cedente'}
        </PrimaryButton>
      </form>

      {resultado && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 bg-[#111111] border border-[#2a2a2a] rounded-md">
              <div className="text-[#a3a3a3] mb-1">Código do cedente</div>
              <div className="text-white">{resultado?.codigo ?? '—'}</div>
            </div>
            <div className="p-3 bg-[#111111] border border-[#2a2a2a] rounded-md">
              <div className="text-[#a3a3a3] mb-1">Número do cedente</div>
              <div className="text-white">{resultado?.numero ?? '—'}</div>
            </div>
          </div>

          {carteiras.length > 0 && (
            <div className="overflow-auto max-h-[360px]">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#2a2a2a] text-[#a3a3a3] text-left">
                    <th className="py-2 pr-3">Número</th>
                    <th className="py-2 pr-3">Descrição</th>
                    <th className="py-2 pr-3">Tipo juros</th>
                    <th className="py-2 pr-3">Tipo multa</th>
                    <th className="py-2 pr-3">Espécie</th>
                    <th className="py-2 pr-3">CNAB habilitado</th>
                  </tr>
                </thead>
                <tbody>
                  {carteiras.map((c, idx) => (
                    <tr key={c?.codigo ?? idx} className="border-b border-[#1a1a1a] text-[#d4d4d4]">
                      <td className="py-2 pr-3">{c?.numero ?? '—'}</td>
                      <td className="py-2 pr-3">{c?.descricao ?? '—'}</td>
                      <td className="py-2 pr-3">{c?.tipoJuros ?? '—'}</td>
                      <td className="py-2 pr-3">{c?.tipoMulta ?? '—'}</td>
                      <td className="py-2 pr-3">{c?.especie ?? '—'}</td>
                      <td className="py-2 pr-3">{c?.cnabHabilitado ? 'Sim' : 'Não'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function IncluirCedenteCard() {
  const [conta, setConta] = useState('')
  const [codCartTit, setCodCartTit] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [numero, setNumero] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setNumero(null)

    if (!conta) {
      setFeedback({ ok: false, message: 'Informe a conta.' })
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-cedente-incluir', {
        body: { conta, codCartTit: codCartTit || undefined },
      })
      const errMsg = extractError(data, error, 'Erro ao incluir o cedente.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setFeedback({ ok: true, message: data?.mensagem || 'Cedente incluído com sucesso.' })
        setNumero(data?.numero ?? null)
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="Incluir cedente" description="Cadastra um novo cedente vinculado a uma conta do BMP.">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Conta">
            <input className={inputCls} value={conta} onChange={(e) => setConta(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Código da carteira do título (codCartTit)">
            <input className={inputCls} value={codCartTit} onChange={(e) => setCodCartTit(e.target.value)} disabled={loading} />
          </Field>
        </div>

        <Feedback feedback={feedback} />

        {numero && (
          <div className="p-3 rounded-md text-xs border bg-[#111111] border-[#2a2a2a] text-[#d4d4d4]">
            Número do cedente gerado: <span className="text-white">{numero}</span>
          </div>
        )}

        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Incluindo...' : 'Incluir cedente'}
        </PrimaryButton>
      </form>
    </Card>
  )
}

function VincularCarteiraCard() {
  const [form, setForm] = useState({
    numeroCedente: '',
    conta: '',
    codigoCarteira: '',
    numero: '',
    descricao: '',
    tipoJuros: '',
    vlrJuros: '',
    tipoMulta: '',
    vlrMulta: '',
    diasLimitePagamento: '',
    especie: '',
  })
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resultado, setResultado] = useState(null)

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResultado(null)

    if (!form.numeroCedente) {
      setFeedback({ ok: false, message: 'Informe o número do cedente.' })
      return
    }

    setLoading(true)
    try {
      const carteira = {
        codigoCarteira: form.codigoCarteira || undefined,
        numero: form.numero || undefined,
        descricao: form.descricao || undefined,
        tipoJuros: form.tipoJuros || undefined,
        vlrJuros: form.vlrJuros ? Number(form.vlrJuros) : undefined,
        tipoMulta: form.tipoMulta || undefined,
        vlrMulta: form.vlrMulta ? Number(form.vlrMulta) : undefined,
        diasLimitePagamento: form.diasLimitePagamento ? Number(form.diasLimitePagamento) : undefined,
        especie: form.especie || undefined,
      }

      const body = {
        numeroCedente: form.numeroCedente,
        conta: form.conta || undefined,
        carteira,
      }

      const { data, error } = await supabase.functions.invoke('bmp-cedente-vincular-carteira', { body })
      const errMsg = extractError(data, error, 'Erro ao vincular a carteira ao cedente.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setFeedback({ ok: true, message: data?.mensagem || 'Carteira vinculada com sucesso.' })
        setResultado(data)
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="Vincular carteira" description="Vincula uma carteira de cobrança a um cedente já cadastrado.">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Número do cedente">
            <input className={inputCls} value={form.numeroCedente} onChange={set('numeroCedente')} disabled={loading} />
          </Field>
          <Field label="Conta">
            <input className={inputCls} value={form.conta} onChange={set('conta')} disabled={loading} />
          </Field>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <Field label="Código da carteira">
            <input className={inputCls} value={form.codigoCarteira} onChange={set('codigoCarteira')} disabled={loading} />
          </Field>
          <Field label="Número da carteira">
            <input className={inputCls} value={form.numero} onChange={set('numero')} disabled={loading} />
          </Field>
          <Field label="Descrição">
            <input className={inputCls} value={form.descricao} onChange={set('descricao')} disabled={loading} />
          </Field>
          <Field label="Tipo de juros">
            <input className={inputCls} value={form.tipoJuros} onChange={set('tipoJuros')} disabled={loading} />
          </Field>
          <Field label="Valor de juros">
            <input type="number" step="0.01" className={inputCls} value={form.vlrJuros} onChange={set('vlrJuros')} disabled={loading} />
          </Field>
          <Field label="Tipo de multa">
            <input className={inputCls} value={form.tipoMulta} onChange={set('tipoMulta')} disabled={loading} />
          </Field>
          <Field label="Valor de multa">
            <input type="number" step="0.01" className={inputCls} value={form.vlrMulta} onChange={set('vlrMulta')} disabled={loading} />
          </Field>
          <Field label="Dias limite de pagamento">
            <input type="number" className={inputCls} value={form.diasLimitePagamento} onChange={set('diasLimitePagamento')} disabled={loading} />
          </Field>
          <Field label="Espécie">
            <input className={inputCls} value={form.especie} onChange={set('especie')} disabled={loading} />
          </Field>
        </div>

        <Feedback feedback={feedback} />

        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Vinculando...' : 'Vincular carteira'}
        </PrimaryButton>
      </form>

      {resultado && (
        <div className="mt-2 p-3 rounded-md text-xs border bg-[#111111] border-[#2a2a2a] text-[#d4d4d4]">
          Código da empresa CNAB: <span className="text-white">{resultado?.codigoEmpresaCNAB ?? '—'}</span>
        </div>
      )}
    </Card>
  )
}

export default function CedenteTab() {
  return (
    <div className="space-y-2 w-full">
      <ConsultarCedenteCard />
      <IncluirCedenteCard />
      <VincularCarteiraCard />
    </div>
  )
}
