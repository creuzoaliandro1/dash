import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Field, Feedback, Card, PrimaryButton, SecondaryButton, DateInput, inputCls, extractError, formatData } from './shared'

const novaIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'bmp-' + Date.now() + '-' + Math.random().toString(16).slice(2)
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

function baixarBase64(base64, contentType, nomeArquivo) {
  const link = document.createElement('a')
  link.href = `data:${contentType || 'application/octet-stream'};base64,${base64}`
  link.download = nomeArquivo || 'arquivo.ret'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function ContaFields({ conta, setConta, disabled, prefixo = 'ContaDto' }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      <Field label="Agência">
        <input className={inputCls} value={conta.agencia} onChange={(e) => setConta({ ...conta, agencia: e.target.value })} disabled={disabled} />
      </Field>
      <Field label="Dígito agência">
        <input className={inputCls} value={conta.agenciaDigito} onChange={(e) => setConta({ ...conta, agenciaDigito: e.target.value })} disabled={disabled} />
      </Field>
      <Field label="Conta">
        <input className={inputCls} value={conta.conta} onChange={(e) => setConta({ ...conta, conta: e.target.value })} disabled={disabled} />
      </Field>
      <Field label="Dígito conta">
        <input className={inputCls} value={conta.contaDigito} onChange={(e) => setConta({ ...conta, contaDigito: e.target.value })} disabled={disabled} />
      </Field>
      {prefixo === 'ContaDto400' && (
        <>
          <Field label="Conta pagamento">
            <input className={inputCls} value={conta.contaPgto} onChange={(e) => setConta({ ...conta, contaPgto: e.target.value })} disabled={disabled} />
          </Field>
          <Field label="Tipo de conta">
            <input className={inputCls} value={conta.tipoConta} onChange={(e) => setConta({ ...conta, tipoConta: e.target.value })} disabled={disabled} />
          </Field>
          <Field label="Modelo de conta">
            <input className={inputCls} value={conta.modeloConta} onChange={(e) => setConta({ ...conta, modeloConta: e.target.value })} disabled={disabled} />
          </Field>
        </>
      )}
    </div>
  )
}

// ---------- 34. Registro Boleto CNAB (envio de remessa CNAB 400) ----------
function EnviarCnab400Card() {
  const [conta, setConta] = useState({ agencia: '', agenciaDigito: '', conta: '', contaDigito: '', contaPgto: '', tipoConta: '', modeloConta: '' })
  const [numeroCedente, setNumeroCedente] = useState('')
  const [numeroCarteira, setNumeroCarteira] = useState('')
  const [instrucaoViaAprovacao, setInstrucaoViaAprovacao] = useState('')
  const [arquivo, setArquivo] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resultado, setResultado] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResultado(null)

    if (!arquivo) {
      setFeedback({ ok: false, message: 'Selecione o arquivo de remessa (.REM) para envio.' })
      return
    }

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('ContaDto.Agencia', conta.agencia)
      fd.append('ContaDto.AgenciaDigito', conta.agenciaDigito)
      fd.append('ContaDto.Conta', conta.conta)
      fd.append('ContaDto.ContaDigito', conta.contaDigito)
      fd.append('ContaDto.ContaPgto', conta.contaPgto)
      fd.append('ContaDto.TipoConta', conta.tipoConta)
      fd.append('ContaDto.ModeloConta', conta.modeloConta)
      fd.append('NumeroCedente', numeroCedente)
      fd.append('NumeroCarteira', numeroCarteira)
      fd.append('InstrucaoViaAprovacao', instrucaoViaAprovacao)
      fd.append('ArquivoDto.Arquivo', arquivo)
      fd.append('idempotencyKey', novaIdempotencyKey())
      fd.append('ignoraHandshake', 'true')

      const { data, error } = await supabase.functions.invoke('bmp-cnab-enviar-arquivo-400', { body: fd })
      const errMsg = extractError(data, error, 'Erro ao enviar arquivo CNAB 400.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setFeedback({ ok: true, message: data?.mensagem || 'Arquivo enviado para processamento.' })
        setResultado(data)
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card title="Registro Boleto CNAB (400)" description="Envia um arquivo de remessa CNAB 400 para registro de boletos em lote.">
      <form onSubmit={handleSubmit} className="space-y-2">
        <ContaFields conta={conta} setConta={setConta} disabled={submitting} prefixo="ContaDto400" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Field label="Número do cedente">
            <input className={inputCls} value={numeroCedente} onChange={(e) => setNumeroCedente(e.target.value)} disabled={submitting} />
          </Field>
          <Field label="Número da carteira">
            <input className={inputCls} value={numeroCarteira} onChange={(e) => setNumeroCarteira(e.target.value)} disabled={submitting} />
          </Field>
          <Field label="Instrução via aprovação">
            <input className={inputCls} value={instrucaoViaAprovacao} onChange={(e) => setInstrucaoViaAprovacao(e.target.value)} disabled={submitting} />
          </Field>
        </div>
        <Field label="Arquivo de remessa (.REM)">
          <input
            type="file"
            className={inputCls}
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            disabled={submitting}
          />
        </Field>

        <Feedback feedback={feedback} />

        {resultado && (
          <div className="p-3 rounded-md text-xs border bg-[#111111] border-[#2a2a2a] text-[#d4d4d4] space-y-1">
            <p><span className="text-[#a3a3a3]">Código importação:</span> {resultado.codigoImportaArquivo ?? '—'}</p>
          </div>
        )}

        <PrimaryButton type="submit" disabled={submitting}>
          {submitting ? 'Enviando...' : 'Enviar arquivo'}
        </PrimaryButton>
      </form>
    </Card>
  )
}

// ---------- 35. Consulta de Pagamento e Registro de Boleto + 36. Download Arquivo 200 ----------
function ConsultarArquivosCard() {
  const [codigoImportaArquivo, setCodigoImportaArquivo] = useState('')
  const [numeroCedente, setNumeroCedente] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [itens, setItens] = useState([])
  const [baixando, setBaixando] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setItens([])

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-cnab-consultar-arquivos', {
        body: { codigoImportaArquivo: codigoImportaArquivo || undefined, numeroCedente: numeroCedente || undefined, dataInicio: dataInicio || undefined, dataFim: dataFim || undefined },
      })
      const errMsg = extractError(data, error, 'Erro ao consultar arquivos.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        const lista = data?.arquivosRetorno ?? []
        setItens(lista)
        if (lista.length === 0) setFeedback({ ok: true, message: data?.mensagem || 'Nenhum arquivo encontrado para os filtros informados.' })
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (item) => {
    const codigo = item?.codigoImportaArquivo ?? codigoImportaArquivo
    if (!codigo) return
    setBaixando(codigo)
    setFeedback(null)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-cnab-download-200', { body: { codigoImportaArquivo: codigo } })
      const errMsg = extractError(data, error, 'Erro ao baixar arquivo de retorno 200.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else if (data?.base64) {
        baixarBase64(data.base64, data.contentType, data.nomeArquivo)
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setBaixando(null)
    }
  }

  return (
    <Card title="Consultar arquivos CNAB / baixar retorno 200" description="Consulta o status de processamento dos arquivos CNAB 400 enviados e permite baixar o arquivo de retorno 200.">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Field label="Código importação">
            <input className={inputCls} value={codigoImportaArquivo} onChange={(e) => setCodigoImportaArquivo(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Número do cedente">
            <input className={inputCls} value={numeroCedente} onChange={(e) => setNumeroCedente(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Data início">
            <DateInput value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Data fim">
            <DateInput value={dataFim} onChange={(e) => setDataFim(e.target.value)} disabled={loading} />
          </Field>
        </div>

        <Feedback feedback={feedback} />

        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Consultando...' : 'Consultar'}
        </PrimaryButton>
      </form>

      {itens.length > 0 && (
        <div className="mt-2 overflow-x-auto border border-[#2a2a2a] rounded-md">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#141414] text-[#666666] uppercase tracking-wider">
                <th className="text-left px-3 py-2">Código importação</th>
                <th className="text-left px-3 py-2">Nome do arquivo</th>
                <th className="text-left px-3 py-2">Situação</th>
                <th className="text-left px-3 py-2">Data</th>
                <th className="text-right px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item, i) => (
                <tr key={(item?.codigoImportaArquivo ?? i) + '-' + i} className="border-t border-[#1a1a1a] text-[#d4d4d4]">
                  <td className="px-3 py-2 break-all">{item?.codigoImportaArquivo ?? '—'}</td>
                  <td className="px-3 py-2 break-all">{item?.nomeArquivo ?? '—'}</td>
                  <td className="px-3 py-2">{item?.situacao ?? item?.status ?? '—'}</td>
                  <td className="px-3 py-2">{formatData(item?.dataEnvio ?? item?.dtEnvio)}</td>
                  <td className="px-3 py-2 text-right">
                    <SecondaryButton type="button" onClick={() => handleDownload(item)} disabled={baixando === (item?.codigoImportaArquivo)}>
                      {baixando === item?.codigoImportaArquivo ? 'Baixando...' : 'Baixar 200'}
                    </SecondaryButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ---------- 38. Importar Arquivo CNAB 240 ----------
function ImportarCnab240Card() {
  const [conta, setConta] = useState({ agencia: '', agenciaDigito: '', conta: '', contaDigito: '' })
  const [arquivo, setArquivo] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resultado, setResultado] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResultado(null)

    if (!arquivo) {
      setFeedback({ ok: false, message: 'Selecione o arquivo CNAB 240 (.REM) para importação.' })
      return
    }

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('ContaDto.Agencia', conta.agencia)
      fd.append('ContaDto.AgenciaDigito', conta.agenciaDigito)
      fd.append('ContaDto.Conta', conta.conta)
      fd.append('ContaDto.ContaDigito', conta.contaDigito)
      fd.append('Arquivo', arquivo)
      fd.append('idempotencyKey', novaIdempotencyKey())
      fd.append('ignoraHandshake', 'true')

      const { data, error } = await supabase.functions.invoke('bmp-cnab-240-importar', { body: fd })
      const errMsg = extractError(data, error, 'Erro ao importar arquivo CNAB 240.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setFeedback({ ok: true, message: data?.mensagem || 'Arquivo importado para processamento.' })
        setResultado(data)
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card title="Importar Arquivo CNAB 240" description="Importa um arquivo de remessa CNAB 240 (TED, transferências internas, pagamento de boletos e PIX).">
      <form onSubmit={handleSubmit} className="space-y-2">
        <ContaFields conta={conta} setConta={setConta} disabled={submitting} />
        <Field label="Arquivo CNAB 240 (.REM)">
          <input
            type="file"
            className={inputCls}
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            disabled={submitting}
          />
        </Field>

        <Feedback feedback={feedback} />

        {resultado && (
          <div className="p-3 rounded-md text-xs border bg-[#111111] border-[#2a2a2a] text-[#d4d4d4] space-y-1">
            <p><span className="text-[#a3a3a3]">Código importação:</span> {resultado.codigoImportaArquivo ?? '—'}</p>
          </div>
        )}

        <PrimaryButton type="submit" disabled={submitting}>
          {submitting ? 'Importando...' : 'Importar arquivo'}
        </PrimaryButton>
      </form>
    </Card>
  )
}

// ---------- 37. CNAB 240 (listar) + 39. Download de Arquivo CNAB 240 ----------
function Listar240Card() {
  const [codigoImportaArquivo, setCodigoImportaArquivo] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [itens, setItens] = useState([])
  const [resposta, setResposta] = useState(null)
  const [baixando, setBaixando] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setItens([])
    setResposta(null)

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-cnab-240-listar', {
        body: { codigoImportaArquivo: codigoImportaArquivo || undefined, dataInicio: dataInicio || undefined, dataFim: dataFim || undefined },
      })
      const errMsg = extractError(data, error, 'Erro ao listar arquivos CNAB 240.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setResposta(data)
        const lista = data?.itens ?? []
        setItens(lista)
        if (lista.length === 0) setFeedback({ ok: true, message: 'Nenhum arquivo encontrado para os filtros informados.' })
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (item) => {
    const codigo = item?.codigoImportaArquivo ?? codigoImportaArquivo
    if (!codigo) return
    setBaixando(codigo)
    setFeedback(null)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-cnab-240-download', { body: { codigoImportaArquivo: codigo } })
      const errMsg = extractError(data, error, 'Erro ao baixar arquivo CNAB 240.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else if (data?.base64) {
        baixarBase64(data.base64, data.contentType, data.nomeArquivo)
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setBaixando(null)
    }
  }

  return (
    <Card title="Listar / baixar arquivos CNAB 240" description="Lista os arquivos CNAB 240 importados e permite baixar o arquivo de retorno.">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <Field label="Código importação">
            <input className={inputCls} value={codigoImportaArquivo} onChange={(e) => setCodigoImportaArquivo(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Data início">
            <DateInput value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Data fim">
            <DateInput value={dataFim} onChange={(e) => setDataFim(e.target.value)} disabled={loading} />
          </Field>
        </div>

        <Feedback feedback={feedback} />

        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Consultando...' : 'Consultar'}
        </PrimaryButton>
      </form>

      {itens.length > 0 && (
        <div className="mt-2 overflow-x-auto border border-[#2a2a2a] rounded-md">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#141414] text-[#666666] uppercase tracking-wider">
                <th className="text-left px-3 py-2">Código importação</th>
                <th className="text-left px-3 py-2">Nome do arquivo</th>
                <th className="text-left px-3 py-2">Situação</th>
                <th className="text-left px-3 py-2">Data</th>
                <th className="text-right px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item, i) => (
                <tr key={(item?.codigoImportaArquivo ?? i) + '-' + i} className="border-t border-[#1a1a1a] text-[#d4d4d4]">
                  <td className="px-3 py-2 break-all">{item?.codigoImportaArquivo ?? '—'}</td>
                  <td className="px-3 py-2 break-all">{item?.nomeArquivo ?? '—'}</td>
                  <td className="px-3 py-2">{item?.situacao ?? item?.status ?? '—'}</td>
                  <td className="px-3 py-2">{formatData(item?.dataEnvio ?? item?.dtEnvio)}</td>
                  <td className="px-3 py-2 text-right">
                    <SecondaryButton type="button" onClick={() => handleDownload(item)} disabled={baixando === item?.codigoImportaArquivo}>
                      {baixando === item?.codigoImportaArquivo ? 'Baixando...' : 'Baixar'}
                    </SecondaryButton>
                  </td>
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

export default function CnabTab() {
  return (
    <div className="space-y-3 w-full">
      <EnviarCnab400Card />
      <ConsultarArquivosCard />
      <ImportarCnab240Card />
      <Listar240Card />
    </div>
  )
}
