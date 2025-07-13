import React from 'react';

interface NetworkedWidgetEmptyProps {
  title: string;
  description: string;
  icon: React.ReactElement | string;
  connectionError: string;
  isConnecting: boolean;
  onCreateRoom: () => void;
  createButtonText?: string;
}

export const NetworkedWidgetEmpty: React.FC<NetworkedWidgetEmptyProps> = ({
  title,
  description,
  icon,
  connectionError,
  isConnecting,
  onCreateRoom,
  createButtonText = 'Create Room'
}) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center">
      <div className="text-center space-y-4">
        <div className="mb-4">
          {typeof icon === 'string' ? (
            <div className="text-6xl">{icon}</div>
          ) : (
            icon
          )}
        </div>
        <h2 className="text-lg font-medium text-warm-gray-700 dark:text-warm-gray-300">
          {title}
        </h2>
        <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
          {description}
        </p>
        <button
          onClick={onCreateRoom}
          disabled={isConnecting}
          className="px-4 py-2 bg-sage-500 hover:bg-sage-600 text-white rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isConnecting ? 'Connecting...' : createButtonText}
        </button>
        {connectionError && (
          <div className="mt-4 p-3 bg-dusty-rose-100 dark:bg-dusty-rose-900 border border-dusty-rose-300 dark:border-dusty-rose-700 rounded-md max-w-sm">
            <p className="text-sm text-dusty-rose-700 dark:text-dusty-rose-300">
              {connectionError}
            </p>
            <p className="text-xs text-dusty-rose-600 dark:text-dusty-rose-400 mt-2">
              Start the server with: <code className="bg-dusty-rose-200 dark:bg-dusty-rose-800 px-1 rounded">cd server && npm start</code>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};