#!/usr/bin/env bash
# ==============================================================================
# Attendly — 1-Click macOS Application Installer & Launcher
# Double-click this file in macOS Finder to install Attendly to /Applications
# ==============================================================================

# Ensure standard user paths are available (Homebrew on Apple Silicon & Intel, Node, etc.)
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -n 1)/bin:$PATH"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "========================================================"
echo "          ATTENDLY — 1-CLICK macOS INSTALLER            "
echo "========================================================"
echo ""

# ── 1. Check if pre-built .dmg or .app is present ────────────────────────────
DMG_FILE=""
for f in release/Attendly*.dmg Attendly*.dmg "$DIR"/Attendly*.dmg "$DIR"/release/Attendly*.dmg; do
    if [ -f "$f" ]; then
        DMG_FILE="$f"
        break
    fi
done

if [ -n "$DMG_FILE" ]; then
    echo "📦 Detected pre-built standalone installer: $DMG_FILE"
    echo "🚀 Installing Attendly to /Applications..."
    
    MOUNT_DIR=$(mktemp -d /tmp/attendly_mount.XXXXXX)
    hdiutil attach "$DMG_FILE" -mountpoint "$MOUNT_DIR" -nobrowse -quiet
    
    if [ -d "$MOUNT_DIR/Attendly.app" ]; then
        rm -rf "/Applications/Attendly.app"
        cp -R "$MOUNT_DIR/Attendly.app" "/Applications/Attendly.app"
    fi
    hdiutil detach "$MOUNT_DIR" -quiet || true
    rm -rf "$MOUNT_DIR"

    if [ -d "/Applications/Attendly.app" ]; then
        xattr -cr "/Applications/Attendly.app" 2>/dev/null || true
        chmod -R +x "/Applications/Attendly.app/Contents/MacOS" 2>/dev/null || true
        echo ""
        echo "========================================================"
        echo "🎉 SUCCESS: Attendly is now installed in /Applications!"
        echo "========================================================"
        echo "Launching Attendly..."
        open "/Applications/Attendly.app"
        exit 0
    fi
fi

# Check if pre-packaged Attendly.app exists in release directory
APP_BUNDLE=""
for candidate in release/mac*/Attendly.app release/Attendly.app "$DIR"/Attendly.app; do
    if [ -d "$candidate" ]; then
        APP_BUNDLE="$candidate"
        break
    fi
done

if [ -n "$APP_BUNDLE" ]; then
    echo "📦 Found pre-packaged application: $APP_BUNDLE"
    echo "🚀 Installing Attendly to /Applications..."
    rm -rf "/Applications/Attendly.app"
    cp -R "$APP_BUNDLE" "/Applications/Attendly.app"
    xattr -cr "/Applications/Attendly.app" 2>/dev/null || true
    chmod -R +x "/Applications/Attendly.app/Contents/MacOS" 2>/dev/null || true
    echo ""
    echo "========================================================"
    echo "🎉 SUCCESS: Attendly is now installed in /Applications!"
    echo "========================================================"
    echo "Launching Attendly..."
    open "/Applications/Attendly.app"
    exit 0
fi

# ── 2. Source-build installation mode ────────────────────────────────────────
echo "ℹ️ Pre-built bundle not found. Building and installing from source..."
echo ""

# Verify Node.js runtime
if ! command -v node >/dev/null 2>&1; then
    echo "[!] Node.js runtime not detected."
    if command -v brew >/dev/null 2>&1; then
        echo "[*] Installing Node.js LTS via Homebrew..."
        brew install node
    fi
    if ! command -v node >/dev/null 2>&1; then
        echo "❌ Node.js is required to build and install Attendly on this Mac."
        echo "👉 Opening Node.js LTS download page in your browser..."
        open "https://nodejs.org/" 2>/dev/null || true
        echo ""
        echo "Please install Node.js from https://nodejs.org/ and run this file again."
        echo ""
        echo "Press any key to exit..."
        read -n 1
        exit 1
    fi
fi

echo "✅ Detected Node.js $(node -v)"
echo ""

# Configure .env file
if [ ! -f ".env" ]; then
    echo "⚙️ [1/6] Configuring environment settings..."
    cp .env.example .env
else
    echo "✅ [1/6] Environment (.env) ready."
fi

# Install dependencies
if [ ! -d "node_modules" ]; then
    echo "📦 [2/6] Installing dependencies (first run only)..."
    npm install
else
    echo "✅ [2/6] Dependencies already installed."
fi

# Initialize database
if [ ! -f "prisma/dev.db" ]; then
    echo "🗄️ [3/6] Setting up local SQLite database..."
    if [ -f "prisma/template.db" ]; then
        cp prisma/template.db prisma/dev.db
    else
        npx prisma db push --skip-generate
    fi
else
    echo "✅ [3/6] Database ready."
fi
npx prisma generate

# Download Cloudflare tunnel binary for Mac architecture if missing
ARCH=$(uname -m)
if [ ! -f "bin/cloudflared" ]; then
    echo "🌐 [4/6] Downloading Cloudflare Worldwide Tunnel binary ($ARCH)..."
    mkdir -p bin
    CLOUDFLARED_ARCH="amd64"
    if [ "$ARCH" = "arm64" ]; then
        CLOUDFLARED_ARCH="arm64"
    fi
    curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-${CLOUDFLARED_ARCH}.tgz" -o /tmp/cloudflared.tgz 2>/dev/null || true
    if [ -f "/tmp/cloudflared.tgz" ]; then
        tar -xzf /tmp/cloudflared.tgz -C bin/ 2>/dev/null || true
        rm -f /tmp/cloudflared.tgz
        chmod +x bin/cloudflared 2>/dev/null || true
        echo "✅ Bundled Cloudflare tunnel binary for $ARCH."
    fi
else
    echo "✅ [4/6] Cloudflare tunnel binary ready."
    chmod +x bin/cloudflared 2>/dev/null || true
fi

# Build Next.js standalone package
echo "⚡ [5/6] Compiling standalone production build..."
npm run desktop:package

# Build native macOS DMG & App bundle
echo "📦 [6/6] Packaging native macOS installer (.dmg)..."
npx electron-builder --mac dmg --publish never

# Install to /Applications
APP_BUNDLE=""
for candidate in release/mac*/Attendly.app release/Attendly.app; do
    if [ -d "$candidate" ]; then
        APP_BUNDLE="$candidate"
        break
    fi
done

if [ -n "$APP_BUNDLE" ]; then
    rm -rf "/Applications/Attendly.app"
    cp -R "$APP_BUNDLE" "/Applications/Attendly.app"
    xattr -cr "/Applications/Attendly.app" 2>/dev/null || true
    chmod -R +x "/Applications/Attendly.app/Contents/MacOS" 2>/dev/null || true
    echo ""
    echo "========================================================"
    echo "🎉 SUCCESS: Attendly is now installed in /Applications!"
    echo "========================================================"
    DMG_RESULT=$(ls release/*.dmg 2>/dev/null | head -n 1)
    if [ -n "$DMG_RESULT" ]; then
        echo "📦 Standalone .dmg installer created at: $DMG_RESULT"
    fi
    echo "Launching Attendly..."
    open "/Applications/Attendly.app"
else
    echo "⚠️ Starting via Electron runtime..."
    npx electron .
fi
