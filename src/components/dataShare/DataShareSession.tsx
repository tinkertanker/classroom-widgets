import React, { useState, useEffect } from 'react';
import { useSessionContext } from '../../contexts/SessionContext';
import { NetworkedWidgetHeader } from '../shared/NetworkedWidgetHeader';
import { NetworkedWidgetEmpty } from '../shared/NetworkedWidgetEmpty';
import { FaLink, FaTrash } from 'react-icons/fa6';

interface DataShareProps {
  widgetId?: string;
  savedState?: any;
  onStateChange?: (state: any) => void;
}

interface Submission {
  id: string;
  studentName: string;
  link: string;
  timestamp: number;
}

function DataShareSession({ widgetId }: DataShareProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isRoomActive, setIsRoomActive] = useState(false);
  
  const session = useSessionContext();

  // Don't auto-start - let user click start button
  // This prevents multiple widgets from fighting over session creation

  // Setup socket listeners
  useEffect(() => {
    if (!session.socket) return;

    const handleNewSubmission = (submission: Submission) => {
      setSubmissions(prev => [...prev, submission]);
    };

    const handleSubmissionDeleted = (submissionId: string) => {
      setSubmissions(prev => prev.filter(s => s.id !== submissionId));
    };

    const handleRoomCreated = (data: any) => {
      if (data.roomType === 'dataShare') {
        setIsRoomActive(true);
      }
    };

    const handleRoomClosed = (data: any) => {
      if (data.roomType === 'dataShare') {
        setIsRoomActive(false);
      }
    };

    session.socket.on('dataShare:newSubmission', handleNewSubmission);
    session.socket.on('dataShare:submissionDeleted', handleSubmissionDeleted);
    session.socket.on('session:roomCreated', handleRoomCreated);
    session.socket.on('session:roomClosed', handleRoomClosed);

    return () => {
      session.socket.off('dataShare:newSubmission', handleNewSubmission);
      session.socket.off('dataShare:submissionDeleted', handleSubmissionDeleted);
      session.socket.off('session:roomCreated', handleRoomCreated);
      session.socket.off('session:roomClosed', handleRoomClosed);
    };
  }, [session.socket]);

  // Handle widget cleanup
  useEffect(() => {
    const handleWidgetCleanup = (event: CustomEvent) => {
      if (event.detail.widgetId === widgetId && isRoomActive) {
        session.closeRoom('dataShare');
      }
    };
    
    window.addEventListener('widget-cleanup' as any, handleWidgetCleanup);
    
    return () => {
      window.removeEventListener('widget-cleanup' as any, handleWidgetCleanup);
    };
  }, [widgetId, isRoomActive, session]);

  const handleStart = async () => {
    try {
      // Create session if needed
      if (!session.sessionCode) {
        await session.createSession();
      }
      
      // Create data share room
      await session.createRoom('dataShare');
      setIsRoomActive(true);
    } catch (error) {
      console.error('Failed to start data share:', error);
    }
  };

  const handleDeleteSubmission = (submissionId: string) => {
    if (session.socket && isRoomActive) {
      session.socket.emit('session:dataShare:delete', {
        sessionCode: session.sessionCode,
        submissionId
      });
    }
  };

  // Empty state
  if (!isRoomActive || !session.sessionCode) {
    return (
      <NetworkedWidgetEmpty
        icon={FaLink}
        title="Link Sharing"
        description="Collect links and resources from students"
        buttonText={session.isConnecting ? "Connecting..." : "Start Sharing"}
        onStart={handleStart}
        disabled={session.isConnecting || !session.isConnected}
        error={session.connectionError}
      />
    );
  }

  return (
    <div className="bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 w-full h-full flex flex-col p-4 relative">
      <NetworkedWidgetHeader
        title="Link Sharing"
        code={session.sessionCode}
        participantCount={session.participantCount}
      />

      <div className="flex-1 overflow-y-auto mt-4">
        {submissions.length === 0 ? (
          <div className="text-center py-8 text-warm-gray-500 dark:text-warm-gray-400">
            Waiting for student submissions...
          </div>
        ) : (
          <div className="space-y-2">
            {submissions.map((submission) => (
              <div
                key={submission.id}
                className="flex items-center justify-between p-3 bg-warm-gray-50 dark:bg-warm-gray-700 rounded-lg group"
              >
                <div className="flex-1 min-w-0 mr-3">
                  <div className="text-sm font-medium text-warm-gray-800 dark:text-warm-gray-200">
                    {submission.studentName}
                  </div>
                  <a
                    href={submission.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-sage-600 dark:text-sage-400 hover:underline truncate block"
                  >
                    {submission.link}
                  </a>
                </div>
                <button
                  onClick={() => handleDeleteSubmission(submission.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-dusty-rose-500 hover:text-dusty-rose-600"
                  title="Delete submission"
                >
                  <FaTrash className="text-sm" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default DataShareSession;