#!/bin/sh
set -e

echo "========================================================"
echo "          ATTENDLY — DOCKER CONTAINER STARTUP           "
echo "========================================================"

# 1. Initialize persistent SQLite database
mkdir -p /app/prisma
if [ ! -f "/app/prisma/dev.db" ]; then
    echo "🗄️ [Setup] Initializing SQLite database..."
    if [ -f "/app/prisma/template.db" ]; then
        cp /app/prisma/template.db /app/prisma/dev.db
        echo "✅ [Setup] Initialized database from pre-configured template."
    fi
fi

# 2. Synchronize database schema safely
echo "🔄 [Setup] Synchronizing database schema..."
if command -v npx >/dev/null 2>&1; then
    npx prisma db push --skip-generate 2>/dev/null || true
fi

# 3. Ensure installer downloads directory is populated
mkdir -p /var/www/downloads
if [ -d "/app/release" ] && [ "$(ls -A /app/release 2>/dev/null)" ]; then
    echo "📦 [Setup] Synchronizing installer files to download portal..."
    cp -rn /app/release/* /var/www/downloads/ 2>/dev/null || true
fi

# 4. Start Nginx reverse proxy daemon if available
if command -v nginx >/dev/null 2>&1; then
    echo "🌐 [Setup] Starting Nginx reverse proxy on port 80..."
    nginx 2>/dev/null || nginx -s reload 2>/dev/null || true
fi

echo "🚀 [Setup] Launching Attendly server..."
exec "$@"
