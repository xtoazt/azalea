#!/bin/bash

# Clay Terminal Unified Startup Script
# Builds everything and starts the backend

set -e

echo "🚀 Starting Clay Terminal..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Build everything if needed
if [ "$1" != "--no-build" ]; then
    echo "📦 Building all components..."
    ./build-all.sh
fi

# Start backend server
echo ""
echo "📡 Starting backend server..."
cd backend
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
fi

# Start backend
echo "✅ Backend starting on http://localhost:3000"
echo "🌐 Open http://localhost:3000 in your browser"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm start

