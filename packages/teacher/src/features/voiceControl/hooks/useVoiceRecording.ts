import { useState, useCallback, useRef, useEffect } from 'react';
import { UseVoiceRecordingReturn, TranscriptionResult, VoiceRecordingState } from '../types/voiceControl';
import { getBrowserInfo, getBrowserSupportMessage, checkMicrophonePermission } from '../utils/browserCompatibility';
import { debug } from '@shared/utils/debug';

export const useVoiceRecording = (): UseVoiceRecordingReturn => {
  const [state, setState] = useState<VoiceRecordingState>({
    isListening: false,
    isProcessing: false,
    isGathering: false,
    transcript: '',
    confidence: 0,
    error: null
  });

  const recognitionRef = useRef<any>(null);
  const currentTranscriptRef = useRef<string>('');
  const currentConfidenceRef = useRef<number>(0);
  const isGatheringInputRef = useRef<boolean>(false);

  // Check browser compatibility on mount
  useEffect(() => {
    // Check if Web Speech API is supported
    if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
      setState(prev => ({
        ...prev,
        error: 'Voice control is not supported in this browser. Please try Chrome, Firefox, or Edge.'
      }));
      return;
    }

    // Get browser info for debugging
    const browserInfo = getBrowserInfo();
    debug('Browser info:', browserInfo);

    // Check microphone permission
    checkMicrophonePermission().then(hasPermission => {
      if (!hasPermission) {
        setState(prev => ({
          ...prev,
          error: 'Microphone access is required for voice control. Please allow microphone access and refresh the page.'
        }));
      } else {
        debug('Microphone permission granted');
      }
    }).catch(err => {
      debug.error('Permission check failed:', err);
      setState(prev => ({
        ...prev,
        error: 'Failed to check microphone permissions. Please refresh the page and try again.'
      }));
    });
  }, []);

  // Initialize native Web Speech API directly (fallback from annyang)
  const initializeWebSpeechAPI = useCallback(() => {
    if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
      throw new Error('Speech recognition not supported in this browser');
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true; // Keep listening until user stops it
    recognition.interimResults = true; // Get interim results
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      debug('🎤 START: Speech Recognition engine started listening');
      isGatheringInputRef.current = true;
      setState(prev => ({
        ...prev,
        isListening: true,
        isProcessing: false,
        isGathering: true,
        error: null,
        transcript: '',
        confidence: 0
      }));
      currentTranscriptRef.current = '';
      currentConfidenceRef.current = 0;
    };

    // Add soundstart detection (annyang equivalent)
    recognition.onsoundstart = () => {
      debug('🔊 SOUNDSTART: Sound detected, possibly speech');
      // We're already in gathering state, so no change needed
    };

    recognition.onresult = (event: any) => {
      debug('🎯 RESULT: Speech identified');
      const result = event.results[event.results.length - 1][0];
      const transcript = result.transcript;
      const confidence = result.confidence;
      const isFinal = event.results[event.results.length - 1].isFinal;

      // Store the latest result
      currentTranscriptRef.current = transcript;
      currentConfidenceRef.current = confidence;

      debug(`📝 Final result: "${transcript}" (Confidence: ${confidence}, IsFinal: ${isFinal})`);

      // Since we're using wildcard command, this is always a "resultMatch"
      // For annyang compatibility, we could simulate resultMatch here
      if (isFinal) {
        debug('✅ RESULTMATCH: Command matched with wildcard pattern');
        // In annyang, this would trigger command execution
        // But we wait for user to press Enter
      }
    };

    recognition.onerror = (event: any) => {
      debug.error('❌ ERROR: Speech recognition failed');
      let errorMessage = 'Voice recognition failed';

      // Annyang-style specific error handling
      switch (event.error) {
        case 'network':
          debug.error('❌ ERRORNETWORK: Speech Recognition failed because of a network error');
          errorMessage = 'Network error. Please check your internet connection and try again.';
          break;
        case 'not-allowed':
          debug.error('❌ ERRORPERMISSIONDENIED: User blocked the permission request to use Speech Recognition');
          errorMessage = 'Microphone permission denied. Please allow microphone access in your browser settings and refresh the page.';
          break;
        case 'service-not-allowed':
          debug.error('❌ ERRORPERMISSIONBLOCKED: Browser blocks the permission request to use Speech Recognition');
          errorMessage = 'Microphone access blocked by browser. Please check your browser settings and allow microphone access.';
          break;
        case 'no-speech':
          debug.error('❌ No speech detected');
          errorMessage = 'No speech detected. Please try speaking more clearly or check your microphone.';
          break;
        case 'audio-capture':
          debug.error('❌ Audio capture failed');
          errorMessage = 'Microphone not available. Please check if your microphone is connected and working.';
          break;
        case 'aborted':
          debug.error('❌ Speech recognition was aborted');
          errorMessage = 'Voice recognition was stopped. Please try again.';
          break;
        default:
          debug.error(`❌ Unknown error: ${event.error}`);
          errorMessage = `Speech recognition error: ${event.error}`;
      }

      isGatheringInputRef.current = false;
      setState(prev => ({
        ...prev,
        isListening: false,
        isProcessing: false,
        isGathering: false,
        error: errorMessage
      }));
    };

    recognition.onend = () => {
      debug('⏹️ END: Speech Recognition engine stopped');
      isGatheringInputRef.current = false;

      // If we have a transcript, set it in the state and mark as processing
      if (currentTranscriptRef.current.trim()) {
        debug('📝 Setting transcript from automatic stop:', currentTranscriptRef.current);
        setState(prev => ({
          ...prev,
          isListening: false,
          isGathering: false,
          isProcessing: true, // Now we're processing the captured speech
          transcript: currentTranscriptRef.current, // Show the captured transcript
          confidence: currentConfidenceRef.current,
          error: null // Clear any errors
        }));
      } else {
        setState(prev => ({
          ...prev,
          isListening: false,
          isGathering: false
        }));
      }
    };

    return recognition;
  }, []);

  const startRecording = useCallback(async () => {
    debug('🎤 Starting voice recording...');
    setState(prev => ({
      ...prev,
      isProcessing: false, // Don't set processing yet - we're starting to gather
      error: null
    }));

    try {
      debug('🔧 Initializing native Web Speech API...');
      const recognition = initializeWebSpeechAPI();
      if (!recognition) {
        throw new Error('Failed to initialize speech recognition');
      }

      debug('✅ Speech Recognition initialized successfully');
      recognitionRef.current = recognition;

      // Start recognition
      debug('🚀 Starting speech recognition...');
      recognition.start();
      debug('✅ Speech recognition started successfully');

    } catch (error) {
      debug.error('Failed to start voice recognition:', error);
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: error instanceof Error ? error.message : 'Failed to start voice recognition. Please check your microphone permissions.'
      }));
    }
  }, [initializeWebSpeechAPI]);

  const stopRecording = useCallback(async () => {
    if (recognitionRef.current) {
      debug('🛑 Stopping speech recognition and releasing microphone...');

      try {
        // Stop recognition - this releases the microphone
        recognitionRef.current.stop();
      } catch (error) {
        debug.error('Error stopping recognition:', error);
      }

      recognitionRef.current = null;

      // Now show the captured transcript and set processing state
      isGatheringInputRef.current = false;
      setState(prev => ({
        ...prev,
        isListening: false,
        isProcessing: true, // Now we're processing the captured speech
        isGathering: false, // Done gathering input
        transcript: currentTranscriptRef.current, // Show the captured transcript
        confidence: currentConfidenceRef.current,
        error: null // Clear any errors
      }));
    }
  }, []);

  const resetState = useCallback(() => {
    debug('🔄 Resetting voice recording state and releasing resources...');

    // Abort any active recognition immediately
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort(); // Use abort() instead of stop() for immediate cleanup
      } catch (error) {
        debug.error('Error aborting recognition:', error);
      }
      recognitionRef.current = null;
    }

    isGatheringInputRef.current = false;
    setState({
      isListening: false,
      isProcessing: false,
      isGathering: false,
      transcript: '',
      confidence: 0,
      error: null
    });
    currentTranscriptRef.current = '';
    currentConfidenceRef.current = 0;
  }, []);

  // Cleanup on unmount - ensure microphone is released
  useEffect(() => {
    return () => {
      debug('🧹 Cleaning up voice recording on unmount...');
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort(); // Immediately stop and release microphone
        } catch (error) {
          debug.error('Error during unmount cleanup:', error);
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    ...state,
    startRecording,
    stopRecording,
    resetState
  };
};