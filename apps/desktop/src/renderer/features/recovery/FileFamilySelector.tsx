import { CapabilityBanner } from '@recovery/ui';

export function FileFamilySelector() {
  return <CapabilityBanner level="warning" title="File-family selection is unavailable" explanation="Recovery jobs currently accept a typed scan preset only. No file-family filter is sent to the daemon." />;
}
