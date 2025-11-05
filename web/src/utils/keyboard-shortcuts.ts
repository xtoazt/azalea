// Comprehensive keyboard shortcut management system

export interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  preventDefault?: boolean;
  callback: () => void;
  description?: string;
}

class KeyboardShortcutManager {
  private shortcuts: Map<string, ShortcutConfig> = new Map();
  private isEnabled: boolean = true;

  constructor() {
    this.setupGlobalHandler();
  }

  private setupGlobalHandler(): void {
    document.addEventListener('keydown', (event: KeyboardEvent) => {
      if (!this.isEnabled) return;

      const key = event.key.toLowerCase();
      const shortcut = this.findMatchingShortcut(event);

      if (shortcut) {
        if (shortcut.preventDefault !== false) {
          event.preventDefault();
          event.stopPropagation();
        }
        shortcut.callback();
      }
    });
  }

  private findMatchingShortcut(event: KeyboardEvent): ShortcutConfig | undefined {
    const key = event.key.toLowerCase();
    
    for (const shortcut of this.shortcuts.values()) {
      const keyMatch = shortcut.key.toLowerCase() === key;
      const ctrlMatch = !!shortcut.ctrl === (event.ctrlKey || event.metaKey);
      const shiftMatch = shortcut.shift === undefined ? true : !!shortcut.shift === event.shiftKey;
      const altMatch = shortcut.alt === undefined ? true : !!shortcut.alt === event.altKey;
      
      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        return shortcut;
      }
    }
    
    return undefined;
  }

  register(config: ShortcutConfig): void {
    const id = this.generateShortcutId(config);
    this.shortcuts.set(id, config);
  }

  unregister(key: string, ctrl?: boolean, shift?: boolean, alt?: boolean): void {
    const id = this.generateShortcutId({ key, ctrl, shift, alt });
    this.shortcuts.delete(id);
  }

  private generateShortcutId(config: Partial<ShortcutConfig>): string {
    const parts = [];
    if (config.ctrl || config.meta) parts.push('ctrl');
    if (config.shift) parts.push('shift');
    if (config.alt) parts.push('alt');
    parts.push(config.key?.toLowerCase() || '');
    return parts.join('+');
  }

  enable(): void {
    this.isEnabled = true;
  }

  disable(): void {
    this.isEnabled = false;
  }

  getShortcuts(): ShortcutConfig[] {
    return Array.from(this.shortcuts.values());
  }

  formatShortcut(shortcut: ShortcutConfig): string {
    const parts = [];
    if (shortcut.ctrl || shortcut.meta) parts.push('Ctrl');
    if (shortcut.shift) parts.push('Shift');
    if (shortcut.alt) parts.push('Alt');
    parts.push(shortcut.key.toUpperCase());
    return parts.join('+');
  }
}

export const shortcutManager = new KeyboardShortcutManager();

// Expose to window for global access
if (typeof window !== 'undefined') {
  (window as any).shortcutManager = shortcutManager;
}

