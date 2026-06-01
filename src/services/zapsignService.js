import { supabase } from '../lib/supabase'

// Assinante fixo: a própria CAPT (CESSIONÁRIA). Ajuste e-mail/telefone se desejar.
// Como os links são apenas gerados (sem envio automático), e-mail/telefone são opcionais.
export const CAPT_SIGNER = {
  name: 'CAPT ADMINISTRAÇÃO DE PAGAMENTOS LTDA',
  email: '',
  phone: '',
}

// Converte um Blob (ex.: PDF da Duplicata) em base64 puro, sem o prefixo "data:...;base64,"
const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result || ''
      const base64 = String(result).split(',')[1] || ''
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

// Cria um documento de assinatura na ZapSign a partir de um PDF.
// Chama a Edge Function 'zapsign-create-doc' (que guarda o token da API no servidor).
// Aceita um ÚNICO signatário (signerName/Email/Phone) OU uma lista `signers`
// no formato [{ name, cpf, email, phone }].
// Retorna { data: { doc_token, sign_url, signers, raw }, error }
export const criarDocumentoAssinatura = async ({ name, pdfBlob, signerName, signerEmail, signerPhone, signers, extraPdfBlobs, placements }) => {
  try {
    const base64_pdf = await blobToBase64(pdfBlob)

    const body = {
      name,
      base64_pdf,
      send_automatic_email: false,
    }

    // Posicionamento por coordenadas (place-signatures) no documento principal
    if (Array.isArray(placements) && placements.length > 0) {
      body.placements = placements
    }

    // Documentos extras (anexos) que serão assinados no MESMO link
    if (Array.isArray(extraPdfBlobs) && extraPdfBlobs.length > 0) {
      body.extra_pdfs = []
      for (const ex of extraPdfBlobs) {
        if (!ex?.blob) continue
        const entry = { name: ex.name || 'Anexo', base64: await blobToBase64(ex.blob) }
        if (Array.isArray(ex.placements) && ex.placements.length > 0) entry.placements = ex.placements
        body.extra_pdfs.push(entry)
      }
    }
    if (Array.isArray(signers) && signers.length > 0) {
      body.signers = signers.map(s => ({
        name: s.name || 'Signatário',
        email: s.email || '',
        phone: s.phone || s.whatsapp || '',
        ...(s.signature_placement ? { signature_placement: s.signature_placement } : {}),
        ...(s.rubrica_placement ? { rubrica_placement: s.rubrica_placement } : {}),
      }))
    } else {
      body.signer_name = signerName || ''
      body.signer_email = signerEmail || ''
      body.signer_phone = signerPhone || ''
    }

    const { data, error } = await supabase.functions.invoke('zapsign-create-doc', { body })

    if (error) {
      // supabase-js esconde o corpo da resposta em error.context (um Response)
      let detail = error.message || 'Erro na Edge Function'
      try {
        if (error.context && typeof error.context.json === 'function') {
          const body = await error.context.json()
          if (body) detail = body.details ? JSON.stringify(body.details) : (body.error || detail)
        }
      } catch (_) { /* corpo não-JSON, mantém mensagem padrão */ }
      return { data: null, error: new Error(detail) }
    }
    if (data?.error) return { data: null, error: new Error(data.error) }
    return { data, error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}
