curl -X POST "https://nkqiurrgrylrwvreybzh.supabase.co/functions/v1/send-boleto-email" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rcWl1cnJncnlscnd2cmV5YnpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1NTk5MjcsImV4cCI6MjA4NjEzNTkyN30.wEGTili1KNa3ZUY6FtdgCbgpwhO5nJ33C2hIur0J_UQ" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rcWl1cnJncnlscnd2cmV5YnpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1NTk5MjcsImV4cCI6MjA4NjEzNTkyN30.wEGTili1KNa3ZUY6FtdgCbgpwhO5nJ33C2hIur0J_UQ" \
  -d '{
    "to": "creuzoaliandro@gmail.com",
    "subject": "Teste de entrega - ContaCapt (com Date/Message-ID)",
    "text": "Email de teste apos ajuste de cabecalhos Date/Message-ID.",
    "html": "<p>Este é um e-mail de teste após ajustarmos os cabeçalhos <b>Date</b> e <b>Message-ID</b> na função send-boleto-email.</p><p>Se chegou na caixa de entrada (não no spam), o ajuste funcionou.</p>",
    "pdfBase64": "",
    "fileName": "teste.pdf"
  }'
