import type { createRecoveryApi } from '../preload/recovery-api.js';

declare global {
  interface Window {
    recoveryApi: ReturnType<typeof createRecoveryApi>;
    secureErase: {
      prepareBinary(): Promise<void>;
      listDevices(): Promise<import('../main/secure-erase/types.js').NvmeDevice[]>;
      getCapabilities(device: string): Promise<import('../main/secure-erase/types.js').SanitizeCapabilities>;
      eraseDevice(device: string, options: import('../main/secure-erase/types.js').EraseOptions): Promise<import('../main/secure-erase/types.js').EraseResult>;
      onProgress(callback: (event: import('../main/secure-erase/types.js').EraseProgressEvent) => void): () => void;
      onDownloadProgress(callback: (message: string) => void): () => void;
    };
  }
}

export {};
