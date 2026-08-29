import { useState } from 'react';
import { CapabilityBanner } from '@recovery/ui';

const groups = ['Documents', 'Images', 'Audio/Video', 'Archives', 'Databases', 'Executables/Scripts', 'Other supported signatures'];

export function FileFamilySelector() {
  const [selected, setSelected] = useState<Set<string>>(new Set(['Documents', 'Images']));
  function toggle(group: string) { setSelected((current) => { const next = new Set(current); if (next.has(group)) next.delete(group); else next.add(group); return next; }); }
  return <fieldset><legend>File families</legend><div className="checkbox-grid">{groups.map((group) => <label key={group}><input type="checkbox" checked={selected.has(group)} onChange={() => toggle(group)} /> {group}</label>)}</div>{selected.has('Executables/Scripts') ? <CapabilityBanner level="warning" title="Potentially active content" explanation="Recovered active content is treated as potentially unsafe and cannot be opened directly from the application." /> : null}</fieldset>;
}
