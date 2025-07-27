import React, { useState, useEffect, useCallback } from 'react';
import { NetworkedWidgetWrapper } from '../shared/NetworkedWidgetWrapper';
import { FaQuestion, FaPlay, FaPause, FaTrash, FaCheck } from 'react-icons/fa6';
import { getQuestionColor } from '../../../utils/questionColors';

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

// Event names will be created dynamically based on widgetId

function Questions({ widgetId, savedState, onStateChange }: QuestionsProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isActive, setIsActive] = useState(false);

  // Load saved state
  useEffect(() => {
    if (savedState) {
      setQuestions(savedState.questions || []);
      setIsActive(savedState.isActive || false);
    }
  }, [savedState]);

  const handleStateChange = useCallback((state: any) => {
    onStateChange?.({
      ...state,
      questions,
      isActive
    });
  }, [onStateChange, questions, isActive]);

  return (
    <NetworkedWidgetWrapper
      widgetId={widgetId}
      savedState={savedState}
      onStateChange={handleStateChange}
      roomType="questions"
      title="Student Questions"
      description="Let students submit questions during your lesson"
      icon={FaQuestion}
      onRoomCreated={() => {
        setIsActive(true);
        // Start accepting questions automatically when room is created
      }}
      onRoomClosed={() => {
        setQuestions([]);
        setIsActive(false);
      }}
      headerChildren={
        <button
          onClick={() => setIsActive(!isActive)}
          className={`p-1.5 rounded transition-colors duration-200 ${
            isActive 
              ? 'bg-dusty-rose-500 hover:bg-dusty-rose-600 text-white' 
              : 'bg-sage-500 hover:bg-sage-600 text-white'
          }`}
          title={isActive ? "Pause accepting questions" : "Resume accepting questions"}
        >
          {isActive ? <FaPause /> : <FaPlay />}
        </button>
      }
    >
      {({ session, isRoomActive }) => {
        // Join the widget-specific room
        useEffect(() => {
          if (!session.socket || !session.sessionCode || !isRoomActive) return;
          
          // Join the room for this specific widget instance
          session.socket.emit('session:joinRoom', { 
            sessionCode: session.sessionCode,
            roomType: 'questions',
            widgetId 
          });
          
          return () => {
            session.socket?.emit('session:leaveRoom', { 
              sessionCode: session.sessionCode,
              roomType: 'questions',
              widgetId 
            });
          };
        }, [session.socket, session.sessionCode, isRoomActive, widgetId]);

        // Setup socket listeners
        useEffect(() => {
          if (!session.socket) return;

          const handleNewQuestion = (data: { questionId: string; text: string; studentId: string; studentName?: string }) => {
            const newQuestion: Question = {
              id: data.questionId,
              text: data.text,
              timestamp: new Date(),
              studentId: data.studentId,
              studentName: data.studentName,
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

          session.socket.on('newQuestion', handleNewQuestion);
          session.socket.on('questionAnswered', handleQuestionAnswered);
          session.socket.on('questionDeleted', handleQuestionDeleted);
          session.socket.on('allQuestionsCleared', handleAllQuestionsCleared);

          return () => {
            session.socket?.off('newQuestion', handleNewQuestion);
            session.socket?.off('questionAnswered', handleQuestionAnswered);
            session.socket?.off('questionDeleted', handleQuestionDeleted);
            session.socket?.off('allQuestionsCleared', handleAllQuestionsCleared);
          };
        }, [session.socket]);

        // Handle active state changes
        useEffect(() => {
          if (!session.socket || !session.sessionCode || !isRoomActive) return;
          
          const eventName = isActive ? 'session:questions:start' : 'session:questions:stop';
          session.socket.emit(eventName, {
            sessionCode: session.sessionCode,
            widgetId
          });
        }, [isActive, session.socket, session.sessionCode, isRoomActive, widgetId]);

        const handleMarkAnswered = (questionId: string) => {
          if (!session.socket || !session.sessionCode) return;
          
          session.socket.emit('session:questions:markAnswered', {
            sessionCode: session.sessionCode,
            widgetId,
            questionId
          });
        };

        const handleDeleteQuestion = (questionId: string) => {
          if (!session.socket || !session.sessionCode) return;
          
          session.socket.emit('session:questions:delete', {
            sessionCode: session.sessionCode,
            widgetId,
            questionId
          });
        };

        const handleClearAll = () => {
          if (!session.socket || !session.sessionCode) return;
          
          if (window.confirm('Are you sure you want to clear all questions?')) {
            session.socket.emit('session:questions:clearAll', {
              sessionCode: session.sessionCode,
              widgetId
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
            <div className="flex-1 overflow-y-auto space-y-2">
              {sortedQuestions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-warm-gray-400 dark:text-warm-gray-600">
                  <FaQuestion className="text-4xl mb-2" />
                  <p className="text-sm">
                    {isActive ? "Waiting for questions..." : "Start accepting questions"}
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

            {/* Status indicator */}
            {!isActive && questions.length === 0 && (
              <div className="mt-3 pt-3 border-t border-warm-gray-200 dark:border-warm-gray-700 text-center">
                <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
                  Click the play button to start accepting questions
                </p>
              </div>
            )}
          </>
        );
      }}
    </NetworkedWidgetWrapper>
  );
}

export default Questions;