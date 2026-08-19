import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHoverDelay } from './useHoverDelay';

// The two delays the widget wrappers ship with; they are deliberately different.
const CANVAS_DELAY = 2000;
const COLUMN_DELAY = 1000;

describe('useHoverDelay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts hidden and shows immediately on mouse enter', () => {
    const { result } = renderHook(() => useHoverDelay(CANVAS_DELAY));

    expect(result.current.visible).toBe(false);

    act(() => result.current.onMouseEnter());

    expect(result.current.visible).toBe(true);
  });

  it.each([
    ['canvas', CANVAS_DELAY],
    ['column', COLUMN_DELAY]
  ])('hides %s widgets exactly %dms after mouse leave', (_name, delay) => {
    const { result } = renderHook(() => useHoverDelay(delay as number));

    act(() => result.current.onMouseEnter());
    act(() => result.current.onMouseLeave());

    // Still visible right up to the last tick before the delay elapses
    act(() => void vi.advanceTimersByTime((delay as number) - 1));
    expect(result.current.visible).toBe(true);

    act(() => void vi.advanceTimersByTime(1));
    expect(result.current.visible).toBe(false);
  });

  it('keeps the shorter column delay from hiding a canvas widget early', () => {
    const { result } = renderHook(() => useHoverDelay(CANVAS_DELAY));

    act(() => result.current.onMouseEnter());
    act(() => result.current.onMouseLeave());

    act(() => void vi.advanceTimersByTime(COLUMN_DELAY));
    expect(result.current.visible).toBe(true);
  });

  it('cancels a pending hide when the pointer re-enters before it fires', () => {
    const { result } = renderHook(() => useHoverDelay(COLUMN_DELAY));

    act(() => result.current.onMouseEnter());
    act(() => result.current.onMouseLeave());
    act(() => void vi.advanceTimersByTime(COLUMN_DELAY - 100));

    act(() => result.current.onMouseEnter());
    expect(result.current.visible).toBe(true);

    // The originally scheduled hide must not fire at its old deadline, nor later
    act(() => void vi.advanceTimersByTime(COLUMN_DELAY * 5));
    expect(result.current.visible).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('restarts the full delay when the pointer leaves again', () => {
    const { result } = renderHook(() => useHoverDelay(COLUMN_DELAY));

    act(() => result.current.onMouseEnter());
    act(() => result.current.onMouseLeave());
    act(() => void vi.advanceTimersByTime(COLUMN_DELAY - 100));
    act(() => result.current.onMouseEnter());
    act(() => result.current.onMouseLeave());

    act(() => void vi.advanceTimersByTime(COLUMN_DELAY - 1));
    expect(result.current.visible).toBe(true);

    act(() => void vi.advanceTimersByTime(1));
    expect(result.current.visible).toBe(false);
  });

  it('leaves no pending timer, and no state update, after unmount', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result, unmount } = renderHook(() => useHoverDelay(CANVAS_DELAY));

    act(() => result.current.onMouseEnter());
    act(() => result.current.onMouseLeave());
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);

    // Nothing left to fire, so no update-on-unmounted-component or act() warning.
    // Compare against the count so far rather than zero, so unrelated warnings
    // logged during setup (e.g. React's act deprecation notice) can't mask this.
    const errorsBefore = consoleError.mock.calls.length;
    act(() => void vi.advanceTimersByTime(CANVAS_DELAY * 2));
    expect(consoleError.mock.calls.length).toBe(errorsBefore);

    consoleError.mockRestore();
  });
});
