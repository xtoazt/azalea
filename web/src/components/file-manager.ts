/**
 * File Manager Component
 * Provides file system navigation and operations
 */

import { notificationManager } from './notification';

export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
  permissions?: string;
}

export class FileManager {
  private container: HTMLElement | null = null;
  public isVisible: boolean = false;
  private currentPath: string = '/';
  private fileList: HTMLElement | null = null;
  private pathInput: HTMLInputElement | null = null;
  private backend: any = null;
  private files: FileItem[] = [];
  private selectedItem: string | null = null;

  constructor(backend?: any) {
    this.backend = backend || null;
    this.createContainer();
    this.setupEventListeners();
  }

  /**
   * Set backend instance
   */
  setBackend(backend: any): void {
    this.backend = backend;
  }

  /**
   * Create the file manager container
   */
  private createContainer(): void {
    this.container = document.createElement('div');
    this.container.id = 'file-manager';
    this.container.className = 'file-manager-container';
    this.container.innerHTML = `
      <div class="file-manager-header">
        <div class="file-manager-title">
          <i data-lucide="folder"></i>
          <span>File Manager</span>
        </div>
        <div class="file-manager-actions">
          <button id="fm-refresh" class="fm-btn" title="Refresh">
            <i data-lucide="refresh-cw"></i>
          </button>
          <button id="fm-new-file" class="fm-btn" title="New File">
            <i data-lucide="file-plus"></i>
          </button>
          <button id="fm-new-folder" class="fm-btn" title="New Folder">
            <i data-lucide="folder-plus"></i>
          </button>
          <button id="fm-upload" class="fm-btn" title="Upload">
            <i data-lucide="upload"></i>
          </button>
          <button id="fm-toggle" class="fm-btn" title="Toggle File Manager">
            <i data-lucide="x"></i>
          </button>
        </div>
      </div>
      <div class="file-manager-path">
        <button id="fm-home" class="fm-btn-icon" title="Home">
          <i data-lucide="home"></i>
        </button>
        <button id="fm-up" class="fm-btn-icon" title="Up">
          <i data-lucide="arrow-up"></i>
        </button>
        <input 
          type="text" 
          id="fm-path-input" 
          class="fm-path-input" 
          placeholder="/"
          value="/"
        />
        <button id="fm-go" class="fm-btn-icon" title="Go">
          <i data-lucide="arrow-right"></i>
        </button>
      </div>
      <div class="file-manager-toolbar">
        <button id="fm-view-list" class="fm-view-btn active" title="List View">
          <i data-lucide="list"></i>
        </button>
        <button id="fm-view-grid" class="fm-view-btn" title="Grid View">
          <i data-lucide="grid"></i>
        </button>
        <div class="fm-spacer"></div>
        <input 
          type="text" 
          id="fm-search" 
          class="fm-search-input" 
          placeholder="Search files..."
        />
      </div>
      <div id="fm-file-list" class="file-manager-list">
        <div class="fm-loading">Loading...</div>
      </div>
      <div class="file-manager-footer">
        <div class="fm-info">
          <span id="fm-item-count">0 items</span>
        </div>
        <div class="fm-actions-footer">
          <button id="fm-delete" class="fm-btn-danger" disabled title="Delete">
            <i data-lucide="trash-2"></i>
            <span>Delete</span>
          </button>
          <button id="fm-rename" class="fm-btn-secondary" disabled title="Rename">
            <i data-lucide="edit"></i>
            <span>Rename</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(this.container);
    this.fileList = document.getElementById('fm-file-list');
    this.pathInput = document.getElementById('fm-path-input') as HTMLInputElement;
    
    // Initialize Lucide icons
    if ((window as any).lucide) {
      (window as any).lucide.createIcons();
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    if (!this.container) return;

    // Toggle visibility
    const toggleBtn = document.getElementById('fm-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggle());
    }

    // Navigation
    const homeBtn = document.getElementById('fm-home');
    if (homeBtn) {
      homeBtn.addEventListener('click', () => this.navigateTo('/'));
    }

    const upBtn = document.getElementById('fm-up');
    if (upBtn) {
      upBtn.addEventListener('click', () => this.navigateUp());
    }

    const goBtn = document.getElementById('fm-go');
    if (goBtn) {
      goBtn.addEventListener('click', () => {
        if (this.pathInput) {
          this.navigateTo(this.pathInput.value);
        }
      });
    }

    if (this.pathInput) {
      this.pathInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.navigateTo(this.pathInput!.value);
        }
      });
    }

    // Actions
    const refreshBtn = document.getElementById('fm-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refresh());
    }

    const newFileBtn = document.getElementById('fm-new-file');
    if (newFileBtn) {
      newFileBtn.addEventListener('click', () => this.createNewFile());
    }

    const newFolderBtn = document.getElementById('fm-new-folder');
    if (newFolderBtn) {
      newFolderBtn.addEventListener('click', () => this.createNewFolder());
    }

    const deleteBtn = document.getElementById('fm-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => this.deleteSelected());
    }

    const renameBtn = document.getElementById('fm-rename');
    if (renameBtn) {
      renameBtn.addEventListener('click', () => this.renameSelected());
    }

    // View toggle
    const listViewBtn = document.getElementById('fm-view-list');
    const gridViewBtn = document.getElementById('fm-view-grid');
    
    if (listViewBtn) {
      listViewBtn.addEventListener('click', () => this.setView('list'));
    }
    
    if (gridViewBtn) {
      gridViewBtn.addEventListener('click', () => this.setView('grid'));
    }
  }

  /**
   * Toggle file manager visibility
   */
  toggle(): void {
    this.isVisible = !this.isVisible;
    if (this.container) {
      if (this.isVisible) {
        this.container.classList.add('visible');
        this.refresh();
      } else {
        this.container.classList.remove('visible');
      }
    }
  }

  /**
   * Show file manager
   */
  show(): void {
    this.isVisible = true;
    if (this.container) {
      this.container.classList.add('visible');
      // Ensure container is visible and properly positioned
      this.container.style.display = 'flex';
      this.container.style.flexDirection = 'column';
      this.refresh();
    }
  }

  /**
   * Hide file manager
   */
  hide(): void {
    this.isVisible = false;
    if (this.container) {
      this.container.classList.remove('visible');
    }
  }

  /**
   * Navigate to a path
   */
  async navigateTo(path: string): Promise<void> {
    if (!this.backend) {
      notificationManager.warning('Backend not available');
      return;
    }

    try {
      this.currentPath = path;
      if (this.pathInput) {
        this.pathInput.value = path;
      }

      // List directory contents
      const result = await this.backend.executeCommand(`ls -la "${path}" 2>/dev/null || echo "ERROR"`);
      
      if (result.exitCode !== 0 || result.output.includes('ERROR')) {
        notificationManager.error(`Cannot access: ${path}`);
        return;
      }

      this.parseFileList(result.output);
      this.renderFileList();
    } catch (error: any) {
      notificationManager.error(`Failed to navigate: ${error.message}`);
    }
  }

  /**
   * Navigate up one directory
   */
  navigateUp(): void {
    const parent = this.currentPath.split('/').slice(0, -1).join('/') || '/';
    this.navigateTo(parent);
  }

  /**
   * Parse ls -la output
   */
  private parseFileList(output: string): void {
    this.files = [];
    const lines = output.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      // Skip header and empty lines
      if (line.startsWith('total') || !line.trim()) continue;
      
      const parts = line.trim().split(/\s+/);
      if (parts.length < 9) continue;

      const permissions = parts[0];
      const size = parseInt(parts[4], 10) || 0;
      const date = parts.slice(5, 8).join(' ');
      const name = parts.slice(8).join(' ');
      
      // Skip . and ..
      if (name === '.' || name === '..') continue;

      const isDirectory = permissions.startsWith('d');
      const fullPath = this.currentPath === '/' 
        ? `/${name}` 
        : `${this.currentPath}/${name}`.replace(/\/+/g, '/');

      this.files.push({
        name,
        path: fullPath,
        type: isDirectory ? 'directory' : 'file',
        size: isDirectory ? undefined : size,
        modified: date,
        permissions,
      });
    }

    // Sort: directories first, then files
    this.files.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Render file list
   */
  private renderFileList(): void {
    if (!this.fileList) return;

    const view = this.fileList.classList.contains('grid-view') ? 'grid' : 'list';
    
    if (this.files.length === 0) {
      this.fileList.innerHTML = '<div class="fm-empty">No files found</div>';
      return;
    }

    let html = '';
    for (const file of this.files) {
      const icon = file.type === 'directory' ? 'folder' : this.getFileIcon(file.name);
      const size = file.size ? this.formatSize(file.size) : '-';
      const selected = this.selectedItem === file.path ? 'selected' : '';
      
      if (view === 'list') {
        html += `
          <div class="fm-item ${selected}" data-path="${file.path}" data-type="${file.type}">
            <div class="fm-item-icon">
              <i data-lucide="${icon}"></i>
            </div>
            <div class="fm-item-name" title="${file.name}">${this.escapeHtml(file.name)}</div>
            <div class="fm-item-size">${size}</div>
            <div class="fm-item-modified">${file.modified || '-'}</div>
          </div>
        `;
      } else {
        html += `
          <div class="fm-item-grid ${selected}" data-path="${file.path}" data-type="${file.type}">
            <div class="fm-item-icon-grid">
              <i data-lucide="${icon}"></i>
            </div>
            <div class="fm-item-name-grid" title="${file.name}">${this.escapeHtml(file.name)}</div>
          </div>
        `;
      }
    }

    this.fileList.innerHTML = html;
    
    // Initialize icons
    if ((window as any).lucide) {
      (window as any).lucide.createIcons();
    }

    // Add click handlers
    const items = this.fileList.querySelectorAll('.fm-item, .fm-item-grid');
    items.forEach(item => {
      item.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const path = target.getAttribute('data-path');
        const type = target.getAttribute('data-type');
        
        if (path) {
          if ((e as KeyboardEvent).shiftKey || (e as KeyboardEvent).ctrlKey || (e as KeyboardEvent).metaKey) {
            // Multi-select (future enhancement)
            this.selectedItem = path;
          } else {
            this.selectedItem = path;
            if (type === 'directory') {
              this.navigateTo(path);
            } else {
              this.openFile(path);
            }
          }
          this.renderFileList();
          this.updateActionButtons();
        }
      });

      item.addEventListener('dblclick', (e) => {
        const target = e.currentTarget as HTMLElement;
        const path = target.getAttribute('data-path');
        const type = target.getAttribute('data-type');
        
        if (path && type === 'directory') {
          this.navigateTo(path);
        } else if (path) {
          this.openFile(path);
        }
      });
    });

    // Update item count
    const countEl = document.getElementById('fm-item-count');
    if (countEl) {
      const dirs = this.files.filter(f => f.type === 'directory').length;
      const files = this.files.filter(f => f.type === 'file').length;
      countEl.textContent = `${this.files.length} items (${dirs} dirs, ${files} files)`;
    }
  }

  /**
   * Get file icon based on extension
   */
  private getFileIcon(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const iconMap: Record<string, string> = {
      'js': 'file-code',
      'ts': 'file-code',
      'tsx': 'file-code',
      'jsx': 'file-code',
      'py': 'file-code',
      'java': 'file-code',
      'cpp': 'file-code',
      'c': 'file-code',
      'html': 'file-code',
      'css': 'file-code',
      'json': 'file-code',
      'xml': 'file-code',
      'yaml': 'file-code',
      'yml': 'file-code',
      'md': 'file-text',
      'txt': 'file-text',
      'pdf': 'file-text',
      'doc': 'file-text',
      'docx': 'file-text',
      'jpg': 'image',
      'jpeg': 'image',
      'png': 'image',
      'gif': 'image',
      'svg': 'image',
      'mp4': 'video',
      'avi': 'video',
      'mov': 'video',
      'mp3': 'audio',
      'wav': 'audio',
      'zip': 'archive',
      'tar': 'archive',
      'gz': 'archive',
    };
    return iconMap[ext] || 'file';
  }

  /**
   * Format file size
   */
  private formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Escape HTML
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Set view mode
   */
  private setView(mode: 'list' | 'grid'): void {
    if (!this.fileList) return;

    if (mode === 'list') {
      this.fileList.classList.remove('grid-view');
      this.fileList.classList.add('list-view');
      document.getElementById('fm-view-list')?.classList.add('active');
      document.getElementById('fm-view-grid')?.classList.remove('active');
    } else {
      this.fileList.classList.remove('list-view');
      this.fileList.classList.add('grid-view');
      document.getElementById('fm-view-list')?.classList.remove('active');
      document.getElementById('fm-view-grid')?.classList.add('active');
    }

    this.renderFileList();
  }

  /**
   * Refresh file list
   */
  refresh(): void {
    this.navigateTo(this.currentPath);
  }

  /**
   * Open file
   */
  private openFile(path: string): void {
    // Send command to terminal to open file
    const terminal = (window as any).clayTerminal;
    if (terminal && terminal.terminal) {
      terminal.terminal.write(`\r\ncat "${path}"\r\n`);
      if (terminal.backend && terminal.backend.getConnected()) {
        terminal.backend.sendInput(`cat "${path}"\r\n`);
      }
    }
  }

  /**
   * Create new file
   */
  private async createNewFile(): Promise<void> {
    const name = prompt('Enter file name:');
    if (!name) return;

    if (!this.backend) {
      notificationManager.warning('Backend not available');
      return;
    }

    try {
      const path = this.currentPath === '/' 
        ? `/${name}` 
        : `${this.currentPath}/${name}`.replace(/\/+/g, '/');
      
      const result = await this.backend.executeCommand(`touch "${path}"`);
      if (result.exitCode === 0) {
        notificationManager.success(`File created: ${name}`);
        this.refresh();
      } else {
        notificationManager.error(`Failed to create file: ${result.output}`);
      }
    } catch (error: any) {
      notificationManager.error(`Error: ${error.message}`);
    }
  }

  /**
   * Create new folder
   */
  private async createNewFolder(): Promise<void> {
    const name = prompt('Enter folder name:');
    if (!name) return;

    if (!this.backend) {
      notificationManager.warning('Backend not available');
      return;
    }

    try {
      const path = this.currentPath === '/' 
        ? `/${name}` 
        : `${this.currentPath}/${name}`.replace(/\/+/g, '/');
      
      const result = await this.backend.executeCommand(`mkdir -p "${path}"`);
      if (result.exitCode === 0) {
        notificationManager.success(`Folder created: ${name}`);
        this.refresh();
      } else {
        notificationManager.error(`Failed to create folder: ${result.output}`);
      }
    } catch (error: any) {
      notificationManager.error(`Error: ${error.message}`);
    }
  }

  /**
   * Delete selected item
   */
  private async deleteSelected(): Promise<void> {
    if (!this.selectedItem) {
      notificationManager.warning('No item selected');
      return;
    }

    if (!confirm(`Delete ${this.selectedItem}?`)) {
      return;
    }

    if (!this.backend) {
      notificationManager.warning('Backend not available');
      return;
    }

    try {
      const result = await this.backend.executeCommand(`rm -rf "${this.selectedItem}"`);
      if (result.exitCode === 0) {
        notificationManager.success('Item deleted');
        this.selectedItem = null;
        this.refresh();
        this.updateActionButtons();
      } else {
        notificationManager.error(`Failed to delete: ${result.output}`);
      }
    } catch (error: any) {
      notificationManager.error(`Error: ${error.message}`);
    }
  }

  /**
   * Rename selected item
   */
  private async renameSelected(): Promise<void> {
    if (!this.selectedItem) {
      notificationManager.warning('No item selected');
      return;
    }

    const newName = prompt('Enter new name:', this.selectedItem.split('/').pop() || '');
    if (!newName) return;

    if (!this.backend) {
      notificationManager.warning('Backend not available');
      return;
    }

    try {
      const parent = this.selectedItem.split('/').slice(0, -1).join('/') || '/';
      const newPath = parent === '/' ? `/${newName}` : `${parent}/${newName}`;
      
      const result = await this.backend.executeCommand(`mv "${this.selectedItem}" "${newPath}"`);
      if (result.exitCode === 0) {
        notificationManager.success('Item renamed');
        this.selectedItem = null;
        this.refresh();
        this.updateActionButtons();
      } else {
        notificationManager.error(`Failed to rename: ${result.output}`);
      }
    } catch (error: any) {
      notificationManager.error(`Error: ${error.message}`);
    }
  }

  /**
   * Update action buttons state
   */
  private updateActionButtons(): void {
    const deleteBtn = document.getElementById('fm-delete');
    const renameBtn = document.getElementById('fm-rename');
    const hasSelection = this.selectedItem !== null;

    if (deleteBtn) {
      (deleteBtn as HTMLButtonElement).disabled = !hasSelection;
    }
    if (renameBtn) {
      (renameBtn as HTMLButtonElement).disabled = !hasSelection;
    }
  }

  /**
   * Get current path
   */
  getCurrentPath(): string {
    return this.currentPath;
  }
}

// Export singleton instance
export const fileManager = new FileManager();

