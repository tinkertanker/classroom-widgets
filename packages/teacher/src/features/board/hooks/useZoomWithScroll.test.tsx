import React, { useRef } from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const workspaceMock = vi.hoisted(() => ({
  setScale: vi.fn(),
  value: 1
}));

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
  useZoomWithScroll(containerRef, scaleRef, vi.fn(), vi.fn());
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses Safari gesture events for magnification without registering a wheel handler', () => {
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

    board.scrollLeft = 20;
    board.scrollTop = 30;

    rerender(<ZoomHarness isEnabled />);

    expect(addEventListener).not.toHaveBeenCalledWith('wheel', expect.anything(), expect.anything());
    expect(addEventListener).toHaveBeenCalledWith('touchstart', expect.anything(), { passive: false });
    expect(addEventListener).toHaveBeenCalledWith('gesturestart', expect.anything(), { passive: false });
    expect(addEventListener).toHaveBeenCalledWith('gesturechange', expect.anything(), { passive: false });
    expect(addEventListener).toHaveBeenCalledWith('gestureend', expect.anything(), { passive: false });

    const wheelEvent = new WheelEvent('wheel', { cancelable: true, deltaY: 24 });
    board.dispatchEvent(wheelEvent);
    expect(wheelEvent.defaultPrevented).toBe(false);

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
    expect(workspaceMock.setScale).toHaveBeenCalledWith(1.5);

    const scheduledAnimationFrame = animationFrames.get(1);
    if (!scheduledAnimationFrame) {
      throw new Error('Expected magnification to schedule a scroll update');
    }
    scheduledAnimationFrame(0);
    expect(board.scrollLeft).toBe(50);
    expect(board.scrollTop).toBe(75);

    const gestureEnd = new Event('gestureend', { cancelable: true });
    getGestureHandler('gestureend')(gestureEnd);
    expect(gestureEnd.defaultPrevented).toBe(true);

    rerender(<ZoomHarness isEnabled={false} />);
    expect(removeEventListener).toHaveBeenCalledWith('gesturestart', expect.anything());
    expect(removeEventListener).toHaveBeenCalledWith('gesturechange', expect.anything());
    expect(removeEventListener).toHaveBeenCalledWith('gestureend', expect.anything());
  });
});
