// ChromeOS Native Messaging Host
// Provides integration with ChromeOS native messaging APIs for privileged access

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * ChromeOS Native Messaging Host
 * Communicates with Chrome extension via native messaging protocol
 */
export class ChromeOSNativeMessaging {
  constructor() {
    this.isChromeOS = this.checkChromeOS();
    this.nativeMessagingPath = '/etc/opt/chrome/native-messaging-hosts';
    this.manifestPath = path.join(this.nativeMessagingPath, 'clay_terminal.json');
  }

  checkChromeOS() {
    if (process.platform !== 'linux') return false;
    try {
      const lsbRelease = fs.readFileSync('/etc/lsb-release', 'utf8');
      return lsbRelease.includes('CHROMEOS');
    } catch {
      return false;
    }
  }

  /**
   * Install native messaging host manifest
   */
  async installManifest() {
    if (!this.isChromeOS) {
      throw new Error('Native messaging only available on ChromeOS');
    }

    const manifest = {
      name: 'clay_terminal',
      description: 'Clay Terminal Native Messaging Host',
      path: path.join(__dirname, 'chromeos-native-messaging.js'),
      type: 'stdio',
      allowed_origins: [
        'chrome-extension://*'
      ]
    };

    try {
      // Ensure directory exists
      if (!fs.existsSync(this.nativeMessagingPath)) {
        fs.mkdirSync(this.nativeMessagingPath, { mode: 0o755, recursive: true });
      }

      // Write manifest
      fs.writeFileSync(
        this.manifestPath,
        JSON.stringify(manifest, null, 2),
        { mode: 0o644 }
      );

      return true;
    } catch (error) {
      throw new Error(`Failed to install manifest: ${error.message}`);
    }
  }

  /**
   * Handle native messaging request
   */
  async handleMessage(message) {
    const { type, payload } = JSON.parse(message);

    switch (type) {
      case 'system.info':
        return await this.getSystemInfo();
      case 'filesystem.read':
        return await this.readFileSystem(payload.path);
      case 'processes.list':
        return await this.getProcesses();
      case 'process.kill':
        return await this.killProcess(payload.pid);
      case 'diagnostics.run':
        return await this.runDiagnostics();
      case 'hardware.info':
        return await this.getHardwareInfo();
      case 'network.interfaces':
        return await this.getNetworkInterfaces();
      case 'enterprise.info':
        return await this.getEnterpriseInfo();
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  }

  async getSystemInfo() {
    // Implementation would call chromeOSAPIs
    return { success: true };
  }

  async readFileSystem(filePath) {
    // Implementation would call chromeOSAPIs
    return { success: true, path: filePath };
  }

  async getProcesses() {
    // Implementation would call chromeOSAPIs
    return { success: true, processes: [] };
  }

  async killProcess(pid) {
    // Implementation would call chromeOSAPIs
    return { success: true, pid };
  }

  async runDiagnostics() {
    // Implementation would call chromeOSAPIs
    return { success: true };
  }

  async getHardwareInfo() {
    // Implementation would call chromeOSAPIs
    return { success: true };
  }

  async getNetworkInterfaces() {
    // Implementation would call chromeOSAPIs
    return { success: true, interfaces: [] };
  }

  async getEnterpriseInfo() {
    // Implementation would call chromeOSAPIs
    return { success: true };
  }

  /**
   * Start native messaging host (for stdio communication)
   */
  start() {
    if (!this.isChromeOS) {
      console.error('Native messaging only available on ChromeOS');
      return;
    }

    // Read from stdin (Chrome sends messages here)
    let buffer = '';
    process.stdin.on('data', async (chunk) => {
      buffer += chunk.toString();
      
      // Native messaging protocol: 4-byte length header + JSON message
      while (buffer.length >= 4) {
        const length = buffer.readUInt32LE(0);
        if (buffer.length >= 4 + length) {
          const message = buffer.substring(4, 4 + length);
          buffer = buffer.substring(4 + length);
          
          try {
            const response = await this.handleMessage(message);
            this.sendResponse(response);
          } catch (error) {
            this.sendResponse({ error: error.message });
          }
        } else {
          break; // Wait for more data
        }
      }
    });
  }

  /**
   * Send response via native messaging protocol
   */
  sendResponse(response) {
    const message = JSON.stringify(response);
    const length = Buffer.allocUnsafe(4);
    length.writeUInt32LE(message.length, 0);
    
    process.stdout.write(length);
    process.stdout.write(message);
  }
}

// If run directly, start as native messaging host
if (import.meta.url === `file://${process.argv[1]}`) {
  const host = new ChromeOSNativeMessaging();
  host.start();
}

export const nativeMessaging = new ChromeOSNativeMessaging();

