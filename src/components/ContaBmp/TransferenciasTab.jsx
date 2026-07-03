import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Field, Feedback, Card, PrimaryButton, SecondaryButton, inputCls, selectCls, extractError, formatMoeda, formatDataHora } from './shared'

const novaIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'bmp-' + Date.now() + '-' + Math.random().toString(16).slice(2)
}

const TIPO_CONTA_OPTS = [
  { value: '1', label: '1 - Corrente' },
  { value: '2', label: '2 - Poupança' },
  { value: '3', label: '3 - Pagamento' },
  { value: '4', label: '4 - Salário' },
]

const MODELO_CONTA_OPTS = [
  { value: '1', label: '1 - Movimento' },
  { value: '2', label: '2 - Escrow' },
  { value: '3', label: '3 - Vinculada' },
]

const TIPO_PROCESSAMENTO_OPTS = [
  { value: '1', label: '1 - PAG' },
  { value: '2', label: '2 - STR' },
  { value: '7', label: '7 - STR007' },
]

const SITUACAO_LABELS = {
  10: 'Validar', 11: 'Validando', 12: 'Validado',
  21: 'Verificando Aprovação', 22: 'Em Aprovação', 23: 'Aprovado', 24: 'Reprovado',
  31: 'Verificando Agendamento', 32: 'Agendado', 33: 'Executar', 34: 'Cancelado',
  35: 'Registrado Agendamento Recorrente Pix', 41: 'Executando', 42: 'Executado',
  50: 'Reprocessar', 51: 'Reprocessar Validação',
}

function RawJson({ data }) {
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

// ---------- 30 - Consultar lançamentos futuros ----------
function ConsultarLancamentoFuturoCard() {
  const [agencia, setAgencia] = useState('')
  const [conta, setConta] = useState('')
  const [contaDigito, setContaDigito] = useState('')
  const [bancoNumero, setBancoNumero] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [apenasPendentes, setApenasPendentes] = useState(false)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resposta, setResposta] = useState(null)
  const [linhas, setLinhas] = useState([])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResposta(null)
    setLinhas([])

    if (!dataInicio && !dataFim) {
      setFeedback({ ok: false, message: 'Informe ao menos a data inicial ou a data final.' })
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-transferencia-consultar-lancamento-futuro', {
        body: {
          bancoNumero: bancoNumero || undefined,
          agencia: agencia || undefined,
          conta: conta || undefined,
          contaDigito: contaDigito || undefined,
          listarApenasAgendamentosPendentes: apenasPendentes,
          dataInicioAgendamento: dataInicio ? new Date(dataInicio).toISOString() : undefined,
          dataFimAgendamento: dataFim ? new Date(dataFim).toISOString() : undefined,
        },
      })
      const errMsg = extractError(data, error, 'Erro ao consultar lançamentos futuros.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setResposta(data)
        const lista = Array.isArray(data?.lancamentos) ? data.lancamentos : []
        setLinhas(lista)
        if (lista.length === 0) {
          setFeedback({ ok: true, message: 'Nenhum lançamento futuro encontrado para os filtros informados.' })
        }
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="Consultar lançamentos futuros" description="Consulta agendamentos de lançamentos futuros de transferência/pagamento para uma conta bancária.">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Field label="Número do banco">
            <input className={inputCls} value={bancoNumero} onChange={(e) => setBancoNumero(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Agência">
            <input className={inputCls} value={agencia} onChange={(e) => setAgencia(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Conta">
            <input className={inputCls} value={conta} onChange={(e) => setConta(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Dígito da conta">
            <input className={inputCls} value={contaDigito} onChange={(e) => setContaDigito(e.target.value)} disabled={loading} />
          </Field>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Field label="Data inicial">
            <input type="date" className={inputCls} value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Data final">
            <input type="date" className={inputCls} value={dataFim} onChange={(e) => setDataFim(e.target.value)} disabled={loading} />
          </Field>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-xs text-[#a3a3a3]">
              <input type="checkbox" checked={apenasPendentes} onChange={(e) => setApenasPendentes(e.target.checked)} disabled={loading} />
              Apenas agendamentos pendentes
            </label>
          </div>
        </div>

        <Feedback feedback={feedback} />

        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Consultando...' : 'Consultar'}
        </PrimaryButton>
      </form>

      {linhas.length > 0 && (
        <div className="mt-2 overflow-x-auto border border-[#2a2a2a] rounded-md w-full">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#141414] text-[#666666] uppercase tracking-wider">
                <th className="text-left px-3 py-2">Código</th>
                <th className="text-left px-3 py-2">Nome</th>
                <th className="text-left px-3 py-2">Documento</th>
                <th className="text-left px-3 py-2">Valor</th>
                <th className="text-left px-3 py-2">Data agendamento</th>
                <th className="text-left px-3 py-2">Situação</th>
                <th className="text-left px-3 py-2">Banco destino</th>
                <th className="text-left px-3 py-2">Conta destino</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((item, i) => (
                <tr key={item?.codigo ?? i} className="border-t border-[#1a1a1a] text-[#d4d4d4]">
                  <td className="px-3 py-2 break-all">{item?.codigo ?? '—'}</td>
                  <td className="px-3 py-2">{item?.nome ?? '—'}</td>
                  <td className="px-3 py-2">{item?.documentoFederal ?? '—'}</td>
                  <td className="px-3 py-2">{formatMoeda(item?.valor)}</td>
                  <td className="px-3 py-2">{formatDataHora(item?.dtAgendamento)}</td>
                  <td className="px-3 py-2">{SITUACAO_LABELS[item?.situacao] ?? item?.situacao ?? '—'}</td>
                  <td className="px-3 py-2">{item?.descricaoBanco ?? item?.numeroBanco ?? '—'}</td>
                  <td className="px-3 py-2">{item?.contaPgtoDestino ?? item?.contaDestino ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RawJson data={resposta?.raw} />
    </Card>
  )
}

// ---------- 31 - Cancelar lançamento futuro ----------
function CancelarLancamentoFuturoCard() {
  const [codigoAgendamento, setCodigoAgendamento] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resposta, setResposta] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResposta(null)

    if (!codigoAgendamento) {
      setFeedback({ ok: false, message: 'Informe o código do agendamento.' })
      return
    }

    if (!window.confirm('Confirma o cancelamento deste lançamento futuro? Esta ação não pode ser desfeita.')) {
      return
    }

    setSubmitting(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-transferencia-cancelar-lancamento-futuro', {
        body: { codigoAgendamento, idempotencyKey: novaIdempotencyKey() },
      })
      const errMsg = extractError(data, error, 'Erro ao cancelar o lançamento futuro.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setFeedback({ ok: true, message: data?.mensagem || 'Lançamento futuro cancelado com sucesso.' })
        setResposta(data)
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card title="Cancelar lançamento futuro" description="Cancela um agendamento de lançamento futuro através do código do agendamento prévio.">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Field label="Código do agendamento (UUID)">
            <input className={inputCls} value={codigoAgendamento} onChange={(e) => setCodigoAgendamento(e.target.value)} disabled={submitting} />
          </Field>
        </div>

        <Feedback feedback={feedback} />

        {resposta && (
          <div className="p-3 rounded-md text-xs border bg-[#111111] border-[#2a2a2a] text-[#d4d4d4] space-y-1">
            <p><span className="text-[#a3a3a3]">Situação:</span> {SITUACAO_LABELS[resposta?.situacao] ?? resposta?.situacao ?? '—'}</p>
          </div>
        )}

        <SecondaryButton type="submit" disabled={submitting}>
          {submitting ? 'Cancelando...' : 'Cancelar lançamento'}
        </SecondaryButton>
      </form>

      <RawJson data={resposta?.raw} />
    </Card>
  )
}

// ---------- 32 - Transferência entre contas ----------
function ContaFields({ prefixLabel, agencia, setAgencia, agenciaDigito, setAgenciaDigito, conta, setConta, contaDigito, setContaDigito, tipoConta, setTipoConta, modeloConta, setModeloConta, disabled }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-[#a3a3a3]">{prefixLabel}</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <Field label="Agência">
          <input className={inputCls} value={agencia} onChange={(e) => setAgencia(e.target.value)} disabled={disabled} />
        </Field>
        <Field label="Dígito da agência">
          <input className={inputCls} value={agenciaDigito} onChange={(e) => setAgenciaDigito(e.target.value)} disabled={disabled} />
        </Field>
        <div />
        <Field label="Conta">
          <input className={inputCls} value={conta} onChange={(e) => setConta(e.target.value)} disabled={disabled} />
        </Field>
        <Field label="Dígito da conta">
          <input className={inputCls} value={contaDigito} onChange={(e) => setContaDigito(e.target.value)} disabled={disabled} />
        </Field>
        <div />
        <Field label="Tipo de conta">
          <select className={selectCls} value={tipoConta} onChange={(e) => setTipoConta(e.target.value)} disabled={disabled}>
            {TIPO_CONTA_OPTS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Modelo de conta">
          <select className={selectCls} value={modeloConta} onChange={(e) => setModeloConta(e.target.value)} disabled={disabled}>
            {MODELO_CONTA_OPTS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
      </div>
    </div>
  )
}

function TransferenciaEntreContasCard() {
  const [origAgencia, setOrigAgencia] = useState('')
  const [origAgenciaDigito, setOrigAgenciaDigito] = useState('')
  const [origConta, setOrigConta] = useState('')
  const [origContaDigito, setOrigContaDigito] = useState('')
  const [origTipoConta, setOrigTipoConta] = useState('1')
  const [origModeloConta, setOrigModeloConta] = useState('1')

  const [destAgencia, setDestAgencia] = useState('')
  const [destAgenciaDigito, setDestAgenciaDigito] = useState('')
  const [destConta, setDestConta] = useState('')
  const [destContaDigito, setDestContaDigito] = useState('')
  const [destTipoConta, setDestTipoConta] = useState('1')
  const [destModeloConta, setDestModeloConta] = useState('1')

  const [vlrTransacao, setVlrTransacao] = useState('')
  const [finlddCli, setFinlddCli] = useState('')
  const [codOperacaoCli, setCodOperacaoCli] = useState('')
  const [descCliente, setDescCliente] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resposta, setResposta] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResposta(null)

    if (!origConta || !destConta) {
      setFeedback({ ok: false, message: 'Informe as contas de origem e destino.' })
      return
    }
    const valor = Number(String(vlrTransacao).replace(',', '.'))
    if (!valor || valor <= 0) {
      setFeedback({ ok: false, message: 'Informe um valor de transferência válido, maior que 0.' })
      return
    }

    if (!window.confirm(`Confirma a transferência de ${formatMoeda(valor)} entre contas BMP? Esta ação move dinheiro real e não pode ser desfeita.`)) {
      return
    }

    setSubmitting(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-transferencia-entre-contas', {
        body: {
          origem: {
            agencia: origAgencia,
            agenciaDigito: origAgenciaDigito,
            conta: origConta,
            contaDigito: origContaDigito,
            tipoConta: Number(origTipoConta),
            modeloConta: Number(origModeloConta),
          },
          destino: {
            agencia: destAgencia,
            agenciaDigito: destAgenciaDigito,
            conta: destConta,
            contaDigito: destContaDigito,
            tipoConta: Number(destTipoConta),
            modeloConta: Number(destModeloConta),
          },
          vlrTransacao: valor,
          finlddCli: finlddCli ? Number(finlddCli) : undefined,
          codOperacaoCli: codOperacaoCli || undefined,
          descCliente: descCliente || undefined,
          idempotencyKey: novaIdempotencyKey(),
        },
      })
      const errMsg = extractError(data, error, 'Erro ao realizar a transferência entre contas.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setFeedback({ ok: true, message: data?.mensagem || 'Transferência realizada com sucesso.' })
        setResposta(data)
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card title="Transferência entre contas" description="Executa transferências de valores entre contas BMP. Em produção, exige handshake HMAC real (movimentação de dinheiro).">
      <form onSubmit={handleSubmit} className="space-y-5">
        <ContaFields
          prefixLabel="Conta de origem"
          agencia={origAgencia} setAgencia={setOrigAgencia}
          agenciaDigito={origAgenciaDigito} setAgenciaDigito={setOrigAgenciaDigito}
          conta={origConta} setConta={setOrigConta}
          contaDigito={origContaDigito} setContaDigito={setOrigContaDigito}
          tipoConta={origTipoConta} setTipoConta={setOrigTipoConta}
          modeloConta={origModeloConta} setModeloConta={setOrigModeloConta}
          disabled={submitting}
        />
        <ContaFields
          prefixLabel="Conta de destino"
          agencia={destAgencia} setAgencia={setDestAgencia}
          agenciaDigito={destAgenciaDigito} setAgenciaDigito={setDestAgenciaDigito}
          conta={destConta} setConta={setDestConta}
          contaDigito={destContaDigito} setContaDigito={setDestContaDigito}
          tipoConta={destTipoConta} setTipoConta={setDestTipoConta}
          modeloConta={destModeloConta} setModeloConta={setDestModeloConta}
          disabled={submitting}
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Field label="Valor da transferência">
            <input className={inputCls} value={vlrTransacao} onChange={(e) => setVlrTransacao(e.target.value)} placeholder="0,00" disabled={submitting} />
          </Field>
          <Field label="Finalidade (finlddCli)">
            <input className={inputCls} value={finlddCli} onChange={(e) => setFinlddCli(e.target.value)} disabled={submitting} />
          </Field>
          <Field label="Código operação (cliente)">
            <input className={inputCls} value={codOperacaoCli} onChange={(e) => setCodOperacaoCli(e.target.value)} disabled={submitting} />
          </Field>
          <Field label="Descrição">
            <input className={inputCls} value={descCliente} onChange={(e) => setDescCliente(e.target.value)} disabled={submitting} maxLength={50} />
          </Field>
        </div>

        <Feedback feedback={feedback} />

        {resposta && (
          <div className="p-3 rounded-md text-xs border bg-[#111111] border-[#2a2a2a] text-[#d4d4d4] space-y-1">
            <p><span className="text-[#a3a3a3]">Valor transacionado:</span> {formatMoeda(resposta?.valorTransacao)}</p>
            <p><span className="text-[#a3a3a3]">Custo da transação:</span> {formatMoeda(resposta?.custoTransacao)}</p>
            <p><span className="text-[#a3a3a3]">Código de autenticação:</span> {resposta?.codigoAutenticacao ?? '—'}</p>
            <p><span className="text-[#a3a3a3]">Código da transação:</span> {resposta?.codigoTransacao ?? '—'}</p>
            <p><span className="text-[#a3a3a3]">Código do movimento:</span> {resposta?.codigoMovimento ?? '—'}</p>
            <p><span className="text-[#a3a3a3]">Handshake real utilizado:</span> {resposta?.handshakeRealizado ? 'Sim' : 'Não (IgnoraHandshake)'}</p>
          </div>
        )}

        <PrimaryButton type="submit" disabled={submitting}>
          {submitting ? 'Transferindo...' : 'Transferir'}
        </PrimaryButton>
      </form>

      <RawJson data={resposta?.raw} />
    </Card>
  )
}

// ---------- 33 - Transferência tipo TED ----------
function TransferenciaTedCard() {
  const [origAgencia, setOrigAgencia] = useState('')
  const [origAgenciaDigito, setOrigAgenciaDigito] = useState('')
  const [origConta, setOrigConta] = useState('')
  const [origContaDigito, setOrigContaDigito] = useState('')
  const [origTipoConta, setOrigTipoConta] = useState('1')
  const [origModeloConta, setOrigModeloConta] = useState('1')

  const [favDocumentoFederal, setFavDocumentoFederal] = useState('')
  const [favNome, setFavNome] = useState('')
  const [favNumeroBanco, setFavNumeroBanco] = useState('')
  const [favAgencia, setFavAgencia] = useState('')
  const [favAgenciaDigito, setFavAgenciaDigito] = useState('')
  const [favConta, setFavConta] = useState('')
  const [favContaDigito, setFavContaDigito] = useState('')
  const [favTipoConta, setFavTipoConta] = useState('1')
  const [favModeloConta, setFavModeloConta] = useState('1')

  const [vlrTransacao, setVlrTransacao] = useState('')
  const [finlddIF, setFinlddIF] = useState('')
  const [tipoProcessamento, setTipoProcessamento] = useState('1')
  const [codOperacaoCli, setCodOperacaoCli] = useState('')
  const [descCliente, setDescCliente] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resposta, setResposta] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResposta(null)

    if (!origConta) {
      setFeedback({ ok: false, message: 'Informe a conta de origem.' })
      return
    }
    if (!favNome || !favDocumentoFederal || !favNumeroBanco || !favConta) {
      setFeedback({ ok: false, message: 'Informe os dados do favorecido (nome, documento, banco e conta).' })
      return
    }
    const valor = Number(String(vlrTransacao).replace(',', '.'))
    if (!valor || valor <= 0) {
      setFeedback({ ok: false, message: 'Informe um valor de transferência válido, maior que 0.' })
      return
    }

    if (!window.confirm(`Confirma a transferência TED de ${formatMoeda(valor)} para ${favNome}? Esta ação move dinheiro real e não pode ser desfeita.`)) {
      return
    }

    setSubmitting(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-transferencia-ted', {
        body: {
          origem: {
            agencia: origAgencia,
            agenciaDigito: origAgenciaDigito,
            conta: origConta,
            contaDigito: origContaDigito,
            tipoConta: Number(origTipoConta),
            modeloConta: Number(origModeloConta),
          },
          favorecido: {
            documentoFederal: favDocumentoFederal,
            nome: favNome,
            numeroBanco: Number(favNumeroBanco),
            conta: {
              agencia: favAgencia,
              agenciaDigito: favAgenciaDigito,
              conta: favConta,
              contaDigito: favContaDigito,
              tipoConta: Number(favTipoConta),
              modeloConta: Number(favModeloConta),
            },
          },
          vlrTransacao: valor,
          finlddIF: finlddIF ? Number(finlddIF) : undefined,
          tipoProcessamento: Number(tipoProcessamento),
          codOperacaoCli: codOperacaoCli || undefined,
          descCliente: descCliente || undefined,
          idempotencyKey: novaIdempotencyKey(),
        },
      })
      const errMsg = extractError(data, error, 'Erro ao realizar a transferência TED.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setFeedback({ ok: true, message: data?.mensagem || 'Transferência TED realizada com sucesso.' })
        setResposta(data)
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card title="Transferência tipo TED" description="Executa transferências entre uma conta BMP e contas de outros bancos. Em produção, exige handshake HMAC real (movimentação de dinheiro).">
      <form onSubmit={handleSubmit} className="space-y-5">
        <ContaFields
          prefixLabel="Conta de origem"
          agencia={origAgencia} setAgencia={setOrigAgencia}
          agenciaDigito={origAgenciaDigito} setAgenciaDigito={setOrigAgenciaDigito}
          conta={origConta} setConta={setOrigConta}
          contaDigito={origContaDigito} setContaDigito={setOrigContaDigito}
          tipoConta={origTipoConta} setTipoConta={setOrigTipoConta}
          modeloConta={origModeloConta} setModeloConta={setOrigModeloConta}
          disabled={submitting}
        />

        <div className="space-y-2">
          <p className="text-xs font-medium text-[#a3a3a3]">Favorecido</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <Field label="Nome">
              <input className={inputCls} value={favNome} onChange={(e) => setFavNome(e.target.value)} disabled={submitting} />
            </Field>
            <Field label="CPF/CNPJ">
              <input className={inputCls} value={favDocumentoFederal} onChange={(e) => setFavDocumentoFederal(e.target.value)} disabled={submitting} />
            </Field>
            <Field label="Número do banco">
              <input className={inputCls} value={favNumeroBanco} onChange={(e) => setFavNumeroBanco(e.target.value)} disabled={submitting} />
            </Field>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <Field label="Agência">
              <input className={inputCls} value={favAgencia} onChange={(e) => setFavAgencia(e.target.value)} disabled={submitting} />
            </Field>
            <Field label="Dígito da agência">
              <input className={inputCls} value={favAgenciaDigito} onChange={(e) => setFavAgenciaDigito(e.target.value)} disabled={submitting} />
            </Field>
            <div />
            <Field label="Conta">
              <input className={inputCls} value={favConta} onChange={(e) => setFavConta(e.target.value)} disabled={submitting} />
            </Field>
            <Field label="Dígito da conta">
              <input className={inputCls} value={favContaDigito} onChange={(e) => setFavContaDigito(e.target.value)} disabled={submitting} />
            </Field>
            <div />
            <Field label="Tipo de conta">
              <select className={selectCls} value={favTipoConta} onChange={(e) => setFavTipoConta(e.target.value)} disabled={submitting}>
                {TIPO_CONTA_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Modelo de conta">
              <select className={selectCls} value={favModeloConta} onChange={(e) => setFavModeloConta(e.target.value)} disabled={submitting}>
                {MODELO_CONTA_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Field label="Valor da transferência">
            <input className={inputCls} value={vlrTransacao} onChange={(e) => setVlrTransacao(e.target.value)} placeholder="0,00" disabled={submitting} />
          </Field>
          <Field label="Finalidade (finlddIF)">
            <input className={inputCls} value={finlddIF} onChange={(e) => setFinlddIF(e.target.value)} disabled={submitting} />
          </Field>
          <Field label="Tipo de processamento">
            <select className={selectCls} value={tipoProcessamento} onChange={(e) => setTipoProcessamento(e.target.value)} disabled={submitting}>
              {TIPO_PROCESSAMENTO_OPTS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Código operação (cliente)">
            <input className={inputCls} value={codOperacaoCli} onChange={(e) => setCodOperacaoCli(e.target.value)} disabled={submitting} />
          </Field>
        </div>
        <Field label="Descrição">
          <input className={inputCls} value={descCliente} onChange={(e) => setDescCliente(e.target.value)} disabled={submitting} maxLength={50} />
        </Field>

        <Feedback feedback={feedback} />

        {resposta && (
          <div className="p-3 rounded-md text-xs border bg-[#111111] border-[#2a2a2a] text-[#d4d4d4] space-y-1">
            <p><span className="text-[#a3a3a3]">Valor transacionado:</span> {formatMoeda(resposta?.valorTransacao)}</p>
            <p><span className="text-[#a3a3a3]">Custo da transação:</span> {formatMoeda(resposta?.custoTransacao)}</p>
            <p><span className="text-[#a3a3a3]">Código de autenticação:</span> {resposta?.codigoAutenticacao ?? '—'}</p>
            <p><span className="text-[#a3a3a3]">Código da transação:</span> {resposta?.codigoTransacao ?? '—'}</p>
            <p><span className="text-[#a3a3a3]">Código do movimento:</span> {resposta?.codigoMovimento ?? '—'}</p>
            <p><span className="text-[#a3a3a3]">Handshake real utilizado:</span> {resposta?.handshakeRealizado ? 'Sim' : 'Não (IgnoraHandshake)'}</p>
          </div>
        )}

        <PrimaryButton type="submit" disabled={submitting}>
          {submitting ? 'Transferindo...' : 'Transferir (TED)'}
        </PrimaryButton>
      </form>

      <RawJson data={resposta?.raw} />
    </Card>
  )
}

export default function TransferenciasTab() {
  return (
    <div className="space-y-2 w-full">
      <ConsultarLancamentoFuturoCard />
      <CancelarLancamentoFuturoCard />
      <TransferenciaEntreContasCard />
      <TransferenciaTedCard />
    </div>
  )
}
