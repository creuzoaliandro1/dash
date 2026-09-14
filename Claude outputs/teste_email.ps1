# Teste de envio de e-mail via Edge Function "send-boleto-email" (Supabase)
# Envia um e-mail de teste para creuzoaliandro@gmail.com
# Basta colar este bloco inteiro no PowerShell (Win+X -> Windows PowerShell) e apertar Enter.

$body = @{
    to        = "creuzoaliandro@gmail.com"
    subject   = "Teste de envio - ContaCapt"
    text      = "Este e um email de teste do servico de envio da ContaCapt."
    html      = "<p>Este e um email de teste do servico de envio da ContaCapt.</p><p>Se voce recebeu esta mensagem, o servico de SMTP esta funcionando corretamente.</p>"
    pdfBase64 = ""
    fileName  = ""
} | ConvertTo-Json

$headers = @{
    "Content-Type"  = "application/json"
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rcWl1cnJncnlscnd2cmV5YnpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1NTk5MjcsImV4cCI6MjA4NjEzNTkyN30.wEGTili1KNa3ZUY6FtdgCbgpwhO5nJ33C2hIur0J_UQ"
}

Invoke-RestMethod -Uri "https://nkqiurrgrylrwvreybzh.supabase.co/functions/v1/send-boleto-email" `
    -Method Post -Headers $headers -Body $body
