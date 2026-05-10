@echo off
setlocal enabledelayedexpansion

echo.
echo ========================================
echo Capt Project - Git Repository Setup
echo ========================================
echo.

REM Check if we're in the right directory
if not exist "src" (
    echo ERROR: Not in Capt project directory
    echo Please run this from C:\Projetos\Capt
    pause
    exit /b 1
)

REM Define the correct outputs path
set "GIT_SOURCE=C:\Users\creuz\AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\local-agent-mode-sessions\1e3f3b33-24ad-4881-a3bd-0436a93660dd\ed867feb-5058-4ac6-9500-f3cbedcb25ae\local_cd724559-7973-4fca-8b36-460a104c0908\outputs\.git"

echo Checking for clean .git directory...
echo Source: !GIT_SOURCE!
echo.

if exist "!GIT_SOURCE!" (
    echo Found clean .git
    echo.

    REM Remove old .git if corrupted
    if exist ".git" (
        echo Removing corrupted .git...
        rmdir /s /q ".git"
    )

    echo Copying clean .git directory...
    xcopy "!GIT_SOURCE!" ".git" /E /I /Y >nul

    if exist ".git" (
        echo.
        echo SUCCESS: .git directory restored!
    ) else (
        echo.
        echo ERROR: Failed to copy .git
        pause
        exit /b 1
    )
) else (
    echo ERROR: Could not find .git at the expected location
    echo.
    echo Expected path:
    echo !GIT_SOURCE!
    echo.
    pause
    exit /b 1
)

echo.
echo Verifying git...
git status
echo.

echo Configuring git user...
git config user.name "Lio"
git config user.email "creuzoaliandro@gmail.com"
git branch -M main 2>nul

echo.
echo Git configuration:
git config --list | findstr "user\|remote"
echo.

echo ========================================
echo SUCCESS: Git setup complete!
echo ========================================
echo.
echo Ready to push to GitHub!
echo.
echo Run this command to push:
echo   git push -u origin main
echo.
echo You will be prompted for GitHub credentials.
echo Use a Personal Access Token or SSH key.
echo.
pause
