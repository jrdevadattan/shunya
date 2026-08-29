import { CapabilityBanner, InfoPopover } from '@recovery/ui';

export function DestinationPage() {
  return <section className="destination-page"><header><p className="eyebrow">Recovery setup</p><h1>Choose destination</h1><p>Image destination and recovered-file export destination are selected separately.</p></header><CapabilityBanner level="warning" title="Destination assessment unavailable" explanation="No typed acquisition-destination assessment is exposed by the current daemon. No free-space or physical-separation result is assumed." /><InfoPopover title="Why am I seeing this?">The daemon must resolve both locations to physical device identities before allowing output. Export performs that proof at export time.</InfoPopover><button className="button button--primary" type="button" disabled>Continue</button></section>;
}
