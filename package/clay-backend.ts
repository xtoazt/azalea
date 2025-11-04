/**
 * Clay Backend - Pure backend API
 * Main entry point for creating backend instances
 */

export { ClayBackend } from './core/clay-backend';
export type { ClayBackendConfig } from './types';

import { ClayBackend } from './core/clay-backend';
import type { ClayBackendConfig } from './types';

/**
 * Create and initialize a new Clay Backend instance
 * 
 * @example
 * ```typescript
 * import { createClayBackend } from 'clay-util';
 * 
 * const backend = await createClayBackend({
 *   bridgeUrl: 'ws://127.0.0.1:8765/ws'
 * });
 * 
 * // Execute a command
 * const result = await backend.executeCommand('ls -la');
 * console.log(result.output);
 * ```
 */
export async function createClayBackend(config: ClayBackendConfig = {}): Promise<ClayBackend> {
  const backend = new ClayBackend(config);
  await backend.initialize();
  return backend;
}

/**
 * Default export
 */
export default ClayBackend;

