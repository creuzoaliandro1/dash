import { useState, useEffect, useRef } from 'react'
import { generateSingleBoletoPDF } from '../../utils/boleto'
import { getContaInfo } from '../../services/boletoService'
import { supabase } from '../../lib/supabase'
import { waEnviarDocumento } from '../../services/whatsappApi'

// Converte Blob -> data URL (base64)
const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(r.result)
  r.onerror = reject
  r.readAsDataURL(blob)
})

const soDigitos = (v) => String(v || '').replace(/\D/g, '')
const emailValido = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim())

// Modal de envio de documento (boleto) por E-mail ou WhatsApp.
// Disponível para TODOS os usuários. E-mail/telefone editáveis SÓ para este envio
// (não altera o cadastro do boleto).
export default function EnviarDocumentoModal({ boleto, contaData, onClose }) {
  const [pdfUrl, setPdfUrl] = useState(null)
  const [pdfDataUrl, setPdfDataUrl] = useState(null)
  const [gerando, setGerando] = useState(true)
  const [erroPdf, setErroPdf] = useState('')

  const [email, setEmail] = useState(boleto?.sacado_email || '')
  const [telefone, setTelefone] = useState(boleto?.sacado_telefone || boleto?.sacado_celular || '')

  const [enviando, setEnviando] = useState(null) // 'email' | 'whatsapp' | null
  const [feedback, setFeedback] = useState(null) // { tipo:'ok'|'erro', msg }
  const objectUrlRef = useRef(null)

  const nomeArquivo = `boleto_${(boleto?.numero_documento || boleto?.nosso_numero || 'documento')
    .toString().replace(/[^\w.\-]+/g, '_')}.pdf`

  // Gera o PDF ao abrir
  useEffect(() => {
    let cancelado = false
    ;(async () => {
      setGerando(true); setErroPdf('')
      try {
        let conta = contaData
        if (!conta && boleto?.conta_id) {
          try { const r = await getContaInfo(boleto.conta_id); conta = r?.data || r } catch {}
        }
        const blob = await generateSingleBoletoPDF(boleto, conta)
        if (cancelado) return
        const url = URL.createObjectURL(blob)
        objectUrlRef.current = url
        setPdfUrl(url)
        setPdfDataUrl(await blobToDataUrl(blob))
      } catch (e) {
        if (!cancelado) setErroPdf(e?.message || 'Falha ao gerar o PDF do boleto')
      } finally {
        if (!cancelado) setGerando(false)
      }
    })()
    return () => {
      cancelado = true
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [boleto, contaData])

  const enviarEmail = async () => {
    setFeedback(null)
    if (!emailValido(email)) { setFeedback({ tipo: 'erro', msg: 'Informe um e-mail válido.' }); return }
    if (!pdfDataUrl) { setFeedback({ tipo: 'erro', msg: 'PDF ainda não está pronto.' }); return }
    setEnviando('email')
    try {
      const doc = boleto?.numero_documento || boleto?.nosso_numero || ''
      const { data, error } = await supabase.functions.invoke('send-boleto-email', {
        body: {
          to: email.trim(),
          subject: `Boleto ${doc}`.trim(),
          text: `Segue em anexo o boleto ${doc}.`,
          html: `<p>Olá,</p><p>Segue em anexo o boleto <b>${doc}</b>.</p><p>Atenciosamente,<br/>ContaCapt</p>`,
          pdfBase64: pdfDataUrl,
          fileName: nomeArquivo,
        },
      })
      if (error) throw error
      if (data && data.success === false) throw new Error(data.error || 'Falha no envio')
      setFeedback({ tipo: 'ok', msg: `E-mail enviado para ${email.trim()}.` })
    } catch (e) {
      setFeedback({ tipo: 'erro', msg: 'Erro ao enviar e-mail: ' + (e?.message || e) })
    } finally {
      setEnviando(null)
    }
  }

  const enviarWhatsApp = async () => {
    setFeedback(null)
    const tel = soDigitos(telefone)
    if (tel.length < 10) { setFeedback({ tipo: 'erro', msg: 'Informe um telefone válido com DDD.' }); return }
    if (!pdfDataUrl) { setFeedback({ tipo: 'erro', msg: 'PDF ainda não está pronto.' }); return }
    setEnviando('whatsapp')
    try {
      const doc = boleto?.numero_documento || boleto?.nosso_numero || ''
      await waEnviarDocumento(tel, pdfDataUrl, nomeArquivo, `Segue o boleto ${doc}.`)
      setFeedback({ tipo: 'ok', msg: `Boleto enviado por WhatsApp para ${telefone}.` })
    } catch (e) {
      const extra = e?.offline ? ' (verifique se o WhatsApp está conectado na página WhatsApp)' : ''
      setFeedback({ tipo: 'erro', msg: 'Erro ao enviar por WhatsApp: ' + (e?.message || e) + extra })
    } finally {
      setEnviando(null)
    }
  }

  const busy = enviando !== null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-2" onMouseDown={onClose}>
      <div
        className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg flex flex-col overflow-hidden"
        style={{ width: '90vw', height: '90vh' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f1f1f] flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-white text-sm font-semibold truncate">
              Enviar boleto {boleto?.numero_documento ? `Nº ${boleto.numero_documento}` : ''}
            </h2>
            <p className="text-xs text-[#666666] truncate">{boleto?.sacado_nome || ''}</p>
          </div>
          <button onClick={onClose} className="text-[#888] hover:text-white text-xl leading-none px-2" title="Fechar">×</button>
        </div>

        {/* Barra de contato + ações */}
        <div className="px-4 py-3 border-b border-[#1f1f1f] flex-shrink-0 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1 min-w-[220px] flex-1">
            <label className="text-[10px] uppercase tracking-wider text-[#666666]">E-mail do sacado</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              className="px-2 py-1.5 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-[#444] outline-none"
            />
          </div>
          <div className="flex flex-col gap-1 min-w-[180px] flex-1">
            <label className="text-[10px] uppercase tracking-wider text-[#666666]">Telefone / WhatsApp (com DDD)</label>
            <input
              type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)}
              placeholder="(84) 99999-9999"
              className="px-2 py-1.5 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-[#444] outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={enviarEmail}
              disabled={busy || gerando}
              className="px-4 py-2 bg-[#1f1f1f] border border-[#333] hover:border-[#555] text-white text-sm rounded transition disabled:opacity-50 whitespace-nowrap"
            >
              {enviando === 'email' ? 'Enviando…' : '✉️ Enviar por E-mail'}
            </button>
            <button
              onClick={enviarWhatsApp}
              disabled={busy || gerando}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm rounded transition disabled:opacity-50 whitespace-nowrap"
            >
              {enviando === 'whatsapp' ? 'Enviando…' : '🟢 Enviar por WhatsApp'}
            </button>
          </div>
        </div>

        {feedback && (
          <div className={`px-4 py-2 text-sm flex-shrink-0 border-b border-[#1f1f1f] ${
            feedback.tipo === 'ok' ? 'text-green-400 bg-green-900/15' : 'text-red-400 bg-red-900/15'
          }`}>
            {feedback.msg}
          </div>
        )}

        {/* Preview do PDF — ocupa 100% do espaço restante */}
        <div className="flex-1 bg-[#111] min-h-0">
          {gerando ? (
            <div className="w-full h-full flex items-center justify-center text-[#666666] text-sm">Gerando PDF do boleto…</div>
          ) : erroPdf ? (
            <div className="w-full h-full flex items-center justify-center text-red-400 text-sm px-6 text-center">{erroPdf}</div>
          ) : pdfUrl ? (
            <iframe title="Boleto" src={pdfUrl + '#view=FitH'} className="w-full h-full border-0" />
          ) : null}
        </div>
      </div>
    </div>
  )
}
