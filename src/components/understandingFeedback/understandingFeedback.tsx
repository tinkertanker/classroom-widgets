import React, { useState, useEffect, useRef } from 'react';
import { useModal } from '../../contexts/ModalContext';
import { useNetworkedWidget } from '../../hooks/useNetworkedWidget';
import { NetworkedWidgetHeader } from '../shared/NetworkedWidgetHeader';
import { NetworkedWidgetEmpty } from '../shared/NetworkedWidgetEmpty';
import UnderstandingFeedbackSettings from './UnderstandingFeedbackSettings';
import { FaGauge, FaPlay, FaStop, FaGear } from 'react-icons/fa6';

interface UnderstandingFeedbackProps {
  widgetId?: string;
  savedState?: any;
  onStateChange?: (state: any) => void;
}

interface StudentFeedback {
  studentId: string;
  value: number;
  timestamp: number;
}

const UnderstandingFeedback: React.FC<UnderstandingFeedbackProps> = ({
  widgetId,
  savedState,
  onStateChange
}) => {
  const [isActive, setIsActive] = useState(savedState?.isActive || false);
  const [feedbackData, setFeedbackData] = useState<StudentFeedback[]>(savedState?.feedbackData || []);
  const { showModal, hideModal } = useModal();
  const isFirstRender = useRef(true);
  
  const {
    socket,
    roomCode,
    isConnecting,
    connectionError,
    isConnected,
    createRoom
  } = useNetworkedWidget({
    widgetId: widgetId || savedState?.widgetId || Math.random().toString(36).substr(2, 9),
    roomType: 'understanding',
    onSocketConnected: (newSocket) => {
      // Set up understanding-specific socket listeners
      setupSocketListeners(newSocket);
    }
  });

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

  // Save state whenever it changes (skip initial render)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    
    if (onStateChange) {
      onStateChange({
        widgetId,
        isActive,
        roomCode,
        feedbackData
      });
    }
  }, [isActive, roomCode, feedbackData]); // Remove onStateChange from deps to prevent infinite loop

  // Set up socket listeners
  const setupSocketListeners = (socket: any) => {
    socket.on('feedback', (data: any) => {
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
    
    socket.on('participant:joined', (data: any) => {
      console.log('New participant joined:', data);
      // Add new participant with default middle value (3)
      setFeedbackData((prev: StudentFeedback[]) => {
        // Check if student already exists (shouldn't happen, but be safe)
        const exists = prev.some(fb => fb.studentId === data.studentId);
        if (!exists) {
          return [...prev, {
            studentId: data.studentId,
            value: 3, // Default to "Just Right"
            timestamp: Date.now()
          }];
        }
        return prev;
      });
    });
    
    socket.on('studentDisconnected', (data: any) => {
      // Remove disconnected student's feedback
      setFeedbackData((prev: StudentFeedback[]) => 
        prev.filter(fb => fb.studentId !== data.studentId)
      );
    });
  };

  const handleStart = async () => {
    if (!roomCode) {
      await createRoom();
    }
    setIsActive(true);
    setFeedbackData([]);
    
    // Notify server to start feedback collection
    if (socket && socket.connected && roomCode) {
      socket.emit('understanding:toggle', { code: roomCode, isActive: true });
    }
  };

  const handleStop = () => {
    setIsActive(false);
    
    // Notify server to stop feedback collection
    if (socket && socket.connected && roomCode) {
      socket.emit('understanding:toggle', { code: roomCode, isActive: false });
    }
  };

  const handleClear = () => {
    setFeedbackData([]);
  };

  const openSettings = () => {
    showModal({
      title: 'Understanding Feedback Settings',
      content: (
        <UnderstandingFeedbackSettings
          roomCode={roomCode}
          onRoomCodeChange={() => {}}
          onGenerateCode={() => {}}
          onClose={hideModal}
        />
      ),
      className: 'bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-xl max-w-md'
    });
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
    <div className="bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 w-full h-full flex flex-col p-4 relative">
      {!roomCode ? (
        <NetworkedWidgetEmpty
          title="Understanding Feedback"
          description="Collect real-time understanding feedback from students"
          icon={<FaGauge className="text-5xl text-warm-gray-400 dark:text-warm-gray-500" />}
          connectionError={connectionError}
          isConnecting={isConnecting}
          onCreateRoom={createRoom}
          createButtonText="Create Feedback Room"
        />
      ) : (
        <>
          <NetworkedWidgetHeader roomCode={roomCode}>
            <div className="flex items-center gap-2">
              <button
                onClick={isActive ? handleStop : handleStart}
                className={`px-3 py-1.5 text-white text-sm rounded transition-colors duration-200 flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-dusty-rose-500 hover:bg-dusty-rose-600'
                    : 'bg-sage-500 hover:bg-sage-600'
                }`}
                title={isActive ? 'Stop Feedback' : 'Start Feedback'}
              >
                {isActive ? (
                  <>
                    <FaStop className="text-xs" />
                    Stop
                  </>
                ) : (
                  <>
                    <FaPlay className="text-xs" />
                    Start
                  </>
                )}
              </button>
              <button
                onClick={openSettings}
                className="p-2 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 rounded transition-colors duration-200"
                title="Settings"
              >
                <FaGear className="text-warm-gray-600 dark:text-warm-gray-400 hover:text-warm-gray-700 dark:hover:text-warm-gray-300 text-sm" />
              </button>
            </div>
          </NetworkedWidgetHeader>

          {/* Status Bar */}
          {isActive && (
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-sage-500' : 
                  isConnecting ? 'bg-warm-gray-400 animate-pulse' : 
                  'bg-dusty-rose-500'
                }`} />
                <span className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
                  {feedbackData.length} student{feedbackData.length !== 1 ? 's' : ''} connected
                </span>
              </div>
            </div>
          )}

          {/* Main Display */}
          <div className="flex-1 overflow-y-auto">
            {!isActive ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-4">
                  <FaGauge className="text-6xl text-warm-gray-300 dark:text-warm-gray-600 mx-auto" />
                  <p className="text-warm-gray-500 dark:text-warm-gray-400">
                    Click Start to begin collecting feedback
                  </p>
                </div>
              </div>
            ) : feedbackData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-warm-gray-500 dark:text-warm-gray-400">
                <p className="text-lg mb-2">Waiting for students to join...</p>
                <p className="text-sm">Students should visit the URL above and enter the code</p>
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
                <div className="flex items-end space-x-2 mb-4" style={{ height: '150px' }}>
                  {distribution.map((count, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center justify-end">
                      <span className="text-sm text-warm-gray-600 dark:text-warm-gray-400 mb-1">
                        {count}
                      </span>
                      <div 
                        className={`w-full ${getBarColor(index)} rounded-t transition-all duration-300`}
                        style={{ 
                          height: `${Math.max((count / maxCount) * 120, 4)}px`,
                          minHeight: '4px'
                        }}
                      />
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

          {/* Clear button */}
          {isActive && feedbackData.length > 0 && (
            <div className="mt-4">
              <button
                onClick={handleClear}
                className="w-full px-3 py-1.5 bg-warm-gray-400 hover:bg-warm-gray-500 text-white text-sm rounded transition-colors duration-200"
              >
                Clear Data
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default UnderstandingFeedback;