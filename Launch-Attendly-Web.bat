@echo off
setlocal
cd /d "%~dp0"
title Attendly Web

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
