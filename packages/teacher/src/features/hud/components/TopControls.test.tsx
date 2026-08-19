import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TopControls from './TopControls';

vi.mock('@shared/hooks/useWorkspace', () => ({
  useWorkspace: () => ({ scale: 1, setScale: vi.fn() }),
  useServerConnection: () => ({ connected: true }),
  useBottomBar: () => ({ showClock: false })
}));

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => ({ sessionCode: null })
}));

vi.mock('../../../store/workspaceStore.simple', () => ({
  useWorkspaceStore: (selector: (state: { layoutFormat: 'canvas' }) => unknown) => (
    selector({ layoutFormat: 'canvas' })
  )
}));

vi.mock('../../workspace', () => ({
  WorkspaceSwitcher: () => null
}));

vi.mock('@shared/hooks/useHudProximity', () => ({
  useHudProximityContext: () => ({
    isNear: { topLeft: false, topRight: false },
    registerHudElement: vi.fn()
  })
}));

describe('TopControls', () => {
  it('shows the compact action in the hideable top controls when provided', () => {
    const onSwitchToCompact = vi.fn();

    render(<TopControls onSwitchToCompact={onSwitchToCompact} />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to compact overlay' }));

    expect(onSwitchToCompact).toHaveBeenCalledOnce();
  });

  it('omits the compact action outside the macOS canvas', () => {
    render(<TopControls />);

    expect(screen.queryByRole('button', { name: 'Switch to compact overlay' })).not.toBeInTheDocument();
  });
});
