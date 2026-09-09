# Configuração de E-mail SMTP — contacapt.com.br

Guia para configurar **qualquer outra aplicação** (site, sistema, script, bot) a enviar e-mails usando a mesma caixa de e-mail que o ContaCapt já usa hoje (Edge Function `send-boleto-email`, projeto Supabase "ContaCapt").

---

## 1. Dados de conexão SMTP

| Parâmetro | Valor |
|---|---|
| **Host** | `rs00002.prodns.com.br` |
| **Porta** | `587` |
| **Segurança** | STARTTLS (a conexão começa sem TLS e faz upgrade — **não** é SSL implícito na 465) |
| **Usuário (auth)** | `contato@contacapt.com.br` |
| **Senha** | `Hyy3476!@#` |
| **Remetente (From)** | `contato@contacapt.com.br` |
| **Nome de exibição** | `ContaCapt` |
| **Autenticação** | `AUTH LOGIN` (usuário e senha em Base64) |

Essa é a mesma conta usada hoje pela function `send-boleto-email` no Supabase — qualquer aplicação nova pode usar exatamente essas credenciais para enviar como `contato@contacapt.com.br`.

> ⚠️ **Antes de reutilizar em produção**: essa senha está hoje hardcoded direto no código-fonte da Edge Function original. O ideal é já nascer configurando a nova aplicação para ler host/usuário/senha de variáveis de ambiente ou de um cofre de segredos (Supabase Secrets, `.env` fora do controle de versão, secret manager da plataforma que for usar), nunca deixando a senha escrita no código.

---

## 2. Como usar — por linguagem/stack

Qualquer biblioteca SMTP padrão funciona com esses dados. Não é necessário reimplementar o protocolo na mão (a function original fez isso porque o Deno Edge Runtime não tinha uma lib de e-mail pronta na época) — em qualquer outro ambiente, use a biblioteca SMTP padrão da linguagem.

### Node.js (Nodemailer — recomendado)

```bash
npm install nodemailer
```

```js
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'rs00002.prodns.com.br',
  port: Number(process.env.SMTP_PORT || 587),
  secure: false, // false = usa STARTTLS na porta 587 (não é SSL implícito)
  auth: {
    user: process.env.SMTP_USER || 'contato@contacapt.com.br',
    pass: process.env.SMTP_PASS, // nunca hardcode — vem de variável de ambiente
  },
})

await transporter.sendMail({
  from: '"ContaCapt" <contato@contacapt.com.br>',
  to: 'destinatario@exemplo.com',
  subject: 'Assunto do e-mail',
  html: '<p>Corpo em HTML</p>',
  attachments: [
    {
      filename: 'documento.pdf',
      content: pdfBuffer, // Buffer ou base64
      contentType: 'application/pdf',
    },
  ],
})
```

### Node.js dentro de uma Supabase Edge Function (Deno)

O Deno não tem `nodemailer` nativo, mas existe uma lib SMTP pronta para Deno que evita reimplementar o protocolo manualmente (como a function original fez):

```ts
import { SMTPClient } from "https://deno.land/x/denomailer/mod.ts"

const client = new SMTPClient({
  connection: {
    hostname: Deno.env.get("SMTP_HOST")!,   // rs00002.prodns.com.br
    port: Number(Deno.env.get("SMTP_PORT") || 587),
    tls: false,           // conecta sem TLS e faz STARTTLS automaticamente
    auth: {
      username: Deno.env.get("SMTP_USER")!, // contato@contacapt.com.br
      password: Deno.env.get("SMTP_PASS")!,
    },
  },
})

await client.send({
  from: "ContaCapt <contato@contacapt.com.br>",
  to: "destinatario@exemplo.com",
  subject: "Assunto",
  html: "<p>Corpo em HTML</p>",
  attachments: [
    {
      filename: "documento.pdf",
      content: pdfBase64,
      encoding: "base64",
      contentType: "application/pdf",
    },
  ],
})

await client.close()
```

Configurar os segredos nessa nova function (nunca no código):
```bash
supabase secrets set SMTP_HOST=rs00002.prodns.com.br SMTP_PORT=587 SMTP_USER=contato@contacapt.com.br SMTP_PASS='Hyy3476!@#'
```

### Python

```bash
pip install --break-system-packages secure-smtplib  # ou apenas smtplib (já vem na stdlib)
```

```python
import smtplib
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication

msg = MIMEMultipart()
msg['From'] = 'ContaCapt <contato@contacapt.com.br>'
msg['To'] = 'destinatario@exemplo.com'
msg['Subject'] = 'Assunto do e-mail'
msg.attach(MIMEText('<p>Corpo em HTML</p>', 'html'))

with open('documento.pdf', 'rb') as f:
    anexo = MIMEApplication(f.read(), _subtype='pdf')
    anexo.add_header('Content-Disposition', 'attachment', filename='documento.pdf')
    msg.attach(anexo)

with smtplib.SMTP(os.environ['SMTP_HOST'], int(os.environ.get('SMTP_PORT', 587))) as server:
    server.starttls()
    server.login(os.environ['SMTP_USER'], os.environ['SMTP_PASS'])
    server.send_message(msg)
```

### PHP (PHPMailer)

```php
require 'vendor/autoload.php';
use PHPMailer\PHPMailer\PHPMailer;

$mail = new PHPMailer(true);
$mail->isSMTP();
$mail->Host       = getenv('SMTP_HOST');   // rs00002.prodns.com.br
$mail->Port       = getenv('SMTP_PORT') ?: 587;
$mail->SMTPAuth   = true;
$mail->Username   = getenv('SMTP_USER');   // contato@contacapt.com.br
$mail->Password   = getenv('SMTP_PASS');
$mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;

$mail->setFrom('contato@contacapt.com.br', 'ContaCapt');
$mail->addAddress('destinatario@exemplo.com');
$mail->Subject = 'Assunto do e-mail';
$mail->isHTML(true);
$mail->Body = '<p>Corpo em HTML</p>';
$mail->addAttachment('documento.pdf');
$mail->send();
```

### Qualquer outra linguagem / cliente genérico

Se a lib/ferramenta pedir só os campos de conexão (ex: um serviço low-code, um CRM, um formulário de contato de terceiros), preencha assim:

- **SMTP Server / Host**: `rs00002.prodns.com.br`
- **Port**: `587`
- **Encryption**: `STARTTLS` (às vezes aparece como "TLS" — não confundir com "SSL"/porta 465, que é outro modo)
- **Username**: `contato@contacapt.com.br`
- **Password**: `Hyy3476!@#`
- **From email**: `contato@contacapt.com.br`

---

## 3. Variáveis de ambiente sugeridas (para não repetir hardcode)

Em qualquer aplicação nova, use essas 4 variáveis (mesmo padrão em qualquer stack):

```
SMTP_HOST=rs00002.prodns.com.br
SMTP_PORT=587
SMTP_USER=contato@contacapt.com.br
SMTP_PASS=Hyy3476!@#
```

- Node/Vite local: colocar em `.env.local` (que já está no `.gitignore` do projeto Capt) — nunca em `.env.example`.
- Supabase Edge Function: `supabase secrets set` (mostrado acima), nunca em `Deno.env` com valor fixo no código.
- Outro provedor (Vercel, Railway, servidor próprio etc.): configurar nas variáveis de ambiente/secrets do próprio painel.

---

## 4. Como testar rapidamente

Teste de conexão simples via terminal, sem precisar de código (Linux/Mac/WSL, usando `swaks` se disponível, ou `openssl`):

```bash
openssl s_client -starttls smtp -connect rs00002.prodns.com.br:587 -crlf
```

Se conectar e trocar o `EHLO`, o servidor está acessível pela rede em que você está testando. Confirme também se a rede/plataforma de destino permite saída na porta 587 (algumas plataformas serverless/cloud bloqueiam portas de SMTP por padrão — é preciso liberar/whitelistar).

---

## 5. Limite prático

Essa é uma caixa de e-mail comum (não um serviço transacional dedicado tipo SES/Resend/SendGrid), então normalmente tem limite de envios por hora/dia definido pelo provedor de hospedagem (prodns.com.br). Para volumes baixos (notificações, boletos pontuais) funciona bem; para envio em massa, vale considerar migrar para um serviço transacional dedicado no futuro.
