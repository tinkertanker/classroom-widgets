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
    const timerRevision = firstInventory.widgets.find((widget: { widgetId: string }) => widget.widgetId === 'timer-1').revision;

    act(() => {
      useWorkspaceStore.setState({ widgetStates: new Map([
        ['timer-1', { timer: { time: 10 } }],
        ['qr-1', { text: 'second' }]
      ]) });
    });

    await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(2));
    const secondInventory = postMessage.mock.calls[1][0];
    expect(secondInventory.widgets.find((widget: { widgetId: string }) => widget.widgetId === 'timer-1').revision).toBe(timerRevision);
    expect(secondInventory.widgets.find((widget: { widgetId: string }) => widget.widgetId === 'qr-1').revision).toBeGreaterThan(timerRevision);
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

  it('adds a supported widget without opening Canvas', () => {
    render(<CompactPanelHost />);

    act(() => {
      expect(window.classroomPanelHost?.addWidget(WidgetType.LIST)).toBe(true);
    });

    expect(useWorkspaceStore.getState().widgets).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: WidgetType.LIST })
    ]));
  });

  it('removes a widget when its native panel closes', () => {
    render(<CompactPanelHost />);

    act(() => {
      expect(window.classroomPanelHost?.removeWidget('timer-1')).toBe(true);
    });

    expect(useWorkspaceStore.getState().widgets).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'timer-1' })
    ]));
  });
});
