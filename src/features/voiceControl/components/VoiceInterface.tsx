import React, { useState, useEffect, useRef } from 'react';
import { FaMicrophone, FaMicrophoneSlash, FaSpinner, FaVolumeXmark, FaCheck, FaTriangleExclamation } from 'react-icons/fa6';
import { useVoiceRecording } from '../hooks/useVoiceRecording';
import { VoiceInterfaceState, VoiceCommandResponse } from '../types/voiceControl';
import '../styles/voiceAnimations.css';

interface VoiceInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  onTranscriptComplete: (transcript: string) => Promise<VoiceCommandResponse>;
  className?: string;
}

const VoiceInterface: React.FC<VoiceInterfaceProps> = ({
  isOpen,
  onClose,
  onTranscriptComplete,
  className = ''
}) => {
  const [voiceState, setVoiceState] = useState<VoiceInterfaceState>('idle');
  const [parsedCommand, setParsedCommand] = useState<VoiceCommandResponse | null>(null);
  const [processedTranscript, setProcessedTranscript] = useState<string | null>(null);
  const isProcessingRef = useRef<boolean>(false); // Track if we're currently processing
  const processedRequestIdsRef = useRef<Set<string>>(new Set()); // Track processed request IDs
  const {
    isListening,
    isProcessing,
    isGathering,
    transcript,
    confidence,
    error,
    startRecording,
    stopRecording,
    resetState
  } = useVoiceRecording();

  // Auto-start recording when interface opens
  useEffect(() => {
    if (isOpen && voiceState === 'idle') {
      setVoiceState('activating');
      // Small delay for smooth animation
      setTimeout(() => {
        startRecording();
        // Don't set to 'listening' yet - wait for isGathering from the hook
      }, 300);
    }
  }, [isOpen, voiceState, startRecording]);

  // Handle keyboard shortcuts for voice interface
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      // Escape to close immediately
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
        return;
      }

      // Enter to stop recording and process
      if (e.key === 'Enter') {
        e.preventDefault();
        if (isListening) {
          // Stop recording when Enter is pressed
          stopRecording();
        } else if (voiceState === 'success' || voiceState === 'error') {
          // Close interface if command is complete
          handleClose();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isListening, voiceState, stopRecording]);

  // Handle transcript completion when recording stops and transcript is available
  useEffect(() => {
    console.log(`[${new Date().toISOString()}] 🔍 useEffect fired: transcript="${transcript}", isGathering=${isGathering}, isListening=${isListening}, voiceState=${voiceState}, processedTranscript=${processedTranscript}, confidence=${confidence}, isProcessingRef=${isProcessingRef.current}`);

    // Process when we have a transcript and we're no longer gathering input
    if (transcript && !isGathering && !isListening && voiceState !== 'idle') {
      // Only process transcripts with reasonable confidence and length
      if (confidence < 0.5 || transcript.trim().length < 3) {
        console.log(`[${new Date().toISOString()}] 🚫 Skipping low-quality transcript: "${transcript}" (confidence: ${confidence})`);
        return;
      }

      console.log(`[${new Date().toISOString()}] ✅ Passed quality check for transcript: "${transcript}" (confidence: ${confidence})`);

      // Create a unique identifier for this transcript processing request
      const transcriptRequestId = `${transcript}_${confidence}`;

      // Check if we've already processed this exact transcript
      if (transcriptRequestId === processedTranscript || isProcessingRef.current || processedRequestIdsRef.current.has(transcriptRequestId)) {
        console.log(`[${new Date().toISOString()}] 🚫 Skipping duplicate transcript processing: "${transcript}"`);
        return;
      }

      const processingId = Math.random().toString(36).slice(2, 11);
      console.log(`[${new Date().toISOString()}] [${processingId}] 🎯 Processing transcript: "${transcript}" (confidence: ${confidence})`);
      console.log(`[${new Date().toISOString()}] [${processingId}] 📊 State check: isGathering=${isGathering}, isListening=${isListening}, voiceState=${voiceState}, processedTranscript=${processedTranscript}, isProcessingRef=${isProcessingRef.current}`);

      // Mark as processing immediately to prevent duplicate processing
      isProcessingRef.current = true;
      setProcessedTranscript(transcriptRequestId); // Mark as processed
      processedRequestIdsRef.current.add(transcriptRequestId); // Add to processed set
      setVoiceState('processing');

      onTranscriptComplete(transcript)
        .then((response) => {
          console.log(`[${new Date().toISOString()}] [${processingId}] ✅ Transcript processing complete:`, response);
          console.log(`[${new Date().toISOString()}] [${processingId}] 🔍 Response analysis: feedback.type=${response.feedback.type}, command.action=${response.command.action}`);
          setParsedCommand(response);

          // Determine if this should be treated as an error
          const isError = response.feedback.type === 'error' || response.command.action === 'UNKNOWN';
          console.log(`[${new Date().toISOString()}] [${processingId}] 🎯 Setting voice state to: ${isError ? 'error' : 'success'}`);
          setVoiceState(isError ? 'error' : 'success');

          // Auto-close after success
          if (response.feedback.type === 'success') {
            setTimeout(() => {
              handleClose();
            }, 2000);
          }
        })
        .catch((err) => {
          setVoiceState('error');
          console.error('Command processing failed:', err);
        })
        .finally(() => {
          // Clear processing flag when done
          isProcessingRef.current = false;
        });
    }
  }, [transcript, isListening, isGathering, voiceState, onTranscriptComplete, processedTranscript, confidence]);

  // Clear processing state when interface closes
  useEffect(() => {
    if (!isOpen) {
      isProcessingRef.current = false;
      setProcessedTranscript(null);
      setParsedCommand(null);
      processedRequestIdsRef.current.clear(); // Clear processed request IDs
    }
  }, [isOpen]);

  // Handle recording state changes
  useEffect(() => {
    if (error && voiceState !== 'error') {
      // If there's an error, transition to error state
      setVoiceState('error');
    } else if (isGathering && voiceState !== 'listening') {
      // When gathering starts, transition to listening state
      setVoiceState('listening');
    } else if (isProcessing && voiceState !== 'processing') {
      setVoiceState('processing');
    } else if (!isListening && !isGathering && !isProcessing && (voiceState === 'activating' || voiceState === 'listening')) {
      // If recording stopped unexpectedly but no error, go back to activating
      setVoiceState('activating');
    }
  }, [isListening, isProcessing, isGathering, voiceState, error]);

  const handleClose = () => {
    stopRecording();
    resetState();
    setParsedCommand(null);
    setProcessedTranscript(null); // Clear processed transcript
    isProcessingRef.current = false; // Clear processing flag
    processedRequestIdsRef.current.clear(); // Clear processed request IDs
    setVoiceState('idle');
    onClose();
  };

  const getStatusIcon = () => {
    switch (voiceState) {
      case 'activating':
        return <FaSpinner className="animate-spin" />;
      case 'listening':
        return <FaMicrophone className="animate-pulse" />;
      case 'processing':
        return <FaSpinner className="animate-spin" />;
      case 'success':
        return <FaCheck />;
      case 'error':
        return <FaTriangleExclamation />;
      default:
        return <FaMicrophone />;
    }
  };

  const getStatusColor = () => {
    switch (voiceState) {
      case 'activating':
        return 'text-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400';
      case 'listening':
        return 'text-red-500 bg-red-50 dark:bg-red-900/20 dark:text-red-400';
      case 'processing':
        return 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'success':
        return 'text-green-500 bg-green-50 dark:bg-green-900/20 dark:text-green-400';
      case 'error':
        return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'text-gray-500 bg-gray-50 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getStatusText = () => {
    // If we're gathering input, show that message regardless of voiceState
    if (isGathering) {
      return 'Listening for your command... (Press Enter when done speaking)';
    }

    switch (voiceState) {
      case 'activating':
        return 'Activating voice control...';
      case 'listening':
        return 'Preparing microphone...';
      case 'processing':
        return 'Processing your command...';
      case 'success':
        return parsedCommand?.feedback.message || 'Command executed!';
      case 'error':
        return parsedCommand?.feedback.message || error || 'Something went wrong';
      default:
        return 'Voice Control';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-warm-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 border border-warm-gray-200 dark:border-warm-gray-700">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-warm-gray-800 dark:text-warm-gray-200 mb-2">
            Voice Control
          </h2>
          <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
            Speak your command naturally
          </p>
        </div>

        {/* Voice Status Indicator */}
        <div className="flex justify-center mb-6">
          <div className={`relative w-24 h-24 rounded-full flex items-center justify-center ${getStatusColor()} transition-all duration-300`}>
              <div className="text-4xl">
              {getStatusIcon()}
            </div>

            {/* Listening animation rings */}
            {voiceState === 'listening' && (
              <>
                <div className="absolute inset-0 rounded-full border-4 border-red-200 dark:border-red-800 animate-ping" />
                <div className="absolute inset-0 rounded-full border-4 border-red-300 dark:border-red-700 animate-ping animation-delay-200" />
              </>
            )}
          </div>
        </div>

        {/* Status Text */}
        <div className="text-center mb-4">
          <p className={`text-lg font-medium ${
            voiceState === 'error' ? 'text-red-600 dark:text-red-400' :
            voiceState === 'success' ? 'text-green-600 dark:text-green-400' :
            'text-warm-gray-800 dark:text-warm-gray-200'
          }`}>
            {getStatusText()}
          </p>
        </div>

        {/* Transcript Display */}
        {/* Only show transcript after user stops gathering (presses Enter) */}
        {transcript && !isGathering && (
          <div className="mb-4 p-3 bg-warm-gray-100 dark:bg-warm-gray-700 rounded-lg">
            <p className="text-sm text-warm-gray-700 dark:text-warm-gray-300">
              "{transcript}"
            </p>
            {confidence > 0 && (
              <p className="text-xs text-warm-gray-500 dark:text-warm-gray-400 mt-1">
                Confidence: {Math.round(confidence * 100)}%
              </p>
            )}
          </div>
        )}

        {/* Gathering Input Indicator */}
        {isGathering && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
            <p className="text-sm text-blue-700 dark:text-blue-300 text-center">
              🎤 Listening... Speak your command naturally
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 text-center mt-1">
              Press <kbd className="bg-blue-100 dark:bg-blue-800 px-1 rounded">Enter</kbd> when done speaking
            </p>
          </div>
        )}

        {/* Parsed Command Display */}
        {parsedCommand && (
          <div className="mb-4 p-3 bg-sage-100 dark:bg-sage-900/30 rounded-lg">
            <p className="text-sm font-medium text-sage-700 dark:text-sage-300 mb-1">
              Command: {parsedCommand.command.action} {parsedCommand.command.target}
            </p>
            {Object.keys(parsedCommand.command.parameters).length > 0 && (
              <p className="text-xs text-sage-600 dark:text-sage-400">
                Parameters: {JSON.stringify(parsedCommand.command.parameters, null, 2)}
              </p>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300 whitespace-pre-line">
              {error}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-center">
          {isGathering && (
            <button
              onClick={stopRecording}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors duration-200 flex items-center gap-2"
            >
              <FaMicrophoneSlash />
              Done (Press Enter)
            </button>
          )}

          {(voiceState === 'error' || voiceState === 'success') && (
            <div className="flex gap-3 justify-center">
              {voiceState === 'error' && (
                <button
                  onClick={() => {
                    resetState();
                    setVoiceState('activating');
                    setTimeout(() => {
                      startRecording();
                      setVoiceState('listening');
                    }, 300);
                  }}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-200 flex items-center gap-2"
                >
                  <FaMicrophone />
                  Retry
                </button>
              )}
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-sage-500 hover:bg-sage-600 text-white rounded-lg transition-colors duration-200"
              >
                Close
              </button>
            </div>
          )}

          {voiceState === 'processing' && (
            <div className="text-sm text-warm-gray-500 dark:text-warm-gray-400">
              Processing your request...
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="mt-6 pt-4 border-t border-warm-gray-200 dark:border-warm-gray-700">
          <p className="text-xs text-warm-gray-500 dark:text-warm-gray-400 text-center">
            Try saying things like:<br />
            "Start a timer for 5 minutes"<br />
            "Create a new poll"<br />
            "Add eggs to the shopping list"<br />
            <br />
            Press <kbd className="bg-warm-gray-200 dark:bg-warm-gray-600 px-1 rounded">Enter</kbd> when done speaking<br />
            Press <kbd className="bg-warm-gray-200 dark:bg-warm-gray-600 px-1 rounded">Esc</kbd> to cancel
          </p>
        </div>
      </div>
    </div>
  );
};

export default VoiceInterface;