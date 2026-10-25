@echo off
REM ============================================================================
REM  Attendly - Universal Windows All-In-One Launcher
REM  Self-elevates, initializes database, unblocks firewall, opens port 3000,
REM  starts the Next.js server, and launches the worldwide tunnel.
REM ============================================================================
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Attendly - Smart Attendance System

REM --- Step 1: Request Administrator Elevation if not elevated ---------------
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo   Requesting Administrator permission to configure firewall...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo.
echo   ========================================================
echo                 ATTENDLY - AUTO START LAUNCHER
echo   ========================================================
echo.

REM --- Step 2: Check Node.js runtime -----------------------------------------
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo   [ERROR] Node.js is not found on your system.
    echo   Please install Node.js 18 or newer from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM --- Step 3: Self-bootstrap on first run -----------------------------------
if not exist ".env" (
    echo   [1/6] Creating .env configuration...
    copy ".env.example" ".env" >nul
)

if not exist "node_modules\" (
    echo   [2/6] Installing dependencies (first run only)...
    call npm install
)

if not exist "prisma\dev.db" (
    echo   [3/6] Initializing local database schema...
    if exist "prisma\template.db" (
        copy "prisma\template.db" "prisma\dev.db" >nul
    ) else (
        call npx prisma db push
    )
)
call npx prisma generate

if not exist ".next\BUILD_ID" (
    echo   [4/6] Compiling production build for maximum speed...
    call npm run build
)

REM --- Step 4: Unblock Windows Firewall & Set Wi-Fi to Private ---------------
echo   [5/6] Unblocking Port 3000 in Windows Firewall...
netsh advfirewall firewall set rule name="Node.js JavaScript Runtime" new action=allow >nul 2>&1
netsh advfirewall firewall delete rule name="Node.js Inbound Allow" >nul 2>&1
netsh advfirewall firewall add rule name="Node.js Inbound Allow" dir=in action=allow protocol=TCP program="C:\Program Files\nodejs\node.exe" profile=any >nul 2>&1
netsh advfirewall firewall delete rule name="QR Attendance Port 3000" >nul 2>&1
netsh advfirewall firewall add rule name="QR Attendance Port 3000" dir=in action=allow protocol=TCP localport=3000 profile=any >nul 2>&1
powershell -Command "Set-NetConnectionProfile -InterfaceAlias 'Wi-Fi' -NetworkCategory Private" >nul 2>&1

echo   [6/6] Starting server and Worldwide Internet Tunnel...
echo.

REM --- Step 5: Run the all-in-one runner -------------------------------------
node scripts\start-internet.js
pause
