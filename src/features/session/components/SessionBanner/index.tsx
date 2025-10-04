// SessionBanner - Dynamic island-style session display with expand/collapse animation
// Extracted from TopControls for reusability

import React, { useState, useRef, useEffect } from 'react';
import { FaWifi, FaXmark } from 'react-icons/fa6';
import { clsx } from 'clsx';
import { useSession } from '../../../../contexts/SessionContext';

interface SessionBannerProps {
  className?: string;
}

const SessionBanner: React.FC<SessionBannerProps> = ({ 
  className = ''
}) => {
  const session = useSession();
  const { sessionCode, isConnected: connected, closeSession: onClose, serverUrl } = session;
  const [isExpanded, setIsExpanded] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const sessionIslandRef = useRef<HTMLDivElement>(null);
  
  // Auto-expand when session starts or when disconnected
  useEffect(() => {
    if (sessionCode && !isExpanded) {
      setIsExpanded(true);
    } else if (!sessionCode) {
      setIsExpanded(false);
    }
  }, [sessionCode]);
  
  // Auto-expand when disconnected to show status
  useEffect(() => {
    if (!connected && sessionCode) {
      setIsExpanded(true);
    }
  }, [connected, sessionCode]);
  
  // Handle reconnection attempt
  const handleReconnect = React.useCallback(() => {
    if (!connected && sessionCode) {
      if (session.socket && !session.socket.connected) {
        setIsReconnecting(true);
        session.socket.connect();
        
        // Reset reconnecting state after a timeout
        setTimeout(() => {
          setIsReconnecting(false);
        }, 3000);
      }
    }
  }, [connected, sessionCode, session.socket]);
  
  // Reset reconnecting state when connection status changes
  useEffect(() => {
    if (connected) {
      setIsReconnecting(false);
    }
  }, [connected]);
  
  const handleCloseSession = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to close this session? All students will be disconnected.')) {
      if (session.socket && sessionCode) {
        session.socket.emit('session:close', { sessionCode });
      }
      onClose();
    }
  };
  
  if (!sessionCode) return null;
  
  return (
    <div 
      ref={sessionIslandRef}
      onClick={() => {
        // If disconnected, attempt reconnection on click
        if (!connected) {
          handleReconnect();
        } else {
          setIsExpanded(!isExpanded);
        }
      }}
      className={clsx(
        "bg-soft-white/90 dark:bg-warm-gray-800/90 backdrop-blur-xl rounded-full shadow-sm",
        "border border-warm-gray-200/50 dark:border-warm-gray-600/50",
        "transition-all duration-500 ease-out cursor-pointer",
        !connected ? "animate-pulse" : "hover:scale-105",
        isExpanded ? "px-8 py-4" : "px-4 py-2",
        className
      )}
      title={!connected ? "Click to reconnect" : connected ? "Connected to server" : "Disconnected from server"}
    >
      <div className="flex items-center">
        {/* WiFi Icon - Always visible */}
        <div className={clsx(
          'transition-colors duration-200',
          connected ? 'text-sage-600 dark:text-sage-400' : 'text-warm-gray-400 dark:text-warm-gray-500'
        )}>
          <FaWifi className="text-base" />
        </div>
        
        {/* Session Info - Expandable */}
        <div className={clsx(
          "flex items-center gap-3 transition-all duration-500",
          isExpanded ? "max-w-[500px] opacity-100 ml-3" : "max-w-0 opacity-0 overflow-hidden"
        )}>
          {/* Connection status indicator */}
          {connected ? (
            <div className="w-2 h-2 bg-sage-500 dark:bg-sage-400 rounded-full animate-pulse" />
          ) : isReconnecting ? (
            <div className="text-xs text-amber-600 dark:text-amber-400 whitespace-nowrap animate-pulse">
              Reconnecting...
            </div>
          ) : (
            <div className="text-xs text-warm-gray-600 dark:text-warm-gray-400 whitespace-nowrap">
              Disconnected - Click to retry
            </div>
          )}
          
          {/* Session Code */}
          <code className="text-3xl font-bold text-warm-gray-800 dark:text-warm-gray-200 tracking-wider">
            {sessionCode}
          </code>

          {/* Separator */}
          <div className="w-px h-6 bg-warm-gray-300 dark:bg-warm-gray-600" />

          {/* URL */}
          <span className="text-lg font-medium text-warm-gray-600 dark:text-warm-gray-300 truncate">
            {serverUrl?.replace(/^https?:\/\//, '')}/student
          </span>
          
          {/* Close Session Button */}
          {connected && (
            <>
              <div className="w-px h-4 bg-warm-gray-300 dark:bg-warm-gray-600" />
              <button
                onClick={handleCloseSession}
                className="text-dusty-rose-600 dark:text-dusty-rose-400 hover:text-dusty-rose-700 dark:hover:text-dusty-rose-300 transition-colors p-1 rounded hover:bg-dusty-rose-100 dark:hover:bg-dusty-rose-900/20"
                title="Close session"
              >
                <FaXmark className="text-sm" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SessionBanner;