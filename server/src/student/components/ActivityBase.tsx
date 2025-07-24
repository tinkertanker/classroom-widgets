import React, { ReactNode } from 'react';

interface ActivityBaseProps {
  title: string;
  description?: string;
  isActive: boolean;
  isConnected: boolean;
  error?: string | null;
  children: ReactNode;
  pausedMessage?: string;
  roomCode?: string;
}

/**
 * Base component for all activities providing common UI patterns
 */
export const ActivityBase: React.FC<ActivityBaseProps> = ({
  title,
  description,
  isActive,
  isConnected,
  error,
  children,
  pausedMessage = 'Waiting for teacher to start...',
  roomCode
}) => {
  // Show paused state
  if (!isActive) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[250px]">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-warm-gray-600 mb-2">
            {title} Paused
          </h2>
          <p className="text-warm-gray-500 text-sm">
            {pausedMessage}
          </p>
          {roomCode && (
            <div className="mt-4">
              <ConnectionIndicator isConnected={isConnected} roomCode={roomCode} />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="p-3">
        <div className="bg-dusty-rose-100 dark:bg-dusty-rose-900/30 text-dusty-rose-700 dark:text-dusty-rose-300 p-3 rounded-lg">
          <p className="font-medium text-sm">Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  // Active state with content
  return (
    <div className="p-3">
      {(title || description) && (
        <div className="text-center mb-4">
          {title && (
            <h2 className="text-xl font-semibold text-warm-gray-800 dark:text-warm-gray-100 mb-1">
              {title}
            </h2>
          )}
          {description && (
            <p className="text-warm-gray-600 dark:text-warm-gray-400 text-sm">
              {description}
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  );
};

// Connection status indicator component
export const ConnectionIndicator: React.FC<{ 
  isConnected: boolean; 
  roomCode?: string;
  isUpdating?: boolean;
}> = ({ isConnected, roomCode, isUpdating }) => {
  return (
    <span className="inline-flex items-center text-sm text-warm-gray-500 dark:text-warm-gray-400">
      <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
        isUpdating 
          ? 'bg-sage-500 animate-pulse' 
          : isConnected 
          ? 'bg-sage-500' 
          : 'bg-warm-gray-400 animate-pulse'
      }`} />
      {isUpdating ? 'Updating...' : isConnected ? 'Connected' : 'Connecting...'}
      {roomCode && ` to ${roomCode}`}
    </span>
  );
};

// Success message component
export const SuccessMessage: React.FC<{ 
  message: string; 
  show: boolean;
}> = ({ message, show }) => {
  if (!show) return null;
  
  return (
    <div className="mb-3 p-3 bg-sage-100 dark:bg-sage-900/30 rounded-lg animate-fadeIn">
      <p className="text-sage-700 dark:text-sage-300 text-sm">
        ✓ {message}
      </p>
    </div>
  );
};

// Status bar component
export const ActivityStatus: React.FC<{
  isActive: boolean;
  activeMessage: string;
  inactiveMessage: string;
  variant?: 'success' | 'warning' | 'neutral';
}> = ({ isActive, activeMessage, inactiveMessage, variant = 'neutral' }) => {
  const getColorClasses = () => {
    if (!isActive) return 'bg-warm-gray-200 dark:bg-warm-gray-800 text-warm-gray-600 dark:text-warm-gray-400';
    
    switch (variant) {
      case 'success':
        return 'bg-sage-100 dark:bg-sage-900/30 text-sage-700 dark:text-sage-300';
      case 'warning':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
      default:
        return 'bg-warm-gray-200 dark:bg-warm-gray-800 text-warm-gray-600 dark:text-warm-gray-400';
    }
  };

  return (
    <div className={`mb-3 p-3 rounded-lg ${getColorClasses()}`}>
      <p className="text-sm">{isActive ? activeMessage : inactiveMessage}</p>
    </div>
  );
};