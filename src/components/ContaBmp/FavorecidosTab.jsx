import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Field, Feedback, Card, PrimaryButton, inputCls, selectCls, extractError } from './shared'

// Enum tipoConta do endpoint /api/Favorecido (doc BMP 53-cadastro-de-favorecido):
// 1 Corrente | 2 Poupança | 3 Pagamento | 4 Salário.
const TIPO_CONTA_OPTIONS = [
  { value: '1', label: 'Corrente (1)' },
  { value: '2', label: 'Poupança (2)' },
  { value: '3', label: 'Pagamento (3)' },
  { value: '4', label: 'Salário (4)' },
]

function NovoFavorecidoForm() {
  const [form, setForm] = useState({
    nome: '',
    documentoFederal: '',
    numeroBanco: '',
    agencia: '',
    conta: '',
    contaDigito: '',
    tipoConta: '1',
  })
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [codigoFavorecido, setCodigoFavorecido] = useState(null)

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setCodigoFavorecido(null)

    if (!form.nome || !form.documentoFederal) {
      setFeedback({ ok: false, message: 'Informe nome e documento federal.' })
      return
    }

    setSubmitting(true)
    try {
      // A doc do BMP (53-cadastro-de-favorecido) mostra os dados da conta duplicados:
      // uma vez nos campos de nível raiz e de novo dentro de contaDto — mandamos os
      // dois pra cobrir qualquer um dos dois que o BMP use pra validar.
      const contaDto = {
        agencia: form.agencia || undefined,
        conta: form.conta || undefined,
        contaDigito: form.contaDigito || undefined,
        contaPgto: form.conta ? `${form.conta}${form.contaDigito || ''}` : undefined,
        tipoConta: Number(form.tipoConta),
      }
      const { data, error } = await supabase.functions.invoke('bmp-favorecido-criar', {
        body: { ...form, tipoConta: Number(form.tipoConta), contaDto },
      })
      const errMsg = extractError(data, error, 'Erro ao cadastrar o favorecido.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setFeedback({ ok: true, message: 'Favorecido cadastrado com sucesso.' })
        setCodigoFavorecido(data?.codigoFavorecido ?? null)
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card title="Novo favorecido" description="Cadastra um favorecido para futuras transferências.">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <Field label="Nome">
            <input className={inputCls} value={form.nome} onChange={set('nome')} disabled={submitting} />
          </Field>
          <Field label="Documento federal">
            <input className={inputCls} value={form.documentoFederal} onChange={set('documentoFederal')} disabled={submitting} />
          </Field>
          <Field label="Número do banco">
            <input className={inputCls} value={form.numeroBanco} onChange={set('numeroBanco')} disabled={submitting} />
          </Field>
          <Field label="Agência">
            <input className={inputCls} value={form.agencia} onChange={set('agencia')} disabled={submitting} />
          </Field>
          <Field label="Conta">
            <input className={inputCls} value={form.conta} onChange={set('conta')} disabled={submitting} />
          </Field>
          <Field label="Dígito da conta">
            <input className={inputCls} value={form.contaDigito} onChange={set('contaDigito')} disabled={submitting} />
          </Field>
          <Field label="Tipo de conta">
            <select className={selectCls} value={form.tipoConta} onChange={set('tipoConta')} disabled={submitting}>
              {TIPO_CONTA_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <Feedback feedback={feedback} />

        {codigoFavorecido && (
          <div className="p-3 rounded-md text-xs border bg-[#111111] border-[#2a2a2a] text-[#d4d4d4]">
            Código do favorecido: <span className="text-white">{codigoFavorecido}</span>
          </div>
        )}

        <PrimaryButton type="submit" disabled={submitting}>
          {submitting ? 'Cadastrando...' : 'Cadastrar'}
        </PrimaryButton>
      </form>
    </Card>
  )
}

function AtualizarFavorecidoForm() {
  const [form, setForm] = useState({
    codigoFavorecido: '',
    nome: '',
    documentoFederal: '',
    agencia: '',
    conta: '',
    contaDigito: '',
    tipoConta: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)

    if (!form.codigoFavorecido) {
      setFeedback({ ok: false, message: 'Informe o código do favorecido.' })
      return
    }

    setSubmitting(true)
    try {
      const body = { codigoFavorecido: form.codigoFavorecido }
      if (form.nome) body.nome = form.nome
      if (form.documentoFederal) body.documentoFederal = form.documentoFederal
      if (form.agencia) body.agencia = form.agencia
      if (form.conta) body.conta = form.conta
      if (form.contaDigito) body.contaDigito = form.contaDigito
      if (form.tipoConta) body.tipoConta = Number(form.tipoConta)

      const { data, error } = await supabase.functions.invoke('bmp-favorecido-atualizar', { body })
      const errMsg = extractError(data, error, 'Erro ao atualizar o favorecido.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setFeedback({ ok: true, message: 'Favorecido atualizado com sucesso.' })
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card title="Atualizar favorecido" description="Campos em branco não são alterados.">
      <form onSubmit={handleSubmit} className="space-y-2">
        <Field label="Código do favorecido">
          <input className={inputCls} value={form.codigoFavorecido} onChange={set('codigoFavorecido')} disabled={submitting} />
        </Field>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <Field label="Nome">
            <input className={inputCls} value={form.nome} onChange={set('nome')} disabled={submitting} />
          </Field>
          <Field label="Documento federal">
            <input className={inputCls} value={form.documentoFederal} onChange={set('documentoFederal')} disabled={submitting} />
          </Field>
          <Field label="Agência">
            <input className={inputCls} value={form.agencia} onChange={set('agencia')} disabled={submitting} />
          </Field>
          <Field label="Conta">
            <input className={inputCls} value={form.conta} onChange={set('conta')} disabled={submitting} />
          </Field>
          <Field label="Dígito da conta">
            <input className={inputCls} value={form.contaDigito} onChange={set('contaDigito')} disabled={submitting} />
          </Field>
          <Field label="Tipo de conta">
            <select className={selectCls} value={form.tipoConta} onChange={set('tipoConta')} disabled={submitting}>
              <option value="">—</option>
              {TIPO_CONTA_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <Feedback feedback={feedback} />

        <PrimaryButton type="submit" disabled={submitting}>
          {submitting ? 'Atualizando...' : 'Atualizar'}
        </PrimaryButton>
      </form>
    </Card>
  )
}

export default function FavorecidosTab() {
  return (
    <div className="space-y-3 w-full">
      <NovoFavorecidoForm />
      <AtualizarFavorecidoForm />
    </div>
  )
}
