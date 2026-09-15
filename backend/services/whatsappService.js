import makeWASocket, { DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import QRCode from 'qrcode'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let sock = null
let qrCode = null          // string bruta do QR (para renderizar/rescan)
let qrDataUrl = null       // data URL (PNG) do QR — pronto p/ <img>
let conectado = false      // true só depois de connection === 'open'
let iniciando = false      // evita iniciar duas conexões em paralelo

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
    if (sock && conectado) return sock            // já conectado
    if (iniciando) return sock                    // já em processo de conexão
    iniciando = true

    const authFolder = path.join(__dirname, '..', '.auth')

    // Criar pasta de autenticação se não existir
    if (!fs.existsSync(authFolder)) {
      fs.mkdirSync(authFolder, { recursive: true })
    }

    const { state, saveCreds } = await useMultiFileAuthState(authFolder)

    // Fixa a versão do protocolo do WhatsApp (evita a conexão fechar com 405/515
    // antes de emitir o QR). Se a busca falhar (rede), o Baileys usa a versão padrão.
    let waVersion
    try {
      const info = await fetchLatestBaileysVersion()
      waVersion = info?.version
      console.log('[WhatsApp] Versão do WhatsApp:', Array.isArray(waVersion) ? waVersion.join('.') : waVersion)
    } catch (e) {
      console.warn('[WhatsApp] Não foi possível obter a versão do WhatsApp (usando padrão):', e?.message)
    }

    sock = makeWASocket({
      auth: state,
      // NÃO usar printQRInTerminal (obsoleto no Baileys novo e exige o pacote
      // qrcode-terminal). O QR é gerado aqui via 'qrcode' e servido para o front.
      browser: ['Capt', 'Chrome', '120.0.0'],
      ...(waVersion ? { version: waVersion } : {}),
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update
      console.log('[WhatsApp] connection.update →', connection || '(sem status)', '| qr?', !!qr)

      if (qr) {
        qrCode = qr
        try {
          qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 })
          console.log('[WhatsApp] QR Code gerado (dataURL pronto) - escaneie para conectar')
        } catch (e) {
          qrDataUrl = null
          console.error('[WhatsApp] Falha ao gerar imagem do QR:', e?.message)
        }
        conectado = false
      }

      if (connection === 'close') {
        conectado = false
        const statusCode = (lastDisconnect?.error)?.output?.statusCode
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut
        console.log('[WhatsApp] Conexão fechada. statusCode:', statusCode,
          '| motivo:', lastDisconnect?.error?.message, '| Reconectando:', shouldReconnect)
        iniciando = false
        if (shouldReconnect) {
          iniciarWhatsApp()
        } else {
          // Logout definitivo: limpa credenciais para permitir novo QR
          sock = null
          qrCode = null
          qrDataUrl = null
          try { fs.rmSync(authFolder, { recursive: true, force: true }) } catch {}
        }
      } else if (connection === 'open') {
        conectado = true
        qrCode = null
        qrDataUrl = null
        iniciando = false
        console.log('[WhatsApp] Conectado com sucesso!')
      }
    })

    sock.ev.on('messages.upsert', async (m) => {
      // Opcional: processar mensagens recebidas
    })

    return sock
  } catch (error) {
    iniciando = false
    console.error('[WhatsApp] Erro ao iniciar conexão:', error)
    throw error
  }
}

// Garante que há um socket ativo antes de enviar (reconecta se a sessão já existe no disco)
const garantirSock = async () => {
  if (sock && conectado) return
  await iniciarWhatsApp()
  // aguarda até ~8s pela conexão abrir (sessão já autenticada reconecta sozinha)
  for (let i = 0; i < 40 && !conectado; i++) {
    await new Promise(r => setTimeout(r, 200))
  }
  if (!conectado) throw new Error('WhatsApp não está conectado. Conecte o WhatsApp (leia o QR) na página do WhatsApp.')
}

// Enviar mensagem de texto
export const enviarMensagemWhatsApp = async (telefone, mensagem) => {
  await garantirSock()
  const jid = formatPhoneNumber(telefone)
  console.log(`[WhatsApp] Enviando mensagem para ${telefone} (${jid})`)
  const result = await sock.sendMessage(jid, { text: mensagem })
  return { success: true, messageId: result.key.id, timestamp: new Date().toISOString() }
}

// Enviar documento (PDF) — base64 pode vir puro ou como data URL
export const enviarDocumentoWhatsApp = async (telefone, base64, filename, caption) => {
  await garantirSock()
  const jid = formatPhoneNumber(telefone)
  const b64 = String(base64 || '').replace(/^data:.*;base64,/, '')
  if (!b64) throw new Error('Documento (base64) não informado')
  const buffer = Buffer.from(b64, 'base64')
  console.log(`[WhatsApp] Enviando documento (${buffer.length} bytes) para ${telefone} (${jid})`)
  const msg = {
    document: buffer,
    mimetype: 'application/pdf',
    fileName: filename || 'documento.pdf',
  }
  if (caption) msg.caption = caption
  const result = await sock.sendMessage(jid, msg)
  return { success: true, messageId: result.key.id, timestamp: new Date().toISOString() }
}

// Obter status da conexão
export const obterStatusWhatsApp = () => {
  return {
    conectado,
    iniciando,
    qrCode: qrCode || null,
    qrDataUrl: qrDataUrl || null,
  }
}

// Desconectar
export const desconectarWhatsApp = async () => {
  try {
    if (sock) {
      try { await sock.logout() } catch {}
      sock = null
    }
    conectado = false
    qrCode = null
    qrDataUrl = null
    iniciando = false
    // limpa credenciais p/ próximo login pedir QR novo
    try { fs.rmSync(path.join(__dirname, '..', '.auth'), { recursive: true, force: true }) } catch {}
    console.log('[WhatsApp] Desconectado')
  } catch (error) {
    console.error('[WhatsApp] Erro ao desconectar:', error)
  }
}
