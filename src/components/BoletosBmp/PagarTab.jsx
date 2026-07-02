import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Field, Feedback, Card, PrimaryButton, inputCls, extractError, formatMoeda } from './shared'

const novaIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'bmp-' + Date.now() + '-' + Math.random().toString(16).slice(2)
}

export default function PagarTab() {
  // Identificação do título a pagar
  const [linhaDigitavel, setLinhaDigitavel] = useState('')
  const [codigoBarras, setCodigoBarras] = useState('')

  // Pagador (quem está debitando)
  const [agencia, setAgencia] = useState('')
  const [conta, setConta] = useState('')
  const [contaDigito, setContaDigito] = useState('')
  const [contaPgto, setContaPgto] = useState('')

  const [tipoProcessamento, setTipoProcessamento] = useState('')
  const [valorTitulo, setValorTitulo] = useState('')
  const [dataVencimento, setDataVencimento] = useState('')
  const [valorPagamento, setValorPagamento] = useState('')
  const [codOperacaoCli, setCodOperacaoCli] = useState('')
  const [descCliente, setDescCliente] = useState('')

  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resultado, setResultado] = useState(null)

  const num = (v) => {
    if (v === '' || v == null) return undefined
    const n = parseFloat(String(v).replace(',', '.'))
    return isNaN(n) ? undefined : n
  }

  const toIso = (d) => (d ? `${d}T00:00:00` : undefined)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResultado(null)

    if (!linhaDigitavel && !codigoBarras) {
      setFeedback({ ok: false, message: 'Informe a linha digitável ou o código de barras do boleto.' })
      return
    }

    const pagador = {
      agencia: agencia || null,
      conta: conta || null,
      contaDigito: contaDigito || null,
      contaPgto: contaPgto || null,
    }

    const titulo = {
      linhaDigitavel: linhaDigitavel || null,
      codigoBarras: codigoBarras || null,
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-boleto-pagar', {
        body: {
          pagador,
          tipoProcessamento: tipoProcessamento || undefined,
          titulo,
          valorTitulo: num(valorTitulo),
          dataVencimento: toIso(dataVencimento),
          valorPagamento: num(valorPagamento),
          codOperacaoCli: codOperacaoCli || undefined,
          descCliente: descCliente || undefined,
          idempotencyKey: novaIdempotencyKey(),
        },
      })
      const errMsg = extractError(data, error, 'Erro ao pagar o boleto.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setResultado(data)
        setFeedback({ ok: true, message: data?.mensagem || 'Pagamento realizado com sucesso.' })
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <Card title="Pagar boleto" description="Informe a linha digitável ou o código de barras, e os dados da conta pagadora.">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Linha digitável">
              <input className={inputCls} value={linhaDigitavel} onChange={(e) => setLinhaDigitavel(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Código de barras">
              <input className={inputCls} value={codigoBarras} onChange={(e) => setCodigoBarras(e.target.value)} disabled={loading} />
            </Field>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Agência (pagador)">
              <input className={inputCls} value={agencia} onChange={(e) => setAgencia(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Conta (pagador)">
              <input className={inputCls} value={conta} onChange={(e) => setConta(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Dígito da conta">
              <input className={inputCls} value={contaDigito} onChange={(e) => setContaDigito(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Conta pagamento">
              <input className={inputCls} value={contaPgto} onChange={(e) => setContaPgto(e.target.value)} disabled={loading} />
            </Field>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Tipo de processamento">
              <input className={inputCls} value={tipoProcessamento} onChange={(e) => setTipoProcessamento(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Valor do título">
              <input className={inputCls} value={valorTitulo} onChange={(e) => setValorTitulo(e.target.value)} placeholder="0,00" disabled={loading} />
            </Field>
            <Field label="Data de vencimento">
              <input type="date" className={inputCls} value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Valor do pagamento">
              <input className={inputCls} value={valorPagamento} onChange={(e) => setValorPagamento(e.target.value)} placeholder="0,00" disabled={loading} />
            </Field>
            <Field label="Código de operação (cliente)">
              <input className={inputCls} value={codOperacaoCli} onChange={(e) => setCodOperacaoCli(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Descrição (cliente)">
              <input className={inputCls} value={descCliente} onChange={(e) => setDescCliente(e.target.value)} disabled={loading} />
            </Field>
          </div>

          <Feedback feedback={feedback} />

          <PrimaryButton type="submit" disabled={loading}>
            {loading ? 'Pagando...' : 'Pagar Boleto'}
          </PrimaryButton>
        </form>

        {resultado && (
          <div className="mt-5 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="bg-[#111111] border border-[#2a2a2a] rounded-md p-3">
                <p className="text-[11px] text-[#a3a3a3] mb-1">Valor pago</p>
                <p className="text-white text-sm font-medium">{formatMoeda(resultado.valorTransacao)}</p>
              </div>
              <div className="bg-[#111111] border border-[#2a2a2a] rounded-md p-3">
                <p className="text-[11px] text-[#a3a3a3] mb-1">Custo da transação</p>
                <p className="text-white text-sm font-medium">{formatMoeda(resultado.custoTransacao)}</p>
              </div>
              <div className="bg-[#111111] border border-[#2a2a2a] rounded-md p-3">
                <p className="text-[11px] text-[#a3a3a3] mb-1">Código do movimento</p>
                <p className="text-white text-sm font-medium break-all">{resultado.codigoMovimento ?? '—'}</p>
              </div>
              <div className="bg-[#111111] border border-[#2a2a2a] rounded-md p-3 col-span-2 md:col-span-3">
                <p className="text-[11px] text-[#a3a3a3] mb-1">Código de transação</p>
                <p className="text-white text-sm font-medium break-all">{resultado.codigoTransacao ?? '—'}</p>
              </div>
            </div>

            <details className="bg-[#111111] border border-[#2a2a2a] rounded-md p-3">
              <summary className="text-xs text-[#a3a3a3] cursor-pointer select-none">Resposta completa (JSON)</summary>
              <pre className="mt-2 text-[11px] text-[#d4d4d4] whitespace-pre-wrap break-all">
                {JSON.stringify(resultado.raw ?? resultado, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </Card>
    </div>
  )
}
