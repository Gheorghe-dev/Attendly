# ==============================================================================
# Attendly — Automated Windows One-Command Deployment Installer
# ==============================================================================
# Requires Administrator privileges to configure Windows Firewall rules
# ==============================================================================

[CmdletBinding()]
param (
    [int]$Port = 0,
    [switch]$NonInteractive
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $ScriptDir

# ------------------------------------------------------------------------------
# 1. Administrator Elevation Check
# ------------------------------------------------------------------------------
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[!] Administrator privileges required to configure firewall and network bindings." -ForegroundColor Yellow
    Write-Host "[*] Requesting elevation..." -ForegroundColor Cyan
    $arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    if ($Port -gt 0) { $arguments = $arguments + " -Port $Port" }
    if ($NonInteractive) { $arguments = $arguments + " -NonInteractive" }
    Start-Process powershell.exe -Verb RunAs -ArgumentList $arguments
    exit
}

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "       ATTENDLY -- AUTOMATED ONE-COMMAND INSTALLER       " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------------------------
# 2. System and Architecture Detection
# ------------------------------------------------------------------------------
$arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
$osName = (Get-CimInstance Win32_OperatingSystem).Caption
Write-Host "[1/7] Detected Operating System: $osName ($arch)" -ForegroundColor Green

# ------------------------------------------------------------------------------
# 3. Docker Daemon Verification and Guided Setup
# ------------------------------------------------------------------------------
Write-Host "[2/7] Checking Docker environment..." -ForegroundColor Cyan

function Test-DockerWorking {
    try {
        $null = docker info 2>&1
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    }
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "[!] Docker CLI was not found on your system." -ForegroundColor Yellow
    
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Host "[*] Installing Docker Desktop via Windows Package Manager (winget)..." -ForegroundColor Cyan
        winget install Docker.DockerDesktop --accept-source-agreements --accept-package-agreements
        Write-Host "[!] Docker Desktop installed. Please reboot if prompted, then re-run this script." -ForegroundColor Yellow
    } else {
        Write-Host "[ERROR] Docker Desktop is required to run Attendly." -ForegroundColor Red
        Write-Host "Please download and install Docker Desktop from:" -ForegroundColor White
        Write-Host "https://www.docker.com/products/docker-desktop/" -ForegroundColor Cyan
        Start-Process "https://www.docker.com/products/docker-desktop/"
    }
    
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

if (-not (Test-DockerWorking)) {
    Write-Host "[*] Docker Desktop is installed but the Docker engine is not running." -ForegroundColor Yellow
    
    $dockerExePath = "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
    if (Test-Path $dockerExePath) {
        Write-Host "[*] Starting Docker Desktop daemon..." -ForegroundColor Cyan
        Start-Process $dockerExePath
    } else {
        Write-Host "[*] Please start Docker Desktop from your Start Menu." -ForegroundColor Yellow
    }

    Write-Host "[*] Waiting for Docker engine to initialize (up to 90 seconds)..." -NoNewline
    $timeout = 90
    $elapsed = 0
    while ((-not (Test-DockerWorking)) -and ($elapsed -lt $timeout)) {
        Start-Sleep -Seconds 3
        $elapsed += 3
        Write-Host "." -NoNewline
    }
    Write-Host ""

    if (-not (Test-DockerWorking)) {
        Write-Host "[ERROR] Docker engine did not start in time." -ForegroundColor Red
        Write-Host "Fix: Ensure Docker Desktop is open and the engine status shows 'Engine running'." -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "      Docker engine is active and ready." -ForegroundColor Green

# ------------------------------------------------------------------------------
# 4. Local Wi-Fi and LAN IPv4 Network Detection
# ------------------------------------------------------------------------------
Write-Host "[3/7] Detecting local Wi-Fi / LAN IP address..." -ForegroundColor Cyan

$lanIp = "127.0.0.1"
$netAdapters = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { 
        $_.IPAddress -notlike "127.*" -and 
        $_.IPAddress -notlike "169.254.*" -and 
        $_.IPAddress -notlike "172.17.*" -and 
        $_.IPAddress -notlike "172.18.*" -and
        $_.IPAddress -notlike "172.19.*"
    } |
    Sort-Object -Property @{Expression = { if ($_.InterfaceAlias -like "*Wi-Fi*") { 1 } elseif ($_.InterfaceAlias -like "*Ethernet*") { 2 } else { 3 } }}

if ($netAdapters -and $netAdapters.Count -gt 0) {
    $lanIp = $netAdapters[0].IPAddress
    Write-Host "      Detected Primary LAN IP: $lanIp ($($netAdapters[0].InterfaceAlias))" -ForegroundColor Green
} else {
    Write-Host "      [!] Could not detect active Wi-Fi adapter; defaulting to 127.0.0.1" -ForegroundColor Yellow
}

# ------------------------------------------------------------------------------
# 5. Port Conflict Detection and Selection
# ------------------------------------------------------------------------------
Write-Host "[4/7] Checking reverse proxy port availability..." -ForegroundColor Cyan

function Test-PortOccupied([int]$testPort) {
    $connection = Get-NetTCPConnection -LocalPort $testPort -ErrorAction SilentlyContinue
    if ($connection) {
        $procId = $connection[0].OwningProcess
        $procName = (Get-Process -Id $procId -ErrorAction SilentlyContinue).ProcessName
        return @{ Occupied = $true; ProcessId = $procId; ProcessName = $procName }
    }
    return @{ Occupied = $false }
}

$targetPort = 80
if ($Port -gt 0) {
    $targetPort = $Port
}

$portStatus = Test-PortOccupied $targetPort
if ($portStatus.Occupied) {
    Write-Host "      [!] Port $targetPort is currently held by process '$($portStatus.ProcessName)' (PID $($portStatus.ProcessId))." -ForegroundColor Yellow
    $alternativePorts = @(8080, 8000, 3080)
    $foundAlt = $false
    foreach ($alt in $alternativePorts) {
        $altStatus = Test-PortOccupied $alt
        if (-not $altStatus.Occupied) {
            $targetPort = $alt
            $foundAlt = $true
            Write-Host "      [*] Automatically assigned free alternative port: $targetPort" -ForegroundColor Cyan
            break
        }
    }
    if (-not $foundAlt) {
        $targetPort = 8080
    }
} else {
    Write-Host "      Port $targetPort is open and available." -ForegroundColor Green
}

# ------------------------------------------------------------------------------
# 6. Environment (.env) Configuration and Secret Generation
# ------------------------------------------------------------------------------
Write-Host "[5/7] Configuring environment variables (.env)..." -ForegroundColor Cyan

$envFile = Join-Path $ScriptDir ".env"
$envExample = Join-Path $ScriptDir ".env.example"

if (-not (Test-Path $envFile)) {
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile
    } else {
        $defaultEnv = "PROXY_PORT=80`nNEXTAUTH_SECRET=`nNEXTAUTH_URL=http://localhost`nAPP_URL=http://localhost"
        Set-Content -Path $envFile -Value $defaultEnv
    }
}

$envContent = Get-Content $envFile -Raw

$needsSecret = $false
if ($envContent -match 'NEXTAUTH_SECRET=(.*)') {
    $curSecret = $matches[1].Trim()
    if ($curSecret -eq "" -or $curSecret -like "*replace-with*" -or $curSecret -like "*placeholder*") {
        $needsSecret = $true
    }
} else {
    $needsSecret = $true
}

if ($needsSecret) {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $generatedSecret = -join ($bytes | ForEach-Object { "{0:x2}" -f $_ })
    if ($envContent -match 'NEXTAUTH_SECRET=.*') {
        $envContent = $envContent -replace 'NEXTAUTH_SECRET=.*', "NEXTAUTH_SECRET=$generatedSecret"
    } else {
        $envContent = $envContent + "`nNEXTAUTH_SECRET=$generatedSecret"
    }
    Write-Host "      Generated cryptographically secure authentication secret." -ForegroundColor Green
}

$displayUrl = "http://${lanIp}:${targetPort}"
if ($targetPort -eq 80) {
    $displayUrl = "http://${lanIp}"
}

$envContent = $envContent -replace 'PROXY_PORT=.*', "PROXY_PORT=$targetPort"
$envContent = $envContent -replace 'NEXTAUTH_URL=.*', "NEXTAUTH_URL=$displayUrl"
$envContent = $envContent -replace 'APP_URL=.*', "APP_URL=$displayUrl"

Set-Content -Path $envFile -Value $envContent.Trim() -NoNewline
Write-Host "      Environment settings synchronized." -ForegroundColor Green

# ------------------------------------------------------------------------------
# 7. Windows Defender Firewall Rule Configuration
# ------------------------------------------------------------------------------
Write-Host "[6/7] Configuring Windows Defender Firewall for local Wi-Fi traffic..." -ForegroundColor Cyan

$ruleName = "Attendly Web Proxy (Port $targetPort)"
$existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if (-not $existingRule) {
    try {
        $firewallParams = @{
            DisplayName = $ruleName
            Direction   = "Inbound"
            LocalPort   = $targetPort
            Protocol    = "TCP"
            Action      = "Allow"
            Profile     = "Any"
            Description = "Allows incoming local Wi-Fi mobile connections for Attendly"
        }
        New-NetFirewallRule @firewallParams | Out-Null
        Write-Host "      Created Windows Firewall rule: $ruleName" -ForegroundColor Green
    } catch {
        Write-Host "      [!] Could not automatically add firewall rule: $($_.Exception.Message)" -ForegroundColor Yellow
    }
} else {
    Write-Host "      Windows Firewall rule already active." -ForegroundColor Green
}

# ------------------------------------------------------------------------------
# 8. Service Deployment via Docker Compose
# ------------------------------------------------------------------------------
Write-Host "[7/7] Launching application and reverse proxy via Docker Compose..." -ForegroundColor Cyan

try {
    docker compose up -d --build
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose command failed with exit code $LASTEXITCODE"
    }
} catch {
    Write-Host "[ERROR] Failed to start Docker Compose services: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Check build output above. Ensure Docker Desktop has internet connectivity to pull base images." -ForegroundColor Yellow
    exit 1
}

# ------------------------------------------------------------------------------
# 9. End-to-End Health Verification
# ------------------------------------------------------------------------------
Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "          VERIFYING INSTALLATION AND ROUTING            " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$healthUrlLocal = "http://127.0.0.1:${targetPort}/api/health"
$healthUrlLan = "http://${lanIp}:${targetPort}/api/health"

Write-Host "Checking health endpoint ($healthUrlLocal)..." -NoNewline
$healthy = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        $resp = Invoke-RestMethod -Uri $healthUrlLocal -TimeoutSec 3 -ErrorAction Stop
        if ($resp.ok -or $resp.service) {
            $healthy = $true
            break
        }
    } catch {
        Start-Sleep -Seconds 2
        Write-Host "." -NoNewline
    }
}
Write-Host ""

if ($healthy) {
    Write-Host " [OK] Localhost Routing: 200 OK (Application and Proxy Responding)" -ForegroundColor Green
} else {
    Write-Host " [WARN] Application took longer to start. Check logs using: docker compose logs -f" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "               INSTALLATION COMPLETE!                   " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Access Points:" -ForegroundColor White
Write-Host "  Local Computer: $displayUrl" -ForegroundColor Cyan
Write-Host "  Mobile Devices (Same Wi-Fi): $displayUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "Remote / Internet Access Options:" -ForegroundColor White
Write-Host "  Option A (Free Cloudflare Quick Tunnel):" -ForegroundColor Gray
Write-Host "    docker run --rm cloudflare/cloudflared:latest tunnel --url $displayUrl" -ForegroundColor Gray
Write-Host "    Trade-off: Zero port opening required; zero public IP exposure." -ForegroundColor Gray
Write-Host "  Option B (Router Port Forwarding):" -ForegroundColor Gray
Write-Host "    Forward external port to internal IP $displayUrl in your router." -ForegroundColor Gray
Write-Host "    Trade-off: Exposes your home/office public IP to the internet." -ForegroundColor Gray
Write-Host "========================================================" -ForegroundColor Green
