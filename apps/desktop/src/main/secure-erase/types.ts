export interface NvmeDevice {
  device: string;
  serial: string;
  model: string;
  firmware: string | null;
  namespaceId: number | null;
}

export interface SanitizeCapabilities {
  cryptoErase: boolean;
  blockErase: boolean;
  overwrite: boolean;
}

export interface EraseOptions {
  /** Must exactly equal the selected device path; the main process checks this again. */
  confirmation: string;
  allowFormatFallback: boolean;
}

export type EraseMethod = 'sanitize_crypto_erase' | 'sanitize_block_erase' | 'format_user_data_erase';

export interface EraseProgressEvent {
  device: string;
  method: EraseMethod;
  percent: number | null;
  statusText: string;
}

export interface EraseResult {
  device: string;
  method: EraseMethod;
  assurance: 'purge' | 'lower_assurance';
  completedAt: string;
  auditLogPath: string;
}
