import React from 'react';

interface NetworkedWidgetHeaderProps {
  roomCode: string;
  children?: React.ReactNode;
}

export const NetworkedWidgetHeader: React.FC<NetworkedWidgetHeaderProps> = ({ roomCode, children }) => {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400">Activity Code</p>
          <p className="text-2xl font-bold text-warm-gray-800 dark:text-warm-gray-200">
            {roomCode}
          </p>
        </div>
        {children}
      </div>
      <div className="bg-warm-gray-100 dark:bg-warm-gray-700 rounded-lg px-4 py-2 text-center">
        <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400">
          Students visit: <span className="font-mono font-medium text-warm-gray-800 dark:text-warm-gray-200">localhost/student</span>
        </p>
      </div>
    </div>
  );
};