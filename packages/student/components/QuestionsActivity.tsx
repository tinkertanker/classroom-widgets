import React, { useState, useEffect, useMemo, useId } from 'react';
import { Socket } from 'socket.io-client';
import { getStudentQuestionColor } from '@shared/constants/studentQuestionColors';
import { useWidgetStateChange } from '../hooks/useWidgetStateChange';
import { useTextSubmission } from '../hooks/useTextSubmission';
import SubmissionFeedback from './SubmissionFeedback';

interface Question {
  id: string;
  text: string;
  timestamp: Date;
  answered?: boolean;
}

interface QuestionsActivityProps {
  socket: Socket;
  sessionCode: string;
  studentId: string;
  studentName?: string;
  widgetId?: string;
  initialIsActive?: boolean;
}

const QuestionsActivity: React.FC<QuestionsActivityProps> = ({
  socket,
  sessionCode,
  studentId,
  studentName,
  widgetId,
  initialIsActive
}) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const { text: questionText, edit, submission, isConnected, submit, startAnother } =
    useTextSubmission(socket, sessionCode, widgetId, 'session:questions:submit');
  const isSubmitting = submission.status === 'sending' || submission.status === 'uncertain';
  const inputId = useId();
  const [isActive, setIsActive] = useState(initialIsActive ?? false);

  // Listen for widget state changes using shared hook
  useWidgetStateChange({
    socket,
    roomCode: sessionCode,
    roomType: 'questions',
    widgetId,
    initialIsActive,
    onStateChange: (newIsActive) => {
      setIsActive(newIsActive);
    }
  });

  useEffect(() => {
    // Request current state when joining
    socket.emit('questions:requestState', { sessionCode: sessionCode, widgetId });

    // Handle combined state update
    const handleStateUpdate = (data: { isActive: boolean; questions: Question[]; widgetId?: string }) => {
      if (data.widgetId === widgetId || (!data.widgetId && !widgetId)) {
        setIsActive(data.isActive);
        setQuestions(data.questions || []);
      }
    };

    // Handle new question added
    const handleQuestionAdded = (data: { id: string; text: string; timestamp: Date; answered: boolean; widgetId?: string }) => {
      if (data.widgetId === widgetId || (!data.widgetId && !widgetId)) {
        setQuestions(prev => {
          // Avoid duplicates
          if (prev.some(q => q.id === data.id)) return prev;
          return [...prev, { id: data.id, text: data.text, timestamp: data.timestamp, answered: data.answered }];
        });
      }
    };

    // Handle question being answered
    const handleQuestionAnswered = (data: { questionId: string; widgetId?: string }) => {
      if (data.widgetId === widgetId || (!data.widgetId && !widgetId)) {
        setQuestions(prev => prev.map(q =>
          q.id === data.questionId ? { ...q, answered: true } : q
        ));
      }
    };

    // Handle question being deleted
    const handleQuestionDeleted = (data: { questionId: string; widgetId?: string }) => {
      if (data.widgetId === widgetId || (!data.widgetId && !widgetId)) {
        setQuestions(prev => prev.filter(q => q.id !== data.questionId));
      }
    };

    // Handle all questions being cleared
    const handleAllCleared = (data: { widgetId?: string }) => {
      if (data.widgetId === widgetId || (!data.widgetId && !widgetId)) {
        setQuestions([]);
      }
    };

    // Register event listeners
    socket.on('questions:stateUpdate', handleStateUpdate);
    socket.on('questions:questionAdded', handleQuestionAdded);
    socket.on('questions:questionAnswered', handleQuestionAnswered);
    socket.on('questions:questionDeleted', handleQuestionDeleted);
    socket.on('questions:allCleared', handleAllCleared);

    return () => {
      socket.off('questions:stateUpdate', handleStateUpdate);
      socket.off('questions:questionAdded', handleQuestionAdded);
      socket.off('questions:questionAnswered', handleQuestionAnswered);
      socket.off('questions:questionDeleted', handleQuestionDeleted);
      socket.off('questions:allCleared', handleAllCleared);
    };
  }, [socket, sessionCode, studentId, widgetId]);

  const handleSubmitQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isActive) return;
    submit({
      question: questionText.trim(),
      studentName: studentName || 'Anonymous'
    }, questionText.trim() ? undefined : 'Please enter a question or comment');
  };

  // Sort questions by timestamp (newest first)
  const sortedQuestions = useMemo(
    () =>
      [...questions].sort((a, b) => {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      }),
    [questions]
  );

  return (
    <div className="relative">
      {!isActive ? (
        // Waiting state when teacher has stopped accepting questions
        <div className="flex flex-col items-center justify-center py-8">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-warm-gray-600 dark:text-warm-gray-400 mb-2">
              Submissions Paused
            </h2>
            <p className="text-warm-gray-500 text-sm">
              Waiting for teacher to start accepting questions and comments...
            </p>
          </div>
        </div>
      ) : (
        <>

          {/* Question submission form */}
          <form onSubmit={handleSubmitQuestion} className="mb-4">
            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-baseline mb-1">
                  <label htmlFor={inputId} className="text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300">
                    Your Question or Comment
                  </label>
                  <span className="text-xs text-warm-gray-500 dark:text-warm-gray-400">
                    {questionText.length}/500
                  </span>
                </div>
                <textarea
                  id={inputId}
                  value={questionText}
                  onChange={(e) => edit(e.target.value)}
                  className="w-full py-2 px-3 border border-warm-gray-300 dark:border-warm-gray-600 rounded-md text-sm bg-white dark:bg-warm-gray-700 text-warm-gray-800 dark:text-warm-gray-200 focus:outline-none focus:border-sage-500 dark:focus:border-sage-400 focus:shadow-[0_0_0_2px_rgba(94,139,94,0.2)] resize-none"
                  placeholder="Ask a question or share a comment..."
                  rows={3}
                  maxLength={500}
                  disabled={isSubmitting}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !isConnected || !questionText.trim()}
                className="w-3/4 mx-auto block bg-sky-500 dark:bg-sky-400 text-white hover:bg-sky-600 dark:hover:bg-sky-500 py-2 px-3 rounded-md text-sm font-medium cursor-pointer transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submission.status === 'sending' ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </form>

          {/* Submitted questions */}
          {sortedQuestions.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-2">
                Class Questions ({sortedQuestions.length})
              </h3>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {sortedQuestions.map((question, index) => {
                  const color = getStudentQuestionColor(index);
                  return (
                    <div
                      key={question.id}
                      className={`p-2 rounded-md border transition-all duration-200 ${
                        question.answered
                          ? `${color.answeredBg} ${color.border} opacity-75`
                          : `${color.bg} ${color.border}`
                      }`}
                    >
                      <p className={`text-sm ${
                        question.answered 
                          ? `${color.answeredText} line-through` 
                          : color.text
                      }`}>
                        {question.text}
                      </p>
                      {question.answered && (
                        <p className="text-xs text-warm-gray-500 dark:text-warm-gray-400 mt-1">
                          ✓ Answered
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </>
      )}
      <SubmissionFeedback submission={submission} isConnected={isConnected} onStartAnother={startAnother} />
    </div>
  );
};

export default QuestionsActivity;
