/**
 * Crosup Integration
 * Development environment setup tool for Chromebook/ChromeOS, macOS, and Linux
 * https://github.com/tsirysndr/crosup
 */

export interface CrosupConfig {
  packages?: string[];
  tools?: string[];
  autoInstall?: boolean;
}

export interface BackendInterface {
  executeCommand(command: string, cwd?: string): Promise<{ exitCode: number; output: string }>;
}

export class CrosupIntegration {
  private isAvailable: boolean = false;
  private version: string | null = null;
  private backend: BackendInterface | null = null;

  constructor(backend?: BackendInterface) {
    this.backend = backend || null;
    if (backend) {
      this.checkAvailability();
    }
  }

  /**
   * Set backend instance
   */
  setBackend(backend: BackendInterface): void {
    this.backend = backend;
    this.checkAvailability();
  }

  /**
   * Check if crosup is available on the system
   */
  async checkAvailability(): Promise<boolean> {
    if (!this.backend) return false;
    
    try {
      // Check if crosup is installed
      const result = await this.executeCommand('which crosup');
      if (result.exitCode === 0 && result.output.trim()) {
        this.isAvailable = true;
        // Get version
        const versionResult = await this.executeCommand('crosup --version');
        if (versionResult.exitCode === 0) {
          this.version = versionResult.output.trim();
        }
        return true;
      }
    } catch (error) {
      // crosup not available
    }
    return false;
  }

  /**
   * Install crosup if not available
   */
  async installCrosup(): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    // Installation script based on crosup's install instructions
    const installScript = `if ! command -v crosup &> /dev/null; then curl -fsSL https://raw.githubusercontent.com/tsirysndr/crosup/master/install.sh | bash; fi`;

    const result = await this.executeCommand(installScript);
    return {
      success: result.exitCode === 0,
      output: result.output,
    };
  }

  /**
   * Initialize crosup configuration
   */
  async initConfig(format: 'toml' | 'hcl' = 'toml'): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    if (!this.isAvailable) {
      await this.installCrosup();
    }
    const result = await this.executeCommand(`crosup init ${format === 'toml' ? '--toml' : ''}`);
    return {
      success: result.exitCode === 0,
      output: result.output,
    };
  }

  /**
   * Install packages using crosup
   */
  async installPackages(packages: string[]): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    if (!this.isAvailable) {
      const installResult = await this.installCrosup();
      if (!installResult.success) {
        return installResult;
      }
    }

    // Create temporary config file
    const configContent = packages.map(pkg => `"${pkg}"`).join(',\n  ');
    const configFile = `packages = [\n  ${configContent}\n]`;

    // Write config and install
    const installCommand = `cat > /tmp/Crosfile.toml << 'EOF'\n${configFile}\nEOF\ncrosup install`;

    const result = await this.executeCommand(installCommand);
    return {
      success: result.exitCode === 0,
      output: result.output,
    };
  }

  /**
   * Add a package to existing configuration
   */
  async addPackage(packageName: string): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    if (!this.isAvailable) {
      await this.installCrosup();
    }
    const result = await this.executeCommand(`crosup add ${packageName}`);
    return {
      success: result.exitCode === 0,
      output: result.output,
    };
  }

  /**
   * Search for packages in nixpkgs
   */
  async searchPackage(query: string): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    if (!this.isAvailable) {
      await this.installCrosup();
    }
    const result = await this.executeCommand(`crosup search ${query}`);
    return {
      success: result.exitCode === 0,
      output: result.output,
    };
  }

  /**
   * Show configuration diff
   */
  async showDiff(): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    if (!this.isAvailable) {
      return { success: false, output: 'crosup not available' };
    }
    const result = await this.executeCommand('crosup diff');
    return {
      success: result.exitCode === 0,
      output: result.output,
    };
  }

  /**
   * Show configuration history
   */
  async showHistory(): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    if (!this.isAvailable) {
      return { success: false, output: 'crosup not available' };
    }
    const result = await this.executeCommand('crosup history');
    return {
      success: result.exitCode === 0,
      output: result.output,
    };
  }

  /**
   * Execute a command using the backend
   */
  private async executeCommand(command: string): Promise<{ exitCode: number; output: string }> {
    if (!this.backend) {
      return { exitCode: 1, output: 'Backend not available' };
    }
    return await this.backend.executeCommand(command);
  }

  /**
   * Get recommended packages for development
   */
  getRecommendedPackages(): string[] {
    return [
      'vim',
      'git',
      'docker',
      'nix',
      'devbox',
      'homebrew',
      'fish',
      'vscode',
      'neovim',
      'ripgrep',
      'fzf',
      'zoxide',
      'bat',
      'eza',
      'glow',
      'httpie',
      'zellij',
      'direnv',
    ];
  }

  getStatus(): { available: boolean; version: string | null } {
    return {
      available: this.isAvailable,
      version: this.version,
    };
  }
}

// Export singleton instance
export const crosupIntegration = new CrosupIntegration();

