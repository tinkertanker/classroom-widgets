import { useRef, useCallback, useEffect } from 'react';

interface UseAudioOptions {
  volume?: number;
  preload?: boolean;
}

interface UseAudioReturn {
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  setVolume: (volume: number) => void;
  isPlaying: boolean;
}

/**
 * Hook for managing audio playback
 * @param audioSrc Audio file source (imported or URL)
 * @param options Configuration options
 * @returns Audio control methods
 */
export const useAudio = (
  audioSrc: string,
  options: UseAudioOptions = {}
): UseAudioReturn => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio(audioSrc);
    if (options.volume !== undefined) {
      audioRef.current.volume = options.volume;
    }
    if (options.preload) {
      audioRef.current.load();
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [audioSrc, options.volume, options.preload]);

  const play = useCallback(async (): Promise<void> => {
    if (!audioRef.current) return;
    
    try {
      await audioRef.current.play();
      isPlayingRef.current = true;
    } catch (error) {
      console.error('Error playing audio:', error);
      throw error;
    }
  }, []);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      isPlayingRef.current = false;
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      isPlayingRef.current = false;
    }
  }, []);

  const setVolume = useCallback((volume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, []);

  return {
    play,
    pause,
    stop,
    setVolume,
    isPlaying: isPlayingRef.current
  };
};