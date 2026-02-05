import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { useWidgetStateChange } from '../hooks/useWidgetStateChange';

interface LinkShareActivityProps {
  socket: Socket;
  roomCode: string;
  studentName: string;
  isSession?: boolean;
  widgetId?: string;
  initialIsActive?: boolean;
  initialAcceptMode?: 'links' | 'all';
}

const MAX_TEXT_LENGTH = 280;

// Common file extensions to exclude from being treated as TLDs
const FILE_EXTENSIONS = ['txt', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'mp3', 'mp4', 'wav', 'avi', 'mov', 'zip', 'rar', 'tar', 'gz', 'json', 'xml', 'csv', 'html', 'css', 'js', 'ts', 'py', 'java', 'cpp', 'md', 'log'];

/**
 * Check if text looks like a URL without protocol and add https:// if so.
 * Uses a simple heuristic: if adding https:// makes it a valid URL, do it.
 */
const normalizeUrl = (text: string): string => {
  const trimmed = text.trim();

  // Already has a protocol
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // Quick check: must contain a dot and start with alphanumeric
  if (!/^[a-zA-Z0-9]/.test(trimmed) || !trimmed.includes('.')) {
    return trimmed;
  }

  // Don't treat things that have spaces
  if (trimmed.includes(' ') || trimmed.length > 2000) {
    return trimmed;
  }

  // Try adding https:// and see if it's a valid URL
  const withProtocol = `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    // Check: hostname should have at least one dot and valid TLD-like ending
    if (url.hostname.includes('.') && /\.[a-zA-Z]{2,}$/.test(url.hostname)) {
      // Exclude common file extensions from being treated as domains
      // e.g., "file.txt" should not become "https://file.txt"
      // but "domain.com/file.txt" is fine (the hostname is "domain.com")
      const hostnameExt = url.hostname.split('.').pop()?.toLowerCase();
      if (hostnameExt && FILE_EXTENSIONS.includes(hostnameExt)) {
        return trimmed;
      }
      return withProtocol;
    }
  } catch {
    // Not a valid URL, return as-is
  }

  return trimmed;
};

const LinkShareActivity: React.FC<LinkShareActivityProps> = ({
  socket,
  roomCode,
  studentName,
  isSession = false,
  widgetId,
  initialIsActive = false,
  initialAcceptMode = 'all'
}) => {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [isActive, setIsActive] = useState(initialIsActive);
  const [acceptMode, setAcceptMode] = useState<'links' | 'all'>(initialAcceptMode);

  // Update isActive when prop changes
  useEffect(() => {
    setIsActive(initialIsActive);
  }, [initialIsActive]);

  // Update acceptMode when prop changes
  useEffect(() => {
    setAcceptMode(initialAcceptMode);
  }, [initialAcceptMode]);

  // Listen for room state changes using shared hook
  useWidgetStateChange({
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      setError(acceptMode === 'links' ? 'Please enter a link to share' : 'Please enter something to share');
      return;
    }

    // Client-side validation for text length
    if (acceptMode === 'all' && trimmedContent.length > MAX_TEXT_LENGTH) {
      setError(`Text must be ${MAX_TEXT_LENGTH} characters or less`);
      return;
    }

    // Normalize URLs (add https:// if it looks like a domain)
    const normalizedContent = normalizeUrl(trimmedContent);

    setIsSubmitting(true);
    setError('');

    if (isSession) {
      socket.emit('session:linkShare:submit', {
        sessionCode: roomCode,
        studentName: studentName || 'Anonymous',
        content: normalizedContent,
        widgetId
      });
    } else {
      socket.emit('linkShare:submit', {
        code: roomCode,
        studentName: studentName || 'Anonymous',
        content: normalizedContent
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
        setContent(''); // Clear the input for next submission
        setError('');
        setShowSuccess(true);
        setSubmissionCount(prev => prev + 1);
        // Hide success message after 3 seconds
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        setError(response.error || 'Failed to submit. Please try again.');
      }
    };

    socket.once(responseEvent, handleResponse);
  };

  // Check if content exceeds limit
  const isOverLimit = acceptMode === 'all' && content.length > MAX_TEXT_LENGTH;
  const charsRemaining = MAX_TEXT_LENGTH - content.length;

  // Remove the isSuccess early return - always show the form

  return (
    <div className="relative">
      {!isActive ? (
        // Inactive state
        <div className="flex flex-col items-center justify-center py-8">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-warm-gray-600 mb-2">
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
          {/* Success message overlay */}
          <div className={`absolute inset-x-0 top-0 z-10 transition-all duration-300 ease-in-out ${
            showSuccess ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'
          }`}>
            <div className="bg-sage-100 dark:bg-sage-900/30 text-sage-700 dark:text-sage-300 p-3 text-center font-medium text-sm shadow-md border border-sage-200 dark:border-sage-700">
              ✓ Submitted successfully!
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="mb-4">
            <div className="mb-3">
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="shareContent" className="text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300">
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
                  id="shareContent"
                  placeholder="example.com or https://example.com"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                  disabled={!isActive}
                  className="w-full py-2 px-3 border border-warm-gray-300 dark:border-warm-gray-600 rounded-md text-sm bg-white dark:bg-warm-gray-700 text-warm-gray-800 dark:text-warm-gray-200 focus:outline-none focus:border-sage-500 dark:focus:border-sage-400 focus:shadow-[0_0_0_2px_rgba(94,139,94,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
                />
              ) : (
                <div className="relative">
                  <textarea
                    id="shareContent"
                    placeholder="Paste a link or type a short message..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    required
                    disabled={!isActive}
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
              disabled={isSubmitting || !isActive || isOverLimit}
              className="mt-3 w-3/4 mx-auto block bg-terracotta-500 dark:bg-terracotta-400 text-white hover:bg-terracotta-600 dark:hover:bg-terracotta-500 py-2 px-3 rounded-md text-sm font-medium cursor-pointer transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
            {error && <div className="mt-2 bg-dusty-rose-50 dark:bg-dusty-rose-900/30 text-dusty-rose-700 dark:text-dusty-rose-300 p-2 rounded-md text-sm border border-dusty-rose-200 dark:border-dusty-rose-700">{error}</div>}
          </form>
        </>
      )}
    </div>
  );
};

export default LinkShareActivity;