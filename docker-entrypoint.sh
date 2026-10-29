#!/bin/sh
set -e

# ==============================================================================
# Attendly — Docker Container Entrypoint
# Initializes SQLite database, synchronizes schema, and manages Cloudflare Tunnel
# ==============================================================================

mkdir -p /app/prisma

# 1. Database Initialization
# If persistent dev.db does not exist yet, copy pre-seeded template.db
if [ ! -f "/app/prisma/dev.db" ]; then
    if [ -f "/app/prisma/template.db" ]; then
        echo "[Attendly] Initializing SQLite database from pre-seeded template..."
        cp /app/prisma/template.db /app/prisma/dev.db
    fi
fi

# Synchronize database schema safely
echo "[Attendly] Synchronizing database schema..."
if command -v npx >/dev/null 2>&1; then
    npx prisma db push --skip-generate 2>/dev/null || true
fi

# 2. Cloudflare Tunnel Daemon (Background)
# Automatically exposes this container to a secure public URL (https://*.trycloudflare.com)
if [ "${CLOUDFLARE_TUNNEL_ACTIVE:-true}" = "true" ] && command -v cloudflared >/dev/null 2>&1; then
    echo "[Attendly] Launching background Cloudflare Tunnel monitor..."
    (
        TARGET_PORT="${PORT:-3000}"
        
        # Wait for Next.js to start and be responsive
        echo "[Attendly Tunnel] Waiting for Next.js web application on port ${TARGET_PORT}..."
        count=0
        while [ $count -lt 60 ]; do
            if curl -fs "http://127.0.0.1:${TARGET_PORT}/api/health" >/dev/null 2>&1; then
                break
            fi
            sleep 1
            count=$((count + 1))
        done

        echo "[Attendly Tunnel] Web app is active. Initializing Cloudflare Tunnel connection..."
        rm -f /tmp/cloudflared.log /app/.tunnel_url /tmp/.attendly_tunnel

        if [ -n "$CLOUDFLARE_TUNNEL_TOKEN" ]; then
            echo "[Attendly Tunnel] Starting named Cloudflare Tunnel with provided token..."
            cloudflared tunnel run --token "$CLOUDFLARE_TUNNEL_TOKEN" > /tmp/cloudflared.log 2>&1 &
        else
            echo "[Attendly Tunnel] Starting zero-config Cloudflare Quick Tunnel..."
            cloudflared tunnel --url "http://127.0.0.1:${TARGET_PORT}" --no-autoupdate --protocol http2 > /tmp/cloudflared.log 2>&1 &
        fi

        TUNNEL_PID=$!

        # Monitor cloudflared output for the trycloudflare.com URL
        TUNNEL_URL=""
        log_wait=0
        while [ $log_wait -lt 60 ]; do
            if [ -f /tmp/cloudflared.log ]; then
                TUNNEL_URL=$(grep -o 'https://[a-zA-Z0-9.-]*\.trycloudflare\.com' /tmp/cloudflared.log | head -n 1)
                if [ -n "$TUNNEL_URL" ]; then
                    break
                fi
            fi
            sleep 1
            log_wait=$((log_wait + 1))
        done

        if [ -n "$TUNNEL_URL" ]; then
            echo "================================================================="
            echo "[Attendly Tunnel] CLOUDFLARE TUNNEL ONLINE!"
            echo "[Attendly Tunnel] Public URL: $TUNNEL_URL"
            echo "[Attendly Tunnel] Accessible worldwide on any Wi-Fi or mobile network"
            echo "================================================================="
            echo "$TUNNEL_URL" > /app/.tunnel_url
            echo "$TUNNEL_URL" > /tmp/.attendly_tunnel
            chmod 666 /app/.tunnel_url 2>/dev/null || true
            chmod 666 /tmp/.attendly_tunnel 2>/dev/null || true

            # Inform running Next.js app via internal POST endpoint
            curl -s -X POST "http://127.0.0.1:${TARGET_PORT}/api/tunnel" \
                 -H "Content-Type: application/json" \
                 -d "{\"url\": \"$TUNNEL_URL\"}" >/dev/null 2>&1 || true
        else
            echo "[Attendly Tunnel] Note: Tunnel running in token/named mode or still negotiating with edge."
        fi

        # Keep daemon alive to monitor cloudflared
        while kill -0 "$TUNNEL_PID" 2>/dev/null; do
            sleep 10
        done
        echo "[Attendly Tunnel] Warning: Cloudflare tunnel process terminated."
    ) &
fi

echo "[Attendly] Starting application server on port ${PORT:-3000}..."
exec "$@"
