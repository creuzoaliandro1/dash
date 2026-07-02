import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Field, Feedback, Card, PrimaryButton, inputCls, textareaCls, extractError, formatMoeda, formatData } from './shared'

export default function MovimentacaoTab() {
  const [dtInicial, setDtInicial] = useState('')
  const [dtFinal, setDtFinal] = useState('')
  const [operacoesTexto, setOperacoesTexto] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [movimentos, setMovimentos] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setMovimentos(null)

    if (!dtInicial || !dtFinal) {
      setFeedback({ ok: false, message: 'Informe a data inicial e a data final.' })
      return
    }

    const operacoes = operacoesTexto
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-conta-movimento', {
        body: { dtInicial, dtFinal, operacoes },
      })
      const errMsg = extractError(data, error, 'Erro ao consultar a movimentação.')
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
    <div className="max-w-4xl">
      <Card title="Consultar movimentação" description="Informe o período e, opcionalmente, os tipos de operação (um por linha).">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data inicial">
              <input type="date" className={inputCls} value={dtInicial} onChange={(e) => setDtInicial(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Data final">
              <input type="date" className={inputCls} value={dtFinal} onChange={(e) => setDtFinal(e.target.value)} disabled={loading} />
            </Field>
          </div>
          <Field label="Operações (uma por linha, opcional)">
            <textarea
              className={textareaCls}
              rows={4}
              value={operacoesTexto}
              onChange={(e) => setOperacoesTexto(e.target.value)}
              disabled={loading}
              placeholder={'Ex.:\nTED\nPIX'}
            />
          </Field>

          <Feedback feedback={feedback} />

          <PrimaryButton type="submit" disabled={loading}>
            {loading ? 'Consultando...' : 'Consultar'}
          </PrimaryButton>
        </form>

        {movimentos && movimentos.length > 0 && (
          <div className="mt-5 overflow-x-auto border border-[#2a2a2a] rounded-md">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#141414] text-[#666666] uppercase tracking-wider">
                  <th className="text-left px-3 py-2">Data</th>
                  <th className="text-left px-3 py-2">Descrição</th>
                  <th className="text-left px-3 py-2">Nome</th>
                  <th className="text-left px-3 py-2">Valor</th>
                  <th className="text-left px-3 py-2">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {movimentos.map((m, i) => (
                  <tr key={i} className="border-t border-[#1a1a1a] text-[#d4d4d4]">
                    <td className="px-3 py-2">{formatData(m.dtMovimento)}</td>
                    <td className="px-3 py-2">{m.descOperacao}</td>
                    <td className="px-3 py-2">{m.nome}</td>
                    <td className="px-3 py-2">{formatMoeda(m.vlrMovimento)}</td>
                    <td className="px-3 py-2">{m.tipoLancamento}</td>
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
