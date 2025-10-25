import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FaPlay, FaPause, FaLink, FaTrash, FaArrowUpRightFromSquare } from 'react-icons/fa6';
import { useModal } from '../../../contexts/ModalContext';
import { WidgetProvider } from '../../../contexts/WidgetContext';
import { useNetworkedWidget } from '../../session/hooks/useNetworkedWidget';
import { NetworkedWidgetEmpty } from '../shared/NetworkedWidgetEmpty';
import { buttons, widgetControls, widgetWrapper, widgetContainer, cn } from '../../../shared/utils/styles';
import { useSocketEvents } from '../../session/hooks/useSocketEvents';
import { useSession } from '../../../contexts/SessionContext';

interface LinkShareProps {
  widgetId?: string;
  savedState?: any;
  onStateChange?: (state: any) => void;
}

interface Submission {
  id: string;
  studentName: string;
  link: string;
  timestamp: number;
}

function LinkShare({ widgetId, savedState, onStateChange }: LinkShareProps) {
  // State
  const [submissions, setSubmissions] = useState<Submission[]>(
    savedState?.submissions || []
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
    roomType: 'linkShare',
    savedState,
    onStateChange
  });
  
  // Get unified session for additional methods
  const unifiedSession = useSession();
  
  // Socket event handlers
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
    },
    'session:widgetStateChanged': (data: { roomType: string; widgetId?: string; isActive: boolean }) => {
      if (data.roomType === 'linkShare' && (data.widgetId === widgetId || (!data.widgetId && !widgetId))) {
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
    unifiedSession.updateRoomState('linkShare', widgetId, newState);
  }, [widgetId, hasRoom, unifiedSession]);
  
  // Actions
  const handleDeleteSubmission = useCallback((submissionId: string) => {
    if (!widgetId || !hasRoom) return;
    emit('session:linkShare:delete', {
      sessionCode: session.sessionCode,
      widgetId,
      submissionId
    });
  }, [widgetId, hasRoom, emit, session.sessionCode]);
  
  const handleClearAll = useCallback(() => {
    if (window.confirm('Are you sure you want to clear all submissions?')) {
      setSubmissions([]);
      // Note: Server maintains submission state, clearing here only affects local display
      // If server-side clearing is needed, implement session:linkShare:clearAll event
    }
  }, []);
  
  const handleToggleActive = useCallback(() => {
    if (!hasRoom) return;
    toggleActive(!isWidgetActive);
  }, [isWidgetActive, hasRoom, toggleActive]);
  
  // Save state
  useEffect(() => {
    onStateChange?.({
      submissions,
      isActive: isWidgetActive
    });
  }, [submissions, isWidgetActive, onStateChange]);
  
  // Handle recovery data - restore widget state after page refresh
  useEffect(() => {
    if (recoveryData && recoveryData.roomData) {
      // Restore submissions from recovery data
      if (recoveryData.roomData.submissions && Array.isArray(recoveryData.roomData.submissions)) {
        setSubmissions(recoveryData.roomData.submissions);
      }

      // Restore active state
      if (typeof recoveryData.roomData.isActive === 'boolean') {
        setIsWidgetActive(recoveryData.roomData.isActive);
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
        buttonText={
          isStarting ? "Starting..." : 
          session.isRecovering ? "Reconnecting..." :
          !session.isConnected ? "Connecting..." : 
          "Start Link Share"
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
            {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Submissions list */}
        <div className="flex-1 overflow-y-auto space-y-2 relative p-4 pt-8">
          {/* Paused overlay */}
          {!isWidgetActive && session.isConnected && (
            <div className="absolute inset-0 bg-white/60 dark:bg-warm-gray-800/60 backdrop-blur-[2px] rounded-lg flex items-center justify-center z-10">
              <div className="text-center bg-white/90 dark:bg-warm-gray-800/90 rounded-lg px-6 py-4 shadow-lg">
                <p className="text-warm-gray-700 dark:text-warm-gray-300 font-medium mb-2">Link sharing is paused</p>
                <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400">Click play to resume</p>
              </div>
            </div>
          )}

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

        {/* Connection status for debugging */}
        {!session.isConnected && (
          <div className="absolute bottom-2 right-2 text-xs text-warm-gray-400">
            Disconnected
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className={cn(widgetControls, "gap-2", "justify-between")}>
        <button
            onClick={handleToggleActive}
            disabled={!session.isConnected}
            className={`${
              isWidgetActive ? buttons.danger : buttons.primary
            } px-3 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5`}
            title={isWidgetActive ? "Pause accepting links" : "Start accepting links"}
          >
            {isWidgetActive ? (
              <>
                <FaPause className="text-xs" />
                Pause
              </>
            ) : (
              <>
                <FaPlay className="text-xs" />
                Start
              </>
            )}
          </button>
        {submissions.length > 0 && (
          <button
            onClick={handleClearAll}
            className={cn(buttons.primary, "px-3 py-1.5 text-sm")}
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}

// Export wrapped component to ensure WidgetProvider is available
const LinkShareWithProvider = (props: LinkShareProps) => {
  return (
    <WidgetProvider {...props}>
      <LinkShare {...props} />
    </WidgetProvider>
  );
};

export default LinkShareWithProvider;