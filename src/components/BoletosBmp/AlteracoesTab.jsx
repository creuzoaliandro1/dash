import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Field, Feedback, Card, PrimaryButton, inputCls, extractError, formatMoeda, formatData, formatDataHora } from './shared'

function ConsultarAlteracoesCard() {
  const [codigoRegistroBoleto, setCodigoRegistroBoleto] = useState('')
  const [codigoBarras, setCodigoBarras] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [alteracoes, setAlteracoes] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setAlteracoes(null)

    if (!codigoRegistroBoleto && !codigoBarras) {
      setFeedback({ ok: false, message: 'Informe o código de registro do boleto ou o código de barras.' })
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-boleto-consultar-alteracoes', {
        body: { codigoRegistroBoleto, codigoBarras },
      })
      const errMsg = extractError(data, error, 'Erro ao consultar alterações do boleto.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        const lista = Array.isArray(data?.alteracoes) ? data.alteracoes : []
        setAlteracoes(lista)
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
    <Card title="Consultar alterações" description="Consulta o histórico completo de alterações realizadas em um boleto.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

      {alteracoes && alteracoes.length > 0 && (
        <div className="mt-5 overflow-auto max-h-[420px]">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#2a2a2a] text-[#a3a3a3] text-left">
                <th className="py-2 pr-3">Código</th>
                <th className="py-2 pr-3">Situação</th>
                <th className="py-2 pr-3">Vencimento</th>
                <th className="py-2 pr-3">Valor</th>
                <th className="py-2 pr-3">Data movimento</th>
                <th className="py-2 pr-3">Mensagem</th>
              </tr>
            </thead>
            <tbody>
              {alteracoes.map((item, idx) => (
                <tr key={item?.codigo ?? idx} className="border-b border-[#1a1a1a] text-[#d4d4d4]">
                  <td className="py-2 pr-3">{item?.codigo ?? '—'}</td>
                  <td className="py-2 pr-3">{item?.situacao ?? '—'}</td>
                  <td className="py-2 pr-3">{formatData(item?.dtVencTit)}</td>
                  <td className="py-2 pr-3">{formatMoeda(item?.vlrTit)}</td>
                  <td className="py-2 pr-3">{formatDataHora(item?.dtMovto)}</td>
                  <td className="py-2 pr-3">{item?.msgSituacao ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function UltimaAlteracaoCard() {
  const [codigoRegistroBoleto, setCodigoRegistroBoleto] = useState('')
  const [codigoBarras, setCodigoBarras] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [ultima, setUltima] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setUltima(null)

    if (!codigoRegistroBoleto && !codigoBarras) {
      setFeedback({ ok: false, message: 'Informe o código de registro do boleto ou o código de barras.' })
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-boleto-consultar-ultima-alteracao', {
        body: { codigoRegistroBoleto, codigoBarras },
      })
      const errMsg = extractError(data, error, 'Erro ao consultar a última alteração do boleto.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        const lista = Array.isArray(data?.alteracoes) ? data.alteracoes : []
        const item = lista[0] ?? null
        setUltima(item)
        if (!item) {
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
    <Card title="Última alteração" description="Consulta somente a alteração mais recente de um boleto.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Código de registro do boleto">
            <input className={inputCls} value={codigoRegistroBoleto} onChange={(e) => setCodigoRegistroBoleto(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Código de barras">
            <input className={inputCls} value={codigoBarras} onChange={(e) => setCodigoBarras(e.target.value)} disabled={loading} />
          </Field>
        </div>

        <Feedback feedback={feedback} />

        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Consultando...' : 'Consultar última alteração'}
        </PrimaryButton>
      </form>

      {ultima && (
        <div className="mt-5 grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-[#111111] border border-[#2a2a2a] rounded-md">
            <div className="text-[#a3a3a3] mb-1">Código</div>
            <div className="text-white">{ultima?.codigo ?? '—'}</div>
          </div>
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
          <div className="p-3 bg-[#111111] border border-[#2a2a2a] rounded-md">
            <div className="text-[#a3a3a3] mb-1">Mensagem</div>
            <div className="text-white">{ultima?.msgSituacao ?? '—'}</div>
          </div>
        </div>
      )}
    </Card>
  )
}

export default function AlteracoesTab() {
  return (
    <div className="space-y-6 max-w-3xl">
      <ConsultarAlteracoesCard />
      <UltimaAlteracaoCard />
    </div>
  )
}
