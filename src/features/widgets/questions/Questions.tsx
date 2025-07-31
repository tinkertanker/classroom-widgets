import React, { useState, useEffect, useCallback, useMemo, useRef, createContext, useContext } from 'react';
import { NetworkedWidgetWrapperV2, useNetworkedWidgetContext } from '../shared/NetworkedWidgetWrapperV2';
import { FaQuestion, FaPlay, FaPause, FaTrash, FaCheck } from 'react-icons/fa6';
import { getQuestionColor } from '../../../shared/constants/questionColors';
import { useWidgetSocket } from '../shared/hooks';
import { useWidget } from '../../../contexts/WidgetContext';
import { WidgetProvider } from '../../../contexts/WidgetContext';

interface Question {
  id: string;
  text: string;
  timestamp: Date;
  studentId: string;
  studentName?: string;
  answered?: boolean;
}

interface QuestionsProps {
  widgetId?: string;
  savedState?: any;
  onStateChange?: (state: any) => void;
}

interface QuestionsContextType {
  questions: Question[];
  isActive: boolean;
  handleMarkAnswered: (questionId: string) => void;
  handleDeleteQuestion: (questionId: string) => void;
  handleClearAll: () => void;
  toggleActive: () => void;
}

const QuestionsContext = createContext<QuestionsContextType | undefined>(undefined);

const useQuestionsContext = () => {
  const context = useContext(QuestionsContext);
  if (!context) {
    throw new Error('useQuestionsContext must be used within QuestionsProvider');
  }
  return context;
};

const QuestionsProvider: React.FC<QuestionsProps & { children: React.ReactNode }> = ({ widgetId, savedState, onStateChange, children }) => {
  const { session, isRoomActive } = useNetworkedWidgetContext();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isActive, setIsActive] = useState(false);

  // Load saved state
  useEffect(() => {
    if (savedState) {
      setQuestions(savedState.questions || []);
      setIsActive(savedState.isActive || false);
    }
  }, [savedState]);

  // Socket event handlers
  const socketEvents = useMemo(() => ({
    'newQuestion': (data: { questionId: string; text: string; studentId: string; studentName?: string }) => {
      const newQuestion: Question = {
        id: data.questionId,
        text: data.text,
        timestamp: new Date(),
        studentId: data.studentId,
        studentName: data.studentName,
        answered: false
      };
      setQuestions(prev => [...prev, newQuestion]);
    },
    'questionAnswered': (data: { questionId: string }) => {
      setQuestions(prev => 
        prev.map(q => 
          q.id === data.questionId ? { ...q, answered: true } : q
        )
      );
    },
    'questionDeleted': (data: { questionId: string }) => {
      setQuestions(prev => prev.filter(q => q.id !== data.questionId));
    },
    'allQuestionsCleared': () => {
      setQuestions([]);
    },
    'questions:stateChanged': (data: { isActive: boolean; widgetId?: string }) => {
      if (data.widgetId === widgetId || (!data.widgetId && !widgetId)) {
        setIsActive(data.isActive);
      }
    }
  }), [widgetId]);

  const { emitWidgetEvent, toggleActive: toggleActiveState } = useWidgetSocket({
    socket: session.socket,
    sessionCode: session.sessionCode,
    roomType: 'questions',
    widgetId,
    isActive,
    isRoomActive,
    events: socketEvents,
    startEvent: 'session:questions:start',
    stopEvent: 'session:questions:stop'
  });

  const handleMarkAnswered = useCallback((questionId: string) => {
    emitWidgetEvent('markAnswered', { questionId });
  }, [emitWidgetEvent]);

  const handleDeleteQuestion = useCallback((questionId: string) => {
    emitWidgetEvent('delete', { questionId });
  }, [emitWidgetEvent]);

  const handleClearAll = useCallback(() => {
    if (window.confirm('Are you sure you want to clear all questions?')) {
      emitWidgetEvent('clearAll', {});
    }
  }, [emitWidgetEvent]);

  const toggleActive = useCallback(() => {
    toggleActiveState(!isActive);
  }, [isActive, toggleActiveState]);

  useEffect(() => {
    onStateChange?.({
      questions,
      isActive
    });
  }, [onStateChange, questions, isActive]);

  const contextValue = useMemo(() => ({
    questions,
    isActive,
    handleMarkAnswered,
    handleDeleteQuestion,
    handleClearAll,
    toggleActive
  }), [questions, isActive, handleMarkAnswered, handleDeleteQuestion, handleClearAll, toggleActive]);

  return (
    <QuestionsContext.Provider value={contextValue}>
      {children}
    </QuestionsContext.Provider>
  );
};

function QuestionsContentWrapper() {
  const { isRoomActive } = useNetworkedWidgetContext();
  const { isActive, toggleActive } = useQuestionsContext();

  return (
    <>
      {/* Header controls */}
      {isRoomActive && (
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={toggleActive}
            className={`p-1.5 rounded transition-colors duration-200 ${
              isActive 
                ? 'bg-dusty-rose-500 hover:bg-dusty-rose-600 text-white' 
                : 'bg-sage-500 hover:bg-sage-600 text-white'
            }`}
            title={isActive ? "Pause accepting questions" : "Resume accepting questions"}
          >
            {isActive ? <FaPause /> : <FaPlay />}
          </button>
        </div>
      )}
      <QuestionsContent />
    </>
  );
}

function QuestionsContent() {
  const { widgetId } = useWidget();
  const { session, isRoomActive } = useNetworkedWidgetContext();
  const { questions, isActive, handleMarkAnswered, handleDeleteQuestion, handleClearAll, toggleActive } = useQuestionsContext();

  // Sort questions: unanswered first, then by timestamp
  const sortedQuestions = useMemo(() => [...questions].sort((a, b) => {
    if (a.answered !== b.answered) {
      return a.answered ? 1 : -1;
    }
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  }), [questions]);

  return (
    <>
      {/* Questions count */}
      <div className="flex justify-between items-center mb-1">
        <div className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
          {questions.length} question{questions.length !== 1 ? 's' : ''} 
          {questions.filter(q => !q.answered).length > 0 && 
            ` (${questions.filter(q => !q.answered).length} unanswered)`
          }
        </div>
        {questions.length > 0 && (
          <button
            onClick={handleClearAll}
            className="text-xs text-warm-gray-500 hover:text-dusty-rose-600 dark:text-warm-gray-400 dark:hover:text-dusty-rose-400 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Questions list */}
      <div className="flex-1 overflow-y-auto space-y-2 relative">
        {/* Paused overlay */}
        {!isActive && isRoomActive && session.isConnected && (
          <div className="absolute inset-0 bg-white/60 dark:bg-warm-gray-800/60 backdrop-blur-[2px] rounded-lg flex items-center justify-center z-10">
            <div className="text-center bg-white/90 dark:bg-warm-gray-800/90 rounded-lg px-6 py-4 shadow-lg">
              <p className="text-warm-gray-700 dark:text-warm-gray-300 font-medium mb-2">Questions are paused</p>
              <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400">Click play to resume</p>
            </div>
          </div>
        )}
        {sortedQuestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-warm-gray-400 dark:text-warm-gray-600">
            <FaQuestion className="text-4xl mb-2" />
            <p className="text-sm">
              {isActive ? "Waiting for questions..." : "Questions are paused"}
            </p>
          </div>
        ) : (
          sortedQuestions.map((question, index) => {
            const color = getQuestionColor(index);
            return (
            <div
              key={question.id}
              className={`p-3 rounded-lg border transition-all duration-200 ${
                question.answered
                  ? 'bg-warm-gray-50 dark:bg-warm-gray-750 border-warm-gray-200 dark:border-warm-gray-600 opacity-60'
                  : `${color.bg} ${color.border}`
              }`}
            >
              <div className="flex justify-between items-start gap-2">
                <p className={`text-sm flex-1 ${
                  question.answered ? 'line-through text-warm-gray-500' : color.text
                }`}>
                  {question.text}
                </p>
                <div className="flex gap-1">
                  {!question.answered && (
                    <button
                      onClick={() => handleMarkAnswered(question.id)}
                      className={`p-1.5 ${color.icon} ${color.iconHover} rounded transition-colors`}
                      title="Mark as answered"
                    >
                      <FaCheck className="text-xs" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteQuestion(question.id)}
                    className="p-1.5 text-dusty-rose-600 hover:bg-dusty-rose-100 dark:text-dusty-rose-400 dark:hover:bg-dusty-rose-900/30 rounded transition-colors"
                    title="Delete question"
                  >
                    <FaTrash className="text-xs" />
                  </button>
                </div>
              </div>
              <div className="mt-1 text-xs text-warm-gray-500 dark:text-warm-gray-400">
                {question.studentName || 'Anonymous'} • {new Date(question.timestamp).toLocaleTimeString()}
              </div>
            </div>
            );
          })
        )}
      </div>

    </>
  );
}

function Questions({ widgetId, savedState, onStateChange }: QuestionsProps) {
  return (
    <WidgetProvider widgetId={widgetId} savedState={savedState} onStateChange={onStateChange}>
      <NetworkedWidgetWrapperV2
        roomType="questions"
        title="Student Questions"
        description="Let students submit questions during your lesson"
        icon={FaQuestion}
      >
        {() => (
          <QuestionsProvider widgetId={widgetId} savedState={savedState} onStateChange={onStateChange}>
            <QuestionsContentWrapper />
          </QuestionsProvider>
        )}
      </NetworkedWidgetWrapperV2>
    </WidgetProvider>
  );
}

export default Questions;