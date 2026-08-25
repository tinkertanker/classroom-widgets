import { beforeEach, describe, expect, it } from 'vitest';
import { getMasterVolume, useAudioVolumeStore } from './audioVolumeStore';

describe('audioVolumeStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useAudioVolumeStore.setState({ volume: 1, lastAudibleVolume: 1 });
  });

  it('uses full volume by default and scales sounds that have a quieter base volume', () => {
    useAudioVolumeStore.getState().setVolume(0.5);

    expect(getMasterVolume()).toBe(0.5);
    expect(getMasterVolume(0.4)).toBe(0.2);
  });

  it('clamps invalid volume values', () => {
    useAudioVolumeStore.getState().setVolume(2);
    expect(useAudioVolumeStore.getState().volume).toBe(1);

    useAudioVolumeStore.getState().setVolume(-1);
    expect(useAudioVolumeStore.getState().volume).toBe(0);
  });

  it('persists and restores the last audible volume', async () => {
    useAudioVolumeStore.getState().setVolume(0.35);
    useAudioVolumeStore.getState().toggleMuted();
    const persisted = localStorage.getItem('classroom-widgets-audio-volume');

    expect(persisted).not.toBeNull();
    expect(JSON.parse(persisted!).state).toMatchObject({
      volume: 0,
      lastAudibleVolume: 0.35
    });

    useAudioVolumeStore.setState({ volume: 1, lastAudibleVolume: 1 });
    localStorage.setItem('classroom-widgets-audio-volume', persisted!);
    await useAudioVolumeStore.persist.rehydrate();
    useAudioVolumeStore.getState().toggleMuted();

    expect(useAudioVolumeStore.getState().volume).toBe(0.35);
  });
});
