import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AudioVolumeState {
  volume: number;
  lastAudibleVolume: number;
  setVolume: (volume: number) => void;
  toggleMuted: () => void;
}

const clampVolume = (volume: number) => Math.max(0, Math.min(1, volume));

export const useAudioVolumeStore = create<AudioVolumeState>()(
  persist(
    (set) => ({
      volume: 1,
      lastAudibleVolume: 1,
      setVolume: (volume) => {
        const nextVolume = clampVolume(volume);
        set((state) => ({
          volume: nextVolume,
          lastAudibleVolume: nextVolume > 0 ? nextVolume : state.lastAudibleVolume
        }));
      },
      toggleMuted: () => set((state) => (
        state.volume > 0
          ? { volume: 0, lastAudibleVolume: state.volume }
          : { volume: state.lastAudibleVolume || 1 }
      ))
    }),
    {
      name: 'classroom-widgets-audio-volume'
    }
  )
);

export const getMasterVolume = (baseVolume = 1) => (
  clampVolume(baseVolume) * useAudioVolumeStore.getState().volume
);
