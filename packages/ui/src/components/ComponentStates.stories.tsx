import type { Meta, StoryObj } from '@storybook/react-vite';
import { CapabilityBanner } from './CapabilityBanner.js';

const meta = { component: CapabilityBanner, title: 'Recovery/CapabilityBanner', args: { level: 'warning', title: 'Rescue Mode recommended', explanation: 'The disk contains the running operating system.' } } satisfies Meta<typeof CapabilityBanner>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Warning: Story = {};
export const Ready: Story = { args: { level: 'success', title: 'Ready', explanation: 'This source can be analyzed safely in the current mode.' } };
export const Danger: Story = { args: { level: 'danger', title: 'Source blocked', explanation: 'Choose a different physical destination.' } };
