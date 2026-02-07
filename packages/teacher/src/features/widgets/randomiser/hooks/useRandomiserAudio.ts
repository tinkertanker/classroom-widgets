import { useRef, useCallback, useEffect } from 'react';

interface UseRandomiserAudioOptions {
  soundFile: string;
  volume?: number;
}

/**
 * Hook to manage randomiser celebration sound playback
 */
export function useRandomiserAudio({ soundFile, volume = 1 }: UseRandomiserAudioOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio(soundFile);
    audio.volume = volume;
    audioRef.current = audio;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [soundFile, volume]);

  // Play celebration sound
  const playCelebration = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => {
        console.error('Error playing celebration sound:', err);
      });
    }
  }, []);

  // Stop sound
  const stopSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  return {
    playCelebration,
    stopSound
  };
}