#!/usr/bin/env bash
# ==============================================================================
# Attendly — Unix / macOS / Linux All-In-One Launcher
# Automatically initializes environment, installs dependencies, verifies SQLite,
# checks production build, and launches the server + worldwide mobile tunnel.
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "========================================================"
echo "          ATTENDLY — ACADEMIC ATTENDANCE SYSTEM         "
echo "========================================================"
echo ""

# 1. Verify Node.js presence
if ! command -v node >/dev/null 2>&1; then
    echo "❌ Error: Node.js is required but not installed."
    echo "👉 Please install Node.js (v18 or higher) from https://nodejs.org/"
    exit 1
fi

NODE_MAJOR=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo "⚠️ Warning: Node.js 18+ is recommended (found $(node -v))."
fi

# 2. Initialize environment configuration if missing
if [ ! -f ".env" ]; then
    echo "⚙️ [1/4] Initializing .env configuration from .env.example..."
    cp .env.example .env
    RANDOM_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" 2>/dev/null || openssl rand -base64 32 || echo "secret-$(date +%s)")
    if [ "$(uname)" = "Darwin" ]; then
        sed -i '' "s/change-this-to-a-secure-random-32-byte-string/$RANDOM_SECRET/g" .env
    else
        sed -i "s/change-this-to-a-secure-random-32-byte-string/$RANDOM_SECRET/g" .env
    fi
fi

# 3. Install dependencies if node_modules is missing
if [ ! -d "node_modules" ]; then
    echo "📦 [2/4] Installing application dependencies..."
    npm install
fi

# 4. Synchronize SQLite database schema
if [ ! -f "prisma/dev.db" ]; then
    echo "🗄️ [3/4] Initializing local database schema..."
    if [ -f "prisma/template.db" ]; then
        cp prisma/template.db prisma/dev.db
    else
        npx prisma db push
    fi
fi
npx prisma generate

# 5. Compile production build if missing
if [ ! -f ".next/BUILD_ID" ]; then
    echo "⚡ [4/4] Generating optimized production build..."
    npm run build
fi

echo ""
echo "🚀 Starting Attendly server and worldwide mobile tunnel..."
node scripts/start-internet.js
