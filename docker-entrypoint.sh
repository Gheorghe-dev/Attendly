#!/bin/sh
set -e

# Automatically apply database schema to persistent SQLite database
echo "[Attendly Docker] Synchronizing SQLite database..."
npx prisma db push --skip-generate

exec "$@"
