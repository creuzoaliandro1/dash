/**
 * Utilitário para enviar mensagens WhatsApp via Baileys
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

/**
 * Enviar mensagem WhatsApp com link de assinatura do borderô
 * @param {string} telefone - Telefone no formato 85982206655
 * @param {string} codOperacao - Código da operação (OPECAB.COD_OPERACAO)
 * @param {string} signUrl - URL de assinatura do ZapSign
 * @returns {Promise<{sucesso: boolean, resultado?: object, erro?: string}>}
 */
export const enviarLinkBorderoWhatsApp = async (telefone, codOperacao, signUrl) => {
  try {
    if (!telefone || !signUrl) {
      throw new Error('Telefone e link de assinatura são obrigatórios')
    }

    const mensagem = `Prezado(a),\n\nSegue link para assinatura do bordero "${codOperacao}".\n\n${signUrl}\n\nAtenciosamente,\nCAPT Administração de Pagamentos`

    return await enviarMensagemWhatsApp(telefone, mensagem)
  } catch (error) {
    console.error('[WhatsApp] Erro ao enviar link do borderô:', error)
    throw error
  }
}

/**
 * Enviar mensagem WhatsApp genérica
 * @param {string} telefone - Telefone no formato 85982206655
 * @param {string} mensagem - Texto da mensagem
 * @returns {Promise<{sucesso: boolean, resultado?: object, erro?: string}>}
 */
export const enviarMensagemWhatsApp = async (telefone, mensagem) => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/whatsapp/enviar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        telefone,
        mensagem,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.erro || 'Erro ao enviar mensagem WhatsApp')
    }

    console.log('[WhatsApp] Mensagem enviada com sucesso:', data)
    return data
  } catch (error) {
    console.error('[WhatsApp] Erro ao enviar mensagem:', error)
    throw error
  }
}

/**
 * Obter status da conexão WhatsApp
 * @returns {Promise<{sucesso: boolean, conectado: boolean, qrCode?: string}>}
 */
export const obterStatusWhatsApp = async () => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/whatsapp/status`)
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.erro || 'Erro ao obter status')
    }

    return data
  } catch (error) {
    console.error('[WhatsApp] Erro ao obter status:', error)
    throw error
  }
}

/**
 * Iniciar conexão WhatsApp
 * @returns {Promise<{sucesso: boolean, mensagem: string, status: object}>}
 */
export const iniciarConexaoWhatsApp = async () => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/whatsapp/iniciar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.erro || 'Erro ao iniciar conexão')
    }

    console.log('[WhatsApp] Conexão iniciada:', data)
    return data
  } catch (error) {
    console.error('[WhatsApp] Erro ao iniciar conexão:', error)
    throw error
  }
}

/**
 * Desconectar WhatsApp
 * @returns {Promise<{sucesso: boolean, mensagem: string}>}
 */
export const desconectarWhatsApp = async () => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/whatsapp/desconectar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.erro || 'Erro ao desconectar')
    }

    console.log('[WhatsApp] Desconectado:', data)
    return data
  } catch (error) {
    console.error('[WhatsApp] Erro ao desconectar:', error)
    throw error
  }
}
