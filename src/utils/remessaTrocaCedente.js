// Leitura da remessa de troca de cedente (CNAB400 MoneyPlus, banco 274).
// Registro 0 = header, 1 = título, 4 = sacado do título anterior, 9 = trailer.

const campo = (linha, ini, fim) => linha.slice(ini - 1, fim)
const soDigitos = (s) => String(s || '').replace(/\D/g, '')

// DDMMAA -> AAAA-MM-DD
const dataCnab = (s) => {
  const d = soDigitos(s)
  if (d.length !== 6 || d === '000000') return null
  return `20${d.slice(4, 6)}-${d.slice(2, 4)}-${d.slice(0, 2)}`
}

// Conta (7 dígitos) igual à posição 24-30 da linha digitável.
export const contaDaLinhaDigitavel = (linha) => soDigitos(linha).slice(23, 30)

export const normalizaNossoNumero = (v) => soDigitos(v).replace(/^0+/, '')

export function parseRemessaTrocaCedente(texto) {
  const linhas = String(texto || '').split(/\r?\n/).filter((l) => l.trim() !== '')
  if (linhas.length === 0 || !linhas[0].startsWith('01REMESSA')) {
    throw new Error('Arquivo não é uma remessa CNAB400 (header 01REMESSA não encontrado).')
  }
  const header = linhas[0]
  const cedenteNome = campo(header, 47, 76).trim()
  const titulos = []
  for (const l of linhas.slice(1)) {
    const tipo = l[0]
    if (tipo === '1') {
      const nossoNumero = normalizaNossoNumero(campo(l, 77, 87))
      titulos.push({
        sequencia: Number(campo(l, 395, 400)) || titulos.length + 1,
        conta: campo(l, 30, 36), // identificação da empresa: 0 + carteira(3) + agência(5) + conta(7) + DV
        nossoNumero,
        nossoNumeroDv: campo(l, 88, 88),
        seuNumero: campo(l, 111, 120).trim(),
        vencimento: dataCnab(campo(l, 121, 126)),
        valor: (Number(soDigitos(campo(l, 127, 139))) || 0) / 100,
        emissao: dataCnab(campo(l, 151, 156)),
        sacadoDoc: '',
        sacadoNome: '',
        sacadoCidade: '',
        sacadoUf: '',
      })
    } else if (tipo === '4' && titulos.length > 0) {
      const t = titulos[titulos.length - 1]
      const tipoInsc = campo(l, 2, 3)
      const doc = soDigitos(campo(l, 4, 17))
      t.sacadoDoc = tipoInsc === '01' ? doc.slice(-11) : doc
      t.sacadoNome = campo(l, 18, 57).trim()
      t.sacadoCidade = campo(l, 124, 153).trim()
      t.sacadoUf = campo(l, 154, 155).trim()
    }
  }
  if (titulos.length === 0) throw new Error('Nenhum título (registro tipo 1) encontrado na remessa.')
  return { cedenteNome, conta: titulos[0].conta, titulos }
}
