# ============================================================
#  ROTINA DE DESENVOLVIMENTO - dash
#  O que este script faz:
#    1. Entra na pasta do projeto
#    2. Faz git pull
#    3. Inicia o servidor Vite (npm run dev)
#    4. Abre o Chrome no site do projeto
#    5. Posiciona Chrome na metade esquerda da tela
#    6. Posiciona Claude Desktop na metade direita da tela
# ============================================================

# --- CONFIGURAÇÕES (ajuste se necessário) ---
$projetoPasta  = "C:\Users\Nayana\Documents\GitHub\dash"
$viteUrl       = "http://localhost:5173"   # porta padrão do Vite
$esperaVite    = 5                         # segundos para o Vite subir
# --------------------------------------------

# Carrega a API do Windows para mover janelas
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Win32 {
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

# Pega a resolução da tela
Add-Type -AssemblyName System.Windows.Forms
$tela    = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$largura = $tela.Width
$altura  = $tela.Height
$metade  = [int]($largura / 2)

Write-Host "=== Resolucao detectada: $largura x $altura ===" -ForegroundColor Cyan

# ---- PASSO 1: git pull ----
Write-Host "`n[1/4] Fazendo git pull em $projetoPasta..." -ForegroundColor Yellow
Set-Location $projetoPasta
$pull = git pull 2>&1
Write-Host $pull -ForegroundColor Gray

# ---- PASSO 2: Iniciar Vite em nova janela ----
Write-Host "`n[2/4] Iniciando Vite (npm run dev)..." -ForegroundColor Yellow
Start-Process "cmd.exe" -ArgumentList "/k `"cd /d $projetoPasta && npm run dev`""

Write-Host "   Aguardando $esperaVite segundos para o Vite subir..." -ForegroundColor Gray
Start-Sleep -Seconds $esperaVite

# ---- PASSO 3: Abrir Chrome no projeto ----
Write-Host "`n[3/4] Abrindo Chrome em $viteUrl..." -ForegroundColor Yellow

# Tenta encontrar o Chrome instalado
$chromePaths = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe",
    "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
)
$chromeExe = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($chromeExe) {
    Start-Process $chromeExe -ArgumentList "--new-window $viteUrl"
} else {
    Start-Process $viteUrl   # fallback: abre no navegador padrão
}

Write-Host "   Aguardando Chrome abrir..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# ---- PASSO 4: Posicionar janelas ----
Write-Host "`n[4/4] Posicionando janelas..." -ForegroundColor Yellow

# Função que busca janela pelo nome do processo
function Get-MainWindowHandle([string]$processName) {
    $proc = Get-Process -Name $processName -ErrorAction SilentlyContinue |
            Where-Object { $_.MainWindowHandle -ne 0 } |
            Select-Object -First 1
    if ($proc) { return $proc.MainWindowHandle }
    return [IntPtr]::Zero
}

# Posicionar Chrome (metade ESQUERDA)
$chromeHwnd = Get-MainWindowHandle "chrome"
if ($chromeHwnd -ne [IntPtr]::Zero) {
    [Win32]::ShowWindow($chromeHwnd, 9) | Out-Null   # SW_RESTORE
    [Win32]::SetWindowPos($chromeHwnd, [IntPtr]::Zero, 0, 0, $metade, $altura, 0x0040) | Out-Null
    Write-Host "   Chrome posicionado: lado ESQUERDO (0,0) -> ($metade x $altura)" -ForegroundColor Green
} else {
    Write-Host "   AVISO: janela do Chrome nao encontrada." -ForegroundColor Red
}

# Posicionar Claude Desktop (metade DIREITA)
# O processo do Claude Desktop pode se chamar "Claude" ou "claude"
$claudeHwnd = Get-MainWindowHandle "Claude"
if ($claudeHwnd -eq [IntPtr]::Zero) {
    $claudeHwnd = Get-MainWindowHandle "claude"
}

if ($claudeHwnd -ne [IntPtr]::Zero) {
    [Win32]::ShowWindow($claudeHwnd, 9) | Out-Null
    [Win32]::SetWindowPos($claudeHwnd, [IntPtr]::Zero, $metade, 0, $metade, $altura, 0x0040) | Out-Null
    Write-Host "   Claude posicionado: lado DIREITO ($metade,0) -> ($metade x $altura)" -ForegroundColor Green
} else {
    Write-Host "   AVISO: Claude Desktop nao encontrado. Abra o Claude Desktop manualmente e execute:" -ForegroundColor Red
    Write-Host "          .\posicionar-claude.ps1" -ForegroundColor Red

    # Cria um script auxiliar para posicionar só o Claude depois
    $scripAux = @"
Add-Type @'
using System; using System.Runtime.InteropServices;
public class W { [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h,IntPtr i,int x,int y,int cx,int cy,uint f); [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int n); }
'@
Add-Type -AssemblyName System.Windows.Forms
`$t=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; `$m=[int](`$t.Width/2); `$a=`$t.Height
`$p=Get-Process Claude -EA SilentlyContinue | Where {`$_.MainWindowHandle -ne 0} | Select -First 1
if(`$p){[W]::ShowWindow(`$p.MainWindowHandle,9)|Out-Null;[W]::SetWindowPos(`$p.MainWindowHandle,[IntPtr]::Zero,`$m,0,`$m,`$a,0x0040)|Out-Null;Write-Host 'Claude posicionado!' -ForegroundColor Green}
else{Write-Host 'Claude nao encontrado.' -ForegroundColor Red}
"@
    $scripAux | Out-File "$projetoPasta\posicionar-claude.ps1" -Encoding UTF8
}

Write-Host "`n=== Rotina concluida! ===" -ForegroundColor Cyan
Write-Host "   Vite rodando em: $viteUrl" -ForegroundColor White
Write-Host "   Chrome: metade esquerda | Claude: metade direita" -ForegroundColor White
