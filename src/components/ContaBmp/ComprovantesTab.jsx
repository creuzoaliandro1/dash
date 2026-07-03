import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Field, Feedback, Card, PrimaryButton, inputCls, extractError } from './shared'

export default function ComprovantesTab() {
  const [codigoTransacao, setCodigoTransacao] = useState('')
  const [codigoMovimento, setCodigoMovimento] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [comprovante, setComprovante] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setComprovante(null)

    if (!codigoTransacao && !codigoMovimento) {
      setFeedback({ ok: false, message: 'Informe o código da transação e/ou o código do movimento.' })
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-comprovante-consultar', {
        body: { codigoTransacao, codigoMovimento },
      })
      const errMsg = extractError(data, error, 'Erro ao consultar o comprovante.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setComprovante(data?.comprovante ?? data ?? null)
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      <Card title="Consultar comprovante" description="Informe o código da transação e/ou do movimento.">
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Field label="Código da transação">
              <input className={inputCls} value={codigoTransacao} onChange={(e) => setCodigoTransacao(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Código do movimento">
              <input className={inputCls} value={codigoMovimento} onChange={(e) => setCodigoMovimento(e.target.value)} disabled={loading} />
            </Field>
          </div>

          <Feedback feedback={feedback} />

          <PrimaryButton type="submit" disabled={loading}>
            {loading ? 'Consultando...' : 'Consultar'}
          </PrimaryButton>
        </form>

        {comprovante && (
          <pre className="mt-2 p-3 bg-[#111111] border border-[#2a2a2a] rounded-md text-[#d4d4d4] text-xs overflow-auto max-h-[420px]">
            {JSON.stringify(comprovante, null, 2)}
          </pre>
        )}
      </Card>
    </div>
  )
}
