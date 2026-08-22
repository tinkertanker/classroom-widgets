import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WidgetType } from '@shared/types';
import { useWorkspaceStore } from '../../store/workspaceStore.simple';
import CompactPanelHost from './CompactPanelHost';

describe('CompactPanelHost', () => {
  const postMessage = vi.fn();

  beforeEach(() => {
    postMessage.mockReset();
    window.webkit = { messageHandlers: { classroomDashboard: { postMessage } } };
    useWorkspaceStore.setState({
      currentWorkspaceId: 'workspace-1',
      widgets: [
        {
          id: 'timer-1',
          type: WidgetType.TIMER,
          position: { x: 0, y: 0 },
          size: { width: 350, height: 415 },
          zIndex: 0
        }
      ],
      widgetStates: new Map([['timer-1', { timer: { time: 10 } }]]),
      theme: 'light'
    });
  });

  afterEach(() => {
    delete window.classroomPanelHost;
    delete window.webkit;
    vi.restoreAllMocks();
  });

  it('publishes eligible widgets as native panel snapshots', async () => {
    render(<CompactPanelHost />);

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'widget-panels-changed',
        schemaVersion: 1,
        hostInstanceId: expect.any(String),
        inventoryRevision: 1,
        widgets: [expect.objectContaining({
          widgetId: 'timer-1',
          title: 'Timer',
          workspaceId: 'workspace-1',
          preferredSize: { width: 350, height: 415 },
          minimumSize: { width: 250, height: 306 },
          maximumSize: null,
          isResizable: true,
          maintainsAspectRatio: true
        })],
        compactWidgetOptions: expect.arrayContaining([
          { widgetType: WidgetType.QRCODE, title: 'QR Code' },
          { widgetType: WidgetType.SOUND_EFFECTS, title: 'Sound Effects' },
          { widgetType: WidgetType.TASK_CUE, title: 'Task Cue' },
          { widgetType: WidgetType.TRAFFIC_LIGHT, title: 'Traffic Light' },
          { widgetType: WidgetType.TEXT_BANNER, title: 'Text Banner' }
        ])
      }));
    });
  });

  it('publishes the effective dashboard theme and updates on appearance changes', async () => {
    const { rerender } = render(<CompactPanelHost dashboardTheme="dark" />);
    await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1));
    expect(postMessage.mock.calls[0][0].widgets[0].theme).toBe('dark');
    const stateRevision = postMessage.mock.calls[0][0].widgets[0].stateRevision;

    rerender(<CompactPanelHost dashboardTheme="light" />);
    await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(2));
    expect(postMessage.mock.calls[1][0].widgets[0].theme).toBe('light');
    expect(postMessage.mock.calls[1][0].widgets[0].stateRevision).toBe(stateRevision);
  });

  it('publishes fixed size and aspect ratio constraints for Task Cue', async () => {
    useWorkspaceStore.setState({
      widgets: [{
        id: 'task-cue-1',
        type: WidgetType.TASK_CUE,
        position: { x: 0, y: 0 },
        size: { width: 325, height: 325 },
        zIndex: 0
      }],
      widgetStates: new Map()
    });

    render(<CompactPanelHost />);

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
        widgets: [expect.objectContaining({
          widgetId: 'task-cue-1',
          maximumSize: { width: 325, height: 325 },
          isResizable: false,
          maintainsAspectRatio: true
        })]
      }));
    });
  });

  it('publishes Randomiser panels as freely resizable', async () => {
    useWorkspaceStore.setState({
      widgets: [{
        id: 'randomiser-1',
        type: WidgetType.RANDOMISER,
        position: { x: 0, y: 0 },
        size: { width: 350, height: 250 },
        zIndex: 0
      }],
      widgetStates: new Map()
    });

    render(<CompactPanelHost />);

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
        widgets: [expect.objectContaining({
          widgetId: 'randomiser-1',
          preferredSize: { width: 350, height: 250 },
          minimumSize: { width: 250, height: 180 },
          maximumSize: null,
          isResizable: true,
          maintainsAspectRatio: false
        })]
      }));
    });
  });

  it('publishes an empty inventory with a newer revision from the same host', async () => {
    render(<CompactPanelHost />);

    await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1));
    const firstInventory = postMessage.mock.calls[0][0];

    act(() => {
      useWorkspaceStore.setState({ widgets: [] });
    });

    await waitFor(() => {
      const latestInventory = postMessage.mock.calls[postMessage.mock.calls.length - 1][0];
      expect(latestInventory).toEqual(expect.objectContaining({
        hostInstanceId: firstInventory.hostInstanceId,
        inventoryRevision: firstInventory.inventoryRevision + 1,
        widgets: []
      }));
    });
  });

  it('does not republish inventory when only a non-compact widget changes', async () => {
    render(<CompactPanelHost />);
    await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1));

    act(() => {
      useWorkspaceStore.setState({
        widgets: [
          ...useWorkspaceStore.getState().widgets,
          { id: 'poll-1', type: WidgetType.POLL, position: { x: 0, y: 0 }, size: { width: 400, height: 400 }, zIndex: 1 }
        ],
        widgetStates: new Map([
          ['timer-1', { timer: { time: 10 } }],
          ['poll-1', { votes: [1] }]
        ])
      });
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  it('preserves an unchanged widget revision when another widget changes', async () => {
    useWorkspaceStore.setState({
      widgets: [
        ...useWorkspaceStore.getState().widgets,
        { id: 'qr-1', type: WidgetType.QRCODE, position: { x: 0, y: 0 }, size: { width: 350, height: 415 }, zIndex: 1 }
      ],
      widgetStates: new Map([
        ['timer-1', { timer: { time: 10 } }],
        ['qr-1', { text: 'first' }]
      ])
    });
    render(<CompactPanelHost />);
    await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1));
    const firstInventory = postMessage.mock.calls[0][0];
    const timerSnapshot = firstInventory.widgets.find((widget: { widgetId: string }) => widget.widgetId === 'timer-1');
    const qrSnapshot = firstInventory.widgets.find((widget: { widgetId: string }) => widget.widgetId === 'qr-1');

    act(() => {
      useWorkspaceStore.setState({ widgetStates: new Map([
        ['timer-1', { timer: { time: 10 } }],
        ['qr-1', { text: 'second' }]
      ]) });
    });

    await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(2));
    const secondInventory = postMessage.mock.calls[1][0];
    const secondTimer = secondInventory.widgets.find((widget: { widgetId: string }) => widget.widgetId === 'timer-1');
    const secondQr = secondInventory.widgets.find((widget: { widgetId: string }) => widget.widgetId === 'qr-1');
    expect(secondTimer.revision).toBe(timerSnapshot.revision);
    expect(secondTimer.stateRevision).toBe(timerSnapshot.stateRevision);
    expect(secondQr.revision).toBe(qrSnapshot.revision);
    expect(secondQr.stateRevision).toBeGreaterThan(qrSnapshot.stateRevision);
  });

  it('starts a new host instance when the dashboard host reloads', async () => {
    const { unmount } = render(<CompactPanelHost />);

    await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1));
    const firstInventory = postMessage.mock.calls[0][0];
    unmount();

    render(<CompactPanelHost />);

    await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(2));
    const secondInventory = postMessage.mock.calls[1][0];
    expect(secondInventory.inventoryRevision).toBe(1);
    expect(secondInventory.hostInstanceId).not.toBe(firstInventory.hostInstanceId);
  });

  it('applies a panel state change to the authoritative workspace store', () => {
    render(<CompactPanelHost />);

    act(() => {
      window.classroomPanelHost?.applyStateChange({
        schemaVersion: 1,
        widgetId: 'timer-1',
        baseRevision: 1,
        state: { timer: { time: 25 } }
      });
    });

    expect(useWorkspaceStore.getState().widgetStates.get('timer-1')).toEqual({ timer: { time: 25 } });
  });

  it('rejects a panel state change based on a stale snapshot revision', async () => {
    render(<CompactPanelHost />);
    await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1));

    act(() => {
      expect(window.classroomPanelHost?.applyStateChange({
        schemaVersion: 1,
        widgetId: 'timer-1',
        baseRevision: 0,
        state: { timer: { time: 25 } }
      })).toBe(false);
    });

    expect(useWorkspaceStore.getState().widgetStates.get('timer-1')).toEqual({ timer: { time: 10 } });
  });

  it('accepts a final queued state flush while the panel is closing', async () => {
    render(<CompactPanelHost />);
    await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1));

    act(() => {
      expect(window.classroomPanelHost?.applyStateChange({
        schemaVersion: 1,
        widgetId: 'timer-1',
        baseRevision: 0,
        state: { timer: { time: 25 } },
        flush: true
      })).toBe(true);
    });

    expect(useWorkspaceStore.getState().widgetStates.get('timer-1')).toEqual({ timer: { time: 25 } });
  });

  it('only accepts a state change for a concurrently removed widget when it is a final flush', () => {
    render(<CompactPanelHost />);
    const change = {
      schemaVersion: 1 as const,
      widgetId: 'removed-widget',
      baseRevision: 1,
      state: { timer: { time: 0 } }
    };

    expect(window.classroomPanelHost?.applyStateChange(change)).toBe(false);
    expect(window.classroomPanelHost?.applyStateChange({ ...change, flush: true })).toBe(true);
    expect(useWorkspaceStore.getState().widgetStates.has('removed-widget')).toBe(false);
  });

  it('reserves state revisions synchronously when applying panel changes', async () => {
    render(<CompactPanelHost />);
    await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1));
    const firstChange = {
      schemaVersion: 1 as const,
      widgetId: 'timer-1',
      baseRevision: 1,
      state: { timer: { time: 20 } }
    };

    expect(window.classroomPanelHost?.applyStateChange(firstChange)).toBe(true);
    expect(window.classroomPanelHost?.applyStateChange({
      ...firstChange,
      state: { timer: { time: 21 } }
    })).toBe(false);
    expect(window.classroomPanelHost?.applyStateChange({
      ...firstChange,
      baseRevision: 0,
      state: { timer: { time: 25 } },
      flush: true
    })).toBe(true);
    expect(window.classroomPanelHost?.applyStateChange(firstChange)).toBe(false);
    expect(useWorkspaceStore.getState().widgetStates.get('timer-1')).toEqual({ timer: { time: 25 } });
  });

  it('applies Randomiser collection changes to the authoritative workspace store', () => {
    useWorkspaceStore.setState({
      widgets: [{
        id: 'randomiser-1',
        type: WidgetType.RANDOMISER,
        position: { x: 0, y: 0 },
        size: { width: 350, height: 415 },
        zIndex: 0
      }]
    });
    const saveRandomiserList = vi.spyOn(useWorkspaceStore.getState(), 'saveRandomiserList').mockReturnValue('saved-1');
    const deleteRandomiserList = vi.spyOn(useWorkspaceStore.getState(), 'deleteRandomiserList').mockImplementation(() => undefined);
    render(<CompactPanelHost />);

    expect(window.classroomPanelHost?.applyRandomiserListChange({
      type: 'randomiser-list-save',
      schemaVersion: 1,
      widgetId: 'randomiser-1',
      name: 'Class names',
      choices: ['Ada', 'Bea']
    })).toBe(true);
    expect(saveRandomiserList).toHaveBeenCalledWith('Class names', ['Ada', 'Bea']);

    expect(window.classroomPanelHost?.applyRandomiserListChange({
      type: 'randomiser-list-delete',
      schemaVersion: 1,
      widgetId: 'randomiser-1',
      id: 'saved-1'
    })).toBe(true);
    expect(deleteRandomiserList).toHaveBeenCalledWith('saved-1');
  });

  it('adds a supported widget without opening Canvas', () => {
    render(<CompactPanelHost />);

    act(() => {
      expect(window.classroomPanelHost?.addWidget(WidgetType.LIST)).toBe(true);
    });

    expect(useWorkspaceStore.getState().widgets).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: WidgetType.LIST })
    ]));
  });

  it('removes a widget when native requests panel removal', () => {
    render(<CompactPanelHost />);

    act(() => {
      expect(window.classroomPanelHost?.removeWidget('timer-1')).toBe(true);
    });

    expect(useWorkspaceStore.getState().widgets).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'timer-1' })
    ]));
  });
});
