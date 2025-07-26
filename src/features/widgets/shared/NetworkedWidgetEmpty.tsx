import React from 'react';
import { IconType } from 'react-icons';

interface NetworkedWidgetEmptyProps {
  title: string;
  description: string;
  icon: IconType;
  error?: string;
  disabled?: boolean;
  onStart: () => void;
  buttonText?: string;
}

export const NetworkedWidgetEmpty: React.FC<NetworkedWidgetEmptyProps> = ({
  title,
  description,
  icon: Icon,
  error,
  disabled,
  onStart,
  buttonText = 'Start'
}) => {
  return (
    <div className="bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 w-full h-full flex flex-col items-center justify-center p-6">
      <div className="text-center space-y-4">
        <div className="mb-4 flex justify-center">
          <Icon className="text-5xl text-warm-gray-400" />
        </div>
        <h2 className="text-lg font-medium text-warm-gray-700 dark:text-warm-gray-300">
          {title}
        </h2>
        <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
          {description}
        </p>
        <button
          onClick={onStart}
          disabled={disabled}
          className="px-4 py-2 bg-sage-500 hover:bg-sage-600 text-white rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {buttonText}
        </button>
        {error && (
          <div className="mt-4 p-3 bg-dusty-rose-100 dark:bg-dusty-rose-900 border border-dusty-rose-300 dark:border-dusty-rose-700 rounded-md max-w-sm">
            <p className="text-sm text-dusty-rose-700 dark:text-dusty-rose-300">
              {error}
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