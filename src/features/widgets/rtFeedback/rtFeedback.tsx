import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NetworkedWidgetWrapper } from '../shared/NetworkedWidgetWrapper';
import { useWidgetSocket } from '../shared/hooks/useWidgetSocket';
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
  const [isActive, setIsActive] = useState(false);
  const [showResults, setShowResults] = useState(true);
  const toggleActiveRef = useRef<(() => void) | null>(null);

  // Load saved state
  useEffect(() => {
    if (savedState) {
      setFeedbackData(savedState.feedbackData || {
        understanding: [0, 0, 0, 0, 0, 0, 0, 0, 0],
        totalResponses: 0,
        average: 0
      });
      setIsActive(savedState.isActive !== undefined ? savedState.isActive : false);
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
        // Don't automatically start - let server state control this
        // Server starts with isActive: false by default
      }}
      onRoomClosed={() => {
        setFeedbackData({
          understanding: [0, 0, 0, 0, 0, 0, 0, 0, 0],
          totalResponses: 0,
          average: 0
        });
        setIsActive(false);
      }}
      headerChildren={({ session, isRoomActive }) => {
        if (!session || !isRoomActive || !toggleActiveRef.current) return null;
        
        return (
          <button
            onClick={toggleActiveRef.current}
            className={`p-1.5 rounded transition-colors duration-200 ${
              isActive 
                ? 'bg-dusty-rose-500 hover:bg-dusty-rose-600 text-white' 
                : 'bg-sage-500 hover:bg-sage-600 text-white'
            }`}
            title={isActive ? "Pause feedback" : "Resume feedback"}
          >
            {isActive ? <FaPause /> : <FaPlay />}
          </button>
        );
      }}
    >
      {({ session, isRoomActive }) => {
        // Define socket event handlers
        const socketEvents = {
          'rtfeedback:update': (data: FeedbackData & { widgetId?: string }) => {
            // Only handle updates for this specific widget
            if (data.widgetId === widgetId || (!data.widgetId && !widgetId)) {
              const { widgetId: _, ...feedbackData } = data;
              setFeedbackData(feedbackData);
            }
          },
          'rtfeedback:stateChanged': (data: { isActive: boolean; widgetId?: string }) => {
            // Only handle state changes for this specific widget
            if (data.widgetId === widgetId || (!data.widgetId && !widgetId)) {
              setIsActive(data.isActive);
            }
          }
        };

        // Use the widget socket hook to manage socket connections and events
        const { emitWidgetEvent, toggleActive } = useWidgetSocket({
          socket: session.socket,
          sessionCode: session.sessionCode,
          roomType: 'rtfeedback',
          widgetId,
          isActive,
          isRoomActive,
          events: socketEvents
        });

        // Store toggleActive in ref so header can access it
        useEffect(() => {
          toggleActiveRef.current = () => toggleActive(!isActive);
        }, [toggleActive, isActive]);

        const handleReset = () => {
          emitWidgetEvent('reset');
        };

        return (
          <>
            {/* Response count */}
            <div className="text-sm text-warm-gray-600 dark:text-warm-gray-400 mb-3">
              {feedbackData.totalResponses} responses
            </div>

            <div className="flex-1 flex flex-col relative">
              {/* Paused overlay */}
              {!isActive && isRoomActive && session.isConnected && (
                <div className="absolute inset-0 bg-white/60 dark:bg-warm-gray-800/60 backdrop-blur-[2px] rounded-lg flex items-center justify-center z-10">
                  <div className="text-center bg-white/90 dark:bg-warm-gray-800/90 rounded-lg px-6 py-4 shadow-lg">
                    <p className="text-warm-gray-700 dark:text-warm-gray-300 font-medium mb-2">Feedback is paused</p>
                    <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400">Click play to resume</p>
                  </div>
                </div>
              )}
              {showResults ? (
                <>
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