#!/bin/bash

# Unified build script for Clay Terminal
# Builds both frontend and backend together

set -e

echo "🚀 Building Clay Terminal..."
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Build backend
echo -e "${BLUE}📦 Building backend...${NC}"
cd backend
if [ ! -d "node_modules" ]; then
    echo "Installing backend dependencies..."
    npm install
fi
cd ..

# Build frontend
echo -e "${BLUE}🌐 Building frontend...${NC}"
cd web
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi
npm run build
cd ..

# Copy backend files to web dist for deployment
echo -e "${BLUE}📋 Bundling backend with frontend...${NC}"
mkdir -p web/dist/backend
cp -r backend/* web/dist/backend/ 2>/dev/null || true
rm -rf web/dist/backend/node_modules 2>/dev/null || true

# Create startup script in dist
cat > web/dist/start-backend.js << 'EOF'
// Auto-start backend when page loads
// This runs in the browser context
console.log('Clay Terminal: Checking for backend...');

// Check if backend is already running
fetch('http://localhost:3000/api/health')
  .then(() => {
    console.log('Backend already running');
  })
  .catch(() => {
    console.log('Backend not running - starting...');
    // Show instructions to start backend
    const instructions = document.createElement('div');
    instructions.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #1e1e2e;
      border: 2px solid #cba6f7;
      border-radius: 8px;
      padding: 16px;
      color: #cdd6f4;
      font-family: monospace;
      z-index: 10000;
      max-width: 400px;
    `;
    instructions.innerHTML = `
      <h3 style="margin: 0 0 12px 0; color: #cba6f7;">🔧 Start Backend</h3>
      <p style="margin: 0 0 12px 0;">Run this command in your terminal:</p>
      <code style="background: #11111b; padding: 8px; display: block; border-radius: 4px; margin-bottom: 12px;">
        cd backend && npm start
      </code>
      <button onclick="this.parentElement.remove()" style="background: #cba6f7; color: #1e1e2e; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
        Got it
      </button>
    `;
    document.body.appendChild(instructions);
  });
EOF

echo -e "${GREEN}✅ Build complete!${NC}"
echo ""
echo "📁 Output: web/dist/"
echo "🌐 To serve locally: cd web/dist && python3 -m http.server 8080"
echo ""

