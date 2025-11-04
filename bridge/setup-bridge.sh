#!/bin/bash
# Clay Terminal Bridge - Automatic Setup Script
# This script installs and configures the bridge server for ChromeOS

set -e

echo "🔧 Clay Terminal Bridge - Automatic Setup"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRIDGE_DIR="$SCRIPT_DIR"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install Node.js
install_nodejs() {
    echo -e "${YELLOW}📦 Installing Node.js...${NC}"
    
    if command_exists apt-get; then
        # Debian/Ubuntu/ChromeOS Linux
        sudo apt-get update
        sudo apt-get install -y curl
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif command_exists yum; then
        # RHEL/CentOS
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
        sudo yum install -y nodejs
    else
        echo -e "${RED}❌ Cannot install Node.js automatically. Please install manually.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Node.js installed${NC}"
}

# Function to check and install dependencies
check_dependencies() {
    echo -e "${YELLOW}🔍 Checking dependencies...${NC}"
    
    # Check Node.js
    if ! command_exists node; then
        echo -e "${YELLOW}Node.js not found. Installing...${NC}"
        install_nodejs
    else
        echo -e "${GREEN}✅ Node.js found: $(node --version)${NC}"
    fi
    
    # Check npm
    if ! command_exists npm; then
        echo -e "${YELLOW}npm not found. Installing...${NC}"
        if command_exists apt-get; then
            sudo apt-get install -y npm
        fi
    else
        echo -e "${GREEN}✅ npm found: $(npm --version)${NC}"
    fi
}

# Function to install bridge dependencies
install_bridge_deps() {
    echo -e "${YELLOW}📦 Installing bridge dependencies...${NC}"
    cd "$BRIDGE_DIR"
    
    if [ ! -f "package.json" ]; then
        echo -e "${RED}❌ package.json not found in bridge directory${NC}"
        exit 1
    fi
    
    npm install
    echo -e "${GREEN}✅ Dependencies installed${NC}"
}

# Function to create startup script
create_startup_script() {
    echo -e "${YELLOW}📝 Creating startup script...${NC}"
    
    local startup_script="$HOME/.local/bin/clay-bridge-start"
    mkdir -p "$HOME/.local/bin"
    
    cat > "$startup_script" << 'EOF'
#!/bin/bash
# Clay Terminal Bridge Startup Script

BRIDGE_DIR="$HOME/clay/bridge"
if [ ! -d "$BRIDGE_DIR" ]; then
    BRIDGE_DIR="/home/$(whoami)/clay/bridge"
fi

if [ -d "$BRIDGE_DIR" ]; then
    cd "$BRIDGE_DIR"
    nohup npm start > /tmp/clay-bridge.log 2>&1 &
    echo $! > /tmp/clay-bridge.pid
fi
EOF

    chmod +x "$startup_script"
    echo -e "${GREEN}✅ Startup script created: $startup_script${NC}"
    
    # Add to PATH if not already there
    if ! echo "$PATH" | grep -q "$HOME/.local/bin"; then
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
        export PATH="$HOME/.local/bin:$PATH"
    fi
}

# Function to install as systemd user service
install_systemd_service() {
    echo -e "${YELLOW}📝 Installing systemd user service...${NC}"
    
    local service_dir="$HOME/.config/systemd/user"
    mkdir -p "$service_dir"
    
    local node_path=$(which node)
    local bridge_path="$BRIDGE_DIR/bridge.js"
    
    cat > "$service_dir/clay-bridge.service" << EOF
[Unit]
Description=Clay Terminal Bridge
After=network.target

[Service]
Type=simple
WorkingDirectory=$BRIDGE_DIR
ExecStart=$node_path $bridge_path
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
EOF

    systemctl --user daemon-reload
    systemctl --user enable clay-bridge.service
    
    echo -e "${GREEN}✅ Systemd service installed${NC}"
    echo -e "${YELLOW}💡 To start now: systemctl --user start clay-bridge${NC}"
}

# Function to start bridge
start_bridge() {
    echo -e "${YELLOW}🚀 Starting bridge server...${NC}"
    
    cd "$BRIDGE_DIR"
    
    # Check if already running
    if pgrep -f "node.*bridge.js" > /dev/null; then
        echo -e "${YELLOW}⚠️  Bridge already running${NC}"
        return
    fi
    
    # Start bridge
    nohup npm start > /tmp/clay-bridge.log 2>&1 &
    local pid=$!
    echo $pid > /tmp/clay-bridge.pid
    
    # Wait a moment and check
    sleep 2
    
    if pgrep -P $pid > /dev/null || curl -s http://127.0.0.1:8765/api/health > /dev/null; then
        echo -e "${GREEN}✅ Bridge started successfully (PID: $pid)${NC}"
        echo -e "${GREEN}📡 Listening on http://127.0.0.1:8765${NC}"
    else
        echo -e "${RED}❌ Bridge failed to start. Check logs: cat /tmp/clay-bridge.log${NC}"
        exit 1
    fi
}

# Main setup
main() {
    echo "Starting setup..."
    echo ""
    
    # Check dependencies
    check_dependencies
    
    # Install bridge dependencies
    install_bridge_deps
    
    # Create startup script
    create_startup_script
    
    # Try to install systemd service (may fail, that's okay)
    if systemctl --user list-units > /dev/null 2>&1; then
        install_systemd_service || echo -e "${YELLOW}⚠️  Could not install systemd service (may require manual setup)${NC}"
    fi
    
    # Start bridge
    start_bridge
    
    echo ""
    echo -e "${GREEN}✅ Setup complete!${NC}"
    echo -e "${GREEN}📡 Bridge is running on http://127.0.0.1:8765${NC}"
    echo ""
    echo -e "${YELLOW}💡 To view logs: cat /tmp/clay-bridge.log${NC}"
    echo -e "${YELLOW}💡 To stop: pkill -f 'node.*bridge.js'${NC}"
    echo -e "${YELLOW}💡 To restart: systemctl --user restart clay-bridge${NC}"
}

# Run main
main

