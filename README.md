# Clay Terminal - Enhanced Edition

A powerful, feature-rich terminal that runs in your browser with real system access, AI assistance, and cross-platform support.

## 🌟 Features

### Core Terminal
- **Full Terminal Emulation** - xterm.js with advanced addons (Search, Unicode11, Image, Ligatures)
- **Multi-Tab Support** - Manage multiple terminal sessions
- **Command Palette** - Fuzzy search for commands (Ctrl+P)
- **Keyboard Shortcuts** - Comprehensive shortcut system
- **Session Sharing** - Share terminal sessions via URL

### System Access
- **Enhanced Bridge System** - Automatic fallback between bridge types
  - External Bridge (Node.js server) - Full system access
  - WebVM Bridge - Browser-based fallback
  - Automatic reconnection and health monitoring
- **Root/Privileged Access** - Execute commands with elevated privileges
- **ChromeOS Integration** - Special support for ChromeOS with auto-start
- **Cross-Platform** - Works on ChromeOS, macOS, Windows, Linux

### AI Assistant
- **JOSIEFIED AI** - Local AI inference using WebLLM
- **Always Available** - AI works even if terminal backend fails
- **File-Aware** - AI can discuss your filesystem
- **Auto-Fix** - AI automatically fixes command errors
- **Multiple Quantization Options** - Q4, Q8, F16 for performance/quality tradeoff

### ChromeOS Features
- **Hidden Settings Unlocker** - Access all ChromeOS settings
- **Linux Files Integration** - Automatic file saving to Linux Files
- **ADB Connection** - Enable ADB debugging
- **Developer Mode** - Enable developer features
- **Guest Mode** - Enable guest browsing
- **User Management** - Add/manage user accounts

### UI/UX
- **Modern Design** - Dark blue/orange theme with glassmorphism
- **Smooth Animations** - Subtle, professional animations
- **Responsive Layout** - Works on all screen sizes
- **Status Indicators** - Real-time connection status
- **Notifications** - Toast notification system

## 🚀 Quick Start

### Web Version (No Installation)
1. Open the web terminal in your browser
2. The terminal automatically:
   - Tries to connect to external bridge (if available)
   - Falls back to WebVM (browser-based)
   - Initializes AI assistant
   - Works immediately!

### With Bridge Server (Full System Access)
1. Start the bridge server:
   ```bash
   cd bridge
   npm install
   npm start
   ```
2. Open the web terminal - it will auto-connect
3. Enjoy full system command execution!

## 📦 Architecture

### Enhanced Bridge System
The terminal uses a sophisticated bridge system with automatic fallback:

1. **External Bridge** (Preferred)
   - Node.js server running locally
   - Full system command execution
   - Real filesystem access
   - WebSocket for real-time I/O

2. **WebVM Bridge** (Fallback)
   - Runs entirely in browser
   - Limited command set
   - Virtual filesystem
   - Always available

3. **Automatic Fallback**
   - Tries external bridge first
   - Falls back to WebVM if unavailable
   - Auto-reconnects when bridge becomes available
   - Health monitoring and circuit breaker

### Error Handling
- **Comprehensive Error Handler** - Tracks all errors with context
- **Resilience Utilities** - Safe DOM operations, retry logic, timeouts
- **Circuit Breaker** - Prevents cascading failures
- **Graceful Degradation** - App always works, even with failures

### AI System
- **Standalone AI Service** - Works independently of terminal
- **Global Instance** - Shared across all components
- **Background Initialization** - Doesn't block startup
- **Multiple Fallbacks** - Always available

## 🛠️ Development

### Project Structure
```
clay/
├── web/              # Frontend (Vite + TypeScript)
│   ├── src/
│   │   ├── main.ts              # Main terminal class
│   │   ├── enhanced-bridge.ts   # Enhanced bridge system
│   │   ├── standalone-ai.ts     # Global AI service
│   │   ├── utils/
│   │   │   ├── error-handler.ts # Error handling
│   │   │   └── resilience.ts    # Resilience utilities
│   │   └── components/          # UI components
│   └── package.json
├── bridge/           # Node.js bridge server
│   └── bridge.js
└── backend/          # Backend utilities
    ├── system-access.js
    ├── privileged-apis.js
    └── chromeos-settings-unlocker.js
```

### Building
```bash
cd web
npm install
npm run build
```

### Development
```bash
cd web
npm run dev
```

## 🔧 Configuration

### Bridge Configuration
The enhanced bridge system can be configured:

```typescript
const bridge = getEnhancedBridge({
  preferredType: 'external',  // 'external' | 'webvm'
  enableAutoFallback: true,   // Auto-fallback on failure
  retryAttempts: 3,           // Retry attempts
  timeout: 10000              // Connection timeout
});
```

### AI Configuration
```typescript
const ai = getWebLLMService({
  quantization: 'q4f16_1',    // 'q4f16_1' | 'q4f32_1' | 'q8f16_1' | 'f16'
  temperature: 0.7,
  topP: 0.95,
  maxGenLen: 2048
});
```

## 🎯 Usage

### Basic Commands
- `ls` - List files
- `cd <dir>` - Change directory
- `pwd` - Print working directory
- `cat <file>` - Display file contents
- `clear` - Clear terminal
- `help` - Show help

### AI Commands
- `@ai <question>` - Ask AI a question
- `@ai enable` - Enable AI auto-execution
- `@ai disable` - Disable AI auto-execution
- `@ai status` - Show AI status

### Special Commands
- `settings` - Open ChromeOS settings unlocker
- `scan` - Scan filesystem for AI context
- `share` - Copy session share link

### Integration Commands
- `crosup` - Development environment setup tool
  - `crosup init [toml|hcl]` - Initialize configuration
  - `crosup install <packages>` - Install development packages
  - `crosup search <query>` - Search nixpkgs repository
  - `crosup status` - Show crosup status
- `chrostini` - ChromeOS Linux container setup (ChromeOS only)
  - `chrostini init` - Quick development setup
  - `chrostini desktop` - Install desktop environment
  - `chrostini status` - Check container status
- `recomod` - ChromeOS recovery/modding tools (ChromeOS only)
  - `recomod info` - Device information
  - `recomod recovery` - Recovery mode status
  - `recomod firmware` - Firmware information
  - `recomod partitions` - Partition information
- `vbox` / `virtualbox` - VirtualBox VM management
  - `vbox list` - List all VMs
  - `vbox start <vm>` - Start a VM
  - `vbox stop <vm>` - Stop a VM
- `v86` - x86 emulator (browser-based)
  - `v86 status` - Check v86 availability
- `browserpod` - Browser-based container runtime
  - `browserpod status` - Check BrowserPod status

## 🔒 Security

- Bridge server runs on localhost only (default)
- All commands execute with user privileges
- No remote code execution
- Secure credential management for root operations

## 📝 License

See LICENSE file for details.

## 🔌 Integrations

Clay Terminal integrates with several powerful tools and services:

### Development Tools
- **[crosup](https://github.com/tsirysndr/crosup)** - Quick development environment setup for Chromebook/ChromeOS, macOS, and Linux
- **[Chrostini-Initializers](https://github.com/francis-chris5/Chrostini-Initializers)** - Rapid ChromeOS Linux container setup scripts

### Virtualization
- **[VirtualBox](https://github.com/VirtualBox/virtualbox)** - Virtual machine management
- **[v86](https://github.com/copy/v86)** - x86 PC emulator running in the browser
- **[BrowserPod](https://github.com/leaningtech/browserpod-meta)** - Browser-based container runtime

### ChromeOS Tools
- **[RecoMod](https://github.com/MercuryWorkshop/RecoMod)** - ChromeOS recovery and modding tools

All integrations are accessible via terminal commands and work seamlessly with the bridge backend.

## 🙏 Acknowledgments

- [xterm.js](https://xtermjs.org/) - Terminal emulator
- [WebLLM](https://webllm.mlc.ai/) - Browser-based AI inference
- [BrowserPod](https://github.com/leaningtech/browserpod-meta) - Inspiration for in-browser runtime
- [crosup](https://github.com/tsirysndr/crosup) - Development environment setup
- [v86](https://github.com/copy/v86) - x86 emulation in browser

## 🐛 Troubleshooting

### Terminal Not Loading
- Check browser console for errors
- Ensure DOM is fully loaded
- Try refreshing the page

### Bridge Not Connecting
- Verify bridge server is running: `curl http://127.0.0.1:8765/api/health`
- Check firewall settings
- Terminal will auto-fallback to WebVM

### AI Not Working
- Check browser console for WebLLM errors
- AI will gracefully disable if model not available
- Terminal continues to work without AI

### ChromeOS Issues
- Ensure Linux (Beta) is enabled
- Bridge should run in Linux container
- Check Linux Files folder permissions

## 🚧 Roadmap

- [ ] Split pane support
- [ ] Multiple theme options
- [ ] Profile system
- [ ] Enhanced clipboard
- [ ] Full keyboard navigation
- [ ] Screen reader support

---

**Made with precision to always work, everywhere.**
