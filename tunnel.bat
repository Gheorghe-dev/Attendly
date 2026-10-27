@echo off
setlocal
cd /d "%~dp0"
title Attendly - Cloudflare Worldwide Tunnel
echo ========================================================
echo   Attendly - Secure Cloudflare Worldwide Tunnel
echo ========================================================
echo.
echo   Creates a secure public HTTPS link for attendance so
echo   students on ANY network (4G/5G, university Wi-Fi,
echo   or home Wi-Fi) can instantly scan and check in!
echo.
echo   Connecting Cloudflare Worldwide Tunnel...
echo.

node scripts\start-internet.js
pause
