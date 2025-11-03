// Real terminal backend connection using WebSocket
export class RealTerminalBackend {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private isConnected: boolean = false;
  private onOutputCallback: ((data: string) => void) | null = null;
  private onExitCallback: ((code: number, signal: number) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;

  constructor(private serverUrl: string = 'ws://localhost:3000/ws') {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl);

        this.ws.onopen = () => {
          console.log('Connected to terminal backend');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
              case 'connected':
                this.sessionId = data.sessionId;
                if (this.onOutputCallback) {
                  this.onOutputCallback(`\x1b[32m[Connected]\x1b[0m Shell: ${data.shell}\r\n`);
                  this.onOutputCallback(`\x1b[32m[Connected]\x1b[0m CWD: ${data.cwd}\r\n`);
                }
                break;
                
              case 'output':
                if (this.onOutputCallback) {
                  this.onOutputCallback(data.data);
                }
                break;
                
              case 'exit':
                if (this.onExitCallback) {
                  this.onExitCallback(data.code, data.signal);
                }
                break;
                
              case 'error':
                if (this.onErrorCallback) {
                  this.onErrorCallback(data.message);
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
          console.error('WebSocket error:', error);
          this.isConnected = false;
          if (this.onErrorCallback) {
            this.onErrorCallback('Connection error');
          }
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket closed');
          this.isConnected = false;
          
          // Attempt to reconnect
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(() => {
              this.connect().catch(() => {
                // Will retry automatically
              });
            }, this.reconnectDelay * this.reconnectAttempts);
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  sendInput(data: string): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify({
        type: 'input',
        data: data
      }));
    }
  }

  resize(cols: number, rows: number): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify({
        type: 'resize',
        cols: cols,
        rows: rows
      }));
    }
  }

  kill(): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify({
        type: 'kill'
      }));
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
    return this.isConnected;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }
}

// REST API client for command execution
export class RESTBackend {
  constructor(private serverUrl: string = 'http://localhost:3000') {}

  async executeCommand(command: string, cwd?: string): Promise<{ output: string; exitCode: number }> {
    try {
      const response = await fetch(`${this.serverUrl}/api/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ command, cwd })
      });

      const data = await response.json();
      return {
        output: data.output || '',
        exitCode: data.exitCode || (data.success ? 0 : 1)
      };
    } catch (error: any) {
      return {
        output: `Error: ${error.message}`,
        exitCode: 1
      };
    }
  }

  async getSystemInfo(): Promise<any> {
    try {
      const response = await fetch(`${this.serverUrl}/api/info`);
      return await response.json();
    } catch (error: any) {
      return null;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.serverUrl}/api/health`);
      const data = await response.json();
      return data.status === 'ok';
    } catch (error) {
      return false;
    }
  }
}

