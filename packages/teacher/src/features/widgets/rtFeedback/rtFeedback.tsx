import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FaGauge } from 'react-icons/fa6';
import { useNetworkedWidget } from '../../session/hooks/useNetworkedWidget';
import { useNetworkedWidgetState } from '../../session/hooks/useNetworkedWidgetState';
import { NetworkedWidgetEmpty } from '../shared/NetworkedWidgetEmpty';
import { widgetWrapper, widgetContainer } from '@shared/utils/styles';
import { NetworkedWidgetControlBar, NetworkedWidgetOverlays, NetworkedWidgetStats } from '../shared/components';
import { useSocketEvents } from '../../session/hooks/useSocketEvents';
import { withWidgetProvider, WidgetProps } from '../shared/withWidgetProvider';
import { getEmptyStateButtonText, getEmptyStateDisabled } from '../shared/utils/networkedWidgetHelpers';

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

function RTFeedback({ widgetId, savedState, onStateChange }: WidgetProps) {
  // State
  const [feedbackData, setFeedbackData] = useState<FeedbackData>(
    savedState?.feedbackData || {
      understanding: [0, 0, 0, 0, 0, 0, 0, 0, 0],
      totalResponses: 0,
      average: 0
    }
  );

  // Networked widget hook
  const {
    hasRoom,
    isStarting,
    error,
    handleStart,
    session,
    recoveryData
  } = useNetworkedWidget({
    widgetId,
    roomType: 'rtfeedback',
    savedState,
    onStateChange
  });

  // Active state management
  const { isActive: isWidgetActive, toggleActive } = useNetworkedWidgetState({
    widgetId,
    roomType: 'rtfeedback',
    hasRoom,
    recoveryData
  });

  // Socket event handlers (widget-specific only)
  const socketEvents = useMemo(() => ({
    'rtfeedback:dataUpdate': (data: any) => {
      if (data.widgetId === widgetId) {
        const { widgetId: _, ...feedback } = data;
        setFeedbackData(feedback as FeedbackData);
      }
    }
  }), [widgetId]);

  // Use socket events hook for automatic event management
  const { emit } = useSocketEvents({
    events: socketEvents,
    isActive: hasRoom
  });

  // Actions
  const handleReset = useCallback(() => {
    if (!widgetId || !hasRoom) return;
    emit('session:rtfeedback:reset', {
      sessionCode: session.sessionCode!,
      widgetId
    });
  }, [widgetId, hasRoom, emit, session.sessionCode]);

  const handleToggleActive = useCallback(() => {
    if (!hasRoom) return;
    toggleActive();
  }, [hasRoom, toggleActive]);

  // Save state
  useEffect(() => {
    onStateChange?.({
      feedbackData
    });
  }, [feedbackData, onStateChange]);

  // Handle recovery data - restore feedback data after page refresh
  useEffect(() => {
    if (recoveryData && recoveryData.roomData) {
      if (recoveryData.roomData.feedbackData) {
        setFeedbackData(recoveryData.roomData.feedbackData);
      }
    }
  }, [recoveryData]);

  // Empty state - show when no room exists
  if (!hasRoom) {
    return (
      <NetworkedWidgetEmpty
        icon={FaGauge}
        title="RT Feedback"
        description="Get real-time feedback on lesson difficulty"
        buttonText={getEmptyStateButtonText({
          isStarting,
          isRecovering: session.isRecovering,
          isConnected: session.isConnected,
          defaultText: "Start RT Feedback"
        })}
        onStart={handleStart}
        disabled={getEmptyStateDisabled({
          isStarting,
          isRecovering: session.isRecovering,
          isConnected: session.isConnected
        })}
        error={error || undefined}
      />
    );
  }

  // Active state
  return (
    <div className={widgetWrapper}>
      <div className={`${widgetContainer} relative`}>
        {/* Statistics */}
        <NetworkedWidgetStats label="RT Feedback">
          {feedbackData.totalResponses} response{feedbackData.totalResponses !== 1 ? 's' : ''}
        </NetworkedWidgetStats>

        <div className="flex-1 flex flex-col relative p-4 pt-8 overflow-y-auto">
          {/* Overlays */}
          <NetworkedWidgetOverlays
            isActive={isWidgetActive}
            isConnected={session.isConnected}
            isRecovering={session.isRecovering}
            pausedMessage="Feedback is paused"
          />

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

export default withWidgetProvider(RTFeedback, 'RTFeedback');
