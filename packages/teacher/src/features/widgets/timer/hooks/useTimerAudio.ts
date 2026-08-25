import { useEffect, useRef } from 'react';
import { useAudioVolumeStore } from '../../../../store/audioVolumeStore';

interface UseTimerAudioProps {
  soundUrl: string;
  enabled?: boolean;
}

/**
 * Hook to manage timer audio playback
 * Handles preloading and playing timer end sounds
 */
export function useTimerAudio({ soundUrl, enabled = true }: UseTimerAudioProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const masterVolume = useAudioVolumeStore((state) => state.volume);

  useEffect(() => {
    if (enabled) {
      audioRef.current = new Audio(soundUrl);
      audioRef.current.preload = 'auto';
      audioRef.current.volume = masterVolume;
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, [enabled, soundUrl]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = masterVolume;
    }
  }, [masterVolume]);

  const playSound = () => {
    if (audioRef.current && enabled) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(error => {
        // Silently handle play errors (e.g., user hasn't interacted with page yet)
      });
    }
  };

  const stopSound = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  return { playSound, stopSound };
}
