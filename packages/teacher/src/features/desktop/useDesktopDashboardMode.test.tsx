import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDesktopDashboardMode } from './useDesktopDashboardMode';

describe('useDesktopDashboardMode', () => {
  const postMessage = vi.fn();

  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, '', '/?dashboard=1&mode=compact');
    Object.defineProperty(window, 'webkit', {
      configurable: true,
      value: {
        messageHandlers: {
          classroomDashboard: { postMessage }
        }
      }
    });
  });

  afterEach(() => {
    postMessage.mockReset();
    window.history.replaceState({}, '', '/');
    delete window.classroomDashboard;
    Object.defineProperty(window, 'webkit', {
      configurable: true,
      value: undefined
    });
  });

  it('starts the native app in compact mode and accepts native mode updates', () => {
    const { result } = renderHook(() => useDesktopDashboardMode());

    expect(result.current.windowMode).toBe('compact');

    act(() => {
      window.classroomDashboard?.setWindowMode('canvas');
    });

    expect(result.current.windowMode).toBe('canvas');
    expect(document.documentElement).toHaveClass('desktop-dashboard-canvas');
  });

  it('requests a native window mode change while updating immediately', () => {
    const { result } = renderHook(() => useDesktopDashboardMode());

    act(() => {
      result.current.requestWindowMode('canvas');
    });

    expect(result.current.windowMode).toBe('canvas');
    expect(postMessage).toHaveBeenCalledWith({
      type: 'window-mode-requested',
      mode: 'canvas'
    });
  });

  it('persists the compact row or column arrangement', () => {
    const { result } = renderHook(() => useDesktopDashboardMode());

    act(() => {
      result.current.setCompactLayout('column');
    });

    expect(result.current.compactLayout).toBe('column');
    expect(window.localStorage.getItem('classroom-dashboard-compact-layout')).toBe('column');
    expect(document.documentElement).toHaveClass('desktop-dashboard-widget-column');
  });

  it('accepts native compact background opacity updates', () => {
    const { result } = renderHook(() => useDesktopDashboardMode());

    act(() => {
      window.classroomDashboard?.setBackgroundOpacity(0.35);
    });

    expect(result.current.backgroundOpacity).toBe(0.35);
    expect(document.documentElement.style.getPropertyValue('--desktop-dashboard-background-opacity')).toBe('0.35');
  });

  it('hides compact window chrome when requested by the native shell', () => {
    const { result } = renderHook(() => useDesktopDashboardMode());

    act(() => {
      window.classroomDashboard?.setWindowChromeVisible(false);
    });

    expect(result.current.windowMode).toBe('compact');
    expect(document.documentElement).toHaveClass('desktop-dashboard-chrome-hidden');
    expect(window.classroomDashboard?.isWindowChromeVisible()).toBe(false);
  });
});
