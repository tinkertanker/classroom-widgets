import React, { useState, useEffect } from 'react';
import { useNetworkedWidget } from '../../hooks/useNetworkedWidget';
import { NetworkedWidgetHeader } from '../shared/NetworkedWidgetHeader';
import { NetworkedWidgetEmpty } from '../shared/NetworkedWidgetEmpty';
import { FaPaperclip } from 'react-icons/fa6';

interface DataShareProps {
  widgetId?: string;
  savedState?: {
    roomCode?: string;
    submissions?: Submission[];
  };
  onStateChange?: (state: any) => void;
}

interface Submission {
  id: string;
  studentName: string;
  link: string;
  timestamp: number;
}

const DataShare: React.FC<DataShareProps> = ({ widgetId, savedState, onStateChange }) => {
  const [submissions, setSubmissions] = useState<Submission[]>(savedState?.submissions || []);
  const [selectedSubmission, setSelectedSubmission] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const {
    socket,
    roomCode,
    isConnecting,
    connectionError,
    createRoom
  } = useNetworkedWidget({
    widgetId,
    roomType: 'dataShare',
    onSocketConnected: (newSocket) => {
      // Set up dataShare-specific socket listeners
      newSocket.on('dataShare:newSubmission', (submission: Submission) => {
        console.log('New submission received:', submission);
        setSubmissions(prev => [...prev, submission]);
      });

      newSocket.on('dataShare:submissionDeleted', (submissionId: string) => {
        setSubmissions(prev => prev.filter(s => s.id !== submissionId));
      });
    }
  });

  // Update parent state
  useEffect(() => {
    if (onStateChange) {
      onStateChange({ roomCode, submissions });
    }
  }, [roomCode, submissions, onStateChange]);




  const deleteSubmission = (submissionId: string) => {
    if (socket && roomCode) {
      socket.emit('host:deleteSubmission', { roomCode, submissionId });
    }
  };

  const clearAllSubmissions = () => {
    if (socket && roomCode) {
      socket.emit('host:clearAllSubmissions', roomCode);
      setSubmissions([]);
      setSelectedSubmission(null);
    }
  };

  const copyToClipboard = (text: string, submissionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(submissionId);
    setTimeout(() => setCopiedId(null), 2000);
  };
  

  return (
    <div className="bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 w-full h-full flex flex-col p-4 relative">
      {!roomCode ? (
        <NetworkedWidgetEmpty
          title="Data Share"
          description="Students can share links with you"
          icon={<FaPaperclip className="text-5xl text-warm-gray-400 dark:text-warm-gray-500" />}
          connectionError={connectionError}
          isConnecting={isConnecting}
          onCreateRoom={createRoom}
          createButtonText="Create Share Room"
        />
      ) : (
        // Active room state
        <div className="flex flex-col h-full">
          <NetworkedWidgetHeader roomCode={roomCode}>
            {submissions.length > 0 && (
                <button
                  onClick={(_e) => {
                    clearAllSubmissions();
                  }}
                  className="px-3 py-1.5 bg-dusty-rose-500 hover:bg-dusty-rose-600 text-white text-sm rounded transition-colors duration-200"
                >
                  Clear All
                </button>
            )}
          </NetworkedWidgetHeader>

          {/* Content Section */}
          <div className="flex-1 overflow-y-auto border border-warm-gray-200 dark:border-warm-gray-700 rounded-lg">
            {submissions.length === 0 ? (
              <div className="flex items-center justify-center h-full text-warm-gray-500 dark:text-warm-gray-400 text-sm">
                Waiting for submissions...
              </div>
            ) : (
              <div className="divide-y divide-warm-gray-200 dark:divide-warm-gray-700">
                {submissions.map((submission) => (
                  <div
                    key={submission.id}
                    className={`p-3 hover:bg-warm-gray-50 dark:hover:bg-warm-gray-700/50 cursor-pointer transition-colors ${
                      selectedSubmission === submission.id ? 'bg-sage-50 dark:bg-sage-900/20' : ''
                    }`}
                    onClick={() => {
                      setSelectedSubmission(submission.id === selectedSubmission ? null : submission.id);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-warm-gray-800 dark:text-warm-gray-200">
                          {submission.studentName}
                        </p>
                        <p className="text-sm text-sage-600 dark:text-sage-400 truncate">
                          {submission.link}
                        </p>
                        <p className="text-xs text-warm-gray-500 dark:text-warm-gray-500 mt-1">
                          {new Date(submission.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(submission.link, '_blank');
                          }}
                          className="p-1.5 text-sage-600 hover:text-sage-700 dark:text-sage-400 dark:hover:text-sage-300"
                          title="Open link"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(submission.link, submission.id);
                          }}
                          className={`p-1.5 transition-colors ${
                            copiedId === submission.id 
                              ? 'text-sage-600 dark:text-sage-400' 
                              : 'text-warm-gray-600 hover:text-warm-gray-700 dark:text-warm-gray-400 dark:hover:text-warm-gray-300'
                          }`}
                          title={copiedId === submission.id ? "Copied!" : "Copy link"}
                        >
                          {copiedId === submission.id ? (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSubmission(submission.id);
                          }}
                          className="p-1.5 text-dusty-rose-500 hover:text-dusty-rose-600 dark:text-dusty-rose-400 dark:hover:text-dusty-rose-300"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Footer Section */}
          <div className="mt-4 pt-3 border-t border-warm-gray-200 dark:border-warm-gray-700 flex justify-between items-center text-xs text-warm-gray-500 dark:text-warm-gray-400">
            <span>{submissions.length} submission{submissions.length !== 1 ? 's' : ''}</span>
            <div className="flex items-center gap-2">
              <span>Data Share Active</span>
              <FaPaperclip className="text-sm" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataShare;