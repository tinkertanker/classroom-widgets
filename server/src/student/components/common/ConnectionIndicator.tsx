import React from 'react';
import { ConnectionIndicatorProps } from '../../types/ui.types';

const ConnectionIndicator: React.FC<ConnectionIndicatorProps> = ({
  isConnected,
  size = 'md',
  showLabel = true
}) => {
  const sizeStyles = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3'
  };
  
  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };
  
  return (
    <div className="flex items-center gap-2">
      <span 
        className={`
          inline-block rounded-full
          ${sizeStyles[size]}
          ${isConnected ? 'bg-sage-500' : 'bg-warm-gray-400'}
          ${isConnected ? 'animate-pulse' : ''}
        `}
        role="status"
        aria-label={isConnected ? 'Connected' : 'Disconnected'}
      />
      {showLabel && (
        <span className={`${textSizes[size]} text-warm-gray-600 dark:text-warm-gray-400`}>
          {isConnected ? 'Connected' : 'Connecting...'}
        </span>
      )}
    </div>
  );
};

export default ConnectionIndicator;