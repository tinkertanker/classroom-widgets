import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FaQuestion, FaTrash, FaCheck, FaBoxArchive } from 'react-icons/fa6';
import { useNetworkedWidget } from '../../session/hooks/useNetworkedWidget';
import { useNetworkedWidgetState } from '../../session/hooks/useNetworkedWidgetState';
import { NetworkedWidgetEmpty } from '../shared/NetworkedWidgetEmpty';
import { widgetWrapper, widgetContainer } from '../../../shared/utils/styles';
import { NetworkedWidgetOverlays, NetworkedWidgetStats } from '../shared/components';
import { useSocketEvents } from '../../session/hooks/useSocketEvents';
import { getQuestionColor, questionColors } from '../../../shared/constants/questionColors';
import { withWidgetProvider, WidgetProps } from '../shared/withWidgetProvider';
import { getEmptyStateButtonText, getEmptyStateDisabled } from '../shared/utils/networkedWidgetHelpers';
import SavedCollectionsDialog from '../../../shared/components/SavedCollectionsDialog';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';
import { SavedQuestionBank } from '../../../shared/types/storage';

interface Question {
  id: string;
  text: string;
  timestamp: Date;
  studentId: string;
  studentName?: string;
  answered?: boolean;
}

const getStableColourIndex = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % questionColors.length;
};

function Questions({ widgetId, savedState, onStateChange }: WidgetProps) {
  // State
  const [questions, setQuestions] = useState<Question[]>(
    savedState?.questions || []
  );
  const [showSavedDialog, setShowSavedDialog] = useState(false);

  // Saved collections store
  const {
    saveQuestionBank,
    getQuestionBanks,
    deleteQuestionBank,
  } = useWorkspaceStore();

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
    roomType: 'questions',
    savedState,
    onStateChange
  });

  // Active state management
  const { isActive: isWidgetActive, toggleActive } = useNetworkedWidgetState({
    widgetId,
    roomType: 'questions',
    hasRoom,
    recoveryData
  });

  // Socket event handlers (widget-specific only)
  const socketEvents = useMemo(() => ({
    'questions:questionAdded': (data: any) => {
      if (data.widgetId === widgetId) {
        const question: Question = {
          id: data.id,
          text: data.text,
          timestamp: new Date(data.timestamp),
          studentId: data.studentId || '',
          studentName: data.studentName,
          answered: data.answered || false
        };
        setQuestions(prev => [...prev, question]);
      }
    },
    'questions:questionAnswered': (data: { questionId: string; widgetId?: string }) => {
      if (data.widgetId === widgetId) {
        setQuestions(prev => prev.map(q =>
          q.id === data.questionId ? { ...q, answered: true } : q
        ));
      }
    },
    'questions:questionDeleted': (data: { questionId: string; widgetId?: string }) => {
      if (data.widgetId === widgetId) {
        setQuestions(prev => prev.filter(q => q.id !== data.questionId));
      }
    },
    'questions:allCleared': (data: { widgetId?: string }) => {
      if (data.widgetId === widgetId) {
        setQuestions([]);
      }
    }
  }), [widgetId]);

  // Use socket events hook for automatic event management
  const { emit } = useSocketEvents({
    events: socketEvents,
    isActive: hasRoom
  });

  // Actions
  const handleMarkAnswered = useCallback((questionId: string) => {
    if (!widgetId || !hasRoom) return;
    emit('session:questions:markAnswered', {
      sessionCode: session.sessionCode!,
      widgetId,
      questionId
    });
  }, [widgetId, hasRoom, emit, session.sessionCode]);

  const handleDeleteQuestion = useCallback((questionId: string) => {
    if (!widgetId || !hasRoom) return;
    emit('session:questions:delete', {
      sessionCode: session.sessionCode!,
      widgetId,
      questionId
    });
  }, [widgetId, hasRoom, emit, session.sessionCode]);

  const handleClearAll = useCallback(() => {
    if (!widgetId || !hasRoom) return;
    emit('session:questions:clearAll', {
      sessionCode: session.sessionCode!,
      widgetId
    });
  }, [widgetId, hasRoom, emit, session.sessionCode]);

  const handleToggleActive = useCallback(() => {
    if (!hasRoom) return;
    toggleActive();
  }, [hasRoom, toggleActive]);

  const unansweredCount = useMemo(
    () => questions.filter(question => !question.answered).length,
    [questions]
  );

  // Saved collections handlers
  const handleSaveToCollection = useCallback((name: string) => {
    // Extract question text and student name, stripping IDs, timestamps, answered status
    const questionsToSave = questions.map(q => ({
      text: q.text,
      studentName: q.studentName,
    }));
    saveQuestionBank(name, questionsToSave);
    setShowSavedDialog(false);
  }, [questions, saveQuestionBank]);

  const handleLoadFromCollection = useCallback((item: SavedQuestionBank) => {
    // Create new questions from loaded texts
    const loadedQuestions: Question[] = item.questions.map((q, index) => ({
      id: `loaded-${Date.now()}-${index}`,
      text: q.text,
      timestamp: new Date(),
      studentId: '',
      studentName: q.studentName,
      answered: false,
    }));
    setQuestions(loadedQuestions);
    setShowSavedDialog(false);
  }, []);

  const handleDeleteFromCollection = useCallback((id: string) => {
    deleteQuestionBank(id);
  }, [deleteQuestionBank]);

  // Sort questions: unanswered first, then by timestamp
  const sortedQuestions = useMemo(() => [...questions].sort((a, b) => {
    if (a.answered !== b.answered) {
      return a.answered ? 1 : -1;
    }
    return b.timestamp.getTime() - a.timestamp.getTime();
  }), [questions]);

  // Save state
  useEffect(() => {
    onStateChange?.({
      questions
    });
  }, [questions, onStateChange]);

  // Handle recovery data - restore questions after page refresh
  useEffect(() => {
    if (recoveryData && recoveryData.roomData) {
      if (recoveryData.roomData.questions && Array.isArray(recoveryData.roomData.questions)) {
        setQuestions(recoveryData.roomData.questions.map((q: any) => ({
          id: q.id,
          text: q.text,
          timestamp: new Date(q.timestamp),
          studentId: q.studentId || '',
          studentName: q.studentName,
          answered: q.answered || false
        })));
      }
    }
  }, [recoveryData]);

  // Empty state - show when no room exists
  if (!hasRoom) {
    return (
      <NetworkedWidgetEmpty
        icon={FaQuestion}
        title="Questions"
        description="Collect questions from students in real-time"
        buttonText={getEmptyStateButtonText({
          isStarting,
          isRecovering: session.isRecovering,
          isConnected: session.isConnected,
          defaultText: "Start Questions"
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
          {questions.length} question{questions.length !== 1 ? 's' : ''}
          {unansweredCount > 0 &&
            ` (${unansweredCount} unanswered)`
          }
        </NetworkedWidgetStats>

        {/* Overlays - outside scrollable area */}
        <NetworkedWidgetOverlays
          isActive={isWidgetActive}
          isConnected={session.isConnected}
          isRecovering={session.isRecovering}
          pausedMessage="Questions are paused"
        />

        {/* Questions list */}
        <div className="flex-1 overflow-y-auto space-y-2 p-4 pt-8">
          {questions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-warm-gray-400 dark:text-warm-gray-600">
              <FaQuestion className="text-4xl mb-2" />
              <p className="text-sm">Waiting for student questions...</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedQuestions.map((question) => {
                const colorIndex = getStableColourIndex(question.id);
                const bgColor = getQuestionColor(colorIndex);

                return (
                  <div
                    key={question.id}
                    className={`rounded-lg p-3 shadow-sm border transition-all duration-200 ${
                      question.answered
                        ? 'bg-warm-gray-100 dark:bg-warm-gray-700 border-warm-gray-200 dark:border-warm-gray-600 opacity-60'
                        : `${bgColor} border-warm-gray-200 dark:border-warm-gray-600`
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium mb-1 ${
                          question.answered
                            ? 'text-warm-gray-500 dark:text-warm-gray-400 line-through'
                            : 'text-warm-gray-800 dark:text-warm-gray-200'
                        }`}>
                          {question.text}
                        </p>
                        <p className="text-xs text-warm-gray-600 dark:text-warm-gray-400">
                          {question.studentName || 'Anonymous'}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {!question.answered && (
                          <button
                            onClick={() => handleMarkAnswered(question.id)}
                            className="p-1 text-sage-600 hover:text-sage-700 dark:text-sage-400 dark:hover:text-sage-300 transition-colors"
                            title="Mark as answered"
                          >
                            <FaCheck className="text-xs" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteQuestion(question.id)}
                          className="p-1 text-warm-gray-400 hover:text-dusty-rose-600 dark:hover:text-dusty-rose-400 transition-colors"
                          title="Delete question"
                        >
                          <FaTrash className="text-xs" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Control bar with saved button */}
      <div className="flex items-center justify-between px-3 py-2 bg-soft-white dark:bg-warm-gray-800 border-t border-warm-gray-200 dark:border-warm-gray-700 rounded-b-lg">
        <div className="flex items-center gap-2">
          {/* Play/Pause */}
          <button
            onClick={handleToggleActive}
            disabled={!session.isConnected}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
              isWidgetActive
                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400'
                : 'bg-sage-100 text-sage-700 hover:bg-sage-200 dark:bg-sage-900/30 dark:text-sage-400'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={isWidgetActive ? 'Pause accepting questions' : 'Start accepting questions'}
          >
            {isWidgetActive ? 'Pause' : 'Resume'}
          </button>

          {/* Clear */}
          <button
            onClick={handleClearAll}
            disabled={!session.isConnected || questions.length === 0}
            className="px-3 py-1.5 text-sm font-medium text-warm-gray-600 dark:text-warm-gray-400 hover:text-dusty-rose-600 dark:hover:text-dusty-rose-400 hover:bg-dusty-rose-50 dark:hover:bg-dusty-rose-900/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Clear all questions"
          >
            Clear all
          </button>
        </div>

        {/* Saved button */}
        <button
          onClick={() => setShowSavedDialog(true)}
          className="px-3 py-1.5 text-sm font-medium text-warm-gray-600 dark:text-warm-gray-400 hover:text-slate-blue-600 dark:hover:text-slate-blue-400 hover:bg-slate-blue-50 dark:hover:bg-slate-blue-900/20 rounded transition-colors inline-flex items-center gap-1.5"
          title="Save or load question banks"
        >
          <FaBoxArchive className="w-3.5 h-3.5" />
          Saved
        </button>
      </div>

      {/* Saved collections dialog */}
      {showSavedDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1200]">
          <SavedCollectionsDialog
            type="questions"
            items={getQuestionBanks()}
            currentItemCount={questions.length}
            onSave={handleSaveToCollection}
            onLoad={handleLoadFromCollection}
            onDelete={handleDeleteFromCollection}
            onClose={() => setShowSavedDialog(false)}
          />
        </div>
      )}
    </div>
  );
}

export default withWidgetProvider(Questions, 'Questions');
