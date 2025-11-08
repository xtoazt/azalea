// Tab bar component for multi-tab terminal management

import { TerminalTab } from '../types/terminal';
import { multiWindowSync } from './multi-window-sync';

export interface TabBarConfig {
  onTabCreate: () => void;
  onTabClose: (tabId: string) => void;
  onTabSwitch: (tabId: string) => void;
  onTabRename: (tabId: string, newTitle: string) => void;
}

class TabBar {
  private container: HTMLElement | null = null;
  private tabs: TerminalTab[] = [];
  private activeTabId: string | null = null;
  private config: TabBarConfig | null = null;

  constructor() {
    this.createContainer();
    this.setupStyles();
  }

  private createContainer(): void {
    this.container = document.createElement('div');
    this.container.id = 'terminal-tab-bar';
    this.container.className = 'terminal-tab-bar';
    
    const addButton = document.createElement('button');
    addButton.id = 'tab-add-button';
    addButton.className = 'tab-add-button';
    addButton.innerHTML = `
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
      </svg>
    `;
    addButton.title = 'New Tab (Ctrl+Shift+T)';
    addButton.setAttribute('aria-label', 'Create new terminal tab');
    addButton.setAttribute('type', 'button');
    addButton.addEventListener('click', () => {
      if (this.config) {
        this.config.onTabCreate();
      }
    });

    this.container.appendChild(addButton);
    
    // Insert before terminal container
    const terminalElement = document.getElementById('terminal');
    if (terminalElement && terminalElement.parentElement && this.container) {
      // Ensure container is a valid Node before inserting
      if (this.container instanceof Node) {
        terminalElement.parentElement.insertBefore(this.container, terminalElement);
      }
    }
  }

  private setupStyles(): void {
    if (!document.getElementById('tab-bar-styles')) {
      const style = document.createElement('style');
      style.id = 'tab-bar-styles';
      style.textContent = `
        .terminal-tab-bar {
          display: flex;
          align-items: center;
          background: #2A2D3A;
          border-bottom: 2px solid #424658;
          padding: 0.25rem 0.5rem;
          gap: 0.25rem;
          overflow-x: auto;
          scrollbar-width: thin;
          scrollbar-color: #6C739C transparent;
        }
        
        .terminal-tab-bar::-webkit-scrollbar {
          height: 6px;
        }
        
        .terminal-tab-bar::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .terminal-tab-bar::-webkit-scrollbar-thumb {
          background: #6C739C;
          border-radius: 3px;
        }
        
        .terminal-tab {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: #353849;
          border: 2px solid #424658;
          border-radius: 0.5rem 0.5rem 0 0;
          cursor: pointer;
          min-width: 120px;
          max-width: 200px;
          position: relative;
          user-select: none;
        }
        
        .terminal-tab:hover {
          background: #424658;
          border-color: #6C739C;
        }
        
        .terminal-tab.active {
          background: #2A2D3A;
          border-color: #6C739C;
          border-bottom-color: transparent;
        }
        
        .terminal-tab.active::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          right: 0;
          height: 2px;
          background: #6C739C;
        }
        
        .terminal-tab.synced {
          border-left: 3px solid #8B92B5;
        }
        
        .terminal-tab.synced::before {
          content: '🔗';
          font-size: 0.75rem;
          margin-right: 0.25rem;
        }
        
        .terminal-tab-title {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #F0DAD5;
          font-size: 0.875rem;
          font-weight: 600;
        }
        
        .terminal-tab-close {
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 0.25rem;
          opacity: 0.6;
          flex-shrink: 0;
          color: #F0DAD5;
        }
        
        .terminal-tab-close:hover {
          opacity: 1;
          background: #C56B62;
          color: #F0DAD5;
        }
        
        .terminal-tab-close svg {
          width: 12px;
          height: 12px;
        }
        
        .tab-add-button {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #353849;
          border: 2px solid #424658;
          border-radius: 0.5rem;
          color: #F0DAD5;
          cursor: pointer;
          flex-shrink: 0;
          font-weight: 700;
        }
        
        .tab-add-button:hover {
          background: #424658;
          border-color: #6C739C;
        }
      `;
      document.head.appendChild(style);
    }
  }

  initialize(config: TabBarConfig): void {
    this.config = config;
  }

  addTab(tab: TerminalTab): void {
    this.tabs.push(tab);
    this.render();
    this.switchTab(tab.id);
  }

  removeTab(tabId: string): void {
    this.tabs = this.tabs.filter(t => t.id !== tabId);
    if (this.activeTabId === tabId) {
      // Switch to another tab
      if (this.tabs.length > 0) {
        this.switchTab(this.tabs[0].id);
      } else {
        this.activeTabId = null;
      }
    }
    this.render();
  }

  switchTab(tabId: string): void {
    if (!this.tabs.find(t => t.id === tabId)) return;
    
    this.activeTabId = tabId;
    this.tabs.forEach(tab => {
      tab.isActive = tab.id === tabId;
    });
    
    if (this.config) {
      this.config.onTabSwitch(tabId);
    }
    
    this.render();
  }

  renameTab(tabId: string, newTitle: string): void {
    const tab = this.tabs.find(t => t.id === tabId);
    if (tab) {
      tab.title = newTitle;
      if (this.config) {
        this.config.onTabRename(tabId, newTitle);
      }
      this.render();
    }
  }

  getActiveTab(): TerminalTab | null {
    return this.tabs.find(t => t.id === this.activeTabId) || null;
  }

  getTabs(): TerminalTab[] {
    return [...this.tabs];
  }

  private render(): void {
    if (!this.container) return;

    // Remove existing tabs (except add button)
    const existingTabs = this.container.querySelectorAll('.terminal-tab');
    existingTabs.forEach(tab => tab.remove());

    // Add tabs
    this.tabs.forEach(tab => {
      const tabElement = document.createElement('div');
      const syncedTabs = multiWindowSync.getSyncedTabs();
      const isSynced = syncedTabs.some(st => st.id === tab.id && !st.isLocal);
      tabElement.className = `terminal-tab ${tab.isActive ? 'active' : ''} ${isSynced ? 'synced' : ''}`;
      tabElement.dataset.tabId = tab.id;
      
      const title = document.createElement('span');
      title.className = 'terminal-tab-title';
      title.textContent = tab.title;
      title.title = tab.title;
      
      const close = document.createElement('button');
      close.className = 'terminal-tab-close';
      close.innerHTML = `
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      `;
      close.title = 'Close tab';
      
      close.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.config) {
          this.config.onTabClose(tab.id);
        }
      });

      tabElement.appendChild(title);
      tabElement.appendChild(close);
      
      tabElement.addEventListener('click', () => {
        this.switchTab(tab.id);
      });

      // Insert before add button
      const addButton = this.container!.querySelector('#tab-add-button');
      if (addButton) {
        this.container!.insertBefore(tabElement, addButton);
      } else {
        this.container!.appendChild(tabElement);
      }
    });
  }
}

export const tabBar = new TabBar();

// Expose to window for global access
if (typeof window !== 'undefined') {
  (window as any).tabBar = tabBar;
}

