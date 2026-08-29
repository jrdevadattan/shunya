import type { createRecoveryApi } from '../preload/recovery-api.js';

declare global {
  interface Window {
    recoveryApi: ReturnType<typeof createRecoveryApi>;
  }
}

export {};
