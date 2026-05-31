import { generateBorderoPDF } from './src/utils/_bordero_clean.mjs'
import { writeFileSync } from 'fs'
const data = {
  cedente: { COD_CEDENTE: 438, RAZAO_SOCIAL: 'CARRETAO COMERCIO E SERVICOS AUTOMOTIVO LTDA', CIC: '29982197000193' },
  cabecalho: { COD_OPERACAO: 241, COD_CEDENTE: 438, DATA: '2026-05-07', QTD_TITULOS: 1, VR_DESAGIO: 20.75, VR_IOF: 4.50, VR_CPMF: 2.82, VR_ADVALOREM: 5.92, VR_ISS: 0.29, VR_COBRANCA: 5.00, VR_LIQUIDO: 686.81, PRAZO_MEDIO: 25, STATUS: 'BI', STATUS_PAGAMENTO: 'P' },
  titulos: [
    { tipo:'DUP', numero:'11190-01', vencimento:'2026-06-01', valor:741.09, nome:'UTISEG TRANSPORTES E LOCACOES LTDA', cic:'08035579000130', dias:25 },
  ],
}
writeFileSync('/sessions/upbeat-dreamy-einstein/mnt/outputs/bordero_test.pdf', Buffer.from(await generateBorderoPDF(data).arrayBuffer()))
console.log('OK')
