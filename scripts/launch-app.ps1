# ==============================================================================
# Attendly — Automated Docker Container App Launcher & Lifecycle Manager
# Starts Docker automatically on launch, and stops Docker automatically on exit
# ==============================================================================

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RootDir = Split-Path -Parent $ScriptDir
Set-Location $RootDir

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "                ATTENDLY CONTAINER SERVER WITH CLOUDFLARE                       " -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check Docker CLI
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Docker is not installed or not in system PATH." -ForegroundColor Red
    Write-Host "Please install Docker Desktop: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# 2. Check Docker Engine
function Test-DockerDaemon {
    try {
        $null = docker info 2>&1
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    }
}

$scriptStartedDocker = $false

if (-not (Test-DockerDaemon)) {
    $scriptStartedDocker = $true
    Write-Host "[*] Docker engine is not running. Starting Docker Desktop..." -ForegroundColor Yellow
    
    $dockerPaths = @(
        "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe",
        "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\com.docker.backend.exe",
        "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
        "$env:ProgramFiles\Docker\Docker\resources\com.docker.backend.exe",
        "$env:LOCALAPPDATA\Programs\Docker\Docker\Docker Desktop.exe"
    )
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        try {
            $binDir = Split-Path (Get-Command docker).Source -Parent
            $candidate = Join-Path (Split-Path (Split-Path $binDir -Parent) -Parent) "Docker Desktop.exe"
            if (Test-Path $candidate) { $dockerPaths = @($candidate) + $dockerPaths }
        } catch {}
    }

    $started = $false
    foreach ($p in $dockerPaths) {
        if (Test-Path $p) {
            Start-Process $p
            $started = $true
            break
        }
    }

    if (-not $started) {
        Write-Host "[*] Please start Docker Desktop from your Start Menu." -ForegroundColor Yellow
    }

    Write-Host "[*] Waiting for Docker engine to become ready..." -NoNewline
    $timeout = 60
    $elapsed = 0
    $backendStarted = $false
    while ((-not (Test-DockerDaemon)) -and ($elapsed -lt $timeout)) {
        Start-Sleep -Seconds 3
        $elapsed += 3
        Write-Host "." -NoNewline
        if ($elapsed -ge 12 -and -not $backendStarted) {
            $backendCandidates = @(
                "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\com.docker.backend.exe",
                "$env:ProgramFiles\Docker\Docker\resources\com.docker.backend.exe"
            )
            foreach ($b in $backendCandidates) {
                if (Test-Path $b) {
                    Start-Process -FilePath $b -WindowStyle Hidden -ErrorAction SilentlyContinue
                    $backendStarted = $true
                    break
                }
            }
        }
    }
    Write-Host ""

    if (-not (Test-DockerDaemon)) {
        Write-Host "[ERROR] Timed out waiting for Docker engine. Please ensure Docker Desktop is open." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

Write-Host "[OK] Docker engine is ready." -ForegroundColor Green

# 3. Ensure .env exists
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "[*] Created .env configuration from template." -ForegroundColor Gray
    }
}

# Resolve local proxy port from .env if present
$localPort = "8080"
if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match 'PROXY_PORT\s*=\s*(\d+)') {
        $localPort = $matches[1]
    }
}

try {
    # 4. Start Docker containers
    Write-Host "[*] Starting Attendly application container and reverse proxy..." -ForegroundColor Cyan
    docker compose up -d
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to start Docker Compose services."
    }

    # 5. Wait for Cloudflare Worldwide Tunnel
    Write-Host "[*] Connecting Cloudflare worldwide tunnel..." -NoNewline
    $cfUrl = $null
    for ($i = 0; $i -lt 30; $i++) {
        try {
            $cfOut = docker exec attendly-app cat /app/.tunnel_url 2>$null
            if ($cfOut -and $cfOut.Trim() -like "https://*") {
                $cfUrl = $cfOut.Trim()
                break
            }
        } catch {}
        Start-Sleep -Seconds 2
        Write-Host "." -NoNewline
    }
    Write-Host ""

    $localUrl = "http://localhost:$localPort"
    $targetUrl = if ($cfUrl) { $cfUrl } else { $localUrl }

    Write-Host ""
    Write-Host "================================================================================" -ForegroundColor Green
    Write-Host "                    ATTENDLY IS ONLINE AND READY!                               " -ForegroundColor Green
    Write-Host "================================================================================" -ForegroundColor Green
    Write-Host ""
    if ($cfUrl) {
        Write-Host "  [+] WORLDWIDE CLOUDFLARE URL:  $cfUrl" -ForegroundColor Green
        Write-Host "      -> Share this URL or scan QR codes from ANY Wi-Fi or mobile network!" -ForegroundColor DarkGreen
    } else {
        Write-Host "  [!] Cloudflare Tunnel initializing in background (local proxy active)." -ForegroundColor Yellow
    }
    Write-Host "  [+] LOCAL ACCESS URL:          $localUrl" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "================================================================================" -ForegroundColor Gray
    Write-Host "  -> Opening Attendly application window..." -ForegroundColor White
    Write-Host "  -> CLOSING THE APP WINDOW WILL AUTOMATICALLY STOP DOCKER." -ForegroundColor Yellow
    Write-Host "================================================================================" -ForegroundColor Gray
    Write-Host ""

    # 6. Launch App Window and wait for user to close it
    $edgePaths = @(
        "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
    )
    $chromePaths = @(
        "C:\Program Files\Google\Chrome\Application\chrome.exe",
        "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    )

    $edgeExe = $edgePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
    $chromeExe = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

    $appProfile = Join-Path $env:TEMP "attendly_desktop_profile"

    if ($edgeExe) {
        # Edge App Window Mode: Frameless native window without address bar or tabs
        $args = "--app=$targetUrl --user-data-dir=`"$appProfile`" --window-size=1280,820"
        $proc = Start-Process -FilePath $edgeExe -ArgumentList $args -Wait -PassThru
    } elseif ($chromeExe) {
        # Chrome App Window Mode
        $args = "--app=$targetUrl --user-data-dir=`"$appProfile`" --window-size=1280,820"
        $proc = Start-Process -FilePath $chromeExe -ArgumentList $args -Wait -PassThru
    } else {
        # Fallback: Open default browser and wait for user to press Enter
        Start-Process $targetUrl
        Write-Host "Attendly is running in your browser." -ForegroundColor Green
        Read-Host "Press Enter to exit and stop Docker"
    }

} finally {
    # 7. AUTOMATIC DOCKER CLEANUP ON APP EXIT
    Write-Host ""
    Write-Host "================================================================================" -ForegroundColor Yellow
    Write-Host "     APP CLOSED -- AUTOMATICALLY STOPPING DOCKER CONTAINERS...                 " -ForegroundColor Yellow
    Write-Host "================================================================================" -ForegroundColor Yellow
    docker compose down
    Write-Host "[OK] Docker containers stopped successfully. All attendance data is saved." -ForegroundColor Green
    
    if ($scriptStartedDocker) {
        Write-Host "[*] Shutting down Docker Desktop..." -ForegroundColor Gray
        $dockerCliPaths = @(
            "$env:LOCALAPPDATA\Programs\DockerDesktop\DockerCli.exe",
            "$env:ProgramFiles\Docker\Docker\DockerCli.exe"
        )
        $dockerCli = $dockerCliPaths | Where-Object { Test-Path $_ } | Select-Object -First 1
        if ($dockerCli) {
            Start-Process -FilePath $dockerCli -ArgumentList "-Shutdown" -Wait -WindowStyle Hidden -ErrorAction SilentlyContinue
        } else {
            Stop-Process -Name "Docker Desktop", "com.docker.backend" -Force -ErrorAction SilentlyContinue
        }
    }
    Start-Sleep -Seconds 1
}
