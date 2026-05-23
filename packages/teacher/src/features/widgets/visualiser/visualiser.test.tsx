import React, { act } from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import Visualiser from './visualiser';

describe('Visualiser', () => {
  const originalMediaDevices = navigator.mediaDevices;
  const originalSrcObjectDescriptor = Object.getOwnPropertyDescriptor(
    HTMLMediaElement.prototype,
    'srcObject'
  );

  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
      configurable: true,
      get() {
        return (this as HTMLMediaElement & { __srcObject?: MediaStream }).__srcObject ?? null;
      },
      set(value: MediaStream | null) {
        (this as HTMLMediaElement & { __srcObject?: MediaStream | null }).__srcObject = value;
      }
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: originalMediaDevices
    });
  });

  afterAll(() => {
    if (originalSrcObjectDescriptor) {
      Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', originalSrcObjectDescriptor);
    } else {
      delete (HTMLMediaElement.prototype as HTMLMediaElement & { srcObject?: MediaStream }).srcObject;
    }
  });

  it('attaches the acquired stream after the gated video element renders and stops it on unmount', async () => {
    const stop = vi.fn();
    const stream = {
      getTracks: () => [{ label: 'Camera', stop }]
    } as unknown as MediaStream;
    const enumerateDevices = vi.fn().mockResolvedValue([
      { kind: 'videoinput', deviceId: 'camera-1', label: 'Camera' }
    ] as unknown as MediaDeviceInfo[]);
    const getUserMedia = vi.fn().mockResolvedValue(stream);

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { enumerateDevices, getUserMedia }
    });

    const { unmount } = render(
      <Visualiser savedState={{ deviceId: 'camera-1' }} />
    );

    await waitFor(() => {
      const renderedVideo = document.querySelector('video') as HTMLVideoElement | null;
      expect(renderedVideo).not.toBeNull();
      expect(renderedVideo?.srcObject).toBe(stream);
    });

    unmount();

    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('ignores camera access failures that resolve after unmount', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let rejectUserMedia: (error: Error) => void = () => {};
    const enumerateDevices = vi.fn().mockResolvedValue([
      { kind: 'videoinput', deviceId: 'camera-1', label: 'Camera' }
    ] as unknown as MediaDeviceInfo[]);
    const getUserMedia = vi.fn().mockImplementation(() => (
      new Promise((_resolve, reject) => {
        rejectUserMedia = reject;
      })
    ));

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { enumerateDevices, getUserMedia }
    });

    const { unmount } = render(
      <Visualiser savedState={{ deviceId: 'camera-1' }} />
    );

    await waitFor(() => {
      expect(getUserMedia).toHaveBeenCalled();
    });

    unmount();

    await act(async () => {
      rejectUserMedia(new DOMException('Permission denied', 'NotAllowedError'));
    });

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
