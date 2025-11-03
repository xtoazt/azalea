# Clay Terminal Bridge

Local Node.js server that provides **real system command execution** and **filesystem access** to the Clay Terminal web interface.

## Features

- ✅ **Real System Commands** - Execute any command on your system via `child_process`
- ✅ **Real Filesystem** - Access your actual files and directories
- ✅ **Full Bash Support** - All bash commands work, not just a limited set
- ✅ **WebSocket Connection** - Real-time terminal I/O
- ✅ **Auto-start Support** - Can be installed as a system service

## Quick Start

### 1. Install Dependencies

```bash
cd bridge
npm install
```

### 2. Start the Bridge

```bash
npm start
```

The bridge will start on `http://127.0.0.1:8765`

### 3. Use in Clay Terminal

The web terminal will automatically detect and connect to the bridge when you open it. If the bridge is running, you'll get:
- ✅ Real system command execution
- ✅ Real filesystem access
- ✅ Full bash support

If the bridge is not running, the terminal falls back to Web Worker mode (browser-only, limited commands).

## Auto-Start Installation

To make the bridge start automatically when your system boots:

```bash
npm run install-service
```

This will:
- **macOS**: Create a LaunchAgent
- **Linux**: Create a systemd service (requires sudo)
- **Windows**: Provide instructions for Task Scheduler

## Manual Start

If you prefer to start manually each time:

```bash
cd bridge
node bridge.js
```

## Configuration

Set environment variables:
- `PORT`: Server port (default: 8765)
- `HOST`: Server host (default: 127.0.0.1)

Example:
```bash
PORT=9000 HOST=0.0.0.0 npm start
```

## Security

⚠️ **Important**: The bridge executes commands on your system with your user privileges. Only run this on trusted networks or localhost (default).

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/info` - System information
- `POST /api/execute` - Execute a command
- `GET /api/fs/read` - Read file/directory
- `POST /api/fs/write` - Write file
- `GET /api/fs/stat` - File statistics
- `WS /ws` - WebSocket terminal connection

## Troubleshooting

### Bridge not connecting

1. Check if bridge is running:
   ```bash
   curl http://127.0.0.1:8765/api/health
   ```

2. Check firewall settings - port 8765 must be accessible

3. For ChromeOS: Make sure Linux (Beta) is enabled and the bridge is running in the Linux container

### Permission Errors

If you get permission errors:
- Make sure Node.js has proper permissions
- The bridge directory is writable
- Port 8765 is not in use by another application

## How It Works

1. Bridge server runs locally on your machine
2. Web terminal connects via WebSocket (ws://127.0.0.1:8765/ws)
3. Commands execute via `child_process` in Node.js
4. Filesystem operations use Node.js `fs` module
5. All operations use your user's permissions

This gives you **full system access** from the browser terminal!

