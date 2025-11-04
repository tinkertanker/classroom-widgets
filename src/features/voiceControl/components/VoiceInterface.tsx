import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaMicrophone, FaMicrophoneSlash, FaSpinner, FaCheck, FaTriangleExclamation, FaXmark, FaLightbulb, FaRotate, FaTurnDown } from 'react-icons/fa6';
import { useVoiceRecording } from '../hooks/useVoiceRecording';
import { useVoiceFeedbackSound } from '../hooks/useVoiceFeedbackSound';
import { VoiceInterfaceState, VoiceCommandResponse } from '../types/voiceControl';
import { debug } from '../../../shared/utils/debug';
import { cn, buttons, text, borders, borderRadius } from '../../../shared/utils/styles';
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
  const isProcessingRef = useRef<boolean>(false);
  const processedRequestIdsRef = useRef<Set<string>>(new Set());

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

  const { playFeedback } = useVoiceFeedbackSound();

  // Define handlers before useEffects
  const handleClose = useCallback(() => {
    stopRecording();
    resetState();
    setParsedCommand(null);
    setProcessedTranscript(null);
    isProcessingRef.current = false;
    processedRequestIdsRef.current.clear();
    setVoiceState('idle');
    onClose();
  }, [stopRecording, resetState, onClose]);

  const handleRetry = useCallback(() => {
    resetState();
    setParsedCommand(null);
    setProcessedTranscript(null);
    setVoiceState('activating');
    setTimeout(() => {
      startRecording();
      setVoiceState('listening');
    }, 300);
  }, [resetState, startRecording]);

  // Auto-start recording when interface opens
  useEffect(() => {
    if (isOpen && voiceState === 'idle') {
      setVoiceState('activating');
      setTimeout(() => {
        startRecording();
      }, 300);
    }
  }, [isOpen, voiceState, startRecording]);

  // Cleanup: Stop recording and release microphone when modal closes or component unmounts
  useEffect(() => {
    if (!isOpen) {
      // Modal is closed - ensure we stop recording and release microphone
      debug('🚪 Voice interface closed - releasing microphone resources');
      stopRecording();
      resetState();
    }

    // Cleanup on unmount
    return () => {
      debug('🧹 Voice interface unmounting - releasing microphone resources');
      stopRecording();
      resetState();
    };
  }, [isOpen, stopRecording, resetState]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
        return;
      }

      if (e.key === 'Enter' && isListening) {
        e.preventDefault();
        stopRecording();
      } else if (e.key === 'Enter' && (voiceState === 'success' || voiceState === 'error')) {
        e.preventDefault();
        handleClose();
      }

      if ((e.key === 'r' || e.key === 'R') && voiceState === 'error') {
        e.preventDefault();
        handleRetry();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isListening, voiceState, stopRecording, handleClose, handleRetry]);

  // Handle transcript completion
  useEffect(() => {
    if (!isOpen || !transcript || isGathering || isListening || voiceState === 'idle') {
      return;
    }

    if (confidence < 0.5 || transcript.trim().length < 3) {
      debug(`🚫 Skipping low-quality transcript: "${transcript}"`);
      setVoiceState('activating');
      setTimeout(() => startRecording(), 500);
      return;
    }

    const processingId = `${transcript}_${Date.now()}`;
    if (processedRequestIdsRef.current.has(transcript)) {
      return;
    }

    processedRequestIdsRef.current.add(transcript);
    isProcessingRef.current = true;
    setVoiceState('processing');
    playFeedback('processing');

    onTranscriptComplete(transcript)
      .then((response) => {
        setParsedCommand(response);
        setProcessedTranscript(transcript);
        const isError = response.feedback.type === 'error' || response.feedback.type === 'not_understood' || !response.success;
        setVoiceState(isError ? 'error' : 'success');

        // On success: play feedback sound, speak feedback, and auto-close
        if (!isError) {
          // Play done feedback sound
          playFeedback('done');

          // Speak feedback if available and shouldSpeak is true
          if (response.feedback.shouldSpeak && response.feedback.message && 'speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(response.feedback.message);
            utterance.rate = 1.1;
            utterance.pitch = 1.0;
            utterance.volume = 0.8;
            window.speechSynthesis.speak(utterance);
          }

          // Auto-close after 3 seconds
          setTimeout(() => {
            handleClose();
          }, 3000);
        }
      })
      .catch((err) => {
        debug.error('Command processing failed:', err);
        setVoiceState('error');
      })
      .finally(() => {
        isProcessingRef.current = false;
      });
  }, [transcript, isGathering, isListening, isOpen, voiceState, confidence, onTranscriptComplete, handleClose, playFeedback]);

  // State transitions
  useEffect(() => {
    if (voiceState === 'success' || voiceState === 'error' || voiceState === 'processing') {
      return;
    }

    if (error) {
      setVoiceState('error');
    } else if (isGathering) {
      setVoiceState('listening');
      // Play feedback sound when we start listening
      playFeedback('listening');
    } else if (isProcessing) {
      setVoiceState('processing');
    }
  }, [isListening, isProcessing, isGathering, voiceState, error, playFeedback]);

  // Audio visualizer
  const AudioVisualizer = () => {
    if (!isGathering) return null;
    return (
      <div className="flex items-center justify-center gap-1 h-8 mb-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="w-1 bg-sage-500 dark:bg-sage-400 rounded-full voice-wave-bar"
            style={{ animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>
    );
  };

  const StatusContent = () => {
    switch (voiceState) {
      case 'activating':
        return (
          <div className="text-center py-6">
            <FaSpinner className="text-4xl text-sage-500 dark:text-sage-400 animate-spin mx-auto mb-3" />
            <p className={cn(text.secondary, "text-sm")}>Activating microphone...</p>
          </div>
        );

      case 'listening':
        return (
          <div className="text-center py-4">
            {/* Microphone icon with subtle pulse rings */}
            <div className="relative inline-flex items-center justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-sage-100 dark:bg-sage-900/30 flex items-center justify-center relative">
                <FaMicrophone className="text-2xl text-sage-600 dark:text-sage-400" />
                {/* Simple pulse rings */}
                <div className="absolute inset-0 rounded-full border-2 border-sage-300 dark:border-sage-600 animate-ping opacity-50" />
                <div className="absolute inset-0 rounded-full border-2 border-sage-400 dark:border-sage-500 animate-ping opacity-30" style={{ animationDelay: '200ms' }} />
              </div>
            </div>

            <p className={cn(text.primary, "font-medium mb-2")}>Listening...</p>
            <p className={cn(text.secondary, "text-sm mb-3")}>Speak your command</p>

            <AudioVisualizer />

            {transcript && isGathering && (
              <div className={cn("mt-2 px-3 py-2 rounded", "bg-warm-gray-100 dark:bg-warm-gray-700", text.secondary, "text-sm italic")}>
                "{transcript}"
              </div>
            )}
          </div>
        );

      case 'processing':
        return (
          <div className="text-center py-6">
            <FaSpinner className="text-4xl text-sage-500 dark:text-sage-400 animate-spin mx-auto mb-3" />
            <p className={cn(text.primary, "font-medium mb-2")}>Processing command...</p>
            {processedTranscript && (
              <div className={cn("mt-3 px-3 py-2 rounded", "bg-warm-gray-100 dark:bg-warm-gray-700", text.secondary, "text-sm")}>
                "{processedTranscript}"
              </div>
            )}
            {confidence > 0 && (
              <div className="mt-3 px-4">
                <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--tw-text-opacity)' }}>
                  <span className={text.secondary}>Confidence</span>
                  <span className={text.secondary}>{Math.round(confidence * 100)}%</span>
                </div>
                <div className="h-1.5 bg-warm-gray-200 dark:bg-warm-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sage-500 dark:bg-sage-400 rounded-full transition-all duration-300"
                    style={{ width: `${confidence * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        );

      case 'success':
        return (
          <div className="text-center py-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-sage-100 dark:bg-sage-900/30 flex items-center justify-center mb-3">
              <FaCheck className="text-2xl text-sage-600 dark:text-sage-400" />
            </div>
            <p className={cn(text.primary, "font-medium text-lg")}>
              {parsedCommand?.feedback.message || 'Command executed'}
            </p>
          </div>
        );

      case 'error':
        return (
          <div className="text-center py-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-dusty-rose-100 dark:bg-dusty-rose-900/30 flex items-center justify-center mb-3">
              <FaTriangleExclamation className="text-2xl text-dusty-rose-600 dark:text-dusty-rose-400" />
            </div>
            <p className={cn("font-medium mb-2 text-dusty-rose-700 dark:text-dusty-rose-400")}>
              {parsedCommand?.feedback.message || error || 'Could not understand command'}
            </p>
            {processedTranscript && (
              <p className={cn(text.secondary, "text-sm mb-3")}>"{processedTranscript}"</p>
            )}
            <div className={cn("mt-3 p-3 rounded text-left", "bg-warm-gray-100 dark:bg-warm-gray-700/50", borders.primary)}>
              <div className="flex items-start gap-2">
                <FaLightbulb className="text-sage-500 dark:text-sage-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className={cn(text.primary, "font-medium mb-1")}>Try saying:</p>
                  <ul className={cn(text.secondary, "text-xs space-y-0.5")}>
                    <li>• "Create a poll"</li>
                    <li>• "Add a text banner"</li>
                    <li>• "Trigger the randomiser"</li>
                    <li>• "Show the traffic light"</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className={cn(
        "bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4",
        borders.primary,
        "overflow-hidden animate-in zoom-in-95 duration-200"
      )}>
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-warm-gray-200 dark:border-warm-gray-700">
          <h2 className={cn(text.primary, "text-lg font-semibold flex items-center gap-2")}>
            <FaMicrophone className={text.secondary} />
            Voice Control
          </h2>
          <button
            onClick={handleClose}
            className={cn(
              text.secondary,
              "hover:text-warm-gray-700 dark:hover:text-warm-gray-200",
              "p-1 rounded hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700",
              "transition-colors"
            )}
            aria-label="Close"
          >
            <FaXmark className="text-xl" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6">
          <StatusContent />
        </div>

        {/* Actions */}
        <div className="px-6 pb-6">
          <div className="flex gap-2">
            {isGathering && voiceState !== 'processing' && (
              <button
                onClick={stopRecording}
                className={cn(
                  buttons.danger,
                  "flex-1 px-4 py-2 text-sm font-medium flex items-center justify-center gap-2"
                )}
              >
                <FaMicrophoneSlash />
                Stop Recording
                <kbd className="ml-1 px-1.5 py-0.5 bg-black/10 dark:bg-white/10 rounded text-xs flex items-center">
                  <FaTurnDown className="rotate-90" />
                </kbd>
              </button>
            )}

            {voiceState === 'error' && (
              <>
                <button
                  onClick={handleRetry}
                  className={cn(
                    buttons.primary,
                    "flex-1 px-4 py-2 text-sm font-medium flex items-center justify-center gap-2"
                  )}
                >
                  <FaRotate />
                  Try Again
                  <kbd className="ml-1 px-1.5 py-0.5 bg-black/10 dark:bg-white/10 rounded text-xs font-mono">R</kbd>
                </button>
                <button
                  onClick={handleClose}
                  className={cn(
                    buttons.secondary,
                    "flex-1 px-4 py-2 text-sm font-medium flex items-center justify-center gap-1"
                  )}
                >
                  Close
                  <kbd className="ml-1 px-1.5 py-0.5 bg-black/10 dark:bg-white/10 rounded text-xs font-mono">Esc</kbd>
                </button>
              </>
            )}

            {voiceState === 'success' && (
              <button
                onClick={handleClose}
                className={cn(
                  buttons.primary,
                  "flex-1 px-4 py-2 text-sm font-medium flex items-center justify-center gap-2"
                )}
              >
                <FaCheck />
                Done
                <kbd className="ml-1 px-1.5 py-0.5 bg-black/10 dark:bg-white/10 rounded text-xs font-mono">Esc</kbd>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceInterface;
