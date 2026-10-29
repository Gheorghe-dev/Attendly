#!/usr/bin/env bash
# ==============================================================================
# Attendly — Automated Linux One-Command Deployment Installer
# ==============================================================================
# Complete setup: Docker Engine, Container Server, Cloudflare Tunnel,
# Firewall rules, and Desktop Shortcuts with 1-click startup.
# ==============================================================================
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "========================================================"
echo "        ATTENDLY — Linux ONE-COMMAND INSTALLER          "
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
echo "🐧 [1/8] Detected Operating System: $DISTRO ($ARCH)"

# ------------------------------------------------------------------------------
# 2. Docker Engine & Runtime Verification / Fully Automated Setup
# ------------------------------------------------------------------------------
echo "🐳 [2/8] Checking Docker and system prerequisites..."

# Ensure core package download utilities are installed
if ! command -v curl >/dev/null 2>&1; then
    echo "📦 Installing curl and certificates..."
    sudo apt-get update -y && sudo apt-get install -y curl ca-certificates 2>/dev/null || \
    sudo dnf install -y curl ca-certificates 2>/dev/null || \
    sudo yum install -y curl ca-certificates 2>/dev/null || \
    sudo pacman -Sy --noconfirm curl ca-certificates 2>/dev/null || true
fi

test_docker() {
    docker info >/dev/null 2>&1
}

if ! command -v docker >/dev/null 2>&1; then
    echo "⚠️  Docker Engine is not installed. Installing Docker automatically..."
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
        sudo sh /tmp/get-docker.sh
        rm -f /tmp/get-docker.sh
    elif command -v wget >/dev/null 2>&1; then
        wget -qO- https://get.docker.com | sudo sh
    fi
    sudo systemctl enable --now docker 2>/dev/null || sudo service docker start 2>/dev/null || true
    sudo usermod -aG docker "$USER" 2>/dev/null || true
fi

# Auto-install Node.js if missing
if ! command -v node >/dev/null 2>&1; then
    echo "📦 Installing Node.js LTS..."
    sudo apt-get update -y && sudo apt-get install -y nodejs npm 2>/dev/null || \
    sudo dnf install -y nodejs npm 2>/dev/null || \
    sudo yum install -y nodejs npm 2>/dev/null || \
    sudo pacman -Sy --noconfirm nodejs npm 2>/dev/null || true
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
        sudo apt-get update -y && sudo apt-get install -y docker-compose-plugin 2>/dev/null || \
        sudo dnf install -y docker-compose-plugin 2>/dev/null || \
        sudo yum install -y docker-compose-plugin 2>/dev/null || true
    fi
fi

# ------------------------------------------------------------------------------
# 3. Local Wi-Fi / LAN IP Detection
# ------------------------------------------------------------------------------
echo "📡 [3/8] Detecting local Wi-Fi / Ethernet IP address..."

LAN_IP=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}')

if [ -z "$LAN_IP" ]; then
    LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi

if [ -z "$LAN_IP" ]; then
    echo "   ⚠️  Could not detect active network adapter; defaulting to 127.0.0.1"
    LAN_IP="127.0.0.1"
else
    echo "   ✅ Detected Primary LAN IP: $LAN_IP"
fi

# ------------------------------------------------------------------------------
# 4. Port Conflict Detection & Selection
# ------------------------------------------------------------------------------
echo "🔌 [4/8] Checking reverse proxy port availability..."

check_port_linux() {
    ss -tulpn 2>/dev/null | grep -q ":$1 " || netstat -tulpn 2>/dev/null | grep -q ":$1 "
}

TARGET_PORT=80
if check_port_linux 80; then
    echo "   ⚠️  Port 80 is occupied by another process."
    for ALT in 8080 8000 3080; do
        if ! check_port_linux "$ALT"; then
            TARGET_PORT=$ALT
            echo "   ✅ Assigned alternative port: $TARGET_PORT"
            break
        fi
    done
else
    echo "   ✅ Port 80 is open and available."
fi

# ------------------------------------------------------------------------------
# 5. Environment (.env) Configuration & Key Generation
# ------------------------------------------------------------------------------
echo "⚙️  [5/8] Configuring environment settings (.env)..."

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
    sed -i "s|^NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=$SECRET|" .env
    echo "   ✅ Generated cryptographically secure authentication secret."
fi

if [ "$TARGET_PORT" -eq 80 ]; then
    DISPLAY_URL="http://${LAN_IP}"
else
    DISPLAY_URL="http://${LAN_IP}:${TARGET_PORT}"
fi

sed -i "s|^PROXY_PORT=.*|PROXY_PORT=$TARGET_PORT|" .env
sed -i "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=$DISPLAY_URL|" .env
sed -i "s|^APP_URL=.*|APP_URL=$DISPLAY_URL|" .env

if ! grep -q "CLOUDFLARE_TUNNEL_ACTIVE" .env; then
    echo "CLOUDFLARE_TUNNEL_ACTIVE=true" >> .env
fi

# ------------------------------------------------------------------------------
# 6. Linux Firewall Configuration (UFW or firewalld)
# ------------------------------------------------------------------------------
echo "🛡️  [6/8] Checking Linux firewall configuration..."

if command -v ufw >/dev/null 2>&1; then
    if sudo ufw status | grep -q "Status: active"; then
        echo "   Allowing incoming traffic on ports $TARGET_PORT and 3000 (ufw)..."
        sudo ufw allow "$TARGET_PORT/tcp" comment 'Attendly Web Proxy' >/dev/null 2>&1 || true
        sudo ufw allow "3000/tcp" comment 'Attendly App' >/dev/null 2>&1 || true
        echo "   ✅ UFW rules updated."
    fi
elif command -v firewall-cmd >/dev/null 2>&1; then
    if sudo firewall-cmd --state >/dev/null 2>&1; then
        echo "   Allowing incoming traffic on ports $TARGET_PORT and 3000 (firewalld)..."
        sudo firewall-cmd --permanent --add-port="${TARGET_PORT}/tcp" >/dev/null 2>&1 || true
        sudo firewall-cmd --permanent --add-port="3000/tcp" >/dev/null 2>&1 || true
        sudo firewall-cmd --reload >/dev/null 2>&1 || true
        echo "   ✅ Firewalld rules updated."
    fi
fi

# ------------------------------------------------------------------------------
# 7. Service Deployment via Docker Compose
# ------------------------------------------------------------------------------
echo "🚀 [7/8] Starting Attendly application container and reverse proxy..."

$DOCKER_COMPOSE up -d --build

# ------------------------------------------------------------------------------
# 8. Create Linux Desktop Shortcuts
# ------------------------------------------------------------------------------
echo "🖥️  [8/8] Creating Desktop & Application shortcuts..."

DESKTOP_DIR="$HOME/Desktop"
APPS_DIR="$HOME/.local/share/applications"
mkdir -p "$APPS_DIR"

DESKTOP_ENTRY="[Desktop Entry]
Version=1.0
Type=Application
Name=Attendly
Comment=Attendly Attendance Tracking System (Container Server with Cloudflare)
Exec=$DIR/start-container.sh
Path=$DIR
Icon=$DIR/public/icon.png
Terminal=true
Categories=Education;Office;
"

STOP_ENTRY="[Desktop Entry]
Version=1.0
Type=Application
Name=Stop Attendly
Comment=Stop Attendly Container Server
Exec=$DIR/stop-container.sh
Path=$DIR
Icon=$DIR/public/icon.png
Terminal=true
Categories=Education;Office;
"

echo "$DESKTOP_ENTRY" > "$APPS_DIR/attendly.desktop"
echo "$STOP_ENTRY" > "$APPS_DIR/stop-attendly.desktop"
chmod +x "$APPS_DIR/attendly.desktop" "$APPS_DIR/stop-attendly.desktop" 2>/dev/null || true

if [ -d "$DESKTOP_DIR" ]; then
    echo "$DESKTOP_ENTRY" > "$DESKTOP_DIR/Attendly.desktop"
    echo "$STOP_ENTRY" > "$DESKTOP_DIR/Stop-Attendly.desktop"
    chmod +x "$DESKTOP_DIR/Attendly.desktop" "$DESKTOP_DIR/Stop-Attendly.desktop" 2>/dev/null || true
    gio set "$DESKTOP_DIR/Attendly.desktop" metadata::trusted true 2>/dev/null || true
    gio set "$DESKTOP_DIR/Stop-Attendly.desktop" metadata::trusted true 2>/dev/null || true
    echo "   ✅ Created Desktop shortcut: 'Attendly.desktop' (1-click start)"
    echo "   ✅ Created Desktop shortcut: 'Stop-Attendly.desktop' (1-click stop)"
fi

# ------------------------------------------------------------------------------
# 9. Health Verification & Cloudflare Handshake
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
echo "Desktop Shortcuts:"
echo "  - Double-click 'Attendly.desktop' on your Desktop anytime to launch!"
echo "  - Double-click 'Stop-Attendly.desktop' to stop the container server."
echo ""
echo "Useful Commands:"
echo "  View Live Logs:   $DOCKER_COMPOSE logs -f"
echo "  Stop Containers:  $DOCKER_COMPOSE down"
echo "  Update / Rebuild: $DOCKER_COMPOSE up -d --build"
echo "========================================================"

OPEN_URL="${CF_URL:-$DISPLAY_URL}"
if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$OPEN_URL" >/dev/null 2>&1 &
fi
