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

export type EraseMethod =
  | 'sanitize_crypto_erase'
  | 'sanitize_block_erase'
  | 'format_user_data_erase'
  // Host-side CSPRNG overwrite (NIST SP 800-88 Clear) for USB flash / pendrives.
  | 'csprng_overwrite';

/** NIST SP 800-88 Rev. 2 sanitization assurance level. */
export type Assurance = 'purge' | 'clear' | 'lower_assurance';

export interface BlockDevice {
  /** Raw device path: \\.\PhysicalDriveN on Windows, /dev/sdX on Linux. */
  device: string;
  model: string;
  serial: string | null;
  sizeBytes: number;
  busType: string | null;
  removable: boolean;
  /** True when this device backs the running operating system; never erasable. */
  system: boolean;
}

export interface EraseProgressEvent {
  device: string;
  method: EraseMethod;
  percent: number | null;
  statusText: string;
}

export interface EraseResult {
  device: string;
  method: EraseMethod;
  assurance: Assurance;
  completedAt: string;
  auditLogPath: string;
}

export interface CaptureProgressEvent {
  device: string;
  percent: number | null;
  statusText: string;
}

export interface CaptureResult {
  device: string;
  model: string;
  /** Absolute path of the written .raw image. */
  imagePath: string;
  bytesCaptured: number;
  /** SHA-256 of the whole image, for read-only chain of custody. */
  sha256: string;
  /** True when only a leading portion of the device was captured. */
  truncated: boolean;
  completedAt: string;
  auditLogPath: string;
}
