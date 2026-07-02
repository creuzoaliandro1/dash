import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Field, Feedback, Card, PrimaryButton, inputCls, textareaCls, extractError } from './shared'

const TIPO_JUROS_OPTIONS = [
  { value: '', label: '—' },
  { value: '1', label: 'Isento (1)' },
  { value: '2', label: 'Valor por dia (2)' },
  { value: '3', label: 'Taxa mensal (3)' },
]

const TIPO_MULTA_OPTIONS = [
  { value: '', label: '—' },
  { value: '1', label: 'Isento (1)' },
  { value: '2', label: 'Valor fixo (2)' },
  { value: '3', label: 'Percentual (3)' },
]

export default function AtualizarTab() {
  const [form, setForm] = useState({
    codigoRegistroBoleto: '',
    codigoBarras: '',
    dtVencimento: '',
    vlrTit: '',
    dtLimPgto: '',
    vlrAbatimento: '',
    numDocTit: '',
    numeroDocumento: '',
    tipoJuros: '',
    vlrJuros: '',
    tipoMulta: '',
    vlrMulta: '',
    tipoDesconto: '',
    vlrDesconto: '',
    dtLimiteDesconto: '',
    identificadorCliente: '',
    instrucoesBeneficiario: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resultado, setResultado] = useState(null)

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResultado(null)

    if (!form.codigoRegistroBoleto && !form.codigoBarras) {
      setFeedback({ ok: false, message: 'Informe o código de registro do boleto ou o código de barras.' })
      return
    }

    setSubmitting(true)
    try {
      const dadosBoleto = {}
      if (form.dtVencimento) dadosBoleto.dtVencimento = form.dtVencimento
      if (form.vlrTit) dadosBoleto.vlrTit = Number(form.vlrTit)
      if (form.dtLimPgto) dadosBoleto.dtLimPgto = form.dtLimPgto
      if (form.vlrAbatimento) dadosBoleto.vlrAbatimento = Number(form.vlrAbatimento)
      if (form.numDocTit) dadosBoleto.numDocTit = form.numDocTit
      if (form.numeroDocumento) dadosBoleto.numeroDocumento = form.numeroDocumento

      const juros = form.tipoJuros
        ? { tipoJuros: Number(form.tipoJuros), vlrJuros: form.vlrJuros ? Number(form.vlrJuros) : undefined }
        : undefined
      const multa = form.tipoMulta
        ? { tipoMulta: Number(form.tipoMulta), vlrMulta: form.vlrMulta ? Number(form.vlrMulta) : undefined }
        : undefined
      const desconto = form.tipoDesconto
        ? {
            tipoDesconto: Number(form.tipoDesconto),
            vlrDesconto: form.vlrDesconto ? Number(form.vlrDesconto) : undefined,
            dtLimiteDesconto: form.dtLimiteDesconto || undefined,
          }
        : undefined

      const body = {
        codigoRegistroBoleto: form.codigoRegistroBoleto || undefined,
        codigoBarras: form.codigoBarras || undefined,
        dadosBoleto: Object.keys(dadosBoleto).length > 0 ? dadosBoleto : undefined,
        juros,
        multa,
        desconto,
        identificadorCliente: form.identificadorCliente || undefined,
        instrucoesBeneficiario: form.instrucoesBeneficiario || undefined,
      }

      const { data, error } = await supabase.functions.invoke('bmp-boleto-atualizar', { body })
      const errMsg = extractError(data, error, 'Erro ao atualizar o boleto.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setFeedback({ ok: true, message: data?.mensagem || 'Boleto atualizado com sucesso.' })
        setResultado(data)
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <Card title="Atualizar boleto" description="Altera dados de um boleto já registrado no BMP. Preencha apenas os campos que deseja alterar.">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Código de registro do boleto">
              <input className={inputCls} value={form.codigoRegistroBoleto} onChange={set('codigoRegistroBoleto')} disabled={submitting} />
            </Field>
            <Field label="Código de barras">
              <input className={inputCls} value={form.codigoBarras} onChange={set('codigoBarras')} disabled={submitting} />
            </Field>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-[#a3a3a3] uppercase mb-2">Dados do título</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Novo vencimento">
                <input type="date" className={inputCls} value={form.dtVencimento} onChange={set('dtVencimento')} disabled={submitting} />
              </Field>
              <Field label="Novo valor do título">
                <input type="number" step="0.01" className={inputCls} value={form.vlrTit} onChange={set('vlrTit')} disabled={submitting} />
              </Field>
              <Field label="Data limite de pagamento">
                <input type="date" className={inputCls} value={form.dtLimPgto} onChange={set('dtLimPgto')} disabled={submitting} />
              </Field>
              <Field label="Valor de abatimento">
                <input type="number" step="0.01" className={inputCls} value={form.vlrAbatimento} onChange={set('vlrAbatimento')} disabled={submitting} />
              </Field>
              <Field label="Número do documento (numDocTit)">
                <input className={inputCls} value={form.numDocTit} onChange={set('numDocTit')} disabled={submitting} />
              </Field>
              <Field label="Número do documento">
                <input className={inputCls} value={form.numeroDocumento} onChange={set('numeroDocumento')} disabled={submitting} />
              </Field>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-[#a3a3a3] uppercase mb-2">Juros</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo de juros">
                <select className={inputCls} value={form.tipoJuros} onChange={set('tipoJuros')} disabled={submitting}>
                  {TIPO_JUROS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Valor/percentual de juros">
                <input type="number" step="0.01" className={inputCls} value={form.vlrJuros} onChange={set('vlrJuros')} disabled={submitting} />
              </Field>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-[#a3a3a3] uppercase mb-2">Multa</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo de multa">
                <select className={inputCls} value={form.tipoMulta} onChange={set('tipoMulta')} disabled={submitting}>
                  {TIPO_MULTA_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Valor/percentual de multa">
                <input type="number" step="0.01" className={inputCls} value={form.vlrMulta} onChange={set('vlrMulta')} disabled={submitting} />
              </Field>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-[#a3a3a3] uppercase mb-2">Desconto</h3>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Tipo de desconto">
                <input className={inputCls} value={form.tipoDesconto} onChange={set('tipoDesconto')} disabled={submitting} placeholder="1, 2, 3..." />
              </Field>
              <Field label="Valor/percentual de desconto">
                <input type="number" step="0.01" className={inputCls} value={form.vlrDesconto} onChange={set('vlrDesconto')} disabled={submitting} />
              </Field>
              <Field label="Data limite do desconto">
                <input type="date" className={inputCls} value={form.dtLimiteDesconto} onChange={set('dtLimiteDesconto')} disabled={submitting} />
              </Field>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <Field label="Identificador do cliente">
              <input className={inputCls} value={form.identificadorCliente} onChange={set('identificadorCliente')} disabled={submitting} />
            </Field>
            <Field label="Instruções ao beneficiário">
              <textarea rows={3} className={textareaCls} value={form.instrucoesBeneficiario} onChange={set('instrucoesBeneficiario')} disabled={submitting} />
            </Field>
          </div>

          <Feedback feedback={feedback} />

          <PrimaryButton type="submit" disabled={submitting}>
            {submitting ? 'Atualizando...' : 'Atualizar boleto'}
          </PrimaryButton>
        </form>

        {resultado && (
          <pre className="mt-5 p-3 bg-[#111111] border border-[#2a2a2a] rounded-md text-[#d4d4d4] text-xs overflow-auto max-h-[420px]">
            {JSON.stringify(resultado, null, 2)}
          </pre>
        )}
      </Card>
    </div>
  )
}
