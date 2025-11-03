// Wrapper class that provides the same interface as RealTerminalBackend
// but uses a Web Worker instead of WebSocket

export class WebWorkerBackendWrapper {
  private worker: Worker | null = null;
  private sessionId: string | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private onOutputCallback: ((data: string) => void) | null = null;
  private onExitCallback: ((code: number, signal: number) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private messageQueue: any[] = [];

  constructor() {
    // Worker will be created on connect
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create Web Worker from the backend-worker.ts file
        // Vite handles workers with ?worker suffix
        this.worker = new Worker(
          new URL('./backend-worker.ts?worker', import.meta.url),
          { type: 'module' }
        );

        this.worker.onmessage = (event: MessageEvent) => {
          this.handleMessage(event.data);
        };

        this.worker.onerror = (error) => {
          console.error('Web Worker error:', error);
          this.isConnected = false;
          if (this.onErrorCallback) {
            this.onErrorCallback('Worker error');
          }
          reject(error);
        };

        // Request connection
        this.worker.postMessage({ type: 'connect' });
        
        // Wait for connection confirmation
        const timeout = setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('Connection timeout'));
          }
        }, 5000);

        // Connection will be confirmed via handleMessage
        this.resolveConnection = () => {
          clearTimeout(timeout);
          resolve();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private resolveConnection?: () => void;

  private handleMessage(data: any): void {
    switch (data.type) {
      case 'connected':
        this.sessionId = data.sessionId;
        this.isConnected = true;
        this.reconnectAttempts = 0;
        if (this.resolveConnection) {
          this.resolveConnection();
          this.resolveConnection = undefined;
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
        break;
        
      case 'health':
        // Health check response
        break;
        
      case 'info':
        // System info response
        break;
        
      case 'execute-result':
        // REST API response
        break;
    }
  }

  disconnect(): void {
    if (this.worker) {
      if (this.sessionId) {
        this.worker.postMessage({ type: 'kill', sessionId: this.sessionId });
      }
      this.worker.terminate();
      this.worker = null;
    }
    this.isConnected = false;
  }

  sendInput(data: string): void {
    if (this.worker && this.isConnected && this.sessionId) {
      this.worker.postMessage({
        type: 'input',
        sessionId: this.sessionId,
        data: data
      });
    } else if (!this.isConnected) {
      // Queue message if not connected yet
      this.messageQueue.push({ type: 'input', data });
    }
  }

  resize(cols: number, rows: number): void {
    if (this.worker && this.isConnected && this.sessionId) {
      this.worker.postMessage({
        type: 'resize',
        sessionId: this.sessionId,
        cols: cols,
        rows: rows
      });
    }
  }

  kill(): void {
    if (this.worker && this.sessionId) {
      this.worker.postMessage({
        type: 'kill',
        sessionId: this.sessionId
      });
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

  async executeCommand(command: string, cwd?: string): Promise<{ output: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const handler = (event: MessageEvent) => {
        if (event.data.type === 'execute-result') {
          this.worker?.removeEventListener('message', handler);
          resolve(event.data.data);
        }
      };

      this.worker.addEventListener('message', handler);
      this.worker.postMessage({
        type: 'execute',
        command: command,
        cwd: cwd
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        this.worker?.removeEventListener('message', handler);
        reject(new Error('Command execution timeout'));
      }, 30000);
    });
  }

  async getSystemInfo(): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const handler = (event: MessageEvent) => {
        if (event.data.type === 'info') {
          this.worker?.removeEventListener('message', handler);
          resolve(event.data.data);
        }
      };

      this.worker.addEventListener('message', handler);
      this.worker.postMessage({ type: 'info' });

      setTimeout(() => {
        this.worker?.removeEventListener('message', handler);
        reject(new Error('Info request timeout'));
      }, 5000);
    });
  }

  async healthCheck(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.worker) {
        resolve(false);
        return;
      }

      const handler = (event: MessageEvent) => {
        if (event.data.type === 'health') {
          this.worker?.removeEventListener('message', handler);
          resolve(event.data.data?.status === 'ok');
        }
      };

      this.worker.addEventListener('message', handler);
      this.worker.postMessage({ type: 'health' });

      setTimeout(() => {
        this.worker?.removeEventListener('message', handler);
        resolve(false);
      }, 2000);
    });
  }
}

