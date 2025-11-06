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
   * Enable Linux Environment (Crostini) - Comprehensive method using all available APIs
   */
  async enableLinuxEnvironment() {
    if (!this.isChromeOS) return false;

    try {
      // Step 1: Enable developer mode and USB boot via crossystem
      await executeAsRoot('crossystem cros_debug=1');
      await executeAsRoot('crossystem dev_boot_usb=1');
      await executeAsRoot('crossystem dev_boot_signed_only=0');
      await executeAsRoot('crossystem dev_boot_legacy=1');
      
      // Step 2: Enable Crostini via policy files (multiple locations for redundancy)
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      await executeAsRoot('mkdir -p /var/lib/whitelist/policy');
      
      // Main Crostini policy
      const crostiniPolicy = {
        'FeatureFlags': {
          'CrostiniEnabled': true,
          'ArcEnabled': true,
          'PluginVmEnabled': true
        },
        'CrostiniAllowed': true,
        'ArcAllowed': true,
        'PluginVmAllowed': true,
        'CrostiniExportImportUIAllowed': true,
        'CrostiniPortForwardingAllowed': true
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/crostini.json',
        JSON.stringify(crostiniPolicy, null, 2)
      );
      
      // Also write to managed policies (redundancy)
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/crostini_policy.json',
        JSON.stringify(crostiniPolicy, null, 2)
      );
      
      // Step 3: Enable via chrome_dev.conf flags
      let chromeDevConf = '';
      if (fs.existsSync('/etc/chrome_dev.conf')) {
        chromeDevConf = fs.readFileSync('/etc/chrome_dev.conf', 'utf8');
      }
      
      const chromeDevFlags = [
        '--enable-crostini',
        '--enable-arc',
        '--enable-plugin-vm',
        '--enable-features=Crostini,CrostiniPortForwarding',
        '--enable-features=ArcSupport',
        '--enable-features=PluginVm'
      ];
      
      for (const flag of chromeDevFlags) {
        if (!chromeDevConf.includes(flag)) {
          chromeDevConf += `${flag}\n`;
        }
      }
      
      await executeAsRoot(`cat > /etc/chrome_dev.conf << 'EOF'\n${chromeDevConf}EOF`);
      
      // Step 4: Enable via VPD (Vital Product Data)
      await executeAsRoot('vpd -s crostini_enabled=1').catch(() => {});
      await executeAsRoot('vpd -s arc_enabled=1').catch(() => {});
      
      // Step 5: Set user preferences (if user data directory exists)
      const userDataDir = '/home/chronos/user';
      if (fs.existsSync(userDataDir)) {
        const prefsPath = `${userDataDir}/Preferences`;
        if (fs.existsSync(prefsPath)) {
          try {
            const prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
            if (!prefs.crostini) prefs.crostini = {};
            prefs.crostini.enabled = true;
            prefs.crostini.arc_enabled = true;
            fs.writeFileSync(prefsPath, JSON.stringify(prefs, null, 2));
          } catch (e) {
            // Preferences file might be locked or invalid JSON
          }
        }
      }
      
      // Step 6: Enable Linux container via systemd (if available)
      await executeAsRoot('systemctl --user enable --now sommelier@0').catch(() => {});
      await executeAsRoot('systemctl --user enable --now sommelier@1').catch(() => {});
      
      // Step 7: Initialize Crostini container if it doesn't exist
      await executeAsRoot('lxc init penguin 2>/dev/null || true').catch(() => {});
      
      return true;
    } catch (error) {
      console.error('Failed to enable Linux environment:', error);
      return false;
    }
  }

  /**
   * Enable ADB Connection - Comprehensive method
   */
  async enableADB() {
    if (!this.isChromeOS) return false;

    try {
      // Step 1: Enable developer mode flags
      await executeAsRoot('crossystem dev_boot_usb=1');
      await executeAsRoot('crossystem dev_boot_signed_only=0');
      await executeAsRoot('crossystem cros_debug=1');
      
      // Step 2: Enable ADB via VPD
      await executeAsRoot('vpd -s adb_enabled=1').catch(() => {});
      await executeAsRoot('vpd -s arc_enabled=1').catch(() => {});
      
      // Step 3: Enable ADB in Chrome flags
      let chromeDevConf = '';
      if (fs.existsSync('/etc/chrome_dev.conf')) {
        chromeDevConf = fs.readFileSync('/etc/chrome_dev.conf', 'utf8');
      }
      
      const adbFlags = [
        '--enable-features=ArcAdbSideloading',
        '--enable-usb-device-support',
        '--enable-features=ArcUsbHost',
        '--enable-features=ArcUsbStorage'
      ];
      
      for (const flag of adbFlags) {
        if (!chromeDevConf.includes(flag)) {
          chromeDevConf += `${flag}\n`;
        }
      }
      
      await executeAsRoot(`cat > /etc/chrome_dev.conf << 'EOF'\n${chromeDevConf}EOF`);
      
      // Step 4: Enable ADB via policy
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const adbPolicy = {
        'ArcEnabled': true,
        'ArcAdbSideloadingEnabled': true,
        'UsbDetachableAllowlist': ['*']
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/adb_policy.json',
        JSON.stringify(adbPolicy, null, 2)
      );
      
      // Step 5: Enable ADB daemon
      await executeAsRoot('systemctl enable adbd').catch(() => {});
      await executeAsRoot('systemctl start adbd').catch(() => {});
      
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
   * Bypass Enrollment Restrictions - Comprehensive method
   */
  async bypassEnrollment() {
    if (!this.isChromeOS) return false;

    try {
      // Step 1: Remove enrollment requirement files
      await executeAsRoot('rm -rf /var/lib/whitelist/policy/*');
      await executeAsRoot('rm -rf /var/lib/whitelist/device/*');
      await executeAsRoot('rm -rf /var/lib/whitelist/owner/*');
      await executeAsRoot('rm -f /var/lib/whitelist/policy.pb');
      await executeAsRoot('rm -f /var/lib/whitelist/device.pb');
      
      // Step 2: Disable enterprise enrollment enforcement via policy
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const enrollmentPolicy = {
        'DeviceEnrollmentEnabled': false,
        'EnrollmentRequired': false,
        'EnterpriseEnrollmentEnabled': false,
        'DeviceEnrollmentAutoStart': false,
        'DeviceEnrollmentCanExit': true,
        'EnrollmentDomain': '',
        'EnrollmentToken': ''
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/enrollment_policy.json',
        JSON.stringify(enrollmentPolicy, null, 2)
      );
      
      // Step 3: Clear enrollment state via crossystem
      await executeAsRoot('crossystem block_devmode=0');
      await executeAsRoot('crossystem cros_debug=1');
      await executeAsRoot('crossystem dev_boot_usb=1');
      await executeAsRoot('crossystem dev_boot_signed_only=0');
      
      // Step 4: Remove enrollment from VPD
      await executeAsRoot('vpd -d enterprise_enrollment_id').catch(() => {});
      await executeAsRoot('vpd -d enterprise_owned').catch(() => {});
      
      // Step 5: Clear enrollment from stateful partition
      await executeAsRoot('rm -f /mnt/stateful_partition/etc/.managed_device').catch(() => {});
      await executeAsRoot('rm -f /mnt/stateful_partition/etc/.enterprise_owned').catch(() => {});
      
      // Step 6: Disable enrollment service
      await executeAsRoot('systemctl stop device_management_service').catch(() => {});
      await executeAsRoot('systemctl disable device_management_service').catch(() => {});
      
      // Step 7: Clear enrollment from Chrome user data
      const userDataDir = '/home/chronos/user';
      if (fs.existsSync(userDataDir)) {
        await executeAsRoot(`rm -rf ${userDataDir}/Local\ State`).catch(() => {});
        await executeAsRoot(`rm -rf ${userDataDir}/Default/Preferences`).catch(() => {});
      }
      
      return true;
    } catch (error) {
      console.error('Failed to bypass enrollment:', error);
      return false;
    }
  }

  /**
   * Enable Network Sharing and VPN
   */
  async enableNetworkSharing() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const networkPolicy = {
        'NetworkFileSharesAllowed': true,
        'NetworkFileSharesEnabled': true,
        'VPNConfigAllowed': true,
        'VPNDomain': '',
        'AllowVPN': true,
        'AllowNetworkFileShares': true
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/network_policy.json',
        JSON.stringify(networkPolicy, null, 2)
      );
      
      // Enable network sharing via systemd
      await executeAsRoot('systemctl enable smbd').catch(() => {});
      await executeAsRoot('systemctl start smbd').catch(() => {});
      await executeAsRoot('systemctl enable nmbd').catch(() => {});
      await executeAsRoot('systemctl start nmbd').catch(() => {});
      
      // Enable via chrome flags
      await this.enableChromeFeature('NetworkServiceInProcess', true);
      await this.enableChromeFeature('NetworkService', true);
      
      return true;
    } catch (error) {
      console.error('Failed to enable network sharing:', error);
      return false;
    }
  }

  /**
   * Enable Remote Desktop
   */
  async enableRemoteDesktop() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const remotePolicy = {
        'RemoteAccessHostAllowRemoteSupportConnections': true,
        'RemoteAccessHostAllowRemoteSupportConnectionsFromDomain': true,
        'RemoteAccessHostAllowClientPairing': true,
        'RemoteAccessHostAllowGnubbyAuth': true,
        'RemoteAccessHostAllowUsbDevices': true,
        'RemoteAccessHostAllowFileTransfer': true,
        'RemoteAccessHostAllowRemoteAccessConnections': true
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/remote_desktop_policy.json',
        JSON.stringify(remotePolicy, null, 2)
      );
      
      // Enable via chrome flags
      await this.enableChromeFeature('RemoteDesktop', true);
      await this.enableChromeFeature('RemoteDesktopNative', true);
      
      // Enable via VPD
      await executeAsRoot('vpd -s remote_desktop_enabled=1').catch(() => {});
      
      return true;
    } catch (error) {
      console.error('Failed to enable remote desktop:', error);
      return false;
    }
  }

  /**
   * Enable Screen Sharing and Recording
   */
  async enableScreenSharing() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const screenPolicy = {
        'ScreenCaptureAllowed': true,
        'ScreenCaptureAllowedByOrigins': ['*'],
        'ScreenCaptureDeniedByOrigins': [],
        'DesktopCaptureAllowed': true,
        'DesktopCaptureAllowedByOrigins': ['*']
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/screen_sharing_policy.json',
        JSON.stringify(screenPolicy, null, 2)
      );
      
      // Enable via chrome flags
      await this.enableChromeFeature('DesktopCapture', true);
      await this.enableChromeFeature('ScreenCapture', true);
      await this.enableChromeFeature('TabCapture', true);
      
      return true;
    } catch (error) {
      console.error('Failed to enable screen sharing:', error);
      return false;
    }
  }

  /**
   * Enable USB Device Management
   */
  async enableUSBDevices() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('crossystem dev_boot_usb=1');
      await executeAsRoot('crossystem dev_boot_signed_only=0');
      
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const usbPolicy = {
        'UsbDetachableAllowlist': ['*'],
        'UsbAllowlist': [],
        'UsbDenylist': [],
        'DeviceUsbDevicesAllowed': true,
        'DeviceUsbDevicesEnabled': true
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/usb_policy.json',
        JSON.stringify(usbPolicy, null, 2)
      );
      
      // Enable via chrome flags
      await this.enableChromeFeature('UsbDeviceSupport', true);
      await this.enableChromeFeature('UsbDevicePermission', true);
      
      return true;
    } catch (error) {
      console.error('Failed to enable USB devices:', error);
      return false;
    }
  }

  /**
   * Enable Bluetooth Management
   */
  async enableBluetooth() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const bluetoothPolicy = {
        'DeviceBluetoothEnabled': true,
        'DeviceBluetoothAllowed': true,
        'BluetoothAdapterEnabled': true,
        'BluetoothAllowedServices': ['*']
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/bluetooth_policy.json',
        JSON.stringify(bluetoothPolicy, null, 2)
      );
      
      // Enable via systemd
      await executeAsRoot('systemctl enable bluetooth').catch(() => {});
      await executeAsRoot('systemctl start bluetooth').catch(() => {});
      
      // Enable via chrome flags
      await this.enableChromeFeature('Bluetooth', true);
      await this.enableChromeFeature('BluetoothAdapter', true);
      
      return true;
    } catch (error) {
      console.error('Failed to enable Bluetooth:', error);
      return false;
    }
  }

  /**
   * Enable File System Access
   */
  async enableFileSystemAccess() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const filesystemPolicy = {
        'FileSystemReadAskForUrls': ['*'],
        'FileSystemWriteAskForUrls': ['*'],
        'FileSystemReadBlockedForUrls': [],
        'FileSystemWriteBlockedForUrls': [],
        'FileSystemAccessAllowed': true
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/filesystem_policy.json',
        JSON.stringify(filesystemPolicy, null, 2)
      );
      
      // Enable via chrome flags
      await this.enableChromeFeature('FileSystemAccess', true);
      await this.enableChromeFeature('NativeFileSystem', true);
      
      return true;
    } catch (error) {
      console.error('Failed to enable file system access:', error);
      return false;
    }
  }

  /**
   * Enable System Updates Control
   */
  async enableUpdateControl() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const updatePolicy = {
        'AutoUpdateEnabled': true,
        'UpdateDefault': true,
        'AllowUpdateDeferral': true,
        'UpdateAllowedConnectionTypes': ['ethernet', 'wifi', 'cellular'],
        'DeviceAutoUpdateDisabled': false,
        'ReleaseChannelDelegated': true
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/update_policy.json',
        JSON.stringify(updatePolicy, null, 2)
      );
      
      // Enable via crossystem
      await executeAsRoot('crossystem release_lts_tag=1').catch(() => {});
      
      return true;
    } catch (error) {
      console.error('Failed to enable update control:', error);
      return false;
    }
  }

  /**
   * Enable Accessibility Features
   */
  async enableAccessibility() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const accessibilityPolicy = {
        'AccessibilityEnabled': true,
        'HighContrastEnabled': true,
        'ScreenMagnifierEnabled': true,
        'SelectToSpeakEnabled': true,
        'SpokenFeedbackEnabled': true,
        'VirtualKeyboardEnabled': true,
        'StickyKeysEnabled': true,
        'LargeCursorEnabled': true
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/accessibility_policy.json',
        JSON.stringify(accessibilityPolicy, null, 2)
      );
      
      // Enable via chrome flags
      await this.enableChromeFeature('Accessibility', true);
      await this.enableChromeFeature('ScreenReader', true);
      
      return true;
    } catch (error) {
      console.error('Failed to enable accessibility:', error);
      return false;
    }
  }

  /**
   * Enable App Permissions Management
   */
  async enableAppPermissions() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const permissionsPolicy = {
        'DefaultGeolocationSetting': 1, // Allow
        'DefaultNotificationsSetting': 1,
        'DefaultCameraSetting': 1,
        'DefaultMicrophoneSetting': 1,
        'DefaultPluginsSetting': 1,
        'DefaultPopupsSetting': 1,
        'DefaultWebBluetoothGuardSetting': 1,
        'DefaultWebUsbGuardSetting': 1,
        'PermissionsAllowedForUrls': ['*'],
        'PermissionsBlockedForUrls': []
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/permissions_policy.json',
        JSON.stringify(permissionsPolicy, null, 2)
      );
      
      return true;
    } catch (error) {
      console.error('Failed to enable app permissions:', error);
      return false;
    }
  }

  /**
   * Enable Clipboard Management
   */
  async enableClipboardAccess() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const clipboardPolicy = {
        'ClipboardAllowedForUrls': ['*'],
        'ClipboardBlockedForUrls': [],
        'ClipboardReadAllowed': true,
        'ClipboardWriteAllowed': true
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/clipboard_policy.json',
        JSON.stringify(clipboardPolicy, null, 2)
      );
      
      // Enable via chrome flags
      await this.enableChromeFeature('Clipboard', true);
      await this.enableChromeFeature('ClipboardRead', true);
      await this.enableChromeFeature('ClipboardWrite', true);
      
      return true;
    } catch (error) {
      console.error('Failed to enable clipboard access:', error);
      return false;
    }
  }

  /**
   * Enable Display Settings Control
   */
  async enableDisplayControl() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const displayPolicy = {
        'DisplayResolutionAllowed': true,
        'DisplayRotationAllowed': true,
        'DisplayScalingAllowed': true,
        'ExternalDisplayAllowed': true,
        'DisplaySettingsEnabled': true
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/display_policy.json',
        JSON.stringify(displayPolicy, null, 2)
      );
      
      // Enable via chrome flags
      await this.enableChromeFeature('DisplaySettings', true);
      await this.enableChromeFeature('ExternalDisplay', true);
      
      return true;
    } catch (error) {
      console.error('Failed to enable display control:', error);
      return false;
    }
  }

  /**
   * Enable Power Management Control
   */
  async enablePowerManagement() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const powerPolicy = {
        'PowerManagementIdleSettings': {
          'AC': { 'IdleAction': 'do_nothing', 'IdleDelay': 0 },
          'Battery': { 'IdleAction': 'do_nothing', 'IdleDelay': 0 }
        },
        'PowerManagementEnabled': true,
        'PowerManagementSettingsEnabled': true
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/power_policy.json',
        JSON.stringify(powerPolicy, null, 2)
      );
      
      // Disable system sleep
      await executeAsRoot('systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target').catch(() => {});
      
      return true;
    } catch (error) {
      console.error('Failed to enable power management:', error);
      return false;
    }
  }

  /**
   * Enable Audio Settings Control
   */
  async enableAudioControl() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const audioPolicy = {
        'AudioCaptureAllowed': true,
        'AudioCaptureAllowedUrls': ['*'],
        'AudioCaptureBlockedUrls': [],
        'AudioOutputAllowed': true,
        'AudioInputAllowed': true
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/audio_policy.json',
        JSON.stringify(audioPolicy, null, 2)
      );
      
      // Enable via chrome flags
      await this.enableChromeFeature('AudioCapture', true);
      await this.enableChromeFeature('AudioOutput', true);
      
      return true;
    } catch (error) {
      console.error('Failed to enable audio control:', error);
      return false;
    }
  }

  /**
   * Enable Security Features Bypass
   */
  async enableSecurityBypass() {
    if (!this.isChromeOS) return false;

    try {
      // Disable TPM requirement
      await executeAsRoot('crossystem tpm_fwver=0').catch(() => {});
      await executeAsRoot('crossystem tpm_kernver=0').catch(() => {});
      
      // Disable secure boot
      await executeAsRoot('crossystem dev_boot_signed_only=0');
      await executeAsRoot('crossystem dev_boot_legacy=1');
      
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const securityPolicy = {
        'SafeBrowsingProtectionLevel': 0, // Disabled
        'SafeBrowsingEnabled': false,
        'PasswordManagerEnabled': false,
        'RequireOnlineRevocationChecksForLocalAnchors': false,
        'SSLVersionMin': 'tls1',
        'SSLErrorOverrideAllowed': true
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/security_policy.json',
        JSON.stringify(securityPolicy, null, 2)
      );
      
      return true;
    } catch (error) {
      console.error('Failed to enable security bypass:', error);
      return false;
    }
  }

  /**
   * Enable Root Access and Sudo
   */
  async enableRootAccess() {
    if (!this.isChromeOS) return false;

    try {
      // Enable root login
      await executeAsRoot('passwd -d root').catch(() => {});
      await executeAsRoot('echo "root:root" | chpasswd').catch(() => {});
      
      // Enable sudo without password
      await executeAsRoot('echo "%wheel ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers').catch(() => {});
      await executeAsRoot('echo "chronos ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers').catch(() => {});
      await executeAsRoot('echo "root ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers').catch(() => {});
      
      // Enable SSH root login
      await executeAsRoot('sed -i "s/#PermitRootLogin.*/PermitRootLogin yes/" /etc/ssh/sshd_config').catch(() => {});
      await executeAsRoot('sed -i "s/PermitRootLogin.*/PermitRootLogin yes/" /etc/ssh/sshd_config').catch(() => {});
      
      // Enable SSH service
      await executeAsRoot('systemctl enable sshd').catch(() => {});
      await executeAsRoot('systemctl start sshd').catch(() => {});
      
      return true;
    } catch (error) {
      console.error('Failed to enable root access:', error);
      return false;
    }
  }

  /**
   * Enable Full System Access - Most Permissive
   */
  async enableFullSystemAccess() {
    if (!this.isChromeOS) return false;

    try {
      // Remove all restrictions
      await executeAsRoot('chmod 777 /').catch(() => {});
      await executeAsRoot('chmod 777 /etc').catch(() => {});
      await executeAsRoot('chmod 777 /var').catch(() => {});
      await executeAsRoot('chmod 777 /usr').catch(() => {});
      await executeAsRoot('chmod 777 /opt').catch(() => {});
      
      // Disable SELinux if present
      await executeAsRoot('setenforce 0').catch(() => {});
      await executeAsRoot('sed -i "s/SELINUX=enforcing/SELINUX=disabled/" /etc/selinux/config').catch(() => {});
      
      // Disable AppArmor
      await executeAsRoot('systemctl stop apparmor').catch(() => {});
      await executeAsRoot('systemctl disable apparmor').catch(() => {});
      
      // Remove read-only protection
      await executeAsRoot('mount -o remount,rw /').catch(() => {});
      await executeAsRoot('mount -o remount,rw /usr').catch(() => {});
      
      return true;
    } catch (error) {
      console.error('Failed to enable full system access:', error);
      return false;
    }
  }

  /**
   * Enable Kernel Module Loading
   */
  async enableKernelModules() {
    if (!this.isChromeOS) return false;

    try {
      // Enable kernel module loading
      await executeAsRoot('modprobe -a').catch(() => {});
      await executeAsRoot('sysctl -w kernel.modules_disabled=0').catch(() => {});
      
      // Allow all kernel modules
      await executeAsRoot('echo "kernel.modules_disabled=0" >> /etc/sysctl.conf').catch(() => {});
      
      // Enable via crossystem
      await executeAsRoot('crossystem dev_boot_signed_only=0');
      await executeAsRoot('crossystem dev_boot_legacy=1');
      
      return true;
    } catch (error) {
      console.error('Failed to enable kernel modules:', error);
      return false;
    }
  }

  /**
   * Enable Firewall Bypass
   */
  async enableFirewallBypass() {
    if (!this.isChromeOS) return false;

    try {
      // Disable iptables/firewall
      await executeAsRoot('iptables -F').catch(() => {});
      await executeAsRoot('iptables -X').catch(() => {});
      await executeAsRoot('iptables -t nat -F').catch(() => {});
      await executeAsRoot('iptables -t nat -X').catch(() => {});
      await executeAsRoot('iptables -P INPUT ACCEPT').catch(() => {});
      await executeAsRoot('iptables -P FORWARD ACCEPT').catch(() => {});
      await executeAsRoot('iptables -P OUTPUT ACCEPT').catch(() => {});
      
      // Disable firewalld
      await executeAsRoot('systemctl stop firewalld').catch(() => {});
      await executeAsRoot('systemctl disable firewalld').catch(() => {});
      
      // Disable ufw
      await executeAsRoot('ufw disable').catch(() => {});
      
      return true;
    } catch (error) {
      console.error('Failed to bypass firewall:', error);
      return false;
    }
  }

  /**
   * Enable All Network Ports
   */
  async enableAllNetworkPorts() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const networkPolicy = {
        'NetworkPortsAllowed': ['*'],
        'NetworkPortsBlocked': [],
        'AllowedPorts': ['*'],
        'BlockedPorts': [],
        'NetworkAccessAllowed': true,
        'NetworkAccessBlocked': false
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/network_ports_policy.json',
        JSON.stringify(networkPolicy, null, 2)
      );
      
      // Open all ports
      await executeAsRoot('iptables -A INPUT -j ACCEPT').catch(() => {});
      await executeAsRoot('iptables -A OUTPUT -j ACCEPT').catch(() => {});
      
      return true;
    } catch (error) {
      console.error('Failed to enable all network ports:', error);
      return false;
    }
  }

  /**
   * Enable All Extensions
   */
  async enableAllExtensions() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const extensionPolicy = {
        'ExtensionInstallAllowlist': ['*'],
        'ExtensionInstallBlocklist': [],
        'ExtensionInstallForcelist': [],
        'ExtensionInstallSources': ['*'],
        'ExtensionAllowedTypes': ['*'],
        'ExtensionSettings': {},
        'ExtensionAllowed': true,
        'ExtensionInstallEnabled': true
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/extension_policy.json',
        JSON.stringify(extensionPolicy, null, 2)
      );
      
      // Enable via chrome flags
      await this.enableChromeFeature('Extensions', true);
      await this.enableChromeFeature('ExtensionInstall', true);
      
      return true;
    } catch (error) {
      console.error('Failed to enable all extensions:', error);
      return false;
    }
  }

  /**
   * Disable All Extensions - Inspired by rigtools-v2
   * Uses multiple methods to ensure extensions are completely disabled
   */
  async disableAllExtensions() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      
      // Method 1: Policy-based disable
      const extensionDisablePolicy = {
        'ExtensionInstallBlocklist': ['*'],
        'ExtensionInstallAllowlist': [],
        'ExtensionInstallForcelist': [],
        'ExtensionInstallSources': [],
        'ExtensionAllowedTypes': [],
        'ExtensionSettings': {},
        'ExtensionAllowed': false,
        'ExtensionInstallEnabled': false,
        'ExtensionInstallBlocklistAll': true,
        'ExtensionInstallWhitelist': []
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/extension_disable_policy.json',
        JSON.stringify(extensionDisablePolicy, null, 2)
      );
      
      // Method 2: Disable via chrome flags
      await this.enableChromeFlag('disable-extensions', 'enabled');
      await this.enableChromeFlag('disable-extensions-except', '');
      await this.enableChromeFeature('Extensions', false);
      await this.enableChromeFeature('ExtensionInstall', false);
      
      // Method 3: Remove extension directories (requires root)
      await executeAsRoot('rm -rf /home/*/Extensions/*').catch(() => {});
      await executeAsRoot('rm -rf /home/chronos/user/Extensions/*').catch(() => {});
      await executeAsRoot('rm -rf /var/lib/chromeos/Extensions/*').catch(() => {});
      
      // Method 4: Disable extension service
      await executeAsRoot('systemctl stop chromeos-extension-service').catch(() => {});
      await executeAsRoot('systemctl disable chromeos-extension-service').catch(() => {});
      
      // Method 5: Block extension APIs via chrome_dev.conf
      await this.enableChromeFlag('disable-extensions-file-access-check', 'enabled');
      await this.enableChromeFlag('disable-extensions-http-throttling', 'enabled');
      
      // Method 6: Clear extension registry
      await executeAsRoot('rm -rf /home/*/.config/google-chrome/Default/Extensions/*').catch(() => {});
      await executeAsRoot('rm -rf /home/chronos/user/.config/google-chrome/Default/Extensions/*').catch(() => {});
      
      // Method 7: Disable extension sync
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const syncDisablePolicy = {
        'SyncDisabled': false,
        'SyncTypesListDisabled': ['Extensions'],
        'ExtensionSyncDisabled': true
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/extension_sync_disable_policy.json',
        JSON.stringify(syncDisablePolicy, null, 2)
      );
      
      // Method 8: Block extension-related Chrome URLs (inspired by rigtools-v2)
      // This prevents extensions from loading via chrome-extension:// URLs
      await executeAsRoot('echo "extension-scheme-blocked=true" >> /etc/chrome_dev.conf').catch(() => {});
      
      return true;
    } catch (error) {
      console.error('Failed to disable extensions:', error);
      return false;
    }
  }

  /**
   * Enable All Cookies and Storage
   */
  async enableAllStorage() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const storagePolicy = {
        'CookiesAllowedForUrls': ['*'],
        'CookiesBlockedForUrls': [],
        'CookiesSessionOnlyForUrls': [],
        'DefaultCookiesSetting': 1, // Allow all
        'DefaultJavaScriptSetting': 1,
        'DefaultPluginsSetting': 1,
        'DefaultPopupsSetting': 1,
        'DefaultImagesSetting': 1,
        'LocalStorageAllowed': true,
        'LocalStorageAllowedForUrls': ['*'],
        'LocalStorageBlockedForUrls': [],
        'SessionStorageAllowed': true,
        'IndexedDBAllowed': true,
        'WebSQLAllowed': true
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/storage_policy.json',
        JSON.stringify(storagePolicy, null, 2)
      );
      
      return true;
    } catch (error) {
      console.error('Failed to enable all storage:', error);
      return false;
    }
  }

  /**
   * Enable All Web APIs
   */
  async enableAllWebAPIs() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const webAPIPolicy = {
        'WebRTCAllowed': true,
        'WebRTCIPHandlingPolicy': 'disable_non_proxied_udp',
        'WebRTCMultipleRoutesEnabled': true,
        'WebRTCNonProxiedUdpEnabled': true,
        'WebGLAllowed': true,
        'WebGPUAllowed': true,
        'WebAssemblyAllowed': true,
        'WebXRAllowed': true,
        'WebNFCAllowed': true,
        'WebUSBAllowed': true,
        'WebBluetoothAllowed': true,
        'WebSerialAllowed': true,
        'WebHIDAllowed': true,
        'WebMIDIAllowed': true,
        'WebShareAllowed': true,
        'WebLocksAllowed': true,
        'WebWorkersAllowed': true,
        'ServiceWorkersAllowed': true,
        'SharedWorkersAllowed': true
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/webapi_policy.json',
        JSON.stringify(webAPIPolicy, null, 2)
      );
      
      // Enable via chrome flags
      const webAPIFlags = [
        'WebRTC', 'WebGL', 'WebGPU', 'WebAssembly', 'WebXR', 'WebNFC',
        'WebUSB', 'WebBluetooth', 'WebSerial', 'WebHID', 'WebMIDI',
        'WebWorkers', 'ServiceWorkers', 'SharedWorkers'
      ];
      
      for (const api of webAPIFlags) {
        await this.enableChromeFeature(api, true);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to enable all Web APIs:', error);
      return false;
    }
  }

  /**
   * Enable All Experimental Features
   */
  async enableAllExperimentalFeatures() {
    if (!this.isChromeOS) return false;

    try {
      const experimentalFeatures = [
        'ExperimentalProductivityFeatures',
        'ExperimentalSecurityFeatures',
        'ExperimentalWebPlatformFeatures',
        'ExperimentalWebAssemblyFeatures',
        'ExperimentalJavaScriptFeatures',
        'ExperimentalCSSFeatures',
        'ExperimentalHTMLFeatures',
        'ExperimentalMediaFeatures',
        'ExperimentalNetworkFeatures',
        'ExperimentalStorageFeatures',
        'ExperimentalGraphicsFeatures',
        'ExperimentalInputFeatures',
        'ExperimentalPerformanceFeatures',
        'ExperimentalAccessibilityFeatures',
        'ExperimentalDeveloperFeatures',
        'ExperimentalUserFeatures',
        'ExperimentalSystemFeatures'
      ];
      
      for (const feature of experimentalFeatures) {
        await this.enableChromeFeature(feature, true);
      }
      
      // Enable all experimental flags
      await this.enableChromeFlag('enable-experimental-web-platform-features', 'enabled');
      await this.enableChromeFlag('enable-experimental-productivity-features', 'enabled');
      await this.enableChromeFlag('enable-experimental-security-features', 'enabled');
      
      return true;
    } catch (error) {
      console.error('Failed to enable experimental features:', error);
      return false;
    }
  }

  /**
   * Enable All Enterprise Bypasses
   */
  async enableAllEnterpriseBypasses() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const enterprisePolicy = {
        'EnterpriseEnabled': false,
        'EnterpriseEnrollmentEnabled': false,
        'EnterpriseDeviceManagementEnabled': false,
        'EnterpriseUserManagementEnabled': false,
        'EnterprisePolicyEnabled': false,
        'EnterpriseReportingEnabled': false,
        'EnterpriseMonitoringEnabled': false,
        'EnterpriseRestrictionsEnabled': false,
        'EnterpriseContentFilteringEnabled': false,
        'EnterpriseNetworkRestrictionsEnabled': false,
        'EnterpriseApplicationRestrictionsEnabled': false,
        'EnterpriseExtensionRestrictionsEnabled': false,
        'EnterpriseUserRestrictionsEnabled': false,
        'EnterpriseDeviceRestrictionsEnabled': false
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/enterprise_bypass_policy.json',
        JSON.stringify(enterprisePolicy, null, 2)
      );
      
      // Remove all enterprise policies
      await executeAsRoot('rm -rf /var/lib/whitelist/*').catch(() => {});
      await executeAsRoot('rm -rf /var/lib/enterprise/*').catch(() => {});
      await executeAsRoot('rm -rf /etc/opt/chrome/policies/recommended/*').catch(() => {});
      
      return true;
    } catch (error) {
      console.error('Failed to bypass enterprise restrictions:', error);
      return false;
    }
  }

  /**
   * Enable All Content Filters Bypass
   */
  async enableContentFilterBypass() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const contentPolicy = {
        'SafeBrowsingProtectionLevel': 0,
        'SafeBrowsingEnabled': false,
        'SafeBrowsingForTrustedSourcesEnabled': false,
        'SafeBrowsingAllowlistDomains': ['*'],
        'URLBlocklist': [],
        'URLAllowlist': ['*'],
        'ContentPackFilteringEnabled': false,
        'ContentPackManualFilteringEnabled': false,
        'ContentPackDefaultFilteringEnabled': false,
        'ContentPackFilteringBypassList': ['*'],
        'ContentPackFilteringEnabledForDomains': [],
        'ContentPackFilteringDisabledForDomains': ['*']
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/content_filter_policy.json',
        JSON.stringify(contentPolicy, null, 2)
      );
      
      return true;
    } catch (error) {
      console.error('Failed to bypass content filters:', error);
      return false;
    }
  }

  /**
   * Enable All Parental Controls Bypass
   */
  async enableParentalControlsBypass() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const parentalPolicy = {
        'SupervisedUserContentProviderEnabled': false,
        'SupervisedUserSettingsEnabled': false,
        'SupervisedUserAllowed': false,
        'SupervisedUserRestrictionsEnabled': false,
        'SupervisedUserTimeLimitEnabled': false,
        'SupervisedUserWebsiteFilteringEnabled': false,
        'SupervisedUserContentFilteringEnabled': false,
        'SupervisedUserExtensionInstallEnabled': true,
        'SupervisedUserExtensionInstallBlocklist': []
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/parental_controls_policy.json',
        JSON.stringify(parentalPolicy, null, 2)
      );
      
      // Remove supervised user restrictions
      await executeAsRoot('rm -rf /var/lib/supervised/*').catch(() => {});
      
      return true;
    } catch (error) {
      console.error('Failed to bypass parental controls:', error);
      return false;
    }
  }

  /**
   * Enable All Privacy Bypasses
   */
  async enablePrivacyBypass() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const privacyPolicy = {
        'PrivacySandboxEnabled': false,
        'PrivacySandboxAdMeasurementEnabled': false,
        'PrivacySandboxSiteEnabledAdsEnabled': false,
        'PrivacySandboxPromptEnabled': false,
        'DoNotTrackEnabled': false,
        'TrackingProtectionEnabled': false,
        'ThirdPartyCookiesBlocked': false,
        'ThirdPartyCookiesAllowed': true,
        'FirstPartySetsEnabled': false,
        'FingerprintingProtectionEnabled': false,
        'IPProtectionEnabled': false,
        'UserAgentReductionEnabled': false,
        'UserAgentClientHintsEnabled': false
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/privacy_bypass_policy.json',
        JSON.stringify(privacyPolicy, null, 2)
      );
      
      return true;
    } catch (error) {
      console.error('Failed to bypass privacy restrictions:', error);
      return false;
    }
  }

  /**
   * Enable All Developer Tools
   */
  async enableAllDeveloperTools() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const devToolsPolicy = {
        'DeveloperToolsAvailability': 1, // Available for all
        'DeveloperToolsDisabled': false,
        'DeveloperToolsAllowed': true,
        'DeveloperToolsAvailabilityForOrigins': ['*'],
        'DeveloperToolsAvailabilityBlockedForOrigins': []
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/devtools_policy.json',
        JSON.stringify(devToolsPolicy, null, 2)
      );
      
      // Enable via chrome flags
      await this.enableChromeFeature('DevTools', true);
      await this.enableChromeFeature('DeveloperTools', true);
      
      return true;
    } catch (error) {
      console.error('Failed to enable developer tools:', error);
      return false;
    }
  }

  /**
   * Enable All Debugging Features
   */
  async enableAllDebugging() {
    if (!this.isChromeOS) return false;

    try {
      // Enable all debugging flags
      const debugFlags = [
        '--enable-logging',
        '--enable-logging=stderr',
        '--v=1',
        '--vmodule=*=2',
        '--enable-crash-reporter',
        '--enable-crash-reporter-for-testing',
        '--crash-dumps-dir=/tmp',
        '--enable-stack-profiler',
        '--enable-heap-profiler',
        '--enable-memory-info',
        '--enable-precise-memory-info',
        '--js-flags=--expose-gc --allow-natives-syntax',
        '--enable-pinch',
        '--enable-touch-events',
        '--enable-viewport',
        '--enable-experimental-canvas-features',
        '--enable-experimental-web-platform-features',
        '--enable-blink-features=ExperimentalProductivityFeatures',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-ipc-flooding-protection'
      ];
      
      let chromeDevConf = '';
      if (fs.existsSync('/etc/chrome_dev.conf')) {
        chromeDevConf = fs.readFileSync('/etc/chrome_dev.conf', 'utf8');
      }
      
      for (const flag of debugFlags) {
        if (!chromeDevConf.includes(flag)) {
          chromeDevConf += `${flag}\n`;
        }
      }
      
      await executeAsRoot(`cat > /etc/chrome_dev.conf << 'EOF'\n${chromeDevConf}EOF`);
      
      return true;
    } catch (error) {
      console.error('Failed to enable debugging:', error);
      return false;
    }
  }

  /**
   * Enable Hardware Acceleration
   */
  async enableHardwareAcceleration() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const hwPolicy = {
        'HardwareAccelerationModeEnabled': true,
        'GPUAccelerationEnabled': true,
        'VideoAccelerationEnabled': true,
        'WebGLAccelerationEnabled': true,
        'CanvasAccelerationEnabled': true,
        'MediaAccelerationEnabled': true
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/hardware_acceleration_policy.json',
        JSON.stringify(hwPolicy, null, 2)
      );
      
      // Enable via chrome flags
      await this.enableChromeFlag('enable-gpu', 'enabled');
      await this.enableChromeFlag('enable-gpu-rasterization', 'enabled');
      await this.enableChromeFlag('enable-accelerated-video-decode', 'enabled');
      await this.enableChromeFlag('enable-accelerated-video-encode', 'enabled');
      await this.enableChromeFlag('enable-accelerated-2d-canvas', 'enabled');
      await this.enableChromeFlag('enable-accelerated-mjpeg-decode', 'enabled');
      
      return true;
    } catch (error) {
      console.error('Failed to enable hardware acceleration:', error);
      return false;
    }
  }

  /**
   * Enable All Input Methods
   */
  async enableAllInputMethods() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const inputPolicy = {
        'InputMethodAllowed': ['*'],
        'InputMethodBlocked': [],
        'VirtualKeyboardEnabled': true,
        'HandwritingEnabled': true,
        'VoiceInputEnabled': true,
        'GestureInputEnabled': true,
        'TouchInputEnabled': true,
        'StylusInputEnabled': true
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/input_methods_policy.json',
        JSON.stringify(inputPolicy, null, 2)
      );
      
      return true;
    } catch (error) {
      console.error('Failed to enable input methods:', error);
      return false;
    }
  }

  /**
   * Enable All Printing Features
   */
  async enableAllPrinting() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const printPolicy = {
        'PrintingEnabled': true,
        'PrintPreviewDisabled': false,
        'PrintHeaderFooter': true,
        'PrintBackgroundGraphics': true,
        'PrintPdfAsImage': false,
        'PrintingAllowedBackgroundGraphicsModes': ['*'],
        'PrintingAllowedColorModes': ['*'],
        'PrintingAllowedDuplexModes': ['*'],
        'PrintingAllowedMediaSizes': ['*'],
        'PrintingAllowedPageRanges': ['*']
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/printing_policy.json',
        JSON.stringify(printPolicy, null, 2)
      );
      
      // Enable CUPS printing
      await executeAsRoot('systemctl enable cups').catch(() => {});
      await executeAsRoot('systemctl start cups').catch(() => {});
      
      return true;
    } catch (error) {
      console.error('Failed to enable printing:', error);
      return false;
    }
  }

  /**
   * Enable All Camera Features
   */
  async enableAllCameraFeatures() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const cameraPolicy = {
        'CameraAllowed': true,
        'CameraAllowedForUrls': ['*'],
        'CameraBlockedForUrls': [],
        'VideoCaptureAllowed': true,
        'VideoCaptureAllowedForUrls': ['*'],
        'VideoCaptureBlockedForUrls': []
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/camera_policy.json',
        JSON.stringify(cameraPolicy, null, 2)
      );
      
      // Enable via chrome flags
      await this.enableChromeFeature('Camera', true);
      await this.enableChromeFeature('VideoCapture', true);
      
      return true;
    } catch (error) {
      console.error('Failed to enable camera features:', error);
      return false;
    }
  }

  /**
   * Enable All Location Services
   */
  async enableAllLocationServices() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const locationPolicy = {
        'DefaultGeolocationSetting': 1, // Allow
        'GeolocationAllowedForUrls': ['*'],
        'GeolocationBlockedForUrls': [],
        'GeolocationAllowed': true
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/location_policy.json',
        JSON.stringify(locationPolicy, null, 2)
      );
      
      // Enable location services
      await executeAsRoot('systemctl enable geoclue').catch(() => {});
      await executeAsRoot('systemctl start geoclue').catch(() => {});
      
      return true;
    } catch (error) {
      console.error('Failed to enable location services:', error);
      return false;
    }
  }

  /**
   * Enable All Notifications
   */
  async enableAllNotifications() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const notificationPolicy = {
        'DefaultNotificationsSetting': 1, // Allow
        'NotificationsAllowedForUrls': ['*'],
        'NotificationsBlockedForUrls': [],
        'NotificationsAllowed': true,
        'SystemNotificationsEnabled': true,
        'DesktopNotificationsEnabled': true
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/notifications_policy.json',
        JSON.stringify(notificationPolicy, null, 2)
      );
      
      return true;
    } catch (error) {
      console.error('Failed to enable notifications:', error);
      return false;
    }
  }

  /**
   * Enable All Sensors
   */
  async enableAllSensors() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const sensorPolicy = {
        'SensorsAllowed': true,
        'SensorsAllowedForUrls': ['*'],
        'SensorsBlockedForUrls': [],
        'AccelerometerAllowed': true,
        'GyroscopeAllowed': true,
        'MagnetometerAllowed': true,
        'AmbientLightSensorAllowed': true,
        'ProximitySensorAllowed': true,
        'OrientationSensorAllowed': true
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/sensors_policy.json',
        JSON.stringify(sensorPolicy, null, 2)
      );
      
      // Enable via chrome flags
      await this.enableChromeFeature('GenericSensor', true);
      await this.enableChromeFeature('Accelerometer', true);
      await this.enableChromeFeature('Gyroscope', true);
      
      return true;
    } catch (error) {
      console.error('Failed to enable sensors:', error);
      return false;
    }
  }

  /**
   * Enable All Payment APIs
   */
  async enableAllPaymentAPIs() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const paymentPolicy = {
        'PaymentRequestEnabled': true,
        'PaymentRequestAllowedForUrls': ['*'],
        'PaymentRequestBlockedForUrls': [],
        'PaymentHandlerEnabled': true,
        'PaymentMethodEnabled': true
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/payment_policy.json',
        JSON.stringify(paymentPolicy, null, 2)
      );
      
      // Enable via chrome flags
      await this.enableChromeFeature('PaymentRequest', true);
      await this.enableChromeFeature('PaymentHandler', true);
      
      return true;
    } catch (error) {
      console.error('Failed to enable payment APIs:', error);
      return false;
    }
  }

  /**
   * Enable All Font Access
   */
  async enableAllFontAccess() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const fontPolicy = {
        'FontAccessEnabled': true,
        'FontAccessAllowedForUrls': ['*'],
        'FontAccessBlockedForUrls': []
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/font_access_policy.json',
        JSON.stringify(fontPolicy, null, 2)
      );
      
      // Enable via chrome flags
      await this.enableChromeFeature('FontAccess', true);
      
      return true;
    } catch (error) {
      console.error('Failed to enable font access:', error);
      return false;
    }
  }

  /**
   * Enable All File System APIs
   */
  async enableAllFileSystemAPIs() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const fsAPIPolicy = {
        'FileSystemAccessEnabled': true,
        'FileSystemAccessAllowedForUrls': ['*'],
        'FileSystemAccessBlockedForUrls': [],
        'NativeFileSystemEnabled': true,
        'OriginTrialsEnabled': true
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/filesystem_api_policy.json',
        JSON.stringify(fsAPIPolicy, null, 2)
      );
      
      // Enable via chrome flags
      await this.enableChromeFeature('NativeFileSystem', true);
      await this.enableChromeFeature('FileSystemAccess', true);
      await this.enableChromeFeature('OriginTrials', true);
      
      return true;
    } catch (error) {
      console.error('Failed to enable file system APIs:', error);
      return false;
    }
  }

  /**
   * Enable All Background Sync
   */
  async enableAllBackgroundSync() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const syncPolicy = {
        'BackgroundSyncEnabled': true,
        'BackgroundSyncAllowedForUrls': ['*'],
        'BackgroundSyncBlockedForUrls': [],
        'PeriodicBackgroundSyncEnabled': true
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/background_sync_policy.json',
        JSON.stringify(syncPolicy, null, 2)
      );
      
      // Enable via chrome flags
      await this.enableChromeFeature('BackgroundSync', true);
      await this.enableChromeFeature('PeriodicBackgroundSync', true);
      
      return true;
    } catch (error) {
      console.error('Failed to enable background sync:', error);
      return false;
    }
  }

  /**
   * Enable All Push Notifications
   */
  async enableAllPushNotifications() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const pushPolicy = {
        'PushMessagingEnabled': true,
        'PushMessagingAllowedForUrls': ['*'],
        'PushMessagingBlockedForUrls': [],
        'PushSubscriptionEnabled': true
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/push_notifications_policy.json',
        JSON.stringify(pushPolicy, null, 2)
      );
      
      // Enable via chrome flags
      await this.enableChromeFeature('PushMessaging', true);
      await this.enableChromeFeature('PushSubscription', true);
      
      return true;
    } catch (error) {
      console.error('Failed to enable push notifications:', error);
      return false;
    }
  }

  /**
   * Enable All Media Features
   */
  async enableAllMediaFeatures() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const mediaPolicy = {
        'MediaStreamAllowed': true,
        'MediaStreamAllowedForUrls': ['*'],
        'MediaStreamBlockedForUrls': [],
        'MediaPlaybackAllowed': true,
        'MediaPlaybackAllowedForUrls': ['*'],
        'MediaPlaybackBlockedForUrls': [],
        'MediaAutoplayAllowed': true,
        'MediaAutoplayAllowedForUrls': ['*'],
        'MediaAutoplayBlockedForUrls': []
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/media_features_policy.json',
        JSON.stringify(mediaPolicy, null, 2)
      );
      
      // Enable via chrome flags
      await this.enableChromeFeature('MediaStream', true);
      await this.enableChromeFeature('MediaPlayback', true);
      await this.enableChromeFeature('MediaAutoplay', true);
      
      return true;
    } catch (error) {
      console.error('Failed to enable media features:', error);
      return false;
    }
  }

  /**
   * Enable All Clipboard Features
   */
  async enableAllClipboardFeatures() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const clipboardPolicy = {
        'ClipboardAllowedForUrls': ['*'],
        'ClipboardBlockedForUrls': [],
        'ClipboardReadAllowed': true,
        'ClipboardWriteAllowed': true,
        'ClipboardSanitizeWriteDisabled': true
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/clipboard_features_policy.json',
        JSON.stringify(clipboardPolicy, null, 2)
      );
      
      return true;
    } catch (error) {
      console.error('Failed to enable clipboard features:', error);
      return false;
    }
  }

  /**
   * Enable All Download Features
   */
  async enableAllDownloadFeatures() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const downloadPolicy = {
        'DownloadRestrictions': 0, // Allow all
        'DownloadDirectory': '',
        'DownloadAllowed': true,
        'DownloadBlocked': false,
        'DownloadRestrictionsEnabled': false
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/download_features_policy.json',
        JSON.stringify(downloadPolicy, null, 2)
      );
      
      return true;
    } catch (error) {
      console.error('Failed to enable download features:', error);
      return false;
    }
  }

  /**
   * Enable All Autofill Features
   */
  async enableAllAutofillFeatures() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const autofillPolicy = {
        'AutofillEnabled': true,
        'AutofillAddressEnabled': true,
        'AutofillCreditCardEnabled': true,
        'PasswordManagerEnabled': true,
        'PasswordLeakDetectionEnabled': false,
        'AutofillAllowedForUrls': ['*'],
        'AutofillBlockedForUrls': []
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/autofill_features_policy.json',
        JSON.stringify(autofillPolicy, null, 2)
      );
      
      return true;
    } catch (error) {
      console.error('Failed to enable autofill features:', error);
      return false;
    }
  }

  /**
   * Enable All Sync Features
   */
  async enableAllSyncFeatures() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const syncPolicy = {
        'SyncDisabled': false,
        'SyncTypesListDisabled': [],
        'SyncTypesListEnabled': ['*'],
        'BrowserSignin': 1, // Allow
        'ForceGoogleSafeSearch': false,
        'ForceYouTubeRestrict': 0,
        'ForceYouTubeSafetyMode': false
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/sync_features_policy.json',
        JSON.stringify(syncPolicy, null, 2)
      );
      
      return true;
    } catch (error) {
      console.error('Failed to enable sync features:', error);
      return false;
    }
  }

  /**
   * Enable All Search Features
   */
  async enableAllSearchFeatures() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const searchPolicy = {
        'DefaultSearchProviderEnabled': true,
        'DefaultSearchProviderSearchURL': '',
        'DefaultSearchProviderSuggestURL': '',
        'SearchSuggestEnabled': true,
        'SearchSuggestEnabledForUrls': ['*'],
        'SearchSuggestBlockedForUrls': []
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/search_features_policy.json',
        JSON.stringify(searchPolicy, null, 2)
      );
      
      return true;
    } catch (error) {
      console.error('Failed to enable search features:', error);
      return false;
    }
  }

  /**
   * Enable All Translation Features
   */
  async enableAllTranslationFeatures() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const translationPolicy = {
        'TranslateEnabled': true,
        'TranslateAllowed': true,
        'TranslateBlockedLanguages': [],
        'TranslateAllowedLanguages': ['*']
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/translation_features_policy.json',
        JSON.stringify(translationPolicy, null, 2)
      );
      
      return true;
    } catch (error) {
      console.error('Failed to enable translation features:', error);
      return false;
    }
  }

  /**
   * Enable All Spell Check Features
   */
  async enableAllSpellCheckFeatures() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const spellCheckPolicy = {
        'SpellCheckEnabled': true,
        'SpellCheckLanguage': [],
        'SpellCheckServiceEnabled': true
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/spellcheck_features_policy.json',
        JSON.stringify(spellCheckPolicy, null, 2)
      );
      
      return true;
    } catch (error) {
      console.error('Failed to enable spell check features:', error);
      return false;
    }
  }

  /**
   * Enable All History Features
   */
  async enableAllHistoryFeatures() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const historyPolicy = {
        'SavingBrowserHistoryDisabled': false,
        'AllowDeletingBrowserHistory': true,
        'ClearBrowsingDataOnExit': false,
        'ClearBrowsingDataOnExitList': []
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/history_features_policy.json',
        JSON.stringify(historyPolicy, null, 2)
      );
      
      return true;
    } catch (error) {
      console.error('Failed to enable history features:', error);
      return false;
    }
  }

  /**
   * Enable All Bookmark Features
   */
  async enableAllBookmarkFeatures() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const bookmarkPolicy = {
        'EditBookmarksEnabled': true,
        'BookmarkBarEnabled': true,
        'ShowBookmarkBar': true
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/bookmark_features_policy.json',
        JSON.stringify(bookmarkPolicy, null, 2)
      );
      
      return true;
    } catch (error) {
      console.error('Failed to enable bookmark features:', error);
      return false;
    }
  }

  /**
   * Enable All Tab Features
   */
  async enableAllTabFeatures() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const tabPolicy = {
        'TabFreezingEnabled': false,
        'TabDiscardingEnabled': false,
        'TabHoverCardsEnabled': true,
        'TabGroupsEnabled': true,
        'TabGroupsAutoCreateEnabled': true
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/tab_features_policy.json',
        JSON.stringify(tabPolicy, null, 2)
      );
      
      return true;
    } catch (error) {
      console.error('Failed to enable tab features:', error);
      return false;
    }
  }

  /**
   * Enable All Window Features
   */
  async enableAllWindowFeatures() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const windowPolicy = {
        'WindowPlacementEnabled': true,
        'WindowPlacementAllowedForUrls': ['*'],
        'WindowPlacementBlockedForUrls': [],
        'FullscreenAllowed': true,
        'FullscreenAllowedForUrls': ['*'],
        'FullscreenBlockedForUrls': []
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/window_features_policy.json',
        JSON.stringify(windowPolicy, null, 2)
      );
      
      // Enable via chrome flags
      await this.enableChromeFeature('WindowPlacement', true);
      await this.enableChromeFeature('Fullscreen', true);
      
      return true;
    } catch (error) {
      console.error('Failed to enable window features:', error);
      return false;
    }
  }

  /**
   * Enable All Pointer Lock Features
   */
  async enableAllPointerLockFeatures() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const pointerLockPolicy = {
        'PointerLockAllowed': true,
        'PointerLockAllowedForUrls': ['*'],
        'PointerLockBlockedForUrls': []
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/pointer_lock_features_policy.json',
        JSON.stringify(pointerLockPolicy, null, 2)
      );
      
      // Enable via chrome flags
      await this.enableChromeFeature('PointerLock', true);
      
      return true;
    } catch (error) {
      console.error('Failed to enable pointer lock features:', error);
      return false;
    }
  }

  /**
   * Enable All Gamepad Features
   */
  async enableAllGamepadFeatures() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const gamepadPolicy = {
        'GamepadEnabled': true,
        'GamepadAllowedForUrls': ['*'],
        'GamepadBlockedForUrls': []
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/gamepad_features_policy.json',
        JSON.stringify(gamepadPolicy, null, 2)
      );
      
      // Enable via chrome flags
      await this.enableChromeFeature('Gamepad', true);
      
      return true;
    } catch (error) {
      console.error('Failed to enable gamepad features:', error);
      return false;
    }
  }

  /**
   * Enable All Battery API Features
   */
  async enableAllBatteryAPIFeatures() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const batteryPolicy = {
        'BatteryAPIEnabled': true,
        'BatteryAPIAllowedForUrls': ['*'],
        'BatteryAPIBlockedForUrls': []
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/battery_api_features_policy.json',
        JSON.stringify(batteryPolicy, null, 2)
      );
      
      // Enable via chrome flags
      await this.enableChromeFeature('BatteryAPI', true);
      
      return true;
    } catch (error) {
      console.error('Failed to enable battery API features:', error);
      return false;
    }
  }

  /**
   * Enable All Wake Lock Features
   */
  async enableAllWakeLockFeatures() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const wakeLockPolicy = {
        'WakeLockEnabled': true,
        'WakeLockAllowedForUrls': ['*'],
        'WakeLockBlockedForUrls': []
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/wake_lock_features_policy.json',
        JSON.stringify(wakeLockPolicy, null, 2)
      );
      
      // Enable via chrome flags
      await this.enableChromeFeature('WakeLock', true);
      await this.enableChromeFeature('ScreenWakeLock', true);
      
      return true;
    } catch (error) {
      console.error('Failed to enable wake lock features:', error);
      return false;
    }
  }

  /**
   * Enable All Presentation API Features
   */
  async enableAllPresentationAPIFeatures() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const presentationPolicy = {
        'PresentationAPIEnabled': true,
        'PresentationAPIAllowedForUrls': ['*'],
        'PresentationAPIBlockedForUrls': []
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/presentation_api_features_policy.json',
        JSON.stringify(presentationPolicy, null, 2)
      );
      
      // Enable via chrome flags
      await this.enableChromeFeature('PresentationAPI', true);
      
      return true;
    } catch (error) {
      console.error('Failed to enable presentation API features:', error);
      return false;
    }
  }

  /**
   * Enable All Credential Management Features
   */
  async enableAllCredentialManagementFeatures() {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      const credentialPolicy = {
        'CredentialManagementAPIEnabled': true,
        'CredentialManagementAPIAllowedForUrls': ['*'],
        'CredentialManagementAPIBlockedForUrls': [],
        'WebAuthnEnabled': true,
        'WebAuthnAllowedForUrls': ['*'],
        'WebAuthnBlockedForUrls': []
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/credential_management_features_policy.json',
        JSON.stringify(credentialPolicy, null, 2)
      );
      
      // Enable via chrome flags
      await this.enableChromeFeature('CredentialManagement', true);
      await this.enableChromeFeature('WebAuthn', true);
      
      return true;
    } catch (error) {
      console.error('Failed to enable credential management features:', error);
      return false;
    }
  }

  /**
   * Enable Website Allowlist - Overrides all extensions and policy blocks
   */
  async enableWebsiteAllowlist(urls = ['*']) {
    if (!this.isChromeOS) return false;

    try {
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/managed');
      
      // Create comprehensive allowlist policy that overrides everything
      const allowlistPolicy = {
        // URL allowlist - highest priority
        'URLAllowlist': urls,
        'URLBlocklist': [],
        
        // Override extension blocks
        'ExtensionInstallBlocklist': [],
        'ExtensionInstallAllowlist': ['*'],
        'ExtensionAllowedTypes': ['*'],
        'ExtensionInstallSources': ['*'],
        
        // Override content filtering
        'SafeBrowsingProtectionLevel': 0,
        'SafeBrowsingEnabled': false,
        'ContentPackFilteringEnabled': false,
        'ContentPackFilteringBypassList': urls,
        'ContentPackFilteringDisabledForDomains': urls,
        
        // Override network restrictions
        'NetworkPortsAllowed': ['*'],
        'NetworkPortsBlocked': [],
        'NetworkAccessAllowed': true,
        'NetworkAccessBlocked': false,
        
        // Override all permission blocks
        'DefaultGeolocationSetting': 1,
        'GeolocationAllowedForUrls': urls,
        'GeolocationBlockedForUrls': [],
        
        'DefaultNotificationsSetting': 1,
        'NotificationsAllowedForUrls': urls,
        'NotificationsBlockedForUrls': [],
        
        'CameraAllowedForUrls': urls,
        'CameraBlockedForUrls': [],
        'VideoCaptureAllowedForUrls': urls,
        'VideoCaptureBlockedForUrls': [],
        
        'MicrophoneAllowedForUrls': urls,
        'MicrophoneBlockedForUrls': [],
        
        // Override storage restrictions
        'CookiesAllowedForUrls': urls,
        'CookiesBlockedForUrls': [],
        'CookiesSessionOnlyForUrls': [],
        'DefaultCookiesSetting': 1,
        'LocalStorageAllowedForUrls': urls,
        'LocalStorageBlockedForUrls': [],
        'IndexedDBAllowedForUrls': urls,
        'IndexedDBBlockedForUrls': [],
        
        // Override Web API blocks
        'WebRTCAllowedForUrls': urls,
        'WebRTCBlockedForUrls': [],
        'WebUSBAllowedForUrls': urls,
        'WebUSBBlockedForUrls': [],
        'WebBluetoothAllowedForUrls': urls,
        'WebBluetoothBlockedForUrls': [],
        'WebSerialAllowedForUrls': urls,
        'WebSerialBlockedForUrls': [],
        'WebHIDAllowedForUrls': urls,
        'WebHIDBlockedForUrls': [],
        'WebMIDIAllowedForUrls': urls,
        'WebMIDIBlockedForUrls': [],
        'WebNFCAllowedForUrls': urls,
        'WebNFCBlockedForUrls': [],
        'WebGLAllowedForUrls': urls,
        'WebGLBlockedForUrls': [],
        'WebGPUAllowedForUrls': urls,
        'WebGPUBlockedForUrls': [],
        
        // Override clipboard restrictions
        'ClipboardAllowedForUrls': urls,
        'ClipboardBlockedForUrls': [],
        'ClipboardReadAllowed': true,
        'ClipboardWriteAllowed': true,
        'ClipboardSanitizeWriteDisabled': true,
        
        // Override download restrictions
        'DownloadRestrictions': 0,
        'DownloadAllowedForUrls': urls,
        'DownloadBlockedForUrls': [],
        
        // Override JavaScript restrictions
        'DefaultJavaScriptSetting': 1,
        'JavaScriptAllowedForUrls': urls,
        'JavaScriptBlockedForUrls': [],
        
        // Override popup restrictions
        'DefaultPopupsSetting': 1,
        'PopupsAllowedForUrls': urls,
        'PopupsBlockedForUrls': [],
        
        // Override image restrictions
        'DefaultImagesSetting': 1,
        'ImagesAllowedForUrls': urls,
        'ImagesBlockedForUrls': [],
        
        // Override plugin restrictions
        'DefaultPluginsSetting': 1,
        'PluginsAllowedForUrls': urls,
        'PluginsBlockedForUrls': [],
        
        // Override autofill restrictions
        'AutofillAllowedForUrls': urls,
        'AutofillBlockedForUrls': [],
        
        // Override payment restrictions
        'PaymentRequestAllowedForUrls': urls,
        'PaymentRequestBlockedForUrls': [],
        
        // Override file system restrictions
        'FileSystemAccessAllowedForUrls': urls,
        'FileSystemAccessBlockedForUrls': [],
        
        // Override background sync restrictions
        'BackgroundSyncAllowedForUrls': urls,
        'BackgroundSyncBlockedForUrls': [],
        
        // Override push notification restrictions
        'PushMessagingAllowedForUrls': urls,
        'PushMessagingBlockedForUrls': [],
        
        // Override media restrictions
        'MediaStreamAllowedForUrls': urls,
        'MediaStreamBlockedForUrls': [],
        'MediaPlaybackAllowedForUrls': urls,
        'MediaPlaybackBlockedForUrls': [],
        'MediaAutoplayAllowedForUrls': urls,
        'MediaAutoplayBlockedForUrls': [],
        
        // Override sensor restrictions
        'SensorsAllowedForUrls': urls,
        'SensorsBlockedForUrls': [],
        
        // Override font access restrictions
        'FontAccessAllowedForUrls': urls,
        'FontAccessBlockedForUrls': [],
        
        // Override developer tools restrictions
        'DeveloperToolsAvailabilityForOrigins': urls,
        'DeveloperToolsAvailabilityBlockedForOrigins': [],
        
        // Override window placement restrictions
        'WindowPlacementAllowedForUrls': urls,
        'WindowPlacementBlockedForUrls': [],
        'FullscreenAllowedForUrls': urls,
        'FullscreenBlockedForUrls': [],
        
        // Override pointer lock restrictions
        'PointerLockAllowedForUrls': urls,
        'PointerLockBlockedForUrls': [],
        
        // Override gamepad restrictions
        'GamepadAllowedForUrls': urls,
        'GamepadBlockedForUrls': [],
        
        // Override battery API restrictions
        'BatteryAPIAllowedForUrls': urls,
        'BatteryAPIBlockedForUrls': [],
        
        // Override wake lock restrictions
        'WakeLockAllowedForUrls': urls,
        'WakeLockBlockedForUrls': [],
        
        // Override presentation API restrictions
        'PresentationAPIAllowedForUrls': urls,
        'PresentationAPIBlockedForUrls': [],
        
        // Override credential management restrictions
        'CredentialManagementAPIAllowedForUrls': urls,
        'CredentialManagementAPIBlockedForUrls': [],
        'WebAuthnAllowedForUrls': urls,
        'WebAuthnBlockedForUrls': [],
        
        // Force override all extension policies
        'ExtensionSettings': {},
        'ExtensionInstallForcelist': [],
        'ExtensionInstallBlocklist': [],
        
        // Override enterprise restrictions
        'EnterpriseRestrictionsEnabled': false,
        'EnterpriseContentFilteringEnabled': false,
        'EnterpriseNetworkRestrictionsEnabled': false,
        'EnterpriseApplicationRestrictionsEnabled': false,
        'EnterpriseExtensionRestrictionsEnabled': false,
        
        // Override parental controls
        'SupervisedUserWebsiteFilteringEnabled': false,
        'SupervisedUserContentFilteringEnabled': false,
        'SupervisedUserExtensionInstallBlocklist': []
      };
      
      fs.writeFileSync(
        '/etc/opt/chrome/policies/managed/website_allowlist_policy.json',
        JSON.stringify(allowlistPolicy, null, 2)
      );
      
      // Also create a higher-priority policy file that overrides everything
      await executeAsRoot('mkdir -p /etc/opt/chrome/policies/recommended');
      fs.writeFileSync(
        '/etc/opt/chrome/policies/recommended/website_allowlist_override.json',
        JSON.stringify(allowlistPolicy, null, 2)
      );
      
      // Add to chrome_dev.conf to force allow
      await this.enableChromeFlag('disable-web-security', 'enabled');
      await this.enableChromeFlag('disable-features', 'VizDisplayCompositor');
      await this.enableChromeFlag('user-data-dir', '/tmp/clay-allowlist');
      
      // Override extension policy enforcement
      await executeAsRoot('echo "extension-policy-override=true" >> /etc/chrome_dev.conf').catch(() => {});
      
      return true;
    } catch (error) {
      console.error('Failed to enable website allowlist:', error);
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
      await this.enableNetworkSharing();
      await this.enableRemoteDesktop();
      await this.enableScreenSharing();
      await this.enableUSBDevices();
      await this.enableBluetooth();
      await this.enableFileSystemAccess();
      await this.enableUpdateControl();
      await this.enableAccessibility();
      await this.enableAppPermissions();
      await this.enableClipboardAccess();
      await this.enableDisplayControl();
      await this.enablePowerManagement();
      await this.enableAudioControl();
      await this.enableSecurityBypass();
      await this.enableRootAccess();
      await this.enableFullSystemAccess();
      await this.enableKernelModules();
      await this.enableFirewallBypass();
      await this.enableAllNetworkPorts();
      await this.enableAllExtensions();
      await this.enableAllStorage();
      await this.enableAllWebAPIs();
      await this.enableAllExperimentalFeatures();
      await this.enableAllEnterpriseBypasses();
      await this.enableContentFilterBypass();
      await this.enableParentalControlsBypass();
      await this.enablePrivacyBypass();
      await this.enableAllDeveloperTools();
      await this.enableAllDebugging();
      await this.enableHardwareAcceleration();
      await this.enableAllInputMethods();
      await this.enableAllPrinting();
      await this.enableAllCameraFeatures();
      await this.enableAllLocationServices();
      await this.enableAllNotifications();
      await this.enableAllSensors();
      await this.enableAllPaymentAPIs();
      await this.enableAllFontAccess();
      await this.enableAllFileSystemAPIs();
      await this.enableAllBackgroundSync();
      await this.enableAllPushNotifications();
      await this.enableAllMediaFeatures();
      await this.enableAllClipboardFeatures();
      await this.enableAllDownloadFeatures();
      await this.enableAllAutofillFeatures();
      await this.enableAllSyncFeatures();
      await this.enableAllSearchFeatures();
      await this.enableAllTranslationFeatures();
      await this.enableAllSpellCheckFeatures();
      await this.enableAllHistoryFeatures();
      await this.enableAllBookmarkFeatures();
      await this.enableAllTabFeatures();
      await this.enableAllWindowFeatures();
      await this.enableAllPointerLockFeatures();
      await this.enableAllGamepadFeatures();
      await this.enableAllBatteryAPIFeatures();
      await this.enableAllWakeLockFeatures();
      await this.enableAllPresentationAPIFeatures();
      await this.enableAllCredentialManagementFeatures();
      
      return true;
    } catch (error) {
      console.error('Failed to enable all settings:', error);
      return false;
    }
  }

  /**
   * Verify a setting is actually enabled - Comprehensive verification
   */
  async verifySetting(settingId) {
    if (!this.isChromeOS) return false;

    try {
      switch (settingId) {
        case 'linux-env':
          return await this.checkCrostiniEnabled();
        case 'root-access':
          const rootCheck = await execAsync('id -u').catch(() => ({ stdout: '1000' }));
          return rootCheck.stdout.trim() === '0' || fs.existsSync('/etc/sudoers.d/clay');
        case 'full-system-access':
          const sysCheck = await execAsync('test -w /etc && echo "1" || echo "0"').catch(() => ({ stdout: '0' }));
          return sysCheck.stdout.trim() === '1';
        case 'firewall-bypass':
          const fwCheck = await execAsync('iptables -L INPUT 2>/dev/null | grep -q "policy ACCEPT" && echo "1" || echo "0"').catch(() => ({ stdout: '0' }));
          return fwCheck.stdout.trim() === '1';
        default:
          // Check if policy file exists
          const policyFile = `/etc/opt/chrome/policies/managed/${settingId}_policy.json`;
          return fs.existsSync(policyFile);
      }
    } catch (error) {
      console.error(`Failed to verify setting ${settingId}:`, error);
      return false;
    }
  }

  /**
   * Get current status of all settings - Comprehensive check
   */
  async getSettingsStatus() {
    if (!this.isChromeOS) {
      return { isChromeOS: false };
    }

    try {
      const [crosDebug, devBoot, adbEnabled, crostiniPolicy, crostiniPrefs, guestPolicy, enrollmentPolicy, rootAccess, firewallBypass] = await Promise.all([
        execAsync('crossystem cros_debug').catch(() => ({ stdout: '0' })),
        execAsync('crossystem dev_boot_usb').catch(() => ({ stdout: '0' })),
        execAsync('vpd -g adb_enabled 2>/dev/null').catch(() => ({ stdout: '0' })),
        fs.existsSync('/etc/opt/chrome/policies/managed/crostini_policy.json') || fs.existsSync('/etc/opt/chrome/policies/managed/crostini.json'),
        this.checkCrostiniEnabled(),
        fs.existsSync('/etc/opt/chrome/policies/managed/guest_policy.json'),
        !fs.existsSync('/var/lib/whitelist/policy') || (fs.existsSync('/var/lib/whitelist/policy') && fs.readdirSync('/var/lib/whitelist/policy').length === 0),
        this.verifySetting('root-access'),
        this.verifySetting('firewall-bypass')
      ]);

      // Check chrome_dev.conf for Crostini flags
      let chromeDevHasCrostini = false;
      try {
        if (fs.existsSync('/etc/chrome_dev.conf')) {
          const chromeDev = fs.readFileSync('/etc/chrome_dev.conf', 'utf8');
          chromeDevHasCrostini = chromeDev.includes('--enable-crostini') || chromeDev.includes('Crostini');
        }
      } catch {}

      return {
        isChromeOS: true,
        developerMode: crosDebug.stdout.trim() === '1',
        usbBoot: devBoot.stdout.trim() === '1',
        adbEnabled: adbEnabled.stdout.trim() === '1' || adbEnabled.stdout.trim() !== '',
        guestMode: guestPolicy,
        linuxEnabled: crostiniPolicy || crostiniPrefs || chromeDevHasCrostini,
        enrollmentBypassed: enrollmentPolicy,
        rootAccess: rootAccess,
        firewallBypassed: firewallBypass
      };
    } catch (error) {
      return {
        isChromeOS: true,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Check if Crostini is actually enabled and running
   */
  async checkCrostiniEnabled() {
    try {
      // Check if Crostini container exists
      const containerCheck = await execAsync('lxc list penguin 2>/dev/null | grep -q penguin && echo "1" || echo "0"').catch(() => ({ stdout: '0' }));
      if (containerCheck.stdout.trim() === '1') return true;
      
      // Check if Crostini service is running
      const serviceCheck = await execAsync('systemctl --user is-active sommelier@0 2>/dev/null || echo "inactive"').catch(() => ({ stdout: 'inactive' }));
      if (serviceCheck.stdout.trim() === 'active') return true;
      
      // Check user preferences
      const userDataDir = '/home/chronos/user';
      if (fs.existsSync(`${userDataDir}/Preferences`)) {
        try {
          const prefs = JSON.parse(fs.readFileSync(`${userDataDir}/Preferences`, 'utf8'));
          if (prefs.crostini?.enabled === true) return true;
        } catch {}
      }
      
      return false;
    } catch {
      return false;
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
        id: 'network-sharing',
        name: 'Enable Network Sharing',
        description: 'Enable network file shares, VPN, and network services',
        category: 'Network'
      },
      {
        id: 'remote-desktop',
        name: 'Enable Remote Desktop',
        description: 'Enable remote desktop access and control',
        category: 'Network'
      },
      {
        id: 'screen-sharing',
        name: 'Enable Screen Sharing',
        description: 'Enable screen capture, recording, and sharing',
        category: 'Media'
      },
      {
        id: 'usb-devices',
        name: 'Enable USB Devices',
        description: 'Enable full USB device access and management',
        category: 'Hardware'
      },
      {
        id: 'bluetooth',
        name: 'Enable Bluetooth',
        description: 'Enable Bluetooth adapter and device management',
        category: 'Hardware'
      },
      {
        id: 'filesystem-access',
        name: 'Enable File System Access',
        description: 'Enable full file system read/write access',
        category: 'Files'
      },
      {
        id: 'update-control',
        name: 'Enable Update Control',
        description: 'Enable system update management and control',
        category: 'System'
      },
      {
        id: 'accessibility',
        name: 'Enable Accessibility',
        description: 'Enable all accessibility features and options',
        category: 'Accessibility'
      },
      {
        id: 'app-permissions',
        name: 'Enable App Permissions',
        description: 'Enable app permission management and control',
        category: 'Security'
      },
      {
        id: 'clipboard-access',
        name: 'Enable Clipboard Access',
        description: 'Enable clipboard read/write access',
        category: 'System'
      },
      {
        id: 'display-control',
        name: 'Enable Display Control',
        description: 'Enable display resolution, rotation, and scaling control',
        category: 'Hardware'
      },
      {
        id: 'power-management',
        name: 'Enable Power Management',
        description: 'Enable power management and sleep control',
        category: 'System'
      },
      {
        id: 'audio-control',
        name: 'Enable Audio Control',
        description: 'Enable audio input/output and capture control',
        category: 'Hardware'
      },
      {
        id: 'security-bypass',
        name: 'Enable Security Bypass',
        description: 'Bypass security restrictions (TPM, secure boot, etc.)',
        category: 'Security'
      },
      {
        id: 'root-access',
        name: 'Enable Root Access',
        description: 'Enable root login, sudo without password, and SSH root access',
        category: 'System'
      },
      {
        id: 'full-system-access',
        name: 'Enable Full System Access',
        description: 'Remove all file permissions, disable SELinux/AppArmor, remount as RW',
        category: 'System'
      },
      {
        id: 'kernel-modules',
        name: 'Enable Kernel Modules',
        description: 'Enable kernel module loading and unsigned modules',
        category: 'System'
      },
      {
        id: 'firewall-bypass',
        name: 'Enable Firewall Bypass',
        description: 'Disable all firewall rules and open all ports',
        category: 'Network'
      },
      {
        id: 'all-network-ports',
        name: 'Enable All Network Ports',
        description: 'Open all network ports and allow all network access',
        category: 'Network'
      },
      {
        id: 'all-extensions',
        name: 'Enable All Extensions',
        description: 'Allow installation of all extensions from any source',
        category: 'Extensions'
      },
      {
        id: 'all-storage',
        name: 'Enable All Storage',
        description: 'Allow all cookies, localStorage, IndexedDB, WebSQL',
        category: 'Storage'
      },
      {
        id: 'all-web-apis',
        name: 'Enable All Web APIs',
        description: 'Enable WebRTC, WebGL, WebGPU, WebUSB, WebBluetooth, WebSerial, etc.',
        category: 'Web APIs'
      },
      {
        id: 'experimental-features',
        name: 'Enable All Experimental Features',
        description: 'Enable all experimental Chrome and web platform features',
        category: 'Experimental'
      },
      {
        id: 'enterprise-bypasses',
        name: 'Enable All Enterprise Bypasses',
        description: 'Disable all enterprise management and restrictions',
        category: 'Security'
      },
      {
        id: 'content-filter-bypass',
        name: 'Enable Content Filter Bypass',
        description: 'Bypass SafeBrowsing, URL filtering, and content restrictions',
        category: 'Security'
      },
      {
        id: 'parental-controls-bypass',
        name: 'Enable Parental Controls Bypass',
        description: 'Bypass all supervised user and parental control restrictions',
        category: 'Security'
      },
      {
        id: 'privacy-bypass',
        name: 'Enable Privacy Bypass',
        description: 'Disable Privacy Sandbox, tracking protection, and privacy features',
        category: 'Privacy'
      },
      {
        id: 'developer-tools',
        name: 'Enable All Developer Tools',
        description: 'Enable all developer tools and debugging features',
        category: 'Developer'
      },
      {
        id: 'all-debugging',
        name: 'Enable All Debugging',
        description: 'Enable all debugging flags, crash reporting, and profiling',
        category: 'Developer'
      },
      {
        id: 'hardware-acceleration',
        name: 'Enable Hardware Acceleration',
        description: 'Enable GPU, video, WebGL, and canvas acceleration',
        category: 'Performance'
      },
      {
        id: 'all-input-methods',
        name: 'Enable All Input Methods',
        description: 'Enable virtual keyboard, handwriting, voice, gesture, touch, stylus input',
        category: 'Input'
      },
      {
        id: 'all-printing',
        name: 'Enable All Printing',
        description: 'Enable all printing features and CUPS printing service',
        category: 'Hardware'
      },
      {
        id: 'all-camera-features',
        name: 'Enable All Camera Features',
        description: 'Enable camera and video capture for all URLs',
        category: 'Media'
      },
      {
        id: 'all-location-services',
        name: 'Enable All Location Services',
        description: 'Enable geolocation services and location APIs',
        category: 'Location'
      },
      {
        id: 'all-notifications',
        name: 'Enable All Notifications',
        description: 'Enable system, desktop, and web notifications',
        category: 'Notifications'
      },
      {
        id: 'all-sensors',
        name: 'Enable All Sensors',
        description: 'Enable accelerometer, gyroscope, magnetometer, ambient light, proximity, orientation sensors',
        category: 'Hardware'
      },
      {
        id: 'all-payment-apis',
        name: 'Enable All Payment APIs',
        description: 'Enable Payment Request API and Payment Handler API',
        category: 'Web APIs'
      },
      {
        id: 'all-font-access',
        name: 'Enable All Font Access',
        description: 'Enable Font Access API for all URLs',
        category: 'Web APIs'
      },
      {
        id: 'all-filesystem-apis',
        name: 'Enable All File System APIs',
        description: 'Enable Native File System, File System Access, and Origin Trials',
        category: 'Web APIs'
      },
      {
        id: 'all-background-sync',
        name: 'Enable All Background Sync',
        description: 'Enable Background Sync and Periodic Background Sync',
        category: 'Web APIs'
      },
      {
        id: 'all-push-notifications',
        name: 'Enable All Push Notifications',
        description: 'Enable Push Messaging and Push Subscription APIs',
        category: 'Web APIs'
      },
      {
        id: 'all-media-features',
        name: 'Enable All Media Features',
        description: 'Enable media stream, playback, and autoplay for all URLs',
        category: 'Media'
      },
      {
        id: 'all-clipboard-features',
        name: 'Enable All Clipboard Features',
        description: 'Enable full clipboard read/write without sanitization',
        category: 'System'
      },
      {
        id: 'all-download-features',
        name: 'Enable All Download Features',
        description: 'Enable all downloads without restrictions',
        category: 'Files'
      },
      {
        id: 'all-autofill-features',
        name: 'Enable All Autofill Features',
        description: 'Enable autofill, password manager, and form filling',
        category: 'Browser'
      },
      {
        id: 'all-sync-features',
        name: 'Enable All Sync Features',
        description: 'Enable browser sync and all sync types',
        category: 'Browser'
      },
      {
        id: 'all-search-features',
        name: 'Enable All Search Features',
        description: 'Enable search suggestions and custom search providers',
        category: 'Browser'
      },
      {
        id: 'all-translation-features',
        name: 'Enable All Translation Features',
        description: 'Enable translation for all languages',
        category: 'Browser'
      },
      {
        id: 'all-spellcheck-features',
        name: 'Enable All Spell Check Features',
        description: 'Enable spell check and grammar checking',
        category: 'Browser'
      },
      {
        id: 'all-history-features',
        name: 'Enable All History Features',
        description: 'Enable browsing history and allow deletion',
        category: 'Browser'
      },
      {
        id: 'all-bookmark-features',
        name: 'Enable All Bookmark Features',
        description: 'Enable bookmark editing and bookmark bar',
        category: 'Browser'
      },
      {
        id: 'all-tab-features',
        name: 'Enable All Tab Features',
        description: 'Enable tab groups, hover cards, and disable tab freezing',
        category: 'Browser'
      },
      {
        id: 'all-window-features',
        name: 'Enable All Window Features',
        description: 'Enable window placement API and fullscreen for all URLs',
        category: 'Browser'
      },
      {
        id: 'all-pointer-lock-features',
        name: 'Enable All Pointer Lock Features',
        description: 'Enable pointer lock API for all URLs',
        category: 'Web APIs'
      },
      {
        id: 'all-gamepad-features',
        name: 'Enable All Gamepad Features',
        description: 'Enable Gamepad API for all URLs',
        category: 'Web APIs'
      },
      {
        id: 'all-battery-api-features',
        name: 'Enable All Battery API Features',
        description: 'Enable Battery Status API for all URLs',
        category: 'Web APIs'
      },
      {
        id: 'all-wake-lock-features',
        name: 'Enable All Wake Lock Features',
        description: 'Enable Screen Wake Lock API for all URLs',
        category: 'Web APIs'
      },
      {
        id: 'all-presentation-api-features',
        name: 'Enable All Presentation API Features',
        description: 'Enable Presentation API for all URLs',
        category: 'Web APIs'
      },
      {
        id: 'all-credential-management-features',
        name: 'Enable All Credential Management Features',
        description: 'Enable Credential Management API and WebAuthn for all URLs',
        category: 'Web APIs'
      },
      {
        id: 'all-settings',
        name: 'Enable All Settings',
        description: 'Enable all hidden settings at once using all available methods',
        category: 'All'
      },
      {
        id: 'website-allowlist',
        name: 'Enable Website Allowlist',
        description: 'Override all extensions and policy blocks for specified websites (use * for all)',
        category: 'Security'
      },
      {
        id: 'disable-extensions',
        name: 'Disable All Extensions',
        description: 'Completely disable all Chrome extensions using multiple methods (inspired by rigtools-v2)',
        category: 'Security'
      }
    ];
  }

  /**
   * Enable specific Chrome flag programmatically
   */
  async enableChromeFlag(flagName, flagValue = 'enabled') {
    if (!this.isChromeOS) return false;

    try {
      let chromeDevConf = '';
      if (fs.existsSync('/etc/chrome_dev.conf')) {
        chromeDevConf = fs.readFileSync('/etc/chrome_dev.conf', 'utf8');
      }
      
      const flag = `--${flagName}=${flagValue}`;
      if (!chromeDevConf.includes(flag)) {
        chromeDevConf += `${flag}\n`;
        await executeAsRoot(`cat > /etc/chrome_dev.conf << 'EOF'\n${chromeDevConf}EOF`);
      }
      
      return true;
    } catch (error) {
      console.error(`Failed to enable Chrome flag ${flagName}:`, error);
      return false;
    }
  }

  /**
   * Enable Chrome feature flag programmatically
   */
  async enableChromeFeature(featureName, enabled = true) {
    if (!this.isChromeOS) return false;

    try {
      let chromeDevConf = '';
      if (fs.existsSync('/etc/chrome_dev.conf')) {
        chromeDevConf = fs.readFileSync('/etc/chrome_dev.conf', 'utf8');
      }
      
      const flag = `--enable-features=${featureName}`;
      const disableFlag = `--disable-features=${featureName}`;
      
      if (enabled) {
        // Remove disable flag if present
        chromeDevConf = chromeDevConf.replace(new RegExp(disableFlag, 'g'), '');
        // Add enable flag if not present
        if (!chromeDevConf.includes(flag)) {
          chromeDevConf += `${flag}\n`;
        }
      } else {
        // Remove enable flag if present
        chromeDevConf = chromeDevConf.replace(new RegExp(flag, 'g'), '');
        // Add disable flag if not present
        if (!chromeDevConf.includes(disableFlag)) {
          chromeDevConf += `${disableFlag}\n`;
        }
      }
      
      await executeAsRoot(`cat > /etc/chrome_dev.conf << 'EOF'\n${chromeDevConf}EOF`);
      
      return true;
    } catch (error) {
      console.error(`Failed to enable Chrome feature ${featureName}:`, error);
      return false;
    }
  }
}

// Export singleton instance
export const settingsUnlocker = new ChromeOSSettingsUnlocker();

