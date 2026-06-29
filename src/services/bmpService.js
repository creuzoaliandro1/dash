// Serviço de integração com o BMP (registro de boletos).
// A chamada HTTP real é feita pela Edge Function 'bmp-registrar-boleto'
// (o token do BMP fica no servidor, nunca no front-end).
import { supabase } from '../lib/supabase'
import { buildBmpRegistrarBoletoPayload } from '../utils/bmpBoleto'
import { getContaInfo } from './boletoService'

// Gera uma IdempotencyKey (evita registro duplicado em caso de retry).
const novaIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'bmp-' + Date.now() + '-' + Math.random().toString(16).slice(2)
}

/**
 * Registra um boleto no BMP.
 * @param {object} boleto  Registro de capt_boletos (snake_case).
 * @param {object} [conta] Registro de CONTAS (beneficiário). Se omitido, busca por boleto.conta_id.
 * @param {object} [opts]  { idempotencyKey, ignoraHandshake, persist=true }
 * @returns {Promise<{ data, error }>}
 *   data: resposta do BMP { sucesso, codigoBoleto, identdNossoNum, numCodBarras, numLinhaDigtvl, numDocTit }
 */
export const registrarBoletoBMP = async (boleto, conta = null, opts = {}) => {
  try {
    if (!boleto) throw new Error('Boleto não informado')

    // Carrega a conta (beneficiário) se não veio pronta
    let contaInfo = conta
    if (!contaInfo && boleto.conta_id) {
      const { data } = await getContaInfo(boleto.conta_id)
      contaInfo = data || { id: boleto.conta_id }
    }

    const payload = buildBmpRegistrarBoletoPayload(boleto, contaInfo || {}, opts)
    const idempotencyKey = opts.idempotencyKey || novaIdempotencyKey()

    const { data, error } = await supabase.functions.invoke('bmp-registrar-boleto', {
      body: {
        payload,
        idempotencyKey,
        ignoraHandshake: opts.ignoraHandshake, // undefined = usa default do servidor
      },
    })

    if (error) return { data: null, error }
    if (data && data.sucesso === false) {
      return { data, error: new Error(data.mensagem || 'Falha ao registrar boleto no BMP') }
    }

    // Persiste os dados retornados pelo BMP de volta no boleto (opcional)
    const persist = opts.persist !== false
    if (persist && boleto.id && data) {
      const updates = {}
      if (data.numCodBarras) updates.codigo_barras = data.numCodBarras
      if (data.numLinhaDigtvl) updates.linha_digitavel = data.numLinhaDigtvl
      if (data.identdNossoNum) updates.nosso_numero = String(data.identdNossoNum)
      if (data.codigoBoleto) updates.bmp_codigo_boleto = data.codigoBoleto
      updates.situacao = 'Registrado'
      const { error: upErr } = await supabase
        .from('capt_boletos')
        .update(updates)
        .eq('id', boleto.id)
      if (upErr) console.warn('[bmpService] Boleto registrado, mas falhou ao persistir retorno:', upErr)
    }

    return { data, error: null }
  } catch (err) {
    console.error('[bmpService] Erro ao registrar boleto no BMP:', err)
    return { data: null, error: err }
  }
}

export default { registrarBoletoBMP }
