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
      Object.defineProperty(audio, 'play', { value: vi.fn(() => Promise.resolve()) });
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
      ({ enabled }) => useTimerAudio({ soundUrls: ['timer.mp3'], enabled }),
      { initialProps: { enabled: false } }
    );

    rerender({ enabled: true });

    expect(audioElements).toHaveLength(1);
    expect(audioElements[0].volume).toBe(masterVolume);
  });

  it('plays one of several sounds at random, never the same one twice running', () => {
    const urls = ['a.mp3', 'b.mp3', 'c.mp3'];
    const { result } = renderHook(() => useTimerAudio({ soundUrls: urls }));
    expect(audioElements).toHaveLength(3);

    const played: number[] = [];
    for (let i = 0; i < 60; i++) {
      audioElements.forEach((audio) => (audio.play as ReturnType<typeof vi.fn>).mockClear());
      act(() => result.current.playSound());
      const playing = audioElements.filter((audio) => (audio.play as ReturnType<typeof vi.fn>).mock.calls.length > 0);
      expect(playing).toHaveLength(1);
      played.push(audioElements.indexOf(playing[0]));
    }

    for (let i = 1; i < played.length; i++) {
      expect(played[i]).not.toBe(played[i - 1]);
    }
    expect(new Set(played).size).toBe(3);
  });

  it('keeps the same Audio elements when the caller passes an equal list again', () => {
    const { rerender } = renderHook(
      ({ urls }) => useTimerAudio({ soundUrls: urls }),
      { initialProps: { urls: ['a.mp3', 'b.mp3'] } }
    );
    rerender({ urls: ['a.mp3', 'b.mp3'] });
    expect(audioElements).toHaveLength(2);
  });
});
