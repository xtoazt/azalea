/**
 * Integration Hub
 * Centralized access to all integrations
 */

import { crosupIntegration, BackendInterface } from './crosup';
import { chrostiniIntegration } from './chrostini';
import { v86Utils, V86Emulator } from './v86-emulator';
import { virtualBoxIntegration } from './virtualbox';
import { recomodIntegration } from './recomod';
import { browserPodIntegration } from './browserpod';

export type { BackendInterface };

export {
  crosupIntegration,
  chrostiniIntegration,
  v86Utils,
  V86Emulator,
  virtualBoxIntegration,
  recomodIntegration,
  browserPodIntegration,
};

/**
 * Integration Manager
 * Manages all integrations and provides unified interface
 */
export class IntegrationManager {
  private integrations: Map<string, any> = new Map();

  constructor() {
    this.registerIntegration('crosup', crosupIntegration);
    this.registerIntegration('chrostini', chrostiniIntegration);
    this.registerIntegration('virtualbox', virtualBoxIntegration);
    this.registerIntegration('recomod', recomodIntegration);
    this.registerIntegration('browserpod', browserPodIntegration);
  }

  /**
   * Register an integration
   */
  registerIntegration(name: string, integration: any): void {
    this.integrations.set(name, integration);
  }

  /**
   * Get an integration
   */
  getIntegration(name: string): any {
    return this.integrations.get(name);
  }

  /**
   * Get all available integrations
   */
  getAvailableIntegrations(): string[] {
    return Array.from(this.integrations.keys());
  }

  /**
   * Check integration status
   */
  async checkAllStatus(): Promise<Record<string, any>> {
    const status: Record<string, any> = {};

    for (const [name, integration] of this.integrations.entries()) {
      if (integration.getStatus) {
        status[name] = integration.getStatus();
      } else if (integration.checkAvailability) {
        status[name] = {
          available: await integration.checkAvailability(),
        };
      }
    }

    // Check v86 separately
    status.v86 = {
      available: v86Utils.isAvailable(),
    };

    return status;
  }
}

// Export singleton instance
export const integrationManager = new IntegrationManager();

