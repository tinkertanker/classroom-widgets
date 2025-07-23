import React, { useState, useEffect, useCallback } from 'react';
import { NetworkedWidgetWrapper } from '../shared/NetworkedWidgetWrapper';
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

function DataShare({ widgetId, savedState, onStateChange }: DataShareProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  // Load saved state
  useEffect(() => {
    if (savedState) {
      setSubmissions(savedState.submissions || []);
    }
  }, [savedState]);

  const handleStateChange = useCallback((state: any) => {
    onStateChange?.({
      ...state,
      submissions
    });
  }, [onStateChange, submissions]);

  return (
    <NetworkedWidgetWrapper
      widgetId={widgetId}
      savedState={savedState}
      onStateChange={handleStateChange}
      roomType="dataShare"
      title="Link Sharing"
      description="Collect links and resources from students"
      icon={FaLink}
      onRoomClosed={() => {
        setSubmissions([]);
      }}
    >
      {({ session, isRoomActive }) => {
        // Join the widget-specific room
        useEffect(() => {
          if (!session.socket || !session.sessionCode || !isRoomActive) return;
          
          // Join the room for this specific widget instance
          session.socket.emit('session:joinRoom', { 
            sessionCode: session.sessionCode,
            roomType: 'dataShare',
            widgetId 
          });
          
          return () => {
            session.socket?.emit('session:leaveRoom', { 
              sessionCode: session.sessionCode,
              roomType: 'dataShare',
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

          session.socket.on('dataShare:newSubmission', handleNewSubmission);
          session.socket.on('dataShare:submissionDeleted', handleSubmissionDeleted);

          return () => {
            session.socket?.off('dataShare:newSubmission', handleNewSubmission);
            session.socket?.off('dataShare:submissionDeleted', handleSubmissionDeleted);
          };
        }, [session.socket]);

        const handleDeleteSubmission = (submissionId: string) => {
          if (session.socket && isRoomActive) {
            session.socket.emit('session:dataShare:delete', {
              sessionCode: session.sessionCode,
              widgetId,
              submissionId
            });
          }
        };

        return (
          <>
            {/* Submissions list */}
            <div className="flex-1 overflow-y-auto mt-4">
              {submissions.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-warm-gray-500 dark:text-warm-gray-400">
                    <FaLink className="text-4xl mx-auto mb-2" />
                    <p className="text-sm">Waiting for student submissions...</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {submissions.map((submission) => {
                    // Skip submissions with no link
                    if (!submission.link) return null;
                    
                    return (
                      <div
                        key={submission.id}
                        className="group p-3 bg-white dark:bg-warm-gray-700 rounded-lg border border-warm-gray-200 dark:border-warm-gray-600 hover:border-warm-gray-300 dark:hover:border-warm-gray-500 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <a
                              href={submission.link.startsWith('http') ? submission.link : `https://${submission.link}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-sage-600 dark:text-sage-400 hover:text-sage-700 dark:hover:text-sage-300 break-all"
                            >
                              {submission.link}
                            </a>
                          <p className="text-xs text-warm-gray-500 dark:text-warm-gray-400 mt-1">
                            Submitted {new Date(submission.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteSubmission(submission.id)}
                          className="p-1.5 text-warm-gray-400 hover:text-dusty-rose-600 dark:hover:text-dusty-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete submission"
                        >
                          <FaTrash className="text-xs" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                </div>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-warm-gray-200 dark:border-warm-gray-700 text-center">
              <p className="text-xs text-warm-gray-500 dark:text-warm-gray-400">
                {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
              </p>
            </div>
          </>
        );
      }}
    </NetworkedWidgetWrapper>
  );
}

export default DataShare;