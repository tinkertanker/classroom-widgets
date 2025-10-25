import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FaQuestion, FaTrash, FaCheck } from 'react-icons/fa6';
import { useModal } from '../../../contexts/ModalContext';
import { WidgetProvider } from '../../../contexts/WidgetContext';
import { useNetworkedWidget } from '../../session/hooks/useNetworkedWidget';
import { NetworkedWidgetEmpty } from '../shared/NetworkedWidgetEmpty';
import { widgetWrapper, widgetContainer, cn } from '../../../shared/utils/styles';
import { NetworkedWidgetControlBar } from '../shared/components';
import { useSocketEvents } from '../../session/hooks/useSocketEvents';
import { useSession } from '../../../contexts/SessionContext';
import { getQuestionColor } from '../../../shared/constants/questionColors';

interface QuestionsProps {
  widgetId?: string;
  savedState?: any;
  onStateChange?: (state: any) => void;
}

interface Question {
  id: string;
  text: string;
  timestamp: Date;
  studentId: string;
  studentName?: string;
  answered?: boolean;
}

function Questions({ widgetId, savedState, onStateChange }: QuestionsProps) {
  // State
  const [questions, setQuestions] = useState<Question[]>(
    savedState?.questions || []
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
    roomType: 'questions',
    savedState,
    onStateChange
  });
  
  // Get unified session for additional methods
  const unifiedSession = useSession();
  
  // Socket event handlers
  const socketEvents = useMemo(() => ({
    'questions:newQuestion': (data: any) => {
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
    },
    'session:widgetStateChanged': (data: { roomType: string; widgetId?: string; isActive: boolean }) => {
      if (data.roomType === 'questions' && (data.widgetId === widgetId || (!data.widgetId && !widgetId))) {
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
    unifiedSession.updateRoomState('questions', widgetId, newState);
  }, [widgetId, hasRoom, unifiedSession]);
  
  // Actions
  const handleMarkAnswered = useCallback((questionId: string) => {
    if (!widgetId || !hasRoom) return;
    emit('session:questions:markAnswered', {
      sessionCode: session.sessionCode,
      widgetId,
      questionId
    });
  }, [widgetId, hasRoom, emit, session.sessionCode]);

  const handleDeleteQuestion = useCallback((questionId: string) => {
    if (!widgetId || !hasRoom) return;
    emit('session:questions:delete', {
      sessionCode: session.sessionCode,
      widgetId,
      questionId
    });
  }, [widgetId, hasRoom, emit, session.sessionCode]);
  
  const handleClearAll = useCallback(() => {
    if (!widgetId || !hasRoom) return;
    if (window.confirm('Are you sure you want to clear all questions?')) {
      emit('session:questions:clearAll', {
        sessionCode: session.sessionCode,
        widgetId
      });
    }
  }, [widgetId, hasRoom, emit, session.sessionCode]);
  
  const handleToggleActive = useCallback(() => {
    if (!hasRoom) return;
    toggleActive(!isWidgetActive);
  }, [isWidgetActive, hasRoom, toggleActive]);
  
  // Sort questions: unanswered first, then by timestamp
  const sortedQuestions = useMemo(() => [...questions].sort((a, b) => {
    if (a.answered !== b.answered) {
      return a.answered ? 1 : -1;
    }
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  }), [questions]);
  
  // Save state
  useEffect(() => {
    onStateChange?.({
      questions,
      isActive: isWidgetActive
    });
  }, [questions, isWidgetActive, onStateChange]);
  
  // Handle recovery data - restore widget state after page refresh
  useEffect(() => {
    if (recoveryData && recoveryData.roomData) {
      // Restore questions from recovery data
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
        icon={FaQuestion}
        title="Questions"
        description="Collect questions from students in real-time"
        buttonText={
          isStarting ? "Starting..." : 
          session.isRecovering ? "Reconnecting..." :
          !session.isConnected ? "Connecting..." : 
          "Start Questions"
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
            {questions.length} question{questions.length !== 1 ? 's' : ''}
            {questions.filter(q => !q.answered).length > 0 &&
              ` (${questions.filter(q => !q.answered).length} unanswered)`
            }
          </span>
        </div>

        {/* Questions list */}
        <div className="flex-1 overflow-y-auto space-y-2 relative p-4 pt-8">
          {/* Paused overlay */}
          {!isWidgetActive && session.isConnected && (
            <div className="absolute inset-0 bg-white/60 dark:bg-warm-gray-800/60 backdrop-blur-[2px] rounded-lg flex items-center justify-center z-10">
              <div className="text-center bg-white/90 dark:bg-warm-gray-800/90 rounded-lg px-6 py-4 shadow-lg">
                <p className="text-warm-gray-700 dark:text-warm-gray-300 font-medium mb-2">Questions are paused</p>
                <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400">Click play to resume</p>
              </div>
            </div>
          )}

          {questions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-warm-gray-400 dark:text-warm-gray-600">
              <FaQuestion className="text-4xl mb-2" />
              <p className="text-sm">Waiting for student questions...</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedQuestions.map((question, index) => {
                const colorIndex = questions.indexOf(question) % 10;
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
        onClear={handleClearAll}
        clearCount={questions.length}
        clearLabel="Clear all"
        activeLabel="Pause accepting questions"
        inactiveLabel="Start accepting questions"
        showSettings={false}
        clearVariant="clear"
        requireClearConfirmation={true}
        clearConfirmationMessage="Are you sure you want to clear all questions?"
      />
    </div>
  );
}

// Export wrapped component to ensure WidgetProvider is available
const QuestionsWithProvider = (props: QuestionsProps) => {
  return (
    <WidgetProvider {...props}>
      <Questions {...props} />
    </WidgetProvider>
  );
};

export default QuestionsWithProvider;