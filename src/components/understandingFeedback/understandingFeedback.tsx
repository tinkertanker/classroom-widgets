import React, { useState, useEffect, useRef } from 'react';
import Modal from '../Modal';
import UnderstandingFeedbackSettings from './UnderstandingFeedbackSettings';

interface UnderstandingFeedbackProps {
  savedState?: any;
  onStateChange?: (state: any) => void;
}

interface StudentFeedback {
  studentId: string;
  value: number;
  timestamp: number;
}

const UnderstandingFeedback: React.FC<UnderstandingFeedbackProps> = ({
  savedState,
  onStateChange
}) => {
  const [isActive, setIsActive] = useState(savedState?.isActive || false);
  const [roomCode, setRoomCode] = useState(savedState?.roomCode || '');
  const [feedbackData, setFeedbackData] = useState<StudentFeedback[]>(savedState?.feedbackData || []);
  const [showSettings, setShowSettings] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const wsRef = useRef<any>(null);

  // Calculate average understanding level
  const averageUnderstanding = feedbackData.length > 0
    ? feedbackData.reduce((sum, fb) => sum + fb.value, 0) / feedbackData.length
    : 0;

  // Get feedback distribution
  const distribution = [0, 0, 0, 0, 0]; // Index 0 = Too Easy (1), Index 4 = Too Hard (5)
  feedbackData.forEach(fb => {
    const index = Math.floor(fb.value) - 1;
    if (index >= 0 && index < 5) distribution[index]++;
  });

  const maxCount = Math.max(...distribution, 1);

  // Save state whenever it changes
  useEffect(() => {
    if (onStateChange) {
      onStateChange({
        isActive,
        roomCode,
        feedbackData
      });
    }
  }, [isActive, roomCode, feedbackData, onStateChange]);

  // WebSocket connection management
  useEffect(() => {
    if (isActive && roomCode) {
      connectToServer();
    } else {
      disconnectFromServer();
    }

    return () => {
      disconnectFromServer();
    };
  }, [isActive, roomCode]);

  const connectToServer = async () => {
    setConnectionStatus('connecting');
    
    try {
      // Use Socket.io client instead of raw WebSocket
      const io = (await import('socket.io-client')).default;
      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
      
      const socket = io(serverUrl, {
        transports: ['websocket', 'polling']
      });
      
      wsRef.current = socket;

      socket.on('connect', () => {
        setConnectionStatus('connected');
        // Join room as host
        socket.emit('host:join', roomCode);
      });

      socket.on('host:joined', (data) => {
        if (!data.success) {
          console.error('Failed to join room:', data.error);
          setConnectionStatus('disconnected');
        }
      });

      socket.on('feedback', (data) => {
        // Update or add student feedback
        setFeedbackData((prev: StudentFeedback[]) => {
          const existing = prev.findIndex(fb => fb.studentId === data.studentId);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = {
              studentId: data.studentId,
              value: data.value,
              timestamp: Date.now()
            };
            return updated;
          } else {
            return [...prev, {
              studentId: data.studentId,
              value: data.value,
              timestamp: Date.now()
            }];
          }
        });
      });
      
      socket.on('participant:joined', (data) => {
        console.log('New participant joined:', data);
      });
      
      socket.on('studentDisconnected', (data) => {
        // Remove disconnected student's feedback
        setFeedbackData((prev: StudentFeedback[]) => 
          prev.filter(fb => fb.studentId !== data.studentId)
        );
      });

      socket.on('disconnect', () => {
        setConnectionStatus('disconnected');
      });

      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setConnectionStatus('disconnected');
      });
    } catch (error) {
      console.error('Socket.io import error:', error);
      setConnectionStatus('disconnected');
    }
  };

  const disconnectFromServer = () => {
    if (wsRef.current && wsRef.current.disconnect) {
      wsRef.current.disconnect();
      wsRef.current = null;
    }
    setConnectionStatus('disconnected');
  };

  const generateRoomCode = async () => {
    try {
      // Use Socket.io to create room
      const io = (await import('socket.io-client')).default;
      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
      
      const socket = io(serverUrl, {
        transports: ['websocket', 'polling']
      });
      
      return new Promise((resolve) => {
        socket.on('connect', () => {
          socket.emit('understanding:create');
        });
        
        socket.on('understanding:created', (data) => {
          if (data.success) {
            setRoomCode(data.code);
            socket.disconnect();
            resolve(data.code);
          }
        });
        
        socket.on('connect_error', () => {
          socket.disconnect();
          // Fallback to local generation
          const code = Math.random().toString(36).substr(2, 5).toUpperCase();
          setRoomCode(code);
          resolve(code);
        });
      });
    } catch (error) {
      // Fallback to local generation
      const code = Math.random().toString(36).substr(2, 5).toUpperCase();
      setRoomCode(code);
      return code;
    }
  };

  const handleStart = async () => {
    if (!roomCode) {
      await generateRoomCode();
    }
    setIsActive(true);
    setFeedbackData([]);
  };

  const handleStop = () => {
    setIsActive(false);
    disconnectFromServer();
  };

  const handleClear = () => {
    setFeedbackData([]);
  };

  const getBarColor = (index: number) => {
    const colors = [
      'bg-sage-500', // Too Easy
      'bg-sage-400',
      'bg-warm-gray-400', // Just Right
      'bg-terracotta-400',
      'bg-dusty-rose-500' // Too Hard
    ];
    return colors[index];
  };

  const labels = ['Too Easy', 'Easy', 'Just Right', 'Hard', 'Too Hard'];

  return (
    <div className="h-full flex flex-col p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-warm-gray-700 dark:text-warm-gray-300">
          Understanding Feedback
        </h2>
        <button
          onClick={() => setShowSettings(true)}
          className="p-1.5 text-warm-gray-600 dark:text-warm-gray-400 hover:bg-warm-gray-200 dark:hover:bg-warm-gray-700 rounded transition-colors duration-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Status and Room Code */}
      <div className="mb-4 space-y-2">
        {isActive && (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-sage-500' : 
                connectionStatus === 'connecting' ? 'bg-warm-gray-400 animate-pulse' : 
                'bg-dusty-rose-500'
              }`} />
              <span className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
                {connectionStatus === 'connected' ? 'Connected' : 
                 connectionStatus === 'connecting' ? 'Connecting...' : 
                 'Disconnected'}
              </span>
            </div>
            <div className="text-sm font-mono bg-warm-gray-100 dark:bg-warm-gray-800 px-2 py-1 rounded">
              {roomCode}
            </div>
          </div>
        )}
        
        {isActive && feedbackData.length > 0 && (
          <div className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
            {feedbackData.length} student{feedbackData.length !== 1 ? 's' : ''} connected
          </div>
        )}
      </div>

      {/* Main Display */}
      <div className="flex-1 flex flex-col">
        {!isActive ? (
          <div className="flex-1 flex items-center justify-center">
            <button
              onClick={handleStart}
              className="px-6 py-3 bg-sage-500 hover:bg-sage-600 text-white rounded-lg transition-colors duration-200"
            >
              Start Feedback Session
            </button>
          </div>
        ) : feedbackData.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-warm-gray-500 dark:text-warm-gray-400">
            <p className="text-lg mb-2">Waiting for students to join...</p>
            <p className="text-sm">Share code: <span className="font-mono font-bold">{roomCode}</span></p>
          </div>
        ) : (
          <>
            {/* Average Display */}
            <div className="text-center mb-6">
              <div className="text-4xl font-bold text-warm-gray-800 dark:text-warm-gray-200">
                {averageUnderstanding.toFixed(1)}
              </div>
              <div className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
                Average Understanding
              </div>
            </div>

            {/* Distribution Chart */}
            <div className="flex-1 flex items-end space-x-2 mb-4">
              {distribution.map((count, index) => (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div className="w-full flex flex-col items-center">
                    <span className="text-sm text-warm-gray-600 dark:text-warm-gray-400 mb-1">
                      {count}
                    </span>
                    <div 
                      className={`w-full ${getBarColor(index)} rounded-t transition-all duration-300`}
                      style={{ 
                        height: `${Math.max((count / maxCount) * 150, 4)}px`,
                        minHeight: '4px'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Labels */}
            <div className="flex space-x-2 text-xs text-warm-gray-600 dark:text-warm-gray-400">
              {labels.map((label, index) => (
                <div key={index} className="flex-1 text-center">
                  {label}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Controls */}
      {isActive && (
        <div className="flex space-x-2 mt-4">
          <button
            onClick={handleStop}
            className="flex-1 px-3 py-1.5 bg-dusty-rose-500 hover:bg-dusty-rose-600 text-white text-sm rounded transition-colors duration-200"
          >
            Stop
          </button>
          {feedbackData.length > 0 && (
            <button
              onClick={handleClear}
              className="px-3 py-1.5 bg-warm-gray-400 hover:bg-warm-gray-500 text-white text-sm rounded transition-colors duration-200"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Settings Modal */}
      <Modal isOpen={showSettings} onClose={() => setShowSettings(false)}>
        <UnderstandingFeedbackSettings
          roomCode={roomCode}
          onRoomCodeChange={setRoomCode}
          onGenerateCode={generateRoomCode}
          onClose={() => setShowSettings(false)}
        />
      </Modal>
    </div>
  );
};

export default UnderstandingFeedback;