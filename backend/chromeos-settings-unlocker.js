// ChromeOS Hidden Settings Unlocker
// Bypasses enrollment restrictions and unlocks all hidden settings features

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

/**
 * Check if running on ChromeOS
 */
function isChromeOS() {
  if (process.platform !== 'linux') return false;
  
  try {
    const lsbRelease = fs.readFileSync('/etc/lsb-release', 'utf8');
    return lsbRelease.includes('CHROMEOS');
  } catch {
    return false;
  }
}

/**
 * Execute command with root privileges
 */
async function executeAsRoot(command) {
  const isRoot = process.getuid && process.getuid() === 0;
  
  if (!isRoot && process.platform !== 'win32') {
    const fullCommand = `sudo -n ${command}`;
    try {
      const result = await execAsync(fullCommand);
      return result.stdout || result.stderr || '';
    } catch (error) {
      // Try with pkexec or alternative
      try {
        const result = await execAsync(`pkexec ${command}`);
        return result.stdout || result.stderr || '';
      } catch (e) {
        throw new Error(`Root access required: ${error.message}`);
      }
    }
  } else {
    const result = await execAsync(command);
    return result.stdout || result.stderr || '';
  }
}

/**
 * ChromeOS Settings Unlocker - Unlocks all hidden settings
 */
export class ChromeOSSettingsUnlocker {
  isChromeOS = false;

  constructor() {
    this.isChromeOS = isChromeOS();
  }

  /**
   * Enable Linux Environment (Crostini)
   */
  async enableLinuxEnvironment() {
    if (!this.isChromeOS) return false;

    try {
      // Enable Linux via crossystem
      await executeAsRoot('crossystem cros_debug=1');
      await executeAsRoot('crossystem dev_boot_usb=1');
      
      // Enable Crostini via policy
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const policy = {
        'FeatureFlags': {
          'CrostiniEnabled': true,
          'ArcEnabled': true
        },
        'CrostiniAllowed': true,
        'ArcAllowed': true
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/crostini_policy.json',
        JSON.stringify(policy, null, 2)
      );
      
      // Enable via flags file
      await executeAsRoot('echo "--enable-crostini" >> /etc/chrome_dev.conf');
      await executeAsRoot('echo "--enable-arc" >> /etc/chrome_dev.conf');
      
      return true;
    } catch (error) {
      console.error('Failed to enable Linux environment:', error);
      return false;
    }
  }

  /**
   * Enable ADB Connection
   */
  async enableADB() {
    if (!this.isChromeOS) return false;

    try {
      // Enable ADB via crossystem
      await executeAsRoot('crossystem dev_boot_usb=1');
      await executeAsRoot('crossystem dev_boot_signed_only=0');
      
      // Enable ADB in Chrome flags
      await executeAsRoot('echo "--enable-features=ArcAdbSideloading" >> /etc/chrome_dev.conf');
      
      // Enable USB debugging
      await executeAsRoot('echo "--enable-usb-device-support" >> /etc/chrome_dev.conf');
      
      // Set ADB enabled flag
      await executeAsRoot('vpd -s adb_enabled=1');
      
      return true;
    } catch (error) {
      console.error('Failed to enable ADB:', error);
      return false;
    }
  }

  /**
   * Enable Guest Mode
   */
  async enableGuestMode() {
    if (!this.isChromeOS) return false;

    try {
      // Enable guest mode via policy
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const policy = {
        'AllowGuest': true,
        'GuestModeEnabled': true
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/guest_policy.json',
        JSON.stringify(policy, null, 2)
      );
      
      // Enable via crossystem
      await executeAsRoot('crossystem cros_debug=1');
      
      return true;
    } catch (error) {
      console.error('Failed to enable guest mode:', error);
      return false;
    }
  }

  /**
   * Enable Developer Mode
   */
  async enableDeveloperMode() {
    if (!this.isChromeOS) return false;

    try {
      // Enable developer mode flags
      await executeAsRoot('crossystem cros_debug=1');
      await executeAsRoot('crossystem dev_boot_usb=1');
      await executeAsRoot('crossystem dev_boot_signed_only=0');
      await executeAsRoot('crossystem dev_boot_legacy=1');
      
      // Enable developer features in Chrome
      await executeAsRoot('echo "--enable-experimental-web-platform-features" >> /etc/chrome_dev.conf');
      await executeAsRoot('echo "--enable-features=DeveloperMode" >> /etc/chrome_dev.conf');
      
      // Set developer mode flag
      await executeAsRoot('vpd -s developer_mode=1');
      
      return true;
    } catch (error) {
      console.error('Failed to enable developer mode:', error);
      return false;
    }
  }

  /**
   * Enable User Account Management
   */
  async enableUserAccountManagement() {
    if (!this.isChromeOS) return false;

    try {
      // Allow user account creation
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const policy = {
        'AllowNewUsers': true,
        'AllowUserSignin': true,
        'UserWhitelist': [],
        'DeviceGuestModeEnabled': true
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/user_policy.json',
        JSON.stringify(policy, null, 2)
      );
      
      return true;
    } catch (error) {
      console.error('Failed to enable user account management:', error);
      return false;
    }
  }

  /**
   * Enable All Developer Features
   */
  async enableAllDeveloperFeatures() {
    if (!this.isChromeOS) return false;

    try {
      // Comprehensive developer flags
      const devFlags = [
        '--enable-experimental-web-platform-features',
        '--enable-features=DeveloperMode',
        '--enable-unsafe-webgpu',
        '--enable-webgl-draft-extensions',
        '--enable-logging',
        '--enable-logging=stderr',
        '--v=1',
        '--enable-crash-reporter',
        '--enable-crash-reporter-for-testing',
        '--disable-features=UseChromeOSDirectVideoDecoder',
        '--enable-features=VaapiVideoDecoder',
        '--enable-features=PlatformKeys',
        '--enable-features=ExperimentalSecurityFeatures',
        '--enable-features=ExperimentalWebPlatformFeatures'
      ];
      
      let chromeDevConf = '';
      if (fs.existsSync('/etc/chrome_dev.conf')) {
        chromeDevConf = fs.readFileSync('/etc/chrome_dev.conf', 'utf8');
      }
      
      for (const flag of devFlags) {
        if (!chromeDevConf.includes(flag)) {
          chromeDevConf += `${flag}\n`;
        }
      }
      
      await executeAsRoot(`echo "${chromeDevConf}" > /etc/chrome_dev.conf`);
      
      return true;
    } catch (error) {
      console.error('Failed to enable developer features:', error);
      return false;
    }
  }

  /**
   * Bypass Enrollment Restrictions
   */
  async bypassEnrollment() {
    if (!this.isChromeOS) return false;

    try {
      // Remove enrollment requirement
      await executeAsRoot('rm -f /var/lib/whitelist/policy/*');
      await executeAsRoot('rm -f /var/lib/whitelist/device/*');
      
      // Disable enterprise enrollment enforcement
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const policy = {
        'DeviceEnrollmentEnabled': false,
        'EnrollmentRequired': false,
        'EnterpriseEnrollmentEnabled': false
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/enrollment_policy.json',
        JSON.stringify(policy, null, 2)
      );
      
      // Clear enrollment state
      await executeAsRoot('crossystem block_devmode=0');
      await executeAsRoot('crossystem cros_debug=1');
      
      return true;
    } catch (error) {
      console.error('Failed to bypass enrollment:', error);
      return false;
    }
  }

  /**
   * Enable All Hidden Settings
   */
  async enableAllSettings() {
    if (!this.isChromeOS) return false;

    try {
      await this.enableLinuxEnvironment();
      await this.enableADB();
      await this.enableGuestMode();
      await this.enableDeveloperMode();
      await this.enableUserAccountManagement();
      await this.enableAllDeveloperFeatures();
      await this.bypassEnrollment();
      
      return true;
    } catch (error) {
      console.error('Failed to enable all settings:', error);
      return false;
    }
  }

  /**
   * Get current status of all settings
   */
  async getSettingsStatus() {
    if (!this.isChromeOS) {
      return { isChromeOS: false };
    }

    try {
      const [crosDebug, devBoot, adbEnabled, guestMode] = await Promise.all([
        execAsync('crossystem cros_debug').catch(() => ({ stdout: '0' })),
        execAsync('crossystem dev_boot_usb').catch(() => ({ stdout: '0' })),
        execAsync('vpd -g adb_enabled').catch(() => ({ stdout: '0' })),
        fs.existsSync('/etc/opt/chrome/policies/managed/guest_policy.json')
      ]);

      return {
        isChromeOS: true,
        developerMode: crosDebug.stdout.trim() === '1',
        usbBoot: devBoot.stdout.trim() === '1',
        adbEnabled: adbEnabled.stdout.trim() === '1',
        guestMode: guestMode,
        linuxEnabled: fs.existsSync('/etc/opt/chrome/policies/managed/crostini_policy.json'),
        enrollmentBypassed: !fs.existsSync('/var/lib/whitelist/policy')
      };
    } catch (error) {
      return {
        isChromeOS: true,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * List all available settings commands
   */
  getAvailableSettings() {
    return [
      {
        id: 'linux-env',
        name: 'Enable Linux Environment',
        description: 'Enable Crostini (Linux container) support',
        category: 'Features'
      },
      {
        id: 'adb',
        name: 'Enable ADB Connection',
        description: 'Enable Android Debug Bridge and USB debugging',
        category: 'Developer'
      },
      {
        id: 'guest-mode',
        name: 'Enable Guest Mode',
        description: 'Allow guest user sessions',
        category: 'User Management'
      },
      {
        id: 'developer-mode',
        name: 'Enable Developer Mode',
        description: 'Enable all developer features and flags',
        category: 'Developer'
      },
      {
        id: 'user-accounts',
        name: 'Enable User Account Management',
        description: 'Allow creating and managing user accounts',
        category: 'User Management'
      },
      {
        id: 'developer-features',
        name: 'Enable All Developer Features',
        description: 'Enable all experimental and developer Chrome flags',
        category: 'Developer'
      },
      {
        id: 'bypass-enrollment',
        name: 'Bypass Enrollment Restrictions',
        description: 'Remove enterprise enrollment requirements',
        category: 'Security'
      },
      {
        id: 'all-settings',
        name: 'Enable All Settings',
        description: 'Enable all hidden settings at once',
        category: 'All'
      }
    ];
  }
}

// Export singleton instance
export const settingsUnlocker = new ChromeOSSettingsUnlocker();

