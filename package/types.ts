/**
 * Type definitions for Clay Terminal Backend API
 * Pure backend - no UI dependencies
 */

export interface ClayBackendConfig {
  /** WebSocket URL for bridge backend (optional, for real system access) */
  bridgeUrl?: string;
  
  /** Enable AI assistant features */
  enableAI?: boolean;
  
  /** AI API configuration */
  aiConfig?: AIAssistantConfig;
  
  /** Auto-start bridge connection */
  autoConnectBridge?: boolean;
  
  /** Enable session sharing */
  enableSharing?: boolean;
  
  /** Enable command history */
  enableHistory?: boolean;
  
  /** Maximum history size */
  maxHistory?: number;
  
  /** Current working directory */
  cwd?: string;
}

export interface AIAssistantConfig {
  /** AI API base URL */
  apiBaseUrl?: string;
  
  /** AI API key */
  apiKey?: string;
  
  /** Default AI model */
  defaultModel?: string;
  
  /** Available AI models */
  models?: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

export interface TerminalBackend {
  connect(): Promise<void>;
  disconnect(): void;
  sendInput(data: string): void;
  executeCommand(command: string, cwd?: string): Promise<CommandResult>;
  getSystemInfo(): Promise<SystemInfo | null>;
  resize(cols: number, rows: number): void;
  getConnected(): boolean;
  onOutput(callback: OutputCallback): void;
  onExit(callback: (code: number, signal: number) => void): void;
  onError(callback: ErrorCallback): void;
}

export interface CommandResult {
  output: string;
  exitCode: number;
  error?: string;
  stdout?: string;
  stderr?: string;
}

export interface SystemInfo {
  platform: string;
  shell: string;
  cwd: string;
  homeDir: string;
  user?: string;
  hostname?: string;
  arch?: string;
}

export interface ProcessInfo {
  pid: number;
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
}

export type OutputCallback = (data: string) => void;
export type ErrorCallback = (error: string) => void;
export type StatusCallback = (status: {
  backend: 'connected' | 'disconnected' | 'connecting' | 'error';
  ai?: 'ready' | 'idle' | 'thinking' | 'error';
}) => void;
export type CommandCallback = (result: CommandResult) => void;
