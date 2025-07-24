import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';

interface DataShareActivityProps {
  socket: Socket;
  roomCode: string;
  studentName: string;
  isSession?: boolean;
  widgetId?: string;
}

const DataShareActivity: React.FC<DataShareActivityProps> = ({ 
  socket, 
  roomCode, 
  studentName,
  isSession = false,
  widgetId
}) => {
  const [shareLink, setShareLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Join the widget-specific room on mount
  useEffect(() => {
    if (isSession && widgetId) {
      socket.emit('session:joinRoom', {
        sessionCode: roomCode,
        roomType: 'dataShare',
        widgetId
      });

      return () => {
        socket.emit('session:leaveRoom', {
          sessionCode: roomCode,
          roomType: 'dataShare',
          widgetId
        });
      };
    }
  }, [socket, roomCode, widgetId, isSession]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!shareLink.trim()) {
      setError('Please enter a link to share');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    if (isSession) {
      socket.emit('session:dataShare:submit', {
        sessionCode: roomCode,
        studentName: studentName || 'Anonymous',
        link: shareLink.trim(),
        widgetId
      });
    } else {
      socket.emit('dataShare:submit', {
        code: roomCode,
        studentName: studentName || 'Anonymous',
        link: shareLink.trim()
      });
    }

    // Listen for response
    const responseEvent = isSession ? 'session:dataShare:submitted' : 'dataShare:submitted';
    socket.once(responseEvent, (response: { success: boolean; error?: string }) => {
      setIsSubmitting(false);
      
      if (response.success) {
        setIsSuccess(true);
      } else {
        setError(response.error || 'Failed to share link. Please try again.');
      }
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      setIsSubmitting(false);
      setError('Connection timeout. Please try again.');
    }, 10000);
  };

  if (isSuccess) {
    return (
      <div>
        <div className="bg-sage-50 dark:bg-sage-900/30 border border-sage-200 dark:border-sage-700 rounded-lg p-3 text-center text-sage-700 dark:text-sage-300 font-medium my-3 text-sm">
          Link shared successfully!
        </div>
        
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="shareLink" className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-1">Presentation Link</label>
          <input
            type="url"
            id="shareLink"
            placeholder="https://example.com/presentation"
            value={shareLink}
            onChange={(e) => setShareLink(e.target.value)}
            required
            className="w-full py-2 px-3 border border-warm-gray-300 dark:border-warm-gray-600 rounded-md text-sm bg-white dark:bg-warm-gray-700 text-warm-gray-800 dark:text-warm-gray-200 focus:outline-none focus:border-sage-500 dark:focus:border-sage-400 focus:shadow-[0_0_0_2px_rgba(94,139,94,0.2)]"
          />
        </div>
        <button type="submit" disabled={isSubmitting} className="mt-3 w-full bg-terracotta-500 hover:bg-terracotta-600 text-white py-2 px-3 rounded-md text-sm font-medium cursor-pointer transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
          {isSubmitting ? 'Sharing...' : 'Share Link'}
        </button>
        {error && <div className="mt-2 bg-dusty-rose-50 dark:bg-dusty-rose-900/30 text-dusty-rose-700 dark:text-dusty-rose-300 p-2 rounded-md text-sm border border-dusty-rose-200 dark:border-dusty-rose-700">{error}</div>}
      </form>
      
    </div>
  );
};

export default DataShareActivity;