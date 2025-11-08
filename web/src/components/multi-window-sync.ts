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
  private configPanel: HTMLElement | null = null;
  private windowRole: WindowRole = 'mixed';
  private componentAssignments: Map<string, ComponentAssignment> = new Map();
  private windowRoles: Map<string, WindowRole> = new Map();
  private onComponentVisibilityChange: ((componentId: string, visible: boolean) => void) | null = null;
  private manualOverride: boolean = false; // Allow manual override of automatic distribution

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
    const windowRole = sessionStorage.getItem('azalea-window-role') as WindowRole;
    
    // Check for saved role preference
    const savedRole = localStorage.getItem(`azalea-window-role-${this.windowId}`) as WindowRole;
    
    if (isNewWindow && windowRole === 'tools') {
      // This is a new tools window
      this.windowRole = 'tools';
      sessionStorage.removeItem('azalea-new-window');
      sessionStorage.removeItem('azalea-window-role');
      localStorage.setItem(`azalea-window-role-${this.windowId}`, 'tools');
      
      // Wait longer for DOM and terminal to be ready, then assign components
      setTimeout(() => {
        this.assignComponentsForToolsWindow();
      }, 2000); // Increased delay to ensure terminal initializes first
    } else if (savedRole && ['terminal', 'tools', 'mixed'].includes(savedRole)) {
      // Use saved role preference
      this.windowRole = savedRole;
      // Wait for terminal to initialize first
      setTimeout(() => {
        this.applyWindowRole(this.windowRole);
      }, 2000);
    } else {
      // This is the original/terminal window
      this.windowRole = 'mixed'; // Start as mixed so everything is visible
      localStorage.setItem(`azalea-window-role-${this.windowId}`, 'mixed');
      // Don't apply role immediately - let terminal initialize first
      setTimeout(() => {
        this.applyWindowRole(this.windowRole);
      }, 2000);
    }
    
    // Announce this window's presence
    this.broadcast({
      type: 'ping'
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
            type: 'pong'
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
    // Don't auto-redistribute if manual override is enabled
    if (this.manualOverride) {
      return;
    }
    
    const connectedWindows = Array.from(this.connectedWindows.values())
      .filter(w => w.isConnected && !w.isLocal);
    const totalWindows = connectedWindows.length + 1; // +1 for this window
    
    if (totalWindows === 1) {
      // Only one window, show everything (unless manually set)
      if (!this.manualOverride) {
        this.windowRole = 'mixed';
        this.showAllComponents();
      }
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
    
    // Save role preference
    localStorage.setItem(`azalea-window-role-${this.windowId}`, this.windowRole);
    
    // Broadcast this window's role
    this.broadcast({
      type: 'window-role',
      data: { role: this.windowRole }
    });
    
    // Update indicator to show role
    this.updateConnectionIndicator();
    this.updateConfigPanel();
    
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
    // Show terminal - ensure it's visible and not hidden
    const terminal = document.getElementById('terminal');
    if (terminal) {
      (terminal as HTMLElement).style.display = '';
      (terminal as HTMLElement).style.visibility = 'visible';
      (terminal as HTMLElement).classList.remove('multi-window-hidden');
    }
    
    const terminalContainer = document.querySelector('.terminal-container');
    if (terminalContainer) {
      (terminalContainer as HTMLElement).style.display = '';
      (terminalContainer as HTMLElement).style.visibility = 'visible';
      (terminalContainer as HTMLElement).classList.remove('multi-window-hidden');
    }
    
    const terminalBody = document.querySelector('.terminal-body');
    if (terminalBody) {
      (terminalBody as HTMLElement).style.display = '';
      (terminalBody as HTMLElement).style.visibility = 'visible';
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
      fmEl.style.flexDirection = 'column';
      fmEl.style.position = 'fixed';
      fmEl.style.left = '80px'; // After sidebar
      fmEl.style.right = '50%';
      fmEl.style.top = '60px'; // After status bar
      fmEl.style.bottom = '0';
      fmEl.style.width = 'calc(50% - 80px)';
      fmEl.style.height = 'calc(100vh - 60px)';
      fmEl.style.borderRight = '2px solid #424658';
      fmEl.style.zIndex = '100';
      fmEl.classList.remove('multi-window-hidden');
      
      // Ensure file manager is visible and accessible
      if ((window as any).fileManager) {
        (window as any).fileManager.isVisible = true;
        (window as any).fileManager.show();
      }
    }
    
    // Show browser automation - position it on the right side
    const browserAutomationContainer = document.querySelector('.browser-automation-container');
    if (browserAutomationContainer) {
      const baEl = browserAutomationContainer as HTMLElement;
      baEl.classList.add('visible');
      baEl.style.display = 'flex';
      baEl.style.flexDirection = 'column';
      baEl.style.position = 'fixed';
      baEl.style.left = '50%';
      baEl.style.right = '0';
      baEl.style.top = '60px'; // After status bar
      baEl.style.bottom = '0';
      baEl.style.width = '50%';
      baEl.style.height = 'calc(100vh - 60px)';
      baEl.style.borderLeft = '2px solid #424658';
      baEl.style.zIndex = '100';
      baEl.classList.remove('multi-window-hidden');
      
      // Ensure browser automation is visible
      if ((window as any).browserAutomation) {
        (window as any).browserAutomation.isVisible = true;
        (window as any).browserAutomation.show();
      }
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
        type: 'ping'
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
    // Create connection indicator UI - always visible
    const indicator = document.createElement('div');
    indicator.id = 'multi-window-indicator';
    indicator.className = 'multi-window-indicator';
    indicator.innerHTML = `
      <div class="connection-status" id="connection-status-clickable">
        <div class="connection-dot"></div>
        <span class="connection-text">Ready</span>
        <span class="window-role-badge"></span>
      </div>
      <button class="connection-button" title="Open in new window" id="open-window-btn">
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
        </svg>
      </button>
      <button class="connection-config-button" title="Configure windows" id="config-window-btn">
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-3.318 4.325-3.318 2.4 0 4.899 1.562 4.325 3.318m-1.455 4.315c-.426 1.756-1.924 2.318-4.325 2.318-2.4 0-3.899-.562-4.325-2.318m-1.455-4.315c.426 1.756 2.924 3.318 4.325 3.318 2.4 0 4.899-1.562 4.325-3.318m-1.455-4.315c-.426-1.756-1.924-2.318-4.325-2.318-2.4 0-3.899.562-4.325 2.318"/>
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
    const openButton = indicator.querySelector('#open-window-btn');
    if (openButton) {
      openButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openInNewWindow();
      });
    }
    
    // Add click handler to open config panel
    const configButton = indicator.querySelector('#config-window-btn');
    const statusClickable = indicator.querySelector('#connection-status-clickable');
    if (configButton) {
      configButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleConfigPanel();
      });
    }
    if (statusClickable) {
      statusClickable.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleConfigPanel();
      });
    }
    
    // Always show as "ready" even with 0 windows
    this.updateConnectionIndicator();
    
    this.setupConnectionStyles();
    this.setupConfigPanel();
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
        
        /* Config Panel Styles */
        .connection-button,
        .connection-config-button {
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
          transition: all 0.2s;
        }
        
        .connection-button:hover,
        .connection-config-button:hover {
          background: #424658;
          border-color: #6C739C;
          transform: scale(1.05);
        }
        
        #connection-status-clickable {
          cursor: pointer;
          padding: 0.25rem 0.5rem;
          border-radius: 0.375rem;
          transition: background 0.2s;
        }
        
        #connection-status-clickable:hover {
          background: rgba(108, 115, 156, 0.1);
        }
        
        .multi-window-config-panel {
          position: fixed;
          top: 100px;
          right: 20px;
          z-index: 10001;
          background: #2A2D3A;
          border: 2px solid #424658;
          border-radius: 0.75rem;
          padding: 1.5rem;
          min-width: 320px;
          max-width: 400px;
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.6);
          display: none;
        }
        
        .multi-window-config-panel.visible {
          display: block;
          animation: slideInRight 0.3s ease-out;
        }
        
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .config-panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 2px solid #424658;
        }
        
        .config-panel-title {
          color: #F0DAD5;
          font-size: 1rem;
          font-weight: 700;
        }
        
        .config-panel-close {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          color: #F0DAD5;
          cursor: pointer;
          border-radius: 0.25rem;
        }
        
        .config-panel-close:hover {
          background: #353849;
        }
        
        .config-section {
          margin-bottom: 1.5rem;
        }
        
        .config-section-title {
          color: #8B92B5;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.75rem;
        }
        
        .config-option {
          display: flex;
          flex-direction: column;
          padding: 0.75rem;
          background: #353849;
          border: 2px solid #424658;
          border-radius: 0.5rem;
          margin-bottom: 0.5rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .config-option:hover {
          background: #424658;
          border-color: #6C739C;
        }
        
        .config-option.active {
          background: #6C739C;
          border-color: #8B92B5;
        }
        
        .config-option-label {
          color: #F0DAD5;
          font-size: 0.875rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .config-option-desc {
          color: #8B92B5;
          font-size: 0.75rem;
          margin-top: 0.5rem;
        }
        
        .config-toggle {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .config-toggle-switch {
          width: 40px;
          height: 20px;
          background: #424658;
          border-radius: 10px;
          position: relative;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .config-toggle-switch.active {
          background: #6C739C;
        }
        
        .config-toggle-switch::after {
          content: '';
          position: absolute;
          width: 16px;
          height: 16px;
          background: #F0DAD5;
          border-radius: 50%;
          top: 2px;
          left: 2px;
          transition: transform 0.2s;
        }
        
        .config-toggle-switch.active::after {
          transform: translateX(20px);
        }
      `;
      document.head.appendChild(style);
    }
  }
  
  private setupConfigPanel(): void {
    const panel = document.createElement('div');
    panel.className = 'multi-window-config-panel';
    panel.id = 'multi-window-config-panel';
    panel.innerHTML = `
      <div class="config-panel-header">
        <div class="config-panel-title">Window Configuration</div>
        <button class="config-panel-close" id="config-panel-close">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      
      <div class="config-section">
        <div class="config-section-title">Window Role</div>
        <div class="config-option ${this.windowRole === 'mixed' ? 'active' : ''}" data-role="mixed">
          <div class="config-option-label">
            <span>Mixed</span>
            <div class="config-toggle-switch ${this.windowRole === 'mixed' ? 'active' : ''}"></div>
          </div>
          <div class="config-option-desc">Show all components in this window</div>
        </div>
        <div class="config-option ${this.windowRole === 'terminal' ? 'active' : ''}" data-role="terminal">
          <div class="config-option-label">
            <span>Terminal</span>
            <div class="config-toggle-switch ${this.windowRole === 'terminal' ? 'active' : ''}"></div>
          </div>
          <div class="config-option-desc">Focus on terminal, hide tools</div>
        </div>
        <div class="config-option ${this.windowRole === 'tools' ? 'active' : ''}" data-role="tools">
          <div class="config-option-label">
            <span>Tools</span>
            <div class="config-toggle-switch ${this.windowRole === 'tools' ? 'active' : ''}"></div>
          </div>
          <div class="config-option-desc">Show file manager and browser automation</div>
        </div>
      </div>
      
      <div class="config-section">
        <div class="config-section-title">Auto Distribution</div>
        <div class="config-option">
          <div class="config-option-label">
            <span>Automatic Component Distribution</span>
            <div class="config-toggle-switch ${!this.manualOverride ? 'active' : ''}" id="auto-distribute-toggle"></div>
          </div>
          <div class="config-option-desc">Automatically distribute components when windows connect</div>
        </div>
      </div>
    `;
    
    document.body.appendChild(panel);
    this.configPanel = panel;
    
    // Close button
    const closeBtn = panel.querySelector('#config-panel-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.toggleConfigPanel();
      });
    }
    
    // Role selection
    const roleOptions = panel.querySelectorAll('.config-option[data-role]');
    roleOptions.forEach(option => {
      option.addEventListener('click', () => {
        const role = (option as HTMLElement).dataset.role as WindowRole;
        this.setWindowRole(role);
        this.updateConfigPanel();
      });
    });
    
    // Auto distribute toggle
    const autoToggle = panel.querySelector('#auto-distribute-toggle');
    if (autoToggle) {
      autoToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        this.manualOverride = !this.manualOverride;
        (autoToggle as HTMLElement).classList.toggle('active', !this.manualOverride);
        localStorage.setItem('azalea-manual-override', String(this.manualOverride));
      });
    }
    
    // Load saved manual override
    const savedOverride = localStorage.getItem('azalea-manual-override');
    if (savedOverride === 'true') {
      this.manualOverride = true;
      if (autoToggle) {
        (autoToggle as HTMLElement).classList.remove('active');
      }
    }
    
    // Close on outside click
    document.addEventListener('click', (e) => {
      if (this.configPanel && this.configPanel.classList.contains('visible')) {
        if (!this.configPanel.contains(e.target as Node) && 
            !this.connectionIndicator?.contains(e.target as Node)) {
          this.toggleConfigPanel();
        }
      }
    });
  }
  
  private toggleConfigPanel(): void {
    if (!this.configPanel) return;
    this.configPanel.classList.toggle('visible');
    if (this.configPanel.classList.contains('visible')) {
      this.updateConfigPanel();
    }
  }
  
  private updateConfigPanel(): void {
    if (!this.configPanel) return;
    
    // Update role options
    const roleOptions = this.configPanel.querySelectorAll('.config-option[data-role]');
    roleOptions.forEach(option => {
      const role = (option as HTMLElement).dataset.role as WindowRole;
      if (role === this.windowRole) {
        option.classList.add('active');
        const switchEl = option.querySelector('.config-toggle-switch');
        if (switchEl) {
          switchEl.classList.add('active');
        }
      } else {
        option.classList.remove('active');
        const switchEl = option.querySelector('.config-toggle-switch');
        if (switchEl) {
          switchEl.classList.remove('active');
        }
      }
    });
  }
  
  private setWindowRole(role: WindowRole): void {
    this.windowRole = role;
    localStorage.setItem(`azalea-window-role-${this.windowId}`, role);
    this.applyWindowRole(role);
    this.updateConnectionIndicator();
    this.broadcast({
      type: 'window-role',
      data: { role }
    });
  }
  
  private applyWindowRole(role: WindowRole): void {
    switch (role) {
      case 'mixed':
        this.showAllComponents();
        break;
      case 'terminal':
        this.assignComponentsForTerminalWindow();
        break;
      case 'tools':
        this.assignComponentsForToolsWindow();
        break;
    }
  }

  private updateConnectionIndicator(): void {
    if (!this.connectionIndicator) return;
    
    const connectedCount = Array.from(this.connectedWindows.values())
      .filter(w => w.isConnected && !w.isLocal).length;
    
    const dot = this.connectionIndicator.querySelector('.connection-dot');
    const text = this.connectionIndicator.querySelector('.connection-text');
    const roleBadge = this.connectionIndicator.querySelector('.window-role-badge');
    
    // Always show as ready/connected (connection mode always on)
    if (dot) {
      dot.classList.add('connected');
      // Pulse animation even when alone to show it's active
      if (connectedCount === 0) {
        (dot as HTMLElement).style.animation = 'pulse-connection 2s ease-in-out infinite';
      }
    }
    
    if (text) {
      if (connectedCount === 0) {
        text.textContent = 'Ready';
      } else {
        text.textContent = `${connectedCount} window${connectedCount !== 1 ? 's' : ''}`;
      }
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
    // Open current page in a new ChromeOS window (separate browser window)
    // Use window.open with specific features to ensure it opens as a new window, not tab
    const url = window.location.href;
    const windowFeatures = 'width=1200,height=800,left=100,top=100,resizable=yes,scrollbars=yes,status=yes';
    const newWindow = window.open(url, '_blank', windowFeatures);
    
    if (newWindow) {
      // Focus the new window
      newWindow.focus();
      
      // Store that we're opening a new window
      sessionStorage.setItem('azalea-new-window', 'true');
      sessionStorage.setItem('azalea-window-role', 'tools'); // New window will be tools window
      
      // Send sync request after a delay to allow new window to initialize
      setTimeout(() => {
        this.broadcast({
          type: 'sync-request'
        });
        // Redistribute components after new window connects
        setTimeout(() => {
          this.redistributeComponents();
        }, 1000);
      }, 2000);
    } else {
      // If popup was blocked, show notification
      console.warn('[Multi-Window] Popup blocked. Please allow popups for this site to use multi-window features.');
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

