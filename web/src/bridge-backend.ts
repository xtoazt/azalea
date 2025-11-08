// Bridge backend that connects to local Node.js server
// This provides real system command execution and filesystem access

export interface BridgeMessage {
  type: 'connect' | 'input' | 'resize' | 'kill' | 'execute' | 'health' | 'info';
  data?: any;
  sessionId?: string;
  cols?: number;
  rows?: number;
  command?: string;
  cwd?: string;
}

export class BridgeBackend {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 1000;
  private isConnected: boolean = false;
  private isConnecting: boolean = false;
  private shouldReconnect: boolean = true;
  private onOutputCallback: ((data: string) => void) | null = null;
  private onExitCallback: ((code: number, signal: number) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private bridgeUrl: string;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(bridgeUrl: string = 'ws://127.0.0.1:8765/ws') {
    this.bridgeUrl = bridgeUrl;
  }

  async connect(): Promise<void> {
    // Prevent multiple simultaneous connection attempts
    if (this.isConnecting) {
      return new Promise((resolve, reject) => {
        // Wait for existing connection attempt
        const checkInterval = setInterval(() => {
          if (!this.isConnecting) {
            clearInterval(checkInterval);
            if (this.isConnected) {
              resolve();
            } else {
              reject(new Error('Previous connection attempt failed'));
            }
          }
        }, 100);
        
        setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error('Connection timeout waiting for previous attempt'));
        }, 15000);
      });
    }
    
    // If already connected, return immediately
    if (this.isConnected && this.sessionId) {
      return Promise.resolve();
    }
    
    this.isConnecting = true;
    this.shouldReconnect = true;
    
    return new Promise((resolve, reject) => {
      let timeout: ReturnType<typeof setTimeout> | null = null;
      let resolved = false;
      
      try {
        // Clean up any existing connection
        if (this.ws) {
          this.ws.onopen = null;
          this.ws.onmessage = null;
          this.ws.onerror = null;
          this.ws.onclose = null;
          try {
            this.ws.close();
          } catch (e) {
            // Ignore close errors
          }
          this.ws = null;
        }
        
        // Try connecting with longer timeout for ChromeOS
        timeout = setTimeout(() => {
          if (!this.sessionId && !resolved) {
            resolved = true;
            this.isConnecting = false;
            this.ws?.close();
            reject(new Error('Connection timeout'));
          }
        }, 15000); // Increased to 15 seconds for ChromeOS

        this.ws = new WebSocket(this.bridgeUrl);

        this.ws.onopen = () => {
          console.log('[BridgeBackend] WebSocket opened, waiting for session...');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          // Connection will be confirmed via handleMessage
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
              case 'connected':
                if (timeout) clearTimeout(timeout);
                if (!resolved) {
                  resolved = true;
                  this.isConnecting = false;
                  this.sessionId = data.sessionId;
                  this.isConnected = true;
                  this.reconnectAttempts = 0;
                  console.log('[BridgeBackend] Successfully connected, session:', this.sessionId);
                  if (this.onOutputCallback) {
                    this.onOutputCallback(`\x1b[32m[Connected]\x1b[0m Bridge: ${data.shell}\r\n`);
                    this.onOutputCallback(`\x1b[32m[Connected]\x1b[0m Platform: ${data.platform}\r\n`);
                    this.onOutputCallback(`\x1b[32m[Connected]\x1b[0m CWD: ${data.cwd}\r\n`);
                  }
                  resolve();
                }
                break;
                
              case 'output':
                if (this.onOutputCallback && data.sessionId === this.sessionId) {
                  this.onOutputCallback(data.data);
                }
                break;
                
              case 'exit':
                if (this.onExitCallback && data.sessionId === this.sessionId) {
                  this.onExitCallback(data.code || 0, data.signal || 0);
                }
                break;
                
              case 'error':
                if (this.onErrorCallback) {
                  this.onErrorCallback(data.message);
                }
                if (!resolved) {
                  resolved = true;
                  if (timeout) clearTimeout(timeout);
                  reject(new Error(data.message));
                }
                break;
                
              default:
                console.warn('Unknown message type:', data.type);
            }
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[BridgeBackend] WebSocket error:', error);
          // Don't reject immediately on error - wait for onclose
          // This prevents double rejection
        };

        this.ws.onclose = (event) => {
          console.log('[BridgeBackend] WebSocket closed', event.code, event.reason);
          this.isConnecting = false;
          this.isConnected = false;
          
          if (timeout) clearTimeout(timeout);
          
          // Only reject if we haven't resolved yet (connection attempt failed)
          if (!this.sessionId && !resolved) {
            resolved = true;
            reject(new Error(`Connection closed: ${event.code} ${event.reason || ''}`));
          }
          
          // Attempt to reconnect only if we had a session (connection was established)
          // and shouldReconnect is true
          if (this.sessionId && this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.sessionId = null;
            this.reconnectAttempts++;
            console.log(`[BridgeBackend] Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            // Clear any existing reconnect timeout
            if (this.reconnectTimeout) {
              clearTimeout(this.reconnectTimeout);
            }
            
            this.reconnectTimeout = setTimeout(() => {
              this.connect().catch((err) => {
                console.error('[BridgeBackend] Reconnection failed:', err);
              });
            }, this.reconnectDelay * this.reconnectAttempts);
          } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[BridgeBackend] Max reconnection attempts reached');
            if (this.onErrorCallback) {
              this.onErrorCallback('Max reconnection attempts reached');
            }
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.isConnecting = false;
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        this.ws.close();
      } catch (e) {
        // Ignore close errors
      }
      this.ws = null;
    }
    
    this.isConnected = false;
    this.sessionId = null;
    this.reconnectAttempts = 0;
  }

  sendInput(data: string): void {
    if (this.ws && this.isConnected && this.sessionId && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({
          type: 'input',
          sessionId: this.sessionId,
          data: data
        }));
      } catch (error) {
        console.error('[BridgeBackend] Error sending input:', error);
        this.isConnected = false;
      }
    }
  }

  resize(cols: number, rows: number): void {
    if (this.ws && this.isConnected && this.sessionId && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({
          type: 'resize',
          sessionId: this.sessionId,
          cols: cols,
          rows: rows
        }));
      } catch (error) {
        console.error('[BridgeBackend] Error sending resize:', error);
      }
    }
  }

  kill(): void {
    if (this.ws && this.isConnected && this.sessionId && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({
          type: 'kill',
          sessionId: this.sessionId
        }));
      } catch (error) {
        console.error('[BridgeBackend] Error sending kill:', error);
      }
    }
  }

  onOutput(callback: (data: string) => void): void {
    this.onOutputCallback = callback;
  }

  onExit(callback: (code: number, signal: number) => void): void {
    this.onExitCallback = callback;
  }

  onError(callback: (error: string) => void): void {
    this.onErrorCallback = callback;
  }

  getConnected(): boolean {
    return this.isConnected && this.sessionId !== null && 
           this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  async executeCommand(command: string, cwd?: string, root: boolean = false, privileged: boolean = false): Promise<{ output: string; exitCode: number }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for commands
      
      try {
        const response = await fetch('http://127.0.0.1:8765/api/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ command, cwd, root, privileged }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        
        if (!response.ok) {
          return {
            output: `HTTP Error: ${response.status} ${response.statusText}`,
            exitCode: 1
          };
        }

        const data = await response.json();
        return {
          output: data.output || '',
          exitCode: data.exitCode !== undefined ? data.exitCode : (data.success ? 0 : 1)
        };
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          return {
            output: 'Error: Command execution timeout',
            exitCode: 1
          };
        }
        throw fetchError;
      }
    } catch (error: any) {
      return {
        output: `Error: ${error.message || 'Unknown error'}`,
        exitCode: 1
      };
    }
  }

  async getSystemInfo(): Promise<any> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      try {
        const response = await fetch('http://127.0.0.1:8765/api/info', {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          return null;
        }
        
        return await response.json();
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.log('[BridgeBackend] System info request timeout');
        }
        return null;
      }
    } catch (error: any) {
      return null;
    }
  }

  async executeRootCommand(command: string, cwd?: string): Promise<{ output: string; exitCode: number }> {
    return this.executeCommand(command, cwd, true, false);
  }

  async executePrivilegedCommand(command: string, cwd?: string): Promise<{ output: string; exitCode: number }> {
    return this.executeCommand(command, cwd, false, true);
  }

  async getKernelParam(param: string): Promise<string> {
    try {
      const response = await fetch(`http://127.0.0.1:8765/api/system/kernel-param?param=${encodeURIComponent(param)}`);
      const data = await response.json();
      return data.value || '';
    } catch (error: any) {
      throw new Error(`Failed to read kernel parameter: ${error.message}`);
    }
  }

  async setKernelParam(param: string, value: string): Promise<void> {
    try {
      const response = await fetch('http://127.0.0.1:8765/api/system/kernel-param', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ param, value })
      });
      if (!response.ok) {
        throw new Error('Failed to set kernel parameter');
      }
    } catch (error: any) {
      throw new Error(`Failed to set kernel parameter: ${error.message}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      
      try {
        const response = await fetch('http://127.0.0.1:8765/api/health', {
          signal: controller.signal,
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          return false;
        }
        
        const data = await response.json();
        return data.status === 'ok' || data.healthy === true;
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.log('[BridgeBackend] Health check timeout');
        }
        return false;
      }
    } catch (error) {
      return false;
    }
  }
}

