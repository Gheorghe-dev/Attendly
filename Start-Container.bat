@echo off
setlocal enabledelayedexpansion
title Attendly Container Server with Cloudflare
color 0A

echo ================================================================================
echo                   ATTENDLY CONTAINER SERVER WITH CLOUDFLARE
echo ================================================================================
echo.

:: 1. Check Docker CLI
where docker >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Docker is not installed or not in system PATH.
    echo Please install Docker Desktop: https://www.docker.com/products/docker-desktop/
    echo.
    pause
    exit /b 1
)

:: 2. Check Docker Engine running
echo [*] Checking Docker daemon status...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Docker engine is not running. Attempting to start Docker Desktop...
    if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
        start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
    ) else if exist "%LocalAppData%\Programs\Docker\Docker\Docker Desktop.exe" (
        start "" "%LocalAppData%\Programs\Docker\Docker\Docker Desktop.exe"
    )
    
    echo [*] Waiting for Docker engine to initialize (up to 60 seconds)...
    set /a DOCKER_WAIT=0
    :WAIT_DOCKER
    timeout /t 3 /nobreak >nul
    docker info >nul 2>&1
    if %errorlevel% equ 0 goto DOCKER_READY
    set /a DOCKER_WAIT+=3
    if !DOCKER_WAIT! geq 60 (
        color 0C
        echo [ERROR] Timed out waiting for Docker engine. Please ensure Docker Desktop is running.
        pause
        exit /b 1
    )
    echo    Waiting for Docker engine... (!DOCKER_WAIT!s)
    goto WAIT_DOCKER
)

:DOCKER_READY
echo [OK] Docker engine is ready.
echo.

:: 3. Generate .env if missing
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo [*] Created .env configuration from template.
    )
)

:: 4. Build and start containers
echo [*] Starting Attendly application container and proxy...
docker compose up -d --build
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Failed to start Docker Compose services.
    echo Run 'docker compose logs' for more details.
    pause
    exit /b 1
)

:: 5. Wait for Cloudflare Tunnel URL
echo [*] Container server started. Establishing Cloudflare worldwide tunnel...
set CF_URL=
for /l %%i in (1,1,30) do (
    for /f "usebackq tokens=*" %%u in (`docker exec attendly-app cat /app/.tunnel_url 2^>nul`) do (
        set "LINE=%%u"
        if "!LINE:~0,8!"=="https://" (
            set "CF_URL=!LINE!"
            goto TUNNEL_FOUND
        )
    )
    timeout /t 2 /nobreak >nul
    <nul set /p =.
)

:TUNNEL_FOUND
echo.
echo ================================================================================
echo                     ATTENDLY SERVER IS ONLINE AND ACTIVE!
echo ================================================================================
echo.
if defined CF_URL (
    echo   [+] WORLDWIDE CLOUDFLARE URL:  !CF_URL!
    echo       ^> Share this URL or scan QR codes from ANY Wi-Fi or mobile network!
) else (
    echo   [!] Cloudflare Tunnel is still initializing in the background.
    echo       View live logs with: docker compose logs -f
)
echo.
echo   [+] LOCAL REVERSE PROXY URL:   http://localhost
echo.
echo ================================================================================
echo Useful Commands:
echo   - View live logs:     docker compose logs -f
echo   - Stop container:     docker compose down
echo   - Rebuild container:  docker compose up -d --build
echo ================================================================================
echo.

:: 6. Open browser to the live application
if defined CF_URL (
    start "" "!CF_URL!"
) else (
    start "" "http://localhost"
)

echo Press any key to close this launcher window (container will continue running).
pause >nul
