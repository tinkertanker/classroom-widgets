import React, { useState, useEffect } from 'react';
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
  'from-sky-400 to-sky-500',
  'from-sage-400 to-sage-500', 
  'from-emerald-400 to-emerald-500',
  'from-amber-400 to-amber-500',
  'from-dusty-rose-400 to-dusty-rose-500'
];

function RTFeedback({ widgetId, savedState, onStateChange }: RTFeedbackProps) {
  const [feedbackData, setFeedbackData] = useState<FeedbackData>({
    understanding: [0, 0, 0, 0, 0],
    totalResponses: 0,
    average: 0
  });
  const [isActive, setIsActive] = useState(true);
  const [showResults, setShowResults] = useState(true);

  // Load saved state
  useEffect(() => {
    if (savedState) {
      setFeedbackData(savedState.feedbackData || {
        understanding: [0, 0, 0, 0, 0],
        totalResponses: 0,
        average: 0
      });
      setIsActive(savedState.isActive !== undefined ? savedState.isActive : true);
      setShowResults(savedState.showResults !== undefined ? savedState.showResults : true);
    }
  }, [savedState]);

  return (
    <NetworkedWidgetWrapper
      widgetId={widgetId}
      savedState={savedState}
      onStateChange={(state) => {
        onStateChange?.({
          ...state,
          feedbackData,
          isActive,
          showResults
        });
      }}
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
          understanding: [0, 0, 0, 0, 0],
          totalResponses: 0,
          average: 0
        });
        setIsActive(false);
      }}
      headerChildren={
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
      }
    >
      {({ session, isRoomActive }) => {
        // Setup socket listeners
        useEffect(() => {
          if (!session.socket) return;

          const handleFeedbackUpdate = (data: FeedbackData) => {
            setFeedbackData(data);
          };

          const handleFeedbackStarted = () => {
            setIsActive(true);
          };

          const handleFeedbackStopped = () => {
            setIsActive(false);
          };

          session.socket.on('rtfeedback:updated', handleFeedbackUpdate);
          session.socket.on('rtfeedback:started', handleFeedbackStarted);
          session.socket.on('rtfeedback:stopped', handleFeedbackStopped);

          return () => {
            session.socket?.off('rtfeedback:updated', handleFeedbackUpdate);
            session.socket?.off('rtfeedback:started', handleFeedbackStarted);
            session.socket?.off('rtfeedback:stopped', handleFeedbackStopped);
          };
        }, [session.socket]);

        // Emit start event when room is created
        useEffect(() => {
          if (session.socket && isRoomActive && isActive) {
            session.socket.emit('session:rtfeedback:start', {
              sessionCode: session.sessionCode
            });
          }
        }, [session.socket, session.sessionCode, isRoomActive]);

        // Handle active state changes
        useEffect(() => {
          if (!session.socket || !isRoomActive) return;
          
          const event = isActive ? 'session:rtfeedback:start' : 'session:rtfeedback:stop';
          session.socket.emit(event, {
            sessionCode: session.sessionCode
          });
        }, [isActive, session.socket, session.sessionCode, isRoomActive]);

        const handleReset = () => {
          if (session.socket && isRoomActive) {
            session.socket.emit('session:rtfeedback:reset', {
              sessionCode: session.sessionCode
            });
          }
        };

        return (
          <>
            <div className="flex-1 flex flex-col mt-2">
              {/* Average display */}
              <div className="text-center mb-2">
                <span className="text-3xl font-bold text-warm-gray-700 dark:text-warm-gray-300">
                  {feedbackData.average.toFixed(1)}
                </span>
                <span className="text-sm text-warm-gray-500 dark:text-warm-gray-400 ml-2">
                  avg
                </span>
              </div>

              {/* Chart */}
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