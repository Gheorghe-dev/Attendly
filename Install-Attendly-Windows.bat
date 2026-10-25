@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Attendly — 1-Click Windows Installer

echo ========================================================
echo          ATTENDLY — 1-CLICK WINDOWS INSTALLER
echo ========================================================
echo.

REM 1. Check if the pre-built installer is present
if exist "release\Attendly Setup 1.0.0.exe" (
    echo [1/1] Launching Attendly 1-Click Installer...
    start "" "release\Attendly Setup 1.0.0.exe"
    exit /b 0
)

REM 2. If not pre-built, verify Node.js to compile it
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Node.js is required to build the installer from source.
    echo Please install Node.js from https://nodejs.org/
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

echo [*] Pre-built binary not found. Generating Attendly Setup installer...
echo [*] This will only happen once. Please wait...
echo.

if not exist ".env" (
    copy ".env.example" ".env" >nul
)

if not exist "node_modules\" (
    echo [1/3] Installing dependencies...
    call npm install
)

echo [2/3] Preparing Next.js standalone engine...
call npm run desktop:package

echo [3/3] Building one-click installer...
call npx electron-builder --win

if exist "release\Attendly Setup 1.0.0.exe" (
    echo.
    echo ========================================================
    echo  Installer generated! Launching installer now...
    echo ========================================================
    start "" "release\Attendly Setup 1.0.0.exe"
) else (
    echo.
    echo [WARNING] Could not build setup binary. Starting Attendly desktop directly...
    call npx electron .
)
