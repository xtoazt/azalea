#!/bin/bash

# Clay Terminal Startup Script
# Starts both backend and frontend servers

echo "🚀 Starting Clay Terminal..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Start backend server
echo "📡 Starting backend server..."
cd backend
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
fi

# Start backend in background
npm start &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 2

# Start frontend (if needed)
if [ "$1" = "--dev" ]; then
    echo "🌐 Starting frontend dev server..."
    cd web
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing frontend dependencies..."
        npm install
    fi
    npm run dev
    cd ..
else
    echo "✅ Backend server running on http://localhost:3000"
    echo "📝 Access the terminal at http://localhost:3000"
    echo ""
    echo "Press Ctrl+C to stop the server"
    
    # Wait for Ctrl+C
    trap "kill $BACKEND_PID" EXIT
    wait $BACKEND_PID
fi

