/**
 * VirtualBox Integration
 * Virtual machine management via VirtualBox
 * https://github.com/VirtualBox/virtualbox
 */

import type { BackendInterface } from './crosup';

export interface VirtualBoxVM {
  name: string;
  uuid: string;
  state: 'running' | 'poweredoff' | 'saved' | 'paused' | 'aborted';
  osType: string;
  memory: number;
  vram: number;
}

export interface VirtualBoxConfig {
  name: string;
  osType?: string;
  memory?: number; // MB
  vram?: number; // MB
  hdd?: number; // MB
  network?: 'nat' | 'bridged' | 'hostonly' | 'internal';
}

export class VirtualBoxIntegration {
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
   * Check if VirtualBox is available
   */
  async checkAvailability(): Promise<boolean> {
    if (!this.backend) return false;

    try {
      const result = await this.executeCommand('which VBoxManage');
      if (result.exitCode === 0 && result.output.trim()) {
        this.isAvailable = true;
        // Get version
        const versionResult = await this.executeCommand('VBoxManage --version');
        if (versionResult.exitCode === 0) {
          this.version = versionResult.output.trim();
        }
        return true;
      }
    } catch (error) {
      // VirtualBox not available
    }
    return false;
  }

  /**
   * List all VMs
   */
  async listVMs(): Promise<VirtualBoxVM[]> {
    if (!this.isAvailable) {
      return [];
    }

    if (!this.backend) {
      return [];
    }

    const result = await this.executeCommand('VBoxManage list vms');
    if (result.exitCode !== 0) {
      return [];
    }

    const vms: VirtualBoxVM[] = [];
    const lines = result.output.split('\n').filter(line => line.trim());

    for (const line of lines) {
      // Parse: "vm-name" {uuid}
      const match = line.match(/^"([^"]+)" \{([^}]+)\}$/);
      if (match) {
        const name = match[1];
        const uuid = match[2];
        
        // Get detailed info
        const info = await this.getVMInfo(uuid);
        vms.push({
          name,
          uuid,
          ...info,
        });
      }
    }

    return vms;
  }

  /**
   * Get VM information
   */
  async getVMInfo(uuid: string): Promise<Partial<VirtualBoxVM>> {
    if (!this.backend) {
      return {};
    }

    const result = await this.executeCommand(`VBoxManage showvminfo ${uuid} --machinereadable`);
    if (result.exitCode !== 0) {
      return {};
    }

    const info: any = {};
    const lines = result.output.split('\n');
    
    for (const line of lines) {
      const [key, value] = line.split('=');
      if (key && value) {
        const cleanKey = key.trim();
        const cleanValue = value.replace(/^"|"$/g, ''); // Remove quotes
        
        if (cleanKey === 'VMState') {
          info.state = this.parseState(cleanValue);
        } else if (cleanKey === 'ostype') {
          info.osType = cleanValue;
        } else if (cleanKey === 'memory') {
          info.memory = parseInt(cleanValue, 10);
        } else if (cleanKey === 'vram') {
          info.vram = parseInt(cleanValue, 10);
        }
      }
    }

    return info;
  }

  /**
   * Parse VM state
   */
  private parseState(state: string): VirtualBoxVM['state'] {
    const stateMap: Record<string, VirtualBoxVM['state']> = {
      'running': 'running',
      'poweroff': 'poweredoff',
      'saved': 'saved',
      'paused': 'paused',
      'aborted': 'aborted',
    };
    return stateMap[state.toLowerCase()] || 'poweredoff';
  }

  /**
   * Create a new VM
   */
  async createVM(config: VirtualBoxConfig): Promise<{ success: boolean; output: string; uuid?: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    if (!this.isAvailable) {
      return { success: false, output: 'VirtualBox not available' };
    }

    const {
      name,
      osType = 'Linux26_64',
      memory = 1024,
      vram = 16,
      hdd = 10000,
      network = 'nat',
    } = config;

    const commands = [
      `VBoxManage createvm --name "${name}" --ostype ${osType} --register`,
      `VBoxManage modifyvm "${name}" --memory ${memory}`,
      `VBoxManage modifyvm "${name}" --vram ${vram}`,
      `VBoxManage createhd --filename "${name}.vdi" --size ${hdd}`,
      `VBoxManage storagectl "${name}" --name "SATA Controller" --add sata --controller IntelAHCI`,
      `VBoxManage storageattach "${name}" --storagectl "SATA Controller" --port 0 --device 0 --type hdd --medium "${name}.vdi"`,
      `VBoxManage modifyvm "${name}" --nic1 ${network}`,
    ];

    let output = '';
    for (const cmd of commands) {
      const result = await this.executeCommand(cmd);
      output += result.output + '\n';
      if (result.exitCode !== 0) {
        return { success: false, output };
      }
    }

    // Get UUID
    const uuidResult = await this.executeCommand(`VBoxManage showvminfo "${name}" --machinereadable | grep UUID`);
    const uuidMatch = uuidResult.output.match(/UUID="([^"]+)"/);
    const uuid = uuidMatch ? uuidMatch[1] : undefined;

    return { success: true, output, uuid };
  }

  /**
   * Start a VM
   */
  async startVM(nameOrUuid: string, headless: boolean = false): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    if (!this.isAvailable) {
      return { success: false, output: 'VirtualBox not available' };
    }

    const mode = headless ? '--type headless' : '--type gui';
    const result = await this.executeCommand(`VBoxManage startvm "${nameOrUuid}" ${mode}`);
    return {
      success: result.exitCode === 0,
      output: result.output,
    };
  }

  /**
   * Stop a VM
   */
  async stopVM(nameOrUuid: string, force: boolean = false): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    if (!this.isAvailable) {
      return { success: false, output: 'VirtualBox not available' };
    }

    const method = force ? 'poweroff' : 'acpipowerbutton';
    const result = await this.executeCommand(`VBoxManage controlvm "${nameOrUuid}" ${method}`);
    return {
      success: result.exitCode === 0,
      output: result.output,
    };
  }

  /**
   * Delete a VM
   */
  async deleteVM(nameOrUuid: string): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    if (!this.isAvailable) {
      return { success: false, output: 'VirtualBox not available' };
    }

    const result = await this.executeCommand(`VBoxManage unregistervm "${nameOrUuid}" --delete`);
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

  getStatus(): { available: boolean; version: string | null } {
    return {
      available: this.isAvailable,
      version: this.version,
    };
  }
}

// Export singleton instance
export const virtualBoxIntegration = new VirtualBoxIntegration();

