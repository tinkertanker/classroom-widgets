import React, { useState, useEffect, useCallback } from 'react';
import { NetworkedWidgetWrapper } from '../shared/NetworkedWidgetWrapper';
import { FaLink, FaTrash, FaPlay, FaPause, FaArrowUpRightFromSquare } from 'react-icons/fa6';

interface LinkShareProps {
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

function LinkShare({ widgetId, savedState, onStateChange }: LinkShareProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isActive, setIsActive] = useState(true);

  // Load saved state
  useEffect(() => {
    if (savedState) {
      setSubmissions(savedState.submissions || []);
      setIsActive(savedState.isActive !== undefined ? savedState.isActive : true);
    }
  }, [savedState]);

  const handleStateChange = useCallback((state: any) => {
    onStateChange?.({
      ...state,
      submissions,
      isActive
    });
  }, [onStateChange, submissions, isActive]);

  return (
    <NetworkedWidgetWrapper
      widgetId={widgetId}
      savedState={savedState}
      onStateChange={handleStateChange}
      roomType="linkShare"
      title="Link Sharing"
      description="Collect links and resources from students"
      icon={FaLink}
      onRoomClosed={() => {
        setSubmissions([]);
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
          title={isActive ? "Pause accepting links" : "Resume accepting links"}
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
            roomType: 'linkShare',
            widgetId 
          });
          
          return () => {
            session.socket?.emit('session:leaveRoom', { 
              sessionCode: session.sessionCode,
              roomType: 'linkShare',
              widgetId 
            });
          };
        }, [session.socket, session.sessionCode, isRoomActive, widgetId]);

        // Setup socket listeners
        useEffect(() => {
          if (!session.socket) return;

          const handleNewSubmission = (data: Submission) => {
            setSubmissions(prev => [...prev, data]);
          };

          const handleSubmissionDeleted = (data: { submissionId: string }) => {
            setSubmissions(prev => prev.filter(s => s.id !== data.submissionId));
          };

          session.socket.on('linkShare:newSubmission', handleNewSubmission);
          session.socket.on('linkShare:submissionDeleted', handleSubmissionDeleted);

          return () => {
            session.socket?.off('linkShare:newSubmission', handleNewSubmission);
            session.socket?.off('linkShare:submissionDeleted', handleSubmissionDeleted);
          };
        }, [session.socket]);

        // Handle active state changes
        useEffect(() => {
          if (!session.socket || !session.sessionCode || !isRoomActive) return;
          
          const eventName = isActive ? 'session:linkShare:start' : 'session:linkShare:stop';
          session.socket.emit(eventName, {
            sessionCode: session.sessionCode,
            widgetId
          });
        }, [isActive, session.socket, session.sessionCode, isRoomActive, widgetId]);

        const handleDeleteSubmission = (submissionId: string) => {
          if (session.socket && isRoomActive) {
            session.socket.emit('session:linkShare:delete', {
              sessionCode: session.sessionCode,
              widgetId,
              submissionId
            });
          }
        };

        return (
          <>
            {/* Submissions count */}
            <div className="flex justify-between items-center mb-1">
              <div className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
                {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
              </div>
              {submissions.length > 0 && (
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to clear all submissions?')) {
                      setSubmissions([]);
                    }
                  }}
                  className="text-xs text-warm-gray-500 hover:text-dusty-rose-600 dark:text-warm-gray-400 dark:hover:text-dusty-rose-400 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Submissions list */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {submissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-warm-gray-400 dark:text-warm-gray-600">
                  <FaLink className="text-4xl mb-2" />
                  <p className="text-sm">Waiting for student submissions...</p>
                </div>
              ) : (
                submissions.map((submission) => {
                    // Skip submissions with no link
                    if (!submission.link) return null;
                    
                    return (
                      <div
                        key={submission.id}
                        className="group p-3 bg-white dark:bg-warm-gray-700 rounded-lg border border-warm-gray-200 dark:border-warm-gray-600 hover:border-warm-gray-300 dark:hover:border-warm-gray-500 transition-colors"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-warm-gray-700 dark:text-warm-gray-200 break-all">
                              {submission.link}
                            </p>
                            <div className="mt-1 text-xs text-warm-gray-500 dark:text-warm-gray-400">
                              {submission.studentName} • {new Date(submission.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => window.open(submission.link.startsWith('http') ? submission.link : `https://${submission.link}`, '_blank')}
                              className="p-1.5 text-sage-600 hover:bg-sage-100 dark:text-sage-400 dark:hover:bg-sage-900/30 rounded transition-colors"
                              title="Open link in new tab"
                            >
                              <FaArrowUpRightFromSquare className="text-xs" />
                            </button>
                            <button
                              onClick={() => handleDeleteSubmission(submission.id)}
                              className="p-1.5 text-dusty-rose-600 hover:bg-dusty-rose-100 dark:text-dusty-rose-400 dark:hover:bg-dusty-rose-900/30 rounded transition-colors"
                              title="Delete submission"
                            >
                              <FaTrash className="text-xs" />
                            </button>
                          </div>
                        </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        );
      }}
    </NetworkedWidgetWrapper>
  );
}

export default LinkShare;