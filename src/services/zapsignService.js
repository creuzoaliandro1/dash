import { supabase } from '../lib/supabase'

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

// Cria um documento de assinatura na ZapSign a partir do PDF da Duplicata.
// Chama a Edge Function 'zapsign-create-doc' (que guarda o token da API no servidor).
// Retorna { data: { doc_token, sign_url, raw }, error }
export const criarDocumentoAssinatura = async ({ name, pdfBlob, signerName, signerEmail, signerPhone }) => {
  try {
    const base64_pdf = await blobToBase64(pdfBlob)

    const { data, error } = await supabase.functions.invoke('zapsign-create-doc', {
      body: {
        name,
        base64_pdf,
        signer_name: signerName || '',
        signer_email: signerEmail || '',
        signer_phone: signerPhone || '',
        // auth_mode: 'assinaturaTela', // descomente/ajuste conforme o método desejado
        send_automatic_email: false,
      },
    })

    if (error) return { data: null, error }
    if (data?.error) return { data: null, error: new Error(data.error) }
    return { data, error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}
