import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';

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

  // Send feedback when value changes (only when active)
  useEffect(() => {
    if (currentValue !== lastSentValue && !isSending && isActive) {
      setIsSending(true);
      
      // Send the updated value
      if (isSession) {
        socket.emit('session:rtfeedback:update', {
          sessionCode: roomCode,
          widgetId,
          value: currentValue
        });
      } else {
        socket.emit('student:updateFeedback', {
          code: roomCode,
          value: currentValue
        });
      }
      
      setLastSentValue(currentValue);
      
      // Reset sending state after a short delay
      setTimeout(() => {
        setIsSending(false);
      }, 100);
    }
  }, [currentValue, lastSentValue, socket, roomCode, isSending, isActive]);

  // Handle room closed and state changes
  useEffect(() => {
    const handleRoomClosed = (data: any) => {
      if (data.code === roomCode) {
        // Room closed
      }
    };
    
    const handleStateChanged = (data: { isActive: boolean }) => {
      const wasInactive = !isActive;
      setIsActive(data.isActive);
      
      // Reset to middle value when restarted from inactive state
      if (data.isActive && wasInactive) {
        setCurrentValue(3);
        setLastSentValue(3);
      }
    };

    socket.on('room:closed', handleRoomClosed);
    socket.on('rtfeedback:stateChanged', handleStateChanged);
    
    // Request current state if we don't have initial state
    let timer: NodeJS.Timeout | undefined;
    if (initialIsActive === undefined) {
      timer = setTimeout(() => {
        socket.emit('rtfeedback:requestState', { code: roomCode, widgetId });
      }, 100);
    }

    return () => {
      if (timer) clearTimeout(timer);
      socket.off('room:closed', handleRoomClosed);
      socket.off('rtfeedback:stateChanged', handleStateChanged);
    };
  }, [socket, roomCode, isActive]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isActive) {
      setCurrentValue(Number(e.target.value));
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
    <div className="p-6">
      {!isActive ? (
        // Waiting state when teacher has stopped feedback
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-semibold text-warm-gray-600 mb-4">
              Feedback Paused
            </h2>
            <p className="text-warm-gray-500">
              Waiting for teacher to start feedback collection...
            </p>
            <div className="mt-8">
              <span className="inline-flex items-center text-sm text-warm-gray-500">
                <span className="inline-block w-2 h-2 bg-warm-gray-400 rounded-full mr-2 animate-pulse"></span>
                Connected to room {roomCode}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-warm-gray-800 mb-2">
              Real-Time Feedback
            </h2>
            <p className="text-warm-gray-600">
              Adjust the slider to let your teacher know
            </p>
          </div>

          <div className="max-w-md mx-auto">
        {/* Current value display */}
        <div className="text-center mb-8">
          <div className={`text-5xl font-bold ${getColorForValue(currentValue)} transition-colors duration-300`}>
            {currentValue.toFixed(1)}
          </div>
          <div className={`text-xl mt-2 ${getColorForValue(currentValue)} transition-colors duration-300`}>
            {getLabelForValue(currentValue)}
          </div>
        </div>

        {/* Slider */}
        <div className="mb-8">
          <input
            type="range"
            min="1"
            max="5"
            step="0.2"
            value={currentValue}
            onChange={handleSliderChange}
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
        <div className="flex justify-between text-xs text-warm-gray-600 mb-4">
          <span>Too Easy</span>
          <span>Easy</span>
          <span>Just Right</span>
          <span>Hard</span>
          <span>Too Hard</span>
        </div>

        {/* Status */}
        <div className="text-center text-sm text-warm-gray-500">
          {isSending ? (
            <span className="flex items-center justify-center">
              <span className="inline-block w-2 h-2 bg-sage-500 rounded-full mr-2 animate-pulse"></span>
              Updating...
            </span>
          ) : (
            <span className="flex items-center justify-center">
              <span className="inline-block w-2 h-2 bg-sage-500 rounded-full mr-2"></span>
              Connected
            </span>
          )}
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