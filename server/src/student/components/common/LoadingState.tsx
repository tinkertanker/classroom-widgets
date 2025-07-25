import React from 'react';
import { LoadingStateProps } from '../../types/ui.types';

const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  fullScreen = false
}) => {
  const containerStyles = fullScreen
    ? 'fixed inset-0 flex items-center justify-center bg-[#f7f5f2] dark:bg-warm-gray-900 z-50'
    : 'flex items-center justify-center p-8';
  
  return (
    <div className={containerStyles}>
      <div className="text-center">
        <div className="inline-flex items-center justify-center mb-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sage-500"></div>
        </div>
        <p className="text-warm-gray-600 dark:text-warm-gray-400">{message}</p>
      </div>
    </div>
  );
};

export default LoadingState;