@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Attendly Desktop

REM 1. If installed standalone native executable exists, launch it directly!
for %%I in (
    "%LOCALAPPDATA%\Programs\attendly\Attendly.exe"
    "%LOCALAPPDATA%\Programs\Attendly\Attendly.exe"
    "%ProgramFiles%\Attendly\Attendly.exe"
    "%ProgramFiles(x86)%\Attendly\Attendly.exe"
    "%~dp0release\win-unpacked\Attendly.exe"
) do (
    if exist "%%~fI" (
        start "" "%%~fI"
        exit /b 0
    )
)

REM 2. Unblock bundled Cloudflare tunnel binary if present
if exist "bin\cloudflared.exe" (
    powershell -NoProfile -Command "Unblock-File -Path '%~dp0bin\cloudflared.exe' -ErrorAction SilentlyContinue" >nul 2>&1
)

REM 3. Verify Node.js runtime
where node >nul 2>&1
if %errorLevel% neq 0 (
    powershell -NoProfile -Command "[System.Windows.Forms.MessageBox]::Show('Node.js is required to start Attendly. Opening nodejs.org download page...', 'Attendly Desktop', 0, 48); Start-Process 'https://nodejs.org/'" >nul 2>&1
    exit /b 1
)

REM 4. Ensure environment settings (.env) exist
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
    )
)

REM 5. Ensure application dependencies are installed
if not exist "node_modules\" (
    call npm install --no-audit
)

REM 6. Ensure local database is initialized with template
if not exist "prisma\dev.db" (
    if exist "prisma\template.db" (
        copy "prisma\template.db" "prisma\dev.db" >nul
    ) else (
        call npx prisma db push --skip-generate
    )
)

REM 7. Generate Prisma Client
call npx prisma generate >nul 2>&1

REM 8. Ensure production build exists for peak performance
if not exist ".next\BUILD_ID" (
    call npm run build
)

REM 9. Ensure Desktop shortcut exists
if exist "scripts\create-shortcuts.js" (
    node scripts\create-shortcuts.js >nul 2>&1
)

REM 10. Launch Desktop application (Electron) or web app + browser fallback
if exist "node_modules\.bin\electron.cmd" (
    call node_modules\.bin\electron.cmd .
) else (
    where electron >nul 2>&1
    if !errorLevel! equ 0 (
        call electron .
    ) else (
        call node scripts\start-internet.js
    )
)
