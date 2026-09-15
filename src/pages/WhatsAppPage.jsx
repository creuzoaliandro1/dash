import { useState, useEffect, useRef, useCallback } from 'react'
import { waStatus, waIniciar, waDesconectar, WHATSAPP_API_BASE } from '../services/whatsappApi'

// Página do WhatsApp (apenas Master): conecta o WhatsApp do backend via QR Code.
// Enquanto essa conexão estiver ativa no backend, TODOS os usuários conseguem
// enviar documentos (boletos) por esse mesmo número.
export default function WhatsAppPage() {
  const [status, setStatus] = useState({ conectado: false, iniciando: false, qrDataUrl: null })
  const [offline, setOffline] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const pollRef = useRef(null)

  const carregarStatus = useCallback(async () => {
    try {
      const s = await waStatus()
      setStatus(s)
      setOffline(false)
    } catch (e) {
      if (e.offline) setOffline(true)
      else setErro(e.message)
    }
  }, [])

  useEffect(() => {
    carregarStatus()
    pollRef.current = setInterval(carregarStatus, 3000)
    return () => clearInterval(pollRef.current)
  }, [carregarStatus])

  const handleConectar = async () => {
    setErro(''); setLoading(true)
    try { await waIniciar(); await carregarStatus() }
    catch (e) { setErro(e.message); if (e.offline) setOffline(true) }
    finally { setLoading(false) }
  }

  const handleDesconectar = async () => {
    if (!confirm('Desconectar o WhatsApp? Ninguém poderá enviar até reconectar e ler o QR novamente.')) return
    setErro(''); setLoading(true)
    try { await waDesconectar(); await carregarStatus() }
    catch (e) { setErro(e.message); if (e.offline) setOffline(true) }
    finally { setLoading(false) }
  }

  const conectado = !!status.conectado

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">WhatsApp</h1>
        <p className="text-sm text-[#666666] mt-1">
          Conecte o WhatsApp que o sistema usa para enviar boletos. Uma vez conectado aqui,
          todos os usuários podem enviar documentos por este número.
        </p>
      </div>

      {/* Status */}
      <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className={`inline-block w-3 h-3 rounded-full ${
              offline ? 'bg-yellow-500' : conectado ? 'bg-green-500' : 'bg-red-500'
            }`}></span>
            <div>
              <p className="text-white font-medium">
                {offline ? 'Backend indisponível' : conectado ? 'Conectado' : status.iniciando ? 'Conectando…' : 'Desconectado'}
              </p>
              <p className="text-xs text-[#666666]">{WHATSAPP_API_BASE}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {!conectado && (
              <button
                onClick={handleConectar}
                disabled={loading}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm rounded transition disabled:opacity-50"
              >
                {loading ? 'Aguarde…' : status.qrDataUrl ? 'Gerar novo QR' : 'Conectar'}
              </button>
            )}
            {conectado && (
              <button
                onClick={handleDesconectar}
                disabled={loading}
                className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm rounded transition disabled:opacity-50"
              >
                Desconectar
              </button>
            )}
          </div>
        </div>

        {offline && (
          <div className="text-sm text-yellow-400 bg-yellow-900/20 border border-yellow-800 rounded p-3">
            Não foi possível falar com o backend do WhatsApp em <b>{WHATSAPP_API_BASE}</b>.
            Verifique se o servidor (<code>backend/</code>, <code>npm start</code>) está rodando e se a
            variável <code>VITE_WHATSAPP_API</code> aponta para ele.
          </div>
        )}

        {erro && !offline && (
          <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded p-3 mb-3">{erro}</div>
        )}

        {/* QR Code */}
        {!conectado && !offline && (
          <div className="flex flex-col items-center justify-center py-6">
            {status.qrDataUrl ? (
              <>
                <div className="bg-white p-3 rounded-lg">
                  <img src={status.qrDataUrl} alt="QR Code WhatsApp" width={280} height={280} />
                </div>
                <p className="text-sm text-[#a3a3a3] mt-4 text-center max-w-sm">
                  Abra o WhatsApp no celular → <b>Aparelhos conectados</b> → <b>Conectar um aparelho</b> e
                  aponte para este QR Code.
                </p>
              </>
            ) : (
              <p className="text-sm text-[#666666] py-8">
                {status.iniciando ? 'Gerando QR Code…' : 'Clique em "Conectar" para gerar o QR Code.'}
              </p>
            )}
          </div>
        )}

        {conectado && (
          <div className="text-sm text-green-400 bg-green-900/20 border border-green-800 rounded p-3">
            WhatsApp conectado. Os envios de boletos por WhatsApp já estão liberados para todos os usuários.
          </div>
        )}
      </div>
    </div>
  )
}
