@echo off
REM ============================================================================
REM  Attendly - Stop Server & Tunnel
REM ============================================================================
setlocal
cd /d "%~dp0"
title Stop Attendly

echo.
echo   Stopping Attendly Server and Tunnel...
echo.

set "KILLED=0"
for /f "tokens=5" %%P in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    echo   Stopping process with PID %%P on port 3000...
    taskkill /F /PID %%P >nul 2>&1
    set "KILLED=1"
)

REM Also terminate any orphaned cloudflared tunnels and clean up .tunnel_url
taskkill /F /IM cloudflared.exe >nul 2>&1
if exist "%~dp0.tunnel_url" (
    del /f /q "%~dp0.tunnel_url" >nul 2>&1
)

if "%KILLED%"=="0" (
    echo   Nothing is currently running on port 3000.
) else (
    echo   Server and tunnel stopped successfully.
)
echo.
pause
