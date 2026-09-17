import { HardDrive, Loader2, Usb } from 'lucide-react';
import type { BlockDevice } from '../../../main/secure-erase/types.js';

export function formatDeviceBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${bytes} B`;
}

/** Shared list of physical drives: only removable, non-system devices can be picked. */
export function DevicePicker({ devices, selected, busy, onSelect, label = 'Detected devices' }: {
  devices: BlockDevice[] | null;
  selected?: string;
  busy?: boolean;
  onSelect(device: BlockDevice): void;
  label?: string;
}) {
  return (
    <section className="device-list" aria-label={label}>
      {devices === null ? <p role="status" className="flash-erase__loading"><Loader2 aria-hidden="true" className="spin" /> Looking for connected drives…</p> : null}
      {devices?.length === 0 ? <p className="empty-state">No drives were found. Plug in a USB drive and rescan.</p> : null}
      {devices?.map((device) => {
        const eligible = device.removable && !device.system;
        const active = selected === device.device;
        return (
          <button
            key={device.device}
            type="button"
            className="device-card"
            data-eligible={eligible || undefined}
            data-active={active || undefined}
            aria-pressed={active}
            disabled={!eligible || busy}
            onClick={() => onSelect(device)}
          >
            <span className="device-card__icon" aria-hidden="true">{device.removable ? <Usb /> : <HardDrive />}</span>
            <span className="device-card__body">
              <strong>{device.model}</strong>
              <small>{formatDeviceBytes(device.sizeBytes)} · {device.busType ?? 'unknown bus'} · <code>{device.device}</code></small>
            </span>
            <span className="badge" data-tone={device.system ? 'success' : eligible ? 'accent' : undefined}>
              {device.system ? 'System disk — protected' : eligible ? 'Removable' : 'Fixed disk — not eligible'}
            </span>
          </button>
        );
      })}
    </section>
  );
}
