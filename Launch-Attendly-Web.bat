@echo off
setlocal
cd /d "%~dp0"
title Attendly Web

powershell -NoProfile -Command "Unblock-File -Path '%~dp0bin\cloudflared.exe' -ErrorAction SilentlyContinue" >nul 2>&1

if not exist ".env" (
    copy ".env.example" ".env" >nul
)

if not exist "node_modules\" (
    call npm install
)

if not exist "prisma\dev.db" (
    if exist "prisma\template.db" (
        copy "prisma\template.db" "prisma\dev.db" >nul
    ) else (
        call npx prisma db push
    )
)

REM Ensure production build exists
if not exist ".next\BUILD_ID" (
    echo.
    echo   [Attendly] Compiling production build for maximum performance...
    call npm run build
)

REM Check if server is already running on port 3000
netstat -ano | findstr :3000 | findstr LISTENING >nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo   [Attendly] Server is already active on port 3000.
    echo   [Attendly] Opening http://localhost:3000 in your default browser...
    start "" "http://localhost:3000"
    timeout /t 3 /nobreak >nul
    exit /b
)

REM Start server + worldwide mobile tunnel and open browser automatically
node scripts\start-internet.js
