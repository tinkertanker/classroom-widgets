import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FaPenNib, FaClipboardCheck } from 'react-icons/fa6';
import { useModal } from '../../../../contexts/ModalContext';
import { useNetworkedWidget } from '../../../session/hooks/useNetworkedWidget';
import { useNetworkedWidgetState } from '../../../session/hooks/useNetworkedWidgetState';
import { NetworkedWidgetEmpty } from '../../shared/NetworkedWidgetEmpty';
import { widgetWrapper, widgetContainer } from '@shared/utils/styles';
import { NetworkedWidgetControlBar, NetworkedWidgetOverlays, NetworkedWidgetStats } from '../../shared/components';
import { useSocketEvents } from '../../../session/hooks/useSocketEvents';
import FillBlankEditor from './FillBlankEditor';
import { debug } from '@shared/utils/debug';
import { withWidgetProvider, WidgetProps } from '../../shared/withWidgetProvider';
import { getEmptyStateButtonText, getEmptyStateDisabled } from '../../shared/utils/networkedWidgetHelpers';
import type { ActivityDefinition, ActivityResults } from '@shared/types/activity.types';
import { buildFillBlankActivity } from '../shared/activityBuilders';
import type { FillBlankState } from '../shared/activityBuilders';
import type { ActivityResponseReceivedData } from '@shared/types/socket.types';


interface StudentResponse {
  studentId: string;
  studentName: string;
  score: number;
  total: number;
  timestamp: number;
}

function FillBlank({ widgetId, savedState, onStateChange }: WidgetProps) {
  // State
  const [activityData, setActivityData] = useState<FillBlankState>(() => savedState?.activityData || {
    template: '',
    answers: [],
    distractors: [],
    title: 'Fill in the Blanks',
    instructions: 'Drag the words to fill in the blanks.'
  });

  const [responseCount, setResponseCount] = useState(0);
  const [responses, setResponses] = useState<StudentResponse[]>([]);
  const [answersRevealed, setAnswersRevealed] = useState(false);

  // Hooks
  const { showModal, hideModal } = useModal();

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
    roomType: 'activity',
    savedState,
    onStateChange
  });

  // Active state management
  const { isActive: isWidgetActive, toggleActive: rawToggleActive } = useNetworkedWidgetState({
    widgetId,
    roomType: 'activity',
    hasRoom,
    recoveryData
  });

  // Wrap toggleActive to prevent starting without a template
  const toggleActive = useCallback(() => {
    // If trying to activate but no template, don't allow
    if (!isWidgetActive && !activityData.template) {
      return;
    }
    rawToggleActive();
  }, [isWidgetActive, activityData.template, rawToggleActive]);

  // Build activity definition for server (includes UI recipe generation).
  // Logic lives in shared/activityBuilders so it is unit-testable.
  const buildActivityDefinition = useCallback(
    (data: FillBlankState): Partial<ActivityDefinition> => buildFillBlankActivity(data),
    []
  );

  // Socket event handlers
  const socketEvents = useMemo(() => ({
    'activity:stateUpdate': (data: any) => {
      if (data.widgetId === widgetId) {
        debug('[FillBlank] Received stateUpdate:', data);
        setResponseCount(data.responseCount || 0);
      }
    },
    'activity:responseReceived': (data: ActivityResponseReceivedData) => {
      if (data.widgetId === widgetId) {
        debug('[FillBlank] Response received:', data);
        setResponseCount(prev => prev + 1);
        setResponses(prev => [...prev, {
          studentId: data.studentId,
          studentName: data.studentName,
          score: data.results.score,
          total: data.results.total,
          timestamp: Date.now()
        }]);
      }
    }
  }), [widgetId]);

  const { emit } = useSocketEvents({
    events: socketEvents,
    isActive: hasRoom
  });

  // Send activity update to server
  const sendActivityUpdate = useCallback(() => {
    if (!hasRoom || !session.sessionCode || !widgetId) return;

    const activity = buildActivityDefinition(activityData);
    emit('session:activity:update', {
      sessionCode: session.sessionCode,
      widgetId,
      activity
    });
  }, [hasRoom, session.sessionCode, widgetId, activityData, buildActivityDefinition, emit]);

  // Toggle reveal answers
  const toggleRevealAnswers = useCallback(() => {
    if (!hasRoom || !session.sessionCode || !widgetId) return;

    const newRevealed = !answersRevealed;
    setAnswersRevealed(newRevealed);

    emit('session:activity:reveal', {
      sessionCode: session.sessionCode,
      widgetId,
      reveal: newRevealed
    });
  }, [hasRoom, session.sessionCode, widgetId, answersRevealed, emit]);

  // Reset responses
  const resetActivity = useCallback(() => {
    if (!hasRoom || !session.sessionCode || !widgetId) return;

    emit('session:activity:reset', {
      sessionCode: session.sessionCode,
      widgetId
    });

    setResponseCount(0);
    setResponses([]);
    setAnswersRevealed(false);
  }, [hasRoom, session.sessionCode, widgetId, emit]);

  // Open settings modal
  const openSettings = useCallback(() => {
    showModal({
      title: 'Fill in the Blanks Editor',
      content: (
        <FillBlankEditor
          initialData={activityData}
          onSave={(data) => {
            setActivityData(data);
            hideModal();
          }}
          onClose={hideModal}
        />
      ),
      onClose: hideModal
    });
  }, [showModal, hideModal, activityData]);

  // Save state
  useEffect(() => {
    onStateChange?.({
      activityData,
      responseCount
    });
  }, [onStateChange, activityData, responseCount]);

  // Send activity update when data changes or room is established
  useEffect(() => {
    if (hasRoom && activityData.answers.length > 0) {
      sendActivityUpdate();
    }
  }, [hasRoom, activityData, sendActivityUpdate]);

  // Handle recovery data
  useEffect(() => {
    if (recoveryData?.roomData) {
      debug('[FillBlank] Recovery data:', recoveryData);
      if (recoveryData.roomData.activity) {
        // Could restore activity data from recovery if needed
      }
      setResponseCount(recoveryData.roomData.responseCount || 0);
      setAnswersRevealed(recoveryData.roomData.answersRevealed || false);
    }
  }, [recoveryData]);

  // Empty state - show when no room OR no valid session
  // This catches cases where hasRoom is stale but session is gone
  if (!hasRoom || !session.sessionCode) {
    return (
      <NetworkedWidgetEmpty
        icon={FaPenNib}
        title="Fill in the Blanks"
        description="Create interactive fill-in-the-blank activities"
        buttonText={getEmptyStateButtonText({
          isStarting,
          isRecovering: session.isRecovering,
          isConnected: session.isConnected,
          defaultText: "Create Activity"
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

  // Render preview with gray blocks for blanks
  const renderPreview = (template: string) => {
    const parts = template.split(/(\{\{[^}]+\}\})/);
    return parts.map((part, index) => {
      if (part.match(/^\{\{[^}]+\}\}$/)) {
        return (
          <span
            key={index}
            className="inline-block w-20 h-6 mx-1 bg-warm-gray-300 dark:bg-warm-gray-600 rounded align-middle"
          />
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className={widgetWrapper}>
      <div className={`${widgetContainer} relative`}>
        {/* Statistics */}
        <NetworkedWidgetStats label="Fill in the Blanks">
          {responseCount} response{responseCount !== 1 ? 's' : ''}
        </NetworkedWidgetStats>

        {/* Content */}
        <div className="flex-1 flex flex-col relative p-4 pt-8 overflow-y-auto">
          {/* Overlays */}
          <NetworkedWidgetOverlays
            isActive={isWidgetActive}
            isConnected={session.isConnected}
            isRecovering={session.isRecovering}
            pausedMessage="Activity is paused"
          />

          {activityData.template ? (
            <div className="flex flex-col gap-4">
              {/* Preview */}
              <div className="bg-warm-gray-50 dark:bg-warm-gray-800/50 p-4 rounded-lg">
                <p className="text-warm-gray-700 dark:text-warm-gray-300 text-lg leading-relaxed">
                  {renderPreview(activityData.template)}
                </p>
              </div>

              {/* Answers (when revealed) */}
              {answersRevealed && (
                <div className="bg-sage-50 dark:bg-sage-900/20 p-3 rounded-lg">
                  <p className="text-sm font-medium text-sage-700 dark:text-sage-300 mb-2">
                    Answers:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {activityData.answers.map((answer, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-sage-200 dark:bg-sage-800 text-sage-800 dark:text-sage-200 rounded text-sm"
                      >
                        {index + 1}. {answer}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Word bank preview */}
              <div className="bg-warm-gray-100 dark:bg-warm-gray-800 p-3 rounded-lg">
                <p className="text-xs text-warm-gray-500 dark:text-warm-gray-400 mb-2">
                  Word Bank ({activityData.answers.length + activityData.distractors.length} words):
                </p>
                <div className="flex flex-wrap gap-2">
                  {[...activityData.answers, ...activityData.distractors].map((word, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-sage-100 dark:bg-sage-900/40 text-sage-800 dark:text-sage-200 rounded text-sm"
                    >
                      {word}
                    </span>
                  ))}
                </div>
              </div>

              {/* Response summary */}
              {responses.length > 0 && (
                <div className="border-t border-warm-gray-200 dark:border-warm-gray-700 pt-3 mt-2">
                  <p className="text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-2">
                    Recent Responses:
                  </p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {responses.slice(-5).reverse().map((response, index) => (
                      <div
                        key={index}
                        className="flex justify-between text-sm text-warm-gray-600 dark:text-warm-gray-400"
                      >
                        <span>{response.studentName}</span>
                        <span className={response.score === response.total ? 'text-green-600 dark:text-green-400' : ''}>
                          {response.score}/{response.total}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-warm-gray-500 dark:text-warm-gray-400">
              Click settings to create your activity
            </div>
          )}
        </div>
      </div>

      {/* Control bar */}
      <NetworkedWidgetControlBar
        isActive={isWidgetActive}
        isConnected={session.isConnected}
        onToggleActive={toggleActive}
        onSettings={openSettings}
        onClear={resetActivity}
        clearCount={responseCount}
        clearLabel="Reset responses"
        activeLabel="Pause activity"
        inactiveLabel="Start activity"
        disabled={!session.isConnected}
        clearVariant="reset"
        rightContent={
          <button
            onClick={toggleRevealAnswers}
            disabled={!session.isConnected}
            className={`p-2 rounded-lg transition-colors ${
              answersRevealed
                ? 'bg-sage-500 text-white'
                : 'bg-warm-gray-200 dark:bg-warm-gray-700 text-warm-gray-600 dark:text-warm-gray-400 hover:bg-warm-gray-300 dark:hover:bg-warm-gray-600'
            }`}
            title={answersRevealed ? 'Hide answers' : 'Show answers'}
          >
            <FaClipboardCheck className="w-4 h-4" />
          </button>
        }
      />
    </div>
  );
}

export default withWidgetProvider(FillBlank, 'FillBlank');
