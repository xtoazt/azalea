# Clay Terminal Bridge - Real System Access

The bridge server provides **real system command execution** and **real filesystem access** to the Clay Terminal web interface.

## What It Does

The bridge server:
- ✅ **Executes real system commands** via Node.js `child_process` and `node-pty`
- ✅ **Accesses your real filesystem** via Node.js `fs` module
- ✅ **Supports ALL bash commands** - not just a limited set
- ✅ **Runs locally** on your machine (localhost:8765)
- ✅ **Auto-connects** when the web terminal opens

## Quick Start

```bash
# Start the bridge
./start-bridge.sh

# Or manually:
cd bridge
npm install
npm start
```

The bridge will start on `http://127.0.0.1:8765`

## How It Works

1. **Bridge server runs** on your local machine
2. **Web terminal connects** via WebSocket (ws://127.0.0.1:8765/ws)
3. **Commands execute** on your system with your user permissions
4. **Filesystem access** uses your actual files and directories
5. **Full bash support** - all commands work!

## Auto-Start Installation

To make the bridge start automatically when your system boots:

```bash
cd bridge
npm run install-service
```

This creates:
- **macOS**: LaunchAgent (starts on login)
- **Linux**: systemd service (starts on boot)
- **Windows**: Instructions for Task Scheduler

## Features

### Real System Commands
- Execute any command that works in your terminal
- Full bash/zsh support
- Interactive programs (vim, nano, htop, python REPL, etc.)
- Proper ANSI color support
- Terminal resizing

### Real Filesystem
- Access your actual files and directories
- Read/write files
- Create/delete directories
- All file operations work

### Automatic Detection
- Web terminal automatically detects if bridge is running
- Falls back to Web Worker mode if bridge unavailable
- Seamless switching between modes

## Security

⚠️ **Important**: The bridge executes commands with your user privileges. Only run on localhost (default) or trusted networks.

## Troubleshooting

### Bridge not connecting

1. Check if bridge is running:
   ```bash
   curl http://127.0.0.1:8765/api/health
   ```

2. Check firewall - port 8765 must be accessible

3. On ChromeOS: Make sure bridge runs in Linux container

### Commands not working

- Make sure bridge is running (check terminal output)
- Verify WebSocket connection in browser console
- Check bridge logs for errors

## API Reference

### WebSocket (`ws://127.0.0.1:8765/ws`)
- Real-time terminal I/O
- Supports interactive programs
- Terminal resizing

### REST API
- `POST /api/execute` - Execute command
- `GET /api/fs/read` - Read file/directory
- `POST /api/fs/write` - Write file
- `GET /api/fs/stat` - File statistics
- `GET /api/info` - System information
- `GET /api/health` - Health check

## Example Usage

With bridge running:
```bash
# All these work for real!
ls -la
cd ~/Documents
cat file.txt
python script.py
npm install
git status
vim file.txt  # Interactive editor works!
```

Without bridge (fallback):
- Limited command set
- Virtual filesystem
- Browser-only execution

