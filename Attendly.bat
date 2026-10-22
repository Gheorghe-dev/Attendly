@echo off
setlocal
cd /d "%~dp0"
title Attendly Desktop

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
    echo [Attendly] Installing application dependencies...
    call npm install
)

if not exist "prisma\dev.db" (
    echo [Attendly] Initializing database...
    call npx prisma db push
)

REM Ensure build exists for production performance
if not exist ".next\BUILD_ID" (
    echo [Attendly] Compiling production build...
    call npm run build
)

REM Launch the Electron Desktop application
if exist "node_modules\.bin\electron.cmd" (
    call node_modules\.bin\electron.cmd .
) else (
    call npx electron .
)
