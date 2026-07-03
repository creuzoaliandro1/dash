// Seção "Chaves Pix, Doações, Portabilidade, Favorecido e MFA" — parte do módulo Pix.
// Segue o padrão visual/estrutural de src/components/BoletosBmp/ProtestoTab.jsx.
// Este arquivo exporta apenas PixChavesSection; será importado por um PixTab.jsx maior
// (construído por outro processo) — não edita páginas nem cria a aba Pix completa.

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Field, Feedback, Card, PrimaryButton, SecondaryButton, inputCls, selectCls, extractError, formatDataHora } from './shared'

const novaIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'bmp-' + Date.now() + '-' + Math.random().toString(16).slice(2)
}

// A doc do BMP nem sempre especifica o schema exato da lista retornada (alguns endpoints só
// documentam {sucesso, mensagem}). Por isso procuramos, dentro da resposta bruta, o primeiro
// array de objetos — funciona com qualquer nome de campo que o BMP usar.
function encontrarPrimeiraLista(obj, profundidadeMax = 3) {
  if (!obj || typeof obj !== 'object' || profundidadeMax < 0) return null
  if (Array.isArray(obj)) {
    return obj.length > 0 && typeof obj[0] === 'object' ? obj : null
  }
  for (const key of Object.keys(obj)) {
    const val = obj[key]
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') return val
    if (val && typeof val === 'object') {
      const encontrada = encontrarPrimeiraLista(val, profundidadeMax - 1)
      if (encontrada) return encontrada
    }
  }
  return null
}

function RawJson({ data }) {
  if (!data) return null
  return (
    <details className="mt-2 bg-[#111111] border border-[#2a2a2a] rounded-md p-3">
      <summary className="text-xs text-[#a3a3a3] cursor-pointer select-none">Resposta completa (JSON)</summary>
      <pre className="mt-2 text-[11px] text-[#d4d4d4] whitespace-pre-wrap break-all max-h-[420px] overflow-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  )
}

function TabelaGenerica({ linhas, colunas, chaveLinha }) {
  return (
    <div className="mt-2 w-full overflow-x-auto border border-[#2a2a2a] rounded-md">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[#141414] text-[#666666] uppercase tracking-wider">
            {colunas.map((c) => (
              <th key={c.key} className="text-left px-3 py-2">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((item, i) => (
            <tr key={(chaveLinha ? chaveLinha(item, i) : i) + '-' + i} className="border-t border-[#1a1a1a] text-[#d4d4d4]">
              {colunas.map((c) => (
                <td key={c.key} className="px-3 py-2 break-all">{c.render ? c.render(item) : (item?.[c.key] ?? '—')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const TIPOS_CHAVE = [
  { value: 0, label: '0 — CPF' },
  { value: 1, label: '1 — CNPJ' },
  { value: 2, label: '2 — Telefone' },
  { value: 3, label: '3 — E-mail' },
  { value: 4, label: '4 — Aleatória (EVP)' },
]

const TIPOS_CONTA = [
  { value: 1, label: '1 — Corrente' },
  { value: 2, label: '2 — Poupança' },
  { value: 3, label: '3 — Pagamento' },
  { value: 4, label: '4 — Salário' },
]

const TIPOS_MFA = [
  { value: 1, label: '1 — App' },
  { value: 2, label: '2 — SMS' },
  { value: 3, label: '3 — Email' },
  { value: 6, label: '6 — DbsRetaguarda' },
  { value: 7, label: '7 — WhatsApp' },
]

// Monta um contaDto simples a partir de campos soltos, omitindo vazios.
function montarContaDto({ agencia, agenciaDigito, conta, contaDigito, contaPgto, tipoConta, modeloConta }) {
  const dto = {}
  if (agencia) dto.agencia = agencia
  if (agenciaDigito) dto.agenciaDigito = agenciaDigito
  if (conta) dto.conta = conta
  if (contaDigito) dto.contaDigito = contaDigito
  if (contaPgto) dto.contaPgto = contaPgto
  if (tipoConta) dto.tipoConta = Number(tipoConta)
  if (modeloConta) dto.modeloConta = Number(modeloConta)
  return Object.keys(dto).length > 0 ? dto : undefined
}

// Campos reutilizáveis de conta bancária (agência/conta), usados em quase todos os cards.
function CamposConta({ prefixo, valores, onChange, disabled }) {
  const set = (campo) => (e) => onChange({ ...valores, [campo]: e.target.value })
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      <Field label="Agência">
        <input className={inputCls} value={valores.agencia || ''} onChange={set('agencia')} disabled={disabled} />
      </Field>
      <Field label="Dígito agência">
        <input className={inputCls} value={valores.agenciaDigito || ''} onChange={set('agenciaDigito')} disabled={disabled} />
      </Field>
      <Field label="Conta">
        <input className={inputCls} value={valores.conta || ''} onChange={set('conta')} disabled={disabled} />
      </Field>
      <Field label="Dígito conta">
        <input className={inputCls} value={valores.contaDigito || ''} onChange={set('contaDigito')} disabled={disabled} />
      </Field>
      <Field label="Conta + dígito (contaPgto)">
        <input className={inputCls} value={valores.contaPgto || ''} onChange={set('contaPgto')} disabled={disabled} />
      </Field>
      <Field label="Tipo de conta">
        <select className={selectCls} value={valores.tipoConta || ''} onChange={set('tipoConta')} disabled={disabled}>
          <option value="">—</option>
          {TIPOS_CONTA.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </Field>
    </div>
  )
}

// ---------- Criar chave Pix ----------
function CriarChaveCard() {
  const [tipoChave, setTipoChave] = useState('')
  const [chave, setChave] = useState('')
  const [codigoAutenticacao, setCodigoAutenticacao] = useState('')
  const [codigoMfa, setCodigoMfa] = useState('')
  const [contaValores, setContaValores] = useState({})
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resposta, setResposta] = useState(null)

  const precisaMfa = tipoChave === '2' || tipoChave === '3'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResposta(null)

    if (tipoChave === '') {
      setFeedback({ ok: false, message: "Selecione o 'Tipo de chave'." })
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-pix-chave-criar', {
        body: {
          tipoChave: Number(tipoChave),
          chave: chave || undefined,
          codigoAutenticacao: codigoAutenticacao || undefined,
          codigoMfa: codigoMfa || undefined,
          contaDto: montarContaDto(contaValores),
          idempotencyKey: novaIdempotencyKey(),
        },
      })
      const errMsg = extractError(data, error, 'Erro ao criar chave Pix.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setResposta(data)
        setFeedback({ ok: true, message: data?.mensagem || 'Chave Pix criada com sucesso.' })
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card
      title="Criar chave Pix"
      description="Registra uma nova chave Pix (CPF/CNPJ, e-mail, telefone ou aleatória). Chaves de e-mail/telefone exigem dupla verificação via MFA — solicite o MFA abaixo e informe o código de autenticação e o código recebido."
    >
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Field label="Tipo de chave">
            <select className={selectCls} value={tipoChave} onChange={(e) => setTipoChave(e.target.value)} disabled={loading}>
              <option value="">Selecione…</option>
              {TIPOS_CHAVE.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Chave (deixe vazio para EVP aleatória)">
            <input className={inputCls} value={chave} onChange={(e) => setChave(e.target.value)} disabled={loading} />
          </Field>
          {precisaMfa && (
            <>
              <Field label="Código de autenticação (MFA)">
                <input className={inputCls} value={codigoAutenticacao} onChange={(e) => setCodigoAutenticacao(e.target.value)} disabled={loading} />
              </Field>
              <Field label="Código MFA recebido (SMS/e-mail)">
                <input className={inputCls} value={codigoMfa} onChange={(e) => setCodigoMfa(e.target.value)} disabled={loading} />
              </Field>
            </>
          )}
        </div>
        <CamposConta valores={contaValores} onChange={setContaValores} disabled={loading} />
        <Feedback feedback={feedback} />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Enviando...' : 'Criar chave'}
        </PrimaryButton>
      </form>
      <RawJson data={resposta?.raw} />
    </Card>
  )
}

// ---------- Consultar chave Pix ----------
function ConsultarChaveCard() {
  const [chave, setChave] = useState('')
  const [contaValores, setContaValores] = useState({})
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resposta, setResposta] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResposta(null)

    if (!chave) {
      setFeedback({ ok: false, message: "Informe a 'Chave' a consultar." })
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-pix-chave-consultar', {
        body: { chave, contaDto: montarContaDto(contaValores) },
      })
      const errMsg = extractError(data, error, 'Erro ao consultar chave Pix.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setResposta(data)
        setFeedback({ ok: true, message: data?.mensagem || 'Consulta realizada.' })
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  const chaveInfo = resposta?.raw

  return (
    <Card title="Consultar chave Pix" description="Consulta os dados de titularidade de uma chave Pix cadastrada.">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Field label="Chave">
            <input className={inputCls} value={chave} onChange={(e) => setChave(e.target.value)} disabled={loading} />
          </Field>
        </div>
        <CamposConta valores={contaValores} onChange={setContaValores} disabled={loading} />
        <Feedback feedback={feedback} />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Consultando...' : 'Consultar'}
        </PrimaryButton>
      </form>

      {chaveInfo && (
        <div className="mt-2 w-full grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          <div><span className="text-[#666666]">Chave: </span><span className="text-[#d4d4d4]">{chaveInfo.chave ?? '—'}</span></div>
          <div><span className="text-[#666666]">Correntista: </span><span className="text-[#d4d4d4]">{chaveInfo.nomeCorrentista ?? '—'}</span></div>
          <div><span className="text-[#666666]">Nome fantasia: </span><span className="text-[#d4d4d4]">{chaveInfo.nomeFantasia ?? '—'}</span></div>
          <div><span className="text-[#666666]">Documento: </span><span className="text-[#d4d4d4]">{chaveInfo.documentoFederal ?? '—'}</span></div>
          <div><span className="text-[#666666]">Banco: </span><span className="text-[#d4d4d4]">{chaveInfo.banco?.descricao ?? '—'}</span></div>
        </div>
      )}

      <RawJson data={resposta?.raw} />
    </Card>
  )
}

// ---------- Excluir chave Pix ----------
function ExcluirChaveCard() {
  const [chave, setChave] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resposta, setResposta] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResposta(null)

    if (!chave) {
      setFeedback({ ok: false, message: "Informe a 'Chave' a excluir." })
      return
    }
    const confirmado = window.confirm(`Confirma a exclusão da chave Pix "${chave}"? Esta ação não pode ser desfeita.`)
    if (!confirmado) return

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-pix-chave-excluir', {
        body: { chave, idempotencyKey: novaIdempotencyKey() },
      })
      const errMsg = extractError(data, error, 'Erro ao excluir chave Pix.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setResposta(data)
        setFeedback({ ok: true, message: data?.mensagem || 'Chave Pix excluída com sucesso.' })
        setChave('')
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="Excluir chave Pix" description="Remove uma chave Pix previamente cadastrada. Não é possível excluir chaves com cobranças, portabilidade ou reivindicação em aberto.">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Field label="Chave">
            <input className={inputCls} value={chave} onChange={(e) => setChave(e.target.value)} disabled={loading} />
          </Field>
        </div>
        <Feedback feedback={feedback} />
        <SecondaryButton type="submit" disabled={loading}>
          {loading ? 'Excluindo...' : 'Excluir chave'}
        </SecondaryButton>
      </form>
      <RawJson data={resposta?.raw} />
    </Card>
  )
}

// ---------- Listar chaves Pix ----------
function ListarChavesCard() {
  const [contaValores, setContaValores] = useState({})
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resposta, setResposta] = useState(null)
  const [linhas, setLinhas] = useState([])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResposta(null)
    setLinhas([])

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-pix-chave-listar', {
        body: { contaDto: montarContaDto(contaValores) },
      })
      const errMsg = extractError(data, error, 'Erro ao listar chaves Pix.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setResposta(data)
        const lista = Array.isArray(data?.chaves) ? data.chaves : encontrarPrimeiraLista(data?.raw) ?? []
        setLinhas(lista)
        if (lista.length === 0) {
          setFeedback({ ok: true, message: data?.mensagem || 'Nenhuma chave encontrada.' })
        }
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  const colunas = [
    { key: 'chave', label: 'Chave' },
    { key: 'tipoChave', label: 'Tipo' },
    { key: 'nomeCorrentista', label: 'Correntista' },
    { key: 'documentoFederal', label: 'Documento' },
  ]

  return (
    <Card title="Listar chaves Pix" description="Lista as chaves Pix associadas à conta informada.">
      <form onSubmit={handleSubmit} className="space-y-2">
        <CamposConta valores={contaValores} onChange={setContaValores} disabled={loading} />
        <Feedback feedback={feedback} />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Consultando...' : 'Listar'}
        </PrimaryButton>
      </form>

      {linhas.length > 0 && (
        <TabelaGenerica linhas={linhas} colunas={colunas} chaveLinha={(item) => item?.chave} />
      )}

      <RawJson data={resposta?.raw} />
    </Card>
  )
}

// ---------- Listar doações (portabilidade) ----------
function ListarDoacoesCard({ onSelecionarCodigo }) {
  const [contaValores, setContaValores] = useState({})
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resposta, setResposta] = useState(null)
  const [linhas, setLinhas] = useState([])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResposta(null)
    setLinhas([])

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-pix-doacoes-listar', {
        body: { conta: montarContaDto(contaValores) },
      })
      const errMsg = extractError(data, error, 'Erro ao listar doações.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setResposta(data)
        const lista = Array.isArray(data?.lista) ? data.lista : encontrarPrimeiraLista(data?.raw) ?? []
        setLinhas(lista)
        if (lista.length === 0) {
          setFeedback({ ok: true, message: data?.mensagem || 'Nenhuma doação encontrada.' })
        }
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  const colunas = [
    { key: 'codigo', label: 'Código' },
    { key: 'chave', label: 'Chave' },
    { key: 'participanteSolicitante', label: 'Solicitante' },
    { key: 'participanteDoador', label: 'Doador' },
    { key: 'tipoReivindicacao', label: 'Tipo reivindicação' },
    { key: 'dtInclusao', label: 'Data inclusão', render: (i) => formatDataHora(i?.dtInclusao) },
    ...(onSelecionarCodigo
      ? [{ key: '_acao', label: 'Ações', render: (i) => (
          <button
            type="button"
            onClick={() => onSelecionarCodigo(i?.codigo)}
            className="text-white underline hover:opacity-80"
          >
            Usar código
          </button>
        ) }]
      : []),
  ]

  return (
    <Card title="Listar doações" description="Lista as doações (solicitações de portabilidade) de chave Pix associadas à conta informada.">
      <form onSubmit={handleSubmit} className="space-y-2">
        <CamposConta valores={contaValores} onChange={setContaValores} disabled={loading} />
        <Feedback feedback={feedback} />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Consultando...' : 'Listar'}
        </PrimaryButton>
      </form>

      {linhas.length > 0 && (
        <TabelaGenerica linhas={linhas} colunas={colunas} chaveLinha={(item) => item?.codigo} />
      )}

      <RawJson data={resposta?.raw} />
    </Card>
  )
}

// ---------- Consultar / Aceitar / Reprovar portabilidade ----------
function PortabilidadeCard({ codigoInicial }) {
  const [codigo, setCodigo] = useState(codigoInicial || '')
  const [contaValores, setContaValores] = useState({})
  const [loading, setLoading] = useState(false)
  const [acao, setAcao] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [resposta, setResposta] = useState(null)

  useEffect(() => {
    if (codigoInicial) setCodigo(codigoInicial)
  }, [codigoInicial])

  const handleConsultar = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResposta(null)

    if (!codigo) {
      setFeedback({ ok: false, message: "Informe o 'Código' (UUID) da portabilidade." })
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-pix-portabilidade-consultar', {
        body: { codigo },
      })
      const errMsg = extractError(data, error, 'Erro ao consultar portabilidade.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setResposta(data)
        setFeedback({ ok: true, message: data?.mensagem || 'Consulta realizada.' })
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  const executarAcao = async (funcao, rotulo, mensagemConfirmacao) => {
    if (!codigo) {
      setFeedback({ ok: false, message: "Informe o 'Código' (UUID) da portabilidade." })
      return
    }
    if (mensagemConfirmacao && !window.confirm(mensagemConfirmacao)) return

    setAcao(funcao)
    setFeedback(null)
    try {
      const { data, error } = await supabase.functions.invoke(funcao, {
        body: { codigoDoacao: codigo, conta: montarContaDto(contaValores), idempotencyKey: novaIdempotencyKey() },
      })
      const errMsg = extractError(data, error, `Erro ao ${rotulo.toLowerCase()}.`)
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setResposta(data)
        setFeedback({ ok: true, message: data?.mensagem || `${rotulo} realizado com sucesso.` })
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setAcao(null)
    }
  }

  const info = resposta?.raw

  return (
    <Card
      title="Consultar / Aceitar / Reprovar portabilidade"
      description="Consulta o status de uma solicitação de portabilidade de chave Pix e permite aceitá-la ou reprová-la (uso do código retornado por 'Listar doações')."
    >
      <form onSubmit={handleConsultar} className="space-y-2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Field label="Código (UUID da doação/portabilidade)">
            <input className={inputCls} value={codigo} onChange={(e) => setCodigo(e.target.value)} disabled={loading || !!acao} />
          </Field>
        </div>
        <CamposConta valores={contaValores} onChange={setContaValores} disabled={loading || !!acao} />
        <Feedback feedback={feedback} />
        <div className="flex flex-wrap gap-2">
          <PrimaryButton type="submit" disabled={loading || !!acao}>
            {loading ? 'Consultando...' : 'Consultar'}
          </PrimaryButton>
          <SecondaryButton
            type="button"
            disabled={loading || !!acao}
            onClick={() => executarAcao('bmp-pix-portabilidade-aceitar', 'Aceite de portabilidade', 'Confirma o aceite desta portabilidade?')}
          >
            {acao === 'bmp-pix-portabilidade-aceitar' ? 'Enviando...' : 'Aceitar portabilidade'}
          </SecondaryButton>
          <SecondaryButton
            type="button"
            disabled={loading || !!acao}
            onClick={() => executarAcao('bmp-pix-portabilidade-reprovar', 'Reprovação de portabilidade', 'Confirma a reprovação desta portabilidade?')}
          >
            {acao === 'bmp-pix-portabilidade-reprovar' ? 'Enviando...' : 'Reprovar portabilidade'}
          </SecondaryButton>
        </div>
      </form>

      {info && (
        <div className="mt-2 w-full grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          <div><span className="text-[#666666]">Chave: </span><span className="text-[#d4d4d4]">{info.chave ?? '—'}</span></div>
          <div><span className="text-[#666666]">Solicitante: </span><span className="text-[#d4d4d4]">{info.nomeSolicitante ?? info.participanteSolicitante ?? '—'}</span></div>
          <div><span className="text-[#666666]">Documento solicitante: </span><span className="text-[#d4d4d4]">{info.documentoSolicitante ?? '—'}</span></div>
          <div><span className="text-[#666666]">Status reivindicação: </span><span className="text-[#d4d4d4]">{info.statusReivindicacao ?? '—'}</span></div>
          <div><span className="text-[#666666]">Situação: </span><span className="text-[#d4d4d4]">{info.situacao ?? '—'}</span></div>
          <div><span className="text-[#666666]">Prazo resolução: </span><span className="text-[#d4d4d4]">{formatDataHora(info.prazoResolucao)}</span></div>
          <div><span className="text-[#666666]">Prazo conclusão: </span><span className="text-[#d4d4d4]">{formatDataHora(info.prazoConclusao)}</span></div>
          <div><span className="text-[#666666]">Data inclusão: </span><span className="text-[#d4d4d4]">{formatDataHora(info.dtInclusao)}</span></div>
        </div>
      )}

      <RawJson data={resposta?.raw} />
    </Card>
  )
}

// ---------- Cadastro de favorecido (Pix) ----------
function FavorecidoCard() {
  const [nome, setNome] = useState('')
  const [documentoFederal, setDocumentoFederal] = useState('')
  const [tipoChave, setTipoChave] = useState('')
  const [chave, setChave] = useState('')
  const [numeroParticipanteSpi, setNumeroParticipanteSpi] = useState('')
  const [numeroBanco, setNumeroBanco] = useState('')
  const [agencia, setAgencia] = useState('')
  const [agenciaDigito, setAgenciaDigito] = useState('')
  const [conta, setConta] = useState('')
  const [contaDigito, setContaDigito] = useState('')
  const [contaPagamento, setContaPagamento] = useState('')
  const [tipoConta, setTipoConta] = useState('')
  const [tipoCadastroPix, setTipoCadastroPix] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resposta, setResposta] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResposta(null)

    if (!nome || !documentoFederal) {
      setFeedback({ ok: false, message: "Campos 'Nome' e 'Documento federal' são obrigatórios." })
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-pix-favorecido-cadastrar', {
        body: {
          nome,
          documentoFederal,
          tipoChave: tipoChave !== '' ? Number(tipoChave) : undefined,
          chave: chave || undefined,
          numeroParticipanteSpi: numeroParticipanteSpi || undefined,
          numeroBanco: numeroBanco ? Number(numeroBanco) : undefined,
          agencia: agencia || undefined,
          agenciaDigito: agenciaDigito || undefined,
          conta: conta || undefined,
          contaDigito: contaDigito || undefined,
          contaPagamento: contaPagamento || undefined,
          tipoConta: tipoConta !== '' ? Number(tipoConta) : undefined,
          tipoCadastroPix: tipoCadastroPix !== '' ? Number(tipoCadastroPix) : undefined,
          idempotencyKey: novaIdempotencyKey(),
        },
      })
      const errMsg = extractError(data, error, 'Erro ao cadastrar favorecido.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setResposta(data)
        setFeedback({ ok: true, message: data?.mensagem || 'Favorecido cadastrado — aguardando análise do Banco Digital.' })
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card
      title="Cadastro de favorecido"
      description="Cadastra o favorecido (quem receberá valores via chave Pix ou dados bancários). Após o envio, o time do Banco Digital analisa e aprova ou rejeita o cadastro."
    >
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Field label="Nome completo">
            <input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} disabled={loading} />
          </Field>
          <Field label="CPF/CNPJ">
            <input className={inputCls} value={documentoFederal} onChange={(e) => setDocumentoFederal(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Tipo de chave (se cadastro por chave)">
            <select className={selectCls} value={tipoChave} onChange={(e) => setTipoChave(e.target.value)} disabled={loading}>
              <option value="">—</option>
              {TIPOS_CHAVE.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Chave Pix do favorecido">
            <input className={inputCls} value={chave} onChange={(e) => setChave(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Nº participante SPI">
            <input className={inputCls} value={numeroParticipanteSpi} onChange={(e) => setNumeroParticipanteSpi(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Nº do banco">
            <input className={inputCls} value={numeroBanco} onChange={(e) => setNumeroBanco(e.target.value)} disabled={loading} />
          </Field>
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
          <Field label="Conta pagamento (conta + dígito)">
            <input className={inputCls} value={contaPagamento} onChange={(e) => setContaPagamento(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Tipo de conta">
            <select className={selectCls} value={tipoConta} onChange={(e) => setTipoConta(e.target.value)} disabled={loading}>
              <option value="">—</option>
              {TIPOS_CONTA.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Tipo de cadastro">
            <select className={selectCls} value={tipoCadastroPix} onChange={(e) => setTipoCadastroPix(e.target.value)} disabled={loading}>
              <option value="">—</option>
              <option value={1}>1 — Chave</option>
              <option value={2}>2 — Dados bancários</option>
            </select>
          </Field>
        </div>
        <Feedback feedback={feedback} />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Enviando...' : 'Cadastrar favorecido'}
        </PrimaryButton>
      </form>

      {resposta?.codigoFavorecido && (
        <p className="mt-2 text-xs text-[#a3a3a3]">Código do favorecido: <span className="text-white">{resposta.codigoFavorecido}</span></p>
      )}

      <RawJson data={resposta?.raw} />
    </Card>
  )
}

// ---------- Solicitar MFA ----------
function MfaCard() {
  const [tipoMfa, setTipoMfa] = useState('')
  const [destinoEnvio, setDestinoEnvio] = useState('')
  const [contaValores, setContaValores] = useState({})
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resposta, setResposta] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResposta(null)

    if (tipoMfa === '') {
      setFeedback({ ok: false, message: "Selecione o 'Tipo de MFA'." })
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-pix-mfa-solicitar', {
        body: {
          tipoMfa: Number(tipoMfa),
          destinoEnvio: destinoEnvio || undefined,
          conta: montarContaDto(contaValores),
          idempotencyKey: novaIdempotencyKey(),
        },
      })
      const errMsg = extractError(data, error, 'Erro ao solicitar MFA.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setResposta(data)
        setFeedback({ ok: true, message: data?.mensagem || 'MFA solicitado — verifique o canal informado.' })
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card
      title="Solicitar MFA"
      description="Solicita a autenticação multifator (dupla verificação), necessária para criar chave Pix do tipo e-mail ou telefone. O código de autenticação retornado deve ser reutilizado no card 'Criar chave Pix'."
    >
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Field label="Tipo de MFA">
            <select className={selectCls} value={tipoMfa} onChange={(e) => setTipoMfa(e.target.value)} disabled={loading}>
              <option value="">Selecione…</option>
              {TIPOS_MFA.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Destino de envio (telefone/e-mail)">
            <input className={inputCls} value={destinoEnvio} onChange={(e) => setDestinoEnvio(e.target.value)} disabled={loading} />
          </Field>
        </div>
        <CamposConta valores={contaValores} onChange={setContaValores} disabled={loading} />
        <Feedback feedback={feedback} />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Enviando...' : 'Solicitar MFA'}
        </PrimaryButton>
      </form>

      {resposta?.codigoAutenticacao && (
        <p className="mt-3 text-xs text-[#a3a3a3]">
          Código de autenticação: <span className="text-white">{resposta.codigoAutenticacao}</span>
        </p>
      )}

      <RawJson data={resposta?.raw} />
    </Card>
  )
}

export default function PixChavesSection() {
  const [codigoDoacaoSelecionado, setCodigoDoacaoSelecionado] = useState(null)

  return (
    <div className="space-y-3 w-full">
      <MfaCard />
      <CriarChaveCard />
      <ConsultarChaveCard />
      <ExcluirChaveCard />
      <ListarChavesCard />
      <ListarDoacoesCard onSelecionarCodigo={setCodigoDoacaoSelecionado} />
      <PortabilidadeCard codigoInicial={codigoDoacaoSelecionado} />
      <FavorecidoCard />
    </div>
  )
}
