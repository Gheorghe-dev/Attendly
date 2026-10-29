# Attendly — Automated Docker Deployment & Local Wi-Fi Setup

This guide explains how to deploy Attendly using Docker and the automated one-command installers on **Windows**, **macOS**, and **Linux**, enabling any phone, tablet, or laptop on the local Wi-Fi network to connect with zero manual configuration.

---

## Architecture Overview

```
                      [ Local Wi-Fi Network ]
                                 │
     ┌───────────────────────────┼───────────────────────────┐
     ▼                           ▼                           ▼
[Teacher Laptop]        [Student Phone A]           [Student Phone B]
(Browser Dashboard)      (QR Camera Scan)            (QR Camera Scan)
     │                           │                           │
     └───────────────────────────┼───────────────────────────┘
                                 │ HTTP :80 / :8080 (LAN IP)
                                 ▼
                     ┌───────────────────────┐
                     │     attendly-proxy    │ (Nginx Reverse Proxy)
                     │    (Port 80 / 8080)   │
                     └───────────┬───────────┘
                                 │ Internal Docker Network (attendly-net)
                                 ▼
                     ┌───────────────────────┐
                     │      attendly-app     │ (Next.js 14 + Node 20)
                     │      (Port 3000)      │
                     └───────────┬───────────┘
                                 │
                     ┌───────────▼───────────┐
                     │ attendly-sqlite-data  │ (Persistent SQLite Volume)
                     └───────────────────────┘
```

- **Reverse Proxy**: Nginx (`nginx:alpine`) acts as the front-facing gateway, listening on all interfaces (`0.0.0.0:80` or an auto-assigned fallback port such as `8080`).
- **Application Container**: Runs the Next.js 14 Node application on internal port `3000`.
- **Database**: SQLite database stored in a named Docker volume (`attendly-sqlite-data`) at `/app/prisma`, persisting across container restarts and updates.

---

## 1-Command Installation

### Windows (PowerShell or Double-Click Batch)

1. Open PowerShell as Administrator (or double-click `install.bat`):
   ```powershell
   Set-ExecutionPolicy Bypass -Scope Process -Force
   .\install.ps1
   ```
2. The script will:
   - Detect Docker Desktop (or prompt/install it via `winget` if missing).
   - Detect your local Wi-Fi IPv4 address (e.g., `192.168.1.150`).
   - Check if port 80 is occupied, auto-assigning port `8080` if needed.
   - Generate a 32-byte cryptographic secret in `.env`.
   - Add an inbound allow rule to Windows Defender Firewall.
   - Start the containers and verify health checks.

### macOS (Terminal)

1. Open Terminal in the project root:
   ```bash
   chmod +x install-mac.sh
   ./install-mac.sh
   ```
2. The script will:
   - Verify Docker Desktop in `/Applications/Docker.app`.
   - Detect active Wi-Fi adapter IP (`en0` / `en1`).
   - Handle port conflicts and generate cryptographic keys in `.env`.
   - Start services and run health verification.

### Linux (Ubuntu / Debian / RHEL / Arch)

1. Open Terminal:
   ```bash
   chmod +x install-linux.sh
   ./install-linux.sh
   ```
2. The script will:
   - Check or install Docker Engine via official packages.
   - Configure UFW or Firewalld to permit local traffic.
   - Set up SQLite permissions and start containers.

---

## Local Network Access & QR Codes

Once installed, Attendly displays your local access URL:
- **Local Dashboard**: `http://localhost` (or `http://localhost:8080`)
- **Student Wi-Fi URL**: `http://192.168.x.x` (or `http://192.168.x.x:8080`)

Any device connected to the **same Wi-Fi network** can open the student URL or scan projected QR codes directly.

---

## Remote Access: Internet Options & Trade-Offs

If you need students on cellular data (4G/5G) or outside the classroom to connect, two options are available:

### Option A: Free Cloudflare Quick Tunnel (Recommended)

Run a zero-trust tunnel container without opening any router ports:

```bash
docker run --rm -d --name attendly-tunnel \
  --network attendly-net \
  cloudflare/cloudflared:latest \
  tunnel --url http://proxy:80
```

Check the generated public URL in the logs:
```bash
docker logs attendly-tunnel 2>&1 | grep "trycloudflare.com"
```

- **Pros**: 
  - Zero router configuration or port forwarding needed.
  - Your real home/university IP address is never revealed.
  - Automatic HTTPS with a valid certificate.
- **Trade-offs**:
  - Dependent on Cloudflare's free edge network availability.
  - The URL changes upon container restart unless a named tunnel with a custom domain is configured.

### Option B: Router Port Forwarding

Forward external port 80 (or 8080) to your host computer's local IP on your Wi-Fi router.

- **Pros**:
  - Direct connection to your host machine without third-party relay.
  - Permanent domain mapping with Dynamic DNS (DDNS).
- **Trade-offs**:
  - Exposes your computer's public IP address directly to the internet.
  - Requires manual router login and firewall management.
  - Subject to ISP CGNAT (Carrier-Grade NAT) limitations.

---

## Troubleshooting Common Issues

### 1. Docker Daemon Not Running
- **Symptom**: `Cannot connect to the Docker daemon at unix:///var/run/docker.sock` or `docker info` fails.
- **Fix**:
  - **Windows**: Open Docker Desktop from the Start Menu and verify the bottom-left icon turns green ("Engine running").
  - **macOS**: Launch Docker from `/Applications/Docker.app`.
  - **Linux**: Run `sudo systemctl start docker` and ensure your user is in the docker group: `sudo usermod -aG docker $USER`.

### 2. Port Conflict (Port 80 Already in Use)
- **Symptom**: `bind: address already in use` when starting Nginx.
- **Cause**: Windows World Wide Web Publishing Service (IIS), Skype, or another web server is holding port 80.
- **Fix**:
  - The installer automatically selects port `8080` if port 80 is occupied.
  - To manually set an alternative port, change `PROXY_PORT=8080` in `.env` and restart:
    ```bash
    docker compose down
    docker compose up -d
    ```

### 3. Firewall Blocking Mobile Devices on Local Wi-Fi
- **Symptom**: The host computer can open `http://localhost`, but phones on Wi-Fi get a connection timeout.
- **Fix**:
  - **Windows**: Verify the firewall rule in elevated PowerShell:
    ```powershell
    Get-NetFirewallRule -DisplayName "*Attendly*"
    ```
    Ensure your Wi-Fi network profile is set to "Private" rather than "Public":
    ```powershell
    Set-NetConnectionProfile -InterfaceAlias "Wi-Fi" -NetworkCategory Private
    ```
  - **Linux**: Allow port in UFW: `sudo ufw allow 80/tcp` or Firewalld: `sudo firewall-cmd --add-port=80/tcp --permanent && sudo firewall-cmd --reload`.

### 4. Permission Denied on SQLite Database Volume
- **Symptom**: Prisma errors: `PrismaClientKnownRequestError: Can't open database file`.
- **Fix**:
  - On Linux hosts, ensure the local storage directory has read/write permissions:
    ```bash
    sudo chmod -R 777 prisma
    ```

### 5. Mobile Phone Camera Cannot Reach Local IP
- **Symptom**: Scanning QR code shows `Unable to connect to 192.168.x.x`.
- **Cause**: "Client Isolation" / "AP Isolation" enabled on university or guest Wi-Fi networks preventing peer-to-peer communication.
- **Fix**:
  - Connect teacher laptop and student devices to standard non-isolated Wi-Fi or mobile hotspot.
  - Alternatively, use Cloudflare Quick Tunnel (Option A above) so devices connect through the public internet.

---

## Maintenance & Commands

- **Check Container Status**: `docker compose ps`
- **View Live Logs**: `docker compose logs -f`
- **Stop Containers**: `docker compose down`
- **Update / Rebuild**: `docker compose up -d --build` (Preserves SQLite database)
- **Backup Database**:
  ```bash
  docker cp attendly-app:/app/prisma/dev.db ./backup-dev.db
  ```
