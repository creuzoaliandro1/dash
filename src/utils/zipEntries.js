import { inflateSync } from 'fflate'

// Lê TODAS as entradas de um .zip pelo diretório central, uma a uma.
// Diferente do JSZip (que indexa por nome e sobrescreve), entradas com o
// MESMO NOME dentro do zip são preservadas como itens separados.
// Retorna [{ name, data: Uint8Array }] na ordem em que aparecem no zip.
export function lerEntradasZip(input) {
  const buf = input instanceof Uint8Array ? input : new Uint8Array(input)
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)

  // Localiza o End Of Central Directory (assinatura 0x06054b50), varrendo do fim
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('arquivo .zip inválido (EOCD não encontrado)')

  const total = dv.getUint16(eocd + 10, true)
  let p = dv.getUint32(eocd + 16, true)
  if (total === 0xffff || p === 0xffffffff) throw new Error('.zip no formato ZIP64 não suportado')

  const utf8 = new TextDecoder('utf-8')
  const latin1 = new TextDecoder('latin1')
  const out = []
  for (let n = 0; n < total; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('diretório central do .zip corrompido')
    const flags = dv.getUint16(p + 8, true)
    const method = dv.getUint16(p + 10, true)
    const compSize = dv.getUint32(p + 20, true)
    const nameLen = dv.getUint16(p + 28, true)
    const extraLen = dv.getUint16(p + 30, true)
    const commentLen = dv.getUint16(p + 32, true)
    const localOff = dv.getUint32(p + 42, true)
    const nameBytes = buf.subarray(p + 46, p + 46 + nameLen)
    const name = (flags & 0x800 ? utf8 : latin1).decode(nameBytes)
    p += 46 + nameLen + extraLen + commentLen

    if (name.endsWith('/')) continue   // diretório
    if (flags & 0x1) throw new Error(`${name}: entrada criptografada não suportada`)
    if (dv.getUint32(localOff, true) !== 0x04034b50) throw new Error(`${name}: cabeçalho local inválido`)
    const start = localOff + 30 + dv.getUint16(localOff + 26, true) + dv.getUint16(localOff + 28, true)
    const raw = buf.subarray(start, start + compSize)

    let data
    if (method === 0) data = raw.slice()
    else if (method === 8) data = inflateSync(raw)
    else throw new Error(`${name}: método de compressão ${method} não suportado`)
    out.push({ name, data })
  }
  return out
}
