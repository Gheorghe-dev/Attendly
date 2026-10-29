#!/usr/bin/env bash
# ==============================================================================
# Attendly — Automated macOS One-Command Deployment Installer
# ==============================================================================
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"
exec ./install-mac.sh "$@"
