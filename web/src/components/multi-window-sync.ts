// Multi-Window Tab Synchronization System
// Uses BroadcastChannel for cross-window communication

import { TerminalTab } from '../types/terminal';

export interface SyncedTab extends TerminalTab {
  windowId: string;
  isLocal: boolean;
  isConnected: boolean;
  lastSync: number;
  connectionStrength: number; // 0-100
}

export interface WindowConnection {
  windowId: string;
  isLocal: boolean;
  isConnected: boolean;
  lastPing: number;
  tabs: string[]; // Tab IDs in that window
}

export interface SyncMessage {
  type: 'tab-create' | 'tab-close' | 'tab-switch' | 'tab-rename' | 'terminal-output' | 'terminal-input' | 'ping' | 'pong' | 'sync-request' | 'sync-response' | 'component-assign' | 'component-visibility' | 'window-role';
  windowId: string;
  tabId?: string;
  data?: any;
  timestamp: number;
}

export interface ComponentAssignment {
  componentId: string;
  windowId: string;
  visible: boolean;
}

export type WindowRole = 'terminal' | 'tools' | 'mixed';

class MultiWindowSync {
  private channel: BroadcastChannel;
  private windowId: string;
  private connectedWindows: Map<string, WindowConnection> = new Map();
  private syncedTabs: Map<string, SyncedTab> = new Map();
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private connectionCheckInterval: ReturnType<typeof setInterval> | null = null;
  private onTabSyncCallback: ((tabId: string, data: any) => void) | null = null;
  private onTerminalOutputCallback: ((tabId: string, output: string) => void) | null = null;
  private onTerminalInputCallback: ((tabId: string, input: string) => void) | null = null;
  private connectionIndicator: HTMLElement | null = null;
  private connectionAnimation: HTMLElement | null = null;
  private windowRole: WindowRole = 'mixed';
  private componentAssignments: Map<string, ComponentAssignment> = new Map();
  private windowRoles: Map<string, WindowRole> = new Map();
  private onComponentVisibilityChange: ((componentId: string, visible: boolean) => void) | null = null;

  constructor() {
    // Generate unique window ID
    this.windowId = `window-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Use BroadcastChannel for cross-window communication
    this.channel = new BroadcastChannel('azalea-terminal-sync');
    
    this.setupMessageListener();
    this.setupConnectionIndicator();
    this.startPingInterval();
    this.startConnectionCheck();
    
    // Check if this is a new window that should be a tools window
    const isNewWindow = sessionStorage.getItem('azalea-new-window') === 'true';
    const windowRole = sessionStorage.getItem('azalea-window-role');
    
    if (isNewWindow && windowRole === 'tools') {
      // This is a new tools window
      this.windowRole = 'tools';
      sessionStorage.removeItem('azalea-new-window');
      sessionStorage.removeItem('azalea-window-role');
      
      // Wait a bit for DOM to be ready, then assign components
      setTimeout(() => {
        this.assignComponentsForToolsWindow();
      }, 500);
    } else {
      // This is the original/terminal window
      this.windowRole = 'terminal';
    }
    
    // Announce this window's presence
    this.broadcast({
      type: 'ping',
      windowId: this.windowId,
      timestamp: Date.now()
    });
    
    // Broadcast window role
    setTimeout(() => {
      this.broadcast({
        type: 'window-role',
        data: { role: this.windowRole }
      });
      this.updateConnectionIndicator();
    }, 1000);
  }

  private setupMessageListener(): void {
    this.channel.addEventListener('message', (event: MessageEvent<SyncMessage>) => {
      const message = event.data;
      
      // Ignore messages from this window
      if (message.windowId === this.windowId) return;

      switch (message.type) {
        case 'ping':
          this.handlePing(message);
          this.broadcast({
            type: 'pong',
            windowId: this.windowId,
            timestamp: Date.now()
          });
          break;
          
        case 'pong':
          this.handlePong(message);
          break;
          
        case 'tab-create':
          this.handleTabCreate(message);
          break;
          
        case 'tab-close':
          this.handleTabClose(message);
          break;
          
        case 'tab-switch':
          this.handleTabSwitch(message);
          break;
          
        case 'tab-rename':
          this.handleTabRename(message);
          break;
          
        case 'terminal-output':
          this.handleTerminalOutput(message);
          break;
          
        case 'terminal-input':
          this.handleTerminalInput(message);
          break;
          
        case 'sync-request':
          this.handleSyncRequest(message);
          break;
          
        case 'sync-response':
          this.handleSyncResponse(message);
          break;
          
        case 'component-assign':
          this.handleComponentAssign(message);
          break;
          
        case 'component-visibility':
          this.handleComponentVisibility(message);
          break;
          
        case 'window-role':
          this.handleWindowRole(message);
          break;
      }
    });
  }

  private handlePing(message: SyncMessage): void {
    this.updateWindowConnection(message.windowId, true);
  }

  private handlePong(message: SyncMessage): void {
    this.updateWindowConnection(message.windowId, true);
  }

  private handleTabCreate(message: SyncMessage): void {
    if (message.tabId && message.data) {
      const syncedTab: SyncedTab = {
        ...message.data,
        windowId: message.windowId,
        isLocal: false,
        isConnected: true,
        lastSync: message.timestamp,
        connectionStrength: 100
      };
      this.syncedTabs.set(message.tabId, syncedTab);
      this.updateConnectionIndicator();
      this.animateConnection(message.windowId, 'create');
    }
  }

  private handleTabClose(message: SyncMessage): void {
    if (message.tabId) {
      this.syncedTabs.delete(message.tabId);
      this.updateConnectionIndicator();
      this.animateConnection(message.windowId, 'close');
    }
  }

  private handleTabSwitch(message: SyncMessage): void {
    if (message.tabId && message.data) {
      const tab = this.syncedTabs.get(message.tabId);
      if (tab) {
        tab.isActive = message.data.isActive;
        tab.lastSync = message.timestamp;
        this.animateConnection(message.windowId, 'switch');
      }
    }
  }

  private handleTabRename(message: SyncMessage): void {
    if (message.tabId && message.data) {
      const tab = this.syncedTabs.get(message.tabId);
      if (tab) {
        tab.title = message.data.title;
        tab.lastSync = message.timestamp;
      }
    }
  }

  private handleTerminalOutput(message: SyncMessage): void {
    if (message.tabId && message.data && this.onTerminalOutputCallback) {
      this.onTerminalOutputCallback(message.tabId, message.data.output);
      this.animateConnection(message.windowId, 'output');
    }
  }

  private handleTerminalInput(message: SyncMessage): void {
    if (message.tabId && message.data && this.onTerminalInputCallback) {
      this.onTerminalInputCallback(message.tabId, message.data.input);
      this.animateConnection(message.windowId, 'input');
    }
  }

  private handleSyncRequest(message: SyncMessage): void {
    // Respond with current tab state
    // This would be implemented based on your tab management system
  }

  private handleSyncResponse(message: SyncMessage): void {
    // Handle sync response
    if (message.data && message.data.tabs) {
      message.data.tabs.forEach((tab: any) => {
        const syncedTab: SyncedTab = {
          ...tab,
          windowId: message.windowId,
          isLocal: false,
          isConnected: true,
          lastSync: message.timestamp,
          connectionStrength: 100
        };
        this.syncedTabs.set(tab.id, syncedTab);
      });
      this.updateConnectionIndicator();
    }
  }

  private handleComponentAssign(message: SyncMessage): void {
    if (message.data && message.data.componentId) {
      const assignment: ComponentAssignment = {
        componentId: message.data.componentId,
        windowId: message.data.windowId || message.windowId,
        visible: message.data.visible !== false
      };
      this.componentAssignments.set(message.data.componentId, assignment);
      this.updateComponentVisibility(message.data.componentId, assignment.visible);
    }
  }

  private handleComponentVisibility(message: SyncMessage): void {
    if (message.data && message.data.componentId) {
      this.updateComponentVisibility(message.data.componentId, message.data.visible);
    }
  }

  private handleWindowRole(message: SyncMessage): void {
    if (message.data && message.data.role) {
      this.windowRoles.set(message.windowId, message.data.role);
      // If this is about another window, we might need to adjust our layout
      if (message.windowId !== this.windowId) {
        this.redistributeComponents();
      }
    }
  }

  private updateComponentVisibility(componentId: string, visible: boolean): void {
    // Handle different component types
    let element: HTMLElement | null = null;
    
    // Try ID first
    element = document.getElementById(componentId);
    
    // Try class-based selectors
    if (!element) {
      const classElement = document.querySelector(`.${componentId}`);
      if (classElement) {
        element = classElement as HTMLElement;
      }
    }
    
    // Special handling for known components
    if (!element) {
      switch (componentId) {
        case 'terminal':
        case 'terminal-container':
          element = document.getElementById('terminal') || 
                   document.querySelector('.terminal-container') as HTMLElement ||
                   document.querySelector('#terminal') as HTMLElement;
          break;
        case 'file-manager':
          element = document.querySelector('.file-manager-container') as HTMLElement;
          break;
        case 'browser-automation':
          element = document.querySelector('.browser-automation-container') as HTMLElement;
          break;
        case 'sidebar':
          element = document.querySelector('.sidebar') as HTMLElement;
          break;
        case 'status-bar':
          element = document.getElementById('status-bar') as HTMLElement;
          break;
      }
    }
    
    if (element) {
      if (visible) {
        element.style.display = '';
        element.classList.remove('multi-window-hidden');
        element.style.visibility = '';
      } else {
        element.style.display = 'none';
        element.classList.add('multi-window-hidden');
        element.style.visibility = 'hidden';
      }
    }
    
    // Also handle class-based components
    const classElements = document.querySelectorAll(`.${componentId}`);
    classElements.forEach((el) => {
      if (visible) {
        (el as HTMLElement).style.display = '';
        el.classList.remove('multi-window-hidden');
        (el as HTMLElement).style.visibility = '';
      } else {
        (el as HTMLElement).style.display = 'none';
        el.classList.add('multi-window-hidden');
        (el as HTMLElement).style.visibility = 'hidden';
      }
    });
    
    if (this.onComponentVisibilityChange) {
      this.onComponentVisibilityChange(componentId, visible);
    }
  }

  private redistributeComponents(): void {
    const connectedWindows = Array.from(this.connectedWindows.values())
      .filter(w => w.isConnected && !w.isLocal);
    const totalWindows = connectedWindows.length + 1; // +1 for this window
    
    if (totalWindows === 1) {
      // Only one window, show everything
      this.showAllComponents();
      this.windowRole = 'mixed';
      return;
    }
    
    // Determine this window's role based on window count and order
    const allWindows = [this.windowId, ...connectedWindows.map(w => w.windowId)].sort();
    const windowIndex = allWindows.indexOf(this.windowId);
    
    if (totalWindows === 2) {
      // Two windows: split terminal and tools
      if (windowIndex === 0) {
        this.windowRole = 'terminal';
        this.assignComponentsForTerminalWindow();
      } else {
        this.windowRole = 'tools';
        this.assignComponentsForToolsWindow();
      }
    } else {
      // More than 2 windows: distribute more granularly
      this.windowRole = windowIndex === 0 ? 'terminal' : 'tools';
      if (windowIndex === 0) {
        this.assignComponentsForTerminalWindow();
      } else {
        this.assignComponentsForToolsWindow();
      }
    }
    
    // Broadcast this window's role
    this.broadcast({
      type: 'window-role',
      data: { role: this.windowRole }
    });
    
    // Update indicator to show role
    this.updateConnectionIndicator();
    
    // Show notification about redistribution
    if (totalWindows > 1) {
      const roleText = this.windowRole === 'terminal' ? 'Terminal' : 'Tools';
      console.log(`[Multi-Window] Window role set to: ${roleText}`);
    }
  }

  private showAllComponents(): void {
    const components = [
      'terminal',
      'terminal-container',
      'file-manager',
      'browser-automation',
      'sidebar',
      'status-bar'
    ];
    
    components.forEach(componentId => {
      this.updateComponentVisibility(componentId, true);
      this.componentAssignments.set(componentId, {
        componentId,
        windowId: this.windowId,
        visible: true
      });
    });
  }

  private assignComponentsForTerminalWindow(): void {
    // Terminal window: Show terminal, status bar, hide tools
    // Show terminal
    const terminal = document.getElementById('terminal') || document.querySelector('.terminal-container');
    if (terminal) {
      (terminal as HTMLElement).style.display = '';
      (terminal as HTMLElement).classList.remove('multi-window-hidden');
    }
    
    const terminalBody = document.querySelector('.terminal-body');
    if (terminalBody) {
      (terminalBody as HTMLElement).style.display = '';
    }
    
    // Show status bar
    const statusBar = document.getElementById('status-bar');
    if (statusBar) {
      statusBar.style.display = '';
      statusBar.classList.remove('multi-window-hidden');
    }
    
    // Hide file manager
    const fileManagerContainer = document.querySelector('.file-manager-container');
    if (fileManagerContainer) {
      (fileManagerContainer as HTMLElement).classList.remove('visible');
      (fileManagerContainer as HTMLElement).style.display = 'none';
      (fileManagerContainer as HTMLElement).classList.add('multi-window-hidden');
    }
    
    // Hide browser automation
    const browserAutomationContainer = document.querySelector('.browser-automation-container');
    if (browserAutomationContainer) {
      (browserAutomationContainer as HTMLElement).classList.remove('visible');
      (browserAutomationContainer as HTMLElement).style.display = 'none';
      (browserAutomationContainer as HTMLElement).classList.add('multi-window-hidden');
    }
    
    // Keep sidebar visible
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      (sidebar as HTMLElement).style.display = '';
    }
    
    // Update assignments
    this.componentAssignments.set('terminal', { componentId: 'terminal', windowId: this.windowId, visible: true });
    this.componentAssignments.set('terminal-container', { componentId: 'terminal-container', windowId: this.windowId, visible: true });
    this.componentAssignments.set('status-bar', { componentId: 'status-bar', windowId: this.windowId, visible: true });
    this.componentAssignments.set('file-manager', { componentId: 'file-manager', windowId: this.windowId, visible: false });
    this.componentAssignments.set('browser-automation', { componentId: 'browser-automation', windowId: this.windowId, visible: false });
  }

  private assignComponentsForToolsWindow(): void {
    // Tools window: Show file manager, browser automation, hide terminal
    // Hide terminal and its container
    const terminal = document.getElementById('terminal') || document.querySelector('.terminal-container');
    if (terminal) {
      (terminal as HTMLElement).style.display = 'none';
      (terminal as HTMLElement).classList.add('multi-window-hidden');
    }
    
    // Hide terminal body if it exists
    const terminalBody = document.querySelector('.terminal-body');
    if (terminalBody) {
      (terminalBody as HTMLElement).style.display = 'none';
    }
    
    // Hide terminal tab bar
    const tabBar = document.getElementById('terminal-tab-bar');
    if (tabBar) {
      (tabBar as HTMLElement).style.display = 'none';
    }
    
    // Show status bar
    const statusBar = document.getElementById('status-bar');
    if (statusBar) {
      statusBar.style.display = '';
      statusBar.classList.remove('multi-window-hidden');
    }
    
    // Show file manager - position it on the left side
    const fileManagerContainer = document.querySelector('.file-manager-container');
    if (fileManagerContainer) {
      const fmEl = fileManagerContainer as HTMLElement;
      fmEl.classList.add('visible');
      fmEl.style.display = 'flex';
      fmEl.style.position = 'fixed';
      fmEl.style.left = '80px'; // After sidebar
      fmEl.style.right = '50%';
      fmEl.style.top = '60px'; // After status bar
      fmEl.style.bottom = '0';
      fmEl.style.width = 'calc(50% - 80px)';
      fmEl.style.height = 'calc(100vh - 60px)';
      fmEl.style.borderRight = '2px solid #424658';
      fmEl.classList.remove('multi-window-hidden');
    }
    
    // Show browser automation - position it on the right side
    const browserAutomationContainer = document.querySelector('.browser-automation-container');
    if (browserAutomationContainer) {
      const baEl = browserAutomationContainer as HTMLElement;
      baEl.classList.add('visible');
      baEl.style.display = 'flex';
      baEl.style.position = 'fixed';
      baEl.style.left = '50%';
      baEl.style.right = '0';
      baEl.style.top = '60px'; // After status bar
      baEl.style.bottom = '0';
      baEl.style.width = '50%';
      baEl.style.height = 'calc(100vh - 60px)';
      baEl.style.borderLeft = '2px solid #424658';
      baEl.classList.remove('multi-window-hidden');
    }
    
    // Keep sidebar visible
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      (sidebar as HTMLElement).style.display = '';
    }
    
    // Update assignments
    this.componentAssignments.set('terminal', { componentId: 'terminal', windowId: this.windowId, visible: false });
    this.componentAssignments.set('terminal-container', { componentId: 'terminal-container', windowId: this.windowId, visible: false });
    this.componentAssignments.set('status-bar', { componentId: 'status-bar', windowId: this.windowId, visible: true });
    this.componentAssignments.set('file-manager', { componentId: 'file-manager', windowId: this.windowId, visible: true });
    this.componentAssignments.set('browser-automation', { componentId: 'browser-automation', windowId: this.windowId, visible: true });
  }

  private updateWindowConnection(windowId: string, isConnected: boolean): void {
    const wasNew = !this.connectedWindows.has(windowId);
    const existing = this.connectedWindows.get(windowId);
    if (existing) {
      existing.isConnected = isConnected;
      existing.lastPing = Date.now();
    } else {
      this.connectedWindows.set(windowId, {
        windowId,
        isLocal: false,
        isConnected: true,
        lastPing: Date.now(),
        tabs: []
      });
    }
    this.updateConnectionIndicator();
    
    // If a new window connected, redistribute components
    if (wasNew && isConnected) {
      setTimeout(() => {
        this.redistributeComponents();
      }, 500); // Small delay to ensure window is ready
    }
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      this.broadcast({
        type: 'ping',
        windowId: this.windowId,
        timestamp: Date.now()
      });
    }, 2000); // Ping every 2 seconds
  }

  private startConnectionCheck(): void {
    this.connectionCheckInterval = setInterval(() => {
      const now = Date.now();
      let windowDisconnected = false;
      
      this.connectedWindows.forEach((window, windowId) => {
        if (!window.isLocal && now - window.lastPing > 5000) {
          // Window hasn't pinged in 5 seconds, consider it disconnected
          window.isConnected = false;
          windowDisconnected = true;
          
          // Remove tabs from disconnected window
          this.syncedTabs.forEach((tab, tabId) => {
            if (tab.windowId === windowId) {
              this.syncedTabs.delete(tabId);
            }
          });
          
          // Remove window role
          this.windowRoles.delete(windowId);
        }
      });
      
      if (windowDisconnected) {
        // Redistribute components when a window disconnects
        this.redistributeComponents();
      }
      
      this.updateConnectionIndicator();
    }, 1000);
  }

  private setupConnectionIndicator(): void {
    // Create connection indicator UI
    const indicator = document.createElement('div');
    indicator.id = 'multi-window-indicator';
    indicator.className = 'multi-window-indicator';
    indicator.innerHTML = `
      <div class="connection-status">
        <div class="connection-dot"></div>
        <span class="connection-text">0 windows</span>
        <span class="window-role-badge"></span>
      </div>
      <button class="connection-button" title="Open in new window">
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
        </svg>
      </button>
    `;
    
    // Create connection animation overlay
    const animation = document.createElement('div');
    animation.id = 'connection-animation';
    animation.className = 'connection-animation';
    
    document.body.appendChild(indicator);
    document.body.appendChild(animation);
    
    this.connectionIndicator = indicator;
    this.connectionAnimation = animation;
    
    // Add click handler to open new window
    const button = indicator.querySelector('.connection-button');
    if (button) {
      button.addEventListener('click', () => {
        this.openInNewWindow();
      });
    }
    
    this.setupConnectionStyles();
  }

  private setupConnectionStyles(): void {
    if (!document.getElementById('multi-window-styles')) {
      const style = document.createElement('style');
      style.id = 'multi-window-styles';
      style.textContent = `
        .multi-window-indicator {
          position: fixed;
          top: 60px;
          right: 20px;
          z-index: 10000;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: #2A2D3A;
          border: 2px solid #424658;
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
        }
        
        .connection-status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .connection-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #C56B62;
          box-shadow: 0 0 4px rgba(197, 107, 98, 0.4);
        }
        
        .connection-dot.connected {
          background: #6C739C;
          box-shadow: 0 0 8px rgba(108, 115, 156, 0.6);
          animation: pulse-connection 2s ease-in-out infinite;
        }
        
        @keyframes pulse-connection {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.2);
          }
        }
        
        .connection-text {
          color: #F0DAD5;
          font-size: 0.75rem;
          font-weight: 600;
        }
        
        .window-role-badge {
          display: inline-block;
          padding: 0.125rem 0.375rem;
          margin-left: 0.5rem;
          background: #353849;
          border: 1px solid #424658;
          border-radius: 0.25rem;
          color: #8B92B5;
          font-size: 0.625rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .window-role-badge.terminal {
          background: #6C739C;
          color: #F0DAD5;
          border-color: #8B92B5;
        }
        
        .window-role-badge.tools {
          background: #DEA785;
          color: #424658;
          border-color: #C56B62;
        }
        
        .connection-button {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #353849;
          border: 2px solid #424658;
          border-radius: 0.375rem;
          color: #F0DAD5;
          cursor: pointer;
          font-weight: 700;
        }
        
        .connection-button:hover {
          background: #424658;
          border-color: #6C739C;
        }
        
        .connection-animation {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          z-index: 9999;
          overflow: hidden;
        }
        
        .connection-beam {
          position: absolute;
          width: 3px;
          background: linear-gradient(90deg, transparent, #6C739C, transparent);
          opacity: 0;
          animation: beam-travel 1s ease-out forwards;
          box-shadow: 0 0 10px #6C739C, 0 0 20px #8B92B5;
        }
        
        @keyframes beam-travel {
          0% {
            opacity: 0;
            transform: scaleY(0);
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: scaleY(1);
          }
        }
        
        .connection-pulse {
          position: absolute;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 2px solid #6C739C;
          opacity: 0;
          animation: pulse-expand 0.8s ease-out forwards;
        }
        
        @keyframes pulse-expand {
          0% {
            opacity: 1;
            transform: scale(0);
          }
          100% {
            opacity: 0;
            transform: scale(10);
          }
        }
        
        .connection-ripple {
          position: absolute;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #8B92B5;
          opacity: 0;
          animation: ripple-expand 1.2s ease-out forwards;
          box-shadow: 0 0 8px #6C739C;
        }
        
        @keyframes ripple-expand {
          0% {
            opacity: 1;
            transform: scale(0);
          }
          50% {
            opacity: 0.8;
          }
          100% {
            opacity: 0;
            transform: scale(30);
          }
        }
        
        /* Multi-window component visibility */
        .multi-window-hidden {
          display: none !important;
          visibility: hidden !important;
        }
        
        /* Tools window layout */
        .tools-window-layout {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          padding: 1rem;
          height: 100vh;
        }
        
        .tools-window-layout .file-manager-container,
        .tools-window-layout .browser-automation-container {
          position: relative !important;
          left: auto !important;
          right: auto !important;
          width: 100% !important;
          height: 100% !important;
        }
      `;
      document.head.appendChild(style);
    }
  }

  private updateConnectionIndicator(): void {
    if (!this.connectionIndicator) return;
    
    const connectedCount = Array.from(this.connectedWindows.values())
      .filter(w => w.isConnected && !w.isLocal).length;
    
    const dot = this.connectionIndicator.querySelector('.connection-dot');
    const text = this.connectionIndicator.querySelector('.connection-text');
    const roleBadge = this.connectionIndicator.querySelector('.window-role-badge');
    
    if (dot) {
      if (connectedCount > 0) {
        dot.classList.add('connected');
      } else {
        dot.classList.remove('connected');
      }
    }
    
    if (text) {
      text.textContent = `${connectedCount} window${connectedCount !== 1 ? 's' : ''}`;
    }
    
    if (roleBadge) {
      roleBadge.className = `window-role-badge ${this.windowRole}`;
      roleBadge.textContent = this.windowRole;
    }
  }

  private animateConnection(windowId: string, type: 'create' | 'close' | 'switch' | 'output' | 'input'): void {
    if (!this.connectionAnimation) return;
    
    // Get indicator position
    const indicator = this.connectionIndicator;
    if (!indicator) return;
    
    const indicatorRect = indicator.getBoundingClientRect();
    const centerX = indicatorRect.left + indicatorRect.width / 2;
    const centerY = indicatorRect.top + indicatorRect.height / 2;
    
    // Create different animations based on type
    if (type === 'create' || type === 'switch') {
      // Pulse animation
      const pulse = document.createElement('div');
      pulse.className = 'connection-pulse';
      pulse.style.left = `${centerX}px`;
      pulse.style.top = `${centerY}px`;
      pulse.style.marginLeft = '-10px';
      pulse.style.marginTop = '-10px';
      this.connectionAnimation.appendChild(pulse);
      
      setTimeout(() => pulse.remove(), 800);
    }
    
    if (type === 'output' || type === 'input') {
      // Ripple animation
      const ripple = document.createElement('div');
      ripple.className = 'connection-ripple';
      ripple.style.left = `${centerX}px`;
      ripple.style.top = `${centerY}px`;
      ripple.style.marginLeft = '-2px';
      ripple.style.marginTop = '-2px';
      this.connectionAnimation.appendChild(ripple);
      
      setTimeout(() => ripple.remove(), 1200);
    }
    
    // Beam animation for all types
    const beam = document.createElement('div');
    beam.className = 'connection-beam';
    const angle = Math.random() * 360;
    const length = 200 + Math.random() * 300;
    beam.style.left = `${centerX}px`;
    beam.style.top = `${centerY}px`;
    beam.style.height = `${length}px`;
    beam.style.transform = `rotate(${angle}deg)`;
    beam.style.transformOrigin = '0 0';
    this.connectionAnimation.appendChild(beam);
    
    setTimeout(() => beam.remove(), 1000);
  }

  private openInNewWindow(): void {
    // Open current page in new window
    const url = window.location.href;
    const newWindow = window.open(url, '_blank', 'width=1200,height=800');
    
    if (newWindow) {
      // Store that we're opening a new window
      sessionStorage.setItem('azalea-new-window', 'true');
      sessionStorage.setItem('azalea-window-role', 'tools'); // New window will be tools window
      
      // Send sync request after a delay to allow new window to initialize
      setTimeout(() => {
        this.broadcast({
          type: 'sync-request',
          windowId: this.windowId,
          timestamp: Date.now()
        });
        // Redistribute components after new window connects
        setTimeout(() => {
          this.redistributeComponents();
        }, 1000);
      }, 2000);
    }
  }

  // Public API
  broadcast(message: Omit<SyncMessage, 'windowId' | 'timestamp'>): void {
    this.channel.postMessage({
      ...message,
      windowId: this.windowId,
      timestamp: Date.now()
    });
  }

  syncTab(tab: TerminalTab): void {
    const syncedTab: SyncedTab = {
      ...tab,
      windowId: this.windowId,
      isLocal: true,
      isConnected: true,
      lastSync: Date.now(),
      connectionStrength: 100
    };
    
    this.syncedTabs.set(tab.id, syncedTab);
    
    this.broadcast({
      type: 'tab-create',
      tabId: tab.id,
      data: tab
    });
    
    this.updateConnectionIndicator();
  }

  syncTabClose(tabId: string): void {
    this.syncedTabs.delete(tabId);
    this.broadcast({
      type: 'tab-close',
      tabId
    });
    this.updateConnectionIndicator();
  }

  syncTabSwitch(tabId: string, isActive: boolean): void {
    const tab = this.syncedTabs.get(tabId);
    if (tab) {
      tab.isActive = isActive;
      tab.lastSync = Date.now();
      
      this.broadcast({
        type: 'tab-switch',
        tabId,
        data: { isActive }
      });
    }
  }

  syncTabRename(tabId: string, title: string): void {
    const tab = this.syncedTabs.get(tabId);
    if (tab) {
      tab.title = title;
      tab.lastSync = Date.now();
      
      this.broadcast({
        type: 'tab-rename',
        tabId,
        data: { title }
      });
    }
  }

  syncTerminalOutput(tabId: string, output: string): void {
    this.broadcast({
      type: 'terminal-output',
      tabId,
      data: { output }
    });
  }

  syncTerminalInput(tabId: string, input: string): void {
    this.broadcast({
      type: 'terminal-input',
      tabId,
      data: { input }
    });
  }

  onTabSync(callback: (tabId: string, data: any) => void): void {
    this.onTabSyncCallback = callback;
  }

  onTerminalOutput(callback: (tabId: string, output: string) => void): void {
    this.onTerminalOutputCallback = callback;
  }

  onTerminalInput(callback: (tabId: string, input: string) => void): void {
    this.onTerminalInputCallback = callback;
  }

  getSyncedTabs(): SyncedTab[] {
    return Array.from(this.syncedTabs.values());
  }

  getConnectedWindows(): WindowConnection[] {
    return Array.from(this.connectedWindows.values());
  }

  getWindowRole(): WindowRole {
    return this.windowRole;
  }

  assignComponent(componentId: string, windowId: string, visible: boolean): void {
    const assignment: ComponentAssignment = {
      componentId,
      windowId,
      visible
    };
    this.componentAssignments.set(componentId, assignment);
    this.updateComponentVisibility(componentId, visible);
    
    this.broadcast({
      type: 'component-assign',
      data: { componentId, windowId, visible }
    });
  }

  setComponentVisibility(componentId: string, visible: boolean): void {
    this.updateComponentVisibility(componentId, visible);
    
    this.broadcast({
      type: 'component-visibility',
      data: { componentId, visible }
    });
  }

  onComponentVisibility(callback: (componentId: string, visible: boolean) => void): void {
    this.onComponentVisibilityChange = callback;
  }

  destroy(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }
    this.channel.close();
    if (this.connectionIndicator) {
      this.connectionIndicator.remove();
    }
    if (this.connectionAnimation) {
      this.connectionAnimation.remove();
    }
  }
}

export const multiWindowSync = new MultiWindowSync();

