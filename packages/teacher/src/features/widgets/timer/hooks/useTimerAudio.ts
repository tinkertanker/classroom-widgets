import { useEffect, useRef } from 'react';
import { useAudioVolumeStore } from '../../../../store/audioVolumeStore';

interface UseTimerAudioProps {
  /** One or more end sounds; each play picks one of them at random. */
  soundUrls: string[];
  enabled?: boolean;
}

/**
 * Preloads the timer's end sounds and plays one of them when time is up. With
 * several sounds, it picks at random but never repeats the previous one.
 */
export function useTimerAudio({ soundUrls, enabled = true }: UseTimerAudioProps) {
  const audiosRef = useRef<HTMLAudioElement[]>([]);
  const lastIndexRef = useRef(-1);
  const masterVolume = useAudioVolumeStore((state) => state.volume);
  // Rebuild the Audio elements only when the list of URLs actually changes,
  // not whenever the caller passes a new array.
  const urlsKey = soundUrls.join('\n');

  useEffect(() => {
    if (enabled) {
      audiosRef.current = urlsKey.split('\n').filter(Boolean).map((url) => {
        const audio = new Audio(url);
        audio.preload = 'auto';
        audio.volume = useAudioVolumeStore.getState().volume;
        return audio;
      });
      lastIndexRef.current = -1;
    }

    return () => {
      for (const audio of audiosRef.current) {
        audio.pause();
        audio.src = '';
      }
      audiosRef.current = [];
    };
  }, [enabled, urlsKey]);

  useEffect(() => {
    for (const audio of audiosRef.current) {
      audio.volume = masterVolume;
    }
  }, [masterVolume]);

  const stopSound = () => {
    for (const audio of audiosRef.current) {
      audio.pause();
      audio.currentTime = 0;
    }
  };

  const playSound = () => {
    const audios = audiosRef.current;
    if (!enabled || audios.length === 0) return;

    let index = Math.floor(Math.random() * audios.length);
    if (audios.length > 1 && index === lastIndexRef.current) {
      // Shift to a different sound so the same tune never plays twice running.
      index = (index + 1 + Math.floor(Math.random() * (audios.length - 1))) % audios.length;
    }
    lastIndexRef.current = index;

    stopSound();
    audios[index].play().catch(() => {
      // Silently handle play errors (e.g., user hasn't interacted with page yet)
    });
  };

  return { playSound, stopSound };
}
