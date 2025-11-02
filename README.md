# Clay Terminal

A beautiful, modern terminal built with Electron, inspired by [Hyper](https://hyper.is/). Clay provides a full-featured terminal experience that runs on Chromebooks and other platforms, allowing you to execute shell scripts, ADB commands, and any other terminal commands you need.

## Features

- 🖥️ **Full Terminal Functionality** - Execute any shell command, including ADB, npm, python, and more
- 🎨 **Hyper-Inspired UI** - Beautiful, clean interface based on Hyper terminal
- 📜 **Command History** - Navigate through previous commands with arrow keys
- 📁 **Directory Navigation** - Full `cd` and `pwd` support with `~` expansion
- 🔄 **Streaming Support** - Real-time output for interactive commands
- ⌨️ **Keyboard Shortcuts** - Ctrl+C to cancel, arrow keys for history
- 🎯 **Platform Agnostic** - Works on Windows, macOS, and Linux (perfect for Chromebooks)
- 🚀 **Fast & Responsive** - Optimized for smooth performance

## Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Build the project:**
```bash
npm run build
```

3. **Start the application:**
```bash
npm start
```

Or use the dev script for development:
```bash
npm run dev
```

## Usage

Once Clay Terminal starts, you can:

- **Type any shell command** and press Enter to execute it
- **Use `cd <directory>`** to change directories (supports `~` for home directory)
- **Use `pwd`** to see the current directory
- **Use `clear` or `cls`** to clear the terminal
- **Use `help`** to see available built-in commands
- **Use Arrow Up/Down** to navigate command history
- **Use Ctrl+C** to cancel the current command

### Example Commands

```bash
# File operations
ls -la
cat file.txt
grep "search" file.txt

# ADB commands
adb devices
adb install app.apk
adb shell pm list packages

# Development tools
npm install
python script.py
git status

# System commands
ps aux
df -h
top
```

## Built-in Commands

- `clear` / `cls` - Clear the terminal screen
- `cd <dir>` - Change to a different directory (use `~` for home)
- `pwd` - Print the current working directory
- `help` - Show help message

## Project Structure

```
├── src/              # Main process TypeScript files
│   ├── main.ts      # Electron main process with command execution
│   └── preload.ts   # Preload script for secure IPC
├── renderer/         # Renderer process files
│   ├── index.html   # Main HTML file
│   ├── styles.css   # Hyper-inspired terminal styling
│   └── renderer.ts  # Terminal logic and UI
├── dist/             # Compiled JavaScript (generated)
└── package.json      # Project configuration
```

## Development

The project uses TypeScript for type safety. The main process runs in Node.js with secure IPC communication, while the renderer process runs in a Chromium-based browser window.

### Building

```bash
npm run build
```

This will:
1. Compile all TypeScript files
2. Copy HTML and CSS files to the dist folder

### Development Mode

```bash
npm run dev
```

Runs the build and starts Electron in development mode.

## Security

Clay Terminal uses Electron's security best practices:
- **Context isolation** enabled
- **Node integration** disabled in renderer
- **Secure IPC communication** via preload script
- **Process management** with proper cleanup

## Shell Support

Clay Terminal automatically detects and uses the system's default shell:
- **Windows**: `cmd.exe` or `COMSPEC`
- **macOS/Linux**: `bash`, `zsh`, or `SHELL` environment variable

## Perfect for Chromebooks

Clay Terminal is designed to work on Chromebooks where you might not have direct access to the native terminal. It provides a full-featured terminal experience that can run ADB commands, development tools, and any other shell scripts you need.

## Inspiration

This terminal is inspired by [Hyper](https://hyper.is/), a beautiful terminal built on web technologies. Clay brings that same beautiful experience with enhanced functionality for command execution.

## License

MIT
