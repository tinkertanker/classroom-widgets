import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FaGauge } from 'react-icons/fa6';
import { useModal } from '../../../contexts/ModalContext';
import { WidgetProvider } from '../../../contexts/WidgetContext';
import { useNetworkedWidget } from '../../session/hooks/useNetworkedWidget';
import { NetworkedWidgetEmpty } from '../shared/NetworkedWidgetEmpty';
import { widgetWrapper, widgetContainer, cn } from '../../../shared/utils/styles';
import { NetworkedWidgetControlBar } from '../shared/components';
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

  // Save state
  useEffect(() => {
    onStateChange?.({
      feedbackData,
      isActive: isWidgetActive
    });
  }, [feedbackData, isWidgetActive, onStateChange]);
  
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
    <div className={widgetWrapper}>
      <div className={`${widgetContainer} relative`}>
        {/* Statistics - Floating top-right */}
        <div className="absolute top-3 right-3 z-20">
          <span className="text-sm text-warm-gray-500 dark:text-warm-gray-400">
            {feedbackData.totalResponses} response{feedbackData.totalResponses !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex-1 flex flex-col relative p-4 pt-8">
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
          </div>
        </div>

        {/* Connection status for debugging */}
        {!session.isConnected && (
          <div className="absolute bottom-2 right-2 text-xs text-warm-gray-400">
            Disconnected
          </div>
        )}
      </div>

      {/* Control bar */}
      <NetworkedWidgetControlBar
        isActive={isWidgetActive}
        isConnected={session.isConnected}
        onToggleActive={handleToggleActive}
        onClear={handleReset}
        clearCount={feedbackData.totalResponses}
        clearLabel="Clear all"
        activeLabel="Pause feedback"
        inactiveLabel="Start feedback"
        showSettings={false}
        clearVariant="clear"
      />
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