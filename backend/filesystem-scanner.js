// Filesystem Scanner - Recursively scans root filesystem
// Collects file structure, metadata, and builds comprehensive file tree

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

/**
 * Execute command with root privileges
 */
async function executeAsRoot(command) {
  const isRoot = process.getuid && process.getuid() === 0;
  
  if (!isRoot && process.platform !== 'win32') {
    const fullCommand = `sudo -n ${command}`;
    try {
      const result = await execAsync(fullCommand);
      return result.stdout || result.stderr || '';
    } catch (error) {
      try {
        const result = await execAsync(`pkexec ${command}`);
        return result.stdout || result.stderr || '';
      } catch (e) {
        throw new Error(`Root access required: ${error.message}`);
      }
    }
  } else {
    const result = await execAsync(command);
    return result.stdout || result.stderr || '';
  }
}

/**
 * @typedef {Object} FileInfo
 * @property {string} path
 * @property {string} name
 * @property {'file'|'directory'|'symlink'|'device'|'socket'|'pipe'} type
 * @property {number} size
 * @property {string} permissions
 * @property {string} owner
 * @property {string} group
 * @property {string} modified
 * @property {string} accessed
 * @property {FileInfo[]} [children]
 */

/**
 * @typedef {Object} ScanResult
 * @property {number} totalFiles
 * @property {number} totalDirectories
 * @property {number} totalSize
 * @property {FileInfo[]} files
 * @property {number} scanTime
 * @property {string} timestamp
 */

/**
 * Filesystem Scanner
 */
export class FilesystemScanner {
  scanCache = new Map();
  isScanning = false;
  scanProgress = 0;

  /**
   * Scan filesystem starting from root or specified path
   */
  /**
   * @param {string} [rootPath='/']
   * @param {number} [maxDepth=10]
   * @param {string[]} [excludePaths=[]]
   * @returns {Promise<ScanResult>}
   */
  async scanFilesystem(rootPath = '/', maxDepth = 10, excludePaths = []) {
    if (this.isScanning) {
      throw new Error('Scan already in progress');
    }

    this.isScanning = true;
    this.scanProgress = 0;

    const startTime = Date.now();
    const excludeSet = new Set([
      '/proc',
      '/sys',
      '/dev',
      '/run',
      '/tmp',
      '/var/run',
      '/var/lock',
      ...excludePaths
    ]);

    try {
      const files: FileInfo[] = [];
      let totalFiles = 0;
      let totalDirectories = 0;
      let totalSize = 0;

      // Use find command with root access for comprehensive scanning
      const findCommand = `find ${rootPath} -maxdepth ${maxDepth} -type f -o -type d 2>/dev/null | head -10000`;
      const findResult = await executeAsRoot(findCommand);
      
      const paths = findResult.split('\n').filter(p => p.trim() && !this.shouldExclude(p, excludeSet));
      
      // Process paths in batches
      const batchSize = 100;
      for (let i = 0; i < paths.length; i += batchSize) {
        const batch = paths.slice(i, i + batchSize);
        await Promise.all(batch.map(async (filePath) => {
          try {
            const info = await this.getFileInfo(filePath);
            if (info) {
              files.push(info);
              if (info.type === 'file') {
                totalFiles++;
                totalSize += info.size;
              } else if (info.type === 'directory') {
                totalDirectories++;
              }
            }
          } catch (error) {
            // Skip files that can't be accessed
          }
        }));
        
        this.scanProgress = Math.min((i + batchSize) / paths.length * 100, 100);
      }

      // Build file tree structure
      const fileTree = this.buildFileTree(files, rootPath);

      const scanTime = Date.now() - startTime;
      const result: ScanResult = {
        totalFiles,
        totalDirectories,
        totalSize,
        files: fileTree,
        scanTime,
        timestamp: new Date().toISOString()
      };

      // Cache result
      this.scanCache.set(rootPath, result);
      
      this.isScanning = false;
      this.scanProgress = 100;

      return result;
    } catch (error) {
      this.isScanning = false;
      this.scanProgress = 0;
      throw error;
    }
  }

  /**
   * Get file information
   */
  /**
   * @param {string} filePath
   * @returns {Promise<FileInfo|null>}
   */
  async getFileInfo(filePath) {
    try {
      const stats = await fs.promises.lstat(filePath);
      
      let type = 'file';
      if (stats.isDirectory()) type = 'directory';
      else if (stats.isSymbolicLink()) type = 'symlink';
      else if (stats.isBlockDevice() || stats.isCharacterDevice()) type = 'device';
      else if (stats.isSocket()) type = 'socket';
      else if (stats.isFIFO()) type = 'pipe';

      // Get permissions
      const mode = stats.mode.toString(8);
      const permissions = mode.slice(-3);

      // Get owner and group (requires root)
      let owner = 'unknown';
      let group = 'unknown';
      try {
        const statResult = await executeAsRoot(`stat -c "%U:%G" ${filePath} 2>/dev/null || echo "unknown:unknown"`);
        const parts = statResult.trim().split(':');
        if (parts.length === 2) {
          owner = parts[0];
          group = parts[1];
        }
      } catch {
        // Fallback if stat fails
      }

      return {
        path: filePath,
        name: path.basename(filePath),
        type,
        size: stats.size,
        permissions,
        owner,
        group,
        modified: stats.mtime.toISOString(),
        accessed: stats.atime.toISOString()
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Build hierarchical file tree
   */
  /**
   * @param {FileInfo[]} files
   * @param {string} rootPath
   * @returns {FileInfo[]}
   */
  buildFileTree(files, rootPath) {
    const tree = [];
    const pathMap = new Map();

    // Sort files by path depth
    files.sort((a, b) => a.path.split('/').length - b.path.split('/').length);

    // Build tree structure
    for (const file of files) {
      pathMap.set(file.path, { ...file, children: [] });
      
      const parentPath = path.dirname(file.path);
      if (parentPath !== file.path && parentPath !== '.') {
        const parent = pathMap.get(parentPath);
        if (parent && parent.type === 'directory') {
          if (!parent.children) parent.children = [];
          parent.children.push(pathMap.get(file.path)!);
        } else if (parentPath === rootPath || parentPath === '/') {
          tree.push(pathMap.get(file.path)!);
        }
      } else if (file.path === rootPath || file.path === '/') {
        tree.push(file);
      }
    }

    return tree;
  }

  /**
   * Check if path should be excluded
   */
  /**
   * @param {string} filePath
   * @param {Set<string>} excludeSet
   * @returns {boolean}
   */
  shouldExclude(filePath, excludeSet) {
    for (const exclude of excludeSet) {
      if (filePath.startsWith(exclude)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get scan progress
   */
  getScanProgress() {
    return this.scanProgress;
  }

  /**
   * Get cached scan result
   */
  /**
   * @param {string} rootPath
   * @returns {ScanResult|null}
   */
  getCachedScan(rootPath) {
    return this.scanCache.get(rootPath) || null;
  }

  /**
   * Clear scan cache
   */
  clearCache(): void {
    this.scanCache.clear();
  }

  /**
   * Get filesystem summary (quick scan)
   */
  /**
   * @param {string} [rootPath='/']
   * @returns {Promise<any>}
   */
  async getFilesystemSummary(rootPath = '/') {
    try {
      const [diskUsage, fileCount, dirCount] = await Promise.all([
        executeAsRoot(`du -sh ${rootPath} 2>/dev/null || echo "0"`).catch(() => ({ stdout: '0' })),
        executeAsRoot(`find ${rootPath} -type f 2>/dev/null | wc -l`).catch(() => ({ stdout: '0' })),
        executeAsRoot(`find ${rootPath} -type d 2>/dev/null | wc -l`).catch(() => ({ stdout: '0' }))
      ]);

      return {
        path: rootPath,
        diskUsage: diskUsage.stdout.trim(),
        fileCount: parseInt(fileCount.stdout.trim()) || 0,
        dirCount: parseInt(dirCount.stdout.trim()) || 0
      };
    } catch (error) {
      throw new Error(`Failed to get filesystem summary: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Scan specific directory (home, etc, usr, etc.)
   */
  /**
   * @param {string} dirPath
   * @param {number} [maxDepth=5]
   * @returns {Promise<ScanResult>}
   */
  async scanDirectory(dirPath, maxDepth = 5) {
    return this.scanFilesystem(dirPath, maxDepth);
  }
}

// Export singleton instance
export const filesystemScanner = new FilesystemScanner();

