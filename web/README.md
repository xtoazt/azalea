# Clay Terminal - Web Version

A powerful web-based terminal using WebVM for in-browser Linux environment. Installable as a PWA on Chromebooks.

## Features

- 🖥️ **Full Terminal Experience** - Real shell access via WebVM
- ⚡ **AI Assistant** - Built-in AI with `@ai` command
- 📦 **PWA Support** - Installable on Chromebooks
- 🎨 **Catppuccin Theme** - Beautiful pastel colors
- 🔄 **Real-time** - WebSocket-based communication
- 📜 **Command History** - Arrow key navigation
- 🌐 **WebVM Integration** - Runs Linux environment in browser

## Development

```bash
cd web
npm install
npm run dev
```

## Build

```bash
npm run build
```

## PWA Installation

On Chromebook:
1. Open the terminal in Chrome
2. Click the install button in the address bar
3. Or use the "Install" button in the app

## Architecture

- **Frontend**: xterm.js for terminal emulation
- **Backend**: WebVM running Node.js + Socket.io
- **Communication**: WebSocket for real-time terminal I/O
- **AI**: LLM API integration for assistant features

