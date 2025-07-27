import { useEffect, useRef } from 'react';

interface UseAudioStreamOptions {
  isEnabled: boolean;
  onStreamReady?: (stream: MediaStream, audioContext: AudioContext, analyser: AnalyserNode) => void;
}

/**
 * Hook to manage audio stream from microphone
 * Handles permissions, audio context setup, and cleanup
 */
export function useAudioStream({ isEnabled, onStreamReady }: UseAudioStreamOptions) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isEnabled) {
      // Clean up when disabled
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      analyserRef.current = null;
      return;
    }

    const setupAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;

        source.connect(analyser);

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        mediaStreamRef.current = stream;

        onStreamReady?.(stream, audioContext, analyser);
      } catch (err) {
        console.error('Error accessing the microphone', err);
      }
    };

    setupAudio();

    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      analyserRef.current = null;
    };
  }, [isEnabled, onStreamReady]);

  return {
    audioContext: audioContextRef.current,
    analyser: analyserRef.current,
    mediaStream: mediaStreamRef.current
  };
}