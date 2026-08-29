import { CapabilityBanner, InfoPopover } from '@recovery/ui';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export function DestinationPage() {
  const [search] = useSearchParams();
  const sameDevice = search.get('state') === 'same-device';
  const network = search.get('state') === 'network';
  const [acknowledged, setAcknowledged] = useState(false);
  const level = sameDevice ? 'danger' : network ? 'warning' : 'success';
  const title = sameDevice ? 'Destination is on the source device' : network ? 'Network destination' : 'Destination ready';
  const explanation = sameDevice ? 'Recovery output cannot be written to the same physical device being recovered. Choose a different physical device.' : network ? 'A network interruption can pause or fail recovery output.' : 'The destination is writable, separate from the source, and has enough free space.';
  return <section className="destination-page"><header><p className="eyebrow">Recovery setup</p><h1>Choose destination</h1><p>Image destination and recovered-file export destination are selected separately.</p></header><dl className="metric-grid"><div><dt>Free space</dt><dd>512.0 GiB</dd></div><div><dt>Estimated requirement</dt><dd>256.0 GiB</dd></div><div><dt>Safety reserve</dt><dd>25.6 GiB</dd></div></dl><CapabilityBanner level={level} title={title} explanation={explanation} /><InfoPopover title="Why am I seeing this?">The platform resolves both locations to physical device identities before allowing recovery output.</InfoPopover>{network ? <label><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /> I understand that a network interruption can stop the operation.</label> : null}<div className="form-actions"><button className="button button--primary" type="button" disabled={sameDevice || (network && !acknowledged)}>Continue</button></div>{sameDevice ? <p>No bypass is available for same-device destinations.</p> : null}</section>;
}
