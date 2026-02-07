import { useEffect, useRef } from 'react';

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

  useEffect(() => {
    if (enabled) {
      audioRef.current = new Audio(soundUrl);
      audioRef.current.preload = 'auto';
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, [soundUrl, enabled]);

  const playSound = () => {
    if (audioRef.current && enabled) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(error => {
        // Silently handle play errors (e.g., user hasn't interacted with page yet)
      });
    }
  };

  return { playSound };
}