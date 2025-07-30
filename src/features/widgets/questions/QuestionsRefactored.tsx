import React, { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import { WidgetProvider } from '../../../contexts/WidgetContext';
import { NetworkedWidgetWrapperV2, useNetworkedWidgetContext } from '../shared/NetworkedWidgetWrapperV2';
import { FaQuestion, FaPlay, FaPause, FaTrash, FaCheck } from 'react-icons/fa6';
import { getQuestionColor } from '../../../utils/questionColors';
import { useWidgetSocket } from '../shared/hooks';
import { useWidget } from '../../../contexts/WidgetContext';

interface Question {
  id: string;
  text: string;
  timestamp: Date;
  studentId: string;
  studentName?: string;
  answered?: boolean;
}

// Questions-specific context
interface QuestionsContextType {
  questions: Question[];
  isActive: boolean;
  toggleActive: () => void;
  markAsAnswered: (questionId: string) => void;
  deleteQuestion: (questionId: string) => void;
  clearQuestions: () => void;
}

const QuestionsContext = createContext<QuestionsContextType | undefined>(undefined);

const useQuestions = () => {
  const context = useContext(QuestionsContext);
  if (!context) {
    throw new Error('useQuestions must be used within QuestionsProvider');
  }
  return context;
};

// Questions Header Component
function QuestionsHeader() {
  const { isActive, toggleActive } = useQuestions();
  const { isRoomActive } = useNetworkedWidgetContext();
  
  if (!isRoomActive) return null;
  
  return (
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
  );
}

// Question Item Component
function QuestionItem({ question, index }: { question: Question; index: number }) {
  const { markAsAnswered, deleteQuestion } = useQuestions();
  const color = getQuestionColor(index);
  
  return (
    <div className={`p-3 rounded-lg ${color.bg} ${color.border} border ${
      question.answered ? 'opacity-50' : ''
    } transition-all duration-200`}>
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className={`text-sm ${color.text} ${
            question.answered ? 'line-through' : ''
          }`}>
            {question.text}
          </p>
          <p className="text-xs text-warm-gray-500 dark:text-warm-gray-400 mt-1">
            {question.studentName || `Student ${question.studentId.slice(0, 6)}`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {!question.answered && (
            <button
              onClick={() => markAsAnswered(question.id)}
              className="p-1.5 text-sage-600 hover:text-sage-700 dark:text-sage-400 dark:hover:text-sage-300 hover:bg-sage-100 dark:hover:bg-sage-900/20 rounded transition-colors"
              title="Mark as answered"
            >
              <FaCheck className="text-xs" />
            </button>
          )}
          <button
            onClick={() => deleteQuestion(question.id)}
            className="p-1.5 text-dusty-rose-600 hover:text-dusty-rose-700 dark:text-dusty-rose-400 dark:hover:text-dusty-rose-300 hover:bg-dusty-rose-100 dark:hover:bg-dusty-rose-900/20 rounded transition-colors"
            title="Delete question"
          >
            <FaTrash className="text-xs" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Questions Display Component
function QuestionsDisplay() {
  const { questions, isActive, clearQuestions } = useQuestions();
  const { session, isRoomActive } = useNetworkedWidgetContext();
  
  return (
    <>
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
          {questions.length} question{questions.length !== 1 ? 's' : ''}
        </span>
        {questions.length > 0 && (
          <button
            onClick={clearQuestions}
            className="text-xs text-dusty-rose-600 hover:text-dusty-rose-700 dark:text-dusty-rose-400 dark:hover:text-dusty-rose-300"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col relative">
        {/* Paused overlay */}
        {!isActive && isRoomActive && session.isConnected && (
          <div className="absolute inset-0 bg-white/60 dark:bg-warm-gray-800/60 backdrop-blur-[2px] rounded-lg flex items-center justify-center z-10">
            <div className="text-center bg-white/90 dark:bg-warm-gray-800/90 rounded-lg px-6 py-4 shadow-lg">
              <p className="text-warm-gray-700 dark:text-warm-gray-300 font-medium mb-2">Questions are paused</p>
              <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400">Click play to accept questions</p>
            </div>
          </div>
        )}
        
        {questions.length > 0 ? (
          <div className="space-y-2 overflow-y-auto flex-1">
            {questions.map((question, index) => (
              <QuestionItem key={question.id} question={question} index={index} />
            ))}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-warm-gray-500 dark:text-warm-gray-400">
            {isActive ? "Waiting for questions..." : "Click play to start accepting questions"}
          </div>
        )}
      </div>
    </>
  );
}

// Main Questions Content with Provider
function QuestionsContent() {
  const { widgetId, savedState, onStateChange } = useWidget();
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
    'questionsCleared': () => {
      setQuestions([]);
    },
    'dataUpdate': (data: { questions: Question[]; isActive: boolean }) => {
      setQuestions(data.questions || []);
      setIsActive(data.isActive || false);
    },
    'stateChanged': (data: { isActive: boolean }) => {
      setIsActive(data.isActive);
    }
  }), []);

  // Use the socket hook
  const { emitWidgetEvent, toggleActive: toggleSocketActive } = useWidgetSocket({
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

  const toggleActive = useCallback(() => {
    toggleSocketActive(!isActive);
  }, [isActive, toggleSocketActive]);

  const markAsAnswered = useCallback((questionId: string) => {
    setQuestions(prev => 
      prev.map(q => 
        q.id === questionId ? { ...q, answered: true } : q
      )
    );
    emitWidgetEvent('markAnswered', { questionId });
  }, [emitWidgetEvent]);

  const deleteQuestion = useCallback((questionId: string) => {
    setQuestions(prev => prev.filter(q => q.id !== questionId));
    emitWidgetEvent('delete', { questionId });
  }, [emitWidgetEvent]);

  const clearQuestions = useCallback(() => {
    setQuestions([]);
    emitWidgetEvent('clear', {});
  }, [emitWidgetEvent]);

  // Persist state changes
  useEffect(() => {
    onStateChange?.({
      questions,
      isActive
    });
  }, [onStateChange, questions, isActive]);

  return (
    <QuestionsContext.Provider value={{
      questions,
      isActive,
      toggleActive,
      markAsAnswered,
      deleteQuestion,
      clearQuestions
    }}>
      <QuestionsDisplay />
    </QuestionsContext.Provider>
  );
}

// Main Questions Component
interface QuestionsProps {
  widgetId?: string;
  savedState?: any;
  onStateChange?: (state: any) => void;
}

function Questions({ widgetId, savedState, onStateChange }: QuestionsProps) {
  return (
    <WidgetProvider widgetId={widgetId} savedState={savedState} onStateChange={onStateChange}>
      <NetworkedWidgetWrapperV2
        roomType="questions"
        title="Student Questions"
        description="Let students submit questions during your lesson"
        icon={FaQuestion}
        onRoomCreated={() => {
          // Handled by socket events
        }}
        onRoomClosed={() => {
          // State cleanup handled by wrapper
        }}
        headerChildren={<QuestionsHeader />}
      >
        <QuestionsContent />
      </NetworkedWidgetWrapperV2>
    </WidgetProvider>
  );
}

export default Questions;