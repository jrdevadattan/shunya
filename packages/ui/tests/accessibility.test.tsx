import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { LayoutDashboard } from 'lucide-react';
import { AppShell, CapabilityBanner } from '../src/index.js';

describe('CapabilityBanner', () => {
  it('renders warning status with icon, text, and no accessibility violations', async () => {
    const { container, getByRole, getByText } = render(
      <CapabilityBanner
        level="warning"
        title="Rescue Mode recommended"
        explanation="The disk is in use."
      />,
    );

    expect(getByRole('status', { name: 'Warning: Rescue Mode recommended' })).toBeVisible();
    expect(getByText('The disk is in use.')).toBeVisible();
    expect((await axe.run(container, {
      rules: {
        // jsdom has no canvas implementation; contrast is covered by the
        // browser-rendered Storybook states rather than this DOM-only test.
        'color-contrast': { enabled: false },
      },
    })).violations).toEqual([]);
  });
});

describe('AppShell', () => {
  it('has no detectable accessibility violations', async () => {
    const { container } = render(
      <AppShell
        brand="SHUNYA Recovery"
        collapsed={false}
        onCollapsedChange={() => undefined}
        header={<h1>Overview</h1>}
        navigation={[{
          id: 'workspace',
          label: 'Workspace',
          items: [{ id: 'overview', label: 'Overview', href: '#/overview', icon: LayoutDashboard, active: true }],
        }]}
        footer={<span>Case one</span>}
      >
        <p>Recovery workspace</p>
      </AppShell>,
    );

    expect((await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })).violations).toEqual([]);
  });
});
