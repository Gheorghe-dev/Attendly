@echo off
setlocal
cd /d "%~dp0"
title Attendly - Starting Application

echo ========================================================
echo       ATTENDLY — STARTING APPLICATION & SERVICES
echo ========================================================
echo.

where node >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Node.js is required. Download from https://nodejs.org/
    pause
    exit /b 1
)

REM 1. Self-bootstrap environment
if not exist ".env" (
    echo [1/4] Setting up .env configuration...
    copy ".env.example" ".env" >nul
)

REM 2. Install dependencies if missing
if not exist "node_modules\" (
    echo [2/4] Installing application dependencies...
    call npm install
)

REM 3. Synchronize database if missing
if not exist "prisma\dev.db" (
    echo [3/4] Initializing local database...
    call npx prisma db push
)

REM 4. Start server + Cloudflare worldwide mobile tunnel + open browser
echo [4/4] Launching Next.js server & worldwide mobile tunnel...
echo.
node scripts\start-internet.js
