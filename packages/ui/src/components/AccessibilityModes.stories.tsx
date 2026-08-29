import type { Meta, StoryObj } from '@storybook/react-vite';
import { CapabilityBanner } from './CapabilityBanner.js';
import { RuntimeModeBadge } from './RuntimeModeBadge.js';
import { StageTimeline } from './StageTimeline.js';

function StateGallery() {
  return <div style={{ display: 'grid', gap: '1rem', padding: '1.5rem', background: 'var(--surface-app)', color: 'var(--text-primary)' }}>
    <div style={{ display: 'flex', gap: '0.75rem' }}><RuntimeModeBadge mode="installed" /><RuntimeModeBadge mode="rescue" /></div>
    <CapabilityBanner level="warning" title="Rescue Mode recommended" explanation="The selected system disk is currently in use." />
    <StageTimeline stages={[{ id: 'scan', label: 'Scan source', status: 'running' }, { id: 'verify', label: 'Verify results', status: 'pending' }]} />
  </div>;
}

const meta = { component: StateGallery, title: 'Recovery/Accessibility modes' } satisfies Meta<typeof StateGallery>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};
export const Dark: Story = { decorators: [(Story) => <div data-theme="dark"><Story /></div>] };
export const TextZoom200: Story = { decorators: [(Story) => <div style={{ fontSize: '200%' }}><Story /></div>] };
