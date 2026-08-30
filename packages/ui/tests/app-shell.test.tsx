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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Studio Admin visual foundation', () => {
  it('maps primary actions to orange and verified states to green', () => {
    const { getByTestId } = render(
      <AppShell
        brand="SHUNYA Recovery"
        collapsed={false}
        onCollapsedChange={() => undefined}
        header={<span>Cases</span>}
        navigation={navigation}
        footer={<span>Source writes blocked</span>}
      >
        <p>Recovery cases</p>
      </AppShell>,
    );
    const styles = getComputedStyle(getByTestId('app-shell'));

    expect(styles.getPropertyValue('--accent-primary').trim()).toBe('#f56600');
    expect(styles.getPropertyValue('--status-success').trim()).toBe('#2da44e');
  });

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

    const wordmark = screen.getByLabelText('SHUNYA Recovery');
    expect(wordmark).toHaveClass('app-shell__brand-wordmark');
    expect(wordmark.querySelector('strong')).toHaveTextContent('SHUNYA');
    expect(wordmark.querySelector('small')).toHaveTextContent('Recovery');
    expect(screen.getByRole('navigation', { name: 'Case navigation' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: /Memory Analysis/ })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Volatility is unavailable.')).toBeVisible();
    expect(screen.getByRole('banner')).toHaveAttribute('data-height', '64');
    expect(screen.getByText('Case content')).toBeVisible();
    expect(screen.getByText('Case 1')).toBeVisible();

    const collapse = screen.getByRole('button', { name: 'Collapse sidebar' });
    expect(collapse).toHaveAttribute('aria-controls', 'app-sidebar-navigation');
    expect(collapse).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(collapse);
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
    expect(view.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute('aria-expanded', 'false');
    expect(view.getByRole('link', { name: 'Overview' })).toHaveAccessibleName('Overview');
  });

  it('reports the rail as collapsed when the responsive breakpoint collapses it', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      media: '(max-width: 760px)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));

    const view = render(
      <AppShell
        brand="SHUNYA Recovery"
        collapsed={false}
        onCollapsedChange={() => undefined}
        header={<span>Overview</span>}
        navigation={navigation}
        footer={<span>Case 1</span>}
      >
        <p>Case content</p>
      </AppShell>,
    );

    expect(view.getByTestId('app-shell')).toHaveAttribute('data-collapsed', 'true');
    expect(view.getByRole('button', { name: 'Sidebar collapsed for this window width' })).toHaveAttribute('aria-expanded', 'false');
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
