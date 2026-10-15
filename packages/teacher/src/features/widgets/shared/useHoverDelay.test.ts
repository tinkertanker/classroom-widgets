import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHoverDelay } from './useHoverDelay';

// Both widget wrappers use the shared two-second timeout.
const DELAY = 2000;

describe('useHoverDelay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('restarts the full delay when the pointer leaves again', () => {
    const { result } = renderHook(() => useHoverDelay(DELAY));

    act(() => result.current.onMouseEnter());
    act(() => result.current.onMouseLeave());
    act(() => void vi.advanceTimersByTime(DELAY - 100));
    act(() => result.current.onMouseEnter());
    act(() => result.current.onMouseLeave());

    act(() => void vi.advanceTimersByTime(DELAY - 1));
    expect(result.current.visible).toBe(true);

    act(() => void vi.advanceTimersByTime(1));
    expect(result.current.visible).toBe(false);
  });

  it('leaves no pending timer after unmount', () => {
    const { result, unmount } = renderHook(() => useHoverDelay(DELAY));

    act(() => result.current.onMouseEnter());
    act(() => result.current.onMouseLeave());
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
