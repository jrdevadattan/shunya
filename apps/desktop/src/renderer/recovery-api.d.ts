import type { createRecoveryApi } from '../preload/recovery-api.js';

declare global {
  interface Window {
    recoveryApi: ReturnType<typeof createRecoveryApi>;
    certificates: {
      generate(record: import('../main/certificate.js').CertificateRecord): Promise<import('../main/certificate.js').SignedCertificate>;
      verify(cert: import('../main/certificate.js').SignedCertificate): Promise<{ valid: boolean; reason?: string }>;
      save(suggestedName: string, content: string): Promise<string | null>;
    };
    secureErase: {
      prepareBinary(): Promise<void>;
      listDevices(): Promise<import('../main/secure-erase/types.js').NvmeDevice[]>;
      getCapabilities(device: string): Promise<import('../main/secure-erase/types.js').SanitizeCapabilities>;
      eraseDevice(device: string, options: import('../main/secure-erase/types.js').EraseOptions): Promise<import('../main/secure-erase/types.js').EraseResult>;
      listBlockDevices(): Promise<import('../main/secure-erase/types.js').BlockDevice[]>;
      isElevated(): Promise<boolean>;
      csprngErase(device: string, options: { confirmation: string; dryRun: boolean }): Promise<import('../main/secure-erase/types.js').EraseResult>;
      chooseCaptureOutput(suggestedName: string): Promise<string | null>;
      captureImage(device: string, options: { imagePath: string; maxBytes?: number | null }): Promise<import('../main/secure-erase/types.js').CaptureResult>;
      onProgress(callback: (event: import('../main/secure-erase/types.js').EraseProgressEvent) => void): () => void;
      onCaptureProgress(callback: (event: import('../main/secure-erase/types.js').CaptureProgressEvent) => void): () => void;
      onDownloadProgress(callback: (message: string) => void): () => void;
    };
  }
}

export {};
