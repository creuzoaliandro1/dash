import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Field, Feedback, Card, PrimaryButton, inputCls, textareaCls, extractError } from './shared'

const novaIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'bmp-' + Date.now() + '-' + Math.random().toString(16).slice(2)
}

// Aceita um valor único ou uma lista separada por vírgula/quebra de linha.
const parseLista = (v) =>
  v
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

export default function CancelarTab() {
  const [listaCodigos, setListaCodigos] = useState('')
  const [listaCodigosBarras, setListaCodigosBarras] = useState('')
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

    const confirmado = window.confirm(
      'Tem certeza que deseja cancelar o(s) registro(s) informado(s)? Essa ação não pode ser desfeita.'
    )
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
    <div className="max-w-3xl">
      <Card
        title="Cancelar registro de boleto"
        description="Informe um ou mais códigos de registro e/ou códigos de barras (um por linha ou separados por vírgula). Ação destrutiva — pede confirmação antes de enviar."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Código(s) de registro do boleto">
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
            {loading ? 'Cancelando...' : 'Cancelar Registro'}
          </PrimaryButton>
        </form>

        {itens.length > 0 && (
          <div className="mt-5 overflow-x-auto border border-[#2a2a2a] rounded-md">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#141414] text-[#666666] uppercase tracking-wider">
                  <th className="text-left px-3 py-2">Código de registro</th>
                  <th className="text-left px-3 py-2">Código de cancelamento</th>
                  <th className="text-left px-3 py-2">Situação</th>
                  <th className="text-left px-3 py-2">Ticket</th>
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
                    <td className="px-3 py-2">{item.ticketId ?? '—'}</td>
                    <td className="px-3 py-2">{item.sucesso === false ? 'Não' : 'Sim'}</td>
                    <td className="px-3 py-2">{item.mensagem ?? '—'}</td>
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
