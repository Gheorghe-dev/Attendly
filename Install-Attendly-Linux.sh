#!/usr/bin/env bash
# ==============================================================================
# Attendly — 1-Click Linux Application Installer & Launcher
# ==============================================================================
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "========================================================"
echo "          ATTENDLY — 1-CLICK LINUX INSTALLER            "
echo "========================================================"
echo ""

# 1. Check for pre-built AppImage
APPIMAGE=""
for candidate in release/Attendly*.AppImage Attendly*.AppImage "$DIR"/release/Attendly*.AppImage "$DIR"/Attendly*.AppImage; do
    if [ -f "$candidate" ]; then
        APPIMAGE="$candidate"
        break
    fi
done

if [ -n "$APPIMAGE" ]; then
    echo "📦 Detected pre-built AppImage: $APPIMAGE"
    chmod +x "$APPIMAGE"

    # Install desktop entry
    node scripts/create-shortcuts.js 2>/dev/null || true

    echo "🚀 Launching Attendly..."
    "$APPIMAGE" --no-sandbox "$@" &
    exit 0
fi

# 2. Check for pre-built Debian package (.deb)
DEB_PKG=""
for candidate in release/attendly*.deb attendly*.deb "$DIR"/release/attendly*.deb "$DIR"/attendly*.deb; do
    if [ -f "$candidate" ]; then
        DEB_PKG="$candidate"
        break
    fi
done

if [ -n "$DEB_PKG" ]; then
    echo "📦 Detected Debian package: $DEB_PKG"
    if command -v dpkg >/dev/null 2>&1; then
        echo "🚀 Installing via dpkg..."
        sudo dpkg -i "$DEB_PKG" || sudo apt-get install -f -y
        node scripts/create-shortcuts.js 2>/dev/null || true
        echo "Launching Attendly..."
        attendly &
        exit 0
    fi
fi

# 3. Source installation mode
echo "ℹ️ Configuring Attendly from source on this computer..."

if ! command -v node >/dev/null 2>&1; then
    echo "❌ Node.js runtime is required. Please install Node.js (v18+) via your package manager."
    exit 1
fi

if [ ! -f ".env" ]; then
    cp .env.example .env 2>/dev/null || true
fi

if [ ! -d "node_modules" ]; then
    npm install --no-audit
fi

if [ ! -f "prisma/dev.db" ]; then
    if [ -f "prisma/template.db" ]; then
        cp prisma/template.db prisma/dev.db
    else
        npx prisma db push --skip-generate
    fi
fi
npx prisma generate

if [ ! -f "bin/cloudflared" ]; then
    mkdir -p bin
    curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o bin/cloudflared 2>/dev/null || true
    chmod +x bin/cloudflared 2>/dev/null || true
fi

if [ ! -f ".next/BUILD_ID" ]; then
    npm run build
fi

node scripts/create-shortcuts.js 2>/dev/null || true

echo "🎉 Attendly configured! Starting application..."
if command -v electron >/dev/null 2>&1 || [ -f "node_modules/.bin/electron" ]; then
    npx electron .
else
    node scripts/start-internet.js
fi
