@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Attendly — 1-Click Automated Setup & Installer

powershell -NoProfile -Command "Unblock-File -Path '%~dp0bin\cloudflared.exe' -ErrorAction SilentlyContinue" >nul 2>&1

echo ========================================================
echo          ATTENDLY — 1-CLICK AUTOMATED INSTALLER
echo ========================================================
echo.

REM 1. Check if a pre-built standalone installer is present
set "INSTALLER="
for %%F in (
    "Attendly Setup *.exe"
    "Attendly.Setup.*.exe"
    "Attendly-Setup-*.exe"
    "release\Attendly Setup *.exe"
    "release\Attendly.Setup.*.exe"
    "release\Attendly-Setup-*.exe"
) do (
    if exist "%%~fF" set "INSTALLER=%%~fF"
)

if defined INSTALLER (
    echo [1/1] Found Attendly Desktop Installer: !INSTALLER!
    echo [*] Launching installer to set up Attendly and Desktop shortcut automatically...
    start "" "!INSTALLER!"
    echo.
    echo ========================================================
    echo  Setup initiated! Follow the on-screen installer prompt.
    echo ========================================================
    exit /b 0
)

REM 2. Verify or auto-install Node.js runtime
echo [*] Checking Node.js runtime environment...
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] Node.js runtime not detected.
    where winget >nul 2>&1
    if !errorLevel! equ 0 (
        echo [*] Installing Node.js LTS automatically via Windows Package Manager (winget)...
        winget install OpenJS.NodeJS.LTS -e --silent --accept-source-agreements --accept-package-agreements
        if !errorLevel! equ 0 (
            echo [*] Node.js successfully installed! Refreshing PATH environment...
            set "PATH=%ProgramFiles%\nodejs;%APPDATA%\npm;!PATH!"
        )
    )
    where node >nul 2>&1
    if !errorLevel! neq 0 (
        echo [*] Attempting direct Node.js LTS MSI download...
        powershell -NoProfile -Command "$msi = Join-Path $env:TEMP 'nodejs-lts.msi'; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi' -OutFile $msi; Start-Process msiexec.exe -ArgumentList ('/i', $msi, '/qn') -Wait; Remove-Item -Force $msi" >nul 2>&1
        set "PATH=%ProgramFiles%\nodejs;%APPDATA%\npm;!PATH!"
    )
    where node >nul 2>&1
    if !errorLevel! neq 0 (
        echo.
        echo [ERROR] Node.js is required to run Attendly from source.
        echo Opening Node.js download page in your browser...
        start https://nodejs.org/
        echo Please install Node.js and run this file again.
        pause
        exit /b 1
    )
)

for /f "tokens=*" %%V in ('node -v') do set "NODE_VERSION=%%V"
echo [*] Detected Node.js !NODE_VERSION!
echo.

REM 3. Configure environment settings (.env)
if not exist ".env" (
    echo [1/6] Configuring environment settings...
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
    ) else (
        echo DATABASE_URL="file:./dev.db" > .env
        echo NEXTAUTH_SECRET="attendly-secret-key-production-32-chars-ok" >> .env
        echo NEXTAUTH_URL="http://localhost:3000" >> .env
    )
    echo     Created .env configuration.
) else (
    echo [1/6] Environment (.env) already configured.
)

REM 4. Install dependencies
if not exist "node_modules\" (
    echo [2/6] Installing application dependencies...
    call npm install --no-audit
) else (
    echo [2/6] Dependencies already installed.
)

REM 5. Initialize database & Prisma engine
echo [3/6] Setting up local SQLite database...
if not exist "prisma\dev.db" (
    if exist "prisma\template.db" (
        copy "prisma\template.db" "prisma\dev.db" >nul
        echo     Database initialized from pre-seeded template.
    ) else (
        call npx prisma db push --skip-generate
    )
) else (
    echo     Database schema ready.
)
call npx prisma generate >nul 2>&1

REM 6. Configure Windows Firewall for mobile phone check-ins
echo [4/6] Configuring Windows Firewall for student mobile check-ins...
netsh advfirewall firewall show rule name="Attendly Port 3000" >nul 2>&1
if !errorLevel! neq 0 (
    netsh advfirewall firewall add rule name="Attendly Port 3000" dir=in action=allow protocol=TCP localport=3000 profile=any >nul 2>&1
)

REM 7. Compile production build if missing
if not exist ".next\BUILD_ID" (
    echo [5/6] Compiling production build (one-time setup)...
    call npm run build
) else (
    echo [5/6] Production build ready.
)

REM 8. Create branded Desktop & Start Menu shortcuts
echo [6/6] Creating Desktop and Start Menu shortcuts...
if exist "scripts\create-shortcuts.js" (
    node scripts\create-shortcuts.js
)

echo.
echo ========================================================
echo  SUCCESS: Attendly has been fully configured!
echo  A branded "Attendly" shortcut is now on your Desktop.
echo ========================================================
echo.
echo Launching Attendly now...

if exist "Launch-Attendly.vbs" (
    start "" wscript.exe "%~dp0Launch-Attendly.vbs"
) else (
    call npm run launch
)
exit /b 0
