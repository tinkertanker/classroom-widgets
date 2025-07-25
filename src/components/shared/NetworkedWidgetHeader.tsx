import React from 'react';
import { FaGear } from 'react-icons/fa6';
import { IconType } from 'react-icons';

interface NetworkedWidgetHeaderProps {
  title: string;
  code: string;
  participantCount: number;
  onSettings?: () => void;
  children?: React.ReactNode;
  icon?: IconType;
}

export const NetworkedWidgetHeader: React.FC<NetworkedWidgetHeaderProps> = ({ 
  title, 
  code, 
  participantCount, 
  onSettings,
  children,
  icon: Icon
}) => {
  // Get the server URL and format it for student access
  const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
  const studentUrl = serverUrl;

  return (
    <div className="mb-1">
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-4">
          {Icon && (
            <Icon className="text-2xl text-warm-gray-700 dark:text-warm-gray-300" title={title} />
          )}
          <div className="flex items-center gap-2 bg-warm-gray-100 dark:bg-warm-gray-700 px-3 py-1 rounded-full">
            <span className="text-sm font-mono font-bold text-warm-gray-700 dark:text-warm-gray-300">
              {code}
            </span>
            <span className="text-xs text-warm-gray-500 dark:text-warm-gray-400">
              • {participantCount} {participantCount === 1 ? 'student' : 'students'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onSettings && (
            <button
              onClick={onSettings}
              className="p-2 text-warm-gray-500 hover:text-warm-gray-700 dark:text-warm-gray-400 dark:hover:text-warm-gray-200 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 rounded transition-colors"
              title="Settings"
            >
              <FaGear className="text-base" />
            </button>
          )}
          {children}
        </div>
      </div>
    </div>
  );
};