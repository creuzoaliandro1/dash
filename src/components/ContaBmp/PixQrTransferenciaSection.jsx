import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Field, Feedback, Card, PrimaryButton, inputCls, selectCls, textareaCls, extractError, formatMoeda } from './shared'

const novaIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'bmp-' + Date.now() + '-' + Math.random().toString(16).slice(2)
}

export function RawJson({ data }) {
  if (!data) return null
  return (
    <details className="mt-2 bg-[#111111] border border-[#2a2a2a] rounded-md p-2">
      <summary className="text-xs text-[#a3a3a3] cursor-pointer select-none">Resposta completa (JSON)</summary>
      <pre className="mt-2 text-[11px] text-[#d4d4d4] whitespace-pre-wrap break-all max-h-[420px] overflow-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  )
}

const TIPOS_CHAVE = [
  { value: 0, label: 'CPF' },
  { value: 1, label: 'CNPJ' },
  { value: 2, label: 'Telefone' },
  { value: 3, label: 'E-mail' },
  { value: 4, label: 'EVP (chave aleatória)' },
]

const TIPOS_CONTA = [
  { value: 1, label: 'Corrente' },
  { value: 2, label: 'Poupança' },
  { value: 3, label: 'Pagamento' },
  { value: 4, label: 'Salário' },
]

const TIPOS_PESSOA = [
  { value: 1, label: 'Física' },
  { value: 2, label: 'Jurídica' },
]

const MOTIVOS_DEVOLUCAO = [
  { value: 0, label: 'AM05' },
  { value: 1, label: 'AM09' },
  { value: 2, label: 'FR01' },
  { value: 3, label: 'SL02' },
  { value: 4, label: 'FOCR' },
  { value: 5, label: 'BE08' },
  { value: 6, label: 'MD06' },
  { value: 11, label: 'UPAY' },
]

const PRIORIDADES = [
  { value: 0, label: 'Urgente' },
  { value: 1, label: 'Normal' },
]

function QrImagemPreview({ imagem, emv }) {
  if (!imagem && !emv) return null
  return (
    <div className="mt-2 flex flex-col sm:flex-row gap-2 items-start">
      {imagem && (
        <img
          src={`data:image/png;base64,${imagem}`}
          alt="QR Code Pix"
          className="w-40 h-40 bg-white rounded-md border border-[#2a2a2a] object-contain"
        />
      )}
      {emv && (
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-medium text-[#a3a3a3] mb-1.5">Código EMV (copia e cola)</label>
          <textarea readOnly className={textareaCls} rows={4} value={emv} onClick={(e) => e.target.select()} />
        </div>
      )}
    </div>
  )
}

// ---------- QR Code Estático ----------
function QrEstaticoCard() {
  const [chave, setChave] = useState('')
  const [tipoChave, setTipoChave] = useState('4')
  const [valor, setValor] = useState('')
  const [informacoesAdicionais, setInformacoesAdicionais] = useState('')
  const [idConciliacaoRecebedor, setIdConciliacaoRecebedor] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resposta, setResposta] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResposta(null)
    if (!chave.trim()) {
      setFeedback({ ok: false, message: 'Informe a chave Pix.' })
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-pix-qrcode-estatico-criar', {
        body: {
          chave: chave.trim(),
          tipoChave: Number(tipoChave),
          valor: valor ? Number(valor) : undefined,
          informacoesAdicionais: informacoesAdicionais || undefined,
          idConciliacaoRecebedor: idConciliacaoRecebedor || undefined,
          idempotencyKey: novaIdempotencyKey(),
        },
      })
      const errMsg = extractError(data, error, 'Erro ao criar QR Code estático.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setResposta(data)
        setFeedback({ ok: true, message: data?.mensagem || 'QR Code estático gerado com sucesso.' })
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="Criar QR Code — Estático" description="Gera um QR Code Pix estático atrelado a uma chave, sem validade e sem alteração.">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <Field label="Chave Pix">
            <input className={inputCls} value={chave} onChange={(e) => setChave(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Tipo de chave">
            <select className={selectCls} value={tipoChave} onChange={(e) => setTipoChave(e.target.value)} disabled={loading}>
              {TIPOS_CHAVE.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Valor (opcional)">
            <input type="number" step="0.01" className={inputCls} value={valor} onChange={(e) => setValor(e.target.value)} disabled={loading} />
          </Field>
          <Field label="TXID / conciliação (opcional)">
            <input className={inputCls} value={idConciliacaoRecebedor} onChange={(e) => setIdConciliacaoRecebedor(e.target.value)} disabled={loading} />
          </Field>
        </div>
        <Field label="Informações adicionais (opcional)">
          <input className={inputCls} value={informacoesAdicionais} onChange={(e) => setInformacoesAdicionais(e.target.value)} disabled={loading} placeholder="Apenas letras, números e espaços" />
        </Field>
        <Feedback feedback={feedback} />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Gerando...' : 'Gerar QR Code estático'}
        </PrimaryButton>
      </form>

      <QrImagemPreview imagem={resposta?.imagem} emv={resposta?.emv} />
      <RawJson data={resposta?.raw} />
    </Card>
  )
}

// ---------- QR Code Dinâmico (pagamento imediato) ----------
function QrDinamicoCard() {
  const [chave, setChave] = useState('')
  const [tipoChave, setTipoChave] = useState('4')
  const [taxId, setTaxId] = useState('')
  const [valor, setValor] = useState('')
  const [nomeDevedor, setNomeDevedor] = useState('')
  const [documentoDevedor, setDocumentoDevedor] = useState('')
  const [tipoPessoaDevedor, setTipoPessoaDevedor] = useState('1')
  const [solicitacaoPagador, setSolicitacaoPagador] = useState('')
  const [expiracao, setExpiracao] = useState('3600')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resposta, setResposta] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResposta(null)
    if (!chave.trim()) {
      setFeedback({ ok: false, message: 'Informe a chave Pix.' })
      return
    }
    if (!taxId.trim()) {
      setFeedback({ ok: false, message: 'Informe o TXID (identificação da transação).' })
      return
    }
    if (!valor) {
      setFeedback({ ok: false, message: 'Informe o valor.' })
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-pix-qrcode-dinamico-criar', {
        body: {
          qrCode: {
            chave: chave.trim(),
            tipoChave: Number(tipoChave),
            taxId: taxId.trim(),
            valor: Number(valor),
            devedor: nomeDevedor || documentoDevedor
              ? { nome: nomeDevedor || undefined, documentoFederal: documentoDevedor || undefined, tipoPessoa: Number(tipoPessoaDevedor) }
              : undefined,
            solicitacaoPagador: solicitacaoPagador || undefined,
            permiteAlteracao: false,
            expiracao: expiracao ? Number(expiracao) : undefined,
          },
          idempotencyKey: novaIdempotencyKey(),
        },
      })
      const errMsg = extractError(data, error, 'Erro ao criar QR Code dinâmico.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setResposta(data)
        setFeedback({ ok: true, message: data?.mensagem || 'QR Code dinâmico gerado com sucesso.' })
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="Criar QR Code — Dinâmico (pagamento imediato)" description="Gera um QR Code Pix dinâmico com tempo de vida útil, expirando após pagamento ou na data/hora configurada.">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <Field label="Chave Pix">
            <input className={inputCls} value={chave} onChange={(e) => setChave(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Tipo de chave">
            <select className={selectCls} value={tipoChave} onChange={(e) => setTipoChave(e.target.value)} disabled={loading}>
              {TIPOS_CHAVE.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
          <Field label="TXID">
            <input className={inputCls} value={taxId} onChange={(e) => setTaxId(e.target.value)} disabled={loading} placeholder="Somente letras e números" />
          </Field>
          <Field label="Valor">
            <input type="number" step="0.01" className={inputCls} value={valor} onChange={(e) => setValor(e.target.value)} disabled={loading} />
          </Field>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <Field label="Nome do devedor (opcional)">
            <input className={inputCls} value={nomeDevedor} onChange={(e) => setNomeDevedor(e.target.value)} disabled={loading} />
          </Field>
          <Field label="CPF/CNPJ do devedor (opcional)">
            <input className={inputCls} value={documentoDevedor} onChange={(e) => setDocumentoDevedor(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Tipo de pessoa">
            <select className={selectCls} value={tipoPessoaDevedor} onChange={(e) => setTipoPessoaDevedor(e.target.value)} disabled={loading}>
              {TIPOS_PESSOA.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Expiração (segundos, 1–86400)">
            <input type="number" className={inputCls} value={expiracao} onChange={(e) => setExpiracao(e.target.value)} disabled={loading} />
          </Field>
        </div>
        <Field label="Solicitação ao pagador (opcional)">
          <input className={inputCls} value={solicitacaoPagador} onChange={(e) => setSolicitacaoPagador(e.target.value)} disabled={loading} />
        </Field>
        <Feedback feedback={feedback} />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Gerando...' : 'Gerar QR Code dinâmico'}
        </PrimaryButton>
      </form>

      <QrImagemPreview imagem={resposta?.qrCode?.imagem} emv={resposta?.qrCode?.emv} />
      <RawJson data={resposta?.raw} />
    </Card>
  )
}

// ---------- QR Code de Cobrança ----------
function QrCobrancaCard() {
  const [chave, setChave] = useState('')
  const [tipoChave, setTipoChave] = useState('4')
  const [taxId, setTaxId] = useState('')
  const [valor, setValor] = useState('')
  const [nomeDevedor, setNomeDevedor] = useState('')
  const [documentoDevedor, setDocumentoDevedor] = useState('')
  const [tipoPessoaDevedor, setTipoPessoaDevedor] = useState('1')
  const [dataVencimento, setDataVencimento] = useState('')
  const [dataExpiracao, setDataExpiracao] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resposta, setResposta] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResposta(null)
    if (!chave.trim()) {
      setFeedback({ ok: false, message: 'Informe a chave Pix.' })
      return
    }
    if (!taxId.trim()) {
      setFeedback({ ok: false, message: 'Informe o TXID (identificação da transação).' })
      return
    }
    if (!valor) {
      setFeedback({ ok: false, message: 'Informe o valor.' })
      return
    }
    if (!dataVencimento) {
      setFeedback({ ok: false, message: 'Informe a data de vencimento.' })
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-pix-qrcode-cobranca', {
        body: {
          qrCode: {
            chave: chave.trim(),
            tipoChave: Number(tipoChave),
            taxId: taxId.trim(),
            valor: Number(valor),
            devedor: nomeDevedor || documentoDevedor
              ? { nome: nomeDevedor || undefined, documentoFederal: documentoDevedor || undefined, tipoPessoa: Number(tipoPessoaDevedor) }
              : undefined,
            dataVencimento: new Date(dataVencimento).toISOString(),
            dataExpiracao: dataExpiracao ? new Date(dataExpiracao).toISOString() : undefined,
          },
          idempotencyKey: novaIdempotencyKey(),
        },
      })
      const errMsg = extractError(data, error, 'Erro ao criar QR Code de cobrança.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setResposta(data)
        setFeedback({ ok: true, message: data?.mensagem || 'QR Code de cobrança gerado com sucesso.' })
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="QR Code — Cobrança" description="Gera um QR Code único de cobrança, descartado após a validade cadastrada, com juros/multa/desconto conforme parametrização.">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <Field label="Chave Pix">
            <input className={inputCls} value={chave} onChange={(e) => setChave(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Tipo de chave">
            <select className={selectCls} value={tipoChave} onChange={(e) => setTipoChave(e.target.value)} disabled={loading}>
              {TIPOS_CHAVE.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
          <Field label="TXID">
            <input className={inputCls} value={taxId} onChange={(e) => setTaxId(e.target.value)} disabled={loading} placeholder="Somente letras e números" />
          </Field>
          <Field label="Valor">
            <input type="number" step="0.01" className={inputCls} value={valor} onChange={(e) => setValor(e.target.value)} disabled={loading} />
          </Field>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <Field label="Nome do devedor (opcional)">
            <input className={inputCls} value={nomeDevedor} onChange={(e) => setNomeDevedor(e.target.value)} disabled={loading} />
          </Field>
          <Field label="CPF/CNPJ do devedor (opcional)">
            <input className={inputCls} value={documentoDevedor} onChange={(e) => setDocumentoDevedor(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Tipo de pessoa">
            <select className={selectCls} value={tipoPessoaDevedor} onChange={(e) => setTipoPessoaDevedor(e.target.value)} disabled={loading}>
              {TIPOS_PESSOA.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Data de vencimento">
            <input type="date" className={inputCls} value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} disabled={loading} />
          </Field>
        </div>
        <Field label="Data de expiração (opcional)">
          <input type="date" className={inputCls} value={dataExpiracao} onChange={(e) => setDataExpiracao(e.target.value)} disabled={loading} />
        </Field>
        <Feedback feedback={feedback} />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Gerando...' : 'Gerar QR Code de cobrança'}
        </PrimaryButton>
      </form>

      <QrImagemPreview imagem={resposta?.qrCode?.imagem} emv={resposta?.qrCode?.emv} />
      <RawJson data={resposta?.raw} />
    </Card>
  )
}

// ---------- Transferir Recurso (Pix) — movimentação de débito, HMAC real em produção ----------
function TransferirRecursoCard() {
  const [modoEnvio, setModoEnvio] = useState('chave') // 'chave' | 'conta' | 'qrcode'
  const [chaveDestino, setChaveDestino] = useState('')
  const [tipoChaveDestino, setTipoChaveDestino] = useState('4')
  const [ticket, setTicket] = useState('')
  const [contaDestinoAgencia, setContaDestinoAgencia] = useState('')
  const [contaDestinoConta, setContaDestinoConta] = useState('')
  const [contaDestinoTipo, setContaDestinoTipo] = useState('1')
  const [ispbDestino, setIspbDestino] = useState('')
  const [nomeDestino, setNomeDestino] = useState('')
  const [documentoDestino, setDocumentoDestino] = useState('')
  const [codigoLeituraQRCode, setCodigoLeituraQRCode] = useState('')
  const [tpQRCode, setTpQRCode] = useState('1')
  const [valor, setValor] = useState('')
  const [codigoOperacaoCliente, setCodigoOperacaoCliente] = useState('')
  const [descricaoCliente, setDescricaoCliente] = useState('')
  const [prioridade, setPrioridade] = useState('1')
  const [contaOrigemAgencia, setContaOrigemAgencia] = useState('')
  const [contaOrigemConta, setContaOrigemConta] = useState('')
  const [contaOrigemTipo, setContaOrigemTipo] = useState('1')
  const [informacoesAdicionais, setInformacoesAdicionais] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resposta, setResposta] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResposta(null)

    if (!valor) {
      setFeedback({ ok: false, message: 'Informe o valor da transferência.' })
      return
    }
    if (!contaOrigemAgencia || !contaOrigemConta) {
      setFeedback({ ok: false, message: 'Informe agência e conta de origem.' })
      return
    }
    if (modoEnvio === 'chave' && (!chaveDestino.trim() || !ticket.trim())) {
      setFeedback({ ok: false, message: 'Para transferência por chave, informe chave e ticket (obtidos em /api/Chave/Consultar).' })
      return
    }
    if (modoEnvio === 'conta' && (!contaDestinoConta.trim() || !documentoDestino.trim() || !nomeDestino.trim())) {
      setFeedback({ ok: false, message: 'Para transferência por dados bancários, informe conta destino, nome e documento federal do beneficiário.' })
      return
    }
    if (modoEnvio === 'qrcode' && !codigoLeituraQRCode.trim()) {
      setFeedback({ ok: false, message: 'Para transferência por QR Code, informe o código de leitura (obtido em Ler QR Code).' })
      return
    }

    const confirmado = window.confirm(`Confirma a transferência Pix de ${formatMoeda(Number(valor))}? Esta é uma operação de débito irreversível.`)
    if (!confirmado) return

    setLoading(true)
    try {
      const body = {
        valor: Number(valor),
        codigoOperacaoCliente: codigoOperacaoCliente || undefined,
        descricaoCliente: descricaoCliente || undefined,
        prioridade: Number(prioridade),
        contaOrigem: {
          agencia: contaOrigemAgencia,
          conta: contaOrigemConta,
          tipoConta: Number(contaOrigemTipo),
        },
        informacoesAdicionais: informacoesAdicionais || undefined,
        idempotencyKey: novaIdempotencyKey(),
      }
      if (modoEnvio === 'chave') {
        body.dadosEnvioPorChave = { ticket: ticket.trim(), chave: chaveDestino.trim(), tipoChave: Number(tipoChaveDestino) }
      } else if (modoEnvio === 'conta') {
        body.dadosEnvioPorConta = {
          contaDestino: { agencia: contaDestinoAgencia, conta: contaDestinoConta, tipoConta: Number(contaDestinoTipo) },
          ispbDestino: ispbDestino || undefined,
          nomeDestino: nomeDestino.trim(),
          documentoFederalDestino: documentoDestino.trim(),
        }
      } else if (modoEnvio === 'qrcode') {
        body.codigoLeituraQRCode = codigoLeituraQRCode.trim()
        body.tpQRCode = Number(tpQRCode)
      }

      const { data, error } = await supabase.functions.invoke('bmp-pix-transferir', { body })
      const errMsg = extractError(data, error, 'Erro ao transferir recurso Pix.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setResposta(data)
        setFeedback({
          ok: true,
          message:
            (data?.mensagem || 'Transferência enviada com sucesso.') +
            (data?.handshakeRealizado ? ' (handshake HMAC real utilizado)' : ' (atenção: enviado com IgnoraHandshake — válido apenas em homologação)'),
        })
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="Transferir Recurso (Pix)" description="Efetua transferência de valores via chave Pix, dados bancários ou QR Code lido. Operação de débito — handshake HMAC real é obrigatório em produção.">
      <form onSubmit={handleSubmit} className="space-y-2">
        <Field label="Modo de envio">
          <select className={selectCls} value={modoEnvio} onChange={(e) => setModoEnvio(e.target.value)} disabled={loading}>
            <option value="chave">Chave Pix</option>
            <option value="conta">Dados bancários</option>
            <option value="qrcode">QR Code lido</option>
          </select>
        </Field>

        {modoEnvio === 'chave' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Field label="Chave destino">
              <input className={inputCls} value={chaveDestino} onChange={(e) => setChaveDestino(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Tipo de chave">
              <select className={selectCls} value={tipoChaveDestino} onChange={(e) => setTipoChaveDestino(e.target.value)} disabled={loading}>
                {TIPOS_CHAVE.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Ticket (de /api/Chave/Consultar)">
              <input className={inputCls} value={ticket} onChange={(e) => setTicket(e.target.value)} disabled={loading} />
            </Field>
          </div>
        )}

        {modoEnvio === 'conta' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Field label="Agência destino">
              <input className={inputCls} value={contaDestinoAgencia} onChange={(e) => setContaDestinoAgencia(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Conta destino">
              <input className={inputCls} value={contaDestinoConta} onChange={(e) => setContaDestinoConta(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Tipo de conta">
              <select className={selectCls} value={contaDestinoTipo} onChange={(e) => setContaDestinoTipo(e.target.value)} disabled={loading}>
                {TIPOS_CONTA.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </Field>
            <Field label="ISPB destino">
              <input className={inputCls} value={ispbDestino} onChange={(e) => setIspbDestino(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Nome do beneficiário">
              <input className={inputCls} value={nomeDestino} onChange={(e) => setNomeDestino(e.target.value)} disabled={loading} />
            </Field>
            <Field label="CPF/CNPJ do beneficiário">
              <input className={inputCls} value={documentoDestino} onChange={(e) => setDocumentoDestino(e.target.value)} disabled={loading} />
            </Field>
          </div>
        )}

        {modoEnvio === 'qrcode' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Field label="Código de leitura do QR Code (UUID)">
              <input className={inputCls} value={codigoLeituraQRCode} onChange={(e) => setCodigoLeituraQRCode(e.target.value)} disabled={loading} />
            </Field>
            <Field label="Tipo de QR Code">
              <select className={selectCls} value={tpQRCode} onChange={(e) => setTpQRCode(e.target.value)} disabled={loading}>
                <option value="1">Estático</option>
                <option value="2">Dinâmico</option>
                <option value="3">Composto</option>
              </select>
            </Field>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <Field label="Valor">
            <input type="number" step="0.01" className={inputCls} value={valor} onChange={(e) => setValor(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Prioridade">
            <select className={selectCls} value={prioridade} onChange={(e) => setPrioridade(e.target.value)} disabled={loading}>
              {PRIORIDADES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Código operação cliente (opcional)">
            <input className={inputCls} value={codigoOperacaoCliente} onChange={(e) => setCodigoOperacaoCliente(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Descrição (opcional)">
            <input className={inputCls} value={descricaoCliente} onChange={(e) => setDescricaoCliente(e.target.value)} disabled={loading} />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Field label="Agência origem">
            <input className={inputCls} value={contaOrigemAgencia} onChange={(e) => setContaOrigemAgencia(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Conta origem">
            <input className={inputCls} value={contaOrigemConta} onChange={(e) => setContaOrigemConta(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Tipo de conta origem">
            <select className={selectCls} value={contaOrigemTipo} onChange={(e) => setContaOrigemTipo(e.target.value)} disabled={loading}>
              {TIPOS_CONTA.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Informações adicionais (opcional)">
          <input className={inputCls} value={informacoesAdicionais} onChange={(e) => setInformacoesAdicionais(e.target.value)} disabled={loading} />
        </Field>

        <Feedback feedback={feedback} />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Transferindo...' : 'Transferir recurso'}
        </PrimaryButton>
      </form>

      <RawJson data={resposta?.raw} />
    </Card>
  )
}

// ---------- Devolver Recurso (Pix) — movimentação de débito, HMAC real em produção ----------
function DevolverRecursoCard() {
  const [codigoMovimento, setCodigoMovimento] = useState('')
  const [valor, setValor] = useState('')
  const [motivoDevolucaoPix, setMotivoDevolucaoPix] = useState('0')
  const [prioridadePix, setPrioridadePix] = useState('1')
  const [informacoesAdicionais, setInformacoesAdicionais] = useState('')
  const [contaOrigemAgencia, setContaOrigemAgencia] = useState('')
  const [contaOrigemConta, setContaOrigemConta] = useState('')
  const [contaOrigemTipo, setContaOrigemTipo] = useState('1')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resposta, setResposta] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResposta(null)
    if (!codigoMovimento.trim()) {
      setFeedback({ ok: false, message: 'Informe o código de movimento (do callback do recebimento Pix).' })
      return
    }
    if (!valor) {
      setFeedback({ ok: false, message: 'Informe o valor da devolução.' })
      return
    }

    const confirmado = window.confirm(`Confirma a devolução de ${formatMoeda(Number(valor))} via Pix? Esta é uma operação de débito irreversível.`)
    if (!confirmado) return

    setLoading(true)
    try {
      const body = {
        codigoMovimento: codigoMovimento.trim(),
        valor: Number(valor),
        motivoDevolucaoPix: Number(motivoDevolucaoPix),
        prioridadePix: Number(prioridadePix),
        informacoesAdicionais: informacoesAdicionais || undefined,
        idempotencyKey: novaIdempotencyKey(),
      }
      if (contaOrigemAgencia || contaOrigemConta) {
        body.contaOrigem = { agencia: contaOrigemAgencia, conta: contaOrigemConta, tipoConta: Number(contaOrigemTipo) }
      }

      const { data, error } = await supabase.functions.invoke('bmp-pix-devolver', { body })
      const errMsg = extractError(data, error, 'Erro ao devolver recurso Pix.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setResposta(data)
        setFeedback({
          ok: true,
          message:
            (data?.mensagem || 'Devolução enviada com sucesso.') +
            (data?.handshakeRealizado ? ' (handshake HMAC real utilizado)' : ' (atenção: enviado com IgnoraHandshake — válido apenas em homologação)'),
        })
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="Devolver Recurso (Pix)" description="Devolve um Pix recebido para a conta de origem. Requer o código de movimento localizado no callback do recebimento. Operação de débito — handshake HMAC real é obrigatório em produção.">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Field label="Código de movimento (UUID)">
            <input className={inputCls} value={codigoMovimento} onChange={(e) => setCodigoMovimento(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Valor">
            <input type="number" step="0.01" className={inputCls} value={valor} onChange={(e) => setValor(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Motivo da devolução">
            <select className={selectCls} value={motivoDevolucaoPix} onChange={(e) => setMotivoDevolucaoPix(e.target.value)} disabled={loading}>
              {MOTIVOS_DEVOLUCAO.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <Field label="Prioridade">
            <select className={selectCls} value={prioridadePix} onChange={(e) => setPrioridadePix(e.target.value)} disabled={loading}>
              {PRIORIDADES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Agência origem (opcional)">
            <input className={inputCls} value={contaOrigemAgencia} onChange={(e) => setContaOrigemAgencia(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Conta origem (opcional)">
            <input className={inputCls} value={contaOrigemConta} onChange={(e) => setContaOrigemConta(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Tipo de conta origem">
            <select className={selectCls} value={contaOrigemTipo} onChange={(e) => setContaOrigemTipo(e.target.value)} disabled={loading}>
              {TIPOS_CONTA.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Informações adicionais (opcional)">
          <input className={inputCls} value={informacoesAdicionais} onChange={(e) => setInformacoesAdicionais(e.target.value)} disabled={loading} />
        </Field>
        <Feedback feedback={feedback} />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Devolvendo...' : 'Devolver recurso'}
        </PrimaryButton>
      </form>

      <RawJson data={resposta?.raw} />
    </Card>
  )
}

// ---------- Status de Transferência ----------
function StatusTransferenciaCard() {
  const [codigoTransacao, setCodigoTransacao] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resposta, setResposta] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResposta(null)
    if (!codigoTransacao.trim()) {
      setFeedback({ ok: false, message: 'Informe o código de transação (UUID).' })
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-pix-transferencia-status', {
        body: { codigoTransacao: codigoTransacao.trim() },
      })
      const errMsg = extractError(data, error, 'Erro ao consultar status de transferência.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setResposta(data)
        setFeedback({ ok: true, message: data?.mensagem || 'Consulta realizada com sucesso.' })
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  const situacaoLabel = (v) => (v === 1 ? 'Processando' : v === 2 ? 'Concluído' : v ?? '—')

  return (
    <Card title="Status de Transferência" description="Consulta o status de uma transferência Pix já solicitada, a partir do código de transação.">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Field label="Código de transação (UUID)">
            <input className={inputCls} value={codigoTransacao} onChange={(e) => setCodigoTransacao(e.target.value)} disabled={loading} />
          </Field>
        </div>
        <Feedback feedback={feedback} />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Consultando...' : 'Consultar status'}
        </PrimaryButton>
      </form>

      {resposta && (
        <div className="mt-2 overflow-x-auto border border-[#2a2a2a] rounded-md w-full">
          <table className="w-full text-xs">
            <tbody>
              <tr className="border-t border-[#1a1a1a]"><td className="px-3 py-2 text-[#666666]">Código de transação</td><td className="px-3 py-2 text-[#d4d4d4] break-all">{resposta.codigoTransacao ?? '—'}</td></tr>
              <tr className="border-t border-[#1a1a1a]"><td className="px-3 py-2 text-[#666666]">Situação</td><td className="px-3 py-2 text-[#d4d4d4]">{situacaoLabel(resposta.situacaoPix)}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      <RawJson data={resposta?.raw} />
    </Card>
  )
}

// ---------- Consultar Devolução de Recurso ----------
function ConsultarDevolucaoCard() {
  const [codigoTransacao, setCodigoTransacao] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resposta, setResposta] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResposta(null)
    if (!codigoTransacao.trim()) {
      setFeedback({ ok: false, message: 'Informe o código de transação (UUID) da devolução.' })
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-pix-devolucao-consultar', {
        body: { codigoTransacao: codigoTransacao.trim() },
      })
      const errMsg = extractError(data, error, 'Erro ao consultar status de devolução.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setResposta(data)
        setFeedback({ ok: true, message: data?.mensagem || 'Consulta realizada com sucesso.' })
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  const situacaoLabel = (v) => (v === 1 ? 'Processando' : v === 2 ? 'Concluído' : v ?? '—')

  return (
    <Card title="Consultar Devolução de Recurso" description="Verifica o status de uma devolução Pix já solicitada, a partir do código de transação.">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Field label="Código de transação (UUID)">
            <input className={inputCls} value={codigoTransacao} onChange={(e) => setCodigoTransacao(e.target.value)} disabled={loading} />
          </Field>
        </div>
        <Feedback feedback={feedback} />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Consultando...' : 'Consultar status'}
        </PrimaryButton>
      </form>

      {resposta && (
        <div className="mt-2 overflow-x-auto border border-[#2a2a2a] rounded-md w-full">
          <table className="w-full text-xs">
            <tbody>
              <tr className="border-t border-[#1a1a1a]"><td className="px-3 py-2 text-[#666666]">Código de transação</td><td className="px-3 py-2 text-[#d4d4d4] break-all">{resposta.codigoTransacao ?? '—'}</td></tr>
              <tr className="border-t border-[#1a1a1a]"><td className="px-3 py-2 text-[#666666]">Situação</td><td className="px-3 py-2 text-[#d4d4d4]">{situacaoLabel(resposta.situacaoPix)}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      <RawJson data={resposta?.raw} />
    </Card>
  )
}

// ---------- Ler QR Code ----------
function LerQrCodeCard() {
  const [emv, setEmv] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resposta, setResposta] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResposta(null)
    if (!emv.trim()) {
      setFeedback({ ok: false, message: 'Cole o código EMV do QR Code.' })
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-pix-qrcode-ler', {
        body: { emv: emv.trim() },
      })
      const errMsg = extractError(data, error, 'Erro ao ler QR Code.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setResposta(data)
        setFeedback({ ok: true, message: data?.mensagem || 'QR Code lido com sucesso.' })
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  const leitura = resposta?.raw

  return (
    <Card title="Ler QR Code" description="Realiza a leitura de um QR Code de pagamento Pix a partir do código EMV.">
      <form onSubmit={handleSubmit} className="space-y-2">
        <Field label="Código EMV">
          <textarea className={textareaCls} rows={3} value={emv} onChange={(e) => setEmv(e.target.value)} disabled={loading} />
        </Field>
        <Feedback feedback={feedback} />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Lendo...' : 'Ler QR Code'}
        </PrimaryButton>
      </form>

      {leitura && (
        <div className="mt-2 overflow-x-auto border border-[#2a2a2a] rounded-md w-full">
          <table className="w-full text-xs">
            <tbody>
              <tr className="border-t border-[#1a1a1a]"><td className="px-3 py-2 text-[#666666]">Chave</td><td className="px-3 py-2 text-[#d4d4d4]">{leitura.chave ?? '—'}</td></tr>
              <tr className="border-t border-[#1a1a1a]"><td className="px-3 py-2 text-[#666666]">Nome recebedor</td><td className="px-3 py-2 text-[#d4d4d4]">{leitura.nome ?? '—'}</td></tr>
              <tr className="border-t border-[#1a1a1a]"><td className="px-3 py-2 text-[#666666]">Cidade</td><td className="px-3 py-2 text-[#d4d4d4]">{leitura.cidade ?? '—'}</td></tr>
              <tr className="border-t border-[#1a1a1a]"><td className="px-3 py-2 text-[#666666]">Valor</td><td className="px-3 py-2 text-[#d4d4d4]">{leitura.valor != null ? formatMoeda(leitura.valor) : '—'}</td></tr>
              <tr className="border-t border-[#1a1a1a]"><td className="px-3 py-2 text-[#666666]">Reutilizável</td><td className="px-3 py-2 text-[#d4d4d4]">{leitura.reutilizavel != null ? (leitura.reutilizavel ? 'Sim' : 'Não') : '—'}</td></tr>
              <tr className="border-t border-[#1a1a1a]"><td className="px-3 py-2 text-[#666666]">Código de leitura (UUID)</td><td className="px-3 py-2 text-[#d4d4d4] break-all">{leitura.codigoLeituraQRCode ?? '—'}</td></tr>
              <tr className="border-t border-[#1a1a1a]"><td className="px-3 py-2 text-[#666666]">Tipo QR Code</td><td className="px-3 py-2 text-[#d4d4d4]">{leitura.tipoQRCode ?? leitura.tpQRCode ?? '—'}</td></tr>
              <tr className="border-t border-[#1a1a1a]"><td className="px-3 py-2 text-[#666666]">Documento federal</td><td className="px-3 py-2 text-[#d4d4d4]">{leitura.documentoFederal ?? '—'}</td></tr>
              <tr className="border-t border-[#1a1a1a]"><td className="px-3 py-2 text-[#666666]">Informações adicionais</td><td className="px-3 py-2 text-[#d4d4d4]">{leitura.informacoesAdicionais ?? '—'}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      <RawJson data={resposta?.raw} />
    </Card>
  )
}

// ---------- Consultar QR Code em Boleto Híbrido ----------
function ConsultarQrHibridoCard() {
  const [codigoBoleto, setCodigoBoleto] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resposta, setResposta] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResposta(null)
    if (!codigoBoleto.trim()) {
      setFeedback({ ok: false, message: 'Informe o código (UUID) do boleto.' })
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-pix-qrcode-consultar-hibrido', {
        body: { codigoBoleto: codigoBoleto.trim() },
      })
      const errMsg = extractError(data, error, 'Erro ao consultar QR Code em boleto híbrido.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setResposta(data)
        setFeedback({ ok: true, message: 'Consulta realizada com sucesso.' })
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  const info = resposta?.raw

  return (
    <Card title="Consultar QR Code em Boleto Híbrido" description="Consulta o QR Code Pix já disponibilizado em um boleto híbrido (pagável por código de barras ou Pix).">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Field label="Código do boleto (UUID)">
            <input className={inputCls} value={codigoBoleto} onChange={(e) => setCodigoBoleto(e.target.value)} disabled={loading} />
          </Field>
        </div>
        <Feedback feedback={feedback} />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Consultando...' : 'Consultar'}
        </PrimaryButton>
      </form>

      {info && (
        <QrImagemPreview imagem={info.imagem} emv={info.emv} />
      )}

      {info && (
        <div className="mt-2 overflow-x-auto border border-[#2a2a2a] rounded-md w-full">
          <table className="w-full text-xs">
            <tbody>
              <tr className="border-t border-[#1a1a1a]"><td className="px-3 py-2 text-[#666666]">TXID</td><td className="px-3 py-2 text-[#d4d4d4]">{info.txId ?? '—'}</td></tr>
              <tr className="border-t border-[#1a1a1a]"><td className="px-3 py-2 text-[#666666]">Chave</td><td className="px-3 py-2 text-[#d4d4d4]">{info.chave ?? '—'}</td></tr>
              <tr className="border-t border-[#1a1a1a]"><td className="px-3 py-2 text-[#666666]">Valor</td><td className="px-3 py-2 text-[#d4d4d4]">{info.valor != null ? formatMoeda(info.valor) : '—'}</td></tr>
              <tr className="border-t border-[#1a1a1a]"><td className="px-3 py-2 text-[#666666]">Vencimento</td><td className="px-3 py-2 text-[#d4d4d4]">{info.dtVencimento ?? '—'}</td></tr>
              <tr className="border-t border-[#1a1a1a]"><td className="px-3 py-2 text-[#666666]">Recebedor</td><td className="px-3 py-2 text-[#d4d4d4]">{info.nomeRecebedor ?? '—'}</td></tr>
              <tr className="border-t border-[#1a1a1a]"><td className="px-3 py-2 text-[#666666]">Devedor</td><td className="px-3 py-2 text-[#d4d4d4]">{info.nomeDevedor ?? '—'}</td></tr>
              <tr className="border-t border-[#1a1a1a]"><td className="px-3 py-2 text-[#666666]">Situação</td><td className="px-3 py-2 text-[#d4d4d4]">{info.situacao ?? '—'}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      <RawJson data={resposta?.raw} />
    </Card>
  )
}

export default function PixQrTransferenciaSection() {
  return (
    <div className="space-y-3 w-full">
      <QrEstaticoCard />
      <QrDinamicoCard />
      <QrCobrancaCard />
      <LerQrCodeCard />
      <ConsultarQrHibridoCard />
      <TransferirRecursoCard />
      <DevolverRecursoCard />
      <StatusTransferenciaCard />
      <ConsultarDevolucaoCard />
    </div>
  )
}
