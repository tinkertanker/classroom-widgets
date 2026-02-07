import React from 'react';

interface NetworkedWidgetStatsProps {
  children: React.ReactNode;
  label?: string;
}

/**
 * Floating statistics container for networked widgets.
 * Positioned in the top-right corner with consistent styling.
 * Optional label shows widget name before the stats.
 */
export const NetworkedWidgetStats: React.FC<NetworkedWidgetStatsProps> = ({ children, label }) => {
  return (
    <div className="absolute top-3 right-3 z-20">
      <span className="text-sm text-warm-gray-500 dark:text-warm-gray-400">
        {label && <span className="font-medium">{label} · </span>}
        {children}
      </span>
    </div>
  );
};

export default NetworkedWidgetStats;
