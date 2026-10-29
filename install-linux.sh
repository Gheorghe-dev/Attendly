#!/usr/bin/env bash
# ==============================================================================
# Attendly — Automated Linux One-Command Deployment Installer
# ==============================================================================
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "========================================================"
echo "        ATTENDLY — LINUX ONE-COMMAND INSTALLER          "
echo "========================================================"
echo ""

# ------------------------------------------------------------------------------
# 1. System & Architecture Detection
# ------------------------------------------------------------------------------
ARCH=$(uname -m)
DISTRO="Linux"
if [ -f /etc/os-release ]; then
    . /etc/os-release
    DISTRO="$NAME $VERSION_ID"
fi
echo "🐧 [1/7] Detected Operating System: $DISTRO ($ARCH)"

# ------------------------------------------------------------------------------
# 2. Docker Engine & Compose Verification / Auto-Install
# ------------------------------------------------------------------------------
echo "🐳 [2/7] Checking Docker environment..."

test_docker() {
    docker info >/dev/null 2>&1
}

if ! command -v docker >/dev/null 2>&1; then
    echo "⚠️  Docker Engine is not installed."
    echo "📦 Installing official Docker Engine via get.docker.com..."
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
        sudo sh /tmp/get-docker.sh
        rm -f /tmp/get-docker.sh
    else
        echo "❌ Please install curl or Docker manually and re-run this script."
        exit 1
    fi
    sudo systemctl enable --now docker || sudo service docker start || true
    sudo usermod -aG docker "$USER" 2>/dev/null || true
fi

if ! test_docker; then
    echo "🚀 Starting Docker service..."
    sudo systemctl start docker 2>/dev/null || sudo service docker start 2>/dev/null || true
    sleep 3
    if ! test_docker; then
        echo "❌ Docker daemon could not be contacted."
        echo "Fix: Run 'sudo systemctl start docker' or log out and back in to refresh group permissions."
        exit 1
    fi
fi
echo "   ✅ Docker daemon is active and responsive."

# Check docker compose plugin
DOCKER_COMPOSE="docker compose"
if ! docker compose version >/dev/null 2>&1; then
    if command -v docker-compose >/dev/null 2>&1; then
        DOCKER_COMPOSE="docker-compose"
    else
        echo "📦 Installing Docker Compose plugin..."
        sudo apt-get update -y && sudo apt-get install -y docker-compose-plugin 2>/dev/null || true
    fi
fi

# ------------------------------------------------------------------------------
# 3. Local Wi-Fi / LAN IP Detection
# ------------------------------------------------------------------------------
echo "📡 [3/7] Detecting local Wi-Fi / Ethernet IP address..."

LAN_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7}' | head -n 1)
if [ -z "$LAN_IP" ]; then
    LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi

if [ -n "$LAN_IP" ] && [[ "$LAN_IP" != 127.* ]]; then
    echo "   ✅ Detected Primary LAN IP: $LAN_IP"
else
    LAN_IP="127.0.0.1"
    echo "   ⚠️  Could not detect private LAN IP; defaulting to 127.0.0.1"
fi

# ------------------------------------------------------------------------------
# 4. Port Conflict Detection & Selection
# ------------------------------------------------------------------------------
echo "🔍 [4/7] Checking reverse proxy port availability..."

TARGET_PORT=80
check_port() {
    (ss -tulpn 2>/dev/null || netstat -tulpn 2>/dev/null) | grep -q ":$1 "
}

if check_port "$TARGET_PORT"; then
    echo "   ⚠️  Port 80 is occupied by an existing service."
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
echo "⚙️  [5/7] Configuring environment settings (.env)..."

if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
    else
        echo "PROXY_PORT=80" > .env
    fi
fi

# Generate 32-byte secret if missing or placeholder
if grep -q "replace-with-a-secure" .env || ! grep -q "NEXTAUTH_SECRET=" .env || grep -q "NEXTAUTH_SECRET=$" .env; then
    GEN_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p | head -n 1)
    if grep -q "^NEXTAUTH_SECRET=" .env; then
        sed -i "s/^NEXTAUTH_SECRET=.*/NEXTAUTH_SECRET=$GEN_SECRET/" .env
    else
        echo "NEXTAUTH_SECRET=$GEN_SECRET" >> .env
    fi
    echo "   ✅ Generated secure authentication secret."
fi

if [ "$TARGET_PORT" -eq 80 ]; then
    DISPLAY_URL="http://${LAN_IP}"
else
    DISPLAY_URL="http://${LAN_IP}:${TARGET_PORT}"
fi

sed -i "s/^PROXY_PORT=.*/PROXY_PORT=$TARGET_PORT/" .env 2>/dev/null || true
sed -i "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=$DISPLAY_URL|" .env 2>/dev/null || true
sed -i "s|^APP_URL=.*|APP_URL=$DISPLAY_URL|" .env 2>/dev/null || true
echo "   ✅ Configured PROXY_PORT=$TARGET_PORT and URLs."

# ------------------------------------------------------------------------------
# 6. Linux Firewall (UFW / Firewalld) Configuration
# ------------------------------------------------------------------------------
echo "🛡️  [6/7] Configuring Linux firewall for incoming Wi-Fi connections..."

if command -v ufw >/dev/null 2>&1 && sudo ufw status | grep -q "Status: active"; then
    sudo ufw allow "$TARGET_PORT"/tcp comment "Attendly Web Proxy" >/dev/null 2>&1 || true
    echo "   ✅ UFW Firewall rule added for port $TARGET_PORT/tcp."
elif command -v firewall-cmd >/dev/null 2>&1 && sudo firewall-cmd --state >/dev/null 2>&1; then
    sudo firewall-cmd --add-port="$TARGET_PORT"/tcp --permanent >/dev/null 2>&1 || true
    sudo firewall-cmd --reload >/dev/null 2>&1 || true
    echo "   ✅ Firewalld rule added for port $TARGET_PORT/tcp."
else
    echo "   ℹ️  No active UFW or Firewalld detected. Ensure iptables permits port $TARGET_PORT."
fi

# Ensure permissions on local prisma directory for volume mounts
mkdir -p prisma
chmod -R 777 prisma 2>/dev/null || true

# ------------------------------------------------------------------------------
# 7. Start Services via Docker Compose
# ------------------------------------------------------------------------------
echo "🚀 [7/7] Launching application and reverse proxy via Docker Compose..."
$DOCKER_COMPOSE up -d --build

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
    echo "⚠️  Application took longer to respond. Check logs with: $DOCKER_COMPOSE logs -f"
fi

echo -n "Checking Cloudflare Tunnel handshake..."
CF_URL=""
for i in {1..15}; do
    CF_URL=$(docker exec attendly-app cat /app/.tunnel_url 2>/dev/null || true)
    if [ -n "$CF_URL" ] && [[ "$CF_URL" == https://* ]]; then
        break
    fi
    sleep 2
    echo -n "."
done
echo ""

echo ""
echo "========================================================"
echo "               INSTALLATION COMPLETE! 🎉                "
echo "========================================================"
echo "Access Points:"
if [ -n "$CF_URL" ] && [[ "$CF_URL" == https://* ]]; then
    echo "  🌐 Worldwide Access (Cloudflare): $CF_URL"
    echo "     -> Accessible on ANY Wi-Fi or mobile cellular network (4G/5G) worldwide."
else
    echo "  🌐 Worldwide Access (Cloudflare): Initializing in background (see $DOCKER_COMPOSE logs -f)"
fi
echo "  💻 Local Computer:             $DISPLAY_URL"
echo "  📱 Local Wi-Fi Network:        $DISPLAY_URL"
echo ""
echo "Useful Commands:"
echo "  View Live Logs:   $DOCKER_COMPOSE logs -f"
echo "  Stop Containers:  $DOCKER_COMPOSE down"
echo "  Update / Rebuild: $DOCKER_COMPOSE up -d --build"
echo "========================================================"
