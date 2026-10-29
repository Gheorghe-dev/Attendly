#!/bin/sh
set -e

# ==============================================================================
# Attendly — Docker Container Entrypoint
# Initializes SQLite database from template on first run & pushes schema
# ==============================================================================

mkdir -p /app/prisma

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

echo "[Attendly] Starting application server on port ${PORT:-3000}..."
exec "$@"
