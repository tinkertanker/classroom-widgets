import React from 'react';
import { FaUsers, FaCopy, FaCircle } from 'react-icons/fa6';
import { useServerConnection } from '../../../../shared/hooks/useWorkspace';

interface SessionStatusProps {
  sessionCode: string;
  participantCount: number;
  isConnected: boolean;
  className?: string;
}

const SessionStatus: React.FC<SessionStatusProps> = ({
  sessionCode,
  participantCount,
  isConnected,
  className = ''
}) => {
  const { url: serverUrl } = useServerConnection();
  const studentUrl = `${serverUrl}/student`;
  const displayUrl = studentUrl.replace(/^https?:\/\//, '');
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast notification here
  };

  if (!sessionCode) return null;

  return (
    <div className={`bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-lg border border-warm-gray-200 dark:border-warm-gray-700 px-4 py-2 ${className}`}>
      {/* Everything on single line */}
      <div className="flex items-center gap-4">
        {/* Session indicator */}
        <div className="flex items-center gap-1">
          <FaCircle className={`text-xs ${isConnected ? 'text-sage-500' : 'text-warm-gray-400'}`} />
          <span className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
            Session
          </span>
        </div>
        
        {/* Session code */}
        <div className="flex items-center gap-2">
          <code className="text-2xl font-bold text-warm-gray-800 dark:text-warm-gray-200 tracking-wider">
            {sessionCode}
          </code>
          <button
            onClick={() => copyToClipboard(sessionCode)}
            className="p-1 text-warm-gray-500 hover:text-warm-gray-700 dark:text-warm-gray-400 dark:hover:text-warm-gray-200 transition-colors"
            title="Copy code"
          >
            <FaCopy className="text-sm" />
          </button>
        </div>
        
        {/* URL */}
        <div className="flex items-center gap-2 flex-1">
          <span className="text-sm text-warm-gray-600 dark:text-warm-gray-400 whitespace-nowrap">
            Visit:
          </span>
          <code className="text-lg font-semibold text-warm-gray-800 dark:text-warm-gray-200 font-mono">
            {displayUrl}
          </code>
          <button
            onClick={() => copyToClipboard(studentUrl)}
            className="p-1 text-warm-gray-500 hover:text-warm-gray-700 dark:text-warm-gray-400 dark:hover:text-warm-gray-200 transition-colors"
            title="Copy URL"
          >
            <FaCopy className="text-sm" />
          </button>
        </div>
        
        {/* Participants */}
        <div className="flex items-center gap-2 text-warm-gray-600 dark:text-warm-gray-400">
          <FaUsers className="text-sm" />
          <span className="text-sm">{participantCount}</span>
        </div>
      </div>
    </div>
  );
};

export default SessionStatus;