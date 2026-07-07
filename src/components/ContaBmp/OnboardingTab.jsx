import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Field, Feedback, Card, PrimaryButton, SecondaryButton, inputCls, selectCls, extractError, formatDataHora } from './shared'

// ============================================================================
// Fluxo de Onboarding de conta (BMP docs 76-81) — OBRIGATÓRIO pro parceiro
// Capt: o endpoint legado /api/v2/Conta (aba "Cadastro") responde "O parceiro
// deve utilizar o fluxo de onboarding para a abertura de contas" (confirmado
// em homologação em 06/07/2026). Este é o fluxo que efetivamente funciona.
//
// Etapas: 1) Solicitar (dados do titular/PF ou PJ+sócios/credor/controlador
// opcionais) → recebe um código de solicitação (uuid) → 2) Enviar documentos
// (titular e, se PJ, cada sócio) → 3) Finalizar (envia pra análise do BMP,
// que aprova manualmente depois — não há retorno síncrono de aprovação).
// A qualquer momento antes de Finalizar dá pra Atualizar dados ou Cancelar.
// ============================================================================

const TIPO_PESSOA_OPTIONS = [
  { value: '1', label: 'Pessoa Física (1)' },
  { value: '2', label: 'Pessoa Jurídica (2)' },
]

const MODELO_CONTA_OPTIONS = [
  { value: '1', label: 'Movimento (1)' },
  { value: '2', label: 'Escrow (2)' },
]

const GENERO_OPTIONS = [
  { value: 'F', label: 'Feminino (F)' },
  { value: 'M', label: 'Masculino (M)' },
  { value: 'O', label: 'Outros (O)' },
]

const ESTADO_CIVIL_OPTIONS = [
  { value: '1', label: 'Solteiro (1)' },
  { value: '2', label: 'Casado (2)' },
  { value: '3', label: 'Desquitado (3)' },
  { value: '4', label: 'Divorciado (4)' },
  { value: '5', label: 'Separado (5)' },
  { value: '6', label: 'Viúvo (6)' },
  { value: '7', label: 'Outros (7)' },
  { value: '8', label: 'Não informado (8)' },
  { value: '9', label: 'Vínculo conjugal (9)' },
]

const INDICADOR_PEP_OPTIONS = [
  { value: '1', label: 'Sim (1)' },
  { value: '2', label: 'Não (2)' },
]

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

const RESPONSABILIDADE_SOCIO_OPTIONS = [
  { value: '1', label: 'Sócio (1)' },
  { value: '2', label: 'Representante legal (2)' },
  { value: '3', label: 'Procurador (3)' },
]

const TIPO_OPERACAO_OPTIONS = [
  { value: '1', label: 'Empréstimo (1)' },
  { value: '2', label: 'Garantia (2)' },
  { value: '3', label: 'Cessão (3)' },
  { value: '4', label: 'Desconto (4)' },
  { value: '5', label: 'Limite crédito (5)' },
  { value: '6', label: 'Antecipação recebíveis (6)' },
  { value: '99', label: 'Outros (99)' },
]

const TIPO_EMPRESA_CONTROLADOR_OPTIONS = [
  { value: '1', label: 'FIDC (1)' },
  { value: '2', label: 'Factory (2)' },
  { value: '3', label: 'Securitizadora (3)' },
  { value: '4', label: 'Outros (4)' },
  { value: '5', label: 'Titular (5)' },
  { value: '6', label: 'Credor (6)' },
  { value: '7', label: 'Administrador (7)' },
  { value: '8', label: 'Consultoria especializada (8)' },
  { value: '9', label: 'Agente depositário (9)' },
]

const TIPO_DOCUMENTO_OPTIONS = [
  { value: '1', label: 'Identificação (1)' },
  { value: '2', label: 'Termo aceite (2)' },
  { value: '3', label: 'Contrato social (3)' },
  { value: '4', label: 'Procuração (4)' },
  { value: '5', label: 'MEI (5)' },
  { value: '6', label: 'Empresário individual (6)' },
  { value: '7', label: 'Sociedade limitada unipessoal (7)' },
  { value: '8', label: 'Sociedade empresária limitada (8)' },
  { value: '9', label: 'Sociedade simples (9)' },
  { value: '10', label: 'Sociedade anônima (10)' },
  { value: '11', label: 'Sociedade cooperativa (11)' },
  { value: '12', label: 'Sociedade de associação privada (12)' },
  { value: '13', label: 'Condomínio edifício (13)' },
]

const TIPO_ENTIDADE_OPTIONS = [
  { value: '1', label: 'Correntista (1)' },
  { value: '2', label: 'Sócio (2)' },
  { value: '3', label: 'Controlador (3)' },
  { value: '4', label: 'Operador front-end (4)' },
  { value: '5', label: 'Credor (5)' },
]

const emptySocio = () => ({
  nome: '', documentoFederal: '', email: '', responsabilidade: '1', telefoneCelular: '',
  dtNascimento: '', rg: '', dataEmissao: '', orgaoExpedidor: '', nomeMae: '', nomePai: '',
  estadoCivil: '', cep: '', logradouro: '', nroLogradouro: '', bairro: '', complemento: '',
  cidade: '', uf: '', indicadorPEP: '', nomeConjuge: '', cpfConjuge: '', nacionalidade: '',
  genero: 'M', profissao: '', renda: '',
})

const emptyForm = {
  contaCaptId: '',
  documentoFederal: '',
  nome: '',
  tipoPessoa: '1',
  modeloConta: '1',
  cep: '', logradouro: '', nroLogradouro: '', bairro: '', complemento: '', cidade: '', uf: '',
  email: '', telefoneCelular: '',
  // PF
  outroDocumento: '', dtExpedicaoOutroDocumento: '', orgaoExpedidorOutroDocumento: '',
  dtNasc: '', genero: 'M', nacionalidade: '', estadoCivil: '', nomePai: '', nomeMae: '',
  nomeConjuge: '', cpfConjuge: '', indicadorPEP: '', renda: '', profissao: '',
  // PJ
  dtAberturaEmpresa: '', capitalSocial: '', faturamentoAnual: '', tipoEmpresa: '',
  codigoCnae: '', cnaeLabel: '',
  // Credor / Controlador (opcionais)
  temCredor: false,
  credorNome: '', credorDocumentoFederal: '', credorTipoOperacao: '1', credorPrazoOperacao: '',
  credorValorOperacao: '', credorInformacaoAdicional: '',
  temControlador: false,
  controladorDocumentoFederal: '', controladorNome: '', controladorTelefoneCelular: '',
  controladorEmail: '', controladorCep: '', controladorLogradouro: '', controladorNroLogradouro: '',
  controladorBairro: '', controladorComplemento: '', controladorCidade: '', controladorUf: '',
  controladorTipoEmpresa: '',
}

function CnaeBusca({ value, label, onSelect, disabled }) {
  const [filtro, setFiltro] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [opcoes, setOpcoes] = useState([])
  const [erro, setErro] = useState(null)

  const buscar = async () => {
    setBuscando(true)
    setErro(null)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-onboarding-cnaes-listar', { body: { filtro } })
      const errMsg = extractError(data, error, 'Erro ao buscar CNAEs.')
      if (errMsg) {
        setErro(errMsg)
        setOpcoes([])
      } else {
        setOpcoes(Array.isArray(data?.cnaes) ? data.cnaes : [])
      }
    } catch (err) {
      setErro(err.message || 'Erro ao conectar.')
    } finally {
      setBuscando(false)
    }
  }

  return (
    <div>
      <label className="block text-xs font-medium text-[#a3a3a3] mb-0.5">CNAE</label>
      <div className="flex gap-2">
        <input
          className={inputCls}
          placeholder="Buscar por descrição ou número..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          disabled={disabled}
        />
        <SecondaryButton type="button" onClick={buscar} disabled={disabled || buscando}>
          {buscando ? 'Buscando...' : 'Buscar'}
        </SecondaryButton>
      </div>
      {erro && <p className="text-red-300 text-xs mt-1">{erro}</p>}
      {label && (
        <p className="text-xs text-[#d4d4d4] mt-1">
          Selecionado: <span className="text-white">{label}</span>
        </p>
      )}
      {opcoes.length > 0 && (
        <div className="mt-1 max-h-40 overflow-y-auto border border-[#2a2a2a] rounded-md">
          {opcoes.map((o) => (
            <button
              type="button"
              key={o.codigo}
              onClick={() => {
                onSelect(o.codigo, `${o.numero ?? ''} — ${o.descricao ?? ''}`.trim())
                setOpcoes([])
              }}
              className="w-full text-left px-2 py-1.5 text-xs text-[#d4d4d4] hover:bg-[#1a1a1a] border-b border-[#1a1a1a] last:border-b-0"
            >
              {o.numero ? `${o.numero} — ` : ''}{o.descricao}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SolicitarForm({ onSolicitado }) {
  const [form, setForm] = useState(emptyForm)
  const [socios, setSocios] = useState([emptySocio()])
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resultado, setResultado] = useState(null)

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))
  const setChecked = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.checked }))

  const setSocio = (idx, key) => (e) => {
    const value = e.target.value
    setSocios((prev) => prev.map((s, i) => (i === idx ? { ...s, [key]: value } : s)))
  }
  const addSocio = () => setSocios((prev) => [...prev, emptySocio()])
  const removeSocio = (idx) => setSocios((prev) => prev.filter((_, i) => i !== idx))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setResultado(null)

    if (!form.documentoFederal || !form.nome) {
      setFeedback({ ok: false, message: 'Informe o documento federal e o nome do titular.' })
      return
    }
    if (!form.cep || !form.logradouro || !form.nroLogradouro || !form.bairro || !form.cidade || !form.uf) {
      setFeedback({ ok: false, message: 'Preencha todo o endereço do titular (obrigatório).' })
      return
    }
    if (!form.email || !form.telefoneCelular) {
      setFeedback({ ok: false, message: 'Preencha e-mail e telefone celular do titular (obrigatório).' })
      return
    }
    if (form.tipoPessoa === '2' && socios.length === 0) {
      setFeedback({ ok: false, message: 'Cadastre ao menos um sócio para pessoa jurídica.' })
      return
    }

    if (form.tipoPessoa === '1') {
      if (!form.dtNasc || !form.genero || !form.nacionalidade || !form.nomeMae || !form.profissao) {
        setFeedback({ ok: false, message: 'Preencha data de nascimento, gênero, nacionalidade, nome da mãe e profissão do titular (obrigatório).' })
        return
      }
    } else {
      if (!form.dtAberturaEmpresa || !form.tipoEmpresa || !form.codigoCnae) {
        setFeedback({ ok: false, message: 'Preencha data de abertura, tipo de empresa e CNAE (obrigatório).' })
        return
      }
      for (let i = 0; i < socios.length; i++) {
        const s = socios[i]
        if (!s.nome || !s.documentoFederal || !s.email || !s.telefoneCelular || !s.dtNascimento || !s.nomeMae ||
            !s.cep || !s.logradouro || !s.nroLogradouro || !s.bairro || !s.cidade || !s.uf ||
            !s.genero || !s.nacionalidade || !s.profissao) {
          setFeedback({ ok: false, message: `Preencha todos os campos obrigatórios do sócio ${i + 1} (nome, documento, e-mail, telefone, nascimento, mãe, endereço, gênero, nacionalidade, profissão).` })
          return
        }
      }
    }

    setSubmitting(true)
    try {
      const body = {
        contaCaptId: form.contaCaptId !== '' && Number.isFinite(Number(form.contaCaptId)) ? Number(form.contaCaptId) : null,
        documentoFederal: form.documentoFederal,
        nome: form.nome,
        tipoPessoa: Number(form.tipoPessoa),
        modeloConta: Number(form.modeloConta),
        endereco: {
          cep: form.cep,
          logradouro: form.logradouro,
          nroLogradouro: form.nroLogradouro,
          bairro: form.bairro,
          complemento: form.complemento || null,
          cidade: form.cidade,
          uf: form.uf,
        },
        contato: {
          email: form.email,
          telefoneCelular: form.telefoneCelular,
        },
      }

      if (form.tipoPessoa === '1') {
        body.pf = {
          outroDocumento: form.outroDocumento || null,
          dtExpedicaoOutroDocumento: form.dtExpedicaoOutroDocumento ? form.dtExpedicaoOutroDocumento : null,
          orgaoExpedidorOutroDocumento: form.orgaoExpedidorOutroDocumento || null,
          dtNasc: form.dtNasc,
          genero: form.genero,
          nacionalidade: form.nacionalidade,
          estadoCivil: form.estadoCivil ? Number(form.estadoCivil) : null,
          nomePai: form.nomePai || null,
          nomeMae: form.nomeMae,
          nomeConjuge: form.nomeConjuge || null,
          cpfConjuge: form.cpfConjuge || null,
          indicadorPEP: form.indicadorPEP ? Number(form.indicadorPEP) : null,
          renda: Number(form.renda) || 0,
          profissao: form.profissao,
        }
      } else {
        body.pj = {
          dtAberturaEmpresa: form.dtAberturaEmpresa,
          capitalSocial: Number(form.capitalSocial) || 0,
          faturamentoAnual: Number(form.faturamentoAnual) || 0,
          tipoEmpresa: form.tipoEmpresa ? Number(form.tipoEmpresa) : null,
          codigoCnae: form.codigoCnae || null,
          socios: socios.map((s) => ({
            nome: s.nome,
            documentoFederal: s.documentoFederal,
            email: s.email,
            responsabilidade: Number(s.responsabilidade),
            telefoneCelular: s.telefoneCelular,
            dtNascimento: s.dtNascimento,
            rg: s.rg || null,
            dataEmissao: s.dataEmissao || null,
            orgaoExpedidor: s.orgaoExpedidor || null,
            nomeMae: s.nomeMae,
            nomePai: s.nomePai || null,
            estadoCivil: s.estadoCivil ? Number(s.estadoCivil) : null,
            cep: s.cep,
            logradouro: s.logradouro,
            nroLogradouro: s.nroLogradouro,
            bairro: s.bairro,
            complemento: s.complemento || null,
            cidade: s.cidade,
            uf: s.uf,
            indicadorPEP: s.indicadorPEP ? Number(s.indicadorPEP) : null,
            nomeConjuge: s.nomeConjuge || null,
            cpfConjuge: s.cpfConjuge || null,
            nacionalidade: s.nacionalidade,
            genero: s.genero,
            profissao: s.profissao,
            renda: Number(s.renda) || 0,
          })),
        }
      }

      if (form.temCredor) {
        if (!form.credorNome || !form.credorDocumentoFederal || !form.credorPrazoOperacao) {
          setFeedback({ ok: false, message: 'Preencha nome, documento federal e prazo da operação do credor (obrigatório), ou desmarque "Incluir credor".' })
          setSubmitting(false)
          return
        }
        body.credor = {
          nome: form.credorNome,
          documentoFederal: form.credorDocumentoFederal,
          tipoOperacao: Number(form.credorTipoOperacao),
          prazoOperacao: form.credorPrazoOperacao,
          valorOperacao: Number(form.credorValorOperacao) || 0,
          informacaoAdicional: form.credorInformacaoAdicional || null,
        }
      }

      if (form.temControlador) {
        if (!form.controladorDocumentoFederal || !form.controladorNome || !form.controladorTelefoneCelular ||
            !form.controladorEmail || !form.controladorCep || !form.controladorLogradouro ||
            !form.controladorNroLogradouro || !form.controladorBairro || !form.controladorCidade || !form.controladorUf) {
          setFeedback({ ok: false, message: 'Preencha todos os campos obrigatórios do controlador, ou desmarque "Incluir controlador".' })
          setSubmitting(false)
          return
        }
        body.controlador = {
          documentoFederal: form.controladorDocumentoFederal,
          nome: form.controladorNome,
          telefoneCelular: form.controladorTelefoneCelular,
          email: form.controladorEmail,
          cep: form.controladorCep,
          logradouro: form.controladorLogradouro,
          nroLogradouro: form.controladorNroLogradouro,
          bairro: form.controladorBairro,
          complemento: form.controladorComplemento || null,
          cidade: form.controladorCidade,
          uf: form.controladorUf,
          tipoEmpresa: form.controladorTipoEmpresa ? Number(form.controladorTipoEmpresa) : null,
        }
      }

      const { data, error } = await supabase.functions.invoke('bmp-onboarding-conta-solicitar', { body })
      const errMsg = extractError(data, error, 'Erro ao solicitar abertura de conta.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setFeedback({ ok: true, message: 'Solicitação enviada com sucesso.' })
        setResultado(data)
        if (data?.codigoSolicitacao && onSolicitado) onSolicitado(data.codigoSolicitacao)
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card
      title="1. Solicitar abertura de conta (Onboarding)"
      description="Fluxo obrigatório do BMP para o parceiro Capt. Depois de solicitar, envie os documentos e finalize para submeter à análise do BMP."
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">Titular</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <Field label="ID conta Capt (opcional, uso interno — precisa ser número)">
              <input
                type="number"
                className={inputCls}
                value={form.contaCaptId}
                onChange={set('contaCaptId')}
                disabled={submitting}
                placeholder="ex: 123 (deixe em branco se não souber)"
              />
            </Field>
            <Field label="Documento federal (CPF/CNPJ)">
              <input className={inputCls} value={form.documentoFederal} onChange={set('documentoFederal')} disabled={submitting} />
            </Field>
            <Field label="Nome">
              <input className={inputCls} value={form.nome} onChange={set('nome')} disabled={submitting} />
            </Field>
            <Field label="Tipo de pessoa">
              <select className={selectCls} value={form.tipoPessoa} onChange={set('tipoPessoa')} disabled={submitting}>
                {TIPO_PESSOA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Modelo de conta">
              <select className={selectCls} value={form.modeloConta} onChange={set('modeloConta')} disabled={submitting}>
                {MODELO_CONTA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">Endereço do titular</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <Field label="CEP"><input className={inputCls} value={form.cep} onChange={set('cep')} disabled={submitting} /></Field>
            <Field label="Logradouro"><input className={inputCls} value={form.logradouro} onChange={set('logradouro')} disabled={submitting} /></Field>
            <Field label="Número"><input className={inputCls} value={form.nroLogradouro} onChange={set('nroLogradouro')} disabled={submitting} /></Field>
            <Field label="Bairro"><input className={inputCls} value={form.bairro} onChange={set('bairro')} disabled={submitting} /></Field>
            <Field label="Complemento"><input className={inputCls} value={form.complemento} onChange={set('complemento')} disabled={submitting} /></Field>
            <Field label="Cidade"><input className={inputCls} value={form.cidade} onChange={set('cidade')} disabled={submitting} /></Field>
            <Field label="UF"><input className={inputCls} value={form.uf} onChange={set('uf')} disabled={submitting} maxLength={2} /></Field>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">Contato do titular</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <Field label="E-mail"><input type="email" className={inputCls} value={form.email} onChange={set('email')} disabled={submitting} /></Field>
            <Field label="Telefone celular"><input className={inputCls} value={form.telefoneCelular} onChange={set('telefoneCelular')} disabled={submitting} /></Field>
          </div>
        </div>

        {form.tipoPessoa === '1' && (
          <div>
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">Dados PF</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <Field label="Data de nascimento"><input type="date" className={inputCls} value={form.dtNasc} onChange={set('dtNasc')} disabled={submitting} /></Field>
              <Field label="Gênero">
                <select className={selectCls} value={form.genero} onChange={set('genero')} disabled={submitting}>
                  {GENERO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Nacionalidade"><input className={inputCls} value={form.nacionalidade} onChange={set('nacionalidade')} disabled={submitting} /></Field>
              <Field label="Estado civil">
                <select className={selectCls} value={form.estadoCivil} onChange={set('estadoCivil')} disabled={submitting}>
                  <option value="">—</option>
                  {ESTADO_CIVIL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Nome da mãe"><input className={inputCls} value={form.nomeMae} onChange={set('nomeMae')} disabled={submitting} /></Field>
              <Field label="Nome do pai"><input className={inputCls} value={form.nomePai} onChange={set('nomePai')} disabled={submitting} /></Field>
              <Field label="Profissão"><input className={inputCls} value={form.profissao} onChange={set('profissao')} disabled={submitting} /></Field>
              <Field label="Renda"><input type="number" className={inputCls} value={form.renda} onChange={set('renda')} disabled={submitting} /></Field>
              <Field label="Indicador PEP">
                <select className={selectCls} value={form.indicadorPEP} onChange={set('indicadorPEP')} disabled={submitting}>
                  <option value="">—</option>
                  {INDICADOR_PEP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Nome do cônjuge"><input className={inputCls} value={form.nomeConjuge} onChange={set('nomeConjuge')} disabled={submitting} /></Field>
              <Field label="CPF do cônjuge"><input className={inputCls} value={form.cpfConjuge} onChange={set('cpfConjuge')} disabled={submitting} /></Field>
            </div>
          </div>
        )}

        {form.tipoPessoa === '2' && (
          <>
            <div>
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">Dados PJ</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <Field label="Data de abertura da empresa"><input type="date" className={inputCls} value={form.dtAberturaEmpresa} onChange={set('dtAberturaEmpresa')} disabled={submitting} /></Field>
                <Field label="Capital social"><input type="number" className={inputCls} value={form.capitalSocial} onChange={set('capitalSocial')} disabled={submitting} /></Field>
                <Field label="Faturamento anual"><input type="number" className={inputCls} value={form.faturamentoAnual} onChange={set('faturamentoAnual')} disabled={submitting} /></Field>
                <Field label="Tipo de empresa">
                  <select className={selectCls} value={form.tipoEmpresa} onChange={set('tipoEmpresa')} disabled={submitting}>
                    <option value="">—</option>
                    {TIPO_EMPRESA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
                <CnaeBusca
                  value={form.codigoCnae}
                  label={form.cnaeLabel}
                  disabled={submitting}
                  onSelect={(codigo, label) => setForm((prev) => ({ ...prev, codigoCnae: codigo, cnaeLabel: label }))}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Sócios</h3>
                <SecondaryButton type="button" onClick={addSocio} disabled={submitting}>+ Adicionar sócio</SecondaryButton>
              </div>
              <div className="space-y-3">
                {socios.map((s, idx) => (
                  <div key={idx} className="p-3 border border-[#2a2a2a] rounded-md space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#666666]">Sócio {idx + 1}</span>
                      {socios.length > 1 && (
                        <button type="button" onClick={() => removeSocio(idx)} disabled={submitting} className="text-xs text-red-400 hover:text-red-300">
                          Remover
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <Field label="Nome"><input className={inputCls} value={s.nome} onChange={setSocio(idx, 'nome')} disabled={submitting} /></Field>
                      <Field label="Documento federal"><input className={inputCls} value={s.documentoFederal} onChange={setSocio(idx, 'documentoFederal')} disabled={submitting} /></Field>
                      <Field label="E-mail"><input type="email" className={inputCls} value={s.email} onChange={setSocio(idx, 'email')} disabled={submitting} /></Field>
                      <Field label="Telefone celular"><input className={inputCls} value={s.telefoneCelular} onChange={setSocio(idx, 'telefoneCelular')} disabled={submitting} /></Field>
                      <Field label="Responsabilidade">
                        <select className={selectCls} value={s.responsabilidade} onChange={setSocio(idx, 'responsabilidade')} disabled={submitting}>
                          {RESPONSABILIDADE_SOCIO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </Field>
                      <Field label="Data de nascimento"><input type="date" className={inputCls} value={s.dtNascimento} onChange={setSocio(idx, 'dtNascimento')} disabled={submitting} /></Field>
                      <Field label="Gênero">
                        <select className={selectCls} value={s.genero} onChange={setSocio(idx, 'genero')} disabled={submitting}>
                          {GENERO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </Field>
                      <Field label="Nacionalidade"><input className={inputCls} value={s.nacionalidade} onChange={setSocio(idx, 'nacionalidade')} disabled={submitting} /></Field>
                      <Field label="Estado civil">
                        <select className={selectCls} value={s.estadoCivil} onChange={setSocio(idx, 'estadoCivil')} disabled={submitting}>
                          <option value="">—</option>
                          {ESTADO_CIVIL_OPTIONS.slice(0, 3).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </Field>
                      <Field label="Nome da mãe"><input className={inputCls} value={s.nomeMae} onChange={setSocio(idx, 'nomeMae')} disabled={submitting} /></Field>
                      <Field label="Profissão"><input className={inputCls} value={s.profissao} onChange={setSocio(idx, 'profissao')} disabled={submitting} /></Field>
                      <Field label="Renda"><input type="number" className={inputCls} value={s.renda} onChange={setSocio(idx, 'renda')} disabled={submitting} /></Field>
                      <Field label="CEP"><input className={inputCls} value={s.cep} onChange={setSocio(idx, 'cep')} disabled={submitting} /></Field>
                      <Field label="Logradouro"><input className={inputCls} value={s.logradouro} onChange={setSocio(idx, 'logradouro')} disabled={submitting} /></Field>
                      <Field label="Número"><input className={inputCls} value={s.nroLogradouro} onChange={setSocio(idx, 'nroLogradouro')} disabled={submitting} /></Field>
                      <Field label="Bairro"><input className={inputCls} value={s.bairro} onChange={setSocio(idx, 'bairro')} disabled={submitting} /></Field>
                      <Field label="Cidade"><input className={inputCls} value={s.cidade} onChange={setSocio(idx, 'cidade')} disabled={submitting} /></Field>
                      <Field label="UF"><input className={inputCls} value={s.uf} onChange={setSocio(idx, 'uf')} disabled={submitting} maxLength={2} /></Field>
                      <Field label="Indicador PEP">
                        <select className={selectCls} value={s.indicadorPEP} onChange={setSocio(idx, 'indicadorPEP')} disabled={submitting}>
                          <option value="">—</option>
                          {INDICADOR_PEP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div>
          <label className="flex items-center gap-2 text-xs text-[#a3a3a3] mb-2">
            <input type="checkbox" checked={form.temCredor} onChange={setChecked('temCredor')} disabled={submitting} />
            Incluir credor (operação com garantia/cessão/etc. — opcional)
          </label>
          {form.temCredor && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 border border-[#2a2a2a] rounded-md">
              <Field label="Nome"><input className={inputCls} value={form.credorNome} onChange={set('credorNome')} disabled={submitting} /></Field>
              <Field label="Documento federal"><input className={inputCls} value={form.credorDocumentoFederal} onChange={set('credorDocumentoFederal')} disabled={submitting} /></Field>
              <Field label="Tipo de operação">
                <select className={selectCls} value={form.credorTipoOperacao} onChange={set('credorTipoOperacao')} disabled={submitting}>
                  {TIPO_OPERACAO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Prazo da operação"><input type="date" className={inputCls} value={form.credorPrazoOperacao} onChange={set('credorPrazoOperacao')} disabled={submitting} /></Field>
              <Field label="Valor da operação"><input type="number" className={inputCls} value={form.credorValorOperacao} onChange={set('credorValorOperacao')} disabled={submitting} /></Field>
              <Field label="Informação adicional"><input className={inputCls} value={form.credorInformacaoAdicional} onChange={set('credorInformacaoAdicional')} disabled={submitting} /></Field>
            </div>
          )}
        </div>

        <div>
          <label className="flex items-center gap-2 text-xs text-[#a3a3a3] mb-2">
            <input type="checkbox" checked={form.temControlador} onChange={setChecked('temControlador')} disabled={submitting} />
            Incluir controlador (opcional)
          </label>
          {form.temControlador && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 border border-[#2a2a2a] rounded-md">
              <Field label="Documento federal"><input className={inputCls} value={form.controladorDocumentoFederal} onChange={set('controladorDocumentoFederal')} disabled={submitting} /></Field>
              <Field label="Nome"><input className={inputCls} value={form.controladorNome} onChange={set('controladorNome')} disabled={submitting} /></Field>
              <Field label="Telefone celular"><input className={inputCls} value={form.controladorTelefoneCelular} onChange={set('controladorTelefoneCelular')} disabled={submitting} /></Field>
              <Field label="E-mail"><input type="email" className={inputCls} value={form.controladorEmail} onChange={set('controladorEmail')} disabled={submitting} /></Field>
              <Field label="Tipo de empresa">
                <select className={selectCls} value={form.controladorTipoEmpresa} onChange={set('controladorTipoEmpresa')} disabled={submitting}>
                  <option value="">—</option>
                  {TIPO_EMPRESA_CONTROLADOR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="CEP"><input className={inputCls} value={form.controladorCep} onChange={set('controladorCep')} disabled={submitting} /></Field>
              <Field label="Logradouro"><input className={inputCls} value={form.controladorLogradouro} onChange={set('controladorLogradouro')} disabled={submitting} /></Field>
              <Field label="Número"><input className={inputCls} value={form.controladorNroLogradouro} onChange={set('controladorNroLogradouro')} disabled={submitting} /></Field>
              <Field label="Bairro"><input className={inputCls} value={form.controladorBairro} onChange={set('controladorBairro')} disabled={submitting} /></Field>
              <Field label="Cidade"><input className={inputCls} value={form.controladorCidade} onChange={set('controladorCidade')} disabled={submitting} /></Field>
              <Field label="UF"><input className={inputCls} value={form.controladorUf} onChange={set('controladorUf')} disabled={submitting} maxLength={2} /></Field>
            </div>
          )}
        </div>

        <Feedback feedback={feedback} />

        {resultado && (
          <div className="p-3 rounded-md text-xs border bg-[#111111] border-[#2a2a2a] text-[#d4d4d4] space-y-1">
            <p><span className="text-[#a3a3a3]">Código da solicitação:</span> {resultado.codigoSolicitacao ?? '(não retornado pelo BMP — ver raw abaixo)'}</p>
            <p><span className="text-[#a3a3a3]">ID interno:</span> {resultado.solicitacaoId ?? '—'}</p>
            {resultado.persistError && (
              <p className="text-red-400">
                <span className="text-[#a3a3a3]">Erro ao salvar localmente:</span> {resultado.persistError}
              </p>
            )}
            <pre className="mt-1 whitespace-pre-wrap break-words bg-black/30 p-2 rounded text-[11px]">{JSON.stringify(resultado.raw, null, 2)}</pre>
          </div>
        )}

        <PrimaryButton type="submit" disabled={submitting}>
          {submitting ? 'Enviando...' : 'Solicitar abertura de conta'}
        </PrimaryButton>
      </form>
    </Card>
  )
}

const TIPO_ENTIDADE_DEFAULT = '1'

function DocumentosForm({ codigoSolicitacao, setCodigoSolicitacao }) {
  const [tipoEntidade, setTipoEntidade] = useState(TIPO_ENTIDADE_DEFAULT)
  const [tipoDocumento, setTipoDocumento] = useState('1')
  const [documentoFederal, setDocumentoFederal] = useState('')
  const [arquivo, setArquivo] = useState(null)
  const [finalizarJunto, setFinalizarJunto] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = String(reader.result || '')
        const base64 = result.includes(',') ? result.split(',')[1] : result
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)

    if (!codigoSolicitacao) {
      setFeedback({ ok: false, message: 'Informe o código da solicitação (gerado na etapa 1, ou selecionado na lista abaixo).' })
      return
    }
    if (!documentoFederal || !arquivo) {
      setFeedback({ ok: false, message: 'Informe o documento federal e selecione um arquivo.' })
      return
    }

    setSubmitting(true)
    try {
      const arquivoBase64 = await fileToBase64(arquivo)
      const { data, error } = await supabase.functions.invoke('bmp-onboarding-documento-enviar', {
        body: {
          codigoContaSolicitacaoCriacao: codigoSolicitacao,
          tipoDocumento: Number(tipoDocumento),
          tipoEntidade: Number(tipoEntidade),
          documentoFederal,
          nomeArquivo: arquivo.name,
          arquivo: arquivoBase64,
          finalizarSolicitacao: finalizarJunto,
        },
      })
      const errMsg = extractError(data, error, 'Erro ao enviar documento.')
      if (errMsg) {
        setFeedback({ ok: false, message: errMsg })
      } else {
        setFeedback({ ok: true, message: 'Documento enviado com sucesso.' + (finalizarJunto ? ' Solicitação finalizada e enviada para análise do BMP.' : '') })
        setArquivo(null)
      }
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card title="2. Enviar documentos" description="Envie os documentos do titular (e de cada sócio, se PJ) referentes ao código de solicitação gerado na etapa 1.">
      <form onSubmit={handleSubmit} className="space-y-2">
        <Field label="Código da solicitação (uuid)">
          <input className={inputCls} value={codigoSolicitacao} onChange={(e) => setCodigoSolicitacao(e.target.value)} disabled={submitting} />
        </Field>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Field label="Entidade">
            <select className={selectCls} value={tipoEntidade} onChange={(e) => setTipoEntidade(e.target.value)} disabled={submitting}>
              {TIPO_ENTIDADE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Tipo de documento">
            <select className={selectCls} value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value)} disabled={submitting}>
              {TIPO_DOCUMENTO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Documento federal (dono do arquivo)">
            <input className={inputCls} value={documentoFederal} onChange={(e) => setDocumentoFederal(e.target.value)} disabled={submitting} />
          </Field>
          <Field label="Arquivo (.png, .jpg, .jpeg, .pdf)">
            <input type="file" accept=".png,.jpg,.jpeg,.pdf" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} disabled={submitting} className={inputCls} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-xs text-[#a3a3a3]">
          <input type="checkbox" checked={finalizarJunto} onChange={(e) => setFinalizarJunto(e.target.checked)} disabled={submitting} />
          Finalizar a solicitação junto com este envio (envia pra análise do BMP — não dá mais pra editar depois)
        </label>

        <Feedback feedback={feedback} />

        <PrimaryButton type="submit" disabled={submitting}>
          {submitting ? 'Enviando...' : 'Enviar documento'}
        </PrimaryButton>
      </form>
    </Card>
  )
}

function FinalizarCancelarForm({ codigoSolicitacao, setCodigoSolicitacao }) {
  const [submittingFinalizar, setSubmittingFinalizar] = useState(false)
  const [submittingCancelar, setSubmittingCancelar] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const handleFinalizar = async () => {
    setFeedback(null)
    if (!codigoSolicitacao) {
      setFeedback({ ok: false, message: 'Informe o código da solicitação.' })
      return
    }
    setSubmittingFinalizar(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-onboarding-conta-finalizar', { body: { codigoSolicitacao } })
      const errMsg = extractError(data, error, 'Erro ao finalizar solicitação.')
      setFeedback(errMsg ? { ok: false, message: errMsg } : { ok: true, message: 'Solicitação finalizada e enviada para análise do BMP.' })
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setSubmittingFinalizar(false)
    }
  }

  const handleCancelar = async () => {
    setFeedback(null)
    if (!codigoSolicitacao) {
      setFeedback({ ok: false, message: 'Informe o código da solicitação.' })
      return
    }
    setSubmittingCancelar(true)
    try {
      const { data, error } = await supabase.functions.invoke('bmp-onboarding-conta-cancelar', { body: { codigoSolicitacao } })
      const errMsg = extractError(data, error, 'Erro ao cancelar solicitação.')
      setFeedback(errMsg ? { ok: false, message: errMsg } : { ok: true, message: 'Solicitação cancelada.' })
    } catch (err) {
      setFeedback({ ok: false, message: err.message || 'Erro ao conectar.' })
    } finally {
      setSubmittingCancelar(false)
    }
  }

  return (
    <Card title="3. Finalizar ou cancelar" description="Finalizar envia a solicitação para análise manual do BMP (não há aprovação automática/síncrona). Cancelar desiste da solicitação.">
      <div className="space-y-2">
        <Field label="Código da solicitação (uuid)">
          <input className={inputCls} value={codigoSolicitacao} onChange={(e) => setCodigoSolicitacao(e.target.value)} />
        </Field>
        <Feedback feedback={feedback} />
        <div className="flex gap-2">
          <PrimaryButton type="button" onClick={handleFinalizar} disabled={submittingFinalizar || submittingCancelar}>
            {submittingFinalizar ? 'Finalizando...' : 'Finalizar solicitação'}
          </PrimaryButton>
          <SecondaryButton type="button" onClick={handleCancelar} disabled={submittingFinalizar || submittingCancelar}>
            {submittingCancelar ? 'Cancelando...' : 'Cancelar solicitação'}
          </SecondaryButton>
        </div>
      </div>
    </Card>
  )
}

function SolicitacoesList({ onSelecionar }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  const carregar = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('bmp_onboarding_solicitacao')
        .select('id, codigo_solicitacao, documento_federal, nome, tipo_pessoa, status, created_at')
        .order('created_at', { ascending: false })
        .limit(50)
      setRows(data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar() }, [])

  return (
    <Card title="Solicitações existentes" description="Clique numa linha para carregar o código nas etapas 2 e 3.">
      <div className="flex justify-end mb-2">
        <SecondaryButton type="button" onClick={carregar} disabled={loading}>
          {loading ? 'Atualizando...' : 'Atualizar lista'}
        </SecondaryButton>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-[#666666]">Nenhuma solicitação registrada ainda.</p>
      ) : (
        <div className="overflow-x-auto border border-[#2a2a2a] rounded-md">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#141414] text-[#666666] uppercase tracking-wider">
                <th className="text-left px-3 py-2">Nome</th>
                <th className="text-left px-3 py-2">Documento</th>
                <th className="text-left px-3 py-2">Tipo</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Código</th>
                <th className="text-left px-3 py-2">Criado em</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-[#1a1a1a] text-[#d4d4d4] hover:bg-[#141414] cursor-pointer"
                  onClick={() => r.codigo_solicitacao && onSelecionar(r.codigo_solicitacao)}
                >
                  <td className="px-3 py-2">{r.nome}</td>
                  <td className="px-3 py-2">{r.documento_federal}</td>
                  <td className="px-3 py-2">{r.tipo_pessoa === 2 ? 'PJ' : 'PF'}</td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{r.codigo_solicitacao ?? '—'}</td>
                  <td className="px-3 py-2">{formatDataHora(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

export default function OnboardingTab() {
  const [codigoSolicitacao, setCodigoSolicitacao] = useState('')

  return (
    <div className="space-y-3 w-full">
      <SolicitarForm onSolicitado={setCodigoSolicitacao} />
      <DocumentosForm codigoSolicitacao={codigoSolicitacao} setCodigoSolicitacao={setCodigoSolicitacao} />
      <FinalizarCancelarForm codigoSolicitacao={codigoSolicitacao} setCodigoSolicitacao={setCodigoSolicitacao} />
      <SolicitacoesList onSelecionar={setCodigoSolicitacao} />
    </div>
  )
}
