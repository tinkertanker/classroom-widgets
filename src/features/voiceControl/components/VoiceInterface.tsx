import React, { useState, useEffect } from 'react';
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
  const {
    isListening,
    isProcessing,
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
        setVoiceState('listening');
      }, 300);
    }
  }, [isOpen, voiceState, startRecording]);

  // Handle transcript completion
  useEffect(() => {
    if (transcript && !isListening && !isProcessing) {
      setVoiceState('processing');
      onTranscriptComplete(transcript)
        .then((response) => {
          setParsedCommand(response);
          setVoiceState(response.feedback.type === 'error' ? 'error' : 'success');

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
        });
    }
  }, [transcript, isListening, isProcessing, onTranscriptComplete]);

  // Handle recording state changes
  useEffect(() => {
    if (isListening && voiceState === 'listening') {
      // Already in correct state
    } else if (isProcessing && voiceState !== 'processing') {
      setVoiceState('processing');
    }
  }, [isListening, isProcessing, voiceState]);

  const handleClose = () => {
    stopRecording();
    resetState();
    setParsedCommand(null);
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
    switch (voiceState) {
      case 'activating':
        return 'Activating voice control...';
      case 'listening':
        return 'Listening... Speak now!';
      case 'processing':
        return 'Processing your command...';
      case 'success':
        return parsedCommand?.feedback.message || 'Command executed!';
      case 'error':
        return error || 'Something went wrong';
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
        {transcript && (
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
            <p className="text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-center">
          {voiceState === 'listening' && (
            <button
              onClick={stopRecording}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors duration-200 flex items-center gap-2"
            >
              <FaMicrophoneSlash />
              Stop Recording
            </button>
          )}

          {(voiceState === 'error' || voiceState === 'success') && (
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-sage-500 hover:bg-sage-600 text-white rounded-lg transition-colors duration-200"
            >
              Close
            </button>
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
            "Add eggs to the shopping list"
          </p>
        </div>
      </div>
    </div>
  );
};

export default VoiceInterface;