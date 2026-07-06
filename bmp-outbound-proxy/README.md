# Proxy de saída para o BMP (IP fixo)

O BMP exige que as chamadas de API venham de um IP fixo cadastrado. As Edge Functions do
Supabase não têm IP de saída fixo (cada execução pode sair por um IP diferente), então a
chamada nunca vai bater com o IP cadastrado no BMP — não importa de onde você abre o app.

A solução (recomendada pela própria documentação da Supabase): rotear as chamadas ao BMP
por um **proxy de saída** rodando numa máquina com IP fixo. Como vocês já têm essa máquina,
`bmp-outbound-proxy.js` é esse proxy.

## Passo a passo

### 1. Rodar o proxy na máquina com IP fixo

Requer apenas Node.js instalado (sem dependências externas).

```bash
# Escolha um usuário e senha fortes (você mesmo escolhe, não precisa me avisar):
set PROXY_USER=algum-usuario-seu
set PROXY_PASS=uma-senha-bem-forte-e-aleatoria
set PROXY_PORT=8443

node bmp-outbound-proxy.js
```

No PowerShell, use `$env:PROXY_USER = "..."` em vez de `set`.

Para manter rodando permanentemente (reiniciar sozinho se cair ou se a máquina reiniciar),
use o [pm2](https://pm2.keymetrics.io/):

```bash
npm i -g pm2
pm2 start bmp-outbound-proxy.js --name bmp-proxy
pm2 save
pm2 startup   # segue as instruções que aparecerem para iniciar com o sistema
```

### 2. Liberar a porta no firewall/roteador

Libere a porta escolhida (`8443` no exemplo) para conexões de entrada TCP nesta máquina.
Se a máquina estiver atrás de um roteador (NAT), configure port forwarding da porta pública
para essa máquina.

### 3. Cadastrar o secret no Supabase (você mesmo, no painel)

Em **Project Settings → Edge Functions → Secrets**, crie:

```
BMP_PROXY_URL = https://SEU_USUARIO:SUA_SENHA@SEU_IP_FIXO:8443
```

Não me envie a senha — só confirme que o secret `BMP_PROXY_URL` foi criado, e eu sigo
ajustando as Edge Functions para rotear as chamadas ao BMP por ele.

### 4. Confirmar com o BMP

O IP cadastrado no allowlist do BMP deve ser o IP público **desta máquina** (a que roda o
proxy), não o IP de onde vocês acessam o app Capt.

## Segurança

- Use uma senha longa e aleatória — essa porta fica exposta à internet.
- O proxy só aceita `CONNECT` (túnel HTTPS) autenticado — não repassa tráfego não autenticado.
- Considere restringir por IP de origem no firewall se o BMP publicar as faixas de IP de onde
  as respostas/webhooks podem vir (não é o caso aqui, pois é tráfego de saída, mas vale
  revisitar se o BMP também chamar de volta pra algum endpoint desta máquina).
