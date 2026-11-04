import React, { useState, useId } from 'react';
import { Socket } from 'socket.io-client';
import { useWidgetStateChange } from '../hooks/useWidgetStateChange';
import { useTextSubmission } from '../hooks/useTextSubmission';
import SubmissionFeedback from './SubmissionFeedback';
import type { LinkShareStateChangedData } from '@shared/types/socket.types';

interface LinkShareActivityProps {
  socket: Socket;
  roomCode: string;
  studentName: string;
  widgetId?: string;
  initialIsActive?: boolean;
  initialAcceptMode?: 'links' | 'all';
}

const MAX_TEXT_LENGTH = 280;

const LinkShareActivity: React.FC<LinkShareActivityProps> = ({
  socket,
  roomCode,
  studentName,
  widgetId,
  initialIsActive = false,
  initialAcceptMode = 'all'
}) => {
  const { text: content, edit, submission, isConnected, submissionCount, submit, startAnother } =
    useTextSubmission(socket, roomCode, widgetId, 'session:linkShare:submit');
  const isSubmitting = submission.status === 'sending' || submission.status === 'uncertain';
  const inputId = useId();
  const [isActive, setIsActive] = useState(initialIsActive);
  const [acceptMode, setAcceptMode] = useState<'links' | 'all'>(initialAcceptMode);

  // Listen for room state changes using shared hook
  useWidgetStateChange<LinkShareStateChangedData>({
    socket,
    roomCode,
    roomType: 'linkShare',
    widgetId,
    initialIsActive,
    onStateChange: (newIsActive, data) => {
      setIsActive(newIsActive);
      // Update acceptMode if provided in the state update
      if (data?.acceptMode) {
        setAcceptMode(data.acceptMode);
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isActive) return;
    const trimmedContent = content.trim();
    const validationError = !trimmedContent
      ? (acceptMode === 'links' ? 'Please enter a link to share' : 'Please enter something to share')
      : acceptMode === 'all' && trimmedContent.length > MAX_TEXT_LENGTH
        ? `Text must be ${MAX_TEXT_LENGTH} characters or less` : undefined;
    submit({
      studentName: studentName || 'Anonymous',
      content: trimmedContent
    }, validationError);
  };

  // Check if content exceeds limit
  const isOverLimit = acceptMode === 'all' && content.length > MAX_TEXT_LENGTH;
  const charsRemaining = MAX_TEXT_LENGTH - content.length;

  return (
    <div className="relative">
      {!isActive ? (
        // Inactive state
        <div className="flex flex-col items-center justify-center py-8">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-warm-gray-600 dark:text-warm-gray-400 mb-2">
              Drop Box Paused
            </h2>
            <p className="text-warm-gray-500 text-sm">
              Waiting for teacher to start accepting submissions...
            </p>
          </div>
        </div>
      ) : (
        // Active state
        <>
          <form onSubmit={handleSubmit} className="mb-4">
            <div className="mb-3">
              <div className="flex justify-between items-center mb-1">
                <label htmlFor={inputId} className="text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300">
                  {acceptMode === 'links' ? 'Share a Link' : 'Share a Link or Text'}
                </label>
                {submissionCount > 0 && (
                  <span className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
                    {submissionCount} submitted
                  </span>
                )}
              </div>
              {acceptMode === 'links' ? (
                <input
                  type="text"
                  id={inputId}
                  placeholder="example.com or https://example.com"
                  value={content}
                  onChange={(e) => edit(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="w-full py-2 px-3 border border-warm-gray-300 dark:border-warm-gray-600 rounded-md text-sm bg-white dark:bg-warm-gray-700 text-warm-gray-800 dark:text-warm-gray-200 focus:outline-none focus:border-sage-500 dark:focus:border-sage-400 focus:shadow-[0_0_0_2px_rgba(94,139,94,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
                />
              ) : (
                <div className="relative">
                  <textarea
                    id={inputId}
                    placeholder="Paste a link or type a short message..."
                    value={content}
                    onChange={(e) => edit(e.target.value)}
                    required
                    disabled={isSubmitting}
                    rows={3}
                    className={`w-full py-2 px-3 border rounded-md text-sm bg-white dark:bg-warm-gray-700 text-warm-gray-800 dark:text-warm-gray-200 focus:outline-none focus:shadow-[0_0_0_2px_rgba(94,139,94,0.2)] disabled:opacity-50 disabled:cursor-not-allowed resize-none ${
                      isOverLimit
                        ? 'border-dusty-rose-500 dark:border-dusty-rose-400 focus:border-dusty-rose-500'
                        : 'border-warm-gray-300 dark:border-warm-gray-600 focus:border-sage-500 dark:focus:border-sage-400'
                    }`}
                  />
                  <div className={`absolute bottom-2 right-2 text-xs ${
                    isOverLimit
                      ? 'text-dusty-rose-600 dark:text-dusty-rose-400 font-medium'
                      : charsRemaining <= 20
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-warm-gray-400 dark:text-warm-gray-500'
                  }`}>
                    {charsRemaining}
                  </div>
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !isConnected || !isActive || isOverLimit || !content.trim()}
              className="mt-3 w-3/4 mx-auto block bg-terracotta-500 dark:bg-terracotta-400 text-white hover:bg-terracotta-600 dark:hover:bg-terracotta-500 py-2 px-3 rounded-md text-sm font-medium cursor-pointer transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submission.status === 'sending' ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        </>
      )}
      <SubmissionFeedback submission={submission} isConnected={isConnected} onStartAnother={startAnother} />
    </div>
  );
};

export default LinkShareActivity;
