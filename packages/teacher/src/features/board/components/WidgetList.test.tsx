import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WidgetType } from '@shared/types';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';
import { CanvasWidgetList, ColumnWidgetList } from './WidgetList';

vi.mock('../../widgets/shared/WidgetWrapper', () => ({
  default: ({ widgetId, children }: { widgetId: string; children: React.ReactNode }) => (
    <div data-testid="canvas-wrapper" data-widget-id={widgetId}>{children}</div>
  )
}));

vi.mock('../../widgets/shared/ColumnWidgetWrapper', () => ({
  default: ({ widgetId, children }: { widgetId: string; children: React.ReactNode }) => (
    <div data-testid="column-wrapper" data-widget-id={widgetId}>{children}</div>
  )
}));

vi.mock('../../../services/WidgetRegistry', () => ({
  widgetRegistry: {
    get: vi.fn(() => ({
      name: 'Test Widget',
      component: ({ widgetId }: { widgetId: string }) => (
        <div data-testid="widget-body" data-widget-id={widgetId} />
      )
    }))
  }
}));

const widgetIdsFor = (testId: string) =>
  screen.queryAllByTestId(testId).map((el) => el.getAttribute('data-widget-id'));

describe('WidgetList layouts', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      widgets: [
        { id: 'timer-1', type: WidgetType.TIMER, position: { x: 0, y: 0 }, size: { width: 350, height: 415 }, zIndex: 0 },
        { id: 'stamp-1', type: WidgetType.STAMP, position: { x: 10, y: 10 }, size: { width: 60, height: 60 }, zIndex: 1 }
      ],
      widgetStates: new Map(),
      focusedWidgetId: null
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders every widget including stamps in the canvas layout', () => {
    render(<CanvasWidgetList dashboardVisible />);

    expect(widgetIdsFor('widget-body')).toEqual(['timer-1', 'stamp-1']);
  });

  it('excludes stamps from the column layout', () => {
    render(<ColumnWidgetList dashboardVisible />);

    expect(widgetIdsFor('widget-body')).toEqual(['timer-1']);
  });

  it('mounts the canvas wrapper for the canvas layout', () => {
    render(<CanvasWidgetList dashboardVisible />);

    expect(widgetIdsFor('canvas-wrapper')).toEqual(['timer-1', 'stamp-1']);
    expect(screen.queryAllByTestId('column-wrapper')).toHaveLength(0);
  });

  it('mounts the column wrapper for the column layout', () => {
    render(<ColumnWidgetList dashboardVisible />);

    expect(widgetIdsFor('column-wrapper')).toEqual(['timer-1']);
    expect(screen.queryAllByTestId('canvas-wrapper')).toHaveLength(0);
  });
});
