#!/usr/bin/env node
// ============================================================================
// Proxy de saída HTTP(S) com autenticação Basic — dá às Edge Functions do
// Supabase um IP de saída FIXO (o desta máquina) para chamar a API do BMP.
//
// Contexto: o BMP exige allowlist de IP fixo para liberar as chamadas de API,
// mas as Edge Functions do Supabase rodam em infraestrutura distribuída sem
// IP de saída fixo (cada execução pode sair por um IP diferente). A correção
// oficialmente recomendada pela própria Supabase é rotear as chamadas por um
// proxy de saída com IP fixo. Este script É esse proxy — roda nesta máquina
// (que já tem o IP fixo cadastrado no BMP) e as Edge Functions passam a se
// conectar aqui, que por sua vez repassa a chamada pro BMP saindo com o IP
// desta máquina.
//
// Suporta apenas o método CONNECT (túnel HTTPS) — suficiente pra tudo que o
// BMP expõe (auth.moneyp.dev.br, api.ext.dbs.moneyp.dev.br, etc., todos HTTPS).
//
// USO:
//   1) Defina usuário/senha fortes (você escolhe, não me envie o valor):
//        set PROXY_USER=algum-usuario          (Windows PowerShell: $env:PROXY_USER="...")
//        set PROXY_PASS=uma-senha-bem-forte
//        set PROXY_PORT=8443                    (opcional, padrão 8443)
//   2) Rode:
//        node bmp-outbound-proxy.js
//   3) Libere a porta escolhida no firewall/roteador desta máquina para
//      entrada externa (só essa porta, TCP).
//   4) No Supabase (Project Settings > Edge Functions > Secrets), crie o
//      secret BMP_PROXY_URL com o valor:
//        https://SEU_USUARIO:SUA_SENHA@SEU_IP_FIXO:PORTA
//      (isso você faz direto no painel do Supabase — não me passe a senha)
//
// Rodar como serviço permanente (não fechar o terminal): considere usar
// pm2 (`npm i -g pm2 && pm2 start bmp-outbound-proxy.js`) ou o Agendador de
// Tarefas do Windows / systemd no Linux, para reiniciar sozinho se cair.
// ============================================================================

const http = require('http')
const net = require('net')
const dns = require('dns')

const PORT = Number(process.env.PROXY_PORT) || 8443
const USER = process.env.PROXY_USER
const PASS = process.env.PROXY_PASS

if (!USER || !PASS) {
  console.error('Defina PROXY_USER e PROXY_PASS (variáveis de ambiente) antes de rodar este script.')
  process.exit(1)
}

function checkAuth(req) {
  const header = req.headers['proxy-authorization']
  if (!header || !header.startsWith('Basic ')) return false
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8')
  const sep = decoded.indexOf(':')
  if (sep === -1) return false
  const user = decoded.slice(0, sep)
  const pass = decoded.slice(sep + 1)
  return user === USER && pass === PASS
}

const server = http.createServer((req, res) => {
  // Requisições HTTP simples não são usadas pelo BMP (tudo é HTTPS), mas
  // respondemos algo sensato em vez de deixar a conexão pendurada.
  if (!checkAuth(req)) {
    res.writeHead(407, { 'Proxy-Authenticate': 'Basic realm="bmp-proxy"' })
    return res.end('Proxy authentication required')
  }
  res.writeHead(501)
  res.end('Este proxy só suporta CONNECT (túnel HTTPS)')
})

server.on('connect', (req, clientSocket, head) => {
  console.log(`[bmp-outbound-proxy] CONNECT recebido: url="${req.url}" de ${clientSocket.remoteAddress}, headers=${JSON.stringify(req.headers)}`)

  if (!checkAuth(req)) {
    console.log('[bmp-outbound-proxy] falhou autenticação, recusando')
    clientSocket.write('HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="bmp-proxy"\r\n\r\n')
    return clientSocket.end()
  }

  // req.url no método CONNECT vem como "host:porta"
  const [hostname, portStr] = req.url.split(':')
  const port = Number(portStr) || 443
  console.log(`[bmp-outbound-proxy] autenticado, conectando em ${hostname}:${port}...`)

  dns.lookup(hostname, { all: true }, (err, addresses) => {
    if (err) console.log(`[bmp-outbound-proxy] falha ao resolver DNS de ${hostname}:`, String(err))
    else console.log(`[bmp-outbound-proxy] ${hostname} resolve para:`, JSON.stringify(addresses))
  })

  const serverSocket = net.connect(port, hostname, () => {
    console.log(`[bmp-outbound-proxy] conectado em ${hostname}:${port}, iniciando túnel`)
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
    serverSocket.write(head)
    serverSocket.pipe(clientSocket)
    clientSocket.pipe(serverSocket)
  })

  serverSocket.setTimeout(20000, () => {
    console.log(`[bmp-outbound-proxy] TIMEOUT conectando em ${hostname}:${port} (20s sem resposta)`)
    serverSocket.destroy()
    clientSocket.end()
  })

  serverSocket.on('error', (err) => {
    console.error('[bmp-outbound-proxy] erro ao conectar no destino', hostname, port, String(err))
    clientSocket.end()
  })
  clientSocket.on('error', (err) => {
    console.error('[bmp-outbound-proxy] erro no socket do cliente:', String(err))
    serverSocket.end()
  })
  clientSocket.on('close', () => console.log(`[bmp-outbound-proxy] cliente fechou a conexão (${hostname}:${port})`))
})

server.listen(PORT, () => {
  console.log(`[bmp-outbound-proxy] rodando na porta ${PORT} — só aceita CONNECT autenticado.`)
})
