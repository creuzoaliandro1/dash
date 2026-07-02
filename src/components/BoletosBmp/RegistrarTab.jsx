import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Field, Feedback, Card, PrimaryButton, inputCls, selectCls, textareaCls, extractError } from './shared'

const novaIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'bmp-' + Date.now() + '-' + Math.random().toString(16).slice(2)
}

export default function RegistrarTab() {
  // Beneficiário (dados da conta BMP que registra o boleto)
  const [agencia, setAgencia] = useState('')
  const [agenciaDigito, setAgenciaDigito] = useState('')
  const [conta, setConta] = useState('')
  const [contaDigito, setContaDigito] = useState('')
  const [contaPgto, setContaPgto] = useState('')

  // Dados do título
  const [dtVencimento, setDtVencimento] = useState('')
  const [dtLimPgto, setDtLimPgto] = useState('')
  const [vlrTitulo, setVlrTitulo] = useState('')
  const [numDocTit, setNumDocTit] = useState('')
  const [identdNossoNum, setIdentdNossoNum] = useState('')
  const [codEspTit, setCodEspTit] = useState('2')
  const [dtEmissao, setDtEmissao] = useState('')
  const [vlrAbatimento, setVlrAbatimento] = useState('')

  // Pagador
  const [tipoPessoa, setTipoPessoa] = useState('2')
  const [documentoFederal, setDocumentoFederal] = useState('')
  const [nomeRazao, setNomeRazao] = useState('')
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [logradouro, setLogradouro] = useState('')
  const [numeroEndereco, setNumeroEndereco] = useState('')
  const [complemento, setComplemento] = useState('')
  const [bairro, setBairro] = useState('')
  const [cidade, setCidade] = useState('')
  const [uf, setUf] = useState('')
  const [cep, setCep] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')

  // Outros
  const [numeroCarteira, setNumeroCarteira] = useState('1')
  const [tipoRegistro, setTipoRegistro] = useState('1')
  const [instrucoesBeneficiario, setInstrucoesBeneficiario] = useState('')

  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resultado, setResultado] = useState(null)

  const toIso = (d) => {
    if (!d) return null
    return `${d}T00:00:00`
  }

  const num = (v) => {
    const n = parseFloat(String(v).replace(',', '.'))
    return isNaN(n) ? 0 : n
  }

  const onlyDigits = (v) => (v == null ? '' : String(v).replace(/\D/g, ''))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResultado(null)

    if (!dtVencimento || !vlrTitulo) {
      setFeedback({ ok: false, message: 'Informe ao menos vencimento e valor do título.' })
      return
    }
    if (!documentoFederal || !nomeRazao) {
      setFeedback({ ok: false, message: 'Informe ao menos documento e nome/razão social do pagador.' })
      return
    }

    const payload = {
      beneficiario: {
        agencia: agencia || null,
        agenciaDigito: agenciaDigito || null,
        conta: conta || null,
        contaDigito: contaDigito || null,
        contaPgto: contaPgto || null,
        tipoConta: 1,
        modeloConta: 1,
      },
      dadosBoleto: {
        dtVencimento: toIso(dtVencimento),
        dtLimPgto: toIso(dtLimPgto),
        vlrTitulo: num(vlrTitulo),
        numDocTit: numDocTit || null,
        identdNossoNum: identdNossoNum || null,
        codEspTit: codEspTit ? parseInt(codEspTit, 10) : 2,
        dtEmissao: toIso(dtEmissao),
        vlrAbatimento: num(vlrAbatimento),
        numeroDocumento: numDocTit || null,
      },
      pagador: {
        tipoPessoa: tipoPessoa ? parseInt(tipoPessoa, 10) : (onlyDigits(documentoFederal).length > 11 ? 2 : 1),
        documentoFederal: onlyDigits(documentoFederal),
        nomeRazao: nomeRazao || null,
        nomeFantasia: nomeFantasia || nomeRazao || null,
        logradouro: logradouro || null,
        cidade: cidade || null,
        uf: uf || null,
        cep: onlyDigits(cep),
        bairro: bairro || null,
        numero: numeroEndereco || null,
        complemento: complemento || null,
        email: email || null,
        telefone: onlyDigits(telefone),
      },
      sacadorAvalista: null,
      juros: null,
      multa: null,
      desconto: null,
      descontos: null,
      instrucoesBeneficiario: instrucoesBeneficiario
        ? instrucoesBeneficiario.split('\n').filter((m) => m.trim().length > 0)
        : null,
      numeroCarteira: numeroCarteira ? parseInt(numeroCarteira, 10) : 1,
      tipoRegistro: tipoRegistro ? parseInt(tipoRegistro, 10) : 1,
      recorrencia: null,
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-registrar-boleto', {
        body: {
          payload,
          idempotencyKey: novaIdempotencyKey(),
        },
      })
      const errMsg = extractError(data, error, 'Erro ao registrar o boleto.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setResultado(data)
        setFeedback({ ok: true, message: data?.mensagem || 'Boleto registrado com sucesso.' })
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-4">
      <Card title="Beneficiário" description="Conta BMP que registra o título (deixe em branco para usar a conta padrão da integração).">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Field label="Agência">
            <input className={inputCls} value={agencia} onChange={(e) => setAgencia(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Dígito agência">
            <input className={inputCls} value={agenciaDigito} onChange={(e) => setAgenciaDigito(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Conta">
            <input className={inputCls} value={conta} onChange={(e) => setConta(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Dígito conta">
            <input className={inputCls} value={contaDigito} onChange={(e) => setContaDigito(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Conta pagamento">
            <input className={inputCls} value={contaPgto} onChange={(e) => setContaPgto(e.target.value)} disabled={loading} />
          </Field>
        </div>
      </Card>

      <Card title="Dados do título">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Data de vencimento *">
            <input type="date" className={inputCls} value={dtVencimento} onChange={(e) => setDtVencimento(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Data limite p/ pagamento">
            <input type="date" className={inputCls} value={dtLimPgto} onChange={(e) => setDtLimPgto(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Data de emissão">
            <input type="date" className={inputCls} value={dtEmissao} onChange={(e) => setDtEmissao(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Valor do título *">
            <input className={inputCls} value={vlrTitulo} onChange={(e) => setVlrTitulo(e.target.value)} placeholder="0,00" disabled={loading} />
          </Field>
          <Field label="Valor de abatimento">
            <input className={inputCls} value={vlrAbatimento} onChange={(e) => setVlrAbatimento(e.target.value)} placeholder="0,00" disabled={loading} />
          </Field>
          <Field label="Número do documento">
            <input className={inputCls} value={numDocTit} onChange={(e) => setNumDocTit(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Nosso número">
            <input className={inputCls} value={identdNossoNum} onChange={(e) => setIdentdNossoNum(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Espécie do título">
            <input className={inputCls} value={codEspTit} onChange={(e) => setCodEspTit(e.target.value)} placeholder="2 = DM" disabled={loading} />
          </Field>
          <Field label="Carteira">
            <input className={inputCls} value={numeroCarteira} onChange={(e) => setNumeroCarteira(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Tipo de registro">
            <input className={inputCls} value={tipoRegistro} onChange={(e) => setTipoRegistro(e.target.value)} disabled={loading} />
          </Field>
        </div>
      </Card>

      <Card title="Pagador">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Tipo de pessoa">
            <select className={selectCls} value={tipoPessoa} onChange={(e) => setTipoPessoa(e.target.value)} disabled={loading}>
              <option value="1">Física</option>
              <option value="2">Jurídica</option>
            </select>
          </Field>
          <Field label="Documento (CPF/CNPJ) *">
            <input className={inputCls} value={documentoFederal} onChange={(e) => setDocumentoFederal(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Nome / Razão social *">
            <input className={inputCls} value={nomeRazao} onChange={(e) => setNomeRazao(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Nome fantasia">
            <input className={inputCls} value={nomeFantasia} onChange={(e) => setNomeFantasia(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Logradouro">
            <input className={inputCls} value={logradouro} onChange={(e) => setLogradouro(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Número">
            <input className={inputCls} value={numeroEndereco} onChange={(e) => setNumeroEndereco(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Complemento">
            <input className={inputCls} value={complemento} onChange={(e) => setComplemento(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Bairro">
            <input className={inputCls} value={bairro} onChange={(e) => setBairro(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Cidade">
            <input className={inputCls} value={cidade} onChange={(e) => setCidade(e.target.value)} disabled={loading} />
          </Field>
          <Field label="UF">
            <input className={inputCls} value={uf} onChange={(e) => setUf(e.target.value)} maxLength={2} disabled={loading} />
          </Field>
          <Field label="CEP">
            <input className={inputCls} value={cep} onChange={(e) => setCep(e.target.value)} disabled={loading} />
          </Field>
          <Field label="E-mail">
            <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Telefone">
            <input className={inputCls} value={telefone} onChange={(e) => setTelefone(e.target.value)} disabled={loading} />
          </Field>
        </div>
      </Card>

      <Card title="Instruções ao beneficiário" description="Uma instrução por linha (mensagens impressas no boleto).">
        <Field label="Instruções">
          <textarea
            className={textareaCls}
            rows={3}
            value={instrucoesBeneficiario}
            onChange={(e) => setInstrucoesBeneficiario(e.target.value)}
            disabled={loading}
          />
        </Field>
      </Card>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Feedback feedback={feedback} />
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? 'Registrando...' : 'Registrar Boleto'}
          </PrimaryButton>
        </form>

        {resultado && (
          <div className="mt-5 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="bg-[#111111] border border-[#2a2a2a] rounded-md p-3">
                <p className="text-[11px] text-[#a3a3a3] mb-1">Código do boleto</p>
                <p className="text-white text-sm font-medium break-all">{resultado.codigoBoleto ?? '—'}</p>
              </div>
              <div className="bg-[#111111] border border-[#2a2a2a] rounded-md p-3">
                <p className="text-[11px] text-[#a3a3a3] mb-1">Nosso número</p>
                <p className="text-white text-sm font-medium break-all">{resultado.identdNossoNum ?? '—'}</p>
              </div>
              <div className="bg-[#111111] border border-[#2a2a2a] rounded-md p-3">
                <p className="text-[11px] text-[#a3a3a3] mb-1">Número do documento</p>
                <p className="text-white text-sm font-medium break-all">{resultado.numDocTit ?? '—'}</p>
              </div>
              <div className="bg-[#111111] border border-[#2a2a2a] rounded-md p-3 col-span-2 md:col-span-3">
                <p className="text-[11px] text-[#a3a3a3] mb-1">Código de barras</p>
                <p className="text-white text-sm font-medium break-all">{resultado.numCodBarras ?? '—'}</p>
              </div>
              <div className="bg-[#111111] border border-[#2a2a2a] rounded-md p-3 col-span-2 md:col-span-3">
                <p className="text-[11px] text-[#a3a3a3] mb-1">Linha digitável</p>
                <p className="text-white text-sm font-medium break-all">{resultado.numLinhaDigtvl ?? '—'}</p>
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
