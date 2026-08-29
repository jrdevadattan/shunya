import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Cpu, LayoutDashboard, Search } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AppShell,
  IconButton,
  MetricCard,
  SurfaceCard,
  type NavigationGroup,
} from '../src/index.js';

const navigation: NavigationGroup[] = [{
  id: 'workspace',
  label: 'Workspace',
  items: [
    {
      id: 'overview',
      label: 'Overview',
      href: '#/cases/case-1/overview',
      icon: LayoutDashboard,
      active: true,
    },
    {
      id: 'memory',
      label: 'Memory Analysis',
      href: '#/cases/case-1/memory',
      icon: Cpu,
      disabledReason: 'Volatility is unavailable.',
    },
  ],
}];

afterEach(cleanup);

describe('Studio Admin visual foundation', () => {
  it('renders grouped navigation, active and disabled items, header, content, and footer', () => {
    const onCollapsedChange = vi.fn();
    render(
      <AppShell
        brand="SHUNYA Recovery"
        collapsed={false}
        onCollapsedChange={onCollapsedChange}
        header={<span>Overview</span>}
        navigation={navigation}
        footer={<span>Case 1</span>}
      >
        <p>Case content</p>
      </AppShell>,
    );

    expect(screen.getByText('SHUNYA Recovery')).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Case navigation' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: /Memory Analysis/ })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Volatility is unavailable.')).toBeVisible();
    expect(screen.getByRole('banner')).toHaveAttribute('data-height', '48');
    expect(screen.getByText('Case content')).toBeVisible();
    expect(screen.getByText('Case 1')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
  });

  it('renders the collapsed rail and exposes an expand control', () => {
    const view = render(
      <AppShell
        brand="SHUNYA Recovery"
        collapsed
        onCollapsedChange={() => undefined}
        header={<span>Overview</span>}
        navigation={navigation}
        footer={<span>Case 1</span>}
      >
        <p>Case content</p>
      </AppShell>,
    );

    expect(view.getByTestId('app-shell')).toHaveAttribute('data-collapsed', 'true');
    expect(view.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
  });

  it('provides named icon buttons and semantic surface and metric cards', () => {
    render(
      <>
        <IconButton label="Search recovery case" icon={Search} onClick={() => undefined} />
        <SurfaceCard title="Source health"><p>Read only</p></SurfaceCard>
        <MetricCard label="Sources" value={2} detail="Evidence sources" icon={Cpu} tone="success" />
      </>,
    );

    expect(screen.getByRole('button', { name: 'Search recovery case' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Source health' })).toBeVisible();
    expect(screen.getByText('2')).toBeVisible();
    expect(screen.getByText('Evidence sources')).toBeVisible();
  });
});
