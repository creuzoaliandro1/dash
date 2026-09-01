// Configuração da integração com a API Firebird do ContaCapt.
//
// A integração fica DESLIGADA por padrão. Ligue definindo, no .env do front:
//   VITE_FIREBIRD_ENABLED=true
// ...somente DEPOIS de validar o schema real contra `GET /api/firebird/_tables`
// e conferir os mapeamentos em src/services/firebirdMappings.js.
//
// A chave (X-API-Key) NÃO vive aqui nem em nenhum VITE_* — ela é secret da
// Edge Function `firebird-proxy` (supabase secrets set FIREBIRD_API_KEY=...).

const flag = String(import.meta.env.VITE_FIREBIRD_ENABLED ?? '').toLowerCase()

export const firebirdConfig = {
  // Liga/desliga o roteamento para o Firebird. Off => tudo continua no Supabase.
  enabled: flag === 'true' || flag === '1',

  // Nome da Edge Function proxy.
  proxyFunction: 'firebird-proxy',

  // Quantas vezes retransmitir em 409 (lock do efactor-sync) antes de enfileirar.
  retry409: 3,
  retry409DelayMs: 1500,

  // Tabelas que existem fisicamente no Firebird (Dados.gdb).
  tabelas: [
    'AVALISTA', 'CEDENTE', 'CTACORRENTE', 'NNOPEITE', 'OPECAB', 'OPEITE',
    'OPEITEWEB', 'OPECABWEB', 'SACADO', 'SACADOWEB', 'OCORRENCIA',
    'LANCACTA', 'DEBENTURE', 'MENSAGEM',
  ],
}
