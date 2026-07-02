import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Field, Feedback, Card, PrimaryButton, inputCls, extractError } from './shared'

export default function ImprimirTab() {
  const [codigoRegistroBoleto, setCodigoRegistroBoleto] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [downloadUrl, setDownloadUrl] = useState(null)
  const [downloadContentType, setDownloadContentType] = useState(null)
  const [jsonConteudo, setJsonConteudo] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setDownloadUrl(null)
    setDownloadContentType(null)
    setJsonConteudo(null)

    if (!codigoRegistroBoleto) {
      setFeedback({ ok: false, message: 'Informe o código de registro do boleto.' })
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-boleto-imprimir', {
        body: { codigoRegistroBoleto },
      })
      const errMsg = extractError(data, error, 'Erro ao imprimir o boleto.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
        return
      }

      const contentType = data?.contentType || ''
      const conteudo = data?.conteudo

      const isPdfOrBinary =
        contentType.toLowerCase().includes('pdf') ||
        (typeof conteudo === 'string' && !contentType.toLowerCase().includes('json'))

      if (isPdfOrBinary && typeof conteudo === 'string') {
        const mime = contentType || 'application/pdf'
        setDownloadUrl(`data:${mime};base64,${conteudo}`)
        setDownloadContentType(mime)
        setFeedback({ ok: true, message: 'Boleto gerado com sucesso.' })
      } else if (conteudo && typeof conteudo === 'object') {
        setJsonConteudo(conteudo)
        setFeedback({ ok: true, message: 'Boleto consultado com sucesso.' })
      } else {
        setFeedback({ ok: false, message: 'Resposta inesperada ao imprimir o boleto.' })
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  const isPdf = downloadContentType?.toLowerCase().includes('pdf')
  const fileExt = isPdf ? 'pdf' : 'bin'

  return (
    <div className="max-w-2xl">
      <Card title="Imprimir boleto" description="Gera a impressão (PDF) de um boleto registrado no BMP a partir do código de registro.">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Código de registro do boleto">
            <input className={inputCls} value={codigoRegistroBoleto} onChange={(e) => setCodigoRegistroBoleto(e.target.value)} disabled={loading} />
          </Field>

          <Feedback feedback={feedback} />

          <PrimaryButton type="submit" disabled={loading}>
            {loading ? 'Gerando...' : 'Imprimir boleto'}
          </PrimaryButton>
        </form>

        {downloadUrl && (
          <div className="mt-5">
            <a
              href={downloadUrl}
              download={`boleto-${codigoRegistroBoleto}.${fileExt}`}
              className="inline-block px-3 py-2 bg-white text-black font-medium rounded-md hover:opacity-90 transition text-sm"
            >
              Abrir/baixar boleto
            </a>
          </div>
        )}

        {jsonConteudo && (
          <pre className="mt-5 p-3 bg-[#111111] border border-[#2a2a2a] rounded-md text-[#d4d4d4] text-xs overflow-auto max-h-[420px]">
            {JSON.stringify(jsonConteudo, null, 2)}
          </pre>
        )}
      </Card>
    </div>
  )
}
