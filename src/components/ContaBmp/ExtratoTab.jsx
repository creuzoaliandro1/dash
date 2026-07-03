import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Field, Feedback, Card, PrimaryButton, inputCls, extractError, formatMoeda, formatData } from './shared'

export default function ExtratoTab() {
  const [diaInicial, setDiaInicial] = useState('')
  const [diaFinal, setDiaFinal] = useState('')
  const [mes, setMes] = useState('')
  const [ano, setAno] = useState('')
  const [agencia, setAgencia] = useState('')
  const [conta, setConta] = useState('')
  const [contaDigito, setContaDigito] = useState('')
  const [contaPgto, setContaPgto] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [movimentos, setMovimentos] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setMovimentos(null)

    if (!contaPgto && (!agencia || !conta)) {
      setFeedback({ ok: false, message: 'Informe agência + conta, ou a contaPgto diretamente.' })
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-conta-extrato', {
        body: {
          diaInicial: diaInicial ? Number(diaInicial) : undefined,
          diaFinal: diaFinal ? Number(diaFinal) : undefined,
          mes: mes ? Number(mes) : undefined,
          ano: ano ? Number(ano) : undefined,
          agencia,
          conta,
          contaDigito,
          contaPgto,
        },
      })
      const errMsg = extractError(data, error, 'Erro ao consultar o extrato.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setMovimentos(data?.movimentos || [])
        if (!data?.movimentos || data.movimentos.length === 0) {
          setFeedback({ ok: true, message: 'Nenhum movimento encontrado no período.' })
        }
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      <Card title="Consultar extrato" description="Informe o período (dia inicial/final, mês e ano) e a conta.">
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Field label="Dia inicial">
              <input type="number" className={inputCls} value={diaInicial} onChange={(e) => setDiaInicial(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Dia final">
              <input type="number" className={inputCls} value={diaFinal} onChange={(e) => setDiaFinal(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Mês">
              <input type="number" className={inputCls} value={mes} onChange={(e) => setMes(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Ano">
              <input type="number" className={inputCls} value={ano} onChange={(e) => setAno(e.target.value)} disabled={loading} />
            </Field>
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

        {movimentos && movimentos.length > 0 && (
          <div className="mt-2 overflow-x-auto border border-[#2a2a2a] rounded-md">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#141414] text-[#666666] uppercase tracking-wider">
                  <th className="text-left px-3 py-2">Data</th>
                  <th className="text-left px-3 py-2">Descrição</th>
                  <th className="text-left px-3 py-2">Tipo</th>
                  <th className="text-left px-3 py-2">Valor</th>
                  <th className="text-left px-3 py-2">Saldo final do dia</th>
                </tr>
              </thead>
              <tbody>
                {movimentos.map((m, i) => (
                  <tr key={i} className="border-t border-[#1a1a1a] text-[#d4d4d4]">
                    <td className="px-3 py-2">{formatData(m.dtMovimento)}</td>
                    <td className="px-3 py-2">{m.descricaoOperacao}</td>
                    <td className="px-3 py-2">{m.tipoLancamento}</td>
                    <td className="px-3 py-2">{formatMoeda(m.vlrMovimento)}</td>
                    <td className="px-3 py-2">{formatMoeda(m.saldoFinalDia)}</td>
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
