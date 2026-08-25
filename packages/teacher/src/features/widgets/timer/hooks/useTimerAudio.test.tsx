import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAudioVolumeStore } from '../../../../store/audioVolumeStore';
import { useTimerAudio } from './useTimerAudio';

describe('useTimerAudio', () => {
  const audioElements: HTMLAudioElement[] = [];

  beforeEach(() => {
    audioElements.length = 0;
    vi.stubGlobal('Audio', vi.fn((src?: string) => {
      const audio = document.createElement('audio');
      if (src) audio.src = src;
      Object.defineProperty(audio, 'pause', { value: vi.fn() });
      audioElements.push(audio);
      return audio;
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([0, 0.35])('applies master volume %s when a timer sound is enabled', (masterVolume) => {
    act(() => {
      useAudioVolumeStore.setState({ volume: masterVolume, lastAudibleVolume: 1 });
    });
    const { rerender } = renderHook(
      ({ enabled }) => useTimerAudio({ soundUrl: 'timer.mp3', enabled }),
      { initialProps: { enabled: false } }
    );

    rerender({ enabled: true });

    expect(audioElements).toHaveLength(1);
    expect(audioElements[0].volume).toBe(masterVolume);
  });
});
