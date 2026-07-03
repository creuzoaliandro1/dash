import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Field, Feedback, Card, PrimaryButton, SecondaryButton, inputCls, selectCls, textareaCls, extractError } from './shared'

const MOTIVOS = [
  { value: '1', label: '1 - Desinteresse comercial' },
  { value: '2', label: '2 - A pedido do titular' },
  { value: '3', label: '3 - Prevenção a fraude' },
  { value: '4', label: '4 - Solicitado pelo Comitê Compliance' },
  { value: '5', label: '5 - Decisão judicial' },
  { value: '6', label: '6 - Cancelamento de operação' },
  { value: '7', label: '7 - Cobrança de tarifa' },
  { value: '8', label: '8 - Não reconhecimento de conta pagamento' },
  { value: '9', label: '9 - Falta de atendimento' },
  { value: '10', label: '10 - Outros' },
  { value: '11', label: '11 - A pedido do parceiro' },
]

function SolicitarEncerramentoForm() {
  const [agencia, setAgencia] = useState('')
  const [conta, setConta] = useState('')
  const [contaDigito, setContaDigito] = useState('')
  const [motivoEncerramento, setMotivoEncerramento] = useState('1')
  const [complementoEncerramento, setComplementoEncerramento] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resultado, setResultado] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResultado(null)

    if (!agencia || !conta) {
      setFeedback({ ok: false, message: 'Informe agência e conta.' })
      return
    }

    setSubmitting(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-conta-encerramento-solicitar', {
        body: {
          conta: { agencia, conta, contaDigito },
          motivoEncerramento: Number(motivoEncerramento),
          complementoEncerramento,
        },
      })
      const errMsg = extractError(data, error, 'Erro ao solicitar o encerramento.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setFeedback({ ok: true, message: 'Solicitação de encerramento enviada.' })
        setResultado(data)
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card title="Solicitar encerramento" description="Solicita o encerramento de uma conta, informando o motivo.">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <Field label="Agência">
            <input className={inputCls} value={agencia} onChange={(e) => setAgencia(e.target.value)} disabled={submitting} />
          </Field>
          <Field label="Conta">
            <input className={inputCls} value={conta} onChange={(e) => setConta(e.target.value)} disabled={submitting} />
          </Field>
          <Field label="Dígito da conta">
            <input className={inputCls} value={contaDigito} onChange={(e) => setContaDigito(e.target.value)} disabled={submitting} />
          </Field>
        </div>
        <Field label="Motivo do encerramento">
          <select className={selectCls} value={motivoEncerramento} onChange={(e) => setMotivoEncerramento(e.target.value)} disabled={submitting}>
            {MOTIVOS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Complemento">
          <textarea
            className={textareaCls}
            rows={3}
            value={complementoEncerramento}
            onChange={(e) => setComplementoEncerramento(e.target.value)}
            disabled={submitting}
          />
        </Field>

        <Feedback feedback={feedback} />

        {resultado && (
          <div className="p-3 rounded-md text-xs border bg-[#111111] border-[#2a2a2a] text-[#d4d4d4] space-y-1">
            <p><span className="text-[#a3a3a3]">Código:</span> {resultado.codigo ?? '—'}</p>
            <p><span className="text-[#a3a3a3]">Situação:</span> {resultado.situacao ?? '—'}</p>
          </div>
        )}

        <PrimaryButton type="submit" disabled={submitting}>
          {submitting ? 'Solicitando...' : 'Solicitar'}
        </PrimaryButton>
      </form>
    </Card>
  )
}

function ConsultarEncerramentoForm() {
  const [codigoSolicitacao, setCodigoSolicitacao] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resultado, setResultado] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResultado(null)

    if (!codigoSolicitacao) {
      setFeedback({ ok: false, message: 'Informe o código da solicitação.' })
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-conta-encerramento-consultar', {
        body: { codigoSolicitacao },
      })
      const errMsg = extractError(data, error, 'Erro ao consultar o encerramento.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setResultado(data)
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="Consultar encerramento" description="Verifica a situação de uma solicitação de encerramento já enviada.">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Field label="Código da solicitação">
              <input className={inputCls} value={codigoSolicitacao} onChange={(e) => setCodigoSolicitacao(e.target.value)} disabled={loading} />
            </Field>
          </div>
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? 'Consultando...' : 'Consultar'}
          </PrimaryButton>
        </div>

        <Feedback feedback={feedback} />

        {resultado && (
          <div className="p-3 rounded-md text-xs border bg-[#111111] border-[#2a2a2a] text-[#d4d4d4] space-y-1">
            <p><span className="text-[#a3a3a3]">Situação:</span> {resultado.situacao ?? '—'}</p>
            <p><span className="text-[#a3a3a3]">Motivo de rejeição:</span> {resultado.motivoRejeicao ?? '—'}</p>
          </div>
        )}
      </form>
    </Card>
  )
}

function CancelarEncerramentoForm() {
  const [agencia, setAgencia] = useState('')
  const [conta, setConta] = useState('')
  const [contaDigito, setContaDigito] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)

    if (!agencia || !conta) {
      setFeedback({ ok: false, message: 'Informe agência e conta.' })
      return
    }

    if (!window.confirm('Confirma o cancelamento da solicitação de encerramento desta conta?')) {
      return
    }

    setSubmitting(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-conta-encerramento-cancelar', {
        body: { agencia, conta, contaDigito },
      })
      const errMsg = extractError(data, error, 'Erro ao cancelar o encerramento.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setFeedback({ ok: true, message: 'Solicitação de encerramento cancelada com sucesso.' })
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card title="Cancelar encerramento" description="Cancela uma solicitação de encerramento em andamento para a conta informada.">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <Field label="Agência">
            <input className={inputCls} value={agencia} onChange={(e) => setAgencia(e.target.value)} disabled={submitting} />
          </Field>
          <Field label="Conta">
            <input className={inputCls} value={conta} onChange={(e) => setConta(e.target.value)} disabled={submitting} />
          </Field>
          <Field label="Dígito da conta">
            <input className={inputCls} value={contaDigito} onChange={(e) => setContaDigito(e.target.value)} disabled={submitting} />
          </Field>
        </div>

        <Feedback feedback={feedback} />

        <SecondaryButton type="submit" disabled={submitting}>
          {submitting ? 'Cancelando...' : 'Cancelar'}
        </SecondaryButton>
      </form>
    </Card>
  )
}

export default function EncerramentoTab() {
  return (
    <div className="space-y-3 w-full">
      <SolicitarEncerramentoForm />
      <ConsultarEncerramentoForm />
      <CancelarEncerramentoForm />
    </div>
  )
}
