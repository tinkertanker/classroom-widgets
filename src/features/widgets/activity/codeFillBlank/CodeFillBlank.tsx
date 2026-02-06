import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FaCode, FaClipboardCheck } from 'react-icons/fa6';
import { useModal } from '../../../../contexts/ModalContext';
import { useNetworkedWidget } from '../../../session/hooks/useNetworkedWidget';
import { useNetworkedWidgetState } from '../../../session/hooks/useNetworkedWidgetState';
import { NetworkedWidgetEmpty } from '../../shared/NetworkedWidgetEmpty';
import { widgetWrapper, widgetContainer } from '../../../../shared/utils/styles';
import { NetworkedWidgetControlBar, NetworkedWidgetOverlays, NetworkedWidgetStats } from '../../shared/components';
import { useSocketEvents } from '../../../session/hooks/useSocketEvents';
import CodeFillBlankEditor from './CodeFillBlankEditor';
import { debug } from '../../../../shared/utils/debug';
import { withWidgetProvider, WidgetProps } from '../../shared/withWidgetProvider';
import { getEmptyStateButtonText, getEmptyStateDisabled } from '../../shared/utils/networkedWidgetHelpers';
import type { ActivityDefinition, UIBlock } from '../../../../shared/types/activity.types';
import type { ActivityResponseReceivedData } from '../../../../shared/types/socket.types';

interface CodeFillBlankState {
  template: string;
  answers: string[];
  distractors: string[];
  title: string;
  instructions: string;
  language: 'python' | 'javascript' | 'text';
}

interface StudentResponse {
  studentId: string;
  studentName: string;
  score: number;
  total: number;
  timestamp: number;
}

function CodeFillBlank({ widgetId, savedState, onStateChange }: WidgetProps) {
  // State
  const [activityData, setActivityData] = useState<CodeFillBlankState>(() => savedState?.activityData || {
    template: '',
    answers: [],
    distractors: [],
    title: 'Code Fill-in-the-Blanks',
    instructions: 'Complete the code by filling in the blanks.',
    language: 'python'
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
    if (!isWidgetActive && !activityData.template) {
      return;
    }
    rawToggleActive();
  }, [isWidgetActive, activityData.template, rawToggleActive]);

  // Build activity definition for server (includes UI recipe generation)
  const buildActivityDefinition = useCallback((data: CodeFillBlankState): Partial<ActivityDefinition> => {
    const { template, answers, distractors, title, instructions, language } = data;
    if (!template || answers.length === 0) {
      return { type: 'code-fill-blank', title, instructions, items: [], targets: [], uiRecipe: [] };
    }

    // Create items - each answer becomes an item (no need to shuffle for typed input)
    const items = answers.map((content, i) => ({
      id: `item-${i}`,
      content
    }));

    // Create targets (one per blank) with whitespace-flexible evaluation
    const targets = answers.map((_, i) => ({
      id: `blank-${i}`,
      accepts: [`item-${i}`],
      evaluationMode: 'whitespace-flexible' as const
    }));

    // Generate UI recipe - code with inline text inputs for blanks
    const recipe: UIBlock[] = [];

    // Parse template into lines for code display
    const lines = template.split('\n');
    const codeLines: UIBlock[] = [];
    let blankIndex = 0;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      // Split line by blank markers
      const parts = line.split(/\{\{[^}]+\}\}/);
      const blankMatches = line.match(/\{\{[^}]+\}\}/g) || [];

      const lineChildren: UIBlock[] = [];

      for (let i = 0; i < parts.length; i++) {
        // Add text part
        if (parts[i]) {
          lineChildren.push({
            id: `text-${lineIdx}-${i}`,
            type: 'text' as const,
            props: { content: parts[i], variant: 'inline' as const, className: 'font-mono whitespace-pre' }
          });
        }

        // Add text input for blank if not the last part
        if (i < blankMatches.length) {
          lineChildren.push({
            id: `input-${blankIndex}`,
            type: 'text-input' as const,
            props: {
              targetId: `blank-${blankIndex}`,
              placeholder: '___',
              maxLength: 50
            }
          });
          blankIndex++;
        }
      }

      codeLines.push({
        id: `line-${lineIdx}`,
        type: 'container' as const,
        props: { layout: 'inline' as const, className: 'min-h-[24px]' },
        children: lineChildren
      });
    }

    // Code container with language styling
    recipe.push({
      id: 'code-container',
      type: 'container' as const,
      props: {
        layout: 'column' as const,
        gap: '0',
        className: `font-mono text-sm bg-warm-gray-900 dark:bg-warm-gray-950 p-4 rounded-lg ${
          language === 'python' ? 'text-blue-300' :
          language === 'javascript' ? 'text-yellow-300' :
          'text-warm-gray-200'
        }`
      },
      children: codeLines
    });

    return {
      type: 'code-fill-blank',
      title,
      instructions,
      items,
      targets,
      uiRecipe: recipe,
      showImmediateFeedback: true,
      allowRetry: true
    };
  }, []);

  // Socket event handlers
  const socketEvents = useMemo(() => ({
    'activity:stateUpdate': (data: any) => {
      if (data.widgetId === widgetId) {
        debug('[CodeFillBlank] Received stateUpdate:', data);
        setResponseCount(data.responseCount || 0);
      }
    },
    'activity:responseReceived': (data: ActivityResponseReceivedData) => {
      if (data.widgetId === widgetId) {
        debug('[CodeFillBlank] Response received:', data);
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
      title: 'Code Fill-in-the-Blanks Editor',
      content: (
        <CodeFillBlankEditor
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
      debug('[CodeFillBlank] Recovery data:', recoveryData);
      setResponseCount(recoveryData.roomData.responseCount || 0);
      setAnswersRevealed(recoveryData.roomData.answersRevealed || false);
    }
  }, [recoveryData]);

  // Empty state
  if (!hasRoom || !session.sessionCode) {
    return (
      <NetworkedWidgetEmpty
        icon={FaCode}
        title="Code Fill-in-the-Blanks"
        description="Create interactive code completion activities"
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

  // Preview of the code with blanks
  const previewText = activityData.template
    ? activityData.template.replace(/\{\{([^}]+)\}\}/g, '______')
    : 'No activity configured';

  const languageLabel = {
    python: 'Python',
    javascript: 'JavaScript',
    text: 'Plain Text'
  }[activityData.language];

  return (
    <div className={widgetWrapper}>
      <div className={`${widgetContainer} relative`}>
        {/* Statistics */}
        <NetworkedWidgetStats>
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
              {/* Title and Language */}
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-warm-gray-800 dark:text-warm-gray-200">
                  {activityData.title}
                </h3>
                <span className="px-2 py-1 bg-warm-gray-200 dark:bg-warm-gray-700 text-warm-gray-600 dark:text-warm-gray-400 rounded text-xs">
                  {languageLabel}
                </span>
              </div>

              {/* Code Preview */}
              <div className="bg-warm-gray-900 dark:bg-warm-gray-950 p-4 rounded-lg overflow-x-auto">
                <pre className={`text-sm font-mono whitespace-pre-wrap ${
                  activityData.language === 'python' ? 'text-blue-300' :
                  activityData.language === 'javascript' ? 'text-yellow-300' :
                  'text-warm-gray-200'
                }`}>
                  {previewText}
                </pre>
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
                        className="px-2 py-1 bg-sage-200 dark:bg-sage-800 text-sage-800 dark:text-sage-200 rounded text-sm font-mono"
                      >
                        {index + 1}. {answer}
                      </span>
                    ))}
                  </div>
                </div>
              )}

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

export default withWidgetProvider(CodeFillBlank, 'CodeFillBlank');
