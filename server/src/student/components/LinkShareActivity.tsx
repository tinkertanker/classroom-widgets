import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';

interface LinkShareActivityProps {
  socket: Socket;
  roomCode: string;
  studentName: string;
  isSession?: boolean;
  widgetId?: string;
  initialIsActive?: boolean;
}

const LinkShareActivity: React.FC<LinkShareActivityProps> = ({ 
  socket, 
  roomCode, 
  studentName,
  isSession = false,
  widgetId,
  initialIsActive = false
}) => {
  const [shareLink, setShareLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [isActive, setIsActive] = useState(initialIsActive);

  // Update isActive when prop changes
  useEffect(() => {
    setIsActive(initialIsActive);
  }, [initialIsActive]);

  // Listen for room state changes
  useEffect(() => {
    const handleRoomStateChanged = (data: { isActive: boolean }) => {
      setIsActive(data.isActive);
    };

    socket.on('linkShare:stateChanged', handleRoomStateChanged);
    
    // Request current state if we don't have initial state
    let timer: NodeJS.Timeout | undefined;
    if (initialIsActive === undefined) {
      timer = setTimeout(() => {
        socket.emit('linkShare:requestState', { code: roomCode, widgetId });
      }, 100);
    }

    return () => {
      if (timer) clearTimeout(timer);
      socket.off('linkShare:stateChanged', handleRoomStateChanged);
    };
  }, [socket, roomCode, widgetId, initialIsActive]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!shareLink.trim()) {
      setError('Please enter a link to share');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    if (isSession) {
      socket.emit('session:linkShare:submit', {
        sessionCode: roomCode,
        studentName: studentName || 'Anonymous',
        link: shareLink.trim(),
        widgetId
      });
    } else {
      socket.emit('linkShare:submit', {
        code: roomCode,
        studentName: studentName || 'Anonymous',
        link: shareLink.trim()
      });
    }

    // Set up timeout
    const timeoutId = setTimeout(() => {
      setIsSubmitting(false);
      setError('Connection timeout. Please try again.');
      // Remove the response listener if timeout occurs
      socket.off(responseEvent);
    }, 10000);

    // Listen for response
    const responseEvent = isSession ? 'session:linkShare:submitted' : 'linkShare:submitted';
    
    const handleResponse = (response: { success: boolean; error?: string }) => {
      // Clear the timeout since we got a response
      clearTimeout(timeoutId);
      setIsSubmitting(false);
      
      if (response.success) {
        setShareLink(''); // Clear the input for next submission
        setError('');
        setShowSuccess(true);
        setSubmissionCount(prev => prev + 1);
        // Hide success message after 3 seconds
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        setError(response.error || 'Failed to share link. Please try again.');
      }
    };
    
    socket.once(responseEvent, handleResponse);
  };

  // Remove the isSuccess early return - always show the form

  return (
    <div className="relative">
      {!isActive ? (
        // Inactive state
        <div className="flex flex-col items-center justify-center py-8">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-warm-gray-600 mb-2">
              Link Sharing Paused
            </h2>
            <p className="text-warm-gray-500 text-sm">
              Waiting for teacher to start accepting links...
            </p>
          </div>
        </div>
      ) : (
        // Active state
        <>
          {/* Success message overlay */}
          <div className={`absolute inset-x-0 top-0 z-10 transition-all duration-300 ease-in-out ${
            showSuccess ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'
          }`}>
            <div className="bg-terracotta-500 dark:bg-terracotta-600 text-white p-3 text-center font-medium text-sm shadow-lg">
              Link shared successfully!
            </div>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="shareLink" className="text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300">Share a Link</label>
                {submissionCount > 0 && (
                  <span className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
                    {submissionCount} link{submissionCount !== 1 ? 's' : ''} shared
                  </span>
                )}
              </div>
              <input
                type="url"
                id="shareLink"
                placeholder="https://example.com/presentation"
                value={shareLink}
                onChange={(e) => setShareLink(e.target.value)}
                required
                disabled={!isActive}
                className="w-full py-2 px-3 border border-warm-gray-300 dark:border-warm-gray-600 rounded-md text-sm bg-white dark:bg-warm-gray-700 text-warm-gray-800 dark:text-warm-gray-200 focus:outline-none focus:border-sage-500 dark:focus:border-sage-400 focus:shadow-[0_0_0_2px_rgba(94,139,94,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <button type="submit" disabled={isSubmitting || !isActive} className="mt-3 w-full bg-terracotta-500 hover:bg-terracotta-600 text-white py-2 px-3 rounded-md text-sm font-medium cursor-pointer transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
              {isSubmitting ? 'Sharing...' : 'Share Link'}
            </button>
            {error && <div className="mt-2 bg-dusty-rose-50 dark:bg-dusty-rose-900/30 text-dusty-rose-700 dark:text-dusty-rose-300 p-2 rounded-md text-sm border border-dusty-rose-200 dark:border-dusty-rose-700">{error}</div>}
          </form>
        </>
      )}
    </div>
  );
};

export default LinkShareActivity;