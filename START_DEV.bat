@echo off
REM Script para iniciar o projeto CAPT em desenvolvimento
REM Abre 2 terminais: um para backend e outro para frontend

echo.
echo ========================================
echo   CAPT - Sistema de Gestao de Boletos
echo ========================================
echo.

REM Verificar se Node.js esta instalado
node --version >nul 2>&1
if errorlevel 1 (
    echo ERRO: Node.js nao esta instalado ou nao esta no PATH
    echo Baixe em: https://nodejs.org/
    pause
    exit /b 1
)

echo [1/2] Iniciando Backend (localhost:3001)...
start cmd /k "cd backend && npm run dev"

timeout /t 3 /nobreak

echo [2/2] Iniciando Frontend (localhost:5173)...
start cmd /k "npm run dev"

echo.
echo ========================================
echo   PROJETO INICIADO COM SUCESSO!
echo ========================================
echo.
echo Backend:  http://localhost:3001
echo Frontend: http://localhost:5173
echo.
echo Pressione CTRL+C nos terminais para parar
echo ========================================
echo.

pause
