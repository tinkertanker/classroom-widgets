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

  // A touch gesture and a ctrl-wheel gesture used to be gated by two
  // separately-maintained "is a gesture active" signals (isScaling and
  // zoomOriginBoard). If they ever fell out of sync, a wheel event arriving
  // mid-touch-gesture would incorrectly start a second, independent gesture
  // instead of continuing the one already in flight. This pins the single
  // derived signal (zoomOriginBoard !== null) across an overlapping
  // touch-then-wheel sequence.
  it('treats an overlapping wheel gesture as a continuation of an in-flight touch gesture', () => {
    vi.useFakeTimers();
    const { rerender } = render(<ZoomHarness isEnabled={false} />);
    const board = screen.getByTestId('board');
    const animationFrames = new Map<number, FrameRequestCallback>();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      animationFrames.set(1, callback);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    let scrollLeft = 0;
    let scrollTop = 0;
    Object.defineProperties(board, {
      scrollLeft: { configurable: true, get: () => scrollLeft, set: (value: number) => { scrollLeft = value; } },
      scrollTop: { configurable: true, get: () => scrollTop, set: (value: number) => { scrollTop = value; } }
    });

    rerender(<ZoomHarness isEnabled />);

    const createTouchEvent = (type: string, touches: Array<{ clientX: number; clientY: number }>) => {
      const event = new Event(type, { cancelable: true });
      Object.defineProperty(event, 'touches', { value: touches });
      return event;
    };

    board.dispatchEvent(createTouchEvent('touchstart', [
      { clientX: 0, clientY: 0 },
      { clientX: 20, clientY: 0 }
    ]));
    expect(setDebugMarker).toHaveBeenCalledTimes(1);
    expect(setDebugMarker.mock.calls[0][0].visible).toBe(true);

    // A ctrl+wheel event fired while the touch gesture is still active must
    // not start a second gesture -- both refs must agree one is already open.
    const overlapWheel = new WheelEvent('wheel', {
      cancelable: true,
      ctrlKey: true,
      deltaY: -10,
      clientX: 200,
      clientY: 200
    });
    board.dispatchEvent(overlapWheel);
    expect(setDebugMarker).toHaveBeenCalledTimes(1);
    expect(setViewportRect).toHaveBeenCalledTimes(1);

    const wheelAnimationFrame = animationFrames.get(1);
    if (!wheelAnimationFrame) {
      throw new Error('Expected the overlapping wheel zoom to reuse the touch gesture origin');
    }
    wheelAnimationFrame(0);
    // The scroll math must derive from the touch gesture's origin (midpoint of
    // the two touches), not the wheel event's own clientX/clientY -- proving
    // the wheel handler reused zoomOriginBoard instead of starting fresh.
    const expectedScale = Math.exp(0.1);
    expect(board.scrollLeft).toBeCloseTo(10 * expectedScale - 10);
    expect(board.scrollTop).toBeCloseTo(0 * expectedScale - 0);

    // Ending the touch gesture must release the active signal synchronously
    // so a brand new gesture can start immediately afterwards.
    board.dispatchEvent(createTouchEvent('touchend', []));
    board.dispatchEvent(createTouchEvent('touchstart', [
      { clientX: 5, clientY: 5 },
      { clientX: 15, clientY: 5 }
    ]));
    expect(setDebugMarker).toHaveBeenCalledTimes(2);
    expect(setDebugMarker.mock.calls[1][0].visible).toBe(true);

    board.dispatchEvent(createTouchEvent('touchend', []));
  });

  it('releases and reacquires the gesture-active signal synchronously across a rapid gesturestart/end/start sequence', () => {
    vi.useFakeTimers();
    const { rerender } = render(<ZoomHarness isEnabled={false} />);
    const board = screen.getByTestId('board');
    const addEventListener = vi.spyOn(board, 'addEventListener');
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      void callback;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    rerender(<ZoomHarness isEnabled />);

    const getGestureHandler = (eventName: string): EventListener => {
      const listener = addEventListener.mock.calls.find(([type]) => type === eventName)?.[1];
      expect(listener).toBeDefined();
      return listener as EventListener;
    };
    const createGestureEvent = (type: string, scale: number, clientX: number, clientY: number) => {
      const event = new Event(type, { cancelable: true });
      Object.defineProperties(event, {
        scale: { value: scale },
        clientX: { value: clientX },
        clientY: { value: clientY }
      });
      return event;
    };

    const gestureStart = getGestureHandler('gesturestart');
    const gestureChange = getGestureHandler('gesturechange');
    const gestureEnd = getGestureHandler('gestureend');

    gestureStart(createGestureEvent('gesturestart', 1, 10, 10));
    expect(setDebugMarker).toHaveBeenCalledTimes(1);

    // A second gesturestart while the first is still active must be ignored --
    // the origin (and the derived active signal) must not move mid-gesture.
    gestureStart(createGestureEvent('gesturestart', 1, 999, 999));
    expect(setDebugMarker).toHaveBeenCalledTimes(1);

    gestureEnd(new Event('gestureend', { cancelable: true }));

    // gestureend resets the signal synchronously (no timer needed), so a
    // brand new gesture can start right away with a fresh origin.
    gestureStart(createGestureEvent('gesturestart', 1, 50, 50));
    expect(setDebugMarker).toHaveBeenCalledTimes(2);
    expect(setDebugMarker.mock.calls[1][0].viewportX).toBe(50);
    expect(setDebugMarker.mock.calls[1][0].viewportY).toBe(50);

    // A change event on the fresh gesture must apply against the new origin,
    // not any stale state left over from the first gesture.
    gestureChange(createGestureEvent('gesturechange', 2, 50, 50));
    expect(workspaceMock.setScale).toHaveBeenCalledWith(2);
  });
});
