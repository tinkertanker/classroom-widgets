import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WidgetType } from '@shared/types';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';
import WidgetWrapper from './WidgetWrapper';
import ColumnWidgetWrapper from './ColumnWidgetWrapper';

describe.each([['canvas', WidgetWrapper], ['column', ColumnWidgetWrapper]] as const)('%s widget chrome', (_, Wrapper) => {
  beforeEach(() => {
    vi.useFakeTimers();
    useWorkspaceStore.setState({
      widgets: [{ id: 'first', type: WidgetType.TEXT_BANNER,
        position: { x: 0, y: 0 }, size: { width: 400, height: 300 }, zIndex: 0 }],
      widgetStates: new Map()
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    window.history.replaceState({}, '', '/');
  });

  it('shares a two-second hover clock for footer and trash without a toggle', () => {
    render(<Wrapper widgetId="first"><div data-widget-controls>Footer</div></Wrapper>);
    const footer = screen.getByText('Footer');
    const chrome = footer.closest('[data-web-chrome-visible]')!;
    expect(chrome).toHaveAttribute('data-web-chrome-visible', 'false');
    expect(chrome).toContainElement(screen.getByRole('button', { name: 'Delete widget' }));
    expect(screen.queryByRole('button', { name: 'Show controls' })).toBeNull();
    fireEvent.mouseEnter(footer);
    expect(chrome).toHaveAttribute('data-web-chrome-visible', 'true');
    fireEvent.mouseLeave(footer);
    act(() => vi.advanceTimersByTime(1999));
    expect(chrome).toHaveAttribute('data-web-chrome-visible', 'true');
    act(() => vi.advanceTimersByTime(1));
    expect(chrome).toHaveAttribute('data-web-chrome-visible', 'false');
    fireEvent.mouseEnter(footer);
    fireEvent.mouseLeave(footer);
    act(() => vi.advanceTimersByTime(1000));
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Delete widget' }));
    act(() => vi.advanceTimersByTime(3000));
    expect(chrome).toHaveAttribute('data-web-chrome-visible', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Delete widget' }));
    expect(useWorkspaceStore.getState().widgets).toHaveLength(0);
  });

  it('leaves Mac dashboard visibility independent', () => {
    window.history.replaceState({}, '', '/?dashboard=1');
    render(<Wrapper widgetId="first"><div data-widget-controls>Footer</div></Wrapper>);
    expect(screen.getByText('Footer').closest('[data-web-chrome-visible]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Close widget' })).toBeInTheDocument();
  });
});
