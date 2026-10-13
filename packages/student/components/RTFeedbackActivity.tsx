import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import type { SessionRTFeedbackSubmittedResponse } from '@shared/types/socket.types';
import { useWidgetStateChange } from '../hooks/useWidgetStateChange';

interface RTFeedbackActivityProps {
  socket: Socket;
  roomCode: string;
  studentName: string;
  initialIsActive?: boolean;
  isSession?: boolean;
  widgetId?: string;
}

const RTFeedbackActivity: React.FC<RTFeedbackActivityProps> = ({ socket, roomCode, studentName, initialIsActive, isSession = false, widgetId }) => {
  const [currentValue, setCurrentValue] = useState(3); // Default to middle (Just Right)
  const [lastSentValue, setLastSentValue] = useState(3);
  const [isSending, setIsSending] = useState(false);
  const [isActive, setIsActive] = useState<boolean>(initialIsActive ?? true); // Use initial state if provided
  // The value the server holds for this student, or null if none was sent.
  // resetEpoch is the room's clear count when the value was chosen, so a value
  // cleared by the teacher is never replayed.
  const heldRef = useRef<{ value: number; resetEpoch: number | null } | null>(null);
  const knownEpochRef = useRef<number | null>(null);
  const needsReplayRef = useRef(false);
  // The latest value sent, awaiting the server's confirmation
  const pendingValueRef = useRef<number | null>(null);

  // Only a replay is checked against the clear count: the student did not just
  // choose it, so a clear since then wins. A freshly chosen value is always sent.
  const submitValue = (value: number, isReplay: boolean) => {
    pendingValueRef.current = value;
    socket.emit('session:rtfeedback:submit', {
      sessionCode: roomCode,
      widgetId,
      value,
      ...(isReplay && knownEpochRef.current !== null && { replay: true, resetEpoch: knownEpochRef.current })
    });
  };

  // Listen for room state changes using shared hook
  useWidgetStateChange({
    socket,
    roomCode,
    roomType: 'rtfeedback',
    widgetId,
    initialIsActive,
    onStateChange: (newIsActive, data) => {
      const wasInactive = !isActive;

      // Only a state reply carries the room's clear count; generic active
      // state events do not, and must not trigger a replay
      if (typeof data?.resetEpoch === 'number') {
        knownEpochRef.current = data.resetEpoch;
        const held = heldRef.current;
        // Cleared while this card was offline, or chosen when the count was unknown
        if (held && held.resetEpoch !== data.resetEpoch) {
          heldRef.current = null;
        }
        // After a reconnect the server has lost our value: send it again now
        // that the count confirms it was not cleared in the meantime
        if (needsReplayRef.current && heldRef.current && newIsActive && !wasInactive) {
          needsReplayRef.current = false;
          submitValue(heldRef.current.value, true);
        }
      }
      setIsActive(newIsActive);
      
      // Reset to middle value when restarted from inactive state
      if (newIsActive && wasInactive) {
        setCurrentValue(3);
        setLastSentValue(3);
        heldRef.current = null;
        needsReplayRef.current = false;
      }
    }
  });

  // Learn the room's clear count up front so a later replay can be checked
  useEffect(() => {
    socket.emit('rtfeedback:requestState', { sessionCode: roomCode, widgetId });
  }, [socket, roomCode, widgetId]);

  // Handle submission response
  useEffect(() => {
    const handleSubmitted = (data: SessionRTFeedbackSubmittedResponse) => {
      if (data.widgetId !== widgetId) return;
      if (typeof data.resetEpoch === 'number') knownEpochRef.current = data.resetEpoch;
      if (data.stale) {
        // Responses were cleared after the replayed value was chosen
        heldRef.current = null;
        return;
      }
      // The server holds the value now, as of this clear count. This also
      // restores a value that a clear notification dropped while it was in flight.
      if (data.success && typeof data.resetEpoch === 'number' && pendingValueRef.current !== null) {
        heldRef.current = { value: pendingValueRef.current, resetEpoch: data.resetEpoch };
      }
      if (!data.success) {
        console.error('Failed to submit feedback:', data.error);
      }
    };

    socket.on('session:rtfeedback:submitted', handleSubmitted);

    return () => {
      socket.off('session:rtfeedback:submitted', handleSubmitted);
    };
  }, [socket, widgetId]);

  // The server drops a student's feedback when their socket disconnects.
  // Flag the value for replay; the state reply to the reconnect request
  // (see onStateChange) decides whether it is still wanted.
  useEffect(() => {
    const handleReconnect = () => {
      if (heldRef.current) needsReplayRef.current = true;
    };
    socket.on('connect', handleReconnect);
    return () => {
      socket.off('connect', handleReconnect);
    };
  }, [socket]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isActive) {
      setCurrentValue(Number(e.target.value));
    }
  };

  const handleSliderRelease = () => {
    // Send feedback on mouse-up only (not on every value change)
    if (currentValue !== lastSentValue && !isSending && isActive) {
      setIsSending(true);

      // Send the updated value
      submitValue(currentValue, false);

      setLastSentValue(currentValue);
      heldRef.current = { value: currentValue, resetEpoch: knownEpochRef.current };

      // Reset sending state after a short delay
      setTimeout(() => {
        setIsSending(false);
      }, 100);
    }
  };

  const getLabelForValue = (value: number) => {
    const labels = ['Too Easy', 'Easy', 'Just Right', 'Hard', 'Too Hard'];
    return labels[Math.round(value) - 1] || 'Just Right';
  };

  const getColorForValue = (value: number) => {
    if (value <= 1.5) return 'text-sage-600';
    if (value <= 2.5) return 'text-sage-500';
    if (value <= 3.5) return 'text-warm-gray-600';
    if (value <= 4.5) return 'text-terracotta-500';
    return 'text-dusty-rose-600';
  };

  const getSliderColorClass = (value: number) => {
    if (value <= 1.5) return 'slider-sage';
    if (value <= 2.5) return 'slider-sage-light';
    if (value <= 3.5) return 'slider-gray';
    if (value <= 4.5) return 'slider-terracotta';
    return 'slider-rose';
  };

  return (
    <div>
      {!isActive ? (
        // Waiting state when teacher has stopped feedback
        <div className="flex flex-col items-center justify-center py-8">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-warm-gray-600 dark:text-warm-gray-400 mb-2">
              Feedback Paused
            </h2>
            <p className="text-warm-gray-500 text-sm">
              Waiting for teacher to start feedback collection...
            </p>
          </div>
        </div>
      ) : (
        <>

          <div className="max-w-md mx-auto relative">
        {/* Updating indicator - absolute positioned */}
        {isSending && (
          <div className="absolute top-0 right-0 text-sm text-warm-gray-500">
            <span className="flex items-center">
              <span className="inline-block w-2 h-2 bg-sage-500 rounded-full mr-2 animate-pulse"></span>
              Updating...
            </span>
          </div>
        )}
        
        {/* Current value display */}
        <div className="text-center mb-4">
          <div className={`text-4xl font-bold ${getColorForValue(currentValue)} transition-colors duration-300`}>
            {currentValue.toFixed(1)}
          </div>
          <div className={`text-lg mt-1 ${getColorForValue(currentValue)} transition-colors duration-300`}>
            {getLabelForValue(currentValue)}
          </div>
        </div>

        {/* Slider */}
        <div className="mb-4">
          <input
            type="range"
            min="1"
            max="5"
            step="0.2"
            value={currentValue}
            onChange={handleSliderChange}
            onMouseUp={handleSliderRelease}
            onTouchEnd={handleSliderRelease}
            disabled={!isActive}
            className={`w-full h-3 rounded-lg appearance-none cursor-pointer ${getSliderColorClass(currentValue)} transition-all duration-300`}
            style={{
              background: `linear-gradient(to right,
                #a8c3a8 0%,
                #a8c3a8 25%,
                #d6d2cc 40%,
                #d6d2cc 60%,
                #d9a79d 75%,
                #e39b93 100%)`
            }}
          />
        </div>

        {/* Labels */}
        <div className="flex justify-between text-xs text-warm-gray-600">
          <span>Too Easy</span>
          <span>Easy</span>
          <span>Just Right</span>
          <span>Hard</span>
          <span>Too Hard</span>
        </div>
      </div>
        </>
      )}

      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 24px;
          height: 24px;
          background: white;
          border: 3px solid currentColor;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          transition: all 0.2s ease;
        }
        
        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        }
        
        input[type="range"]::-moz-range-thumb {
          width: 24px;
          height: 24px;
          background: white;
          border: 3px solid currentColor;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          transition: all 0.2s ease;
        }
        
        input[type="range"]::-moz-range-thumb:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        }
        
        .slider-sage { color: #a8c3a8; }
        .slider-sage-light { color: #b5d0b5; }
        .slider-gray { color: #d6d2cc; }
        .slider-terracotta { color: #d9a79d; }
        .slider-rose { color: #e39b93; }
      `}</style>
    </div>
  );
};

export default RTFeedbackActivity;
