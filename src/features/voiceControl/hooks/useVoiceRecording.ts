import { useState, useCallback, useRef, useEffect } from 'react';
import { UseVoiceRecordingReturn, TranscriptionResult, VoiceRecordingState } from '../types/voiceControl';

// Web Speech API interface declaration
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export const useVoiceRecording = (): UseVoiceRecordingReturn => {
  const [state, setState] = useState<VoiceRecordingState>({
    isListening: false,
    isProcessing: false,
    transcript: '',
    confidence: 0,
    error: null
  });

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Check if Web Speech API is available
  const isWebSpeechAPISupported = () => {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  };

  // Initialize Web Speech API
  const initializeWebSpeechAPI = useCallback(() => {
    if (!isWebSpeechAPISupported()) {
      setState(prev => ({
        ...prev,
        error: 'Speech recognition is not supported in this browser. Please use Chrome or Edge.'
      }));
      return null;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      console.log('Speech recognition started');
      setState(prev => ({
        ...prev,
        isListening: true,
        isProcessing: false,
        error: null
      }));
    };

    recognition.onresult = (event: any) => {
      console.log('Speech recognition result:', event);
      const result = event.results[0][0];
      const transcript = result.transcript;
      const confidence = result.confidence;

      setState(prev => ({
        ...prev,
        transcript,
        confidence,
        isListening: false,
        isProcessing: false
      }));

      console.log(`Transcript: "${transcript}" (Confidence: ${confidence})`);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      let errorMessage = 'Speech recognition failed';

      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech detected. Please try again.';
          break;
        case 'audio-capture':
          errorMessage = 'Microphone not available. Please check your permissions.';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone permission denied. Please allow microphone access.';
          break;
        case 'network':
          errorMessage = 'Network error. Please check your connection.';
          break;
        default:
          errorMessage = `Speech recognition error: ${event.error}`;
      }

      setState(prev => ({
        ...prev,
        isListening: false,
        isProcessing: false,
        error: errorMessage
      }));
    };

    recognition.onend = () => {
      console.log('Speech recognition ended');
      setState(prev => ({
        ...prev,
        isListening: false,
        isProcessing: false
      }));
    };

    return recognition;
  }, []);

  // Fallback audio recording using MediaRecorder API
  const startMediaRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        // Here you would typically send to a speech-to-text service
        // For now, we'll show a placeholder message
        setState(prev => ({
          ...prev,
          isListening: false,
          isProcessing: false,
          error: 'Web Speech API not available. Please use Chrome or Edge for voice commands.'
        }));

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;

      setState(prev => ({
        ...prev,
        isListening: true,
        isProcessing: false,
        error: null
      }));

      console.log('MediaRecorder started');
    } catch (error) {
      console.error('MediaRecorder error:', error);
      setState(prev => ({
        ...prev,
        isListening: false,
        isProcessing: false,
        error: 'Failed to access microphone. Please check your permissions.'
      }));
    }
  }, []);

  const startRecording = useCallback(async () => {
    setState(prev => ({
      ...prev,
      isProcessing: true,
      error: null
    }));

    // Try Web Speech API first
    const recognition = initializeWebSpeechAPI();
    if (recognition) {
      recognitionRef.current = recognition;
      recognition.start();
    } else {
      // Fallback to MediaRecorder
      await startMediaRecording();
    }
  }, [initializeWebSpeechAPI, startMediaRecording]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  }, []);

  const resetState = useCallback(() => {
    stopRecording();
    setState({
      isListening: false,
      isProcessing: false,
      transcript: '',
      confidence: 0,
      error: null
    });
  }, [stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  return {
    ...state,
    startRecording,
    stopRecording,
    resetState
  };
};