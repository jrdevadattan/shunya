import type { Meta, StoryObj } from '@storybook/react-vite';
import { StageTimeline } from './StageTimeline.js';

const runningStages = [
  { id: 'prepare', label: 'Prepare destination', status: 'completed' as const },
  { id: 'scan', label: 'Scan source', status: 'running' as const },
  { id: 'verify', label: 'Verify recovered files', status: 'pending' as const },
];

const meta = {
  component: StageTimeline,
  title: 'Recovery/StageTimeline',
  args: { stages: runningStages },
} satisfies Meta<typeof StageTimeline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Running: Story = {};
export const Paused: Story = {
  args: { stages: runningStages.map((stage) => stage.id === 'scan' ? { ...stage, status: 'paused' as const } : stage) },
};
