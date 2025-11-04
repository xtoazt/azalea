/**
 * Clay Terminal Backend API - Pure backend, no UI dependencies
 * Powerful terminal backend for web applications
 */

export { ClayBackend, createClayBackend } from './clay-backend';
export { BridgeBackend } from './backend/bridge-backend';
export { WebWorkerBackend } from './backend/web-worker-backend';
export { SessionEncoder } from './utils/session-encoder';

export type {
  ClayBackendConfig,
  TerminalBackend,
  CommandResult,
  SystemInfo,
  AIAssistantConfig,
  OutputCallback,
  ErrorCallback,
  StatusCallback,
  CommandCallback
} from './types';
