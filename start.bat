@echo off
REM ============================================================================
REM  QR Attendance System - All-In-One Launcher
REM  Automatically unblocks firewall, opens port 3000, configures Wi-Fi,
REM  starts the Next.js server, and launches the worldwide tunnel.
REM ============================================================================
setlocal
cd /d "%~dp0"
title QR Attendance System

REM --- Step 1: Request Administrator Elevation if not elevated ---------------
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo   Requesting Administrator permission to unblock firewall...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo.
echo   ========================================================
echo             QR ATTENDANCE SYSTEM - AUTO START
echo   ========================================================
echo.

REM --- Step 2: Unblock Windows Firewall & Set Wi-Fi to Private ---------------
echo   [1/4] Unblocking Node.js in Windows Firewall...
netsh advfirewall firewall set rule name="Node.js JavaScript Runtime" new action=allow >nul 2>&1
netsh advfirewall firewall delete rule name="Node.js Inbound Allow" >nul 2>&1
netsh advfirewall firewall add rule name="Node.js Inbound Allow" dir=in action=allow protocol=TCP program="C:\Program Files\nodejs\node.exe" profile=any >nul 2>&1

echo   [2/4] Opening Port 3000 for phone connections...
netsh advfirewall firewall delete rule name="QR Attendance Port 3000" >nul 2>&1
netsh advfirewall firewall add rule name="QR Attendance Port 3000" dir=in action=allow protocol=TCP localport=3000 profile=any >nul 2>&1

echo   [3/4] Configuring Wi-Fi network profile...
powershell -Command "Set-NetConnectionProfile -InterfaceAlias 'Wi-Fi' -NetworkCategory Private" >nul 2>&1

echo   [4/4] Starting server and Worldwide Internet Tunnel...
echo.

REM --- Step 3: Run the all-in-one runner -------------------------------------
node scripts\start-internet.js
pause
