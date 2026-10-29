#!/usr/bin/env bash
# ==============================================================================
# Attendly — Automated macOS One-Command Deployment Installer
# ==============================================================================
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "========================================================"
echo "        ATTENDLY — macOS ONE-COMMAND INSTALLER          "
echo "========================================================"
echo ""

# ------------------------------------------------------------------------------
# 1. System & Architecture Detection
# ------------------------------------------------------------------------------
ARCH=$(uname -m)
OS_VERSION=$(sw_vers -productVersion 2>/dev/null || echo "macOS")
echo "🍏 [1/7] Detected macOS $OS_VERSION ($ARCH)"

# ------------------------------------------------------------------------------
# 2. Docker Environment Check & Guided Installation
# ------------------------------------------------------------------------------
echo "🐳 [2/7] Checking Docker environment..."

test_docker() {
    docker info >/dev/null 2>&1
}

if ! command -v docker >/dev/null 2>&1; then
    echo "⚠️  Docker is not installed on this Mac."
    if command -v brew >/dev/null 2>&1; then
        echo "🍺 Installing Docker Desktop via Homebrew..."
        brew install --cask docker
        open -a Docker || true
    else
        echo "❌ Docker Desktop is required to run Attendly."
        echo "👉 Opening Docker Desktop download page for Apple Silicon / Intel..."
        open "https://www.docker.com/products/docker-desktop/" || true
        echo "Please install Docker Desktop and re-run this script."
        exit 1
    fi
fi

if ! test_docker; then
    if [ -d "/Applications/Docker.app" ]; then
        echo "🚀 Launching Docker Desktop..."
        open -a Docker
    fi

    echo -n "⏳ Waiting for Docker engine to start..."
    for i in {1..45}; do
        if test_docker; then
            break
        fi
        sleep 2
        echo -n "."
    done
    echo ""

    if ! test_docker; then
        echo "❌ Docker engine did not start in time."
        echo "Fix: Please open Docker Desktop from Applications, accept terms if prompted, and re-run."
        exit 1
    fi
fi
echo "   ✅ Docker engine is active and ready."

# ------------------------------------------------------------------------------
# 3. Local Wi-Fi / LAN IP Detection
# ------------------------------------------------------------------------------
echo "📡 [3/7] Detecting local Wi-Fi / Ethernet IP address..."

LAN_IP=""
for iface in en0 en1 en2; do
    IP=$(ipconfig getifaddr "$iface" 2>/dev/null || true)
    if [ -n "$IP" ] && [[ "$IP" != 127.* ]]; then
        LAN_IP="$IP"
        echo "   ✅ Detected LAN IP: $LAN_IP (interface: $iface)"
        break
    fi
done

if [ -z "$LAN_IP" ]; then
    LAN_IP="127.0.0.1"
    echo "   ⚠️  Could not detect active Wi-Fi interface; defaulting to 127.0.0.1"
fi

# ------------------------------------------------------------------------------
# 4. Port Conflict Detection & Selection
# ------------------------------------------------------------------------------
echo "🔍 [4/7] Checking reverse proxy port availability..."

TARGET_PORT=80
check_port() {
    lsof -i ":$1" -sTCP:LISTEN >/dev/null 2>&1
}

if check_port "$TARGET_PORT"; then
    OCCUPIER=$(lsof -ti ":$TARGET_PORT" | head -n 1 2>/dev/null || echo "Unknown")
    echo "   ⚠️  Port 80 is currently in use (PID: $OCCUPIER)."
    for alt in 8080 8000 3080; do
        if ! check_port "$alt"; then
            TARGET_PORT="$alt"
            echo "   ✅ Automatically selected free alternative port: $TARGET_PORT"
            break
        fi
    done
else
    echo "   ✅ Port $TARGET_PORT is open and available."
fi

# ------------------------------------------------------------------------------
# 5. Environment (.env) Configuration & Secret Generation
# ------------------------------------------------------------------------------
echo "⚙️  [5/7] Configuring environment (.env)..."

if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
    else
        echo "PROXY_PORT=80" > .env
    fi
fi

# Generate 32-byte secure random secret if placeholder
if grep -q "replace-with-a-secure" .env || ! grep -q "NEXTAUTH_SECRET=" .env || grep -q "NEXTAUTH_SECRET=$" .env; then
    GEN_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p | head -n 1)
    if grep -q "^NEXTAUTH_SECRET=" .env; then
        sed -i '' "s/^NEXTAUTH_SECRET=.*/NEXTAUTH_SECRET=$GEN_SECRET/" .env
    else
        echo "NEXTAUTH_SECRET=$GEN_SECRET" >> .env
    fi
    echo "   ✅ Generated secure authentication secret."
fi

# Set proxy port and LAN URL
if [ "$TARGET_PORT" -eq 80 ]; then
    DISPLAY_URL="http://${LAN_IP}"
else
    DISPLAY_URL="http://${LAN_IP}:${TARGET_PORT}"
fi

sed -i '' "s/^PROXY_PORT=.*/PROXY_PORT=$TARGET_PORT/" .env 2>/dev/null || true
sed -i '' "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=$DISPLAY_URL|" .env 2>/dev/null || true
sed -i '' "s|^APP_URL=.*|APP_URL=$DISPLAY_URL|" .env 2>/dev/null || true
echo "   ✅ Configured PROXY_PORT=$TARGET_PORT and URLs."

# ------------------------------------------------------------------------------
# 6. macOS Firewall Status Check
# ------------------------------------------------------------------------------
echo "🛡️  [6/7] Checking macOS Application Firewall..."
if /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null | grep -q "enabled"; then
    echo "   ℹ️  macOS Firewall is enabled. If mobile devices cannot connect, allow incoming connections for Docker."
else
    echo "   ✅ macOS Firewall permits local network traffic."
fi

# ------------------------------------------------------------------------------
# 7. Start Services via Docker Compose
# ------------------------------------------------------------------------------
echo "🚀 [7/7] Launching application and reverse proxy via Docker Compose..."
docker compose up -d --build

# ------------------------------------------------------------------------------
# 8. Health Verification
# ------------------------------------------------------------------------------
echo ""
echo "========================================================"
echo "          VERIFYING INSTALLATION & ROUTING              "
echo "========================================================"

HEALTH_URL="http://127.0.0.1:${TARGET_PORT}/api/health"
echo -n "Checking health endpoint ($HEALTH_URL)..."
HEALTHY=false

for i in {1..30}; do
    if curl -s -f "$HEALTH_URL" >/dev/null 2>&1; then
        HEALTHY=true
        break
    fi
    sleep 2
    echo -n "."
done
echo ""

if [ "$HEALTHY" = true ]; then
    echo "✅ Localhost Routing: 200 OK (Application & Proxy Responding)"
else
    echo "⚠️  Application took longer to respond. Review logs with: docker compose logs -f"
fi

echo ""
echo "========================================================"
echo "               INSTALLATION COMPLETE! 🎉                "
echo "========================================================"
echo "Access Points:"
echo "  💻 Local Computer: $DISPLAY_URL"
echo "  📱 Mobile Devices (Same Wi-Fi): $DISPLAY_URL"
echo ""
echo "Remote / Internet Access Options:"
echo "  Option A (Free Cloudflare Quick Tunnel):"
echo "    docker run --rm cloudflare/cloudflared:latest tunnel --url $DISPLAY_URL"
echo "    Trade-off: Zero port forwarding required; zero public IP exposure."
echo "  Option B (Router Port Forwarding):"
echo "    Forward external port $TARGET_PORT to $LAN_IP:$TARGET_PORT in your router."
echo "    Trade-off: Exposes your public IP directly to the internet."
echo "========================================================"
