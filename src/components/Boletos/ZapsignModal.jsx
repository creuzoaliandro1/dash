import { useState } from 'react'

// Modal de assinatura ZapSign.
// Passo 1: escolher "Com Sacado" ou "Sem Sacado".
//   - Com Sacado: pergunta "Incluir boletos?" → coleta dados do sacado.
//   - Sem Sacado: pergunta "Incluir boletos?" → envia direto.
// onSubmit({ mode, sacado, incluirBoletos }) deve retornar Promise<{ links: string[], ok, fail, error? }>.
export default function ZapsignModal({ qtd, initialMode, onClose, onSubmit }) {
  // Modo já escolhido no submenu de Ações: vai para perguntaBoletos; sem initialMode → 'choose'.
  const [step, setStep] = useState(
    initialMode ? 'perguntaBoletos' : 'choose'
  )
  const [mode, setMode] = useState(initialMode || null)
  const [sacado, setSacado] = useState({ nome: '', cpf: '', whatsapp: '' })
  const [incluirBoletos, setIncluirBoletos] = useState(null)
  const [result, setResult] = useState(null)
  const [erro, setErro] = useState('')

  const escolher = (m) => {
    setMode(m)
    setStep('perguntaBoletos')
  }

  const responderBoletos = (incBoletos) => {
    setIncluirBoletos(incBoletos)
    const m = mode
    if (m === 'com') {
      setStep('sacadoForm')
    } else {
      enviar(m, null, incBoletos)
    }
  }

  const enviar = async (m, sac, incBoletos = incluirBoletos) => {
    setStep('sending')
    setErro('')
    try {
      const r = await onSubmit({ mode: m, sacado: sac, incluirBoletos: incBoletos })
      if (r?.error) {
        setErro(r.error)
        setStep(m === 'com' ? 'sacadoForm' : 'choose')
        return
      }
      setResult(r)
      setStep('result')
    } catch (e) {
      setErro(e.message || String(e))
      setStep(m === 'com' ? 'sacadoForm' : 'choose')
    }
  }

  const confirmarSacado = () => {
    if (!sacado.nome.trim()) { setErro('Informe o nome do sacado.'); return }
    enviar('com', sacado)
  }

  const inputCls = 'w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded text-white text-sm focus:border-white outline-none transition'

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg max-w-lg w-full max-h-[90vh] flex flex-col">
        <div className="border-b border-[#1f1f1f] px-5 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Assinar (ZapSign)</h2>
            <p className="text-xs text-[#666666]">{qtd} título(s) selecionado(s)</p>
          </div>
          <button onClick={onClose} className="text-[#666666] hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {erro && (
            <div className="mb-3 p-3 bg-[#2a1515] border border-[#5a2a2a] rounded text-sm text-[#ffb4b4]">{erro}</div>
          )}

          {step === 'choose' && (
            <div className="space-y-3">
              <p className="text-sm text-[#a3a3a3]">Como deseja enviar para assinatura?</p>
              <button
                onClick={() => escolher('com')}
                className="w-full text-left p-4 bg-[#111111] border border-[#2a2a2a] rounded-lg hover:border-white transition"
              >
                <div className="text-white font-medium text-sm">Com Sacado</div>
                <div className="text-xs text-[#666666] mt-1">Um documento (Duplicatas + Boletos) assinado por 3 partes: CAPT, cedente e sacado.</div>
              </button>
              <button
                onClick={() => escolher('sem')}
                className="w-full text-left p-4 bg-[#111111] border border-[#2a2a2a] rounded-lg hover:border-white transition"
              >
                <div className="text-white font-medium text-sm">Sem Sacado</div>
                <div className="text-xs text-[#666666] mt-1">Dois documentos: (1) Duplicatas + Boletos e (2) Borderô, assinados por CAPT e cedente.</div>
              </button>
            </div>
          )}

          {step === 'perguntaBoletos' && (
            <div className="space-y-3">
              <p className="text-sm text-[#a3a3a3]">Incluir boletos no link de assinatura?</p>
              <button
                onClick={() => responderBoletos(true)}
                className="w-full text-left p-4 bg-[#111111] border border-[#2a2a2a] rounded-lg hover:border-white transition"
              >
                <div className="text-white font-medium text-sm">Sim</div>
                <div className="text-xs text-[#666666] mt-1">Inclui as fichas de boleto junto com as duplicatas e cessão.</div>
              </button>
              <button
                onClick={() => responderBoletos(false)}
                className="w-full text-left p-4 bg-[#111111] border border-[#2a2a2a] rounded-lg hover:border-white transition"
              >
                <div className="text-white font-medium text-sm">Não</div>
                <div className="text-xs text-[#666666] mt-1">Gera apenas cessão de direitos + borderô + duplicatas (2 por página), sem as fichas de boleto.</div>
              </button>
            </div>
          )}

          {step === 'sacadoForm' && (
            <div className="space-y-3">
              <p className="text-sm text-[#a3a3a3]">Dados do sacado que vai assinar:</p>
              <div>
                <label className="block text-xs text-[#666666] uppercase font-semibold mb-1">Nome</label>
                <input className={inputCls} value={sacado.nome} onChange={(e) => setSacado({ ...sacado, nome: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-[#666666] uppercase font-semibold mb-1">CPF</label>
                <input className={inputCls} value={sacado.cpf} onChange={(e) => setSacado({ ...sacado, cpf: e.target.value })} placeholder="000.000.000-00" />
              </div>
              <div>
                <label className="block text-xs text-[#666666] uppercase font-semibold mb-1">WhatsApp</label>
                <input className={inputCls} value={sacado.whatsapp} onChange={(e) => setSacado({ ...sacado, whatsapp: e.target.value })} placeholder="+55 85 99999-9999" />
              </div>
            </div>
          )}

          {step === 'sending' && (
            <div className="py-8 text-center text-[#a3a3a3] text-sm">Gerando documento(s) e link(s) de assinatura...</div>
          )}

          {step === 'result' && result && (
            <div className="space-y-3">
              <p className="text-sm text-white">Documentos criados: {result.ok} · Falhas: {result.fail}</p>
              {result.notes && result.notes.length > 0 && (
                <div className="space-y-1">
                  {result.notes.map((n, i) => (
                    <p key={i} className="text-xs text-[#a3a3a3]">• {n}</p>
                  ))}
                </div>
              )}
              {result.links && result.links.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-[#666666] uppercase font-semibold">Links de assinatura</p>
                  {result.links.map((l, i) => (
                    <div key={i} className="p-2 bg-[#111111] border border-[#1f1f1f] rounded text-xs">
                      <div className="text-[#a3a3a3] mb-1">{l.label}</div>
                      <a href={l.url} target="_blank" rel="noreferrer" className="text-[#6aa3ff] break-all hover:underline">{l.url}</a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#666666]">Nenhum link retornado.</p>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-[#1f1f1f] px-5 py-3 flex justify-end gap-3">
          {step === 'perguntaBoletos' && (
            <button onClick={() => { setErro(''); if (initialMode) { onClose() } else { setStep('choose') } }} className="px-5 py-2 bg-transparent text-white text-sm font-medium border border-[#2a2a2a] rounded hover:bg-[#111111] transition">{initialMode ? 'Cancelar' : 'Voltar'}</button>
          )}
          {step === 'sacadoForm' && (
            <>
              <button onClick={() => { setErro(''); setStep('perguntaBoletos') }} className="px-5 py-2 bg-transparent text-white text-sm font-medium border border-[#2a2a2a] rounded hover:bg-[#111111] transition">Voltar</button>
              <button onClick={confirmarSacado} className="px-5 py-2 bg-white text-black text-sm font-medium rounded hover:opacity-90 transition">Gerar links</button>
            </>
          )}
          {(step === 'choose' || step === 'result') && (
            <button onClick={onClose} className="px-5 py-2 bg-white text-black text-sm font-medium rounded hover:opacity-90 transition">
              {step === 'result' ? 'Fechar' : 'Cancelar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
