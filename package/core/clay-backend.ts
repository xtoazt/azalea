/**
 * Clay Backend - Pure backend API with no UI dependencies
 * Powerful terminal backend for web applications
 */

import type { 
  ClayBackendConfig, 
  TerminalBackend, 
  OutputCallback, 
  ErrorCallback, 
  StatusCallback,
  CommandResult,
  SystemInfo,
  CommandCallback
} from '../types';
import { BridgeBackend } from '../backend/bridge-backend';
import { WebWorkerBackend } from '../backend/web-worker-backend';

export class ClayBackend {
  private backend: TerminalBackend | null = null;
  private config: ClayBackendConfig;
  private isConnected: boolean = false;
  private commandHistory: string[] = [];
  private sessionCommands: string[] = [];
  private outputCallbacks: OutputCallback[] = [];
  private errorCallbacks: ErrorCallback[] = [];
  private statusCallbacks: StatusCallback[] = [];
  private commandCallbacks: Map<string, CommandCallback> = new Map();
  private currentDirectory: string = '/';

  constructor(config: ClayBackendConfig = {}) {
    this.config = config;
    this.currentDirectory = config.cwd || '/';
  }

  /**
   * Initialize and connect to backend
   */
  async initialize(): Promise<void> {
    await this.setupBackend();
  }

  /**
   * Setup backend connection
   */
  private async setupBackend(): Promise<void> {
    // Try bridge first if URL provided
    if (this.config.bridgeUrl || this.config.autoConnectBridge) {
      const bridgeUrl = this.config.bridgeUrl || 'ws://127.0.0.1:8765/ws';
      this.backend = new BridgeBackend(bridgeUrl);
      
      try {
        const isHealthy = await (this.backend as any).healthCheck?.();
        if (isHealthy) {
          await this.connectToBackend();
          return;
        }
      } catch (error) {
        console.warn('Bridge not available, using Web Worker fallback');
      }
    }

    // Fallback to Web Worker
    this.backend = new WebWorkerBackend();
    await this.connectToBackend();
  }

  /**
   * Connect to backend
   */
  private async connectToBackend(): Promise<void> {
    if (!this.backend) return;

    // Set up output handler
    this.backend.onOutput((data: string) => {
      this.outputCallbacks.forEach(cb => cb(data));
    });

    this.backend.onExit((code: number, signal: number) => {
      // Handle process exit
    });

    this.backend.onError((error: string) => {
      this.errorCallbacks.forEach(cb => cb(error));
      this.updateStatus({ backend: 'error' });
    });

    try {
      await this.backend.connect();
      this.isConnected = true;
      
      // Get initial system info
      const info = await this.backend.getSystemInfo();
      if (info?.cwd) {
        this.currentDirectory = info.cwd;
      }
      
      this.updateStatus({ backend: 'connected' });
    } catch (error: any) {
      this.updateStatus({ backend: 'error' });
      throw error;
    }
  }

  /**
   * Execute a command and return the result
   */
  async executeCommand(command: string, cwd?: string): Promise<CommandResult> {
    if (!this.backend || !this.backend.getConnected()) {
      throw new Error('Backend not connected');
    }

    const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const targetCwd = cwd || this.currentDirectory;

    // Track command for history
    this.commandHistory.push(command);
    this.sessionCommands.push(command);
    
    if (this.config.maxHistory && this.commandHistory.length > this.config.maxHistory) {
      this.commandHistory.shift();
    }

    // Execute command
    const result = await this.backend.executeCommand(command, targetCwd);

    // Update current directory if cd command
    if (command.trim().startsWith('cd ')) {
      const dir = command.trim().substring(3).trim();
      if (dir === '~' || dir === '') {
        const info = await this.backend.getSystemInfo();
        this.currentDirectory = info?.homeDir || '/';
      } else if (dir.startsWith('/')) {
        this.currentDirectory = dir;
      } else {
        this.currentDirectory = `${this.currentDirectory}/${dir}`.replace(/\/+/g, '/');
      }
    }

    // Notify callbacks
    const callback = this.commandCallbacks.get(commandId);
    if (callback) {
      callback(result);
      this.commandCallbacks.delete(commandId);
    }

    return result;
  }

  /**
   * Execute a command and stream output in real-time
   */
  async executeCommandStream(command: string, cwd?: string): Promise<{
    result: Promise<CommandResult>;
    cancel: () => void;
  }> {
    if (!this.backend || !this.backend.getConnected()) {
      throw new Error('Backend not connected');
    }

    const targetCwd = cwd || this.currentDirectory;
    
    // Send input to backend for streaming
    this.backend.sendInput(command + '\r\n');

    // Return a promise that resolves when command completes
    let resolveResult: (value: CommandResult) => void;
    let rejectResult: (reason?: any) => void;
    const resultPromise = new Promise<CommandResult>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });

    // For now, execute command normally and resolve
    // In a real implementation, this would track the streaming output
    setTimeout(async () => {
      try {
        const result = await this.executeCommand(command, targetCwd);
        resolveResult(result);
      } catch (error: any) {
        rejectResult(error);
      }
    }, 100);

    return {
      result: resultPromise,
      cancel: () => {
        // Cancel command execution
        rejectResult(new Error('Command cancelled'));
      }
    };
  }

  /**
   * Send raw input to terminal (for interactive commands)
   */
  sendInput(data: string): void {
    if (this.backend && this.backend.getConnected()) {
      this.backend.sendInput(data);
    }
  }

  /**
   * Get current working directory
   */
  getCurrentDirectory(): string {
    return this.currentDirectory;
  }

  /**
   * Set current working directory
   */
  async setCurrentDirectory(path: string): Promise<void> {
    await this.executeCommand(`cd ${path}`);
  }

  /**
   * Get command history
   */
  getHistory(): string[] {
    return [...this.commandHistory];
  }

  /**
   * Get session commands (for sharing)
   */
  getSessionCommands(): string[] {
    return [...this.sessionCommands];
  }

  /**
   * Clear command history
   */
  clearHistory(): void {
    this.commandHistory = [];
    this.sessionCommands = [];
  }

  /**
   * Get system information
   */
  async getSystemInfo(): Promise<SystemInfo | null> {
    if (!this.backend || !this.backend.getConnected()) {
      return null;
    }
    return await this.backend.getSystemInfo();
  }

  /**
   * Resize terminal (for proper rendering)
   */
  resize(cols: number, rows: number): void {
    if (this.backend && this.backend.getConnected()) {
      this.backend.resize(cols, rows);
    }
  }

  /**
   * Check if backend is connected
   */
  getConnected(): boolean {
    return this.isConnected && this.backend?.getConnected() === true;
  }

  /**
   * Register output callback
   */
  onOutput(callback: OutputCallback): void {
    this.outputCallbacks.push(callback);
  }

  /**
   * Remove output callback
   */
  offOutput(callback: OutputCallback): void {
    const index = this.outputCallbacks.indexOf(callback);
    if (index > -1) {
      this.outputCallbacks.splice(index, 1);
    }
  }

  /**
   * Register error callback
   */
  onError(callback: ErrorCallback): void {
    this.errorCallbacks.push(callback);
  }

  /**
   * Remove error callback
   */
  offError(callback: ErrorCallback): void {
    const index = this.errorCallbacks.indexOf(callback);
    if (index > -1) {
      this.errorCallbacks.splice(index, 1);
    }
  }

  /**
   * Register status change callback
   */
  onStatusChange(callback: StatusCallback): void {
    this.statusCallbacks.push(callback);
  }

  /**
   * Remove status change callback
   */
  offStatusChange(callback: StatusCallback): void {
    const index = this.statusCallbacks.indexOf(callback);
    if (index > -1) {
      this.statusCallbacks.splice(index, 1);
    }
  }

  /**
   * Update status and notify callbacks
   */
  private updateStatus(status: Parameters<StatusCallback>[0]): void {
    this.statusCallbacks.forEach(cb => cb(status));
  }

  /**
   * Disconnect and cleanup
   */
  dispose(): void {
    if (this.backend) {
      this.backend.disconnect();
    }
    this.outputCallbacks = [];
    this.errorCallbacks = [];
    this.statusCallbacks = [];
    this.commandCallbacks.clear();
    this.isConnected = false;
  }
}

