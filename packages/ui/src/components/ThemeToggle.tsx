import { Monitor, Moon, Sun } from 'lucide-react';

export type ThemeChoice = 'light' | 'system' | 'dark';

const options: Array<{ value: ThemeChoice; label: string; Icon: typeof Sun }> = [
  { value: 'light', label: 'Light theme', Icon: Sun },
  { value: 'system', label: 'System theme', Icon: Monitor },
  { value: 'dark', label: 'Dark theme', Icon: Moon },
];

/** Three-way segmented theme switch (light / follow system / dark). */
export function ThemeToggle({ value, onChange }: { value: ThemeChoice; onChange: (next: ThemeChoice) => void }) {
  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Theme">
      {options.map(({ value: option, label, Icon }) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          aria-label={label}
          title={label}
          className="theme-toggle__option"
          onClick={() => onChange(option)}
        >
          <Icon aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
