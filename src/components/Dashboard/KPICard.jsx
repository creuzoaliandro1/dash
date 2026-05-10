export default function KPICard({ label, value, delta, deltaType = 'pos', trend = null }) {
  return (
    <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-4">
      <p className="text-xs font-medium text-[#666666] uppercase tracking-wider">{label}</p>

      <p className="text-2xl font-bold text-white mt-2">
        {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
      </p>

      {delta && (
        <div className="flex items-center gap-1 mt-2 text-xs">
          <span className={deltaType === 'pos' ? 'text-white' : 'text-[#a3a3a3]'}>
            {deltaType === 'pos' ? '↑' : '↓'} {Math.abs(delta)}%
          </span>
          <span className="text-[#666666]">vs mês anterior</span>
        </div>
      )}
    </div>
  )
}
