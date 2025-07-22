import React from 'react';
import { FaUsers, FaCopy, FaCircle } from 'react-icons/fa6';

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
  const copyToClipboard = () => {
    navigator.clipboard.writeText(sessionCode);
    // Could add a toast notification here
  };

  if (!sessionCode) return null;

  return (
    <div className={`bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 p-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <FaCircle className={`text-xs ${isConnected ? 'text-sage-500' : 'text-warm-gray-400'}`} />
            <span className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
              Session
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <code className="text-lg font-bold text-warm-gray-800 dark:text-warm-gray-200 tracking-wider">
              {sessionCode}
            </code>
            <button
              onClick={copyToClipboard}
              className="p-1 text-warm-gray-500 hover:text-warm-gray-700 dark:text-warm-gray-400 dark:hover:text-warm-gray-200 transition-colors"
              title="Copy code"
            >
              <FaCopy className="text-sm" />
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-warm-gray-600 dark:text-warm-gray-400">
          <FaUsers className="text-sm" />
          <span className="text-sm">{participantCount}</span>
        </div>
      </div>
    </div>
  );
};

export default SessionStatus;