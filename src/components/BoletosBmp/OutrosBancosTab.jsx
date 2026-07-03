import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Field, Feedback, Card, PrimaryButton, inputCls, extractError, formatMoeda, formatData } from './shared'

export default function OutrosBancosTab() {
  const [linhaDigitavel, setLinhaDigitavel] = useState('')
  const [codigoBarras, setCodigoBarras] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resultado, setResultado] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResultado(null)

    if (!linhaDigitavel && !codigoBarras) {
      setFeedback({ ok: false, message: 'Informe a linha digitável ou o código de barras.' })
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-boleto-outros-bancos', {
        body: { linhaDigitavel: linhaDigitavel || undefined, codigoBarras: codigoBarras || undefined },
      })
      const errMsg = extractError(data, error, 'Erro ao consultar o boleto de outro banco.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setResultado(data)
        setFeedback({ ok: true, message: data?.mensagem || 'Boleto consultado com sucesso.' })
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  const dadosTitulo = resultado?.dadosTitulo ?? null

  return (
    <div className="w-full">
      <Card title="Boletos de outros bancos" description="Consulta um boleto emitido por outro banco (não BMP) a partir da linha digitável ou do código de barras.">
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Field label="Linha digitável">
              <input className={inputCls} value={linhaDigitavel} onChange={(e) => setLinhaDigitavel(e.target.value)} disabled={loading} placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000" />
            </Field>
            <Field label="Código de barras">
              <input className={inputCls} value={codigoBarras} onChange={(e) => setCodigoBarras(e.target.value)} disabled={loading} />
            </Field>
          </div>

          <Feedback feedback={feedback} />

          <PrimaryButton type="submit" disabled={loading}>
            {loading ? 'Consultando...' : 'Consultar boleto'}
          </PrimaryButton>
        </form>

        {resultado && (
          <div className="mt-2 space-y-2">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              <div className="p-3 bg-[#111111] border border-[#2a2a2a] rounded-md">
                <div className="text-[#a3a3a3] mb-1">Valor total do título</div>
                <div className="text-white">{formatMoeda(resultado?.vlrTitTotal)}</div>
              </div>
              {dadosTitulo && (
                <>
                  <div className="p-3 bg-[#111111] border border-[#2a2a2a] rounded-md">
                    <div className="text-[#a3a3a3] mb-1">Vencimento</div>
                    <div className="text-white">{formatData(dadosTitulo?.dtVencTit ?? dadosTitulo?.dtVencimento)}</div>
                  </div>
                  <div className="p-3 bg-[#111111] border border-[#2a2a2a] rounded-md">
                    <div className="text-[#a3a3a3] mb-1">Valor do título</div>
                    <div className="text-white">{formatMoeda(dadosTitulo?.vlrTit)}</div>
                  </div>
                  <div className="p-3 bg-[#111111] border border-[#2a2a2a] rounded-md">
                    <div className="text-[#a3a3a3] mb-1">Beneficiário</div>
                    <div className="text-white">{dadosTitulo?.nomeBeneficiario ?? dadosTitulo?.beneficiario ?? '—'}</div>
                  </div>
                  <div className="p-3 bg-[#111111] border border-[#2a2a2a] rounded-md">
                    <div className="text-[#a3a3a3] mb-1">Linha digitável</div>
                    <div className="text-white break-all">{dadosTitulo?.numLinhaDigtvl ?? linhaDigitavel ?? '—'}</div>
                  </div>
                  <div className="p-3 bg-[#111111] border border-[#2a2a2a] rounded-md">
                    <div className="text-[#a3a3a3] mb-1">Código de barras</div>
                    <div className="text-white break-all">{dadosTitulo?.numCodBarras ?? codigoBarras ?? '—'}</div>
                  </div>
                </>
              )}
            </div>

            {resultado?.raw?.juros && (
              <div>
                <h3 className="text-xs font-semibold text-[#a3a3a3] uppercase mb-2">Juros</h3>
                <pre className="p-3 bg-[#111111] border border-[#2a2a2a] rounded-md text-[#d4d4d4] text-xs overflow-auto max-h-[200px]">
                  {JSON.stringify(resultado.raw.juros, null, 2)}
                </pre>
              </div>
            )}

            {resultado?.raw?.multa && (
              <div>
                <h3 className="text-xs font-semibold text-[#a3a3a3] uppercase mb-2">Multa</h3>
                <pre className="p-3 bg-[#111111] border border-[#2a2a2a] rounded-md text-[#d4d4d4] text-xs overflow-auto max-h-[200px]">
                  {JSON.stringify(resultado.raw.multa, null, 2)}
                </pre>
              </div>
            )}

            {resultado?.raw?.descontos && (
              <div>
                <h3 className="text-xs font-semibold text-[#a3a3a3] uppercase mb-2">Descontos</h3>
                <pre className="p-3 bg-[#111111] border border-[#2a2a2a] rounded-md text-[#d4d4d4] text-xs overflow-auto max-h-[200px]">
                  {JSON.stringify(resultado.raw.descontos, null, 2)}
                </pre>
              </div>
            )}

            {resultado?.raw?.validacoes && (
              <div>
                <h3 className="text-xs font-semibold text-[#a3a3a3] uppercase mb-2">Validações</h3>
                <pre className="p-3 bg-[#111111] border border-[#2a2a2a] rounded-md text-[#d4d4d4] text-xs overflow-auto max-h-[200px]">
                  {JSON.stringify(resultado.raw.validacoes, null, 2)}
                </pre>
              </div>
            )}

            <details className="text-xs">
              <summary className="cursor-pointer text-[#a3a3a3] hover:text-white">Ver resposta completa</summary>
              <pre className="mt-2 p-3 bg-[#111111] border border-[#2a2a2a] rounded-md text-[#d4d4d4] overflow-auto max-h-[420px]">
                {JSON.stringify(resultado, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </Card>
    </div>
  )
}
