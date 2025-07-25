import React, { useState, useEffect } from 'react';
import { FaWifi, FaUsers, FaCopy } from 'react-icons/fa6';
import { useSessionContext } from '../../contexts/SessionContext';

interface NetworkStatusProps {
  className?: string;
}

const NetworkStatus: React.FC<NetworkStatusProps> = ({ className = '' }) => {
  const session = useSessionContext();
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasBeenManuallyToggled, setHasBeenManuallyToggled] = useState(false);

  // Auto-expand when session starts, auto-collapse when session ends
  useEffect(() => {
    if (!hasBeenManuallyToggled) {
      if (session.sessionCode && session.isConnected) {
        setIsExpanded(true);
      } else {
        setIsExpanded(false);
      }
    }
  }, [session.sessionCode, session.isConnected, hasBeenManuallyToggled]);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
    setHasBeenManuallyToggled(true);
  };

  const copyToClipboard = () => {
    if (session.sessionCode) {
      navigator.clipboard.writeText(session.sessionCode);
      // Could add a toast notification here
    }
  };

  const copyStudentUrl = () => {
    const url = `${window.location.origin.replace('3000', '3001')}/student`;
    navigator.clipboard.writeText(url);
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Session info banner with smooth expand/collapse animation */}
      <div className={`overflow-hidden transition-all duration-500 ease-in-out ${
        isExpanded && session.sessionCode 
          ? 'max-w-[800px] opacity-100' 
          : 'max-w-0 opacity-0'
      }`}>
        <div className="bg-soft-white/95 dark:bg-warm-gray-800/95 backdrop-blur-sm rounded-lg shadow-lg border border-warm-gray-200 dark:border-warm-gray-700 px-6 py-3">
          <div className="flex items-center gap-6 whitespace-nowrap">
            {/* Combined Visit and Code section on same line */}
            <div className="flex items-center gap-6">
              {/* Visit section */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-warm-gray-600 dark:text-warm-gray-400">Visit:</span>
                <code className="text-lg font-semibold text-warm-gray-800 dark:text-warm-gray-200">
                  {window.location.origin.replace('3000', '3001')}/student
                </code>
                <button
                  onClick={copyStudentUrl}
                  className="p-1 text-warm-gray-500 hover:text-warm-gray-700 dark:text-warm-gray-400 dark:hover:text-warm-gray-200 transition-colors rounded hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700"
                  title="Copy student URL"
                >
                  <FaCopy className="text-sm" />
                </button>
              </div>

              {/* Divider */}
              <div className="h-6 w-px bg-warm-gray-300 dark:bg-warm-gray-600" />

              {/* Code section */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-warm-gray-600 dark:text-warm-gray-400">Code:</span>
                <code className="text-2xl font-bold text-warm-gray-800 dark:text-warm-gray-200 tracking-wider">
                  {session.sessionCode}
                </code>
                <button
                  onClick={copyToClipboard}
                  className="p-1 text-warm-gray-500 hover:text-warm-gray-700 dark:text-warm-gray-400 dark:hover:text-warm-gray-200 transition-colors rounded hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700"
                  title="Copy session code"
                >
                  <FaCopy className="text-sm" />
                </button>
              </div>
            </div>

            {/* Spacer to push students count to the right */}
            <div className="flex-1" />

            {/* Participants section - smaller and to the right */}
            <div className="flex items-center gap-2 text-warm-gray-500 dark:text-warm-gray-400">
              <FaUsers className="text-sm" />
              <span className="text-sm">{session.participantCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* WiFi button */}
      <button
        onClick={handleToggle}
        className={`relative p-3 rounded-lg transition-all duration-200 bg-warm-gray-200/60 dark:bg-warm-gray-700/60 backdrop-blur-sm ${
          session.isConnected 
            ? 'text-sage-600 dark:text-sage-400' 
            : 'text-warm-gray-400 dark:text-warm-gray-500'
        } hover:bg-warm-gray-300/60 dark:hover:bg-warm-gray-600/60`}
        title={
          session.isConnected 
            ? session.sessionCode 
              ? `Connected - Session: ${session.sessionCode} (Click to ${isExpanded ? 'collapse' : 'expand'})`
              : 'Server connected - No active session'
            : 'Server offline'
        }
      >
        <FaWifi className="text-xl" />
        {session.sessionCode && (
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-sage-500 rounded-full animate-pulse" />
        )}
      </button>
    </div>
  );
};

export default NetworkStatus;