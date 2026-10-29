# ==============================================================================
# Attendly — Automated Windows One-Command Deployment Installer
# ==============================================================================
# Complete setup: Docker Engine, Container Server, Cloudflare Tunnel,
# Windows Firewall rules, and Desktop Shortcuts with 1-click startup.
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
# 1. Administrator Elevation Check (Graceful fallback)
# ------------------------------------------------------------------------------
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    if (-not $NonInteractive) {
        Write-Host "[!] Administrator privileges recommended to configure firewall and network bindings." -ForegroundColor Yellow
        try {
            Write-Host "[*] Attempting elevation..." -ForegroundColor Cyan
            $arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
            if ($Port -gt 0) { $arguments = $arguments + " -Port $Port" }
            Start-Process powershell.exe -Verb RunAs -ArgumentList $arguments -ErrorAction Stop
            exit
        } catch {
            Write-Host "[*] Continuing with current user privileges..." -ForegroundColor Yellow
        }
    } else {
        Write-Host "[*] Running with current user privileges (-NonInteractive mode)..." -ForegroundColor Yellow
    }
}

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "       ATTENDLY -- ONE-COMMAND DOCKER INSTALLER         " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------------------------
# 2. System and Architecture Detection
# ------------------------------------------------------------------------------
$arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
$osName = (Get-CimInstance Win32_OperatingSystem).Caption
Write-Host "[1/8] Detected Operating System: $osName ($arch)" -ForegroundColor Green

# ------------------------------------------------------------------------------
# 3. Docker & Runtime Verification and Fully Automated Setup
# ------------------------------------------------------------------------------
Write-Host "[2/8] Checking Docker and system runtime prerequisites..." -ForegroundColor Cyan

# Check if Docker binaries exist in standard directories but not in session PATH
$dockerBinCandidates = @(
    "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin",
    "$env:LOCALAPPDATA\Programs\DockerDesktop\resources",
    "$env:ProgramFiles\Docker\Docker\resources\bin",
    "$env:ProgramFiles\Docker\Docker\resources",
    "$env:LOCALAPPDATA\Programs\Docker\Docker\resources\bin"
)
foreach ($bin in $dockerBinCandidates) {
    if (Test-Path (Join-Path $bin "docker.exe")) {
        if ($env:Path -notlike "*$bin*") {
            $env:Path = "$bin;" + $env:Path
        }
    }
}

function Test-DockerWorking {
    try {
        $null = docker info 2>&1
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    }
}

# Auto-install Docker Desktop if missing
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "[!] Docker CLI was not found on your system. Installing Docker Desktop..." -ForegroundColor Yellow
    
    # 1. Enable WSL 2 & Virtual Machine Platform features if needed
    if (-not (Get-Command wsl -ErrorAction SilentlyContinue)) {
        Write-Host "[*] Enabling Windows Subsystem for Linux (WSL) and Virtual Machine Platform..." -ForegroundColor Cyan
        try {
            dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart | Out-Null
            dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart | Out-Null
        } catch {}
    } else {
        try { wsl --set-default-version 2 2>$null } catch {}
    }

    $installed = $false
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Host "[*] Installing Docker Desktop via Windows Package Manager (winget)..." -ForegroundColor Cyan
        try {
            winget install Docker.DockerDesktop --accept-source-agreements --accept-package-agreements --silent
            if ($LASTEXITCODE -eq 0) { $installed = $true }
        } catch {
            Write-Host "      winget install encountered an issue: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }

    if (-not $installed) {
        Write-Host "[*] Downloading official Docker Desktop installer..." -ForegroundColor Cyan
        $installerUrl = "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe"
        $installerPath = Join-Path $env:TEMP "DockerDesktopInstaller.exe"
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing
            Write-Host "[*] Running silent installation of Docker Desktop..." -ForegroundColor Cyan
            $proc = Start-Process -FilePath $installerPath -ArgumentList "install --quiet --accept-license --backend=wsl-2" -Wait -PassThru
            if ($proc.ExitCode -eq 0) { $installed = $true }
            Remove-Item $installerPath -Force -ErrorAction SilentlyContinue
        } catch {
            Write-Host "      Direct installer download failed: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }

    # Refresh PATH environment variable in current session
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    foreach ($bin in $dockerBinCandidates) {
        if (Test-Path (Join-Path $bin "docker.exe")) {
            if ($env:Path -notlike "*$bin*") { $env:Path = "$bin;" + $env:Path }
        }
    }
}

# Auto-install Node.js LTS if missing (ensures any auxiliary scripts work out of the box)
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[*] Node.js runtime not detected. Installing Node.js LTS..." -ForegroundColor Cyan
    $nodeInstalled = $false
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        try {
            winget install OpenJS.NodeJS.LTS -e --silent --accept-source-agreements --accept-package-agreements
            if ($LASTEXITCODE -eq 0) { $nodeInstalled = $true }
        } catch {}
    }
    if (-not $nodeInstalled) {
        try {
            $nodeUrl = "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi"
            $nodeMsi = Join-Path $env:TEMP "node-installer.msi"
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeMsi -UseBasicParsing
            Start-Process -FilePath "msiexec.exe" -ArgumentList "/i `"$nodeMsi`" /qn /norestart" -Wait
            Remove-Item $nodeMsi -Force -ErrorAction SilentlyContinue
        } catch {}
    }
    $nodeDirs = @("$env:ProgramFiles\nodejs", "$env:APPDATA\npm")
    foreach ($nd in $nodeDirs) {
        if (Test-Path $nd) { $env:Path = "$nd;" + $env:Path }
    }
}

if (-not (Test-DockerWorking)) {
    Write-Host "[*] Starting Docker Desktop daemon..." -ForegroundColor Yellow
    
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

    Write-Host "[*] Waiting for Docker engine to initialize (up to 90 seconds)..." -NoNewline
    $timeout = 90
    $elapsed = 0
    $backendStarted = $false
    while ((-not (Test-DockerWorking)) -and ($elapsed -lt $timeout)) {
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
Write-Host "[3/8] Detecting local Wi-Fi / LAN IP address..." -ForegroundColor Cyan

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
Write-Host "[4/8] Checking reverse proxy port availability..." -ForegroundColor Cyan

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
Write-Host "[5/8] Configuring environment variables (.env)..." -ForegroundColor Cyan

$envFile = Join-Path $ScriptDir ".env"
$envExample = Join-Path $ScriptDir ".env.example"

if (-not (Test-Path $envFile)) {
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile
    } else {
        $defaultEnv = "PROXY_PORT=80`nAPP_PORT=3000`nNEXTAUTH_SECRET=`nNEXTAUTH_URL=http://localhost`nAPP_URL=http://localhost`nCLOUDFLARE_TUNNEL_ACTIVE=true"
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

if ($envContent -notmatch 'CLOUDFLARE_TUNNEL_ACTIVE') {
    $envContent = $envContent + "`nCLOUDFLARE_TUNNEL_ACTIVE=true"
}

Set-Content -Path $envFile -Value $envContent.Trim() -NoNewline
Write-Host "      Environment settings synchronized." -ForegroundColor Green

# ------------------------------------------------------------------------------
# 7. Windows Defender Firewall Rule Configuration
# ------------------------------------------------------------------------------
Write-Host "[6/8] Configuring Windows Defender Firewall for local Wi-Fi traffic..." -ForegroundColor Cyan

$rules = @(
    @{ Name = "Attendly Web Proxy (Port $targetPort)"; Port = $targetPort },
    @{ Name = "Attendly App Direct (Port 3000)"; Port = 3000 }
)

foreach ($r in $rules) {
    $existing = Get-NetFirewallRule -DisplayName $r.Name -ErrorAction SilentlyContinue
    if (-not $existing) {
        try {
            $firewallParams = @{
                DisplayName = $r.Name
                Direction   = "Inbound"
                LocalPort   = $r.Port
                Protocol    = "TCP"
                Action      = "Allow"
                Profile     = "Any"
                Description = "Allows incoming local Wi-Fi mobile connections for Attendly"
            }
            New-NetFirewallRule @firewallParams | Out-Null
            Write-Host "      Created Windows Firewall rule: $($r.Name)" -ForegroundColor Green
        } catch {
            Write-Host "      [!] Could not add firewall rule for $($r.Name): $($_.Exception.Message)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "      Windows Firewall rule already active: $($r.Name)" -ForegroundColor Green
    }
}

# ------------------------------------------------------------------------------
# 8. Service Deployment via Docker Compose
# ------------------------------------------------------------------------------
Write-Host "[7/8] Launching application and reverse proxy via Docker Compose..." -ForegroundColor Cyan

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
# 9. Create Desktop & Start Menu Shortcuts
# ------------------------------------------------------------------------------
Write-Host "[8/8] Creating Desktop and Start Menu shortcuts..." -ForegroundColor Cyan

try {
    $desktopPath = [Environment]::GetFolderPath("Desktop")
    $programsPath = [Environment]::GetFolderPath("Programs")
    $wsh = New-Object -ComObject WScript.Shell
    $iconPath = Join-Path $ScriptDir "attendly.ico"

    # Start shortcut on Desktop
    $scDesk = $wsh.CreateShortcut((Join-Path $desktopPath "Attendly.lnk"))
    $scDesk.TargetPath = (Join-Path $ScriptDir "Start-Container.bat")
    $scDesk.WorkingDirectory = $ScriptDir
    $scDesk.Description = "Launch Attendly Container Server with Cloudflare"
    if (Test-Path $iconPath) { $scDesk.IconLocation = $iconPath }
    $scDesk.Save()

    # Stop shortcut on Desktop
    $scStop = $wsh.CreateShortcut((Join-Path $desktopPath "Stop Attendly.lnk"))
    $scStop.TargetPath = (Join-Path $ScriptDir "Stop-Container.bat")
    $scStop.WorkingDirectory = $ScriptDir
    $scStop.Description = "Stop Attendly Container Server"
    if (Test-Path $iconPath) { $scStop.IconLocation = $iconPath }
    $scStop.Save()

    # Start Menu shortcut
    if (Test-Path $programsPath) {
        $scMenu = $wsh.CreateShortcut((Join-Path $programsPath "Attendly.lnk"))
        $scMenu.TargetPath = (Join-Path $ScriptDir "Start-Container.bat")
        $scMenu.WorkingDirectory = $ScriptDir
        $scMenu.Description = "Attendly Academic Attendance System"
        if (Test-Path $iconPath) { $scMenu.IconLocation = $iconPath }
        $scMenu.Save()
    }
    Write-Host "      Created Desktop shortcut: 'Attendly' (1-click start & browser launch)" -ForegroundColor Green
    Write-Host "      Created Desktop shortcut: 'Stop Attendly' (1-click clean stop)" -ForegroundColor Green
} catch {
    Write-Host "      [!] Could not create desktop shortcut automatically: $($_.Exception.Message)" -ForegroundColor Yellow
}

# ------------------------------------------------------------------------------
# 10. End-to-End Health Verification & Cloudflare Handshake
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

Write-Host "Checking Cloudflare Tunnel handshake..." -NoNewline
$cfUrl = $null
for ($k = 0; $k -lt 15; $k++) {
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

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "               INSTALLATION COMPLETE!                   " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Access Points:" -ForegroundColor White
if ($cfUrl) {
    Write-Host "  Worldwide Access (Cloudflare): $cfUrl" -ForegroundColor Green
    Write-Host "    -> Accessible on ANY Wi-Fi or cellular network (4G/5G) worldwide." -ForegroundColor DarkGreen
} else {
    Write-Host "  Worldwide Access (Cloudflare): Initializing in background (see docker compose logs -f)" -ForegroundColor Yellow
}
Write-Host "  Local Computer:                $displayUrl" -ForegroundColor Cyan
Write-Host "  Local Wi-Fi Network:           $displayUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "Desktop Shortcuts:" -ForegroundColor White
Write-Host "  - Double-click 'Attendly' on your Desktop anytime to start the app!" -ForegroundColor Cyan
Write-Host "  - Double-click 'Stop Attendly' on your Desktop to stop the container server." -ForegroundColor Yellow
Write-Host ""
Write-Host "Useful Commands:" -ForegroundColor White
Write-Host "  View Live Logs:   docker compose logs -f" -ForegroundColor Gray
Write-Host "  Stop Containers:  docker compose down" -ForegroundColor Gray
Write-Host "  Update / Rebuild: docker compose up -d --build" -ForegroundColor Gray
Write-Host "========================================================" -ForegroundColor Green

# Automatically open browser
$openUrl = if ($cfUrl) { $cfUrl } else { $displayUrl }
Start-Process $openUrl
