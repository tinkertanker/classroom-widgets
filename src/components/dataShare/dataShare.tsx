import React, { useState, useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';

interface DataShareProps {
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

const DataShare: React.FC<DataShareProps> = ({ savedState, onStateChange }) => {
  const [roomCode, setRoomCode] = useState<string>(savedState?.roomCode || '');
  const [submissions, setSubmissions] = useState<Submission[]>(savedState?.submissions || []);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionError, setConnectionError] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Update parent state
  useEffect(() => {
    if (onStateChange) {
      onStateChange({ roomCode, submissions });
    }
  }, [roomCode, submissions, onStateChange]);


  const createRoom = async () => {
    setIsConnecting(true);
    setConnectionError('');
    
    try {
      const newSocket = io('http://localhost:3001', {
        transports: ['websocket', 'polling']
      });

      newSocket.on('connect', () => {
        console.log('Connected to server');
        newSocket.emit('host:createDataShareRoom');
      });

      newSocket.on('room:created', (code: string) => {
        console.log('Data share room created:', code);
        setRoomCode(code);
        setConnectionError('');
      });

      newSocket.on('dataShare:newSubmission', (submission: Submission) => {
        console.log('New submission received:', submission);
        setSubmissions(prev => [...prev, submission]);
      });

      newSocket.on('dataShare:submissionDeleted', (submissionId: string) => {
        setSubmissions(prev => prev.filter(s => s.id !== submissionId));
      });

      newSocket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        setConnectionError('Unable to connect to server. Make sure the server is running on port 3001.');
        setIsConnecting(false);
      });

      newSocket.on('disconnect', () => {
        console.log('Disconnected from server');
      });

      setSocket(newSocket);
    } catch (error) {
      console.error('Error creating socket:', error);
      setConnectionError('Failed to connect to server');
    } finally {
      setIsConnecting(false);
    }
  };


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
    <div className="bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 w-full h-full flex flex-col p-4">
      {!roomCode ? (
        // No room state
        <div className="flex flex-col h-full justify-center items-center">
          <div className="text-center space-y-4">
            <div className="text-6xl mb-4">📎</div>
            <h2 className="text-lg font-medium text-warm-gray-700 dark:text-warm-gray-300">
              Data Share
            </h2>
            <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
              Students can share links with you
            </p>
            {connectionError && (
              <p className="text-dusty-rose-500 dark:text-dusty-rose-400 text-xs">
                {connectionError}
              </p>
            )}
            <button
              onClick={createRoom}
              disabled={isConnecting}
              className="px-4 py-2 bg-sage-500 hover:bg-sage-600 text-white text-sm rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnecting ? 'Connecting...' : 'Create Share Room'}
            </button>
          </div>
        </div>
      ) : (
        // Active room state
        <div className="flex flex-col h-full">
          <div className="mb-4">
            <div className="text-center">
              <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400 mb-1">
                Students can share links at:
              </p>
              <div className="bg-warm-gray-100 dark:bg-warm-gray-700 rounded-lg px-4 py-3 mb-2">
                <p className="text-lg font-mono text-warm-gray-800 dark:text-warm-gray-200">
                  localhost:3001/share
                </p>
              </div>
              <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400 mb-2">
                Room Code:
              </p>
              <p className="text-3xl font-bold text-warm-gray-800 dark:text-warm-gray-200 mb-2">
                {roomCode}
              </p>
              <p className="text-xs text-warm-gray-500 dark:text-warm-gray-500">
                {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Submissions list */}
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
                    onClick={() => setSelectedSubmission(submission.id === selectedSubmission ? null : submission.id)}
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

          {/* Actions */}
          {submissions.length > 0 && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={clearAllSubmissions}
                className="px-3 py-1.5 bg-dusty-rose-500 hover:bg-dusty-rose-600 text-white text-sm rounded transition-colors duration-200"
              >
                Clear All
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DataShare;