/**
 * Chrostini Initializers Integration
 * Rapid setup scripts for ChromeOS Linux container (Chrostini)
 * https://github.com/francis-chris5/Chrostini-Initializers
 */

import type { BackendInterface } from './crosup';

export interface ChrostiniConfig {
  packages?: string[];
  desktop?: boolean;
  development?: boolean;
  multimedia?: boolean;
}

export class ChrostiniIntegration {
  private isChromeOS: boolean = false;
  private isLinuxEnabled: boolean = false;
  private backend: BackendInterface | null = null;

  constructor(backend?: BackendInterface) {
    this.backend = backend || null;
    this.detectEnvironment();
  }

  /**
   * Set backend instance
   */
  setBackend(backend: BackendInterface): void {
    this.backend = backend;
    this.detectEnvironment();
  }

  /**
   * Detect if running on ChromeOS with Linux enabled
   */
  private async detectEnvironment(): Promise<void> {
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase();
      this.isChromeOS = ua.includes('cros') || ua.includes('chromeos');
    }

    // Check if Linux container is available
    if (this.backend) {
      try {
        const result = await this.executeCommand('which penguin-container');
        this.isLinuxEnabled = result.exitCode === 0;
      } catch {
        this.isLinuxEnabled = false;
      }
    }
  }

  /**
   * Initialize Chrostini with basic setup
   */
  async initialize(config: ChrostiniConfig = {}): Promise<{ success: boolean; output: string }> {
    if (!this.isChromeOS) {
      return { success: false, output: 'Chrostini is only available on ChromeOS' };
    }

    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    const scripts: string[] = [];

    // Basic package installation
    if (config.packages && config.packages.length > 0) {
      scripts.push(`sudo apt-get update`);
      scripts.push(`sudo apt-get install -y ${config.packages.join(' ')}`);
    }

    // Desktop environment setup
    if (config.desktop) {
      scripts.push(`
        # Install desktop environment
        sudo apt-get update
        sudo apt-get install -y xfce4 xfce4-goodies
        sudo apt-get install -y tigervnc-standalone-server tigervnc-common
      `);
    }

    // Development tools
    if (config.development) {
      scripts.push(`
        # Development tools
        sudo apt-get install -y build-essential git curl wget
        sudo apt-get install -y python3 python3-pip nodejs npm
        sudo apt-get install -y vim neovim
      `);
    }

    // Multimedia support
    if (config.multimedia) {
      scripts.push(`
        # Multimedia support
        sudo apt-get install -y ffmpeg vlc
        sudo apt-get install -y gimp inkscape
      `);
    }

    const fullScript = scripts.join('\n');
    const result = await this.executeCommand(fullScript);
    return {
      success: result.exitCode === 0,
      output: result.output,
    };
  }

  /**
   * Quick setup for common development environment
   */
  async quickSetup(): Promise<{ success: boolean; output: string }> {
    return this.initialize({
      development: true,
      packages: ['git', 'curl', 'wget', 'vim', 'build-essential'],
    });
  }

  /**
   * Install desktop environment
   */
  async installDesktop(): Promise<{ success: boolean; output: string }> {
    return this.initialize({
      desktop: true,
    });
  }

  /**
   * Update Linux container
   */
  async update(): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    const updateScript = `sudo apt-get update && sudo apt-get upgrade -y && sudo apt-get dist-upgrade -y && sudo apt-get autoremove -y`;
    const result = await this.executeCommand(updateScript);
    return {
      success: result.exitCode === 0,
      output: result.output,
    };
  }

  /**
   * Install specific package
   */
  async installPackage(packageName: string): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    const result = await this.executeCommand(`sudo apt-get install -y ${packageName}`);
    return {
      success: result.exitCode === 0,
      output: result.output,
    };
  }

  /**
   * Check Linux container status
   */
  async checkStatus(): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }
    const statusScript = `
      echo "=== ChromeOS Linux Container Status ==="
      echo "OS: $(uname -a)"
      echo "User: $(whoami)"
      echo "Home: $HOME"
      echo "Disk Usage:"
      df -h | grep -E '^/dev/|Filesystem'
      echo ""
      echo "Memory:"
      free -h
      echo ""
      echo "Installed Packages:"
      dpkg -l | wc -l
    `;
    const result = await this.executeCommand(statusScript);
    return {
      success: result.exitCode === 0,
      output: result.output,
    };
  }

  /**
   * Execute command in Linux container
   */
  private async executeCommand(command: string): Promise<{ exitCode: number; output: string }> {
    if (!this.backend) {
      return { exitCode: 1, output: 'Backend not available' };
    }
    return await this.backend.executeCommand(command);
  }

  getStatus(): { chromeOS: boolean; linuxEnabled: boolean } {
    return {
      chromeOS: this.isChromeOS,
      linuxEnabled: this.isLinuxEnabled,
    };
  }
}

// Export singleton instance
export const chrostiniIntegration = new ChrostiniIntegration();

