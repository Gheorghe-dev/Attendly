@echo off
setlocal
cd /d "%~dp0"
title Attendly Web Browser

where node >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Node.js is required. Download from https://nodejs.org/
    pause
    exit /b 1
)

if not exist ".env" (
    copy ".env.example" ".env" >nul
)

if not exist "node_modules\" (
    echo [Attendly] Installing dependencies...
    call npm install
)

if not exist "prisma\dev.db" (
    echo [Attendly] Initializing database...
    call npx prisma db push
)

REM Check if server is already running on port 3000
netstat -ano | findstr :3000 | findstr LISTENING >nul 2>&1
if %errorlevel% neq 0 (
    if not exist ".next\BUILD_ID" (
        echo [Attendly] Building application...
        call npm run build
    )
    echo [Attendly] Starting server in background...
    start /b npm start >nul 2>&1
    timeout /t 3 /nobreak >nul
)

echo [Attendly] Opening http://localhost:3000 in your default browser...
start "" "http://localhost:3000"
