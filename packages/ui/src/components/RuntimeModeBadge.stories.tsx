import type { Meta, StoryObj } from '@storybook/react-vite';
import { RuntimeModeBadge } from './RuntimeModeBadge.js';

const meta = {
  component: RuntimeModeBadge,
  title: 'Recovery/RuntimeModeBadge',
  args: { mode: 'installed' },
} satisfies Meta<typeof RuntimeModeBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Installed: Story = {};
export const Rescue: Story = { args: { mode: 'rescue' } };
