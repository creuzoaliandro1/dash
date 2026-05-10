# Restore Git Repository
# This script copies the clean .git directory from outputs and sets up GitHub push

Write-Host "Capt Project - Git Repository Restore" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the Capt directory
if (-not (Test-Path "src")) {
    Write-Host "ERROR: Not in Capt project directory" -ForegroundColor Red
    Write-Host "Please run this script from C:\Projetos\Capt" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit
}

# Define the outputs path directly (from Claude Cowork)
$gitSourcePath = "C:\Users\creuz\AppData\Roaming\Claude\local-agent-mode-sessions\1e3f3b33-24ad-4881-a3bd-0436a93660dd\ed867feb-5058-4ac6-9500-f3cbedcb25ae\local_cd724559-7973-4fca-8b36-460a104c0908\outputs\.git"

Write-Host "Looking for clean .git directory..." -ForegroundColor Cyan
if (Test-Path $gitSourcePath) {
    Write-Host "✓ Found clean .git at: $gitSourcePath" -ForegroundColor Green
} else {
    Write-Host "Could not find .git at expected location" -ForegroundColor Yellow
    Write-Host "Path checked: $gitSourcePath" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Please copy the .git folder manually:" -ForegroundColor Yellow
    Write-Host "1. Open File Explorer" -ForegroundColor Cyan
    Write-Host "2. Navigate to: C:\Users\creuz\AppData\Roaming\Claude\local-agent-mode-sessions" -ForegroundColor Cyan
    Write-Host "3. Find the outputs folder with .git directory" -ForegroundColor Cyan
    Write-Host "4. Copy .git to C:\Projetos\Capt" -ForegroundColor Cyan
    Write-Host ""
    Read-Host "Press Enter after copying"

    if (Test-Path ".git") {
        Write-Host "✓ .git folder found!" -ForegroundColor Green
    } else {
        Write-Host "✗ .git folder still not found" -ForegroundColor Red
        exit
    }
}

# If we found the source, copy it
if (Test-Path $gitSourcePath) {
    # Remove old .git if it exists
    if (Test-Path ".git") {
        Write-Host "Removing corrupted .git directory..." -ForegroundColor Yellow
        Remove-Item ".git" -Recurse -Force -ErrorAction SilentlyContinue
    }

    # Copy clean .git
    Write-Host "Copying clean .git directory..." -ForegroundColor Cyan
    Copy-Item -Path $gitSourcePath -Destination ".git" -Recurse -Force

    if (Test-Path ".git") {
        Write-Host "✓ .git directory restored!" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to copy .git" -ForegroundColor Red
        exit
    }
}

Write-Host ""
Write-Host "Verifying git setup..." -ForegroundColor Cyan
Write-Host ""

# Check git status
git status
Write-Host ""

# Show git config
Write-Host "Git configuration:" -ForegroundColor Cyan
git config --list | Select-String "user\.|remote"
Write-Host ""

# Prepare for push
Write-Host "Setting branch to main..." -ForegroundColor Cyan
git branch -M main 2>$null

Write-Host ""
Write-Host "Git setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next step: Push to GitHub" -ForegroundColor Cyan
Write-Host "  git push -u origin main" -ForegroundColor Yellow
Write-Host ""
Write-Host "You will be prompted for GitHub credentials:" -ForegroundColor Cyan
Write-Host "  - Use Personal Access Token (recommended), or" -ForegroundColor Cyan
Write-Host "  - Use SSH key if configured" -ForegroundColor Cyan
Write-Host ""

Read-Host "Press Enter to continue with push"

# Attempt push
Write-Host ""
Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Success! Repository pushed to GitHub." -ForegroundColor Green
    Write-Host "Repository: https://github.com/creuzoaliandro/dash" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Push attempt completed. Check GitHub credentials if there were errors." -ForegroundColor Yellow
}
