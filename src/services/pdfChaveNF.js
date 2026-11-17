// Leitura da CHAVE DE ACESSO de NF-e a partir de um PDF (DANFE).
//
// 1) Texto do PDF (DANFE gerado por sistema): procura 44 dígitos válidos.
// 2) Sem texto (DANFE "impresso em PDF" como desenho, ou escaneado): renderiza
//    as páginas e lê o código de barras Code128 da chave. A decodificação é
//    "borda a borda" (soma de pares de elementos vizinhos), que tolera o
//    engrossamento das barras típico de scans; o ZXing fica como reserva.
// 3) QR Code (NFS-e / NFC-e) é lido só para identificar o tipo de documento.
//
// A chave só é aceita com o dígito verificador (módulo 11) correto, UF IBGE
// válida e modelo 55 (NF-e) — evita consultar o Serpro com leituras erradas.

const UFS_IBGE = new Set(['11', '12', '13', '14', '15', '16', '17', '21', '22', '23', '24', '25', '26', '27', '28', '29',
  '31', '32', '33', '35', '41', '42', '43', '50', '51', '52', '53'])

export function chaveNFeValida(chave) {
  if (!/^\d{44}$/.test(chave)) return false
  if (!UFS_IBGE.has(chave.slice(0, 2))) return false
  if (chave.slice(20, 22) !== '55') return false // só NF-e (o Serpro consulta modelo 55)
  let soma = 0, peso = 2
  for (let i = 42; i >= 0; i--) {
    soma += Number(chave[i]) * peso
    peso = peso === 9 ? 2 : peso + 1
  }
  const resto = soma % 11
  return (resto < 2 ? 0 : 11 - resto) === Number(chave[43])
}

// Todas as chaves NF-e válidas dentro de um texto (dígitos podem vir separados
// por espaço, ponto ou hífen, ex.: "2326 1130 0139 ...").
export function chavesNFeNoTexto(texto) {
  const achadas = new Set()
  const blocos = String(texto || '').match(/\d(?:[\d .\- ]*\d)?/g) || []
  for (const b of blocos) {
    const d = b.replace(/\D/g, '')
    for (let i = 0; i + 44 <= d.length; i++) {
      const c = d.slice(i, i + 44)
      if (chaveNFeValida(c)) { achadas.add(c); i += 43 }
    }
  }
  return [...achadas]
}

// Chave da NFS-e Padrão Nacional (50 dígitos) — só para avisar que é NFS-e
function chaveNFSeNoTexto(texto) {
  const t = String(texto || '')
  if (!/NFS-?E/i.test(t)) return null
  const m = t.replace(/[ . ]/g, '').match(/\d{50}/)
  return m ? m[0] : null
}

let zxingPromise = null
function loadZXing() {
  if (window.ZXing) return Promise.resolve(window.ZXing)
  if (!zxingPromise) {
    zxingPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js'
      s.onload = () => (window.ZXing ? resolve(window.ZXing) : reject(new Error('ZXing não carregou')))
      s.onerror = () => { zxingPromise = null; reject(new Error('Erro ao carregar leitor de código de barras')) }
      document.head.appendChild(s)
    })
  }
  return zxingPromise
}

// Code128 por soma de bordas. larguras: barra, espaço, barra, ... (começa em barra)
function decodeCode128Bordas(ZX, larguras) {
  const P = ZX.Code128Reader.CODE_PATTERNS
  if (!P) return null
  const E = P.map(p => [p[0] + p[1], p[1] + p[2], p[2] + p[3], p[3] + p[4]])
  const melhor = (w0, k) => {
    const w = larguras
    const T = w[k] + w[k + 1] + w[k + 2] + w[k + 3] + w[k + 4] + w[k + 5]
    if (!T) return [-1, 99]
    const m0 = (w[k] + w[k + 1]) * 11 / T, m1 = (w[k + 1] + w[k + 2]) * 11 / T
    const m2 = (w[k + 2] + w[k + 3]) * 11 / T, m3 = (w[k + 3] + w[k + 4]) * 11 / T
    let bv = -1, bs = 99
    for (let v = 0; v < E.length; v++) {
      const e = E[v]
      const s = Math.abs(m0 - e[0]) + Math.abs(m1 - e[1]) + Math.abs(m2 - e[2]) + Math.abs(m3 - e[3])
      if (s < bs) { bs = s; bv = v }
    }
    return [bv, bs]
  }
  for (let i = 0; i + 6 <= larguras.length; i += 2) {
    const [v0, s0] = melhor(null, i)
    if (v0 !== 105 || s0 > 1.6) continue // Start C
    const vals = [105]
    let k = i + 6, fim = false
    while (k + 6 <= larguras.length) {
      const [v, s] = melhor(null, k)
      if (s > 2.2) break
      if (v === 106) { fim = true; break } // Stop
      vals.push(v); k += 6
    }
    if (!fim || vals.length < 3) continue
    const chk = vals.pop()
    let soma = vals[0]
    for (let j = 1; j < vals.length; j++) soma += j * vals[j]
    if (soma % 103 !== chk || vals.slice(1).some(v => v > 99)) continue
    return vals.slice(1).map(v => String(v).padStart(2, '0')).join('')
  }
  return null
}

// Renderiza uma página e devolve os códigos (Code128 e QR) encontrados
async function codigosDaPagina(ZX, page, scale = 4) {
  const vp = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(vp.width); canvas.height = Math.floor(vp.height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height) // fundo branco (transparente vira preto)
  await page.render({ canvasContext: ctx, viewport: vp }).promise
  const W = canvas.width, H = canvas.height
  const rgba = ctx.getImageData(0, 0, W, H).data
  const g = new Uint8ClampedArray(W * H)
  for (let k = 0, j = 0; k < g.length; k++, j += 4) g[k] = (rgba[j] * 299 + rgba[j + 1] * 587 + rgba[j + 2] * 114) / 1000
  canvas.width = canvas.height = 0

  // Localiza faixas com muitas transições claro/escuro próximas (código de barras)
  const LIM = 150, STEP = 3, maxGap = Math.max(12, Math.round(W * 0.012))
  const linhas = []
  for (let y = 0; y < H; y += STEP) {
    const off = y * W
    let prev = g[off] < LIM, cl = null
    const fechar = () => { if (cl && cl.n >= 60 && cl.x1 - cl.x0 > W * 0.12) linhas.push({ y, x0: cl.x0, x1: cl.x1, n: cl.n }) }
    for (let x = 1; x < W; x++) {
      const b = g[off + x] < LIM
      if (b !== prev) {
        if (cl && x - cl.x1 <= maxGap) { cl.x1 = x; cl.n++ } else { fechar(); cl = { x0: x, x1: x, n: 1 } }
        prev = b
      }
    }
    fechar()
  }
  const regioes = []
  for (const r of linhas) {
    const R = regioes.find(q => r.y - q.y1 <= STEP * 3 && Math.abs(r.x0 - q.x0) < W * 0.03 && Math.abs(r.x1 - q.x1) < W * 0.03)
    if (R) { R.y1 = r.y; R.x0 = Math.min(R.x0, r.x0); R.x1 = Math.max(R.x1, r.x1); R.linhas++; R.n += r.n }
    else regioes.push({ y0: r.y, y1: r.y, x0: r.x0, x1: r.x1, linhas: 1, n: r.n })
  }
  // código de barras da chave tem altura (várias linhas amostradas); texto não
  const candidatas = regioes.filter(R => R.linhas >= 10).sort((a, b) => b.n / b.linhas - a.n / a.linhas).slice(0, 6)

  const codigos = []
  const hints = new Map([[ZX.DecodeHintType.TRY_HARDER, true]])
  const reader = new ZX.Code128Reader()
  for (const R of candidatas) {
    const M = 40, x0 = Math.max(0, R.x0 - 6), x1 = Math.min(W - 1, R.x1 + 6), sw = x1 - x0 + 1
    let achou = null
    for (let yb = R.y0; yb <= R.y1 && !achou; yb += 6) {
      // perfil médio de 6 linhas (reduz ruído do scan)
      const prof = new Float32Array(sw)
      for (let dy = 0; dy < 6; dy++) { const off = Math.min(H - 1, yb + dy) * W + x0; for (let x = 0; x < sw; x++) prof[x] += g[off + x] / 6 }
      let mn = 255, mx = 0
      for (const v of prof) { if (v < mn) mn = v; if (v > mx) mx = v }
      for (const frac of [0.5, 0.4, 0.6, 0.3, 0.7]) {
        const T2 = mn + (mx - mn) * frac
        const runs = []
        for (let x = 0; x < sw; x++) {
          if (prof[x] < T2) { const u = runs[runs.length - 1]; if (u && u[1] === x - 1) u[1] = x; else runs.push([x, x]) }
        }
        const larg = []
        for (let r = 0; r < runs.length; r++) {
          larg.push(runs[r][1] - runs[r][0] + 1)
          if (r + 1 < runs.length) larg.push(runs[r + 1][0] - runs[r][1] - 1)
        }
        achou = decodeCode128Bordas(ZX, larg) || decodeCode128Bordas(ZX, [...larg].reverse()) // página de cabeça p/ baixo
        if (achou) break
        // reserva: ZXing (descartando barras soltas nas pontas, ex.: borda do quadro)
        for (const [ti, tf] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          if (runs.length - ti - tf < 60) continue
          const bits = new ZX.BitArray(sw + 2 * M)
          for (let r = ti; r < runs.length - tf; r++) for (let x = runs[r][0]; x <= runs[r][1]; x++) bits.set(x + M)
          try { achou = reader.decodeRow(0, bits, hints).getText(); break } catch { /* próximo */ }
        }
        if (achou) break
      }
    }
    if (achou) codigos.push(achou)
    if (codigos.some(chaveNFeValida)) break
  }
  // QR Code (NFS-e / NFC-e) — página reduzida pela metade
  if (!codigos.some(chaveNFeValida)) {
    try {
      const w2 = Math.floor(W / 2), h2 = Math.floor(H / 2)
      const s = new Uint8ClampedArray(w2 * h2)
      for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) s[y * w2 + x] = g[(y * 2) * W + x * 2]
      const r = new ZX.QRCodeReader().decode(new ZX.BinaryBitmap(new ZX.HybridBinarizer(new ZX.RGBLuminanceSource(s, w2, h2))), hints)
      codigos.push('QR:' + r.getText())
    } catch { /* sem QR */ }
  }
  return codigos
}

/**
 * Extrai as chaves de acesso de NF-e de um PDF (DANFE com texto, desenhado ou escaneado).
 * @param {object} pdf - documento pdf.js já aberto
 * @param {string} texto - texto já extraído do PDF
 * @returns {Promise<{chaves: string[], nfse: boolean}>}
 */
export async function extrairChavesNFeDoPDF(pdf, texto) {
  const chaves = new Set(chavesNFeNoTexto(texto))
  let nfse = !!chaveNFSeNoTexto(texto)

  if (chaves.size === 0) {
    const ZX = await loadZXing()
    const paginas = Math.min(pdf.numPages, 12)
    for (let i = 1; i <= paginas; i++) {
      const page = await pdf.getPage(i)
      const codigos = await codigosDaPagina(ZX, page)
      for (const c of codigos) {
        if (c.startsWith('QR:')) {
          const qr = c.slice(3)
          chavesNFeNoTexto(qr).forEach(k => chaves.add(k))
          if (/nfse|nfs-e|iss\./i.test(qr)) nfse = true
        } else {
          chavesNFeNoTexto(c).forEach(k => chaves.add(k))
        }
      }
    }
  }
  return { chaves: [...chaves], nfse }
}
