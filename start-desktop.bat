@echo off
REM ============================================================================
REM  QR Attendance System - Electron Desktop Launcher
REM  Starts the native Electron Desktop Application with integrated Next.js
REM  server, SQLite engine, and Cloudflare Quick Tunnel.
REM ============================================================================
setlocal
cd /d "%~dp0"
title QR Attendance Desktop

echo.
echo   ==================================================================
echo               QR ATTENDANCE SYSTEM - DESKTOP EDITION
echo   ==================================================================
echo.
echo   Starting all integrated services:
echo   [1/3] Local Next.js 14 Engine (Port 3000)
echo   [2/3] Cloudflare Worldwide Tunnel (*.trycloudflare.com)
echo   [3/3] Native Desktop Shell & System Tray
echo.

if exist ".\node_modules\.bin\electron.cmd" (
    call ".\node_modules\.bin\electron.cmd" .
) else (
    call npx electron .
)
