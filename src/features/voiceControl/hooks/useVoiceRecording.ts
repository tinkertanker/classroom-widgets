import { useState, useCallback, useRef, useEffect } from 'react';
import { UseVoiceRecordingReturn, TranscriptionResult, VoiceRecordingState } from '../types/voiceControl';
import { getBrowserInfo, getBrowserSupportMessage, checkMicrophonePermission } from '../utils/browserCompatibility';

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
    console.log('Browser info:', browserInfo);

    // Check microphone permission
    checkMicrophonePermission().then(hasPermission => {
      if (!hasPermission) {
        setState(prev => ({
          ...prev,
          error: 'Microphone access is required for voice control. Please allow microphone access and refresh the page.'
        }));
      } else {
        console.log('Microphone permission granted');
      }
    }).catch(err => {
      console.error('Permission check failed:', err);
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
      console.log('🎤 START: Speech Recognition engine started listening');
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
      console.log('🔊 SOUNDSTART: Sound detected, possibly speech');
      // We're already in gathering state, so no change needed
    };

    recognition.onresult = (event: any) => {
      console.log('🎯 RESULT: Speech identified');
      const result = event.results[event.results.length - 1][0];
      const transcript = result.transcript;
      const confidence = result.confidence;
      const isFinal = event.results[event.results.length - 1].isFinal;

      // Store the latest result
      currentTranscriptRef.current = transcript;
      currentConfidenceRef.current = confidence;

      console.log(`📝 Final result: "${transcript}" (Confidence: ${confidence}, IsFinal: ${isFinal})`);

      // Since we're using wildcard command, this is always a "resultMatch"
      // For annyang compatibility, we could simulate resultMatch here
      if (isFinal) {
        console.log('✅ RESULTMATCH: Command matched with wildcard pattern');
        // In annyang, this would trigger command execution
        // But we wait for user to press Enter
      }
    };

    recognition.onerror = (event: any) => {
      console.error('❌ ERROR: Speech recognition failed');
      let errorMessage = 'Voice recognition failed';

      // Annyang-style specific error handling
      switch (event.error) {
        case 'network':
          console.error('❌ ERRORNETWORK: Speech Recognition failed because of a network error');
          errorMessage = 'Network error. Please check your internet connection and try again.';
          break;
        case 'not-allowed':
          console.error('❌ ERRORPERMISSIONDENIED: User blocked the permission request to use Speech Recognition');
          errorMessage = 'Microphone permission denied. Please allow microphone access in your browser settings and refresh the page.';
          break;
        case 'service-not-allowed':
          console.error('❌ ERRORPERMISSIONBLOCKED: Browser blocks the permission request to use Speech Recognition');
          errorMessage = 'Microphone access blocked by browser. Please check your browser settings and allow microphone access.';
          break;
        case 'no-speech':
          console.error('❌ No speech detected');
          errorMessage = 'No speech detected. Please try speaking more clearly or check your microphone.';
          break;
        case 'audio-capture':
          console.error('❌ Audio capture failed');
          errorMessage = 'Microphone not available. Please check if your microphone is connected and working.';
          break;
        case 'aborted':
          console.error('❌ Speech recognition was aborted');
          errorMessage = 'Voice recognition was stopped. Please try again.';
          break;
        default:
          console.error(`❌ Unknown error: ${event.error}`);
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
      console.log('⏹️ END: Speech Recognition engine stopped');
      isGatheringInputRef.current = false;

      // If we have a transcript, set it in the state and mark as processing
      if (currentTranscriptRef.current.trim()) {
        console.log('📝 Setting transcript from automatic stop:', currentTranscriptRef.current);
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
    console.log('🎤 Starting voice recording...');
    setState(prev => ({
      ...prev,
      isProcessing: false, // Don't set processing yet - we're starting to gather
      error: null
    }));

    try {
      console.log('🔧 Initializing native Web Speech API...');
      const recognition = initializeWebSpeechAPI();
      if (!recognition) {
        throw new Error('Failed to initialize speech recognition');
      }

      console.log('✅ Speech Recognition initialized successfully');
      recognitionRef.current = recognition;

      // Start recognition
      console.log('🚀 Starting speech recognition...');
      recognition.start();
      console.log('✅ Speech recognition started successfully');

    } catch (error) {
      console.error('Failed to start voice recognition:', error);
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: error instanceof Error ? error.message : 'Failed to start voice recognition. Please check your microphone permissions.'
      }));
    }
  }, [initializeWebSpeechAPI]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      console.log('Stopping speech recognition and processing captured speech...');

      // Stop recognition
      recognitionRef.current.stop();
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
    stopRecording();
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
  }, [stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
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