// Estilos e pequenos componentes compartilhados entre as abas de Conta (BMP).
// Segue o padrão visual do restante do app (AcessosPage / CadastroPage).

export const inputCls =
  'w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-md text-white placeholder-[#666666] outline-none focus:border-white transition text-sm'

export const selectCls =
  'w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-md text-white outline-none focus:border-white transition text-sm'

export const textareaCls =
  'w-full px-3 py-2 bg-[#111111] border border-[#2a2a2a] rounded-md text-white placeholder-[#666666] outline-none focus:border-white transition text-sm resize-y'

export const labelCls = 'block text-xs font-medium text-[#a3a3a3] mb-1.5'

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
      className={`p-3 rounded-md text-xs border ${
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
    <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-6">
      {title && <h2 className="text-sm font-semibold text-white mb-1">{title}</h2>}
      {description && <p className="text-xs text-[#a3a3a3] mb-4">{description}</p>}
      {children}
    </div>
  )
}

export function PrimaryButton({ children, ...props }) {
  return (
    <button
      {...props}
      className="px-3 py-2 bg-white text-black font-medium rounded-md hover:opacity-90 disabled:opacity-50 transition text-sm"
    >
      {children}
    </button>
  )
}

export function SecondaryButton({ children, ...props }) {
  return (
    <button
      {...props}
      className="px-3 py-2 bg-[#111111] border border-[#2a2a2a] text-white font-medium rounded-md hover:border-white disabled:opacity-50 transition text-sm"
    >
      {children}
    </button>
  )
}

// Extrai uma mensagem de erro amigável de uma resposta supabase.functions.invoke,
// cobrindo tanto o erro de transporte (error) quanto o erro de negócio
// (data?.sucesso === false / data?.mensagem), igual ao padrão de AcessosPage.jsx.
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
