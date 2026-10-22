#!/usr/bin/env bash
# ==============================================================================
# Attendly — Unix / macOS / Linux Process Stopper
# Gracefully terminates server and any orphaned Cloudflare tunnels.
# ==============================================================================

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "Stopping Attendly server and worldwide tunnels..."

# Free TCP port 3000
if command -v lsof >/dev/null 2>&1; then
    PIDS=$(lsof -ti:3000 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
        echo "Terminating process on port 3000 ($PIDS)..."
        kill -9 $PIDS 2>/dev/null || true
    fi
elif command -v fuser >/dev/null 2>&1; then
    fuser -k 3000/tcp 2>/dev/null || true
fi

# Terminate any orphaned cloudflared tunnels
killall cloudflared 2>/dev/null || true
rm -f .tunnel_url 2>/dev/null || true

echo "✓ Attendly server stopped successfully."
