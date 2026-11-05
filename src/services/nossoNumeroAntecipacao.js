// Monta o NOSSO_NUMERO gravado em OPEITEWEB na antecipação (17 dígitos).
//
// Nosso número completo (6+ dígitos, ex.: 386400257 = cedente 386 + 400257):
//   36877480 + número com zeros à esquerda até 9  -> 36877480386400257
// Nosso número curto (até 5 dígitos, ex.: 384, cedente 467):
//   36877480 + cedente(3) + '5' + número com zeros até 5 -> 36877480467500384

export const PREFIXO_NOSSO_NUMERO = '36877480' // 8 dígitos

const soDigitos = (s) => String(s ?? '').replace(/\D/g, '')

export function montarNossoNumeroAntecipacao(nossoNumero, codCedente) {
  const num = soDigitos(nossoNumero)
  if (num.length > 0 && num.length <= 5) {
    const ced = soDigitos(codCedente).padStart(3, '0')
    return (PREFIXO_NOSSO_NUMERO + ced + '5' + num.padStart(5, '0')).slice(0, 30)
  }
  return (PREFIXO_NOSSO_NUMERO + num.padStart(9, '0')).slice(0, 30)
}
