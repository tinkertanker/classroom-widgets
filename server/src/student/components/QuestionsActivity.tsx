import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';

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
  widgetId?: string;
  initialIsActive?: boolean;
}

const QuestionsActivity: React.FC<QuestionsActivityProps> = ({
  socket,
  sessionCode,
  studentId,
  widgetId,
  initialIsActive
}) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionText, setQuestionText] = useState('');
  const [isActive, setIsActive] = useState(initialIsActive ?? false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Join the widget-specific room on mount
  useEffect(() => {
    if (widgetId) {
      socket.emit('session:joinRoom', {
        sessionCode: sessionCode,
        roomType: 'questions',
        widgetId
      });

      return () => {
        socket.emit('session:leaveRoom', {
          sessionCode: sessionCode,
          roomType: 'questions',
          widgetId
        });
      };
    }
  }, [socket, sessionCode, widgetId]);

  useEffect(() => {

    // Request current state when joining
    socket.emit('questions:requestState', { code: sessionCode, widgetId });

    // Handle state changes
    socket.on('questions:stateChanged', (data: { isActive: boolean }) => {
      setIsActive(data.isActive);
    });

    // Handle existing questions list
    socket.on('questions:list', (questionsList: Question[]) => {
      setQuestions(questionsList);
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
    socket.on('questions:submitted', (data: { success: boolean }) => {
      if (data.success) {
        setQuestionText('');
        setError('');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
      setIsSubmitting(false);
    });

    // Handle submission error
    socket.on('questions:error', (data: { error: string }) => {
      setError(data.error);
      setIsSubmitting(false);
    });

    return () => {
      socket.off('questions:stateChanged');
      socket.off('questions:list');
      socket.off('questionAnswered');
      socket.off('questionDeleted');
      socket.off('allQuestionsCleared');
      socket.off('questions:submitted');
      socket.off('questions:error');
    };
  }, [socket, sessionCode, studentId]);

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
      text: questionText.trim(),
      widgetId
    });
  };

  // Sort questions by timestamp (newest first)
  const sortedQuestions = [...questions].sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  return (
    <div className="bg-warm-gray-50 dark:bg-warm-gray-900 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-warm-gray-800 dark:text-warm-gray-100">
            Ask Questions
          </h1>
          <p className="text-warm-gray-600 dark:text-warm-gray-400 mt-2">
            Submit questions to your teacher
          </p>
        </div>

        {/* Status */}
        <div className={`mb-6 p-4 rounded-lg ${
          isActive 
            ? 'bg-sage-100 dark:bg-sage-900/30 text-sage-700 dark:text-sage-300' 
            : 'bg-warm-gray-200 dark:bg-warm-gray-800 text-warm-gray-600 dark:text-warm-gray-400'
        }`}>
          {isActive ? (
            <p>Questions are being accepted. Ask away!</p>
          ) : (
            <p>Questions are not being accepted right now.</p>
          )}
        </div>

        {/* Question submission form */}
        {isActive && (
          <form onSubmit={handleSubmitQuestion} className="mb-8">
            <div className="bg-white dark:bg-warm-gray-800 rounded-lg shadow-sm p-6">
              <label className="block mb-4">
                <span className="text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-2 block">
                  Your Question
                </span>
                <textarea
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-warm-gray-300 dark:border-warm-gray-600 
                           bg-white dark:bg-warm-gray-700 text-warm-gray-800 dark:text-warm-gray-200
                           focus:outline-none focus:ring-2 focus:ring-sage-500 dark:focus:ring-sage-400
                           placeholder-warm-gray-400 dark:placeholder-warm-gray-500
                           resize-none"
                  placeholder="Type your question here..."
                  rows={3}
                  maxLength={500}
                  disabled={isSubmitting}
                />
                <div className="mt-1 text-xs text-warm-gray-500 dark:text-warm-gray-400 text-right">
                  {questionText.length}/500
                </div>
              </label>

              {error && (
                <p className="text-sm text-dusty-rose-600 dark:text-dusty-rose-400 mb-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !questionText.trim()}
                className="w-full px-4 py-2 bg-sage-500 text-white rounded-lg font-medium text-sm
                         hover:bg-sage-600 active:bg-sage-700 disabled:opacity-50 
                         disabled:cursor-not-allowed transition-colors duration-200"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Question'}
              </button>
            </div>
          </form>
        )}

        {/* Success message */}
        {showSuccess && (
          <div className="mb-3 p-3 bg-sage-100 dark:bg-sage-900/30 rounded-lg">
            <p className="text-sage-700 dark:text-sage-300 text-sm">
              ✓ Question submitted successfully!
            </p>
          </div>
        )}

      </div>
    </div>
  );
};

export default QuestionsActivity;