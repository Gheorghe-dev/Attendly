#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
echo "🛑 Stopping Attendly containers..."
docker compose down
echo "✅ Attendly container server stopped. All data is preserved in Docker volume."
