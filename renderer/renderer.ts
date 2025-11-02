interface ElectronAPI {
  executeCommand: (command: string, cwd?: string) => Promise<{
    success: boolean;
    output: string;
    exitCode: number;
  }>;
  executeCommandStream: (command: string, cwd?: string) => Promise<any>;
  getCurrentDirectory: () => Promise<string>;
  changeDirectory: (dir: string) => Promise<{ success: boolean; cwd?: string; error?: string }>;
  getHomeDirectory: () => Promise<string>;
  getPlatform: () => Promise<string>;
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<void>;
  windowClose: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

class ClayTerminal {
  private outputContainer: HTMLElement;
  private commandInput: HTMLInputElement;
  private commandHistory: string[] = [];
  private historyIndex: number = -1;
  private currentDirectory: string = '';
  private homeDirectory: string = '';
  private platform: string = '';
  private isExecuting: boolean = false;

  constructor() {
    this.outputContainer = document.getElementById('terminal-output')!;
    this.commandInput = document.getElementById('command-input')!;
    this.initializeTerminal();
  }

  private async initializeTerminal(): Promise<void> {
    await Promise.all([
      this.updateDirectory(),
      this.loadHomeDirectory(),
      this.loadPlatform(),
    ]);
    this.setupEventListeners();
    this.setupWindowControls();
    this.printWelcomeMessage();
  }

  private async loadHomeDirectory(): Promise<void> {
    try {
      this.homeDirectory = await window.electronAPI.getHomeDirectory();
    } catch (error) {
      console.error('Failed to get home directory:', error);
    }
  }

  private async loadPlatform(): Promise<void> {
    try {
      this.platform = await window.electronAPI.getPlatform();
    } catch (error) {
      console.error('Failed to get platform:', error);
    }
  }

  private setupWindowControls(): void {
    const closeBtn = document.querySelector('.control.close');
    const minimizeBtn = document.querySelector('.control.minimize');
    const maximizeBtn = document.querySelector('.control.maximize');

    closeBtn?.addEventListener('click', () => {
      window.electronAPI.windowClose();
    });

    minimizeBtn?.addEventListener('click', () => {
      window.electronAPI.windowMinimize();
    });

    maximizeBtn?.addEventListener('click', () => {
      window.electronAPI.windowMaximize();
    });
  }

  private printWelcomeMessage(): void {
    this.addOutputLine('Clay Terminal', 'info');
    this.addOutputLine('A beautiful terminal experience', 'info');
    this.addOutputLine('');
    this.addPrompt();
  }

  private setupEventListeners(): void {
    this.commandInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
    this.commandInput.addEventListener('input', () => {
      // Keep cursor visible while typing
    });
    this.commandInput.focus();

    // Focus input when clicking on terminal
    this.outputContainer.addEventListener('click', () => {
      this.commandInput.focus();
    });
  }

  private async handleKeyDown(e: KeyboardEvent): Promise<void> {
    if (this.isExecuting && e.key !== 'Enter') {
      return; // Ignore input while executing
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const command = this.commandInput.value.trim();
      if (command) {
        await this.executeCommand(command);
      } else {
        this.addPrompt();
      }
      this.commandInput.value = '';
      this.historyIndex = -1;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.navigateHistory(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.navigateHistory(1);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Tab completion could be added here
    } else if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      // Handle Ctrl+C for cancelling commands
      this.commandInput.value = '';
      this.addOutputLine('^C', 'info');
      this.addPrompt();
    }
  }

  private navigateHistory(direction: number): void {
    if (this.commandHistory.length === 0) return;

    if (direction === -1 && this.historyIndex < this.commandHistory.length - 1) {
      this.historyIndex++;
      this.commandInput.value = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex];
    } else if (direction === 1 && this.historyIndex > 0) {
      this.historyIndex--;
      this.commandInput.value = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex];
    } else if (direction === 1 && this.historyIndex === 0) {
      this.historyIndex = -1;
      this.commandInput.value = '';
    }
  }

  private formatPrompt(): string {
    let prompt = '';
    if (this.platform === 'win32') {
      prompt = this.currentDirectory || 'C:\\>';
    } else {
      const shortPath = this.currentDirectory.replace(this.homeDirectory, '~');
      prompt = `${shortPath} $`;
    }
    return prompt;
  }

  private async executeCommand(command: string): Promise<void> {
    if (this.isExecuting) return;
    
    this.commandHistory.push(command);
    if (this.commandHistory.length > 1000) {
      this.commandHistory.shift();
    }
    
    // Display the command
    this.addCommandLine(command);
    this.isExecuting = true;

    // Handle built-in commands
    if (command === 'clear' || command === 'cls') {
      this.clearTerminal();
      this.isExecuting = false;
      return;
    }

    if (command === 'help') {
      this.showHelp();
      this.isExecuting = false;
      this.addPrompt();
      return;
    }

    if (command === 'pwd') {
      await this.updateDirectory();
      this.addOutputLine(this.currentDirectory, 'output');
      this.isExecuting = false;
      this.addPrompt();
      return;
    }

    // Handle cd command
    if (command.startsWith('cd ')) {
      const dir = command.substring(3).trim() || this.homeDirectory;
      await this.handleChangeDirectory(dir);
      this.isExecuting = false;
      this.addPrompt();
      return;
    }

    // Execute shell command - try streaming first for interactive commands
    const needsStreaming = this.needsStreaming(command);
    
    if (needsStreaming) {
      await this.executeStreamingCommand(command);
    } else {
      await this.executeSimpleCommand(command);
    }

    this.isExecuting = false;
    this.addPrompt();
    await this.updateDirectory();
  }

  private needsStreaming(command: string): boolean {
    // Commands that need interactive/streaming output
    const streamingCommands = [
      'adb', 'npm', 'yarn', 'python', 'node', 'ssh', 'tail', 'top',
      'watch', 'ping', 'tcpdump', 'nc', 'netcat'
    ];
    const cmd = command.split(' ')[0].toLowerCase();
    return streamingCommands.some(sc => cmd.includes(sc));
  }

  private async executeStreamingCommand(command: string): Promise<void> {
    try {
      const stream = await window.electronAPI.executeCommandStream(command, this.currentDirectory);
      
      let hasOutput = false;

      stream.onOutput((data: string) => {
        hasOutput = true;
        const lines = data.split('\n');
        lines.forEach(line => {
          if (line.trim() || !hasOutput) {
            this.addOutputLine(line, 'output');
          }
        });
      });

      stream.onClose((code: number) => {
        if (code !== 0 && !hasOutput) {
          this.addOutputLine(`Process exited with code ${code}`, 'error');
        }
      });

      // Handle stdin for interactive commands
      const originalFocus = document.activeElement;
      const stdinHandler = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          stream.write('\n');
        } else if (e.key.length === 1 || e.key === 'Backspace') {
          // Forward keyboard input to process
        }
      };
      
      // For now, we'll just execute and show output
      // Full interactive stdin support would require more complex implementation
    } catch (error: any) {
      this.addOutputLine(`Error: ${error.message}`, 'error');
    }
  }

  private async executeSimpleCommand(command: string): Promise<void> {
    try {
      const result = await window.electronAPI.executeCommand(command, this.currentDirectory);
      
      if (result.output) {
        const lines = result.output.split('\n');
        lines.forEach(line => {
          // Always show the line, even if empty (for formatting)
          this.addOutputLine(line, result.success ? 'output' : 'error');
        });
        
        // Remove trailing empty line if present
        if (lines[lines.length - 1] === '') {
          const lastLine = this.outputContainer.lastElementChild;
          if (lastLine && lastLine.textContent === '') {
            lastLine.remove();
          }
        }
      }

      if (!result.success && !result.output) {
        this.addOutputLine(`Command failed with exit code ${result.exitCode}`, 'error');
      }
    } catch (error: any) {
      this.addOutputLine(`Error: ${error.message}`, 'error');
    }
  }

  private async handleChangeDirectory(dir: string): Promise<void> {
    try {
      const result = await window.electronAPI.changeDirectory(dir);
      if (result.success) {
        this.currentDirectory = result.cwd || '';
      } else {
        this.addOutputLine(`cd: ${result.error}`, 'error');
      }
    } catch (error: any) {
      this.addOutputLine(`cd: ${error.message}`, 'error');
    }
  }

  private async updateDirectory(): Promise<void> {
    try {
      this.currentDirectory = await window.electronAPI.getCurrentDirectory();
    } catch (error) {
      console.error('Failed to get current directory:', error);
    }
  }

  private showHelp(): void {
    this.addOutputLine('Clay Terminal Help', 'info');
    this.addOutputLine('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'output');
    this.addOutputLine('');
    this.addOutputLine('Built-in commands:', 'info');
    this.addOutputLine('  clear, cls      - Clear the terminal screen', 'output');
    this.addOutputLine('  cd <dir>        - Change directory (use ~ for home)', 'output');
    this.addOutputLine('  pwd             - Print current working directory', 'output');
    this.addOutputLine('  help            - Show this help message', 'output');
    this.addOutputLine('');
    this.addOutputLine('Shell commands:', 'info');
    this.addOutputLine('  You can run any shell command directly.', 'output');
    this.addOutputLine('  Examples: ls, cat, grep, adb devices, npm install, etc.', 'output');
    this.addOutputLine('');
    this.addOutputLine('Navigation:', 'info');
    this.addOutputLine('  ↑/↓ Arrow keys  - Navigate command history', 'output');
    this.addOutputLine('  Ctrl+C          - Cancel current command', 'output');
  }

  private addCommandLine(command: string): void {
    const line = document.createElement('div');
    line.className = 'terminal-line';
    
    const prompt = document.createElement('span');
    prompt.className = 'prompt';
    prompt.textContent = this.formatPrompt();
    
    const commandText = document.createElement('span');
    commandText.className = 'command-line';
    commandText.textContent = ` ${command}`;
    
    line.appendChild(prompt);
    line.appendChild(commandText);
    this.outputContainer.appendChild(line);
    
    this.scrollToBottom();
  }

  private addOutputLine(text: string, type: 'output' | 'error' | 'success' | 'info' = 'output'): void {
    const line = document.createElement('div');
    line.className = `terminal-line ${type}`;
    line.textContent = text;
    this.outputContainer.appendChild(line);
    
    this.scrollToBottom();
  }

  private addPrompt(): void {
    const line = document.createElement('div');
    line.className = 'terminal-line';
    
    const prompt = document.createElement('span');
    prompt.className = 'prompt';
    prompt.textContent = this.formatPrompt();
    
    line.appendChild(prompt);
    this.outputContainer.appendChild(line);
    
    this.scrollToBottom();
    // Small delay to ensure DOM is updated before focusing
    setTimeout(() => this.commandInput.focus(), 10);
  }

  private clearTerminal(): void {
    this.outputContainer.innerHTML = '';
    this.printWelcomeMessage();
  }

  private scrollToBottom(): void {
    // Use requestAnimationFrame for smooth scrolling
    requestAnimationFrame(() => {
      this.outputContainer.scrollTop = this.outputContainer.scrollHeight;
    });
  }
}

// Initialize terminal when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new ClayTerminal();
});
