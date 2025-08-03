import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { getStudentQuestionColor } from '../../../../src/shared/constants/studentQuestionColors';
import { useWidgetStateChange } from '../hooks/useWidgetStateChange';

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
  const [questionText, setQuestionText] = useState('');
  const [isActive, setIsActive] = useState(initialIsActive ?? false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Update isActive when prop changes
  useEffect(() => {
    if (initialIsActive !== undefined) {
      setIsActive(initialIsActive);
    }
  }, [initialIsActive]);

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
    socket.emit('questions:requestState', { code: sessionCode, widgetId });

    // Handle existing questions list
    socket.on('questions:list', (data: { questions: Question[]; widgetId?: string }) => {
      // Only handle if it's for this widget
      if (data.widgetId === widgetId || (!data.widgetId && !widgetId)) {
        setQuestions(data.questions || []);
      }
    });

    // Handle question being answered
    socket.on('questionAnswered', (data: { questionId: string }) => {
      setQuestions(prev => prev.map(q => 
        q.id === data.questionId ? { ...q, answered: true } : q
      ));
    });

    // Handle question being deleted
    socket.on('questionDeleted', (data: { questionId: string }) => {
      setQuestions(prev => prev.filter(q => q.id !== data.questionId));
    });

    // Handle all questions being cleared
    socket.on('allQuestionsCleared', () => {
      setQuestions([]);
    });

    // Handle submission response
    socket.on('session:questions:submitted', (data: { success: boolean; error?: string }) => {
      setIsSubmitting(false);
      if (data.success) {
        setQuestionText('');
        setError('');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } else if (data.error) {
        setError(data.error);
      }
    });

    // Handle submission error
    socket.on('questions:error', (data: { error: string }) => {
      setError(data.error);
      setIsSubmitting(false);
    });

    return () => {
      socket.off('questions:list');
      socket.off('questionAnswered');
      socket.off('questionDeleted');
      socket.off('allQuestionsCleared');
      socket.off('session:questions:submitted');
      socket.off('questions:error');
    };
  }, [socket, sessionCode, studentId, widgetId]);

  const handleSubmitQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!questionText.trim()) {
      setError('Please enter a question');
      return;
    }

    // Socket is always available in this component

    setIsSubmitting(true);
    setError('');

    // Don't add question locally - wait for server confirmation

    socket.emit('session:questions:submit', {
      sessionCode,
      question: questionText.trim(),
      studentName: studentName || 'Anonymous',
      widgetId
    });
  };

  // Sort questions by timestamp (newest first)
  const sortedQuestions = [...questions].sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  return (
    <div className="p-3 relative">
      {!isActive ? (
        // Waiting state when teacher has stopped accepting questions
        <div className="flex flex-col items-center justify-center py-8">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-warm-gray-600 mb-2">
              Questions Paused
            </h2>
            <p className="text-warm-gray-500 text-sm">
              Waiting for teacher to start accepting questions...
            </p>
          </div>
        </div>
      ) : (
        <>

          {/* Question submission form */}
          <form onSubmit={handleSubmitQuestion} className="mb-4">
            <div className="space-y-3">
              <div>
                <label htmlFor="question" className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-1">
                  Your Question
                </label>
                <textarea
                  id="question"
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  className="w-full py-2 px-3 border border-warm-gray-300 dark:border-warm-gray-600 rounded-md text-sm bg-white dark:bg-warm-gray-700 text-warm-gray-800 dark:text-warm-gray-200 focus:outline-none focus:border-sage-500 dark:focus:border-sage-400 focus:shadow-[0_0_0_2px_rgba(94,139,94,0.2)] resize-none"
                  placeholder="Type your question here..."
                  rows={3}
                  maxLength={500}
                  disabled={isSubmitting}
                />
                <div className="mt-1 text-xs text-warm-gray-500 dark:text-warm-gray-400 text-right">
                  {questionText.length}/500
                </div>
              </div>

              {error && (
                <div className="bg-dusty-rose-50 dark:bg-dusty-rose-900/30 text-dusty-rose-700 dark:text-dusty-rose-300 p-2 rounded-md text-sm border border-dusty-rose-200 dark:border-dusty-rose-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !questionText.trim()}
                className="w-full bg-transparent dark:bg-transparent border-2 border-sage-500 dark:border-sage-400 text-sage-600 dark:text-sage-400 hover:bg-sage-500 hover:text-white dark:hover:bg-sage-400 dark:hover:text-warm-gray-900 py-2 px-3 rounded-md text-sm font-medium cursor-pointer transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Question'}
              </button>
            </div>
          </form>

          {/* Success message overlay */}
          <div className={`absolute inset-x-0 top-0 z-10 transition-all duration-300 ease-in-out ${
            showSuccess ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'
          }`}>
            <div className="bg-sage-100 dark:bg-sage-900/30 text-sage-700 dark:text-sage-300 p-3 text-center font-medium text-sm shadow-md border border-sage-200 dark:border-sage-700">
              ✓ Question submitted successfully!
            </div>
          </div>

          {/* Submitted questions */}
          {sortedQuestions.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-2">
                Your Questions ({sortedQuestions.length})
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
    </div>
  );
};

export default QuestionsActivity;