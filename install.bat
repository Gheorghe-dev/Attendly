@echo off
setlocal
cd /d "%~dp0"
title Attendly — One-Command Docker Installer

echo Launching Attendly Installer with PowerShell...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
if %errorLevel% neq 0 (
    echo.
    echo [Installer Error] The setup script exited with code %errorLevel%.
    pause
    exit /b %errorLevel%
)
pause
