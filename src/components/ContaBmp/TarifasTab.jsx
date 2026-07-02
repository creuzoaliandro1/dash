import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Field, Feedback, Card, PrimaryButton, inputCls, extractError, formatMoeda } from './shared'

export default function TarifasTab() {
  const [agencia, setAgencia] = useState('')
  const [conta, setConta] = useState('')
  const [contaDigito, setContaDigito] = useState('')
  const [contaPgto, setContaPgto] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [tarifas, setTarifas] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setTarifas(null)

    if (!contaPgto && (!agencia || !conta)) {
      setFeedback({ ok: false, message: 'Informe agência + conta, ou a contaPgto diretamente.' })
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-conta-tarifas', {
        body: { agencia, conta, contaDigito, contaPgto },
      })
      const errMsg = extractError(data, error, 'Erro ao consultar as tarifas.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setTarifas(data?.tarifas || [])
        if (!data?.tarifas || data.tarifas.length === 0) {
          setFeedback({ ok: true, message: 'Nenhuma tarifa encontrada.' })
        }
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <Card title="Consultar tarifas" description="Informe agência + conta (com dígito), ou diretamente a contaPgto.">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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

        {tarifas && tarifas.length > 0 && (
          <div className="mt-5 overflow-x-auto border border-[#2a2a2a] rounded-md">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#141414] text-[#666666] uppercase tracking-wider">
                  <th className="text-left px-3 py-2">Identificador</th>
                  <th className="text-left px-3 py-2">Descrição</th>
                  <th className="text-left px-3 py-2">Valor do serviço</th>
                </tr>
              </thead>
              <tbody>
                {tarifas.map((t, i) => (
                  <tr key={i} className="border-t border-[#1a1a1a] text-[#d4d4d4]">
                    <td className="px-3 py-2">{t.identificador}</td>
                    <td className="px-3 py-2">{t.descricao}</td>
                    <td className="px-3 py-2">{formatMoeda(t.vlrServico)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
