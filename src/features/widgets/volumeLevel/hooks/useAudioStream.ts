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
      console.log('🔇 [Volume Monitor] Disabled - releasing microphone');
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('🛑 [Volume Monitor] Stopped audio track:', track.label);
        });
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
        console.log('🎤 [Volume Monitor] Requesting microphone access...');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('✅ [Volume Monitor] Microphone access granted');

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
        console.error('❌ [Volume Monitor] Error accessing the microphone', err);
      }
    };

    setupAudio();

    // Cleanup on unmount or when isEnabled changes
    return () => {
      console.log('🧹 [Volume Monitor] Cleaning up - releasing microphone');
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('🛑 [Volume Monitor] Stopped audio track on cleanup:', track.label);
        });
        mediaStreamRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        console.log('🔌 [Volume Monitor] Closed audio context');
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