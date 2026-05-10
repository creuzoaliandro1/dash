export default function Header({ showUserMenu, setShowUserMenu, onLogout }) {
  return (
    <header className="h-16 bg-[#0a0a0a] border-b border-[#1f1f1f] flex items-center justify-between px-8 sticky top-0 z-40 backdrop-blur-lg">
      <div />

      <div className="flex items-center gap-3">
        <button className="flex items-center gap-2 px-4 py-2 bg-white text-black text-xs font-medium rounded hover:opacity-90 transition">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 2H11v20h2V2z"></path>
            <path d="M17 6h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-3"></path>
            <path d="M7 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3"></path>
          </svg>
          Emitir boleto
        </button>

        <button className="flex items-center gap-2 px-3 py-2 border border-[#2a2a2a] text-white text-xs font-medium rounded hover:bg-[#111111] transition">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6"></path>
            <path d="M20.49 15a9 9 0 1 1-2-8.83"></path>
          </svg>
          Atualizar
        </button>

        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="w-7 h-7 bg-[#1a1a1a] border border-[#2a2a2a] rounded-full flex items-center justify-center text-white text-xs font-semibold hover:bg-[#2a2a2a] transition cursor-pointer"
        >
          CA
        </button>
      </div>
    </header>
  )
}
