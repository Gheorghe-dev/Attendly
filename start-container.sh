#!/usr/bin/env bash
# ==============================================================================
# Attendly — 1-Click Container Launcher with Cloudflare Tunnel (macOS & Linux)
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

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

# 4. Start Docker Compose
echo "🚀 Starting Attendly container server and reverse proxy..."
docker compose up -d --build

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
echo "  💻 LOCAL PROXY URL:           http://localhost"
echo ""
echo "================================================================================"
echo "Useful Commands:"
echo "  - View live logs:     docker compose logs -f"
echo "  - Stop container:     docker compose down"
echo "  - Rebuild container:  docker compose up -d --build"
echo "================================================================================"
echo ""

# 6. Open Browser
TARGET_URL="${CF_URL:-http://localhost}"
if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$TARGET_URL" >/dev/null 2>&1 &
elif command -v open >/dev/null 2>&1; then
    open "$TARGET_URL" >/dev/null 2>&1 &
fi
