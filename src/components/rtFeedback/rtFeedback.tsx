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
  understanding: number[]; // Array of 9 values for levels 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5
  totalResponses: number;
}

function RTFeedback({ widgetId }: RTFeedbackProps) {
  const [feedbackData, setFeedbackData] = useState<FeedbackData>({
    understanding: [0, 0, 0, 0, 0, 0, 0, 0, 0], // 9 values for 0.5 increments
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
          understanding: [0, 0, 0, 0, 0, 0, 0, 0, 0],
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

  const labels = ['1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5'];
  const barColors = [
    'from-red-700 to-red-600',         // 1 - Too Easy (dark red)
    'from-amber-700 to-amber-600',     // 1.5 - (dark amber)
    'from-yellow-700 to-yellow-600',   // 2 - Easy (dark yellow)
    'from-lime-700 to-lime-600',       // 2.5 - (dark lime)
    'from-emerald-700 to-emerald-600', // 3 - Just Right (dark emerald)
    'from-lime-700 to-lime-600',       // 3.5 - (dark lime)
    'from-yellow-700 to-yellow-600',   // 4 - Hard (dark yellow)
    'from-amber-700 to-amber-600',     // 4.5 - (dark amber)
    'from-red-700 to-red-600'          // 5 - Too Hard (dark red)
  ];

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
            <div className="flex justify-between items-center mb-2">
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

            <div className="flex-1 flex items-end justify-around gap-1 pb-2">
              {feedbackData.understanding.map((count, index) => {
                const maxCount = Math.max(...feedbackData.understanding, 1);
                const percentage = (count / maxCount) * 100 || 0;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div className="relative w-full h-32 flex items-end">
                      <div 
                        className={`absolute bottom-0 w-full bg-gradient-to-t ${barColors[index]} rounded-t-md transition-all duration-300`}
                        style={{ height: `${percentage}%`, minHeight: '4px' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Descriptive labels */}
            <div className="flex justify-between px-4 text-xs text-warm-gray-500">
              <span>Too Easy</span>
              <span>Easy</span>
              <span>Just Right</span>
              <span>Hard</span>
              <span>Too Hard</span>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
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

export default RTFeedback;