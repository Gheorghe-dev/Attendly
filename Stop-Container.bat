@echo off
setlocal
cd /d "%~dp0"
title Stop Attendly Container Server
color 0E

echo ================================================================================
echo                     STOPPING ATTENDLY CONTAINER SERVER
echo ================================================================================
echo.

docker compose down
if %errorlevel% equ 0 (
    color 0A
    echo.
    echo [OK] Attendly container server stopped successfully.
    echo All attendance records and SQLite database remain safely saved in Docker volume.
) else (
    color 0C
    echo.
    echo [ERROR] Failed to stop containers.
)
echo.
ping 127.0.0.1 -n 3 >nul
