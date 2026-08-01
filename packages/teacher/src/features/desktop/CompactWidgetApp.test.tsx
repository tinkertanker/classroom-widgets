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

const snapshot = (
  state: CompactWidgetSnapshot['state'],
  revision = 1,
  stateRevision = revision
): CompactWidgetSnapshot => ({
  schemaVersion: 1,
  workspaceId: 'workspace-1',
  revision,
  stateRevision,
  widgetId: 'timer-1',
  widgetType: WidgetType.TIMER,
  title: 'Timer',
  preferredSize: { width: 350, height: 415 },
  minimumSize: { width: 250, height: 306 },
  maximumSize: null,
  isResizable: true,
  maintainsAspectRatio: true,
  state,
  theme: 'light',
  savedRandomiserLists: []
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

  it('ignores snapshots that arrive out of revision order', async () => {
    const StateProbe = ({ savedState }: ProbeWidgetProps) => (
      <div data-testid="saved-state">{JSON.stringify(savedState)}</div>
    );
    vi.mocked(widgetRegistry.get).mockReturnValue(panelConfig(StateProbe));
    render(<CompactWidgetApp />);

    act(() => {
      window.classroomWidgetPanel?.receiveSnapshot(snapshot({ elapsed: 10 }, 2));
      window.classroomWidgetPanel?.receiveSnapshot(snapshot({ elapsed: 5 }, 1));
    });

    expect(await screen.findByTestId('saved-state')).toHaveTextContent('{"elapsed":10}');
  });

  it('routes saved Randomiser collections through the native panel bridge', () => {
    const list = {
      id: 'saved-1',
      name: 'Class names',
      type: 'randomiser' as const,
      choices: ['Ada', 'Bea'],
      createdAt: 1,
      updatedAt: 1
    };
    vi.mocked(widgetRegistry.get).mockReturnValue(panelConfig(() => null));
    render(<CompactWidgetApp />);
    act(() => window.classroomWidgetPanel?.receiveSnapshot({
      ...snapshot(null),
      widgetType: WidgetType.RANDOMISER,
      savedRandomiserLists: [list]
    }));

    expect(window.classroomWidgetPanel?.getRandomiserLists()).toEqual([list]);
    window.classroomWidgetPanel?.saveRandomiserList('New list', ['Cora']);
    window.classroomWidgetPanel?.deleteRandomiserList('saved-1');

    expect(panelPostMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'randomiser-list-save',
      widgetId: 'timer-1',
      name: 'New list',
      choices: ['Cora']
    }));
    expect(panelPostMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'randomiser-list-delete',
      widgetId: 'timer-1',
      id: 'saved-1'
    }));
  });

  it('queues a second rapid edit until the first edit is acknowledged', async () => {
    const EditingProbe = ({ onStateChange }: ProbeWidgetProps) => (
      <>
        <button type="button" onClick={() => onStateChange?.({ elapsed: 1 })}>First</button>
        <button type="button" onClick={() => onStateChange?.({ elapsed: 2 })}>Second</button>
      </>
    );
    vi.mocked(widgetRegistry.get).mockReturnValue(panelConfig(EditingProbe));
    render(<CompactWidgetApp />);
    act(() => window.classroomWidgetPanel?.receiveSnapshot(snapshot({ elapsed: 0 }, 1)));

    fireEvent.click(await screen.findByRole('button', { name: 'First' }));
    fireEvent.click(screen.getByRole('button', { name: 'Second' }));
    expect(panelPostMessage.mock.calls.filter(([message]) => message.type === 'panel-state-change')).toEqual([
      [expect.objectContaining({ baseRevision: 1, state: { elapsed: 1 } })]
    ]);

    act(() => window.classroomWidgetPanel?.receiveSnapshot(snapshot({ elapsed: 1 }, 2)));
    expect(panelPostMessage.mock.calls.filter(([message]) => message.type === 'panel-state-change')).toEqual([
      [expect.objectContaining({ baseRevision: 1, state: { elapsed: 1 } })],
      [expect.objectContaining({ baseRevision: 2, state: { elapsed: 2 } })]
    ]);
  });

  it('flushes the latest queued edit before native destroys the panel', async () => {
    const EditingProbe = ({ onStateChange }: ProbeWidgetProps) => (
      <>
        <button type="button" onClick={() => onStateChange?.({ elapsed: 1 })}>First</button>
        <button type="button" onClick={() => onStateChange?.({ elapsed: 2 })}>Second</button>
      </>
    );
    vi.mocked(widgetRegistry.get).mockReturnValue(panelConfig(EditingProbe));
    render(<CompactWidgetApp />);
    act(() => window.classroomWidgetPanel?.receiveSnapshot(snapshot({ elapsed: 0 }, 1)));

    fireEvent.click(await screen.findByRole('button', { name: 'First' }));
    fireEvent.click(screen.getByRole('button', { name: 'Second' }));
    let pendingState: ReturnType<NonNullable<typeof window.classroomWidgetPanel>['takePendingState']>;
    act(() => {
      pendingState = window.classroomWidgetPanel?.takePendingState() ?? null;
    });

    expect(pendingState!).toEqual(expect.objectContaining({
      baseRevision: 1,
      state: { elapsed: 2 },
      flush: true
    }));
    expect(panelPostMessage.mock.calls.filter(([message]) => message.type === 'panel-state-change')).toEqual([
      [expect.objectContaining({ baseRevision: 1, state: { elapsed: 1 } })]
    ]);
  });

  it('does not treat a metadata-only snapshot as a state acknowledgement', async () => {
    const EditingProbe = ({ onStateChange }: ProbeWidgetProps) => (
      <>
        <button type="button" onClick={() => onStateChange?.({ elapsed: 1 })}>First</button>
        <button type="button" onClick={() => onStateChange?.({ elapsed: 2 })}>Second</button>
      </>
    );
    vi.mocked(widgetRegistry.get).mockReturnValue(panelConfig(EditingProbe));
    render(<CompactWidgetApp />);
    act(() => window.classroomWidgetPanel?.receiveSnapshot(snapshot({ elapsed: 0 }, 1, 1)));

    fireEvent.click(await screen.findByRole('button', { name: 'First' }));
    act(() => window.classroomWidgetPanel?.receiveSnapshot({
      ...snapshot({ elapsed: 0 }, 2, 1),
      theme: 'dark'
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Second' }));
    expect(panelPostMessage.mock.calls.filter(([message]) => message.type === 'panel-state-change')).toEqual([
      [expect.objectContaining({ baseRevision: 1, state: { elapsed: 1 } })]
    ]);

    act(() => window.classroomWidgetPanel?.receiveSnapshot(snapshot({ elapsed: 1 }, 3, 3)));
    expect(panelPostMessage.mock.calls.filter(([message]) => message.type === 'panel-state-change')).toEqual([
      [expect.objectContaining({ baseRevision: 1, state: { elapsed: 1 } })],
      [expect.objectContaining({ baseRevision: 3, state: { elapsed: 2 } })]
    ]);
  });

  it('drops an intermediate queued edit when the latest state matches the in-flight edit', async () => {
    const EditingProbe = ({ onStateChange }: ProbeWidgetProps) => (
      <>
        <button type="button" onClick={() => onStateChange?.({ elapsed: 1 })}>One</button>
        <button type="button" onClick={() => onStateChange?.({ elapsed: 2 })}>Two</button>
      </>
    );
    vi.mocked(widgetRegistry.get).mockReturnValue(panelConfig(EditingProbe));
    render(<CompactWidgetApp />);
    act(() => window.classroomWidgetPanel?.receiveSnapshot(snapshot({ elapsed: 0 }, 1)));

    fireEvent.click(await screen.findByRole('button', { name: 'One' }));
    fireEvent.click(screen.getByRole('button', { name: 'Two' }));
    fireEvent.click(screen.getByRole('button', { name: 'One' }));
    act(() => window.classroomWidgetPanel?.receiveSnapshot(snapshot({ elapsed: 1 }, 2)));

    expect(panelPostMessage.mock.calls.filter(([message]) => message.type === 'panel-state-change')).toEqual([
      [expect.objectContaining({ baseRevision: 1, state: { elapsed: 1 } })]
    ]);
  });

  it('keeps queued state optimistic while acknowledging rapid edits', async () => {
    const PersistingProbe = ({ savedState, onStateChange }: ProbeWidgetProps) => {
      const [state, setState] = useState(savedState);
      useEffect(() => setState(savedState), [savedState]);
      useEffect(() => onStateChange?.(state), [onStateChange, state]);
      return <button type="button" onClick={() => setState({ elapsed: (state as { elapsed: number }).elapsed + 1 })}>Increment</button>;
    };
    vi.mocked(widgetRegistry.get).mockReturnValue(panelConfig(PersistingProbe));
    render(<CompactWidgetApp />);
    act(() => window.classroomWidgetPanel?.receiveSnapshot(snapshot({ elapsed: 0 }, 1)));

    const button = await screen.findByRole('button', { name: 'Increment' });
    fireEvent.click(button);
    fireEvent.click(button);
    act(() => window.classroomWidgetPanel?.receiveSnapshot(snapshot({ elapsed: 1 }, 2)));
    act(() => window.classroomWidgetPanel?.receiveSnapshot(snapshot({ elapsed: 2 }, 3)));

    expect(panelPostMessage.mock.calls.filter(([message]) => message.type === 'panel-state-change')).toEqual([
      [expect.objectContaining({ baseRevision: 1, state: { elapsed: 1 } })],
      [expect.objectContaining({ baseRevision: 2, state: { elapsed: 2 } })]
    ]);
  });
});
