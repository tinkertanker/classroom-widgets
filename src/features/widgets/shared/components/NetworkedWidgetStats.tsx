import React from 'react';

interface NetworkedWidgetStatsProps {
  children: React.ReactNode;
}

/**
 * Floating statistics container for networked widgets.
 * Positioned in the top-right corner with consistent styling.
 */
export const NetworkedWidgetStats: React.FC<NetworkedWidgetStatsProps> = ({ children }) => {
  return (
    <div className="absolute top-3 right-3 z-20">
      <span className="text-sm text-warm-gray-500 dark:text-warm-gray-400">
        {children}
      </span>
    </div>
  );
};

export default NetworkedWidgetStats;
