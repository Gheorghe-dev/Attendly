@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Attendly — 1-Click Windows Installer

powershell -NoProfile -Command "Unblock-File -Path '%~dp0bin\cloudflared.exe' -ErrorAction SilentlyContinue"

echo ========================================================
echo          ATTENDLY — 1-CLICK WINDOWS INSTALLER
echo ========================================================
echo.

REM 1. Check if a pre-built installer is present
set "INSTALLER="
for %%F in ("release\Attendly Setup *.exe") do (
    if exist "%%~fF" set "INSTALLER=%%~fF"
)
if defined INSTALLER (
    echo [1/1] Launching Attendly 1-Click Installer: !INSTALLER!
    start "" "!INSTALLER!"
    exit /b 0
)

REM 2. If not pre-built, verify or auto-install Node.js
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] Node.js runtime not detected.
    where winget >nul 2>&1
    if !errorLevel! equ 0 (
        echo [*] Installing Node.js LTS via Windows Package Manager (winget)...
        winget install OpenJS.NodeJS.LTS -e --silent --accept-source-agreements --accept-package-agreements
        if !errorLevel! equ 0 (
            echo [*] Node.js successfully installed! Refreshing PATH...
            set "PATH=%ProgramFiles%\nodejs;%APPDATA%\npm;!PATH!"
        )
    )
    where node >nul 2>&1
    if !errorLevel! neq 0 (
        echo.
        echo [ERROR] Node.js is required to run Attendly.
        echo Opening Node.js download page in your browser...
        start https://nodejs.org/
        echo Please install Node.js from https://nodejs.org/ and re-run this installer.
        pause
        exit /b 1
    )
)

echo [*] Detected Node.js runtime.
echo.

REM 3. Configure environment settings (.env)
if not exist ".env" (
    echo [1/5] Configuring environment settings...
    copy ".env.example" ".env" >nul
)

REM 4. Install dependencies
if not exist "node_modules\" (
    echo [2/5] Installing application dependencies...
    call npm install
)

REM 5. Initialize database & Prisma engine
echo [3/5] Initializing local database schema...
if not exist "prisma\dev.db" (
    if exist "prisma\template.db" (
        copy "prisma\template.db" "prisma\dev.db" >nul
    ) else (
        call npx prisma db push --skip-generate
    )
)
call npx prisma generate

REM 6. Unblock Windows Firewall for mobile phone check-ins
echo [4/5] Configuring Windows Firewall for phone check-ins...
netsh advfirewall firewall show rule name="QR Attendance Port 3000" >nul 2>&1
if !errorLevel! neq 0 (
    netsh advfirewall firewall add rule name="QR Attendance Port 3000" dir=in action=allow protocol=TCP localport=3000 profile=any >nul 2>&1
)

REM 7. Build standalone package and installer
echo [5/5] Building native Attendly desktop installer...
call npm run desktop:package
call npx electron-builder --win

REM 8. Create desktop shortcut
if exist "scripts\create-shortcuts.js" (
    node scripts\create-shortcuts.js >nul 2>&1
)

set "INSTALLER="
for %%F in ("release\Attendly Setup *.exe") do (
    if exist "%%~fF" set "INSTALLER=%%~fF"
)
if defined INSTALLER (
    echo.
    echo ========================================================
    echo  Installer generated! Launching installer now...
    echo ========================================================
    start "" "%INSTALLER%"
) else (
    echo.
    echo [SUCCESS] Attendly desktop installed! Starting Attendly now...
    call npx electron .
)
