import React, { useRef } from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const workspaceMock = vi.hoisted(() => ({
  setScale: vi.fn(),
  value: 1
}));
const setDebugMarker = vi.fn();
const setViewportRect = vi.fn();

vi.mock('@shared/hooks/useWorkspace', () => ({
  useWorkspace: () => ({
    scale: workspaceMock.value,
    setScale: workspaceMock.setScale
  })
}));

import { useZoomWithScroll } from './useZoomWithScroll';

interface ZoomInstallerProps {
  containerRef: React.RefObject<HTMLDivElement>;
  scaleRef: React.RefObject<HTMLDivElement>;
}

const ZoomInstaller: React.FC<ZoomInstallerProps> = ({ containerRef, scaleRef }) => {
  useZoomWithScroll(containerRef, scaleRef, setDebugMarker, setViewportRect);
  return null;
};

const ZoomHarness: React.FC<{ isEnabled: boolean }> = ({ isEnabled }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef<HTMLDivElement>(null);

  return (
    <div data-testid="board" ref={containerRef}>
      <div ref={scaleRef} />
      {isEnabled && <ZoomInstaller containerRef={containerRef} scaleRef={scaleRef} />}
    </div>
  );
};

describe('useZoomWithScroll', () => {
  beforeEach(() => {
    workspaceMock.value = 1;
    workspaceMock.setScale.mockReset();
    setDebugMarker.mockReset();
    setViewportRect.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('supports Safari gestures and ctrl-wheel pinch while preserving ordinary wheel events', () => {
    vi.useFakeTimers();
    const { rerender } = render(<ZoomHarness isEnabled={false} />);
    const board = screen.getByTestId('board');
    const addEventListener = vi.spyOn(board, 'addEventListener');
    const removeEventListener = vi.spyOn(board, 'removeEventListener');
    const animationFrames = new Map<number, FrameRequestCallback>();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      animationFrames.set(1, callback);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    let scrollLeft = 20;
    let scrollTop = 30;
    Object.defineProperties(board, {
      scrollLeft: { configurable: true, get: () => scrollLeft, set: (value: number) => { scrollLeft = value; } },
      scrollTop: { configurable: true, get: () => scrollTop, set: (value: number) => { scrollTop = value; } }
    });

    rerender(<ZoomHarness isEnabled />);

    expect(addEventListener).toHaveBeenCalledWith('wheel', expect.anything(), { passive: false });
    expect(addEventListener).toHaveBeenCalledWith('touchstart', expect.anything(), { passive: false });
    expect(addEventListener).toHaveBeenCalledWith('gesturestart', expect.anything(), { passive: false });
    expect(addEventListener).toHaveBeenCalledWith('gesturechange', expect.anything(), { passive: false });
    expect(addEventListener).toHaveBeenCalledWith('gestureend', expect.anything(), { passive: false });

    const wheelEvent = new WheelEvent('wheel', { cancelable: true, deltaY: 24 });
    board.dispatchEvent(wheelEvent);
    expect(wheelEvent.defaultPrevented).toBe(false);

    const pinchEvent = new WheelEvent('wheel', {
      cancelable: true,
      ctrlKey: true,
      deltaY: -10,
      clientX: 40,
      clientY: 60
    });
    board.dispatchEvent(pinchEvent);
    expect(pinchEvent.defaultPrevented).toBe(true);
    const secondPinchEvent = new WheelEvent('wheel', {
      cancelable: true,
      ctrlKey: true,
      deltaY: -10,
      clientX: 40,
      clientY: 60
    });
    board.dispatchEvent(secondPinchEvent);
    expect(workspaceMock.setScale.mock.calls[0][0]).toBeCloseTo(Math.exp(0.1));
    expect(workspaceMock.setScale.mock.calls[1][0]).toBeCloseTo(Math.exp(0.2));
    const wheelAnimationFrame = animationFrames.get(1);
    if (!wheelAnimationFrame) {
      throw new Error('Expected ctrl-wheel magnification to schedule a scroll update');
    }
    wheelAnimationFrame(0);
    expect(board.scrollLeft).toBeCloseTo(60 * Math.exp(0.2) - 40);
    expect(board.scrollTop).toBeCloseTo(90 * Math.exp(0.2) - 60);
    vi.advanceTimersByTime(100);

    const getGestureHandler = (eventName: string): EventListener => {
      const listener = addEventListener.mock.calls.find(([type]) => type === eventName)?.[1];
      expect(listener).toBeDefined();
      return listener as EventListener;
    };
    const createGestureEvent = (type: string, scale: number) => {
      const event = new Event(type, { cancelable: true });
      Object.defineProperties(event, {
        scale: { value: scale },
        clientX: { value: 40 },
        clientY: { value: 60 }
      });
      return event;
    };

    const gestureStart = createGestureEvent('gesturestart', 1);
    getGestureHandler('gesturestart')(gestureStart);
    expect(gestureStart.defaultPrevented).toBe(true);

    const gestureChange = createGestureEvent('gesturechange', 1.5);
    getGestureHandler('gesturechange')(gestureChange);
    expect(gestureChange.defaultPrevented).toBe(true);
    expect(workspaceMock.setScale).toHaveBeenCalledWith(expect.closeTo(Math.exp(0.2) * 1.5));

    const scheduledAnimationFrame = animationFrames.get(1);
    if (!scheduledAnimationFrame) {
      throw new Error('Expected magnification to schedule a scroll update');
    }
    scheduledAnimationFrame(0);
    expect(board.scrollLeft).toBeCloseTo(60 * Math.exp(0.2) * 1.5 - 40);
    expect(board.scrollTop).toBeCloseTo(90 * Math.exp(0.2) * 1.5 - 60);

    const gestureEnd = new Event('gestureend', { cancelable: true });
    getGestureHandler('gestureend')(gestureEnd);
    expect(gestureEnd.defaultPrevented).toBe(true);
    vi.advanceTimersByTime(500);
    expect(setDebugMarker).toHaveBeenLastCalledWith({ x: 0, y: 0, visible: false });
    expect(setViewportRect).toHaveBeenLastCalledWith({ x: 0, y: 0, visible: false });

    rerender(<ZoomHarness isEnabled={false} />);
    expect(removeEventListener).toHaveBeenCalledWith('gesturestart', expect.anything());
    expect(removeEventListener).toHaveBeenCalledWith('gesturechange', expect.anything());
    expect(removeEventListener).toHaveBeenCalledWith('gestureend', expect.anything());
    expect(removeEventListener).toHaveBeenCalledWith('wheel', expect.anything());
  });
});
