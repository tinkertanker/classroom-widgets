import React, { useState, useEffect } from 'react';
import { NetworkedWidgetEmpty } from '../shared/NetworkedWidgetEmpty';
import { NetworkedWidgetHeader } from '../shared/NetworkedWidgetHeader';
import { useSessionContext } from '../../contexts/SessionContext';
import { FaQuestion, FaPlay, FaStop, FaTrash, FaCheck } from 'react-icons/fa6';

interface Question {
  id: string;
  text: string;
  timestamp: Date;
  studentId: string;
  answered?: boolean;
}

interface QuestionsProps {
  widgetId?: string;
  savedState?: any;
  onStateChange?: (state: any) => void;
}

function Questions({ widgetId, savedState, onStateChange }: QuestionsProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [isRoomActive, setIsRoomActive] = useState(false);
  
  const session = useSessionContext();

  // Setup socket listeners
  useEffect(() => {
    if (!session.socket) return;

    const handleNewQuestion = (data: { questionId: string; text: string; studentId: string }) => {
      const newQuestion: Question = {
        id: data.questionId,
        text: data.text,
        timestamp: new Date(),
        studentId: data.studentId,
        answered: false
      };
      setQuestions(prev => [...prev, newQuestion]);
    };

    const handleQuestionAnswered = (data: { questionId: string }) => {
      setQuestions(prev => 
        prev.map(q => 
          q.id === data.questionId ? { ...q, answered: true } : q
        )
      );
    };

    const handleQuestionDeleted = (data: { questionId: string }) => {
      setQuestions(prev => prev.filter(q => q.id !== data.questionId));
    };

    const handleAllQuestionsCleared = () => {
      setQuestions([]);
    };

    const handleRoomCreated = (data: { roomType: string }) => {
      if (data.roomType === 'questions') {
        setIsRoomActive(true);
      }
    };

    const handleRoomClosed = (data: { roomType: string }) => {
      if (data.roomType === 'questions') {
        setIsRoomActive(false);
        setQuestions([]);
        setIsActive(false);
      }
    };

    session.socket.on('newQuestion', handleNewQuestion);
    session.socket.on('questionAnswered', handleQuestionAnswered);
    session.socket.on('questionDeleted', handleQuestionDeleted);
    session.socket.on('allQuestionsCleared', handleAllQuestionsCleared);
    session.socket.on('session:roomCreated', handleRoomCreated);
    session.socket.on('session:roomClosed', handleRoomClosed);

    return () => {
      session.socket?.off('newQuestion', handleNewQuestion);
      session.socket?.off('questionAnswered', handleQuestionAnswered);
      session.socket?.off('questionDeleted', handleQuestionDeleted);
      session.socket?.off('allQuestionsCleared', handleAllQuestionsCleared);
      session.socket?.off('session:roomCreated', handleRoomCreated);
      session.socket?.off('session:roomClosed', handleRoomClosed);
    };
  }, [session.socket]);

  // Handle widget cleanup
  useEffect(() => {
    const handleWidgetCleanup = (event: CustomEvent) => {
      if (event.detail.widgetId === widgetId && isRoomActive) {
        session.closeRoom('questions');
      }
    };
    
    window.addEventListener('widget-cleanup' as any, handleWidgetCleanup);
    
    return () => {
      window.removeEventListener('widget-cleanup' as any, handleWidgetCleanup);
    };
  }, [widgetId, isRoomActive, session]);

  // Load saved state
  useEffect(() => {
    if (savedState) {
      setQuestions(savedState.questions || []);
      setIsActive(savedState.isActive || false);
      setIsRoomActive(savedState.isRoomActive || false);
    }
  }, [savedState]);

  // Save state when it changes
  useEffect(() => {
    onStateChange?.({ 
      questions,
      isActive,
      isRoomActive
    });
  }, [questions, isActive, isRoomActive, onStateChange]);

  const handleStart = async () => {
    try {
      let sessionCode = session.sessionCode;
      
      // Create session if needed
      if (!sessionCode) {
        sessionCode = await session.createSession();
      }
      
      // Create questions room
      await session.createRoom('questions');
      setIsRoomActive(true);
      setIsActive(true);
      
      // Start accepting questions
      session.socket?.emit('session:questions:start', {
        sessionCode: session.sessionCode
      });
    } catch (error) {
      console.error('Failed to start questions:', error);
    }
  };

  const handleToggleActive = () => {
    if (!session.socket || !session.sessionCode) return;
    
    if (isActive) {
      session.socket.emit('session:questions:stop', {
        sessionCode: session.sessionCode
      });
      setIsActive(false);
    } else {
      session.socket.emit('session:questions:start', {
        sessionCode: session.sessionCode
      });
      setIsActive(true);
    }
  };

  const handleMarkAnswered = (questionId: string) => {
    if (!session.socket || !session.sessionCode) return;
    
    session.socket.emit('session:questions:markAnswered', {
      sessionCode: session.sessionCode,
      questionId
    });
  };

  const handleDeleteQuestion = (questionId: string) => {
    if (!session.socket || !session.sessionCode) return;
    
    session.socket.emit('session:questions:delete', {
      sessionCode: session.sessionCode,
      questionId
    });
  };

  const handleClearAll = () => {
    if (!session.socket || !session.sessionCode) return;
    
    if (window.confirm('Are you sure you want to clear all questions?')) {
      session.socket.emit('session:questions:clearAll', {
        sessionCode: session.sessionCode
      });
    }
  };

  // Sort questions: unanswered first, then by timestamp
  const sortedQuestions = [...questions].sort((a, b) => {
    if (a.answered !== b.answered) {
      return a.answered ? 1 : -1;
    }
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  // Empty state
  if (!isRoomActive || !session.sessionCode) {
    return (
      <NetworkedWidgetEmpty
        icon={FaQuestion}
        title="Student Questions"
        description="Let students submit questions during your lesson"
        buttonText={session.isConnecting ? "Connecting..." : "Start Questions"}
        onStart={handleStart}
        disabled={session.isConnecting || !session.isConnected}
        error={session.connectionError}
      />
    );
  }

  return (
    <div className="bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 w-full h-full flex flex-col p-4 relative">
      <NetworkedWidgetHeader 
        roomCode={session.sessionCode}
        participantCount={session.participantCount}
      >
        <button
          onClick={handleToggleActive}
          className={`p-1.5 rounded transition-colors duration-200 ${
            isActive 
              ? 'bg-dusty-rose-500 hover:bg-dusty-rose-600 text-white' 
              : 'bg-sage-500 hover:bg-sage-600 text-white'
          }`}
          title={isActive ? "Stop accepting questions" : "Start accepting questions"}
        >
          {isActive ? <FaStop /> : <FaPlay />}
        </button>
      </NetworkedWidgetHeader>

      {/* Questions count */}
      <div className="mt-3 mb-2 flex justify-between items-center">
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
      <div className="flex-1 overflow-y-auto space-y-2">
        {sortedQuestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-warm-gray-400 dark:text-warm-gray-600">
            <FaQuestion className="text-4xl mb-2" />
            <p className="text-sm">
              {isActive ? "Waiting for questions..." : "Start accepting questions"}
            </p>
          </div>
        ) : (
          sortedQuestions.map((question) => (
            <div
              key={question.id}
              className={`p-3 rounded-lg border transition-all duration-200 ${
                question.answered
                  ? 'bg-warm-gray-50 dark:bg-warm-gray-750 border-warm-gray-200 dark:border-warm-gray-600 opacity-60'
                  : 'bg-white dark:bg-warm-gray-700 border-warm-gray-300 dark:border-warm-gray-600'
              }`}
            >
              <div className="flex justify-between items-start gap-2">
                <p className={`text-sm flex-1 ${
                  question.answered ? 'line-through text-warm-gray-500' : 'text-warm-gray-700 dark:text-warm-gray-200'
                }`}>
                  {question.text}
                </p>
                <div className="flex gap-1">
                  {!question.answered && (
                    <button
                      onClick={() => handleMarkAnswered(question.id)}
                      className="p-1.5 text-sage-600 hover:bg-sage-100 dark:text-sage-400 dark:hover:bg-sage-900/30 rounded transition-colors"
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
                {new Date(question.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Status indicator */}
      {!isActive && questions.length === 0 && (
        <div className="mt-3 pt-3 border-t border-warm-gray-200 dark:border-warm-gray-700 text-center">
          <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
            Click the play button to start accepting questions
          </p>
        </div>
      )}
    </div>
  );
}

export default Questions;