import React, { useState, useEffect } from 'react';
import { useSessionContext } from '../../contexts/SessionContext';
import { NetworkedWidgetHeader } from '../shared/NetworkedWidgetHeader';
import { NetworkedWidgetEmpty } from '../shared/NetworkedWidgetEmpty';
import { FaChartLine } from 'react-icons/fa6';

interface RTFeedbackProps {
  widgetId?: string;
  savedState?: any;
  onStateChange?: (state: any) => void;
}

interface FeedbackData {
  understanding: number[]; // Array of 5 values (0-100 for each level)
  totalResponses: number;
}

function RTFeedbackSession({ widgetId }: RTFeedbackProps) {
  const [feedbackData, setFeedbackData] = useState<FeedbackData>({
    understanding: [0, 0, 0, 0, 0],
    totalResponses: 0
  });
  const [isRoomActive, setIsRoomActive] = useState(false);
  const [showResults, setShowResults] = useState(true);
  
  const session = useSessionContext();

  // Don't auto-start - let user click start button
  // This prevents multiple widgets from fighting over session creation

  // Setup socket listeners
  useEffect(() => {
    if (!session.socket) return;

    const handleFeedbackUpdate = (data: FeedbackData) => {
      setFeedbackData(data);
    };

    const handleRoomCreated = (data: any) => {
      if (data.roomType === 'rtfeedback') {
        setIsRoomActive(true);
      }
    };

    const handleRoomClosed = (data: any) => {
      if (data.roomType === 'rtfeedback') {
        setIsRoomActive(false);
        // Reset data when room closes
        setFeedbackData({
          understanding: [0, 0, 0, 0, 0],
          totalResponses: 0
        });
      }
    };

    session.socket.on('rtfeedback:update', handleFeedbackUpdate);
    session.socket.on('session:roomCreated', handleRoomCreated);
    session.socket.on('session:roomClosed', handleRoomClosed);

    return () => {
      session.socket.off('rtfeedback:update', handleFeedbackUpdate);
      session.socket.off('session:roomCreated', handleRoomCreated);
      session.socket.off('session:roomClosed', handleRoomClosed);
    };
  }, [session.socket]);

  // Handle widget cleanup
  useEffect(() => {
    const handleWidgetCleanup = (event: CustomEvent) => {
      if (event.detail.widgetId === widgetId && isRoomActive) {
        session.closeRoom('rtfeedback');
      }
    };
    
    window.addEventListener('widget-cleanup' as any, handleWidgetCleanup);
    
    return () => {
      window.removeEventListener('widget-cleanup' as any, handleWidgetCleanup);
    };
  }, [widgetId, isRoomActive, session]);

  const handleStart = async () => {
    try {
      let sessionCode = session.sessionCode;
      
      // Create session if needed
      if (!sessionCode) {
        sessionCode = await session.createSession();
      }
      
      // Create feedback room
      await session.createRoom('rtfeedback');
      
      // Activate the feedback room
      if (session.socket) {
        session.socket.emit('session:rtfeedback:start', {
          sessionCode: sessionCode
        });
      }
      
      setIsRoomActive(true);
    } catch (error) {
      console.error('Failed to start feedback:', error);
    }
  };

  const handleStop = () => {
    if (isRoomActive && session.socket) {
      session.socket.emit('session:rtfeedback:stop', {
        sessionCode: session.sessionCode
      });
    }
  };

  const handleReset = () => {
    if (session.socket && isRoomActive) {
      session.socket.emit('session:rtfeedback:reset', {
        sessionCode: session.sessionCode
      });
    }
  };

  // Empty state
  if (!isRoomActive || !session.sessionCode) {
    return (
      <NetworkedWidgetEmpty
        icon={FaChartLine}
        title="Understanding Feedback"
        description="Real-time student understanding levels"
        buttonText={session.isConnecting ? "Connecting..." : "Start Feedback"}
        onStart={handleStart}
        disabled={session.isConnecting || !session.isConnected}
        error={session.connectionError}
      />
    );
  }

  const maxCount = Math.max(...feedbackData.understanding, 1);
  const emojis = ['😟', '😕', '😐', '🙂', '😊'];
  const labels = ['Lost', 'Confused', 'OK', 'Good', 'Got it!'];

  return (
    <div className="bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 w-full h-full flex flex-col p-4 relative">
      <NetworkedWidgetHeader
        title="Understanding Levels"
        code={session.sessionCode}
        participantCount={session.participantCount}
      />

      <div className="flex-1 flex flex-col mt-4">
        {showResults ? (
          <>
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
                {feedbackData.totalResponses} responses
              </div>
              <button
                onClick={handleReset}
                className="text-sm px-3 py-1 bg-warm-gray-100 dark:bg-warm-gray-700 hover:bg-warm-gray-200 dark:hover:bg-warm-gray-600 rounded transition-colors"
              >
                Reset
              </button>
            </div>

            <div className="flex-1 flex items-end justify-around gap-2 pb-4">
              {feedbackData.understanding.map((count, index) => {
                const percentage = (count / maxCount) * 100 || 0;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div className="relative flex-1 w-full flex items-end">
                      <div 
                        className="w-full bg-gradient-to-t from-sage-500 to-sage-400 rounded-t-md transition-all duration-300"
                        style={{ height: `${percentage}%`, minHeight: '4px' }}
                      >
                        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300">
                          {count}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-2xl">{emojis[index]}</div>
                    <div className="text-xs text-warm-gray-600 dark:text-warm-gray-400 mt-1">
                      {labels[index]}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-4">📊</div>
              <p className="text-warm-gray-600 dark:text-warm-gray-400">
                Results hidden
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between gap-2 mt-2">
        <button
          onClick={() => setShowResults(!showResults)}
          className="flex-1 px-3 py-1.5 text-sm bg-warm-gray-100 dark:bg-warm-gray-700 hover:bg-warm-gray-200 dark:hover:bg-warm-gray-600 rounded transition-colors"
        >
          {showResults ? 'Hide' : 'Show'} Results
        </button>
        <button
          onClick={handleStop}
          className="flex-1 px-3 py-1.5 text-sm bg-dusty-rose-500 hover:bg-dusty-rose-600 text-white rounded transition-colors"
        >
          Stop
        </button>
      </div>
    </div>
  );
}

export default RTFeedbackSession;