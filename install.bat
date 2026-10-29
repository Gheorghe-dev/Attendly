@echo off
setlocal
cd /d "%~dp0"
title Attendly — One-Command Docker & Cloudflare Installer

:: Check for Administrator privileges; if missing, request UAC elevation
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Requesting Administrator privileges to configure Docker, firewall, and shortcuts...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath cmd.exe -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

echo ================================================================================
echo             ATTENDLY ONE-COMMAND DOCKER & CLOUDFLARE INSTALLER
echo ================================================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
if %errorlevel% neq 0 (
    echo.
    echo [Installer Error] Setup encountered an issue (Exit Code %errorlevel%).
    pause
    exit /b %errorlevel%
)
pause
