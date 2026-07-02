import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Field, Feedback, Card, PrimaryButton, textareaCls, extractError } from './shared'

const parseLista = (v) =>
  v
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

export default function ConsultarCancelamentoTab() {
  const [listaCodigos, setListaCodigos] = useState('')
  const [listaCodigosBarras, setListaCodigosBarras] = useState('')
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
      setFeedback({ ok: false, message: 'Informe ao menos um código de cancelamento/registro ou código de barras.' })
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
    <div className="max-w-3xl">
      <Card
        title="Consultar cancelamento de boleto"
        description="Informe um ou mais códigos (de registro/cancelamento) e/ou códigos de barras (um por linha ou separados por vírgula)."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Código(s) de registro/cancelamento">
              <textarea
                className={textareaCls}
                rows={3}
                value={listaCodigos}
                onChange={(e) => setListaCodigos(e.target.value)}
                disabled={loading}
              />
            </Field>
            <Field label="Código(s) de barras">
              <textarea
                className={textareaCls}
                rows={3}
                value={listaCodigosBarras}
                onChange={(e) => setListaCodigosBarras(e.target.value)}
                disabled={loading}
              />
            </Field>
          </div>

          <Feedback feedback={feedback} />

          <PrimaryButton type="submit" disabled={loading}>
            {loading ? 'Consultando...' : 'Consultar'}
          </PrimaryButton>
        </form>

        {cancelamentos && cancelamentos.length > 0 && (
          <div className="mt-5 overflow-x-auto border border-[#2a2a2a] rounded-md">
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
    </div>
  )
}
