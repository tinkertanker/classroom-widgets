import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaMicrophone, FaMicrophoneSlash, FaSpinner, FaVolumeXmark, FaCheck, FaTriangleExclamation, FaXmark, FaLightbulb, FaRotate } from 'react-icons/fa6';
import { useVoiceRecording } from '../hooks/useVoiceRecording';
import { VoiceInterfaceState, VoiceCommandResponse } from '../types/voiceControl';
import { debug } from '../../../shared/utils/debug';
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
  const [showTips, setShowTips] = useState(true);
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

  // Auto-start recording when interface opens
  useEffect(() => {
    if (isOpen && voiceState === 'idle') {
      setVoiceState('activating');
      setTimeout(() => {
        startRecording();
      }, 300);
    }
  }, [isOpen, voiceState, startRecording]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to close
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
        return;
      }

      // Enter to stop recording
      if (e.key === 'Enter' && isListening) {
        e.preventDefault();
        stopRecording();
      } else if (e.key === 'Enter' && (voiceState === 'success' || voiceState === 'error')) {
        e.preventDefault();
        handleClose();
      }

      // R to retry
      if ((e.key === 'r' || e.key === 'R') && voiceState === 'error') {
        e.preventDefault();
        handleRetry();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isListening, voiceState, stopRecording]);

  // Handle transcript completion
  useEffect(() => {
    if (!isOpen || !transcript || isGathering || isListening || voiceState === 'idle') {
      return;
    }

    // Quality check
    if (confidence < 0.5 || transcript.trim().length < 3) {
      debug(`🚫 Skipping low-quality transcript: "${transcript}" (confidence: ${confidence})`);
      setVoiceState('activating');
      setTimeout(() => startRecording(), 500);
      return;
    }

    debug(`✅ Processing transcript: "${transcript}" (confidence: ${confidence})`);

    const processingId = `${transcript}_${Date.now()}`;

    if (processedRequestIdsRef.current.has(transcript)) {
      debug(`🚫 Skipping duplicate transcript: "${transcript}"`);
      return;
    }

    processedRequestIdsRef.current.add(transcript);
    isProcessingRef.current = true;
    setVoiceState('processing');

    onTranscriptComplete(transcript)
      .then((response) => {
        debug(`✅ Command processed:`, response);
        setParsedCommand(response);
        setProcessedTranscript(transcript);

        const isError = response.feedback.type === 'error' ||
                       response.feedback.type === 'not_understood' ||
                       !response.success;

        setVoiceState(isError ? 'error' : 'success');
      })
      .catch((err) => {
        debug.error('Command processing failed:', err);
        setVoiceState('error');
      })
      .finally(() => {
        isProcessingRef.current = false;
      });
  }, [transcript, isGathering, isListening, isOpen, voiceState, confidence, onTranscriptComplete]);

  // State transitions
  useEffect(() => {
    if (voiceState === 'success' || voiceState === 'error' || voiceState === 'processing') {
      return;
    }

    if (error) {
      debug(`🔄 Transitioning to error state: ${error}`);
      setVoiceState('error');
    } else if (isGathering) {
      debug(`🔄 Transitioning to listening state`);
      setVoiceState('listening');
    } else if (isProcessing) {
      debug(`🔄 Transitioning to processing state`);
      setVoiceState('processing');
    }
  }, [isListening, isProcessing, isGathering, voiceState, error]);

  const handleClose = useCallback(() => {
    debug(`🔘 Closing voice interface`);
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
    debug(`🔘 Retrying voice command`);
    resetState();
    setParsedCommand(null);
    setProcessedTranscript(null);
    setVoiceState('activating');
    setTimeout(() => {
      startRecording();
      setVoiceState('listening');
    }, 300);
  }, [resetState, startRecording]);

  // Audio visualizer bars (simulated based on state)
  const AudioVisualizer = () => {
    if (!isGathering) return null;

    return (
      <div className="flex items-center justify-center gap-1 h-12 mb-4">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="w-1.5 bg-gradient-to-t from-sage-500 to-sage-400 dark:from-sage-400 dark:to-sage-300 rounded-full voice-wave-bar"
            style={{
              animationDelay: `${i * 0.1}s`,
              height: '100%'
            }}
          />
        ))}
      </div>
    );
  };

  // Status content based on current state
  const StatusContent = () => {
    switch (voiceState) {
      case 'activating':
        return (
          <>
            <div className="text-warm-gray-600 dark:text-warm-gray-400 mb-2">
              Initializing microphone...
            </div>
            <FaSpinner className="text-4xl text-blue-500 animate-spin mx-auto" />
          </>
        );

      case 'listening':
        return (
          <>
            <div className="relative mb-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-red-500 to-red-600 dark:from-red-400 dark:to-red-500 flex items-center justify-center text-white shadow-lg relative">
                <FaMicrophone className="text-3xl animate-pulse" />
                {/* Pulsing rings */}
                <div className="absolute inset-0 rounded-full border-2 border-red-300 dark:border-red-600 animate-ping" />
                <div className="absolute inset-0 rounded-full border-2 border-red-400 dark:border-red-500 animate-ping animation-delay-200" style={{ animationDelay: '200ms' }} />
              </div>
            </div>
            <div className="text-lg font-medium text-warm-gray-800 dark:text-warm-gray-200 mb-2">
              Listening...
            </div>
            <div className="text-sm text-warm-gray-600 dark:text-warm-gray-400 mb-4">
              Speak your command naturally
            </div>
            <AudioVisualizer />
            {transcript && isGathering && (
              <div className="text-sm text-warm-gray-700 dark:text-warm-gray-300 italic mb-2">
                "{transcript}"
              </div>
            )}
          </>
        );

      case 'processing':
        return (
          <>
            <FaSpinner className="text-5xl text-yellow-500 dark:text-yellow-400 animate-spin mx-auto mb-4" />
            <div className="text-lg font-medium text-warm-gray-800 dark:text-warm-gray-200 mb-2">
              Processing command...
            </div>
            {processedTranscript && (
              <div className="text-sm text-warm-gray-600 dark:text-warm-gray-400 mb-2 px-4 py-2 bg-warm-gray-100 dark:bg-warm-gray-700 rounded-lg">
                "{processedTranscript}"
              </div>
            )}
          </>
        );

      case 'success':
        return (
          <>
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-green-500 to-green-600 dark:from-green-400 dark:to-green-500 flex items-center justify-center text-white shadow-lg mb-4">
              <FaCheck className="text-3xl" />
            </div>
            <div className="text-lg font-medium text-green-700 dark:text-green-400 mb-2">
              {parsedCommand?.feedback.message || 'Command executed successfully!'}
            </div>
            {processedTranscript && (
              <div className="text-sm text-warm-gray-600 dark:text-warm-gray-400 mb-2">
                "{processedTranscript}"
              </div>
            )}
            {parsedCommand && (
              <div className="mt-4 p-3 bg-sage-50 dark:bg-sage-900/20 rounded-lg border border-sage-200 dark:border-sage-700">
                <div className="text-sm font-medium text-sage-700 dark:text-sage-300 mb-1">
                  ✓ {parsedCommand.command.action.replace(/_/g, ' ').toLowerCase()}
                  {parsedCommand.command.target && ` ${parsedCommand.command.target}`}
                </div>
                {parsedCommand.command.parameters && Object.keys(parsedCommand.command.parameters).length > 0 && (
                  <div className="text-xs text-sage-600 dark:text-sage-400 mt-1">
                    {Object.entries(parsedCommand.command.parameters).map(([key, value]) => (
                      <span key={key} className="mr-2">
                        {key}: {String(value)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        );

      case 'error':
        return (
          <>
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-red-500 to-red-600 dark:from-red-400 dark:to-red-500 flex items-center justify-center text-white shadow-lg mb-4">
              <FaTriangleExclamation className="text-3xl" />
            </div>
            <div className="text-lg font-medium text-red-700 dark:text-red-400 mb-2">
              {parsedCommand?.feedback.message || error || 'Could not understand command'}
            </div>
            {processedTranscript && (
              <div className="text-sm text-warm-gray-600 dark:text-warm-gray-400 mb-2">
                "{processedTranscript}"
              </div>
            )}
            {showTips && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                <div className="flex items-start gap-2">
                  <FaLightbulb className="text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    <div className="font-medium mb-1">Try saying:</div>
                    <ul className="text-xs space-y-0.5 ml-2">
                      <li>• "Start a 5 minute timer"</li>
                      <li>• "Create a poll"</li>
                      <li>• "Reset the timer"</li>
                      <li>• "Trigger the randomiser"</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </>
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="bg-white dark:bg-warm-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 border border-warm-gray-200 dark:border-warm-gray-700 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header with close button */}
        <div className="relative bg-gradient-to-r from-sage-500 to-sage-600 dark:from-sage-600 dark:to-sage-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FaMicrophone className="text-white/90" />
                Voice Control
              </h2>
              <p className="text-sm text-white/80 mt-0.5">
                Speak naturally to control widgets
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-2 transition-colors"
              aria-label="Close voice control"
            >
              <FaXmark className="text-xl" />
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="p-6 text-center">
          <StatusContent />
        </div>

        {/* Confidence indicator */}
        {confidence > 0 && voiceState === 'processing' && (
          <div className="px-6 pb-2">
            <div className="flex items-center justify-between text-xs text-warm-gray-600 dark:text-warm-gray-400 mb-1">
              <span>Confidence</span>
              <span>{Math.round(confidence * 100)}%</span>
            </div>
            <div className="h-1.5 bg-warm-gray-200 dark:bg-warm-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sage-500 to-sage-600 dark:from-sage-400 dark:to-sage-500 rounded-full transition-all duration-300"
                style={{ width: `${confidence * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="px-6 pb-6">
          <div className="flex gap-2 justify-center">
            {isGathering && (
              <button
                onClick={stopRecording}
                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 font-medium shadow-lg hover:shadow-xl"
              >
                <FaMicrophoneSlash />
                Stop Recording
              </button>
            )}

            {voiceState === 'error' && (
              <>
                <button
                  onClick={handleRetry}
                  className="flex-1 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 font-medium shadow-lg hover:shadow-xl"
                >
                  <FaRotate />
                  Try Again
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 bg-warm-gray-500 hover:bg-warm-gray-600 text-white rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 font-medium"
                >
                  Close
                </button>
              </>
            )}

            {voiceState === 'success' && (
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2.5 bg-sage-500 hover:bg-sage-600 text-white rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 font-medium shadow-lg hover:shadow-xl"
              >
                <FaCheck />
                Done
              </button>
            )}
          </div>

          {/* Keyboard shortcuts hint */}
          <div className="mt-4 text-xs text-center text-warm-gray-500 dark:text-warm-gray-400 space-y-1">
            {isGathering && (
              <div>Press <kbd className="px-1.5 py-0.5 bg-warm-gray-200 dark:bg-warm-gray-700 rounded text-warm-gray-700 dark:text-warm-gray-300 font-mono">Enter</kbd> to finish</div>
            )}
            {voiceState === 'error' && (
              <div>Press <kbd className="px-1.5 py-0.5 bg-warm-gray-200 dark:bg-warm-gray-700 rounded text-warm-gray-700 dark:text-warm-gray-300 font-mono">R</kbd> to retry</div>
            )}
            <div>Press <kbd className="px-1.5 py-0.5 bg-warm-gray-200 dark:bg-warm-gray-700 rounded text-warm-gray-700 dark:text-warm-gray-300 font-mono">Esc</kbd> to close</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceInterface;
