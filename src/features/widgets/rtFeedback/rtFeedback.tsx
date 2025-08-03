import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FaPlay, FaPause, FaGauge } from 'react-icons/fa6';
import { useModal } from '../../../contexts/ModalContext';
import { WidgetProvider } from '../../../contexts/WidgetContext';
import { useNetworkedWidget } from '../../session/hooks/useNetworkedWidget';
import { NetworkedWidgetEmpty } from '../shared/NetworkedWidgetEmpty';
import { NetworkedWidgetHeader } from '../shared/NetworkedWidgetHeader';
import { useSocketEvents } from '../../session/hooks/useSocketEvents';
import { useSession } from '../../../contexts/SessionContext';

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
  // State
  const [feedbackData, setFeedbackData] = useState<FeedbackData>(
    savedState?.feedbackData || {
      understanding: [0, 0, 0, 0, 0, 0, 0, 0, 0],
      totalResponses: 0,
      average: 0
    }
  );
  const [isWidgetActive, setIsWidgetActive] = useState(false);
  const [showResults, setShowResults] = useState(
    savedState?.showResults !== undefined ? savedState.showResults : true
  );
  
  // Hooks
  const { showModal, hideModal } = useModal();
  
  // Networked widget hook
  const {
    hasRoom,
    isStarting,
    error,
    handleStart,
    handleStop,
    session,
    recoveryData
  } = useNetworkedWidget({
    widgetId,
    roomType: 'rtfeedback',
    savedState,
    onStateChange
  });
  
  // Get unified session for additional methods
  const unifiedSession = useSession();
  
  // Socket event handlers
  const socketEvents = useMemo(() => ({
    'rtfeedback:update': (data: any) => {
      if (data.widgetId === widgetId) {
        const { widgetId: _, ...feedback } = data;
        setFeedbackData(feedback as FeedbackData);
      }
    },
    'session:widgetStateChanged': (data: { roomType: string; widgetId?: string; isActive: boolean }) => {
      if (data.roomType === 'rtfeedback' && (data.widgetId === widgetId || (!data.widgetId && !widgetId))) {
        setIsWidgetActive(data.isActive);
      }
    }
  }), [widgetId]);
  
  // Use socket events hook for automatic event management
  const { emit } = useSocketEvents({
    events: socketEvents,
    isActive: hasRoom
  });
  
  // Toggle active state using unified session
  const toggleActive = useCallback((newState: boolean) => {
    if (!widgetId || !hasRoom) return;
    unifiedSession.updateRoomState('rtfeedback', widgetId, newState);
  }, [widgetId, hasRoom, unifiedSession]);
  
  // Actions
  const handleReset = useCallback(() => {
    if (!widgetId || !hasRoom) return;
    emit('session:rtfeedback:reset', {
      sessionCode: session.sessionCode,
      widgetId
    });
  }, [widgetId, hasRoom, emit, session.sessionCode]);
  
  const handleToggleActive = useCallback(() => {
    if (!hasRoom) return;
    toggleActive(!isWidgetActive);
  }, [isWidgetActive, hasRoom, toggleActive]);
  
  const handleToggleResults = useCallback(() => {
    setShowResults(!showResults);
  }, [showResults]);
  
  // Save state
  useEffect(() => {
    onStateChange?.({
      feedbackData,
      isActive: isWidgetActive,
      showResults
    });
  }, [feedbackData, isWidgetActive, showResults, onStateChange]);
  
  // Handle recovery data
  useEffect(() => {
    if (recoveryData && recoveryData.roomData) {
      // TODO: Apply recovered state if needed
    }
  }, [recoveryData]);
  
  // Empty state - show when no room exists
  if (!hasRoom) {
    return (
      <NetworkedWidgetEmpty
        icon={FaGauge}
        title="RT Feedback"
        description="Get real-time feedback on lesson difficulty"
        buttonText={
          isStarting ? "Starting..." : 
          session.isRecovering ? "Reconnecting..." :
          !session.isConnected ? "Connecting..." : 
          "Start RT Feedback"
        }
        onStart={handleStart}
        disabled={isStarting || !session.isConnected || session.isRecovering}
        error={error || undefined}
      />
    );
  }
  
  // Active state
  return (
    <div className="bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 w-full h-full flex flex-col p-4 relative">
      {/* Header */}
      <NetworkedWidgetHeader 
        title="RT Feedback"
        code={session.sessionCode || ''}
        participantCount={session.participantCount}
        icon={FaGauge}
      >
        <div className="flex gap-2">
          <button
            onClick={handleToggleActive}
            disabled={!session.isConnected}
            className={`p-2 rounded ${
              isWidgetActive 
                ? 'text-dusty-rose-600 hover:text-dusty-rose-700 dark:text-dusty-rose-400 dark:hover:text-dusty-rose-300 hover:bg-dusty-rose-100 dark:hover:bg-dusty-rose-900/20' 
                : 'text-sage-600 hover:text-sage-700 dark:text-sage-400 dark:hover:text-sage-300 hover:bg-sage-100 dark:hover:bg-sage-900/20'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={isWidgetActive ? "Pause feedback" : "Start feedback"}
          >
            {isWidgetActive ? <FaPause className="text-base" /> : <FaPlay className="text-base" />}
          </button>
        </div>
      </NetworkedWidgetHeader>
      
      {/* Response count */}
      <div className="text-sm text-warm-gray-600 dark:text-warm-gray-400 mb-3 mt-4">
        {feedbackData.totalResponses} responses
      </div>

      <div className="flex-1 flex flex-col relative">
        {/* Paused overlay */}
        {!isWidgetActive && session.isConnected && (
          <div className="absolute inset-0 bg-white/60 dark:bg-warm-gray-800/60 backdrop-blur-[2px] rounded-lg flex items-center justify-center z-10">
            <div className="text-center bg-white/90 dark:bg-warm-gray-800/90 rounded-lg px-6 py-4 shadow-lg">
              <p className="text-warm-gray-700 dark:text-warm-gray-300 font-medium mb-2">Feedback is paused</p>
              <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400">Click play to resume</p>
            </div>
          </div>
        )}
        
        <div className="flex-1 flex flex-col">
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
            onClick={handleToggleResults}
            className="flex-1 px-3 py-1.5 text-sm bg-sage-100 hover:bg-sage-200 dark:bg-sage-900/30 dark:hover:bg-sage-900/40 border border-sage-500 dark:border-sage-400 text-sage-700 dark:text-sage-300 rounded transition-colors"
          >
            {showResults ? 'Hide' : 'Show'} Results
          </button>
          <button
            onClick={handleReset}
            className="flex-1 px-3 py-1.5 text-sm bg-sage-100 hover:bg-sage-200 dark:bg-sage-900/30 dark:hover:bg-sage-900/40 border border-sage-500 dark:border-sage-400 text-sage-700 dark:text-sage-300 rounded transition-colors"
          >
            Reset
          </button>
        </div>
      </div>
      
      {/* Connection status for debugging */}
      {!session.isConnected && (
        <div className="absolute bottom-2 right-2 text-xs text-warm-gray-400">
          Disconnected
        </div>
      )}
    </div>
  );
}

// Export wrapped component to ensure WidgetProvider is available
const RTFeedbackWithProvider = (props: RTFeedbackProps) => {
  return (
    <WidgetProvider {...props}>
      <RTFeedback {...props} />
    </WidgetProvider>
  );
};

export default RTFeedbackWithProvider;