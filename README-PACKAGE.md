# Clay Terminal - NPM Package 📦

A beautiful, modern terminal for the web - **Perfect for ChromeOS users** without terminal access. Easily integrate a full-featured terminal into your web applications.

> **🎯 Perfect for ChromeOS**: Access terminal functionality directly from the web, even if you don't have access to the terminal app!

## 🚀 Quick Install

```bash
npm install clay-util
npm install xterm xterm-addon-fit xterm-addon-web-links xterm-addon-canvas
```

## ⚡ 30-Second Setup

```typescript
import { createClayTerminal } from 'clay-util';
import 'xterm/css/xterm.css';

const terminal = await createClayTerminal({
  container: document.getElementById('terminal')
});
```

That's it! You now have a fully functional terminal in your web app.

> **📖 Need more details?** See [INTEGRATION.md](./INTEGRATION.md) for complete examples for React, Vue, Next.js, and more!

## 🚀 Features

- ✅ **Beautiful UI** - Catppuccin Mocha theme
- ✅ **Real System Access** - Connect to local bridge server for full bash support
- ✅ **Browser-Only Mode** - Works entirely in browser (Web Worker backend)
- ✅ **Perfect for ChromeOS** - No need for terminal app access
- ✅ **Session Sharing** - Share terminal sessions via encrypted URLs
- ✅ **TypeScript** - Full type definitions included
- ✅ **Lightweight** - Minimal dependencies
- ✅ **Customizable** - Easy to theme and configure

## 📦 Installation

```bash
npm install clay-terminal
```

### Peer Dependencies

You'll also need to install the required peer dependencies:

```bash
npm install xterm xterm-addon-fit xterm-addon-web-links xterm-addon-canvas
```

## 🎯 Quick Start

### Basic Usage

```typescript
import { createClayTerminal } from 'clay-util';

// Create terminal instance
const terminal = await createClayTerminal({
  container: document.getElementById('terminal')
});

// Execute a command
await terminal.executeCommand('ls -la');
```

### With Real System Access (Bridge) - Recommended for ChromeOS

For **real system command execution** and **full bash support**, use the bridge server:

1. **Download/clone the bridge server** from this repository (or install separately)
2. **Start the bridge server:**
   ```bash
   cd bridge
   npm install
   npm start
   ```
3. **Connect from your app:**
   ```typescript
   import { createClayTerminal } from 'clay-util';

   const terminal = await createClayTerminal({
     container: document.getElementById('terminal'),
     bridgeUrl: 'ws://127.0.0.1:8765/ws',
     autoConnectBridge: true
   });
   ```

**Perfect for ChromeOS!** The bridge server runs in the Linux container, giving you full system access while the terminal runs in the browser.

## 📚 API Reference

### `createClayTerminal(config: ClayTerminalConfig)`

Creates and initializes a new Clay Terminal instance.

**Parameters:**

- `container` (HTMLElement, required) - DOM element to mount the terminal
- `bridgeUrl` (string, optional) - WebSocket URL for bridge backend
- `enableAI` (boolean, optional) - Enable AI assistant features
- `theme` (TerminalTheme, optional) - Custom terminal theme
- `fontSize` (number, optional) - Font size in pixels (default: 13)
- `fontFamily` (string, optional) - Font family
- `onOutput` (callback, optional) - Callback for terminal output
- `onError` (callback, optional) - Callback for errors
- `onStatusChange` (callback, optional) - Callback for status changes

**Returns:** Promise<ClayTerminal>

### `ClayTerminal` Class

#### Methods

- `write(data: string)` - Write data to terminal
- `executeCommand(command: string)` - Execute a command
- `getHistory()` - Get command history
- `getSessionCommands()` - Get session commands (for sharing)
- `clear()` - Clear terminal
- `resize()` - Resize terminal to fit container
- `onOutput(callback)` - Register output callback
- `onError(callback)` - Register error callback
- `onStatusChange(callback)` - Register status change callback
- `dispose()` - Cleanup and disconnect

## 💡 Examples

### Example 1: Basic Terminal

```html
<!DOCTYPE html>
<html>
<head>
  <title>Clay Terminal Example</title>
  <link rel="stylesheet" href="node_modules/xterm/css/xterm.css" />
</head>
<body>
  <div id="terminal" style="width: 100%; height: 100vh;"></div>
  
  <script type="module">
    import { createClayTerminal } from 'clay-util';
    
    const terminal = await createClayTerminal({
      container: document.getElementById('terminal')
    });
  </script>
</body>
</html>
```

### Example 2: With Event Handlers

```typescript
import { createClayTerminal } from 'clay-util';

const terminal = await createClayTerminal({
  container: document.getElementById('terminal'),
  onOutput: (data) => {
    console.log('Terminal output:', data);
  },
  onError: (error) => {
    console.error('Terminal error:', error);
  },
  onStatusChange: (status) => {
    console.log('Status:', status);
    // Update UI based on status
    updateStatusIndicator(status.backend, status.ai);
  }
});
```

### Example 3: Custom Theme

```typescript
import { createClayTerminal } from 'clay-util';

const terminal = await createClayTerminal({
  container: document.getElementById('terminal'),
  theme: {
    background: '#1a1a1a',
    foreground: '#ffffff',
    cursor: '#00ff00',
    // ... other colors
  },
  fontSize: 14,
  fontFamily: 'Monaco, monospace'
});
```

### Example 4: React Integration

```tsx
import React, { useEffect, useRef } from 'react';
import { createClayTerminal } from 'clay-util';
import 'xterm/css/xterm.css';

function TerminalComponent() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (terminalRef.current && !terminalInstanceRef.current) {
      createClayTerminal({
        container: terminalRef.current
      }).then(terminal => {
        terminalInstanceRef.current = terminal;
      });
    }

    return () => {
      if (terminalInstanceRef.current) {
        terminalInstanceRef.current.dispose();
      }
    };
  }, []);

  return <div ref={terminalRef} style={{ width: '100%', height: '100vh' }} />;
}

export default TerminalComponent;
```

### Example 5: Vue Integration

```vue
<template>
  <div ref="terminalContainer" style="width: 100%; height: 100vh;"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { createClayTerminal } from 'clay-util';
import 'xterm/css/xterm.css';

const terminalContainer = ref(null);
let terminal = null;

onMounted(async () => {
  if (terminalContainer.value) {
    terminal = await createClayTerminal({
      container: terminalContainer.value
    });
  }
});

onUnmounted(() => {
  if (terminal) {
    terminal.dispose();
  }
});
</script>
```

## 🔧 Configuration

### Bridge Server Setup

For real system access, you need to run the bridge server:

1. **Install bridge dependencies:**
   ```bash
   cd bridge
   npm install
   ```

2. **Start bridge server:**
   ```bash
   npm start
   ```

3. **Connect from your app:**
   ```typescript
   const terminal = await createClayTerminal({
     container: document.getElementById('terminal'),
     bridgeUrl: 'ws://127.0.0.1:8765/ws'
   });
   ```

### Auto-Start Bridge Service

To auto-start the bridge on system boot:

```bash
cd bridge
npm run install-service
```

## 🎨 Theming

Clay Terminal uses Catppuccin Mocha colors by default. You can customize the theme:

```typescript
const terminal = await createClayTerminal({
  container: document.getElementById('terminal'),
  theme: {
    background: '#1e1e2e',
    foreground: '#cdd6f4',
    cursor: '#cba6f7',
    // ... customize other colors
  }
});
```

## 📖 Session Sharing

Share terminal sessions with encrypted URLs:

```typescript
// Get session commands
const commands = terminal.getSessionCommands();

// Generate share URL
import { SessionEncoder } from 'clay-terminal';
const shareUrl = SessionEncoder.generateShareUrl(commands);

// Parse share URL (on receiving end)
const commands = SessionEncoder.parseShareUrl(url);
```

## 🌐 Browser Support

- **Chrome/Edge** (latest) ✅
- **Firefox** (latest) ✅
- **Safari** (latest) ✅
- **ChromeOS** ✅ Perfect for users without terminal app access!

## 🎯 ChromeOS Integration

Clay Terminal is **perfectly designed for ChromeOS users** who need terminal access:

1. **Browser-only mode** - Works without Linux container
2. **Bridge server** - For real system access (runs in Linux container)
3. **No terminal app needed** - Everything works in the browser
4. **PWA support** - Install as a web app

### ChromeOS Setup

1. **Install the package:**
   ```bash
   npm install clay-terminal
   ```

2. **Use in your web app:**
   ```typescript
   import { createClayTerminal } from 'clay-util';
   
   const terminal = await createClayTerminal({
     container: document.getElementById('terminal')
   });
   ```

3. **For real system access** (optional):
   - Enable Linux container in ChromeOS settings
   - Start bridge server in Linux container
   - Terminal will auto-connect!

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please feel free to submit a Pull Request.

## 📧 Support

For issues and questions:
- GitHub Issues: https://github.com/xtoazt/clay/issues

## 🎯 Use Cases

- **ChromeOS Development** - Access terminal functionality without Linux container
- **Web-based IDEs** - Integrate terminal into code editors
- **Educational Platforms** - Teach terminal commands in browser
- **Documentation** - Interactive terminal examples
- **Remote Access** - Browser-based terminal access

---

Made with ❤️ for ChromeOS users and web developers

