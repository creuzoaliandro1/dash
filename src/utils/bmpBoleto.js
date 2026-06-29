// Mapeia um registro de capt_boletos (snake_case) para o payload do endpoint
// BMP "Registrar Boleto" (POST /api/Boleto/Registrar).
// Ref: https://bmpdocs.moneyp.com.br/baas/referencias-de-api/boletos/55-registrar-boleto
//
// Observação: os "codigo" de juros/multa/desconto seguem a convenção usada no
// formulário (Isento/Valor/Percentual). Confirme a tabela de códigos exata do
// BMP antes de ir para produção na integração via API.

const onlyDigits = (v) => (v == null ? '' : String(v).replace(/\D/g, ''))

// 'YYYY-MM-DD' (ou Date) -> ISO date-time. Retorna null se vazio.
const toIso = (d) => {
  if (!d) return null
  if (d instanceof Date) return d.toISOString()
  const s = String(d)
  // já está com hora
  if (s.includes('T')) return s
  return `${s}T00:00:00`
}

const num = (v) => {
  const n = parseFloat(v)
  return isNaN(n) ? 0 : n
}

// tipoPessoa BMP: 1 = Física, 2 = Jurídica. Deriva pelo documento se não informado.
const resolveTipoPessoa = (tipo, cic) => {
  if (tipo === 1 || tipo === 2) return tipo
  if (tipo === '1' || tipo === '2') return parseInt(tipo, 10)
  return onlyDigits(cic).length > 11 ? 2 : 1
}

// Monta um ItemCalculavelBoleto ({ data, codigo, vlr }) ou null se inativo.
// inactiveCodes: códigos que significam "não aplicar" (ex.: '3' isento, '0' sem desconto).
const buildItem = (codigo, data, vlr, inactiveCodes = []) => {
  const valor = num(vlr)
  const isInactive = !codigo || inactiveCodes.includes(String(codigo))
  if (isInactive || valor <= 0) return null
  return { data: toIso(data), codigo: String(codigo), vlr: valor }
}

/**
 * @param {object} boleto  Registro de capt_boletos.
 * @param {object} conta   Registro de CONTAS (beneficiário). Campos opcionais.
 * @param {object} [opts]  { idempotencyKey } e overrides do beneficiário.
 * @returns {object} payload RegistrarBoletoManualExternoRequest
 */
export function buildBmpRegistrarBoletoPayload(boleto = {}, conta = {}, opts = {}) {
  const beneficiario = {
    agencia: conta.agencia || opts.agencia || null,
    agenciaDigito: conta.agencia_digito || null,
    conta: conta.conta != null ? String(conta.conta) : null,
    contaDigito: conta.conta_digito || null,
    contaPgto: conta.conta_pgto || null,
    tipoConta: conta.tipo_conta || 1,   // 1 = Corrente
    modeloConta: conta.modelo_conta || 1, // 1 = Movimento
  }

  const dadosBoleto = {
    dtVencimento: toIso(boleto.data_vencimento),
    dtLimPgto: toIso(boleto.data_limite_pagamento),
    vlrTitulo: num(boleto.valor),
    numDocTit: boleto.numero_documento || null,
    identdNossoNum: boleto.nosso_numero ? String(boleto.nosso_numero) : null,
    codEspTit: boleto.especie_titulo != null ? parseInt(boleto.especie_titulo, 10) : 2,
    dtEmissao: toIso(boleto.data_emissao),
    vlrAbatimento: num(boleto.valor_abatimento),
    numeroDocumento: boleto.numero_documento || null,
  }

  const pagador = {
    tipoPessoa: resolveTipoPessoa(boleto.sacado_tipo_pessoa, boleto.sacado_cic),
    documentoFederal: onlyDigits(boleto.sacado_cic),
    nomeRazao: boleto.sacado_nome || null,
    nomeFantasia: boleto.sacado_nome || null,
    logradouro: boleto.sacado_endereco || null,
    cidade: boleto.sacado_cidade || null,
    uf: boleto.sacado_uf || null,
    cep: onlyDigits(boleto.sacado_cep),
    bairro: boleto.sacado_bairro || null,
    numero: boleto.sacado_numero || null,
    complemento: boleto.sacado_complemento || null,
    email: boleto.sacado_email || null,
    telefone: onlyDigits(boleto.sacado_telefone),
  }

  let sacadorAvalista = null
  if (boleto.avalista_nome) {
    sacadorAvalista = {
      tipo: boleto.avalista_tipo != null ? parseInt(boleto.avalista_tipo, 10) : 0,
      identificador: onlyDigits(boleto.avalista_cic),
      nomeSacadorAvalista: boleto.avalista_nome,
    }
  }

  const juros = buildItem(boleto.juros_codigo, boleto.juros_data, boleto.juros_valor, ['3'])
  const multa = buildItem(boleto.multa_codigo, boleto.multa_data, boleto.multa, ['3'])
  const desconto = buildItem(boleto.desconto_codigo, boleto.desconto_data, boleto.desconto, ['0'])

  const descontos = []
  const d2 = buildItem(boleto.desconto2_codigo, boleto.desconto2_data, boleto.desconto2_valor, ['0'])
  const d3 = buildItem(boleto.desconto3_codigo, boleto.desconto3_data, boleto.desconto3_valor, ['0'])
  if (d2) descontos.push(d2)
  if (d3) descontos.push(d3)

  const instrucoesBeneficiario = [boleto.mensagem1, boleto.mensagem2, boleto.mensagem3]
    .filter((m) => m && String(m).trim().length > 0)

  return {
    beneficiario,
    dadosBoleto,
    pagador,
    sacadorAvalista,
    juros,
    multa,
    desconto,
    descontos: descontos.length ? descontos : null,
    instrucoesBeneficiario: instrucoesBeneficiario.length ? instrucoesBeneficiario : null,
    numeroCarteira: boleto.numero_carteira != null ? parseInt(boleto.numero_carteira, 10) : 1,
    tipoRegistro: boleto.tipo_registro != null ? parseInt(boleto.tipo_registro, 10) : 1,
    recorrencia: null,
  }
}

export default buildBmpRegistrarBoletoPayload
