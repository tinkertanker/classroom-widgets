import React, { useEffect, useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompactWidgetSnapshot } from '@shared/types/compactPanel';
import { WidgetType } from '@shared/types';
import type { WidgetConfig } from '@shared/types';
import CompactWidgetApp from './CompactWidgetApp';
import { widgetRegistry } from '../../services/WidgetRegistry';

vi.mock('../../services/WidgetRegistry', () => ({
  widgetRegistry: { get: vi.fn() }
}));

vi.mock('../../contexts/ModalContext', () => ({
  ModalProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock('../../contexts/ConfettiContext', () => ({
  ConfettiProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock('@shared/components/ErrorBoundary', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

interface ProbeWidgetProps {
  savedState?: unknown;
  onStateChange?: (state: unknown) => void;
}

const snapshot = (state: CompactWidgetSnapshot['state'], revision = 1): CompactWidgetSnapshot => ({
  schemaVersion: 1,
  workspaceId: 'workspace-1',
  revision,
  widgetId: 'timer-1',
  widgetType: WidgetType.TIMER,
  title: 'Timer',
  preferredSize: { width: 350, height: 415 },
  minimumSize: { width: 250, height: 306 },
  maximumSize: null,
  isResizable: true,
  maintainsAspectRatio: true,
  state,
  theme: 'light'
});

const panelConfig = (component: React.ComponentType<ProbeWidgetProps>): WidgetConfig => ({
  type: WidgetType.TIMER,
  name: 'Timer',
  icon: () => null,
  component,
  defaultSize: { width: 350, height: 415 },
  compactPanel: { supported: true }
});

describe('CompactWidgetApp', () => {
  const panelPostMessage = vi.fn();

  beforeEach(() => {
    window.history.replaceState({}, '', '/?widgetId=timer-1');
    panelPostMessage.mockReset();
    window.webkit = { messageHandlers: { classroomWidgetPanel: { postMessage: panelPostMessage } } };
  });

  afterEach(() => {
    cleanup();
    delete window.classroomWidgetPanel;
    delete window.webkit;
    vi.clearAllMocks();
  });

  it('treats a missing native state as undefined for widget defaults', async () => {
    const StateProbe = ({ savedState }: ProbeWidgetProps) => (
      <div data-testid="saved-state">{savedState === undefined ? 'default-state' : 'provided-state'}</div>
    );
    vi.mocked(widgetRegistry.get).mockReturnValue(panelConfig(StateProbe));

    render(<CompactWidgetApp />);

    act(() => {
      window.classroomWidgetPanel?.receiveSnapshot(snapshot(null));
    });

    expect(await screen.findByTestId('saved-state')).toHaveTextContent('default-state');
  });

  it('does not report state again when the native host echoes the snapshot back', async () => {
    const PersistingProbe = ({ savedState, onStateChange }: ProbeWidgetProps) => {
      const [state, setState] = useState(savedState);

      useEffect(() => {
        setState(savedState);
      }, [savedState]);

      useEffect(() => {
        onStateChange?.(state);
      }, [onStateChange, state]);

      return <button type="button" onClick={() => setState({ elapsed: 5 })}>Update state</button>;
    };
    vi.mocked(widgetRegistry.get).mockReturnValue(panelConfig(PersistingProbe));

    render(<CompactWidgetApp />);

    act(() => {
      window.classroomWidgetPanel?.receiveSnapshot(snapshot({ elapsed: 0 }));
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Update state' }));

    await waitFor(() => {
      expect(panelPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'panel-state-change',
        baseRevision: 1,
        state: { elapsed: 5 }
      }));
    });

    const stateChangeCount = panelPostMessage.mock.calls.filter(
      ([message]) => (message as { type?: string }).type === 'panel-state-change'
    ).length;

    act(() => {
      window.classroomWidgetPanel?.receiveSnapshot(snapshot({ elapsed: 5 }, 2));
    });

    await screen.findByRole('button', { name: 'Update state' });
    expect(panelPostMessage.mock.calls.filter(
      ([message]) => (message as { type?: string }).type === 'panel-state-change'
    )).toHaveLength(stateChangeCount);
  });
});
