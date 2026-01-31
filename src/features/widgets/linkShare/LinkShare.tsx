import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FaLink, FaTrash, FaArrowUpRightFromSquare } from 'react-icons/fa6';
import { useNetworkedWidget } from '../../session/hooks/useNetworkedWidget';
import { useNetworkedWidgetState } from '../../session/hooks/useNetworkedWidgetState';
import { NetworkedWidgetEmpty } from '../shared/NetworkedWidgetEmpty';
import { widgetWrapper, widgetContainer } from '../../../shared/utils/styles';
import { NetworkedWidgetControlBar, NetworkedWidgetOverlays, NetworkedWidgetStats } from '../shared/components';
import { useSocketEvents } from '../../session/hooks/useSocketEvents';
import { withWidgetProvider, WidgetProps } from '../shared/withWidgetProvider';
import { getEmptyStateButtonText, getEmptyStateDisabled } from '../shared/utils/networkedWidgetHelpers';

interface Submission {
  id: string;
  studentName: string;
  link: string;
  timestamp: number;
}

function LinkShare({ widgetId, savedState, onStateChange }: WidgetProps) {
  // State
  const [submissions, setSubmissions] = useState<Submission[]>(
    savedState?.submissions || []
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
    roomType: 'linkShare',
    savedState,
    onStateChange
  });

  // Active state management
  const { isActive: isWidgetActive, toggleActive } = useNetworkedWidgetState({
    widgetId,
    roomType: 'linkShare',
    hasRoom,
    recoveryData
  });

  // Socket event handlers (widget-specific only)
  const socketEvents = useMemo(() => ({
    'linkShare:newSubmission': (data: any) => {
      if (data.widgetId === widgetId) {
        const { widgetId: _, ...submission } = data;
        setSubmissions(prev => [...prev, submission as Submission]);
      }
    },
    'linkShare:submissionDeleted': (data: { submissionId: string; widgetId?: string }) => {
      if (data.widgetId === widgetId) {
        setSubmissions(prev => prev.filter(s => s.id !== data.submissionId));
      }
    }
  }), [widgetId]);

  // Use socket events hook for automatic event management
  const { emit } = useSocketEvents({
    events: socketEvents,
    isActive: hasRoom
  });

  // Actions
  const handleDeleteSubmission = useCallback((submissionId: string) => {
    if (!widgetId || !hasRoom) return;
    emit('session:linkShare:delete', {
      sessionCode: session.sessionCode!,
      widgetId,
      submissionId
    });
  }, [widgetId, hasRoom, emit, session.sessionCode]);

  const handleClearAll = useCallback(() => {
    // Clear local state (server maintains submission state)
    setSubmissions([]);
  }, []);

  const handleToggleActive = useCallback(() => {
    if (!hasRoom) return;
    toggleActive();
  }, [hasRoom, toggleActive]);

  // Save state
  useEffect(() => {
    onStateChange?.({
      submissions
    });
  }, [submissions, onStateChange]);

  // Handle recovery data - restore submissions after page refresh
  useEffect(() => {
    if (recoveryData && recoveryData.roomData) {
      if (recoveryData.roomData.submissions && Array.isArray(recoveryData.roomData.submissions)) {
        setSubmissions(recoveryData.roomData.submissions);
      }
    }
  }, [recoveryData]);

  // Empty state - show when no room exists
  if (!hasRoom) {
    return (
      <NetworkedWidgetEmpty
        icon={FaLink}
        title="Link Share"
        description="Collect links and resources from students"
        buttonText={getEmptyStateButtonText({
          isStarting,
          isRecovering: session.isRecovering,
          isConnected: session.isConnected,
          defaultText: "Start Link Share"
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
        <NetworkedWidgetStats>
          {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
        </NetworkedWidgetStats>

        {/* Overlays - outside scrollable area */}
        <NetworkedWidgetOverlays
          isActive={isWidgetActive}
          isConnected={session.isConnected}
          isRecovering={session.isRecovering}
          pausedMessage="Link sharing is paused"
        />

        {/* Submissions list */}
        <div className="flex-1 overflow-y-auto space-y-2 p-4 pt-8">
          {submissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-warm-gray-400 dark:text-warm-gray-600">
              <FaLink className="text-4xl mb-2" />
              <p className="text-sm">Waiting for student submissions...</p>
            </div>
          ) : (
            <div className="space-y-2">
              {submissions.map((submission) => (
                <div
                  key={submission.id}
                  className="bg-white dark:bg-warm-gray-700 rounded-lg p-3 shadow-sm border border-warm-gray-200 dark:border-warm-gray-600"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-warm-gray-800 dark:text-warm-gray-200">
                        {submission.studentName || 'Anonymous'}
                      </p>
                      <a
                        href={submission.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-sage-600 hover:text-sage-700 dark:text-sage-400 dark:hover:text-sage-300 break-all inline-flex items-center gap-1 mt-1"
                      >
                        {submission.link}
                        <FaArrowUpRightFromSquare className="text-[10px] flex-shrink-0" />
                      </a>
                    </div>
                    <button
                      onClick={() => handleDeleteSubmission(submission.id)}
                      className="text-warm-gray-400 hover:text-dusty-rose-600 dark:hover:text-dusty-rose-400 transition-colors p-1"
                      title="Delete submission"
                    >
                      <FaTrash className="text-xs" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Control bar */}
      <NetworkedWidgetControlBar
        isActive={isWidgetActive}
        isConnected={session.isConnected}
        onToggleActive={handleToggleActive}
        onClear={handleClearAll}
        clearCount={submissions.length}
        clearLabel="Clear all"
        activeLabel="Pause accepting links"
        inactiveLabel="Start accepting links"
        showSettings={false}
        showClear={submissions.length > 0}
        clearVariant="clear"
        requireClearConfirmation={true}
        clearConfirmationMessage="Are you sure you want to clear all submissions?"
      />
    </div>
  );
}

export default withWidgetProvider(LinkShare, 'LinkShare');
