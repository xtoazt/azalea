# Clay Terminal Backend

Real terminal backend server for Clay Terminal. This connects the web terminal to your ChromeOS system, allowing execution of real shell commands.

## Features

- **Real Terminal Execution**: Uses `node-pty` for authentic terminal emulation
- **WebSocket Support**: Real-time bidirectional communication
- **REST API**: Fallback API for command execution
- **Cross-Platform**: Works on Linux, macOS, Windows, and ChromeOS

## Installation

```bash
cd backend
npm install
```

## Running

### Development Mode (with auto-reload)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on `http://localhost:3000` by default.

## Configuration

Set environment variables:
- `PORT`: Server port (default: 3000)

## Endpoints

### WebSocket
- `ws://localhost:3000/ws` - Terminal connection

### REST API
- `POST /api/execute` - Execute a command
- `GET /api/info` - Get system information
- `GET /api/health` - Health check

## Security Note

⚠️ **Warning**: This backend executes commands on your system with your user privileges. Only run this on trusted networks or localhost.

## ChromeOS Setup

1. Enable Linux (Beta) in ChromeOS settings
2. Install Node.js in the Linux container:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
3. Navigate to the backend directory and install:
   ```bash
   cd /path/to/clay/backend
   npm install
   npm start
   ```
4. Access the terminal at `http://localhost:3000` or `http://penguin.linux.test:3000`

