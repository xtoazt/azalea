/**
 * RecoMod Integration
 * ChromeOS Recovery and Modding Tools
 * https://github.com/MercuryWorkshop/RecoMod
 */

import type { BackendInterface } from './crosup';

export interface RecoModConfig {
  device?: string;
  recovery?: boolean;
  modding?: boolean;
}

export class RecoModIntegration {
  private isChromeOS: boolean = false;
  private isAvailable: boolean = false;
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
    this.checkAvailability();
  }

  /**
   * Detect ChromeOS environment
   */
  private detectEnvironment(): void {
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase();
      this.isChromeOS = ua.includes('cros') || ua.includes('chromeos');
    }
  }

  /**
   * Check if RecoMod tools are available
   */
  async checkAvailability(): Promise<boolean> {
    if (!this.isChromeOS || !this.backend) {
      return false;
    }

    // Check for common recovery tools
    const tools = ['cgpt', 'futility', 'crossystem'];
    for (const tool of tools) {
      const result = await this.executeCommand(`which ${tool}`);
      if (result.exitCode === 0) {
        this.isAvailable = true;
        return true;
      }
    }

    return false;
  }

  /**
   * Get device information
   */
  async getDeviceInfo(): Promise<{ success: boolean; output: string }> {
    if (!this.isChromeOS) {
      return { success: false, output: 'Not running on ChromeOS' };
    }

    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    const infoScript = `
      echo "=== ChromeOS Device Information ==="
      echo "Board: $(crossystem board)"
      echo "HWID: $(crossystem hwid)"
      echo "FWID: $(crossystem fwid)"
      echo "RO: $(crossystem ro_fwid)"
      echo "RW: $(crossystem rw_fwid)"
      echo "Dev Mode: $(crossystem devsw_boot)"
      echo "Recovery Mode: $(crossystem recovery_reason)"
      echo ""
      echo "Partition Table:"
      cgpt show /dev/sda 2>/dev/null || cgpt show /dev/mmcblk0 2>/dev/null || echo "Cannot access partition table"
    `;

    const result = await this.executeCommand(infoScript);
    return {
      success: result.exitCode === 0,
      output: result.output,
    };
  }

  /**
   * Check recovery mode status
   */
  async checkRecoveryMode(): Promise<{ success: boolean; output: string }> {
    if (!this.isChromeOS || !this.backend) {
      return { success: false, output: 'Not running on ChromeOS or backend not available' };
    }

    const result = await this.executeCommand('crossystem recovery_reason');
    return {
      success: result.exitCode === 0,
      output: result.output,
    };
  }

  /**
   * Get firmware information
   */
  async getFirmwareInfo(): Promise<{ success: boolean; output: string }> {
    if (!this.isChromeOS || !this.backend) {
      return { success: false, output: 'Not running on ChromeOS or backend not available' };
    }

    const fwScript = `
      echo "=== Firmware Information ==="
      echo "RO Firmware: $(crossystem ro_fwid)"
      echo "RW Firmware: $(crossystem rw_fwid)"
      echo "Main Firmware: $(crossystem fwid)"
      echo ""
      echo "Firmware Details:"
      futility show /usr/share/vboot/devkeys/root_key.vbpubk 2>/dev/null || echo "Cannot access firmware keys"
    `;

    const result = await this.executeCommand(fwScript);
    return {
      success: result.exitCode === 0,
      output: result.output,
    };
  }

  /**
   * Check developer mode status
   */
  async checkDeveloperMode(): Promise<{ success: boolean; output: string }> {
    if (!this.isChromeOS || !this.backend) {
      return { success: false, output: 'Not running on ChromeOS or backend not available' };
    }

    const devScript = `
      echo "Developer Mode: $(crossystem devsw_boot)"
      echo "Debug Build: $(crossystem debug_build)"
      echo "Recovery Request: $(crossystem recovery_request)"
    `;

    const result = await this.executeCommand(devScript);
    return {
      success: result.exitCode === 0,
      output: result.output,
    };
  }

  /**
   * Get partition information
   */
  async getPartitionInfo(): Promise<{ success: boolean; output: string }> {
    if (!this.isChromeOS || !this.backend) {
      return { success: false, output: 'Not running on ChromeOS or backend not available' };
    }

    const partScript = `
      echo "=== Partition Information ==="
      DEVICE="/dev/sda"
      if [ ! -e "$DEVICE" ]; then
        DEVICE="/dev/mmcblk0"
      fi
      
      if [ -e "$DEVICE" ]; then
        cgpt show "$DEVICE"
        echo ""
        echo "Partition Details:"
        cgpt show -i 1 "$DEVICE" 2>/dev/null || echo "Cannot read partition 1"
        cgpt show -i 2 "$DEVICE" 2>/dev/null || echo "Cannot read partition 2"
        cgpt show -i 3 "$DEVICE" 2>/dev/null || echo "Cannot read partition 3"
        cgpt show -i 4 "$DEVICE" 2>/dev/null || echo "Cannot read partition 4"
        cgpt show -i 5 "$DEVICE" 2>/dev/null || echo "Cannot read partition 5"
        cgpt show -i 6 "$DEVICE" 2>/dev/null || echo "Cannot read partition 6"
        cgpt show -i 7 "$DEVICE" 2>/dev/null || echo "Cannot read partition 7"
        cgpt show -i 8 "$DEVICE" 2>/dev/null || echo "Cannot read partition 8"
        cgpt show -i 9 "$DEVICE" 2>/dev/null || echo "Cannot read partition 9"
        cgpt show -i 10 "$DEVICE" 2>/dev/null || echo "Cannot read partition 10"
        cgpt show -i 11 "$DEVICE" 2>/dev/null || echo "Cannot read partition 11"
        cgpt show -i 12 "$DEVICE" 2>/dev/null || echo "Cannot read partition 12"
      else
        echo "Cannot access device: $DEVICE"
      fi
    `;

    const result = await this.executeCommand(partScript);
    return {
      success: result.exitCode === 0,
      output: result.output,
    };
  }

  /**
   * Execute command using the backend
   */
  private async executeCommand(command: string): Promise<{ exitCode: number; output: string }> {
    if (!this.backend) {
      return { exitCode: 1, output: 'Backend not available' };
    }
    return await this.backend.executeCommand(command);
  }

  getStatus(): { chromeOS: boolean; available: boolean } {
    return {
      chromeOS: this.isChromeOS,
      available: this.isAvailable,
    };
  }
}

// Export singleton instance
export const recomodIntegration = new RecoModIntegration();

