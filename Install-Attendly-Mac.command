#!/usr/bin/env bash
# ==============================================================================
# Attendly — 1-Click macOS Application Installer
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

# 1. Verify Node.js runtime
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

echo "✅ Detected Node.js $(node -v)"
echo ""

# 2. Configure .env file
if [ ! -f ".env" ]; then
    echo "⚙️ [1/5] Configuring environment settings..."
    cp .env.example .env
else
    echo "✅ [1/5] Environment (.env) ready."
fi

# 3. Install dependencies
if [ ! -d "node_modules" ]; then
    echo "📦 [2/5] Installing dependencies (first run only)..."
    npm install
else
    echo "✅ [2/5] Dependencies already installed."
fi

# 4. Initialize database
if [ ! -f "prisma/dev.db" ]; then
    echo "🗄️ [3/5] Setting up local SQLite database..."
    if [ -f "prisma/template.db" ]; then
        cp prisma/template.db prisma/dev.db
    else
        npx prisma db push
    fi
else
    echo "✅ [3/5] Database ready."
fi
npx prisma generate

# 5. Build application & package for macOS
echo "⚡ [4/5] Compiling and packaging Attendly for macOS..."
npm run desktop:package

# Build the macOS .dmg installer and .app bundle
echo "📦 Building macOS .dmg installer and native application..."
npx electron-builder --mac dmg dir --publish never

# 6. Install to /Applications
echo "🚀 [5/5] Installing Attendly to /Applications..."
APP_BUNDLE=""
if [ -d "release/mac/Attendly.app" ]; then
    APP_BUNDLE="release/mac/Attendly.app"
elif [ -d "release/mac-arm64/Attendly.app" ]; then
    APP_BUNDLE="release/mac-arm64/Attendly.app"
elif [ -d "release/mac-universal/Attendly.app" ]; then
    APP_BUNDLE="release/mac-universal/Attendly.app"
fi

if [ -n "$APP_BUNDLE" ]; then
    rm -rf "/Applications/Attendly.app"
    cp -R "$APP_BUNDLE" "/Applications/Attendly.app"
    xattr -cr "/Applications/Attendly.app" 2>/dev/null || true
    chmod -R +x "/Applications/Attendly.app/Contents/MacOS" 2>/dev/null || true
    echo ""
    echo "========================================================"
    echo "🎉 SUCCESS: Attendly is now installed in /Applications!"
    echo "========================================================"
    DMG_FILE=$(ls release/*.dmg 2>/dev/null | head -n 1)
    if [ -n "$DMG_FILE" ]; then
        echo "📦 Standalone .dmg installer created at: $DMG_FILE"
    fi
    echo "Launching Attendly..."
    open "/Applications/Attendly.app"
else
    echo "⚠️ App bundle was not found in release folder. Starting via Electron runtime..."
    npx electron .
fi
