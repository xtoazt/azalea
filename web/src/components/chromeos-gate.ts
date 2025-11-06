// ChromeOS Gate Component
// Blocks access until Linux environment is enabled

import { notificationManager } from './notification';

export interface LinuxStatus {
  enabled: boolean;
  checking: boolean;
  error?: string;
}

class ChromeOSGate {
  private container: HTMLElement | null = null;
  private isOpen: boolean = false;
  private linuxStatus: LinuxStatus = { enabled: false, checking: true };
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.createContainer();
    this.setupStyles();
  }

  private createContainer(): void {
    this.container = document.createElement('div');
    this.container.id = 'chromeos-gate';
    this.container.className = 'chromeos-gate-overlay hidden';
    document.body.appendChild(this.container);
  }

  private setupStyles(): void {
    if (!document.getElementById('chromeos-gate-styles')) {
      const style = document.createElement('style');
      style.id = 'chromeos-gate-styles';
      style.textContent = `
        .chromeos-gate-overlay {
          position: fixed;
          inset: 0;
          background: rgb(3, 7, 18);
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.3s ease-out;
        }
        
        .chromeos-gate-overlay.hidden {
          display: none;
        }
        
        .chromeos-gate-content {
          background: rgb(17, 24, 39);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1.5rem;
          width: 90%;
          max-width: 600px;
          padding: 3rem;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          animation: slideDown 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .chromeos-gate-icon {
          width: 80px;
          height: 80px;
          margin: 0 auto 2rem;
          background: linear-gradient(135deg, rgba(37, 99, 235, 0.2), rgba(234, 88, 12, 0.2));
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid rgba(37, 99, 235, 0.3);
        }
        
        .chromeos-gate-icon svg {
          width: 40px;
          height: 40px;
          color: rgb(59, 130, 246);
        }
        
        .chromeos-gate-title {
          color: #e4e4e7;
          font-size: 2rem;
          font-weight: 700;
          margin: 0 0 1rem;
        }
        
        .chromeos-gate-description {
          color: #9ca3af;
          font-size: 1rem;
          line-height: 1.6;
          margin: 0 0 2rem;
        }
        
        .chromeos-gate-status {
          padding: 1rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.75rem;
          margin: 0 0 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
        }
        
        .status-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #6b7280;
          animation: pulse 2s ease-in-out infinite;
        }
        
        .status-dot.enabled {
          background: #10b981;
          box-shadow: 0 0 12px rgba(16, 185, 129, 0.5);
        }
        
        .status-dot.checking {
          background: #f59e0b;
        }
        
        .status-text {
          color: #9ca3af;
          font-size: 0.875rem;
          font-weight: 500;
        }
        
        .chromeos-gate-actions {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        
        .gate-btn {
          padding: 1rem 2rem;
          border-radius: 0.75rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border: none;
          position: relative;
          overflow: hidden;
        }
        
        .gate-btn-primary {
          background: linear-gradient(135deg, rgb(37, 99, 235), rgb(30, 58, 138));
          color: white;
          box-shadow: 0 4px 16px rgba(37, 99, 235, 0.3);
        }
        
        .gate-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(37, 99, 235, 0.4);
        }
        
        .gate-btn-primary:active {
          transform: translateY(0);
        }
        
        .gate-btn-secondary {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #9ca3af;
        }
        
        .gate-btn-secondary:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #e4e4e7;
        }
        
        .gate-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .chromeos-gate-links {
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .gate-link {
          color: rgb(59, 130, 246);
          text-decoration: none;
          font-size: 0.875rem;
          margin: 0 0.5rem;
          transition: color 0.2s;
        }
        
        .gate-link:hover {
          color: rgb(96, 165, 250);
          text-decoration: underline;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  private async checkLinuxStatus(): Promise<boolean> {
    try {
      // Use bridge API to check Linux status (only reliable method)
      const response = await fetch('http://127.0.0.1:8765/api/chromeos/settings/status', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        // Check multiple indicators of Linux being enabled
        return data.linuxEnabled === true || 
               (data.isChromeOS && data.developerMode && data.usbBoot);
      }
    } catch (error) {
      // Bridge not available - cannot check status reliably
      console.warn('Bridge not available, cannot check Linux status:', error);
    }
    
    return false;
  }

  // Removed checkCrostiniDirectly - all checks go through bridge API

  private async enableLinuxViaBridge(): Promise<boolean> {
    try {
      const response = await fetch('http://127.0.0.1:8765/api/chromeos/settings/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setting: 'linux-env' })
      });

      if (response.ok) {
        const data = await response.json();
        return data.success === true;
      }
    } catch (error) {
      console.error('Failed to enable Linux via bridge:', error);
    }
    
    return false;
  }

  private async enableLinuxDirectly(): Promise<boolean> {
    // This method is no longer used - all enabling is done via bridge API
    // If bridge is not available, we can't enable Linux programmatically
    return false;
  }

  private async enableBypassEnrollment(): Promise<boolean> {
    try {
      const response = await fetch('http://127.0.0.1:8765/api/chromeos/settings/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setting: 'bypass-enrollment' })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          notificationManager.success('Enrollment restrictions bypassed');
          return true;
        }
      }
    } catch (error) {
      console.error('Failed to bypass enrollment:', error);
    }
    
    return false;
  }

  private render(): void {
    if (!this.container) return;

    const statusText = this.linuxStatus.checking
      ? 'Checking Linux environment...'
      : this.linuxStatus.enabled
      ? 'Linux environment is enabled'
      : 'Linux environment is not enabled';

    this.container.innerHTML = `
      <div class="chromeos-gate-content">
        <div class="chromeos-gate-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
          </svg>
        </div>
        
        <h1 class="chromeos-gate-title">Linux Environment Required</h1>
        <p class="chromeos-gate-description">
          To use Clay Terminal on ChromeOS, you must enable the Linux environment (Crostini).
          This allows full system access and advanced features.
        </p>
        
        <div class="chromeos-gate-status">
          <div class="status-dot ${this.linuxStatus.checking ? 'checking' : this.linuxStatus.enabled ? 'enabled' : ''}"></div>
          <span class="status-text">${statusText}</span>
        </div>
        
        <div class="chromeos-gate-actions">
          ${!this.linuxStatus.enabled ? `
            <button id="gate-enable-linux" class="gate-btn gate-btn-primary" ${this.linuxStatus.checking ? 'disabled' : ''}>
              ${this.linuxStatus.checking ? 'Checking...' : 'Enable Linux Environment'}
            </button>
            <button id="gate-bypass-enrollment" class="gate-btn gate-btn-secondary">
              Bypass Enrollment Restrictions
            </button>
            <button id="gate-open-settings" class="gate-btn gate-btn-secondary">
              Open ChromeOS Settings
            </button>
          ` : `
            <button id="gate-continue" class="gate-btn gate-btn-primary">
              Continue to Terminal
            </button>
          `}
        </div>
        
        <div class="chromeos-gate-links">
          <button id="gate-start-bridge" class="gate-link" style="background: none; border: none; cursor: pointer;">Start Bridge Server</button>
          <span class="gate-link" style="color: #6b7280;">|</span>
          <span class="gate-link" style="color: #6b7280;">All settings are enabled via bridge API</span>
        </div>
      </div>
    `;

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    const enableBtn = document.getElementById('gate-enable-linux');
    const bypassBtn = document.getElementById('gate-bypass-enrollment');
    const settingsBtn = document.getElementById('gate-open-settings');
    const continueBtn = document.getElementById('gate-continue');

    enableBtn?.addEventListener('click', async () => {
      this.linuxStatus.checking = true;
      this.render();
      
      // Enable Linux via bridge API only (no chrome:// URLs)
      const success = await this.enableLinuxViaBridge();
      
      if (success) {
        notificationManager.success('Linux environment enabled! Checking status...');
        // Wait a bit then recheck
        setTimeout(async () => {
          await this.updateStatus();
        }, 2000);
      } else {
        this.linuxStatus.checking = false;
        this.render();
      }
    });

    bypassBtn?.addEventListener('click', async () => {
      const success = await this.enableBypassEnrollment();
      if (success) {
        // Recheck Linux status after bypass
        setTimeout(async () => {
          await this.updateStatus();
        }, 1000);
      }
    });

    settingsBtn?.addEventListener('click', async () => {
      // Try to enable Linux via bridge API
      const success = await this.enableLinuxViaBridge();
      if (!success) {
        notificationManager.warning('Bridge server not available. Please start the bridge server to enable Linux.');
      }
    });

    continueBtn?.addEventListener('click', () => {
      this.close();
    });

    const startBridgeBtn = document.getElementById('gate-start-bridge');
    startBridgeBtn?.addEventListener('click', () => {
      notificationManager.info('Please start the bridge server: cd bridge && npm start');
    });
  }

  async updateStatus(): Promise<void> {
    this.linuxStatus.checking = true;
    this.render();
    
    const enabled = await this.checkLinuxStatus();
    this.linuxStatus.enabled = enabled;
    this.linuxStatus.checking = false;
    
    this.render();
    
    if (enabled) {
      notificationManager.success('Linux environment is enabled! You can now continue.');
    }
  }

  async open(): Promise<void> {
    if (!this.container) return;
    
    this.isOpen = true;
    this.container.classList.remove('hidden');
    
    // Check Linux status
    await this.updateStatus();
    
    // Periodically check status
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    this.checkInterval = setInterval(async () => {
      if (this.isOpen && !this.linuxStatus.enabled) {
        await this.updateStatus();
      } else if (this.linuxStatus.enabled && this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }
    }, 5000);
  }

  close(): void {
    if (!this.container) return;
    
    this.isOpen = false;
    this.container.classList.add('hidden');
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  isLinuxEnabled(): boolean {
    return this.linuxStatus.enabled;
  }

  async checkAndBlock(): Promise<boolean> {
    // Check if we should block access
    if (!this.isChromeOS()) {
      return false; // Don't block on non-ChromeOS
    }
    
    const enabled = await this.checkLinuxStatus();
    if (!enabled) {
      await this.open();
      return true; // Block access
    }
    
    return false; // Allow access
  }

  private isChromeOS(): boolean {
    if (typeof navigator === 'undefined') return false;
    
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('cros') || ua.includes('chromeos')) {
      return true;
    }
    
    if ((navigator as any).userAgentData?.platform === 'Chrome OS') {
      return true;
    }
    
    return false;
  }
}

export const chromeOSGate = new ChromeOSGate();

// Expose to window for global access
if (typeof window !== 'undefined') {
  (window as any).chromeOSGate = chromeOSGate;
}

