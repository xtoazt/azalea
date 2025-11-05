// Filesystem Scanner Component
// Frontend component for filesystem scanning functionality

export interface ScanResult {
  totalFiles: number;
  totalDirectories: number;
  totalSize: number;
  files: any[];
  scanTime: number;
  timestamp: string;
}

export interface ScanProgress {
  progress: number;
  currentPath?: string;
  filesScanned?: number;
}

export class FilesystemScannerUI {
  private scanResult: ScanResult | null = null;
  private isScanning: boolean = false;
  private scanProgress: number = 0;

  /**
   * Scan filesystem
   */
  async scanFilesystem(
    path: string = '/',
    maxDepth: number = 10,
    excludePaths: string[] = []
  ): Promise<ScanResult> {
    if (this.isScanning) {
      throw new Error('Scan already in progress');
    }

    this.isScanning = true;
    this.scanProgress = 0;

    try {
      const response = await fetch('http://127.0.0.1:8765/api/filesystem/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, maxDepth, excludePaths })
      });

      const data = await response.json();

      if (data.success) {
        this.scanResult = data;
        this.scanProgress = 100;
        return data;
      } else {
        throw new Error(data.error || 'Scan failed');
      }
    } catch (error: any) {
      throw new Error(`Filesystem scan failed: ${error.message}`);
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Get scan progress
   */
  async getScanProgress(): Promise<ScanProgress> {
    try {
      const response = await fetch('http://127.0.0.1:8765/api/filesystem/scan/progress');
      const data = await response.json();
      
      if (data.success) {
        this.scanProgress = data.progress;
        return {
          progress: data.progress,
          filesScanned: data.filesScanned
        };
      }
    } catch (error) {
      // Ignore errors
    }
    
    return { progress: this.scanProgress };
  }

  /**
   * Get cached scan result
   */
  async getCachedScan(path: string = '/'): Promise<ScanResult | null> {
    try {
      const response = await fetch(`http://127.0.0.1:8765/api/filesystem/scan/cache?path=${encodeURIComponent(path)}`);
      const data = await response.json();
      
      if (data.success) {
        this.scanResult = data;
        return data;
      }
    } catch (error) {
      // Ignore errors
    }
    
    return null;
  }

  /**
   * Get filesystem summary (quick scan)
   */
  async getFilesystemSummary(path: string = '/'): Promise<any> {
    try {
      const response = await fetch(`http://127.0.0.1:8765/api/filesystem/summary?path=${encodeURIComponent(path)}`);
      const data = await response.json();
      
      if (data.success) {
        return data;
      }
    } catch (error: any) {
      throw new Error(`Failed to get summary: ${error.message}`);
    }
    
    return null;
  }

  /**
   * Scan specific directory
   */
  async scanDirectory(dirPath: string, maxDepth: number = 5): Promise<ScanResult> {
    return this.scanFilesystem(dirPath, maxDepth);
  }

  /**
   * Get current scan result
   */
  getScanResult(): ScanResult | null {
    return this.scanResult;
  }

  /**
   * Check if scanning is in progress
   */
  isScanningInProgress(): boolean {
    return this.isScanning;
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Format file tree for display
   */
  formatFileTree(files: any[], maxDepth: number = 5): string {
    return this.buildTreeString(files, '', 0, maxDepth);
  }

  private buildTreeString(files: any[], prefix: string, depth: number, maxDepth: number): string {
    if (depth > maxDepth) return '';
    
    let result = '';
    for (let i = 0; i < Math.min(files.length, 20); i++) {
      const file = files[i];
      const isLast = i === Math.min(files.length, 20) - 1;
      const connector = isLast ? '└── ' : '├── ';
      
      result += `${prefix}${connector}${file.name} (${file.type}, ${this.formatBytes(file.size)})\n`;
      
      if (file.children && file.children.length > 0 && depth < maxDepth) {
        const nextPrefix = prefix + (isLast ? '    ' : '│   ');
        result += this.buildTreeString(file.children, nextPrefix, depth + 1, maxDepth);
      }
    }
    
    if (files.length > 20) {
      result += `${prefix}... (${files.length - 20} more items)\n`;
    }
    
    return result;
  }
}

// Export singleton instance
export const filesystemScannerUI = new FilesystemScannerUI();

// Expose to window for global access
if (typeof window !== 'undefined') {
  (window as any).filesystemScannerUI = filesystemScannerUI;
}

