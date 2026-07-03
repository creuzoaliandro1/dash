import { useState } from 'react'
import PixChavesSection from './PixChavesSection'
import PixQrTransferenciaSection from './PixQrTransferenciaSection'
import PixReivindicacaoContestacaoSection from './PixReivindicacaoContestacaoSection'

// Aba "Pix" — agrega os 30 endpoints do módulo Pix da BMP, organizados em três
// sub-seções (cada uma implementada em um arquivo próprio para manter o
// tamanho dos componentes gerenciável): Chaves/Portabilidade/Favorecido/MFA,
// QR Code/Transferência de recursos, e Reivindicação/Contestação.
const SUBTABS = [
  ['chaves', 'Chaves, portabilidade e favorecidos'],
  ['qr-transferencia', 'QR Code e transferências'],
  ['reivindicacao-contestacao', 'Reivindicação e contestação'],
]

export default function PixTab() {
  const [subtab, setSubtab] = useState('chaves')

  return (
    <div className="w-full">
      <div className="flex gap-1 mb-3 border-b border-[#1f1f1f] overflow-x-auto">
        {SUBTABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSubtab(id)}
            className={`px-4 py-2.5 text-sm font-medium transition rounded-t-md whitespace-nowrap ${
              subtab === id ? 'bg-[#1a1a1a] text-white' : 'text-[#a3a3a3] hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="w-full">
        {subtab === 'chaves' && <PixChavesSection />}
        {subtab === 'qr-transferencia' && <PixQrTransferenciaSection />}
        {subtab === 'reivindicacao-contestacao' && <PixReivindicacaoContestacaoSection />}
      </div>
    </div>
  )
}
