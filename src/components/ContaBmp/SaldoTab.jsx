import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Field, Feedback, Card, PrimaryButton, inputCls, extractError, formatMoeda, formatDataHora } from './shared'

export default function SaldoTab() {
  const [agencia, setAgencia] = useState('')
  const [conta, setConta] = useState('')
  const [contaDigito, setContaDigito] = useState('')
  const [contaPgto, setContaPgto] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [saldo, setSaldo] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setSaldo(null)

    if (!contaPgto && (!agencia || !conta)) {
      setFeedback({ ok: false, message: 'Informe agência + conta, ou a contaPgto diretamente.' })
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-conta-saldo', {
        body: { agencia, conta, contaDigito, contaPgto },
      })
      const errMsg = extractError(data, error, 'Erro ao consultar o saldo.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setSaldo(data)
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      <Card title="Consultar saldo" description="Informe agência + conta (com dígito), ou diretamente a contaPgto.">
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Field label="Agência">
              <input className={inputCls} value={agencia} onChange={(e) => setAgencia(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Conta">
              <input className={inputCls} value={conta} onChange={(e) => setConta(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Dígito da conta">
              <input className={inputCls} value={contaDigito} onChange={(e) => setContaDigito(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Conta pagamento">
              <input className={inputCls} value={contaPgto} onChange={(e) => setContaPgto(e.target.value)} disabled={loading} />
            </Field>
          </div>

          <Feedback feedback={feedback} />

          <PrimaryButton type="submit" disabled={loading}>
            {loading ? 'Consultando...' : 'Consultar'}
          </PrimaryButton>
        </form>

        {saldo && (
          <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
            <div className="bg-[#111111] border border-[#2a2a2a] rounded-md p-2">
              <p className="text-[11px] text-[#a3a3a3] mb-1">Saldo</p>
              <p className="text-white text-sm font-medium">{formatMoeda(saldo.vlrSaldo)}</p>
            </div>
            <div className="bg-[#111111] border border-[#2a2a2a] rounded-md p-2">
              <p className="text-[11px] text-[#a3a3a3] mb-1">Bloqueado</p>
              <p className="text-white text-sm font-medium">{formatMoeda(saldo.vlrBloqueado)}</p>
            </div>
            <div className="bg-[#111111] border border-[#2a2a2a] rounded-md p-2">
              <p className="text-[11px] text-[#a3a3a3] mb-1">Agendado</p>
              <p className="text-white text-sm font-medium">{formatMoeda(saldo.vlrAgendado)}</p>
            </div>
            <div className="bg-[#111111] border border-[#2a2a2a] rounded-md p-2 col-span-2 md:col-span-3">
              <p className="text-[11px] text-[#a3a3a3] mb-1">Última atualização</p>
              <p className="text-white text-sm font-medium">{formatDataHora(saldo.dtUltAtualizacao)}</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
