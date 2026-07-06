// Estilos e pequenos componentes compartilhados entre as abas de Conta (BMP).
// Segue o padrão visual do restante do app (AcessosPage / CadastroPage).

export const inputCls =
  'w-full px-2.5 py-1 bg-[#111111] border border-[#2a2a2a] rounded-md text-white placeholder-[#666666] outline-none focus:border-white transition text-sm leading-tight'

export const selectCls =
  'w-full px-2.5 py-1 bg-[#111111] border border-[#2a2a2a] rounded-md text-white outline-none focus:border-white transition text-sm leading-tight'

export const textareaCls =
  'w-full px-2.5 py-1 bg-[#111111] border border-[#2a2a2a] rounded-md text-white placeholder-[#666666] outline-none focus:border-white transition text-sm leading-tight resize-y'

export const labelCls = 'block text-xs font-medium text-[#a3a3a3] mb-0.5'

export function Field({ label, children }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  )
}

export function Feedback({ feedback }) {
  if (!feedback) return null
  return (
    <div
      className={`p-2 rounded-md text-xs border ${
        feedback.ok
          ? 'bg-emerald-900/20 border-emerald-800 text-emerald-200'
          : 'bg-red-900/20 border-red-800 text-red-200'
      }`}
    >
      {feedback.message}
    </div>
  )
}

export function Card({ title, description, children }) {
  return (
    <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-4">
      {title && <h2 className="text-sm font-semibold text-white mb-0.5">{title}</h2>}
      {description && <p className="text-xs text-[#a3a3a3] mb-2">{description}</p>}
      {children}
    </div>
  )
}

export function PrimaryButton({ children, ...props }) {
  return (
    <button
      {...props}
      className="px-3 py-1 bg-white text-black font-medium rounded-md hover:opacity-90 disabled:opacity-50 transition text-sm leading-tight"
    >
      {children}
    </button>
  )
}

export function SecondaryButton({ children, ...props }) {
  return (
    <button
      {...props}
      className="px-3 py-1 bg-[#111111] border border-[#2a2a2a] text-white font-medium rounded-md hover:border-white disabled:opacity-50 transition text-sm leading-tight"
    >
      {children}
    </button>
  )
}

// Extrai uma mensagem de erro amigável de uma resposta supabase.functions.invoke,
// cobrindo tanto o erro de transporte (error) quanto o erro de negócio
// (data?.sucesso === false / data?.mensagem), igual ao padrão de AcessosPage.jsx.
//
// Nota (03/07/2026): antes disso, error.message vinha sempre com o texto
// genérico "Edge Function returned a non-2xx status code" do supabase-js,
// escondendo a causa real (o que o BMP respondeu). Isso foi corrigido em
// src/lib/supabase.js, que intercepta supabase.functions.invoke e já
// substitui error.message pelo body real (mensagem/error) antes de chegar
// aqui — por isso esta função continua síncrona, sem precisar mudar as
// dezenas de call sites espalhados pelo app.
export function extractError(data, error, fallback) {
  if (error) return error.message || fallback
  if (data?.sucesso === false) return data.mensagem || fallback
  if (data?.error) return data.error
  return null
}

export function formatMoeda(v) {
  const n = Number(v)
  if (Number.isNaN(n)) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatDataHora(v) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleString('pt-BR')
}

export function formatData(v) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString('pt-BR')
}
