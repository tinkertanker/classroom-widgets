import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FaInbox, FaTrash, FaArrowUpRightFromSquare, FaLink, FaFont } from 'react-icons/fa6';
import { useNetworkedWidget } from '../../session/hooks/useNetworkedWidget';
import { useNetworkedWidgetState } from '../../session/hooks/useNetworkedWidgetState';
import { NetworkedWidgetEmpty } from '../shared/NetworkedWidgetEmpty';
import { widgetWrapper, widgetContainer } from '@shared/utils/styles';
import { NetworkedWidgetOverlays, NetworkedWidgetStats, NetworkedWidgetControlBar } from '../shared/components';
import { useSocketEvents } from '../../session/hooks/useSocketEvents';
import { withWidgetProvider, WidgetProps } from '../shared/withWidgetProvider';
import { getEmptyStateButtonText, getEmptyStateDisabled } from '../shared/utils/networkedWidgetHelpers';

interface Submission {
  id: string;
  studentName: string;
  content: string;
  isLink: boolean;
  link?: string; // Legacy field for backward compatibility
  timestamp: number;
}

type AcceptMode = 'links' | 'all';

function LinkShare({ widgetId, savedState, onStateChange }: WidgetProps) {
  // State
  const [submissions, setSubmissions] = useState<Submission[]>(
    savedState?.submissions || []
  );
  const [acceptMode, setAcceptMode] = useState<AcceptMode>(
    savedState?.acceptMode || 'all'
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
    'linkShare:submissionAdded': (data: any) => {
      if (data.widgetId === widgetId) {
        const { widgetId: _, ...submission } = data;
        // Handle both new format (content/isLink) and legacy format (link only)
        const normalizedSubmission: Submission = {
          id: submission.id,
          studentName: submission.studentName,
          content: submission.content || submission.link,
          isLink: submission.isLink !== undefined ? submission.isLink : true,
          link: submission.link,
          timestamp: submission.timestamp
        };
        setSubmissions(prev => [...prev, normalizedSubmission]);
      }
    },
    'linkShare:submissionDeleted': (data: { submissionId: string; widgetId?: string }) => {
      if (data.widgetId === widgetId) {
        setSubmissions(prev => prev.filter(s => s.id !== data.submissionId));
      }
    },
    'linkShare:stateUpdate': (data: { widgetId?: string; acceptMode?: AcceptMode }) => {
      if (data.widgetId === widgetId && data.acceptMode) {
        setAcceptMode(data.acceptMode);
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

  const handleToggleAcceptMode = useCallback(() => {
    if (!widgetId || !hasRoom) return;
    const newMode: AcceptMode = acceptMode === 'links' ? 'all' : 'links';
    setAcceptMode(newMode);
    emit('session:linkShare:setAcceptMode', {
      sessionCode: session.sessionCode!,
      widgetId,
      acceptMode: newMode
    });
  }, [widgetId, hasRoom, acceptMode, emit, session.sessionCode]);

  // Save state
  useEffect(() => {
    onStateChange?.({
      submissions,
      acceptMode
    });
  }, [submissions, acceptMode, onStateChange]);

  // Handle recovery data - restore submissions and settings after page refresh
  useEffect(() => {
    if (recoveryData && recoveryData.roomData) {
      if (recoveryData.roomData.submissions && Array.isArray(recoveryData.roomData.submissions)) {
        // Normalize submissions to handle both old and new formats
        const normalizedSubmissions = recoveryData.roomData.submissions.map((s: any) => ({
          id: s.id,
          studentName: s.studentName,
          content: s.content || s.link,
          isLink: s.isLink !== undefined ? s.isLink : true,
          link: s.link,
          timestamp: s.timestamp
        }));
        setSubmissions(normalizedSubmissions);
      }
      if (recoveryData.roomData.acceptMode) {
        setAcceptMode(recoveryData.roomData.acceptMode);
      }
    }
  }, [recoveryData]);

  // Empty state - show when no room exists
  if (!hasRoom) {
    return (
      <NetworkedWidgetEmpty
        icon={FaInbox}
        title="Drop Box"
        description="Collect links or text from students"
        buttonText={getEmptyStateButtonText({
          isStarting,
          isRecovering: session.isRecovering,
          isConnected: session.isConnected,
          defaultText: "Start Drop Box"
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
        <NetworkedWidgetStats label="Drop Box">
          {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
        </NetworkedWidgetStats>

        {/* Overlays - outside scrollable area */}
        <NetworkedWidgetOverlays
          isActive={isWidgetActive}
          isConnected={session.isConnected}
          isRecovering={session.isRecovering}
          pausedMessage="Drop Box is paused"
        />

        {/* Submissions list */}
        <div className="flex-1 overflow-y-auto space-y-2 p-4 pt-8">
          {submissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-warm-gray-400 dark:text-warm-gray-600">
              <FaInbox className="text-4xl mb-2" />
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
                      {submission.isLink ? (
                        <a
                          href={submission.content}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-sage-600 hover:text-sage-700 dark:text-sage-400 dark:hover:text-sage-300 break-all inline-flex items-center gap-1 mt-1"
                        >
                          {submission.content}
                          <FaArrowUpRightFromSquare className="text-[10px] flex-shrink-0" />
                        </a>
                      ) : (
                        <p className="text-sm text-warm-gray-600 dark:text-warm-gray-300 mt-1 whitespace-pre-wrap break-words">
                          {submission.content}
                        </p>
                      )}
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
        showClear={submissions.length > 0}
        activeLabel="Pause submissions"
        inactiveLabel="Resume submissions"
        showSettings={false}
        clearVariant="clear"
        requireClearConfirmation={true}
        clearConfirmationMessage="Are you sure you want to clear all submissions?"
        rightContent={
          <button
            onClick={handleToggleAcceptMode}
            disabled={!session.isConnected}
            className={`px-2 py-1 text-xs font-medium rounded transition-colors inline-flex items-center gap-1.5 ${
              acceptMode === 'all'
                ? 'bg-slate-blue-100 text-slate-blue-700 dark:bg-slate-blue-900/30 dark:text-slate-blue-400'
                : 'bg-warm-gray-100 text-warm-gray-600 dark:bg-warm-gray-700 dark:text-warm-gray-400'
            } hover:bg-slate-blue-200 dark:hover:bg-slate-blue-900/50 disabled:opacity-50 disabled:cursor-not-allowed`}
            title={acceptMode === 'all' ? 'Accepting links and text' : 'Accepting links only'}
          >
            {acceptMode === 'all' ? (
              <>
                <FaFont className="text-[10px]" />
                <span>Links + Text</span>
              </>
            ) : (
              <>
                <FaLink className="text-[10px]" />
                <span>Links Only</span>
              </>
            )}
          </button>
        }
      />
    </div>
  );
}

export default withWidgetProvider(LinkShare, 'LinkShare');
