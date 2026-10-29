#!/usr/bin/env bash
# ==============================================================================
# Attendly — Automated Container Launcher & Lifecycle Manager (macOS & Linux)
# Starts Docker automatically on launch, and stops Docker automatically on exit
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

cleanup() {
    echo ""
    echo "================================================================================"
    echo "     APP CLOSED -- AUTOMATICALLY STOPPING DOCKER CONTAINERS...                 "
    echo "================================================================================"
    docker compose down
    echo "✅ Docker containers stopped successfully. All attendance data is saved."
    exit 0
}

trap cleanup EXIT INT TERM

echo "================================================================================"
echo "                  ATTENDLY CONTAINER SERVER WITH CLOUDFLARE"
echo "================================================================================"
echo ""

# 1. Check Docker
if ! command -v docker >/dev/null 2>&1; then
    echo "❌ [ERROR] Docker is not installed or not in PATH."
    echo "Please install Docker from https://www.docker.com/"
    exit 1
fi

# 2. Check Docker daemon
if ! docker info >/dev/null 2>&1; then
    echo "⚠️ [!] Docker daemon is not running."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "Attempting to open Docker Desktop on macOS..."
        open -a Docker || true
    else
        echo "Attempting to start Docker service on Linux..."
        sudo systemctl start docker 2>/dev/null || sudo service docker start 2>/dev/null || true
    fi
    echo "Waiting for Docker daemon to become responsive..."
    for i in {1..30}; do
        if docker info >/dev/null 2>&1; then
            break
        fi
        sleep 2
        echo -n "."
    done
    echo ""
    if ! docker info >/dev/null 2>&1; then
        echo "❌ [ERROR] Docker daemon is still not ready. Please start Docker."
        exit 1
    fi
fi

# 3. Environment file
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    cp .env.example .env
    echo "ℹ️  Created .env configuration from template."
fi

LOCAL_PORT="8080"
if [ -f ".env" ]; then
    PARSED_PORT=$(grep -E '^PROXY_PORT=' .env | cut -d '=' -f2 | tr -d ' "' || true)
    if [ -n "$PARSED_PORT" ]; then
        LOCAL_PORT="$PARSED_PORT"
    fi
fi

# 4. Start Docker Compose
echo "🚀 Starting Attendly container server and reverse proxy..."
docker compose up -d

# 5. Wait for Cloudflare Tunnel
echo -n "🌐 Establishing Cloudflare worldwide tunnel..."
CF_URL=""
for i in {1..30}; do
    CF_URL=$(docker exec attendly-app cat /app/.tunnel_url 2>/dev/null || true)
    if [ -n "$CF_URL" ] && [[ "$CF_URL" == https://* ]]; then
        break
    fi
    sleep 2
    echo -n "."
done
echo ""

LOCAL_URL="http://localhost:${LOCAL_PORT}"
TARGET_URL="${CF_URL:-$LOCAL_URL}"

echo ""
echo "================================================================================"
echo "                    ATTENDLY SERVER IS ONLINE AND ACTIVE!                       "
echo "================================================================================"
echo ""
if [ -n "$CF_URL" ] && [[ "$CF_URL" == https://* ]]; then
    echo "  🌐 WORLDWIDE CLOUDFLARE URL:  $CF_URL"
    echo "     -> Anyone anywhere in the world or mobile 4G/5G can connect and scan!"
else
    echo "  ⚠️  Cloudflare Tunnel is initializing in background."
    echo "     Run 'docker compose logs -f' to see connection status."
fi
echo ""
echo "  💻 LOCAL PROXY URL:           $LOCAL_URL"
echo ""
echo "================================================================================"
echo "  -> Opening Attendly application window..."
echo "  -> CLOSING THIS TERMINAL OR PRESSING CTRL+C WILL AUTOMATICALLY STOP DOCKER."
echo "================================================================================"
echo ""

# 6. Launch Browser in App mode or Default browser and wait
APP_PROFILE="/tmp/attendly_desktop_profile"

if [[ "$OSTYPE" == "darwin"* ]]; then
    if [ -d "/Applications/Microsoft Edge.app" ]; then
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" --app="$TARGET_URL" --user-data-dir="$APP_PROFILE" --window-size=1280,820 || true
    elif [ -d "/Applications/Google Chrome.app" ]; then
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --app="$TARGET_URL" --user-data-dir="$APP_PROFILE" --window-size=1280,820 || true
    else
        open "$TARGET_URL"
        read -r -p "Attendly is active. Press [ENTER] or close this window to exit and stop Docker: " _
    fi
else
    if command -v google-chrome >/dev/null 2>&1; then
        google-chrome --app="$TARGET_URL" --user-data-dir="$APP_PROFILE" --window-size=1280,820 || true
    elif command -v microsoft-edge >/dev/null 2>&1; then
        microsoft-edge --app="$TARGET_URL" --user-data-dir="$APP_PROFILE" --window-size=1280,820 || true
    elif command -v chromium >/dev/null 2>&1; then
        chromium --app="$TARGET_URL" --user-data-dir="$APP_PROFILE" --window-size=1280,820 || true
    else
        if command -v xdg-open >/dev/null 2>&1; then
            xdg-open "$TARGET_URL" >/dev/null 2>&1 &
        fi
        read -r -p "Attendly is active. Press [ENTER] or close this window to exit and stop Docker: " _
    fi
fi
