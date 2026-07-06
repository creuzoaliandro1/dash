import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Field, Feedback, Card, PrimaryButton, inputCls, selectCls, extractError } from './shared'

const TIPO_CONTA_OPTIONS = [
  { value: '3', label: 'Corrente (3)' },
  { value: '2', label: 'Poupança (2)' },
  { value: '-1', label: 'Pagamento (-1)' },
  { value: '4', label: 'Salário (4)' },
]

const MODELO_CONTA_OPTIONS = [
  { value: '1', label: 'Movimento (1)' },
  { value: '2', label: 'Escrow (2)' },
  { value: '3', label: 'Vinculada (3)' },
]

// Valores conforme enum BMPSPB.Infra.Enums.TipoGeracaoConta da doc do BMP.
// Observação da doc: número da conta é obrigatório em Manual (0) e NÃO deve
// ser informado em Sequencial (1) — o BMP gera o número automaticamente.
// 06/07/2026: BMP respondeu "Tipo de geração de conta não autorizado" quando
// o campo não era enviado (caía no padrão Manual/0) — parceiro Capt parece só
// estar autorizado para geração Sequencial, por isso o default abaixo é '1'.
const TIPO_GERACAO_CONTA_OPTIONS = [
  { value: '1', label: 'Sequencial (1) — BMP gera o número' },
  { value: '0', label: 'Manual (0) — informo o número' },
]

// Valores conforme enum BMPSPB.Infra.Enums.EstadoCivil da doc do BMP.
const ESTADO_CIVIL_OPTIONS = [
  { value: '1', label: 'Solteiro (1)' },
  { value: '2', label: 'Casado (2)' },
  { value: '3', label: 'Desquitado (3)' },
  { value: '4', label: 'Divorciado (4)' },
  { value: '5', label: 'Separado (5)' },
  { value: '6', label: 'Viúvo (6)' },
  { value: '7', label: 'Outros (7)' },
  { value: '8', label: 'Não Informado (8)' },
  { value: '9', label: 'Vínculo Conjugal (9)' },
]

// Valores conforme enum BMPSPB.Infra.Enums.TipoDocumentoEmpresa da doc do BMP.
const TIPO_EMPRESA_OPTIONS = [
  { value: '1', label: 'MEI (1)' },
  { value: '2', label: 'Empresário Individual (2)' },
  { value: '3', label: 'Sociedade Limitada Unipessoal (3)' },
  { value: '4', label: 'Sociedade Empresária Limitada (4)' },
  { value: '5', label: 'Sociedade Simples (5)' },
  { value: '6', label: 'Sociedade Anônima (6)' },
  { value: '7', label: 'Sociedade Cooperativa (7)' },
  { value: '8', label: 'Sociedade de Associação Privada (8)' },
  { value: '9', label: 'Condomínio Edifício (9)' },
]

const initialForm = {
  numeroBanco: '',
  numeroAgencia: '',
  numeroConta: '',
  digitoConta: '',
  descricao: '',
  tipoGeracaoNumeroConta: '1',
  tipoConta: '3',
  modeloConta: '1',
  // Correntista
  documentoFederal: '',
  nome: '',
  tipoPessoa: '1',
  situacao: '1', // 1=Ativado, 2=Desativado (BMP espera um integer, não string vazia)
  // Contato
  email: '',
  telefoneCelular1: '',
  telefoneFixo1: '',
  // Endereço
  cep: '',
  logradouro: '',
  nroLogradouro: '',
  bairro: '',
  complemento: '',
  cidade: '',
  uf: '',
  // PF
  dtNasc: '',
  sexo: 'M',
  nacionalidade: '',
  estadoCivil: '',
  profissao: '',
  renda: '',
  // PJ
  nomeFantasia: '',
  dtAberturaEmpresa: '',
  capitalSocial: '',
  faturamentoAnual: '',
  tipoEmpresa: '',
}

function CriarContaForm() {
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resultado, setResultado] = useState(null)

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResultado(null)

    const geracaoManual = form.tipoGeracaoNumeroConta === '0'
    if (!form.numeroBanco || !form.numeroAgencia) {
      setFeedback({ ok: false, message: 'Informe numeroBanco e numeroAgencia.' })
      return
    }
    if (geracaoManual && !form.numeroConta) {
      setFeedback({ ok: false, message: 'Informe o número da conta (obrigatório quando a geração é Manual).' })
      return
    }
    if (!form.documentoFederal || !form.nome) {
      setFeedback({ ok: false, message: 'Informe o documento federal e o nome do correntista.' })
      return
    }

    setSubmitting(true)
    try {
      const body = {
        numeroBanco: form.numeroBanco,
        numeroAgencia: form.numeroAgencia,
        // Sequencial (1): não envia numeroConta — o BMP gera o número.
        // Manual (0): envia o numeroConta digitado.
        numeroConta: geracaoManual ? form.numeroConta : null,
        digitoConta: form.digitoConta,
        descricao: form.descricao,
        tipoGeracaoNumeroConta: Number(form.tipoGeracaoNumeroConta),
        tipoConta: Number(form.tipoConta),
        modeloConta: Number(form.modeloConta),
        dadosCorrentista: {
          documentoFederal: form.documentoFederal,
          nome: form.nome,
          tipoPessoa: Number(form.tipoPessoa),
          situacao: Number(form.situacao),
        },
        dadosContato: {
          email: form.email,
          telefoneCelular1: form.telefoneCelular1,
          telefoneFixo1: form.telefoneFixo1,
        },
        dadosEndereco: {
          cep: form.cep,
          logradouro: form.logradouro,
          nroLogradouro: form.nroLogradouro,
          bairro: form.bairro,
          complemento: form.complemento,
          cidade: form.cidade,
          uf: form.uf,
        },
      }

      if (form.tipoPessoa === '1') {
        body.dadosPF = {
          dtNasc: form.dtNasc,
          sexo: form.sexo,
          nacionalidade: form.nacionalidade,
          estadoCivil: form.estadoCivil ? Number(form.estadoCivil) : null,
          profissao: form.profissao,
          renda: Number(form.renda) || 0,
        }
      } else if (form.tipoPessoa === '2') {
        body.dadosPJ = {
          nomeFantasia: form.nomeFantasia,
          dtAberturaEmpresa: form.dtAberturaEmpresa,
          capitalSocial: Number(form.capitalSocial) || 0,
          faturamentoAnual: Number(form.faturamentoAnual) || 0,
          tipoEmpresa: form.tipoEmpresa ? Number(form.tipoEmpresa) : null,
        }
      }

      const { data, error } = await supabase.functions.invoke('bmp-conta-criar', { body })
      const errMsg = extractError(data, error, 'Erro ao criar a conta.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setFeedback({ ok: true, message: 'Conta criada com sucesso.' })
        setResultado(data)
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card title="Criar conta" description="Cadastra uma nova conta digital via API Conta do BMP.">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">Dados da conta</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <Field label="Número do banco">
              <input className={inputCls} value={form.numeroBanco} onChange={set('numeroBanco')} disabled={submitting} />
            </Field>
            <Field label="Número da agência">
              <input className={inputCls} value={form.numeroAgencia} onChange={set('numeroAgencia')} disabled={submitting} />
            </Field>
            <Field label="Tipo de geração de conta">
              <select className={selectCls} value={form.tipoGeracaoNumeroConta} onChange={set('tipoGeracaoNumeroConta')} disabled={submitting}>
                {TIPO_GERACAO_CONTA_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Número da conta">
              <input
                className={inputCls}
                value={form.numeroConta}
                onChange={set('numeroConta')}
                disabled={submitting || form.tipoGeracaoNumeroConta === '1'}
                placeholder={form.tipoGeracaoNumeroConta === '1' ? 'Gerado automaticamente pelo BMP' : ''}
              />
            </Field>
            <Field label="Dígito da conta">
              <input className={inputCls} value={form.digitoConta} onChange={set('digitoConta')} disabled={submitting} />
            </Field>
            <Field label="Descrição">
              <input className={inputCls} value={form.descricao} onChange={set('descricao')} disabled={submitting} />
            </Field>
            <Field label="Tipo de conta">
              <select className={selectCls} value={form.tipoConta} onChange={set('tipoConta')} disabled={submitting}>
                {TIPO_CONTA_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Modelo de conta">
              <select className={selectCls} value={form.modeloConta} onChange={set('modeloConta')} disabled={submitting}>
                {MODELO_CONTA_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">Correntista</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <Field label="Documento federal (CPF/CNPJ)">
              <input className={inputCls} value={form.documentoFederal} onChange={set('documentoFederal')} disabled={submitting} />
            </Field>
            <Field label="Nome">
              <input className={inputCls} value={form.nome} onChange={set('nome')} disabled={submitting} />
            </Field>
            <Field label="Tipo de pessoa">
              <select className={selectCls} value={form.tipoPessoa} onChange={set('tipoPessoa')} disabled={submitting}>
                <option value="1">Pessoa Física (1)</option>
                <option value="2">Pessoa Jurídica (2)</option>
              </select>
            </Field>
            <Field label="Situação">
              <select className={selectCls} value={form.situacao} onChange={set('situacao')} disabled={submitting}>
                <option value="1">Ativado (1)</option>
                <option value="2">Desativado (2)</option>
              </select>
            </Field>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">Contato</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <Field label="E-mail">
              <input type="email" className={inputCls} value={form.email} onChange={set('email')} disabled={submitting} />
            </Field>
            <Field label="Telefone celular">
              <input className={inputCls} value={form.telefoneCelular1} onChange={set('telefoneCelular1')} disabled={submitting} />
            </Field>
            <Field label="Telefone fixo">
              <input className={inputCls} value={form.telefoneFixo1} onChange={set('telefoneFixo1')} disabled={submitting} />
            </Field>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">Endereço</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <Field label="CEP">
              <input className={inputCls} value={form.cep} onChange={set('cep')} disabled={submitting} />
            </Field>
            <Field label="Logradouro">
              <input className={inputCls} value={form.logradouro} onChange={set('logradouro')} disabled={submitting} />
            </Field>
            <Field label="Número">
              <input className={inputCls} value={form.nroLogradouro} onChange={set('nroLogradouro')} disabled={submitting} />
            </Field>
            <Field label="Bairro">
              <input className={inputCls} value={form.bairro} onChange={set('bairro')} disabled={submitting} />
            </Field>
            <Field label="Complemento">
              <input className={inputCls} value={form.complemento} onChange={set('complemento')} disabled={submitting} />
            </Field>
            <Field label="Cidade">
              <input className={inputCls} value={form.cidade} onChange={set('cidade')} disabled={submitting} />
            </Field>
            <Field label="UF">
              <input className={inputCls} value={form.uf} onChange={set('uf')} disabled={submitting} maxLength={2} />
            </Field>
          </div>
        </div>

        {form.tipoPessoa === '1' && (
          <div>
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">Dados PF</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <Field label="Data de nascimento">
                <input type="date" className={inputCls} value={form.dtNasc} onChange={set('dtNasc')} disabled={submitting} />
              </Field>
              <Field label="Sexo">
                <select className={selectCls} value={form.sexo} onChange={set('sexo')} disabled={submitting}>
                  <option value="F">Feminino (F)</option>
                  <option value="M">Masculino (M)</option>
                </select>
              </Field>
              <Field label="Nacionalidade">
                <input className={inputCls} value={form.nacionalidade} onChange={set('nacionalidade')} disabled={submitting} />
              </Field>
              <Field label="Estado civil">
                <select className={selectCls} value={form.estadoCivil} onChange={set('estadoCivil')} disabled={submitting}>
                  <option value="">—</option>
                  {ESTADO_CIVIL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Profissão">
                <input className={inputCls} value={form.profissao} onChange={set('profissao')} disabled={submitting} />
              </Field>
              <Field label="Renda">
                <input type="number" className={inputCls} value={form.renda} onChange={set('renda')} disabled={submitting} />
              </Field>
            </div>
          </div>
        )}

        {form.tipoPessoa === '2' && (
          <div>
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">Dados PJ</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <Field label="Nome fantasia">
                <input className={inputCls} value={form.nomeFantasia} onChange={set('nomeFantasia')} disabled={submitting} />
              </Field>
              <Field label="Data de abertura da empresa">
                <input type="date" className={inputCls} value={form.dtAberturaEmpresa} onChange={set('dtAberturaEmpresa')} disabled={submitting} />
              </Field>
              <Field label="Capital social">
                <input type="number" className={inputCls} value={form.capitalSocial} onChange={set('capitalSocial')} disabled={submitting} />
              </Field>
              <Field label="Faturamento anual">
                <input type="number" className={inputCls} value={form.faturamentoAnual} onChange={set('faturamentoAnual')} disabled={submitting} />
              </Field>
              <Field label="Tipo de empresa">
                <select className={selectCls} value={form.tipoEmpresa} onChange={set('tipoEmpresa')} disabled={submitting}>
                  <option value="">—</option>
                  {TIPO_EMPRESA_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        )}

        <Feedback feedback={feedback} />

        {resultado && (
          <div className="p-3 rounded-md text-xs border bg-[#111111] border-[#2a2a2a] text-[#d4d4d4] space-y-1">
            <p><span className="text-[#a3a3a3]">Número:</span> {resultado.numero ?? '—'}</p>
            <p><span className="text-[#a3a3a3]">Dígito:</span> {resultado.digito ?? '—'}</p>
            <p><span className="text-[#a3a3a3]">Conta pagamento:</span> {resultado.contaPagamento ?? '—'}</p>
          </div>
        )}

        <PrimaryButton type="submit" disabled={submitting}>
          {submitting ? 'Criando...' : 'Criar conta'}
        </PrimaryButton>
      </form>
    </Card>
  )
}

function ConsultarContaForm() {
  const [documentoFederal, setDocumentoFederal] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [contas, setContas] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setContas(null)

    if (!documentoFederal) {
      setFeedback({ ok: false, message: 'Informe o documento federal.' })
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-conta-consultar-documento', {
        body: { documentoFederal },
      })
      const errMsg = extractError(data, error, 'Erro ao consultar as contas.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setContas(data?.contas || [])
        if (!data?.contas || data.contas.length === 0) {
          setFeedback({ ok: true, message: 'Nenhuma conta encontrada para este documento.' })
        }
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="Consultar conta por documento" description="Busca as contas vinculadas a um CPF/CNPJ.">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Field label="Documento federal (CPF/CNPJ)">
              <input
                className={inputCls}
                value={documentoFederal}
                onChange={(e) => setDocumentoFederal(e.target.value)}
                disabled={loading}
              />
            </Field>
          </div>
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? 'Buscando...' : 'Buscar'}
          </PrimaryButton>
        </div>

        <Feedback feedback={feedback} />

        {contas && contas.length > 0 && (
          <div className="overflow-x-auto border border-[#2a2a2a] rounded-md">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#141414] text-[#666666] uppercase tracking-wider">
                  <th className="text-left px-3 py-2">Agência</th>
                  <th className="text-left px-3 py-2">Conta</th>
                  <th className="text-left px-3 py-2">Conta Pgto</th>
                  <th className="text-left px-3 py-2">Tipo</th>
                  <th className="text-left px-3 py-2">Modelo</th>
                  <th className="text-left px-3 py-2">Situação</th>
                  <th className="text-left px-3 py-2">Bloqueio</th>
                  <th className="text-left px-3 py-2">Vlr. bloqueado</th>
                </tr>
              </thead>
              <tbody>
                {contas.map((c, i) => (
                  <tr key={i} className="border-t border-[#1a1a1a] text-[#d4d4d4]">
                    <td className="px-3 py-2">{c.agencia}</td>
                    <td className="px-3 py-2">{c.conta}</td>
                    <td className="px-3 py-2">{c.contaPgto}</td>
                    <td className="px-3 py-2">{c.tipoConta}</td>
                    <td className="px-3 py-2">{c.modeloConta}</td>
                    <td className="px-3 py-2">{c.situacao}</td>
                    <td className="px-3 py-2">{c.tipoBloqueio ?? '—'}</td>
                    <td className="px-3 py-2">{c.valorBloqueado ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </form>
    </Card>
  )
}

export default function CadastroTab() {
  return (
    <div className="space-y-3 w-full">
      <CriarContaForm />
      <ConsultarContaForm />
    </div>
  )
}
