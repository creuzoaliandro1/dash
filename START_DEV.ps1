# Script PowerShell para iniciar CAPT em desenvolvimento

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   CAPT - Sistema de Gestao de Boletos" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar Node.js
$nodeCheck = node --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: Node.js nao esta instalado!" -ForegroundColor Red
    Write-Host "Baixe em: https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Pressione ENTER para sair"
    exit 1
}

Write-Host "Node.js versao: $nodeCheck" -ForegroundColor Green
Write-Host ""

# Iniciar Backend em nova janela
Write-Host "[1/2] Iniciando Backend (localhost:3001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$PSScriptRoot\backend'; npm run dev`""

Start-Sleep -Seconds 3

# Iniciar Frontend em nova janela
Write-Host "[2/2] Iniciando Frontend (localhost:5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$PSScriptRoot'; npm run dev`""

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   PROJETO INICIADO COM SUCESSO!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Backend:  http://localhost:3001" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Proximas etapas:" -ForegroundColor Yellow
Write-Host "1. Autenticar WhatsApp: POST /api/whatsapp/iniciar" -ForegroundColor White
Write-Host "2. Escanear QR Code no terminal do Backend" -ForegroundColor White
Write-Host ""
Read-Host "Pressione ENTER para fechar este terminal"
