@echo off
REM ============================================================================
REM  QR Attendance System - stop server and tunnel running on port 3000
REM ============================================================================
setlocal
cd /d "%~dp0"
title Stop QR Attendance

echo.
echo   Stopping QR Attendance System and Tunnel...
echo.

set "KILLED=0"
for /f "tokens=5" %%P in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    echo   Stopping process with PID %%P on port 3000...
    taskkill /F /PID %%P >nul 2>&1
    set "KILLED=1"
)

if "%KILLED%"=="0" (
    echo   Nothing is currently running on port 3000.
) else (
    echo   Server and tunnel stopped successfully.
)
echo.
pause
