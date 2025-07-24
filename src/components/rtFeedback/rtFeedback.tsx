import React, { useState, useEffect, useCallback } from 'react';
import { NetworkedWidgetWrapper } from '../shared/NetworkedWidgetWrapper';
import { FaGauge, FaPlay, FaPause } from 'react-icons/fa6';

interface RTFeedbackProps {
  widgetId?: string;
  savedState?: any;
  onStateChange?: (state: any) => void;
}

interface FeedbackData {
  understanding: number[];
  totalResponses: number;
  average: number;
}

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

function RTFeedback({ widgetId, savedState, onStateChange }: RTFeedbackProps) {
  const [feedbackData, setFeedbackData] = useState<FeedbackData>({
    understanding: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    totalResponses: 0,
    average: 0
  });
  const [isActive, setIsActive] = useState(true);
  const [showResults, setShowResults] = useState(true);

  // Load saved state
  useEffect(() => {
    if (savedState) {
      setFeedbackData(savedState.feedbackData || {
        understanding: [0, 0, 0, 0, 0, 0, 0, 0, 0],
        totalResponses: 0,
        average: 0
      });
      setIsActive(savedState.isActive !== undefined ? savedState.isActive : true);
      setShowResults(savedState.showResults !== undefined ? savedState.showResults : true);
    }
  }, [savedState]);

  const handleStateChange = useCallback((state: any) => {
    onStateChange?.({
      ...state,
      feedbackData,
      isActive,
      showResults
    });
  }, [onStateChange, feedbackData, isActive, showResults]);

  return (
    <NetworkedWidgetWrapper
      widgetId={widgetId}
      savedState={savedState}
      onStateChange={handleStateChange}
      roomType="rtfeedback"
      title="RT Feedback"
      description="Get real-time feedback on lesson difficulty"
      icon={FaGauge}
      onRoomCreated={() => {
        // Start accepting feedback automatically when room is created
        setIsActive(true);
      }}
      onRoomClosed={() => {
        setFeedbackData({
          understanding: [0, 0, 0, 0, 0, 0, 0, 0, 0],
          totalResponses: 0,
          average: 0
        });
        setIsActive(false);
      }}
      headerChildren={null}
    >
      {({ session, isRoomActive }) => {
        // Join the widget-specific room
        useEffect(() => {
          if (!session.socket || !session.sessionCode || !isRoomActive) return;
          
          // Join the room for this specific widget instance
          session.socket.emit('session:joinRoom', { 
            sessionCode: session.sessionCode,
            roomType: 'rtfeedback',
            widgetId 
          });
          
          return () => {
            session.socket?.emit('session:leaveRoom', { 
              sessionCode: session.sessionCode,
              roomType: 'rtfeedback',
              widgetId 
            });
          };
        }, [session.socket, session.sessionCode, isRoomActive, widgetId]);

        // Setup socket listeners
        useEffect(() => {
          if (!session.socket) return;

          const handleFeedbackUpdate = (data: FeedbackData & { widgetId?: string }) => {
            // Only handle updates for this specific widget
            if (data.widgetId === widgetId || (!data.widgetId && !widgetId)) {
              const { widgetId: _, ...feedbackData } = data;
              setFeedbackData(feedbackData);
            }
          };

          const handleStateChanged = (data: { isActive: boolean; widgetId?: string }) => {
            // Only handle state changes for this specific widget
            if (data.widgetId === widgetId || (!data.widgetId && !widgetId)) {
              setIsActive(data.isActive);
            }
          };

          session.socket.on('rtfeedback:update', handleFeedbackUpdate);
          session.socket.on('rtfeedback:stateChanged', handleStateChanged);

          return () => {
            session.socket?.off('rtfeedback:update', handleFeedbackUpdate);
            session.socket?.off('rtfeedback:stateChanged', handleStateChanged);
          };
        }, [session.socket, widgetId]);

        // Emit start event when room is created
        useEffect(() => {
          if (session.socket && isRoomActive && isActive) {
            session.socket.emit('session:rtfeedback:start', {
              sessionCode: session.sessionCode,
              widgetId
            });
          }
        }, [session.socket, session.sessionCode, isRoomActive, widgetId]);

        // Handle active state changes
        useEffect(() => {
          if (!session.socket || !isRoomActive) return;
          
          const event = isActive ? 'session:rtfeedback:start' : 'session:rtfeedback:stop';
          session.socket.emit(event, {
            sessionCode: session.sessionCode,
            widgetId
          });
        }, [isActive, session.socket, session.sessionCode, isRoomActive, widgetId]);

        const handleReset = () => {
          if (session.socket && isRoomActive) {
            session.socket.emit('session:rtfeedback:reset', {
              sessionCode: session.sessionCode,
              widgetId
            });
          }
        };

        return (
          <>
            {/* Header controls */}
            <div className="absolute top-4 right-4 z-10">
              <button
                onClick={() => setIsActive(!isActive)}
                className={`p-1.5 rounded transition-colors duration-200 ${
                  isActive 
                    ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                    : 'bg-sage-500 hover:bg-sage-600 text-white'
                }`}
                title={isActive ? "Pause feedback" : "Resume feedback"}
              >
                {isActive ? <FaPause /> : <FaPlay />}
              </button>
            </div>

            <div className="flex-1 flex flex-col">
              {showResults ? (
                <>
                  <div className="flex justify-between items-center mb-1">
                    <div className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
                      {feedbackData.totalResponses} responses
                    </div>
                  </div>

                  <div className="flex-1 flex items-end justify-around gap-1 pb-1">
                    {feedbackData.understanding.map((count, index) => {
                      const maxCount = Math.max(...feedbackData.understanding, 1);
                      const percentage = (count / maxCount) * 100 || 0;
                      return (
                        <div key={index} className="flex-1 flex flex-col items-center">
                          <div className="relative w-full h-32 flex items-end">
                            <div 
                              className={`absolute bottom-0 w-full bg-gradient-to-t ${barColors[index]} rounded-t-md transition-all duration-300`}
                              style={{ height: `${percentage}%`, minHeight: '1px' }}
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

            <div className="flex justify-between gap-2 mt-1">
              <button
                onClick={() => setShowResults(!showResults)}
                className="flex-1 px-3 py-1.5 text-sm bg-sage-500 hover:bg-sage-600 text-white rounded transition-colors"
              >
                {showResults ? 'Hide' : 'Show'} Results
              </button>
              <button
                onClick={handleReset}
                className="flex-1 px-3 py-1.5 text-sm bg-sage-500 hover:bg-sage-600 text-white rounded transition-colors"
              >
                Reset
              </button>
            </div>
          </>
        );
      }}
    </NetworkedWidgetWrapper>
  );
}

export default RTFeedback;