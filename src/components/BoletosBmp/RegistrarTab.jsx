import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Field, Feedback, Card, PrimaryButton, SecondaryButton, DateInput, inputCls, selectCls, textareaCls, extractError } from './shared'

const novaIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'bmp-' + Date.now() + '-' + Math.random().toString(16).slice(2)
}

// Codigos de especie de titulo (codEspTit) - FEBRABAN, conforme doc BMP
// (https://bmpdocs.moneyp.com.br/baas/referencias-de-api/boletos/55-registrar-boleto)
const ESPECIES_TITULO = [
  [1, 'CH - Cheque'],
  [2, 'DM - Duplicata Mercantil'],
  [3, 'DMI - Duplicata Mercantil Indicacao'],
  [4, 'DS - Duplicata de Servico'],
  [5, 'DSI - Duplicata de Servico Indicacao'],
  [6, 'DR - Duplicata Rural'],
  [7, 'LC - Letra de Cambio'],
  [8, 'NCC - Nota de Credito Comercial'],
  [9, 'NCE - Nota de Credito Exportacao'],
  [10, 'NCI - Nota de Credito Industrial'],
  [11, 'NCR - Nota de Credito Rural'],
  [12, 'NP - Nota Promissoria'],
  [13, 'NPR - Nota Promissoria Rural'],
  [14, 'TM - Triplicata Mercantil'],
  [15, 'TS - Triplicata de Servico'],
  [16, 'NS - Nota de Seguro'],
  [17, 'RC - Recibo'],
  [18, 'FAT - Bloqueto'],
  [19, 'ND - Nota de Debito'],
  [20, 'AP - Apolice de Seguro'],
  [21, 'ME - Mensalidade Escolar'],
  [22, 'PC - Parcela de Consorcio'],
  [23, 'NF - Nota Fiscal'],
  [24, 'DD - Documento de Divida'],
  [25, 'Cedula de Produto Rural'],
  [26, 'Warrant'],
  [27, 'Divida Ativa de Estado'],
  [28, 'Divida Ativa de Municipio'],
  [29, 'Divida Ativa da Uniao'],
  [30, 'Encargos condominiais'],
  [31, 'Cartao de Credito'],
  [32, 'Boleto proposta'],
  [33, 'Boleto de Deposito e Aporte'],
  [99, 'Outros'],
]

const TIPO_SACADOR_AVALISTA = [
  [0, 'Isento'],
  [1, 'CPF'],
  [2, 'CNPJ'],
  [3, 'PIS/PASEP'],
  [9, 'Outros'],
]

const TIPO_RECORRENCIA = [
  [1, 'Semanal'],
  [2, 'Quinzenal'],
  [3, 'Mensal'],
  [4, 'Trimestral'],
  [5, 'Bimestral'],
  [6, 'Anual'],
  [7, 'Semestral'],
]

const MODELO_RECORRENCIA = [
  [1, 'Parcelado'],
  [2, 'Recorrente'],
]

let descontoRowId = 0
const novaLinhaDesconto = () => ({ _id: ++descontoRowId, data: '', codigo: '', vlr: '' })

// Wrapper de layout: distribui os campos de uma linha proporcionalmente via
// flex-grow (ex.: flex={3} ocupa o triplo do espaco de flex={1}), com quebra
// de linha automatica (flex-wrap) e largura minima para telas estreitas.
function FlexCol({ flex = 1, min = 140, children }) {
  return (
    <div style={{ flexGrow: flex, flexBasis: 0, minWidth: `${min}px` }}>
      {children}
    </div>
  )
}

// Bloco reutilizavel para os itens "calculaveis" do boleto (juros / multa / desconto),
// todos seguindo o mesmo formato na API do BMP: { data, codigo, vlr }.
// Com `bare`, devolve so os campos (sem o <div> de linha proprio) para que o
// chamador possa combinar varios blocos (ex.: juros + multa + desconto) na mesma linha.
// `labelPrefix` distingue os campos quando varios blocos ficam lado a lado.
function ItemCalculavelFields({ data, codigo, vlr, onChange, disabled, bare = false, labelPrefix = '' }) {
  const sufixo = labelPrefix ? ` (${labelPrefix})` : ''
  const fields = (
    <>
      <FlexCol flex={3} min={150}>
        <Field label={`Data${sufixo}`}>
          <DateInput value={data} onChange={(e) => onChange({ data: e.target.value })} disabled={disabled} />
        </Field>
      </FlexCol>
      <FlexCol flex={1} min={120}>
        <Field label={`Codigo${sufixo}`}>
          <input
            className={inputCls}
            value={codigo}
            onChange={(e) => onChange({ codigo: e.target.value })}
            placeholder="conforme padrao BMP"
            disabled={disabled}
          />
        </Field>
      </FlexCol>
      <FlexCol flex={3} min={150}>
        <Field label={`Valor${sufixo}`}>
          <input className={inputCls} value={vlr} onChange={(e) => onChange({ vlr: e.target.value })} placeholder="0,00" disabled={disabled} />
        </Field>
      </FlexCol>
    </>
  )
  if (bare) return fields
  return <div className="flex flex-wrap gap-2">{fields}</div>
}

export default function RegistrarTab() {
  const [agencia, setAgencia] = useState('')
  const [agenciaDigito, setAgenciaDigito] = useState('')
  const [conta, setConta] = useState('')
  const [contaDigito, setContaDigito] = useState('')
  const [contaPgto, setContaPgto] = useState('')

  const [dtVencimento, setDtVencimento] = useState('')
  const [dtLimPgto, setDtLimPgto] = useState('')
  const [vlrTitulo, setVlrTitulo] = useState('')
  const [numDocTit, setNumDocTit] = useState('')
  const [numeroDocumento, setNumeroDocumento] = useState('')
  const [identdNossoNum, setIdentdNossoNum] = useState('')
  const [codEspTit, setCodEspTit] = useState('2')
  const [dtEmissao, setDtEmissao] = useState('')
  const [vlrAbatimento, setVlrAbatimento] = useState('')

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

  const [sacadorTipo, setSacadorTipo] = useState('1')
  const [sacadorIdentificador, setSacadorIdentificador] = useState('')
  const [sacadorNome, setSacadorNome] = useState('')

  const [jurosData, setJurosData] = useState('')
  const [jurosCodigo, setJurosCodigo] = useState('')
  const [jurosVlr, setJurosVlr] = useState('')

  const [multaData, setMultaData] = useState('')
  const [multaCodigo, setMultaCodigo] = useState('')
  const [multaVlr, setMultaVlr] = useState('')

  const [descontoData, setDescontoData] = useState('')
  const [descontoCodigo, setDescontoCodigo] = useState('')
  const [descontoVlr, setDescontoVlr] = useState('')

  const [descontos, setDescontos] = useState([])

  const [recorrenciaAtiva, setRecorrenciaAtiva] = useState(false)
  const [recorrenciaTipo, setRecorrenciaTipo] = useState('3')
  const [recorrenciaModelo, setRecorrenciaModelo] = useState('1')
  const [recorrenciaQtd, setRecorrenciaQtd] = useState('')
  const [recorrenciaDiaFixo, setRecorrenciaDiaFixo] = useState('')

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
    if (v === '' || v == null) return null
    const n = parseFloat(String(v).replace(',', '.'))
    return isNaN(n) ? null : n
  }

  const onlyDigits = (v) => (v == null ? '' : String(v).replace(/\D/g, ''))

  const itemCalculavel = (data, codigo, vlr) => {
    const v = num(vlr)
    if (!data && !codigo && v == null) return null
    return { data: toIso(data), codigo: codigo || null, vlr: v ?? 0 }
  }

  const addDescontoRow = () => setDescontos((prev) => [...prev, novaLinhaDesconto()])
  const removeDescontoRow = (id) => setDescontos((prev) => prev.filter((r) => r._id !== id))
  const updateDescontoRow = (id, patch) =>
    setDescontos((prev) => prev.map((r) => (r._id === id ? { ...r, ...patch } : r)))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResultado(null)

    if (!dtVencimento || !vlrTitulo) {
      setFeedback({ ok: false, message: 'Informe ao menos vencimento e valor do titulo.' })
      return
    }
    if (!documentoFederal || !nomeRazao) {
      setFeedback({ ok: false, message: 'Informe ao menos documento e nome/razao social do pagador.' })
      return
    }

    const descontosPayload = descontos
      .map((r) => itemCalculavel(r.data, r.codigo, r.vlr))
      .filter(Boolean)

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
        vlrTitulo: num(vlrTitulo) ?? 0,
        numDocTit: numDocTit || null,
        identdNossoNum: identdNossoNum || null,
        codEspTit: codEspTit ? parseInt(codEspTit, 10) : 2,
        dtEmissao: toIso(dtEmissao),
        vlrAbatimento: num(vlrAbatimento) ?? 0,
        numeroDocumento: numeroDocumento || numDocTit || null,
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
      sacadorAvalista: (sacadorIdentificador || sacadorNome)
        ? {
            tipo: sacadorTipo ? parseInt(sacadorTipo, 10) : null,
            identificador: onlyDigits(sacadorIdentificador) || sacadorIdentificador || null,
            nomeSacadorAvalista: sacadorNome || null,
          }
        : null,
      juros: itemCalculavel(jurosData, jurosCodigo, jurosVlr),
      multa: itemCalculavel(multaData, multaCodigo, multaVlr),
      desconto: itemCalculavel(descontoData, descontoCodigo, descontoVlr),
      descontos: descontosPayload.length > 0 ? descontosPayload : null,
      instrucoesBeneficiario: instrucoesBeneficiario
        ? instrucoesBeneficiario.split('\n').filter((m) => m.trim().length > 0)
        : null,
      numeroCarteira: numeroCarteira ? parseInt(numeroCarteira, 10) : 1,
      tipoRegistro: tipoRegistro ? parseInt(tipoRegistro, 10) : 1,
      recorrencia: recorrenciaAtiva
        ? {
            tipo: recorrenciaTipo ? parseInt(recorrenciaTipo, 10) : null,
            modelo: recorrenciaModelo ? parseInt(recorrenciaModelo, 10) : 1,
            qtd: recorrenciaQtd ? parseInt(recorrenciaQtd, 10) : null,
            diaFixoRecorrencia: recorrenciaDiaFixo ? parseInt(recorrenciaDiaFixo, 10) : null,
          }
        : null,
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
    <div className="w-full space-y-2">
      <Card title="Beneficiario" description="Conta BMP que registra o titulo (deixe em branco para usar a conta padrao da integracao).">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Field label="Agencia">
            <input className={inputCls} value={agencia} onChange={(e) => setAgencia(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Digito agencia">
            <input className={inputCls} value={agenciaDigito} onChange={(e) => setAgenciaDigito(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Conta">
            <input className={inputCls} value={conta} onChange={(e) => setConta(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Digito conta">
            <input className={inputCls} value={contaDigito} onChange={(e) => setContaDigito(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Conta pagamento">
            <input className={inputCls} value={contaPgto} onChange={(e) => setContaPgto(e.target.value)} disabled={loading} />
          </Field>
        </div>
      </Card>

      <Card title="Dados do titulo">
        <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
          <FlexCol flex={1} min={150}>
            <Field label="Data de vencimento *">
              <DateInput value={dtVencimento} onChange={(e) => setDtVencimento(e.target.value)} disabled={loading} />
            </Field>
          </FlexCol>
          <FlexCol flex={1} min={170}>
            <Field label="Limite Pagamento">
              <DateInput value={dtLimPgto} onChange={(e) => setDtLimPgto(e.target.value)} disabled={loading} />
            </Field>
          </FlexCol>
          <FlexCol flex={1} min={150}>
            <Field label="Data de emissao">
              <DateInput value={dtEmissao} onChange={(e) => setDtEmissao(e.target.value)} disabled={loading} />
            </Field>
          </FlexCol>
          <FlexCol flex={1} min={120}>
            <Field label="Valor do titulo *">
              <input className={inputCls} value={vlrTitulo} onChange={(e) => setVlrTitulo(e.target.value)} placeholder="0,00" disabled={loading} />
            </Field>
          </FlexCol>
          <FlexCol flex={1} min={130}>
            <Field label="Valor de abatimento">
              <input className={inputCls} value={vlrAbatimento} onChange={(e) => setVlrAbatimento(e.target.value)} placeholder="0,00" disabled={loading} />
            </Field>
          </FlexCol>
          <FlexCol flex={1} min={160}>
            <Field label="Numero">
              <input className={inputCls} value={numDocTit} onChange={(e) => setNumDocTit(e.target.value)} disabled={loading} />
            </Field>
          </FlexCol>
          <FlexCol flex={1} min={200}>
            <Field label="Documento">
              <input className={inputCls} value={numeroDocumento} onChange={(e) => setNumeroDocumento(e.target.value)} disabled={loading} />
            </Field>
          </FlexCol>
          <FlexCol flex={1} min={180}>
            <Field label="Especie do titulo">
              <select className={selectCls} value={codEspTit} onChange={(e) => setCodEspTit(e.target.value)} disabled={loading}>
                {ESPECIES_TITULO.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
          </FlexCol>
          <FlexCol flex={1} min={100}>
            <Field label="Carteira">
              <input className={inputCls} value={numeroCarteira} onChange={(e) => setNumeroCarteira(e.target.value)} disabled={loading} />
            </Field>
          </FlexCol>
          <FlexCol flex={1} min={120}>
            <Field label="Tipo de registro">
              <input className={inputCls} value={tipoRegistro} onChange={(e) => setTipoRegistro(e.target.value)} disabled={loading} />
            </Field>
          </FlexCol>
          <FlexCol flex={1} min={140}>
            <Field label="Nosso numero">
              <input className={inputCls} value={identdNossoNum} onChange={(e) => setIdentdNossoNum(e.target.value)} disabled={loading} />
            </Field>
          </FlexCol>
        </div>
      </Card>

      <Card title="Pagador">
        <div className="flex flex-wrap gap-2">
          <FlexCol flex={1} min={130}>
            <Field label="Tipo de pessoa">
              <select className={selectCls} value={tipoPessoa} onChange={(e) => setTipoPessoa(e.target.value)} disabled={loading}>
                <option value="1">Fisica</option>
                <option value="2">Juridica</option>
              </select>
            </Field>
          </FlexCol>
          <FlexCol flex={1} min={150}>
            <Field label="Documento (CPF/CNPJ) *">
              <input className={inputCls} value={documentoFederal} onChange={(e) => setDocumentoFederal(e.target.value)} disabled={loading} />
            </Field>
          </FlexCol>
          <FlexCol flex={2} min={220}>
            <Field label="Nome / Razao social *">
              <input className={inputCls} value={nomeRazao} onChange={(e) => setNomeRazao(e.target.value)} disabled={loading} />
            </Field>
          </FlexCol>
          <FlexCol flex={1} min={150}>
            <Field label="Nome fantasia">
              <input className={inputCls} value={nomeFantasia} onChange={(e) => setNomeFantasia(e.target.value)} disabled={loading} />
            </Field>
          </FlexCol>
        </div>

        <div className="flex flex-wrap gap-2 mt-2">
          <FlexCol flex={3} min={220}>
            <Field label="Logradouro">
              <input className={inputCls} value={logradouro} onChange={(e) => setLogradouro(e.target.value)} disabled={loading} />
            </Field>
          </FlexCol>
          <FlexCol flex={0.5} min={90}>
            <Field label="Numero">
              <input className={inputCls} value={numeroEndereco} onChange={(e) => setNumeroEndereco(e.target.value)} disabled={loading} />
            </Field>
          </FlexCol>
          <FlexCol flex={1} min={130}>
            <Field label="Complemento">
              <input className={inputCls} value={complemento} onChange={(e) => setComplemento(e.target.value)} disabled={loading} />
            </Field>
          </FlexCol>
          <FlexCol flex={1} min={130}>
            <Field label="Bairro">
              <input className={inputCls} value={bairro} onChange={(e) => setBairro(e.target.value)} disabled={loading} />
            </Field>
          </FlexCol>
          <FlexCol flex={1} min={130}>
            <Field label="Cidade">
              <input className={inputCls} value={cidade} onChange={(e) => setCidade(e.target.value)} disabled={loading} />
            </Field>
          </FlexCol>
          <FlexCol flex={0.3} min={70}>
            <Field label="UF">
              <input className={inputCls} value={uf} onChange={(e) => setUf(e.target.value)} maxLength={2} disabled={loading} />
            </Field>
          </FlexCol>
          <FlexCol flex={0.8} min={110}>
            <Field label="CEP">
              <input className={inputCls} value={cep} onChange={(e) => setCep(e.target.value)} disabled={loading} />
            </Field>
          </FlexCol>
        </div>

        <div className="flex flex-wrap gap-2 mt-2">
          <FlexCol flex={2} min={220}>
            <Field label="E-mail">
              <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
            </Field>
          </FlexCol>
          <FlexCol flex={0.8} min={130}>
            <Field label="Telefone">
              <input className={inputCls} value={telefone} onChange={(e) => setTelefone(e.target.value)} disabled={loading} />
            </Field>
          </FlexCol>
          <FlexCol flex={0.5} min={110}>
            <Field label="Tipo">
              <select className={selectCls} value={sacadorTipo} onChange={(e) => setSacadorTipo(e.target.value)} disabled={loading}>
                {TIPO_SACADOR_AVALISTA.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
          </FlexCol>
          <FlexCol flex={1} min={180}>
            <Field label="Identificador (CPF/CNPJ)">
              <input className={inputCls} value={sacadorIdentificador} onChange={(e) => setSacadorIdentificador(e.target.value)} disabled={loading} />
            </Field>
          </FlexCol>
          <FlexCol flex={3} min={220}>
            <Field label="Nome do sacador avalista">
              <input className={inputCls} value={sacadorNome} onChange={(e) => setSacadorNome(e.target.value)} disabled={loading} />
            </Field>
          </FlexCol>
        </div>
      </Card>

      <Card title="Condicoes">
        <div className="flex flex-wrap gap-2">
          <ItemCalculavelFields
            bare
            labelPrefix="juros"
            data={jurosData}
            codigo={jurosCodigo}
            vlr={jurosVlr}
            disabled={loading}
            onChange={(patch) => {
              if ('data' in patch) setJurosData(patch.data)
              if ('codigo' in patch) setJurosCodigo(patch.codigo)
              if ('vlr' in patch) setJurosVlr(patch.vlr)
            }}
          />
          <ItemCalculavelFields
            bare
            labelPrefix="multa"
            data={multaData}
            codigo={multaCodigo}
            vlr={multaVlr}
            disabled={loading}
            onChange={(patch) => {
              if ('data' in patch) setMultaData(patch.data)
              if ('codigo' in patch) setMultaCodigo(patch.codigo)
              if ('vlr' in patch) setMultaVlr(patch.vlr)
            }}
          />
          <ItemCalculavelFields
            bare
            labelPrefix="desconto"
            data={descontoData}
            codigo={descontoCodigo}
            vlr={descontoVlr}
            disabled={loading}
            onChange={(patch) => {
              if ('data' in patch) setDescontoData(patch.data)
              if ('codigo' in patch) setDescontoCodigo(patch.codigo)
              if ('vlr' in patch) setDescontoVlr(patch.vlr)
            }}
          />
        </div>

        <div className="mt-2 pt-4 border-t border-[#2a2a2a]">
          <div className="flex items-center justify-end mb-2">
            <SecondaryButton type="button" onClick={addDescontoRow} disabled={loading}>
              + Adicionar desconto
            </SecondaryButton>
          </div>
          <div className="space-y-2">
            {descontos.map((row) => (
              <div key={row._id} className="flex items-start gap-2">
                <div className="flex-1">
                  <ItemCalculavelFields
                    data={row.data}
                    codigo={row.codigo}
                    vlr={row.vlr}
                    disabled={loading}
                    onChange={(patch) => updateDescontoRow(row._id, patch)}
                  />
                </div>
                <SecondaryButton type="button" onClick={() => removeDescontoRow(row._id)} disabled={loading}>
                  Remover
                </SecondaryButton>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <div className="flex-1 min-w-[320px]">
          <Card title="Recorrencia" description="Para boletos parcelados ou recorrentes.">
            <label className="flex items-center gap-2 text-xs text-[#a3a3a3] mb-2">
              <input type="checkbox" checked={recorrenciaAtiva} onChange={(e) => setRecorrenciaAtiva(e.target.checked)} disabled={loading} />
              Incluir recorrencia
            </label>
            {recorrenciaAtiva && (
              <div className="flex flex-wrap gap-2">
                <FlexCol flex={2} min={160}>
                  <Field label="Tipo">
                    <select className={selectCls} value={recorrenciaTipo} onChange={(e) => setRecorrenciaTipo(e.target.value)} disabled={loading}>
                      {TIPO_RECORRENCIA.map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </Field>
                </FlexCol>
                <FlexCol flex={2} min={160}>
                  <Field label="Modelo">
                    <select className={selectCls} value={recorrenciaModelo} onChange={(e) => setRecorrenciaModelo(e.target.value)} disabled={loading}>
                      {MODELO_RECORRENCIA.map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </Field>
                </FlexCol>
                <FlexCol flex={1} min={110}>
                  <Field label="Quantidade">
                    <input className={inputCls} value={recorrenciaQtd} onChange={(e) => setRecorrenciaQtd(e.target.value)} disabled={loading} />
                  </Field>
                </FlexCol>
                <FlexCol flex={2} min={170}>
                  <Field label="Dia fixo da recorrencia">
                    <input className={inputCls} value={recorrenciaDiaFixo} onChange={(e) => setRecorrenciaDiaFixo(e.target.value)} disabled={loading} />
                  </Field>
                </FlexCol>
              </div>
            )}
          </Card>
        </div>

        <div className="flex-1 min-w-[280px]">
          <Card title="Instrucoes ao beneficiario" description="Uma instrucao por linha (mensagens impressas no boleto).">
            <Field label="Instrucoes">
              <textarea
                className={textareaCls}
                rows={3}
                value={instrucoesBeneficiario}
                onChange={(e) => setInstrucoesBeneficiario(e.target.value)}
                disabled={loading}
              />
            </Field>
          </Card>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-2">
          <Feedback feedback={feedback} />
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? 'Registrando...' : 'Registrar Boleto'}
          </PrimaryButton>
        </form>

        {resultado && (
          <div className="mt-2 space-y-2">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <div className="bg-[#111111] border border-[#2a2a2a] rounded-md p-2">
                <p className="text-[11px] text-[#a3a3a3] mb-1">Codigo do boleto</p>
                <p className="text-white text-sm font-medium break-all">{resultado.codigoBoleto ?? '-'}</p>
              </div>
              <div className="bg-[#111111] border border-[#2a2a2a] rounded-md p-2">
                <p className="text-[11px] text-[#a3a3a3] mb-1">Nosso numero</p>
                <p className="text-white text-sm font-medium break-all">{resultado.identdNossoNum ?? '-'}</p>
              </div>
              <div className="bg-[#111111] border border-[#2a2a2a] rounded-md p-2">
                <p className="text-[11px] text-[#a3a3a3] mb-1">Numero do documento</p>
                <p className="text-white text-sm font-medium break-all">{resultado.numDocTit ?? '-'}</p>
              </div>
              <div className="bg-[#111111] border border-[#2a2a2a] rounded-md p-2 col-span-2 md:col-span-3">
                <p className="text-[11px] text-[#a3a3a3] mb-1">Codigo de barras</p>
                <p className="text-white text-sm font-medium break-all">{resultado.numCodBarras ?? '-'}</p>
              </div>
              <div className="bg-[#111111] border border-[#2a2a2a] rounded-md p-2 col-span-2 md:col-span-3">
                <p className="text-[11px] text-[#a3a3a3] mb-1">Linha digitavel</p>
                <p className="text-white text-sm font-medium break-all">{resultado.numLinhaDigtvl ?? '-'}</p>
              </div>
            </div>

            <details className="bg-[#111111] border border-[#2a2a2a] rounded-md p-2">
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
