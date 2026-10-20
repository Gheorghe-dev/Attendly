@echo off
title QR Attendance - Public Tunnel
echo ========================================================
echo   QR Attendance System - Public Tunnel
echo ========================================================
echo.
echo   This creates a free, secure public HTTPS link for your
echo   attendance system so students on ANY network (4G/5G,
echo   university Wi-Fi, or home Wi-Fi) can immediately scan
echo   and access the app!
echo.
echo   Connecting tunnel...
echo.
npx --yes localtunnel --port 3000
pause
