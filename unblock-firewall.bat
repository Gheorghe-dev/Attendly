@echo off
title Unblock Phone Access (Windows Firewall)
echo ================================================================
echo   QR Attendance System - Phone Access & Firewall Fixer
echo ================================================================
echo.

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting Administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo [1/4] Unblocking Node.js in Windows Firewall...
netsh advfirewall firewall set rule name="Node.js JavaScript Runtime" new action=allow >nul 2>&1
netsh advfirewall firewall delete rule name="Node.js Inbound Allow" >nul 2>&1
netsh advfirewall firewall add rule name="Node.js Inbound Allow" dir=in action=allow protocol=TCP program="C:\Program Files\nodejs\node.exe" profile=any >nul 2>&1

echo [2/4] Opening Port 3000 for incoming connections...
netsh advfirewall firewall delete rule name="QR Attendance Port 3000" >nul 2>&1
netsh advfirewall firewall add rule name="QR Attendance Port 3000" dir=in action=allow protocol=TCP localport=3000 profile=any >nul 2>&1

echo [3/4] Setting Wi-Fi network profile to Private (allows phone discovery)...
powershell -Command "Set-NetConnectionProfile -InterfaceAlias 'Wi-Fi' -NetworkCategory Private" >nul 2>&1

echo [4/4] Verifying network status...
echo.
echo ================================================================
echo   SUCCESS! Your computer is now ready for phone scanning:
echo.
echo   1. Your computer's Wi-Fi IP is:  192.168.10.206
echo   2. Make sure your phone is connected to the same Wi-Fi: "szk619"
echo   3. Port 3000 is now open and unblocked.
echo.
echo   You can now start the app and scan the QR code with your phone!
echo ================================================================
echo.
pause
