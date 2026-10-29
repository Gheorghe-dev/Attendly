#!/usr/bin/env bash
# ==============================================================================
# Attendly — Automated macOS One-Command Deployment Installer
# ==============================================================================
# Complete setup: Docker Desktop, Container Server, Cloudflare Tunnel,
# and Desktop Shortcuts with 1-click startup.
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
echo "🍏 [1/8] Detected macOS $OS_VERSION ($ARCH)"

# ------------------------------------------------------------------------------
# 2. Docker Environment Check & Automated Installation
# ------------------------------------------------------------------------------
echo "🐳 [2/8] Checking Docker environment..."

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
        echo "📥 Downloading official Docker Desktop for macOS ($ARCH)..."
        if [ "$ARCH" = "arm64" ]; then
            DMG_URL="https://desktop.docker.com/mac/main/arm64/Docker.dmg"
        else
            DMG_URL="https://desktop.docker.com/mac/main/amd64/Docker.dmg"
        fi
        curl -L -o /tmp/Docker.dmg "$DMG_URL"
        echo "📦 Installing Docker Desktop to /Applications..."
        hdiutil attach /tmp/Docker.dmg -nobrowse -quiet
        cp -R /Volumes/Docker/Docker.app /Applications 2>/dev/null || true
        hdiutil detach /Volumes/Docker -quiet || true
        rm -f /tmp/Docker.dmg
        open -a Docker || true
    fi
fi

if ! test_docker; then
    if [ -d "/Applications/Docker.app" ]; then
        echo "🚀 Launching Docker Desktop..."
        open -a Docker || true
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
echo "📡 [3/8] Detecting local Wi-Fi / Ethernet IP address..."

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
    echo "   ⚠️  Could not find active Wi-Fi interface. Falling back to 127.0.0.1"
    LAN_IP="127.0.0.1"
fi

# ------------------------------------------------------------------------------
# 4. Port Conflict Detection & Selection
# ------------------------------------------------------------------------------
echo "🔌 [4/8] Checking reverse proxy port availability..."

check_port_mac() {
    lsof -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

TARGET_PORT=80
if check_port_mac 80; then
    echo "   ⚠️  Port 80 is occupied by another process."
    for ALT in 8080 8000 3080; do
        if ! check_port_mac "$ALT"; then
            TARGET_PORT=$ALT
            echo "   ✅ Assigned alternative port: $TARGET_PORT"
            break
        fi
    done
else
    echo "   ✅ Port 80 is available."
fi

# ------------------------------------------------------------------------------
# 5. Environment (.env) Configuration
# ------------------------------------------------------------------------------
echo "⚙️  [5/8] Configuring environment (.env)..."

if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
    else
        cat <<EOF > .env
PROXY_PORT=80
APP_PORT=3000
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost
APP_URL=http://localhost
CLOUDFLARE_TUNNEL_ACTIVE=true
EOF
    fi
fi

if ! grep -q "NEXTAUTH_SECRET=." .env || grep -q "replace-with" .env; then
    SECRET=$(openssl rand -hex 32)
    sed -i '' "s|^NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=$SECRET|" .env 2>/dev/null || sed -i "s|^NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=$SECRET|" .env
    echo "   ✅ Generated cryptographically secure authentication secret."
fi

if [ "$TARGET_PORT" -eq 80 ]; then
    DISPLAY_URL="http://${LAN_IP}"
else
    DISPLAY_URL="http://${LAN_IP}:${TARGET_PORT}"
fi

sed -i '' "s|^PROXY_PORT=.*|PROXY_PORT=$TARGET_PORT|" .env 2>/dev/null || sed -i "s|^PROXY_PORT=.*|PROXY_PORT=$TARGET_PORT|" .env
sed -i '' "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=$DISPLAY_URL|" .env 2>/dev/null || sed -i "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=$DISPLAY_URL|" .env
sed -i '' "s|^APP_URL=.*|APP_URL=$DISPLAY_URL|" .env 2>/dev/null || sed -i "s|^APP_URL=.*|APP_URL=$DISPLAY_URL|" .env

if ! grep -q "CLOUDFLARE_TUNNEL_ACTIVE" .env; then
    echo "CLOUDFLARE_TUNNEL_ACTIVE=true" >> .env
fi

# ------------------------------------------------------------------------------
# 6. Service Deployment via Docker Compose
# ------------------------------------------------------------------------------
echo "🚀 [6/8] Starting Attendly application container and reverse proxy..."

docker compose up -d --build

# ------------------------------------------------------------------------------
# 7. Create macOS Desktop Shortcut Launchers
# ------------------------------------------------------------------------------
echo "🖥️  [7/8] Creating Desktop shortcut launchers..."

DESKTOP_DIR="$HOME/Desktop"
if [ -d "$DESKTOP_DIR" ]; then
    # Start shortcut
    cat << 'EOF' > "$DESKTOP_DIR/Attendly.command"
#!/usr/bin/env bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
PROJECT_DIR="REPLACE_DIR"
cd "$PROJECT_DIR"
./start-container.sh
EOF
    sed -i '' "s|REPLACE_DIR|$DIR|g" "$DESKTOP_DIR/Attendly.command" 2>/dev/null || sed -i "s|REPLACE_DIR|$DIR|g" "$DESKTOP_DIR/Attendly.command"
    chmod +x "$DESKTOP_DIR/Attendly.command"

    # Stop shortcut
    cat << 'EOF' > "$DESKTOP_DIR/Stop-Attendly.command"
#!/usr/bin/env bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
PROJECT_DIR="REPLACE_DIR"
cd "$PROJECT_DIR"
./stop-container.sh
EOF
    sed -i '' "s|REPLACE_DIR|$DIR|g" "$DESKTOP_DIR/Stop-Attendly.command" 2>/dev/null || sed -i "s|REPLACE_DIR|$DIR|g" "$DESKTOP_DIR/Stop-Attendly.command"
    chmod +x "$DESKTOP_DIR/Stop-Attendly.command"

    echo "   ✅ Created Desktop launcher: 'Attendly.command' (1-click start)"
    echo "   ✅ Created Desktop launcher: 'Stop-Attendly.command' (1-click stop)"
fi

# ------------------------------------------------------------------------------
# 8. Health Verification & Cloudflare Handshake
# ------------------------------------------------------------------------------
echo ""
echo "========================================================"
echo "          VERIFYING INSTALLATION AND ROUTING            "
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

echo -n "Checking Cloudflare Tunnel handshake..."
CF_URL=""
for i in $(seq 1 15); do
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
    echo "  🌐 Worldwide Access (Cloudflare): Initializing in background (see docker compose logs -f)"
fi
echo "  💻 Local Computer:             $DISPLAY_URL"
echo "  📱 Local Wi-Fi Network:        $DISPLAY_URL"
echo ""
echo "Desktop Shortcuts:"
echo "  - Double-click 'Attendly.command' on your Desktop anytime to launch!"
echo "  - Double-click 'Stop-Attendly.command' to stop the container server."
echo ""
echo "Useful Commands:"
echo "  View Live Logs:   docker compose logs -f"
echo "  Stop Containers:  docker compose down"
echo "  Update / Rebuild: docker compose up -d --build"
echo "========================================================"

OPEN_URL="${CF_URL:-$DISPLAY_URL}"
open "$OPEN_URL" 2>/dev/null || true
