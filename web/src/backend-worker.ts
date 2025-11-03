// Web Worker-based backend that runs in the browser
// This emulates the Express.js server functionality but runs entirely in the browser

export interface WorkerMessage {
  type: 'connect' | 'input' | 'resize' | 'kill' | 'execute' | 'health' | 'info';
  data?: any;
  sessionId?: string;
  cols?: number;
  rows?: number;
  command?: string;
  cwd?: string;
}

// Terminal session management
class TerminalSession {
  private sessionId: string;
  private currentDirectory: string;
  private commandHistory: string[] = [];
  private virtualFS: Map<string, string | { type: 'directory' }> = new Map();
  private env: Map<string, string> = new Map();

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.currentDirectory = '/home/user';
    this.initializeFilesystem();
    this.initializeEnvironment();
  }

  private initializeFilesystem(): void {
    // Create basic directory structure
    this.virtualFS.set('/', { type: 'directory' });
    this.virtualFS.set('/home', { type: 'directory' });
    this.virtualFS.set('/home/user', { type: 'directory' });
    this.virtualFS.set('/tmp', { type: 'directory' });
    this.virtualFS.set('/etc', { type: 'directory' });
    
    // Create some example files
    this.virtualFS.set('/home/user/.bashrc', 'echo "Welcome to Clay Terminal!"');
    this.virtualFS.set('/home/user/README.md', '# Clay Terminal\n\nWelcome to your browser-based terminal!');
  }

  private initializeEnvironment(): void {
    this.env.set('HOME', '/home/user');
    this.env.set('USER', 'user');
    this.env.set('SHELL', '/bin/bash');
    this.env.set('PWD', this.currentDirectory);
    this.env.set('PATH', '/usr/bin:/bin');
  }

  getCWD(): string {
    return this.currentDirectory;
  }

  setCWD(path: string): void {
    // Normalize path
    if (path.startsWith('~')) {
      path = path.replace('~', '/home/user');
    }
    if (!path.startsWith('/')) {
      path = this.resolvePath(path);
    }
    
    const content = this.virtualFS.get(path);
    if (content && typeof content === 'object' && content.type === 'directory') {
      this.currentDirectory = path;
      this.env.set('PWD', path);
    }
  }

  private resolvePath(relativePath: string): string {
    if (relativePath === '..') {
      const parts = this.currentDirectory.split('/').filter(p => p);
      if (parts.length > 1) {
        parts.pop();
        return '/' + parts.join('/');
      }
      return '/';
    }
    if (relativePath === '.') {
      return this.currentDirectory;
    }
    if (relativePath.startsWith('/')) {
      return relativePath;
    }
    return this.currentDirectory + '/' + relativePath;
  }

  async executeCommand(command: string): Promise<{ output: string; exitCode: number }> {
    const trimmed = command.trim();
    if (!trimmed) {
      return { output: '', exitCode: 0 };
    }

    // Add to history
    this.commandHistory.push(trimmed);
    if (this.commandHistory.length > 1000) {
      this.commandHistory.shift();
    }

    // Handle cd command
    if (trimmed.startsWith('cd ')) {
      const dir = trimmed.substring(3).trim();
      if (!dir || dir === '~') {
        this.setCWD('/home/user');
      } else {
        this.setCWD(dir);
      }
      return { output: '', exitCode: 0 };
    }

    // Handle pwd
    if (trimmed === 'pwd') {
      return { output: this.currentDirectory + '\n', exitCode: 0 };
    }

    // Handle ls
    if (trimmed.startsWith('ls')) {
      const args = trimmed.split(/\s+/).slice(1);
      const path = args.find(arg => !arg.startsWith('-')) || this.currentDirectory;
      const resolvedPath = this.resolvePath(path);
      const items: string[] = [];
      
      for (const [fsPath, content] of this.virtualFS.entries()) {
        if (fsPath.startsWith(resolvedPath) && fsPath !== resolvedPath) {
          const relative = fsPath.substring(resolvedPath.length + 1);
          if (!relative.includes('/')) {
            const isDir = typeof content === 'object' && content.type === 'directory';
            items.push(isDir ? relative + '/' : relative);
          }
        }
      }
      
      return { output: items.join('  ') + '\n', exitCode: 0 };
    }

    // Handle cat
    if (trimmed.startsWith('cat ')) {
      const file = trimmed.substring(4).trim();
      const resolvedPath = this.resolvePath(file);
      const content = this.virtualFS.get(resolvedPath);
      if (typeof content === 'string') {
        return { output: content + '\n', exitCode: 0 };
      }
      return { output: `cat: ${file}: No such file or directory\n`, exitCode: 1 };
    }

    // Handle echo
    if (trimmed.startsWith('echo ')) {
      const text = trimmed.substring(5).trim();
      return { output: text + '\n', exitCode: 0 };
    }

    // Handle whoami
    if (trimmed === 'whoami') {
      return { output: this.env.get('USER') + '\n', exitCode: 0 };
    }

    // Handle hostname
    if (trimmed === 'hostname') {
      return { output: 'webvm\n', exitCode: 0 };
    }

    // Handle uname
    if (trimmed.startsWith('uname')) {
      const args = trimmed.split(/\s+/);
      if (args.includes('-a')) {
        return { output: 'Linux webvm 5.10.0 #1 WebAssembly SMP x86_64 GNU/Linux\n', exitCode: 0 };
      }
      return { output: 'Linux\n', exitCode: 0 };
    }

    // Handle clear
    if (trimmed === 'clear' || trimmed === 'cls') {
      return { output: '\x1b[2J\x1b[H', exitCode: 0 }; // ANSI clear screen
    }

    // Handle help
    if (trimmed === 'help') {
      const help = `Available commands:
  ls, cd, pwd, cat, echo, whoami, hostname, uname, clear, help
  mkdir, touch, rm, grep, find, head, tail, wc
  ps, df, free, uptime, date

Type @ai <question> for AI assistance.
`;
      return { output: help, exitCode: 0 };
    }

    // Handle mkdir
    if (trimmed.startsWith('mkdir ')) {
      const dir = trimmed.substring(6).trim();
      const resolvedPath = this.resolvePath(dir);
      if (!this.virtualFS.has(resolvedPath)) {
        this.virtualFS.set(resolvedPath, { type: 'directory' });
        return { output: '', exitCode: 0 };
      }
      return { output: `mkdir: cannot create directory '${dir}': File exists\n`, exitCode: 1 };
    }

    // Handle touch
    if (trimmed.startsWith('touch ')) {
      const file = trimmed.substring(6).trim();
      const resolvedPath = this.resolvePath(file);
      if (!this.virtualFS.has(resolvedPath)) {
        this.virtualFS.set(resolvedPath, '');
        return { output: '', exitCode: 0 };
      }
      return { output: '', exitCode: 0 };
    }

    // Handle rm
    if (trimmed.startsWith('rm ')) {
      const file = trimmed.substring(3).trim();
      const resolvedPath = this.resolvePath(file);
      if (this.virtualFS.has(resolvedPath)) {
        const content = this.virtualFS.get(resolvedPath);
        if (typeof content === 'object' && content.type === 'directory') {
          return { output: `rm: cannot remove '${file}': Is a directory\n`, exitCode: 1 };
        }
        this.virtualFS.delete(resolvedPath);
        return { output: '', exitCode: 0 };
      }
      return { output: `rm: cannot remove '${file}': No such file or directory\n`, exitCode: 1 };
    }

    // Handle grep
    if (trimmed.startsWith('grep ')) {
      const parts = trimmed.substring(5).split(/\s+/);
      if (parts.length < 2) {
        return { output: 'grep: missing pattern or file\n', exitCode: 1 };
      }
      const pattern = parts[0];
      const file = parts[1];
      const resolvedPath = this.resolvePath(file);
      const content = this.virtualFS.get(resolvedPath);
      if (typeof content === 'string' && content.includes(pattern)) {
        return { output: `${file}:${content}\n`, exitCode: 0 };
      }
      return { output: '', exitCode: 1 };
    }

    // Handle date
    if (trimmed === 'date') {
      return { output: new Date().toLocaleString() + '\n', exitCode: 0 };
    }

    // Handle ps
    if (trimmed.startsWith('ps')) {
      return { output: 'PID TTY          TIME CMD\n   1 ?        00:00:00 init\n   2 ?        00:00:00 bash\n', exitCode: 0 };
    }

    // Handle df
    if (trimmed.startsWith('df')) {
      return { output: 'Filesystem      Size  Used Avail Use% Mounted on\n/dev/root      1024M   1M 1023M   1% /\n', exitCode: 0 };
    }

    // Unknown command
    const cmd = trimmed.split(/\s+/)[0];
    return { 
      output: `${cmd}: command not found\nTry 'help' for available commands.\n`, 
      exitCode: 127 
    };
  }

  resize(cols: number, rows: number): void {
    // Terminal resize - handled by session
  }

  kill(): void {
    // Cleanup
  }
}

// Web Worker backend implementation
class WebWorkerBackend {
  private sessions: Map<string, TerminalSession> = new Map();
  private messagePort: MessagePort | null = null;

  constructor() {
    this.setupMessageHandler();
  }

  private setupMessageHandler(): void {
    // Use globalThis to work in both worker and main thread contexts
    const globalScope = typeof self !== 'undefined' ? self : globalThis;
    globalScope.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
      this.handleMessage(event.data);
    });
  }

  private handleMessage(message: WorkerMessage): void {
    switch (message.type) {
      case 'connect':
        this.handleConnect();
        break;
      case 'input':
        this.handleInput(message.sessionId!, message.data);
        break;
      case 'resize':
        this.handleResize(message.sessionId!, message.cols!, message.rows!);
        break;
      case 'kill':
        this.handleKill(message.sessionId!);
        break;
      case 'execute':
        this.handleExecute(message.command!, message.cwd);
        break;
      case 'health':
        this.sendMessage({ type: 'health', data: { status: 'ok' } });
        break;
      case 'info':
        this.sendMessage({
          type: 'info',
          data: {
            platform: 'web',
            arch: 'wasm',
            shell: '/bin/bash',
            homeDir: '/home/user',
            cwd: '/home/user'
          }
        });
        break;
    }
  }

  private handleConnect(): void {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session = new TerminalSession(sessionId);
    this.sessions.set(sessionId, session);

    this.sendMessage({
      type: 'connected',
      sessionId: sessionId,
      data: {
        shell: '/bin/bash',
        cwd: '/home/user'
      }
    });

    // Send welcome message and initial prompt
    this.sendMessage({
      type: 'output',
      sessionId: sessionId,
      data: '\x1b[32m[Connected]\x1b[0m WebVM backend ready!\r\n'
    });
    
    // Send initial prompt
    const shortPath = session.getCWD().replace(/^\/home\/[^\/]+/, '~');
    this.sendMessage({
      type: 'output',
      sessionId: sessionId,
      data: `\x1b[35muser@webvm\x1b[0m:\x1b[34m${shortPath}\x1b[0m$ `
    });
  }

  private async handleInput(sessionId: string, data: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    // Initialize currentLine if not exists
    if (!(session as any).currentLine) {
      (session as any).currentLine = '';
    }

    // Process input character by character for terminal-like behavior
    if (data === '\r' || data === '\n') {
      // Execute command
      const command = (session as any).currentLine;
      (session as any).currentLine = '';
      
      // Send newline
      this.sendMessage({
        type: 'output',
        sessionId: sessionId,
        data: '\r\n'
      });
      
      if (command.trim()) {
        const result = await session.executeCommand(command);
        this.sendMessage({
          type: 'output',
          sessionId: sessionId,
          data: result.output
        });
        
        // Send prompt after command execution
        const shortPath = session.getCWD().replace(/^\/home\/[^\/]+/, '~');
        this.sendMessage({
          type: 'output',
          sessionId: sessionId,
          data: `\x1b[35muser@webvm\x1b[0m:\x1b[34m${shortPath}\x1b[0m$ `
        });
      } else {
        // Empty command, just show prompt
        const shortPath = session.getCWD().replace(/^\/home\/[^\/]+/, '~');
        this.sendMessage({
          type: 'output',
          sessionId: sessionId,
          data: `\x1b[35muser@webvm\x1b[0m:\x1b[34m${shortPath}\x1b[0m$ `
        });
      }
    } else if (data === '\x7f' || data === '\b') {
      // Backspace
      if ((session as any).currentLine.length > 0) {
        (session as any).currentLine = (session as any).currentLine.slice(0, -1);
        this.sendMessage({
          type: 'output',
          sessionId: sessionId,
          data: '\b \b'
        });
      }
    } else {
      // Append character (only printable characters)
      if (data.length === 1 && data >= ' ' && data <= '~') {
        (session as any).currentLine += data;
        this.sendMessage({
          type: 'output',
          sessionId: sessionId,
          data: data
        });
      } else {
        // Send other control characters as-is
        this.sendMessage({
          type: 'output',
          sessionId: sessionId,
          data: data
        });
      }
    }
  }

  private handleResize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.resize(cols, rows);
    }
  }

  private handleKill(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.kill();
      this.sessions.delete(sessionId);
    }
  }

  private async handleExecute(command: string, cwd?: string): Promise<void> {
    // Create temporary session for REST API calls
    const session = new TerminalSession('temp_' + Date.now());
    if (cwd) {
      session.setCWD(cwd);
    }
    
    const result = await session.executeCommand(command);
    this.sendMessage({
      type: 'execute-result',
      data: {
        output: result.output,
        exitCode: result.exitCode
      }
    });
  }

  private sendMessage(message: any): void {
    // Use globalThis to work in both worker and main thread contexts
    const globalScope = typeof self !== 'undefined' ? self : globalThis;
    (globalScope as any).postMessage(message);
  }
}

// Initialize backend when worker loads
// In Web Worker context, 'self' refers to the global scope
if (typeof self !== 'undefined') {
  const backend = new WebWorkerBackend();
}

