import { supabase } from '../lib/supabase'
import { updateCaptAssinaStatus } from './boletoService'

// Consulta o status atual de todos os boletos com zapsign_status='pendente'
// na conta informada, atualiza no DB e retorna quantos foram marcados como assinados.
// Chama a Edge Function 'zapsign-check-status'.
export const syncZapSignPendentes = async (contaId) => {
  try {
    // 1. Busca boletos pendentes com doc_token
    let query = supabase
      .from('capt_boletos')
      .select('id, zapsign_doc_token, zapsign_status')
      .eq('zapsign_status', 'pendente')
      .not('zapsign_doc_token', 'is', null)
    if (contaId) query = query.eq('conta_id', contaId)

    const { data: pendentes, error: fetchErr } = await query
    if (fetchErr) return { atualizados: 0, error: fetchErr }
    if (!pendentes || pendentes.length === 0) return { atualizados: 0, error: null }

    // Tokens únicos (um documento pode ter vários boletos)
    const tokenMap = {} // token → [id, ...]
    for (const b of pendentes) {
      if (!b.zapsign_doc_token) continue
      if (!tokenMap[b.zapsign_doc_token]) tokenMap[b.zapsign_doc_token] = []
      tokenMap[b.zapsign_doc_token].push(b.id)
    }
    const tokens = Object.keys(tokenMap)
    if (tokens.length === 0) return { atualizados: 0, error: null }

    // 2. Consulta ZapSign via Edge Function
    const { data: efData, error: efErr } = await supabase.functions.invoke('zapsign-check-status', {
      body: { tokens },
    })
    console.log('[syncZapSign] efData:', JSON.stringify(efData), 'efErr:', efErr)
    if (efErr) return { atualizados: 0, error: efErr, raw: null }

    const results = efData?.results ?? []
    let atualizados = 0

    // 3. Para cada token assinado, atualiza os boletos no DB
    for (const r of results) {
      console.log('[syncZapSign] token:', r.token, 'status:', r.status, 'raw_status:', r.raw_status, 'signers:', JSON.stringify(r.signers_status))

      // Considera assinado se:
      //   (a) o documento inteiro está finalizado (r.status === 'assinado'), OU
      //   (b) ao menos um signatário não-CAPT assinou individualmente.
      // Caso (b) existe porque CAPT não tem email/telefone e nunca acessa o link —
      // o documento nunca alcança status "completo" no ZapSign, mas o cedente já assinou.
      const signatarioNaoCaptAssinou = Array.isArray(r.signers_status) &&
        r.signers_status.some(s => {
          const isCapt = String(s.name || '').toUpperCase().includes('CAPT')
          const st = String(s.status || '').toLowerCase()
          return !isCapt && (st === 'signed' || st === 'assinado' || st === 'ok' || st === 'completed')
        })

      if (r.status !== 'assinado' && !signatarioNaoCaptAssinou) continue

      const ids = tokenMap[r.token] ?? []
      if (ids.length === 0) continue

      // Atualiza capt_boletos
      const { error: upErr } = await supabase
        .from('capt_boletos')
        .update({ zapsign_status: 'assinado' })
        .in('id', ids)
      if (!upErr) atualizados += ids.length

      // Atualiza capt_assina (signed_file pode ser null se ainda temporário)
      await updateCaptAssinaStatus(r.token, 'assinado', r.signed_file || null)
    }

    return { atualizados, error: null, raw: results }
  } catch (err) {
    return { atualizados: 0, error: err }
  }
}

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
