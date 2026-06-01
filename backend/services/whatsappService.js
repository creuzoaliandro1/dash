import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let sock = null
let qrCode = null

// Formatar número WhatsApp para o padrão correto (adicionar @s.whatsapp.net)
const formatPhoneNumber = (phone) => {
  // Remove caracteres especiais
  let cleaned = String(phone).replace(/\D/g, '')

  // Se não começar com 55 (Brasil), adiciona
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned
  }

  // Adiciona o sufixo do WhatsApp
  return cleaned + '@s.whatsapp.net'
}

// Inicializar conexão WhatsApp
export const iniciarWhatsApp = async () => {
  try {
    const authFolder = path.join(__dirname, '..', '.auth')

    // Criar pasta de autenticação se não existir
    if (!fs.existsSync(authFolder)) {
      fs.mkdirSync(authFolder, { recursive: true })
    }

    const { state, saveCreds } = await useMultiFileAuthState(authFolder)

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        qrCode = qr
        console.log('[WhatsApp] QR Code gerado - escaneie para conectar')
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut
        console.log('[WhatsApp] Conexão fechada. Reconectando:', shouldReconnect)
        if (shouldReconnect) {
          iniciarWhatsApp()
        } else {
          sock = null
        }
      } else if (connection === 'open') {
        console.log('[WhatsApp] Conectado com sucesso!')
        qrCode = null
      }
    })

    // Tratar mensagens de erro
    sock.ev.on('messages.upsert', async (m) => {
      // Opcional: processar mensagens recebidas
    })

    return sock
  } catch (error) {
    console.error('[WhatsApp] Erro ao iniciar conexão:', error)
    throw error
  }
}

// Enviar mensagem de texto
export const enviarMensagemWhatsApp = async (telefone, mensagem) => {
  try {
    if (!sock) {
      throw new Error('WhatsApp não está conectado. Inicie a conexão primeiro.')
    }

    const jid = formatPhoneNumber(telefone)

    console.log(`[WhatsApp] Enviando mensagem para ${telefone} (${jid})`)

    const result = await sock.sendMessage(jid, {
      text: mensagem
    })

    console.log('[WhatsApp] Mensagem enviada com sucesso:', result)

    return {
      success: true,
      messageId: result.key.id,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    console.error('[WhatsApp] Erro ao enviar mensagem:', error)
    throw error
  }
}

// Obter status da conexão
export const obterStatusWhatsApp = () => {
  return {
    conectado: !!sock,
    qrCode: qrCode || null,
  }
}

// Desconectar
export const desconectarWhatsApp = async () => {
  try {
    if (sock) {
      await sock.logout()
      sock = null
      console.log('[WhatsApp] Desconectado')
    }
  } catch (error) {
    console.error('[WhatsApp] Erro ao desconectar:', error)
  }
}
