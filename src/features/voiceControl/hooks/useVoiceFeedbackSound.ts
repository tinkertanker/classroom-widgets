import { useRef, useCallback } from 'react';
import voiceActivateSound from '../sounds/voice_widget_activate.wav';

export type VoiceFeedbackType = 'listening' | 'processing' | 'done';

/**
 * Hook to provide audio feedback for voice control states
 * Uses the same sound file with different playback parameters for each state
 */
export const useVoiceFeedbackSound = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playFeedback = useCallback((type: VoiceFeedbackType) => {
    // Stop any currently playing sound
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    // Create new audio instance
    const audio = new Audio(voiceActivateSound);
    audioRef.current = audio;

    // Configure playback based on feedback type
    switch (type) {
      case 'listening':
        // Normal playback - indicates we're ready to listen
        audio.playbackRate = 1.0;
        audio.volume = 0.4;
        break;

      case 'processing':
        // Faster playback - indicates we're processing
        audio.playbackRate = 1.3;
        audio.volume = 0.3;
        break;

      case 'done':
        // Slower, quieter playback - indicates completion
        audio.playbackRate = 0.8;
        audio.volume = 0.35;
        break;
    }

    // Play the sound
    audio.play().catch(err => {
      console.warn('Failed to play voice feedback sound:', err);
    });
  }, []);

  const stopFeedback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
  }, []);

  return {
    playFeedback,
    stopFeedback
  };
};
