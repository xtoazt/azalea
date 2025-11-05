// ChromeOS privileged API integration
// Provides access to system APIs, hardware control, and hidden features

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { nativeMessaging } from './chromeos-native-messaging.js';

const execAsync = promisify(exec);

/**
 * Check if running on ChromeOS
 */
export function isChromeOS() {
  if (process.platform !== 'linux') return false;
  
  try {
    const lsbRelease = fs.readFileSync('/etc/lsb-release', 'utf8');
    return lsbRelease.includes('CHROMEOS');
  } catch {
    return false;
  }
}

/**
 * Access ChromeOS system APIs via native messaging or direct system calls
 */
export class ChromeOSPrivilegedAPIs {
  constructor() {
    this.isChromeOS = isChromeOS();
    this.useNativeMessaging = false;
    
    // Try to use native messaging if available
    if (this.isChromeOS) {
      this.checkNativeMessaging();
    }
  }

  async checkNativeMessaging() {
    try {
      // Check if native messaging host is installed
      const manifestPath = '/etc/opt/chrome/native-messaging-hosts/clay_terminal.json';
      if (fs.existsSync(manifestPath)) {
        this.useNativeMessaging = true;
      }
    } catch {
      // Native messaging not available, use direct system calls
      this.useNativeMessaging = false;
    }
  }

  /**
   * Access chrome.system.* APIs via system commands
   * @returns {Promise<any>}
   */
  async getSystemInfo() {
    if (!this.isChromeOS) {
      throw new Error('Not running on ChromeOS');
    }

    try {
      // Get system information via various methods
      const [cpu, memory, disk, network] = await Promise.all([
        execAsync('lscpu').catch(() => ({ stdout: '' })),
        execAsync('free -h').catch(() => ({ stdout: '' })),
        execAsync('df -h').catch(() => ({ stdout: '' })),
        execAsync('ip addr').catch(() => ({ stdout: '' }))
      ]);

      return {
        cpu: cpu.stdout,
        memory: memory.stdout,
        disk: disk.stdout,
        network: network.stdout,
        platform: 'chromeos'
      };
    } catch (error) {
      throw new Error(`Failed to get system info: ${error.message}`);
    }
  }

  /**
   * Access chrome.fileSystem API functionality
   * @param {string} path
   * @returns {Promise<any>}
   */
  async readFileSystem(path) {
    try {
      const stats = await fs.promises.stat(path);
      if (stats.isDirectory()) {
        const files = await fs.promises.readdir(path);
        return { type: 'directory', files };
      } else {
        const content = await fs.promises.readFile(path, 'utf8');
        return { type: 'file', content, size: stats.size };
      }
    } catch (error) {
      throw new Error(`Failed to read filesystem: ${error.message}`);
    }
  }

  /**
   * Access chrome.processes API functionality
   * @returns {Promise<any[]>}
   */
  async getProcesses() {
    try {
      const { stdout } = await execAsync('ps aux');
      const lines = stdout.split('\n').slice(1); // Skip header
      
      return lines.map(line => {
        const parts = line.trim().split(/\s+/);
        return {
          pid: parts[1],
          cpu: parts[2],
          mem: parts[3],
          command: parts.slice(10).join(' ')
        };
      }).filter(p => p.pid);
    } catch (error) {
      throw new Error(`Failed to get processes: ${error.message}`);
    }
  }

  /**
   * @param {string} pid
   * @returns {Promise<void>}
   */
  async killProcess(pid) {
    try {
      await execAsync(`kill -9 ${pid}`);
    } catch (error) {
      throw new Error(`Failed to kill process: ${error.message}`);
    }
  }

  /**
   * Access chrome.diagnostics API functionality
   * @returns {Promise<any>}
   */
  async runDiagnostics() {
    try {
      const [cpu, memory, disk, network] = await Promise.all([
        execAsync('top -bn1 | head -20').catch(() => ({ stdout: '' })),
        execAsync('free -h').catch(() => ({ stdout: '' })),
        execAsync('df -h').catch(() => ({ stdout: '' })),
        execAsync('ifconfig').catch(() => ({ stdout: '' }))
      ]);

      return {
        cpu: cpu.stdout,
        memory: memory.stdout,
        disk: disk.stdout,
        network: network.stdout,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to run diagnostics: ${error.message}`);
    }
  }

  /**
   * Access hardware information
   * @returns {Promise<any>}
   */
  async getHardwareInfo() {
    try {
      const [cpu, memory, disk, pci, usb] = await Promise.all([
        execAsync('lscpu').catch(() => ({ stdout: '' })),
        execAsync('cat /proc/meminfo').catch(() => ({ stdout: '' })),
        execAsync('lsblk').catch(() => ({ stdout: '' })),
        execAsync('lspci').catch(() => ({ stdout: '' })),
        execAsync('lsusb').catch(() => ({ stdout: '' }))
      ]);

      return {
        cpu: cpu.stdout,
        memory: memory.stdout,
        disk: disk.stdout,
        pci: pci.stdout,
        usb: usb.stdout
      };
    } catch (error) {
      throw new Error(`Failed to get hardware info: ${error.message}`);
    }
  }

  /**
   * Access network interfaces with full privileges
   * @returns {Promise<any[]>}
   */
  async getNetworkInterfaces() {
    try {
      const { stdout } = await execAsync('ip -o link show');
      const interfaces = stdout.split('\n').map(line => {
        const match = line.match(/\d+:\s+(\w+):/);
        return match ? match[1] : null;
      }).filter(Boolean);

      return interfaces.map(iface => ({
        name: iface,
        // Get more details per interface
      }));
    } catch (error) {
      throw new Error(`Failed to get network interfaces: ${error.message}`);
    }
  }

  /**
   * Enable developer mode features (if available)
   * @returns {Promise<boolean>}
   */
  async enableDeveloperFeatures() {
    if (!this.isChromeOS) return false;

    try {
      // Attempt to enable developer mode features
      // This may require specific ChromeOS APIs or system configuration
      await execAsync('crossystem dev_boot_usb=1 dev_boot_signed_only=0');
      return true;
    } catch (error) {
      // May fail if not in developer mode
      return false;
    }
  }

  /**
   * Access to ChromeOS-specific system paths
   * @returns {Promise<any>}
   */
  async getChromeOSPaths() {
    if (!this.isChromeOS) {
      throw new Error('Not running on ChromeOS');
    }

    const paths = {
      stateful: '/mnt/stateful_partition',
      encrypted: '/mnt/stateful_partition/encrypted',
      chromeos: '/mnt/chromeos',
      myFiles: '/mnt/chromeos/MyFiles',
      linuxFiles: '/mnt/chromeos/MyFiles/LinuxFiles'
    };

    // Check which paths exist
    const existingPaths = {};
    for (const [name, path] of Object.entries(paths)) {
      try {
        if (fs.existsSync(path)) {
          existingPaths[name] = path;
        }
      } catch {
        // Path doesn't exist
      }
    }

    return existingPaths;
  }

  /**
   * Bypass ChromeOS security restrictions
   * @returns {Promise<boolean>}
   */
  async bypassSecurityRestrictions() {
    if (!this.isChromeOS) return false;

    try {
      // Attempt to disable security features
      // This requires root access and developer mode
      await execAsync('sudo crossystem disable_dev_boot_usb_signing=1');
      await execAsync('sudo crossystem dev_boot_usb=1');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Access to ChromeOS enterprise APIs (if enrolled)
   * @returns {Promise<any>}
   */
  async getEnterpriseInfo() {
    if (!this.isChromeOS) {
      throw new Error('Not running on ChromeOS');
    }

    try {
      // Check for enterprise enrollment
      const enrollment = await execAsync('crossystem cros_debug').catch(() => ({ stdout: '0' }));
      const isEnterprise = enrollment.stdout.trim() === '1';

      return {
        isEnterprise,
        enrollment: enrollment.stdout.trim()
      };
    } catch (error) {
      return { isEnterprise: false };
    }
  }
}

// Export singleton instance
export const chromeOSAPIs = new ChromeOSPrivilegedAPIs();

