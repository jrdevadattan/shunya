import type { FileFamily } from '@recovery/contracts';
import { AlertTriangle } from 'lucide-react';
import { ALL_FILE_FAMILIES, FILE_FAMILIES, formatCount } from './file-families.js';

export function FileFamilySelector({ selected, onChange, disabled = false }: {
  selected: readonly FileFamily[];
  onChange(next: FileFamily[]): void;
  disabled?: boolean;
}) {
  const allSelected = selected.length === ALL_FILE_FAMILIES.length;
  const toggle = (family: FileFamily) => onChange(selected.includes(family) ? selected.filter((item) => item !== family) : [...selected, family]);
  return <fieldset className="family-selector" disabled={disabled}>
    <legend className="sr-only">File families to search for</legend>
    <header className="family-selector__header">
      <div>
        <strong>File families to search for</strong>
        <p>{selected.length ? `${selected.length} of ${ALL_FILE_FAMILIES.length} families · ${formatCount(selected)} content signatures` : 'Select at least one family to start a scan.'}</p>
      </div>
      <div className="family-selector__actions">
        <button className="button button--ghost button--small" type="button" disabled={allSelected} onClick={() => onChange([...ALL_FILE_FAMILIES])}>Select all</button>
        <button className="button button--ghost button--small" type="button" disabled={!selected.length} onClick={() => onChange([])}>Clear</button>
      </div>
    </header>
    <div className="family-grid">
      {FILE_FAMILIES.map(({ id, label, description, formats, Icon, caution }) => {
        const checked = selected.includes(id);
        return <label className="family-card" key={id} data-selected={checked || undefined} data-caution={caution ? '' : undefined}>
          <input type="checkbox" checked={checked} onChange={() => toggle(id)} aria-describedby={`family-${id}-formats`} />
          <span className="family-card__icon" aria-hidden="true"><Icon /></span>
          <span className="family-card__body">
            <strong>{label}</strong>
            <small>{description}</small>
            <span className="family-card__formats" id={`family-${id}-formats`}>{formats}</span>
            {caution ? <span className="family-card__caution"><AlertTriangle aria-hidden="true" />{caution}</span> : null}
          </span>
        </label>;
      })}
    </div>
  </fieldset>;
}
