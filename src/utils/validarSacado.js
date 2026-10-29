// Validação única dos dados de endereço e contato do sacado (pagador).
// Obrigatórios para gravar em capt_boletos e para entrar no CNAB400 de registro.
// Aceita tanto o formato do banco (sacado_endereco...) quanto o do formulário/
// importação (SACADO_ENDERECO...).

export const UFS_VALIDAS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// [chave do formulário, coluna do banco, rótulo]
export const CAMPOS_SACADO_OBRIGATORIOS = [
  ['SACADO_ENDERECO', 'sacado_endereco', 'Logradouro'],
  ['SACADO_NUMERO', 'sacado_numero', 'Número'],
  ['SACADO_BAIRRO', 'sacado_bairro', 'Bairro'],
  ['SACADO_CEP', 'sacado_cep', 'CEP'],
  ['SACADO_CIDADE', 'sacado_cidade', 'Cidade'],
  ['SACADO_UF', 'sacado_uf', 'UF'],
  ['SACADO_EMAIL', 'sacado_email', 'E-mail'],
  ['SACADO_TELEFONE', 'sacado_telefone', 'Telefone'],
]

const texto = (v) => String(v ?? '').trim()

const ler = (b, chaveForm, coluna) => {
  if (!b) return ''
  const vForm = b[chaveForm]
  if (vForm !== undefined && vForm !== null && texto(vForm) !== '') return texto(vForm)
  return texto(b[coluna])
}

// Retorna { ok, faltando: [{ campo, coluna, rotulo, motivo }], mensagens: ['CEP (deve ter 8 dígitos)', ...] }
export function validarDadosSacado(boleto) {
  const faltando = []
  for (const [campo, coluna, rotulo] of CAMPOS_SACADO_OBRIGATORIOS) {
    const v = ler(boleto, campo, coluna)
    let motivo = null
    if (!v) motivo = 'vazio'
    else if (campo === 'SACADO_CEP' && v.replace(/\D/g, '').length !== 8) motivo = 'deve ter 8 dígitos'
    else if (campo === 'SACADO_UF' && !UFS_VALIDAS.includes(v.toUpperCase())) motivo = 'sigla inválida'
    else if (campo === 'SACADO_EMAIL' && !EMAIL_RE.test(v)) motivo = 'formato inválido'
    else if (campo === 'SACADO_TELEFONE') {
      const n = v.replace(/\D/g, '').length
      if (n < 10 || n > 11) motivo = 'deve ter 10 ou 11 dígitos com DDD'
    }
    if (motivo) faltando.push({ campo, coluna, rotulo, motivo })
  }
  return {
    ok: faltando.length === 0,
    faltando,
    mensagens: faltando.map((f) => (f.motivo === 'vazio' ? f.rotulo : `${f.rotulo} (${f.motivo})`)),
  }
}

// Texto curto: "Bairro, E-mail (formato inválido)"
export const resumoFaltasSacado = (boleto) => validarDadosSacado(boleto).mensagens.join(', ')

// Erro padrão para bloquear a gravação.
export function erroDadosSacado(boleto) {
  const { ok, mensagens } = validarDadosSacado(boleto)
  if (ok) return null
  const err = new Error(`Dados do sacado incompletos: ${mensagens.join(', ')}`)
  err.code = 'SACADO_INCOMPLETO'
  err.faltando = mensagens
  return err
}

// Campo do sacado -> campo do perfil (CONTAS). CONTAS não tem número do endereço.
const CAMPOS_PERFIL = {
  SACADO_ENDERECO: 'endereco',
  SACADO_BAIRRO: 'bairro',
  SACADO_CEP: 'cep',
  SACADO_CIDADE: 'cidade',
  SACADO_UF: 'uf',
  SACADO_EMAIL: 'email',
  SACADO_TELEFONE: 'telefone',
}

// Dados do perfil (CONTAS) da conta que está gerando; e-mail cai no do usuário logado.
export function perfilParaSacado(conta) {
  let user = {}
  try { user = JSON.parse(localStorage.getItem('user') || '{}') } catch { /* sem usuário */ }
  const perfil = {}
  for (const col of Object.values(CAMPOS_PERFIL)) perfil[col] = texto(conta?.[col])
  if (!perfil.email) perfil.email = texto(user.email)
  return perfil
}

// Sacado com endereço/contato vazio ou inválido: completa campo a campo com o
// perfil da conta que está gerando. Dados válidos do sacado têm prioridade.
// Não altera o objeto original; devolve uma cópia só quando completa algo.
export function completarSacadoPeloPerfil(boleto, perfil) {
  if (!boleto || !perfil) return boleto
  const faltas = validarDadosSacado(boleto).faltando.map((f) => f.campo)
  const usaChaveForm = Object.keys(boleto).some((k) => k.startsWith('SACADO_'))
  const novo = { ...boleto }
  let mudou = false
  for (const [campo, coluna] of CAMPOS_SACADO_OBRIGATORIOS) {
    const valor = texto(perfil[CAMPOS_PERFIL[campo]])
    if (!valor || !faltas.includes(campo)) continue
    if (usaChaveForm) novo[campo] = valor
    else novo[coluna] = valor
    mudou = true
  }
  return mudou ? novo : boleto
}
