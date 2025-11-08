/**
 * v86 Integration
 * x86 PC emulator and x86-to-WebAssembly JIT compiler
 * https://github.com/copy/v86
 * 
 * This integration enhances WebVM with x86 emulation capabilities
 */

export interface V86Config {
  memory_size?: number; // Memory size in MB
  vga_memory_size?: number; // VGA memory size in MB
  screen_container?: HTMLElement;
  bios?: {
    url: string;
  };
  vga_bios?: {
    url: string;
  };
  cdrom?: {
    url?: string;
    async?: boolean;
  };
  hda?: {
    url?: string;
    async?: boolean;
    size?: number;
  };
  network_relay_url?: string;
  autostart?: boolean;
}

export class V86Emulator {
  private emulator: any = null;
  private container: HTMLElement | null = null;
  private isRunning: boolean = false;
  private config: V86Config;

  constructor(config: V86Config = {}) {
    this.config = {
      memory_size: 32 * 1024 * 1024, // 32MB default
      vga_memory_size: 2 * 1024 * 1024, // 2MB default
      autostart: false,
      ...config,
    };
  }

  /**
   * Initialize v86 emulator
   */
  async initialize(container: HTMLElement): Promise<void> {
    this.container = container;

    // Load v86 library dynamically
    if (typeof window !== 'undefined' && !(window as any).V86Starter) {
      await this.loadV86Library();
    }

    if (!(window as any).V86Starter) {
      throw new Error('v86 library not available');
    }

    const V86Starter = (window as any).V86Starter;

    this.emulator = new V86Starter({
      memory_size: this.config.memory_size,
      vga_memory_size: this.config.vga_memory_size,
      screen_container: container,
      bios: this.config.bios || {
        url: 'https://cdn.jsdelivr.net/gh/copy/v86@master/bios/seabios.bin',
      },
      vga_bios: this.config.vga_bios || {
        url: 'https://cdn.jsdelivr.net/gh/copy/v86@master/bios/vgabios.bin',
      },
      cdrom: this.config.cdrom,
      hda: this.config.hda,
      network_relay_url: this.config.network_relay_url,
      autostart: this.config.autostart,
    });

    this.isRunning = true;
  }

  /**
   * Load v86 library from CDN
   */
  private async loadV86Library(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).V86Starter) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/gh/copy/v86@master/build/libv86.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load v86 library'));
      document.head.appendChild(script);
    });
  }

  /**
   * Start the emulator
   */
  start(): void {
    if (this.emulator && !this.isRunning) {
      this.emulator.run();
      this.isRunning = true;
    }
  }

  /**
   * Stop the emulator
   */
  stop(): void {
    if (this.emulator && this.isRunning) {
      this.emulator.stop();
      this.isRunning = false;
    }
  }

  /**
   * Restart the emulator
   */
  restart(): void {
    this.stop();
    setTimeout(() => this.start(), 100);
  }

  /**
   * Send keyboard input
   */
  sendKey(key: string): void {
    if (this.emulator) {
      this.emulator.keyboard_send_string(key);
    }
  }

  /**
   * Load a disk image
   */
  loadDiskImage(url: string, async: boolean = true): void {
    if (this.emulator) {
      this.emulator.create_file(
        {
          url: url,
          async: async,
        },
        (disk: any) => {
          this.emulator.add_cdrom(disk);
        }
      );
    }
  }

  /**
   * Save state
   */
  saveState(): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      if (!this.emulator) {
        reject(new Error('Emulator not initialized'));
        return;
      }

      this.emulator.save_state((state: ArrayBuffer) => {
        resolve(state);
      });
    });
  }

  /**
   * Restore state
   */
  restoreState(state: ArrayBuffer): void {
    if (this.emulator) {
      this.emulator.restore_state(state);
    }
  }

  /**
   * Get emulator status
   */
  getStatus(): { running: boolean; initialized: boolean } {
    return {
      running: this.isRunning,
      initialized: this.emulator !== null,
    };
  }

  /**
   * Create a simple Linux boot configuration
   */
  static createLinuxConfig(): V86Config {
    return {
      memory_size: 64 * 1024 * 1024, // 64MB
      vga_memory_size: 4 * 1024 * 1024, // 4MB
      cdrom: {
        url: 'https://cdn.jsdelivr.net/gh/copy/v86@master/images/linux4.iso',
        async: true,
      },
      autostart: true,
    };
  }

  /**
   * Create a Windows 95 boot configuration
   */
  static createWindows95Config(): V86Config {
    return {
      memory_size: 32 * 1024 * 1024, // 32MB
      vga_memory_size: 2 * 1024 * 1024, // 2MB
      hda: {
        url: 'https://cdn.jsdelivr.net/gh/copy/v86@master/images/win95.img',
        async: true,
      },
      autostart: true,
    };
  }
}

// Export utility functions
export const v86Utils = {
  /**
   * Check if v86 is available
   */
  isAvailable(): boolean {
    return typeof window !== 'undefined' && !!(window as any).V86Starter;
  },

  /**
   * Create a new v86 emulator instance
   */
  createEmulator(config?: V86Config): V86Emulator {
    return new V86Emulator(config);
  },
};

