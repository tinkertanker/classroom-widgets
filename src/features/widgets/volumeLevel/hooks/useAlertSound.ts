import { useRef, useCallback } from 'react';

interface UseAlertSoundOptions {
  soundFile: string;
  volume?: number;
}

/**
 * Hook to manage alert sound playback
 * Handles audio element creation and playback control
 */
export function useAlertSound({ soundFile, volume = 0.3 }: UseAlertSoundOptions) {
  const soundRef = useRef<HTMLAudioElement | null>(null);

  const playSound = useCallback(() => {
    if (!soundRef.current) {
      soundRef.current = new Audio(soundFile);
      soundRef.current.volume = volume;
    }
    soundRef.current.play();
  }, [soundFile, volume]);

  const setVolume = useCallback((newVolume: number) => {
    if (soundRef.current) {
      soundRef.current.volume = Math.max(0, Math.min(1, newVolume));
    }
  }, []);

  return {
    playSound,
    setVolume
  };
}