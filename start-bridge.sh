#!/bin/bash

# Start Clay Terminal Bridge
# This script starts the bridge server that enables real system access
# Run this to enable real system command execution and filesystem access

set -e

echo "🚀 Starting Clay Terminal Bridge..."
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRIDGE_DIR="$SCRIPT_DIR/bridge"

cd "$BRIDGE_DIR"

if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "✅ Starting bridge server on http://127.0.0.1:8765"
echo "🌐 The web terminal will automatically connect to this bridge"
echo ""
echo "✨ Features enabled:"
echo "   ✅ Real system command execution"
echo "   ✅ Real filesystem access"
echo "   ✅ Full bash support"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm start

