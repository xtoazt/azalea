# Clay Terminal Backend API

**Powerful terminal backend for web applications - No UI dependencies**

Clay Terminal Backend is a pure backend API that provides powerful terminal functionality without any UI components. Use it with any UI framework or library (React, Vue, Angular, vanilla JS, etc.).

## Features

- ✅ **Pure Backend** - No UI dependencies, works with any frontend
- ✅ **Real System Access** - Connect to local bridge server for real terminal commands
- ✅ **Command Execution** - Execute commands and get results
- ✅ **Real-time Streaming** - Stream command output in real-time
- ✅ **Session Management** - Track command history and sessions
- ✅ **System Information** - Get system info (platform, shell, cwd, etc.)
- ✅ **Event-driven** - Powerful event system for output, errors, and status
- ✅ **TypeScript** - Fully typed API
- ✅ **ChromeOS Ready** - Perfect for ChromeOS applications

## Installation

```bash
npm install clay-util
```

## Quick Start

```typescript
import { createClayBackend } from 'clay-util';

// Create backend instance
const backend = await createClayBackend({
  bridgeUrl: 'ws://127.0.0.1:8765/ws' // Optional: for real system access
});

// Execute a command
const result = await backend.executeCommand('ls -la');
console.log(result.output);
console.log(result.exitCode);

// Listen to real-time output
backend.onOutput((data) => {
  console.log('Output:', data);
});

// Get system info
const info = await backend.getSystemInfo();
console.log('Current directory:', info?.cwd);
```

## API Reference

### `createClayBackend(config)`

Creates and initializes a backend instance.

**Config Options:**
- `bridgeUrl` (string) - Optional. Bridge server WebSocket URL
- `autoConnectBridge` (boolean) - Auto-connect to bridge if available
- `enableHistory` (boolean) - Enable command history tracking
- `maxHistory` (number) - Maximum history size
- `cwd` (string) - Initial working directory

### `ClayBackend` Methods

#### Command Execution

- `executeCommand(command: string, cwd?: string): Promise<CommandResult>` - Execute command and get result
- `executeCommandStream(command: string, cwd?: string): Promise<{result: Promise<CommandResult>, cancel: () => void}>` - Execute command with streaming output
- `sendInput(data: string): void` - Send raw input (for interactive commands)

#### Directory Management

- `getCurrentDirectory(): string` - Get current working directory
- `setCurrentDirectory(path: string): Promise<void>` - Change directory

#### History & Sessions

- `getHistory(): string[]` - Get command history
- `getSessionCommands(): string[]` - Get session commands (for sharing)
- `clearHistory(): void` - Clear command history

#### System Information

- `getSystemInfo(): Promise<SystemInfo | null>` - Get system information
- `getConnected(): boolean` - Check if backend is connected

#### Events

- `onOutput(callback: OutputCallback): void` - Register output callback
- `offOutput(callback: OutputCallback): void` - Remove output callback
- `onError(callback: ErrorCallback): void` - Register error callback
- `offError(callback: ErrorCallback): void` - Remove error callback
- `onStatusChange(callback: StatusCallback): void` - Register status change callback
- `offStatusChange(callback: StatusCallback): void` - Remove status callback

#### Cleanup

- `dispose(): void` - Disconnect and cleanup

## Examples

### Basic Usage

```typescript
import { createClayBackend } from 'clay-util';

const backend = await createClayBackend();

// Execute command
const result = await backend.executeCommand('echo "Hello World"');
console.log(result.output); // "Hello World\n"

// Multiple commands
await backend.executeCommand('cd /tmp');
await backend.executeCommand('pwd'); // Returns "/tmp"
```

### Real-time Output

```typescript
const backend = await createClayBackend({
  bridgeUrl: 'ws://127.0.0.1:8765/ws'
});

// Listen to all output
backend.onOutput((data) => {
  console.log('Terminal output:', data);
});

// Execute command - output will be streamed in real-time
await backend.executeCommand('ls -la');
```

### Error Handling

```typescript
const backend = await createClayBackend();

backend.onError((error) => {
  console.error('Backend error:', error);
});

try {
  const result = await backend.executeCommand('invalid-command');
  if (result.exitCode !== 0) {
    console.error('Command failed:', result.error);
  }
} catch (error) {
  console.error('Execution error:', error);
}
```

### Status Monitoring

```typescript
const backend = await createClayBackend();

backend.onStatusChange((status) => {
  console.log('Backend status:', status.backend);
  // 'connected' | 'disconnected' | 'connecting' | 'error'
});

// Status will be updated automatically
```

### Using with React

```typescript
import { useEffect, useState } from 'react';
import { createClayBackend, ClayBackend } from 'clay-util';

function TerminalComponent() {
  const [backend, setBackend] = useState<ClayBackend | null>(null);
  const [output, setOutput] = useState<string>('');

  useEffect(() => {
    createClayBackend().then((backend) => {
      setBackend(backend);
      
      backend.onOutput((data) => {
        setOutput(prev => prev + data);
      });
    });

    return () => {
      backend?.dispose();
    };
  }, []);

  const executeCommand = async (cmd: string) => {
    if (backend) {
      const result = await backend.executeCommand(cmd);
      console.log(result);
    }
  };

  return (
    <div>
      <pre>{output}</pre>
      <button onClick={() => executeCommand('ls')}>List Files</button>
    </div>
  );
}
```

## Real System Access

For real system command execution (especially on ChromeOS), use the bridge server:

1. **Get the bridge server** from this repository
2. **Start it:**
   ```bash
   cd bridge && npm install && npm start
   ```
3. **Connect:**
   ```typescript
   const backend = await createClayBackend({
     bridgeUrl: 'ws://127.0.0.1:8765/ws',
     autoConnectBridge: true
   });
   ```

## Types

```typescript
interface CommandResult {
  output: string;
  exitCode: number;
  error?: string;
  stdout?: string;
  stderr?: string;
}

interface SystemInfo {
  platform: string;
  shell: string;
  cwd: string;
  homeDir: string;
  user?: string;
  hostname?: string;
  arch?: string;
}
```

## License

MIT
