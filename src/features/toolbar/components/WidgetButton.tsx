// WidgetButton - Individual widget button in the toolbar

import React from 'react';
import { clsx } from 'clsx';
import { WidgetConfig } from '../../../shared/types';

interface WidgetButtonProps {
  config: WidgetConfig;
  onClick: () => void;
  className?: string;
}

const WidgetButton: React.FC<WidgetButtonProps> = ({ config, onClick, className }) => {
  const Icon = config.icon;
  
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center space-x-2 px-3 py-1.5',
        'bg-white/80 dark:bg-warm-gray-700/80',
        'hover:bg-white dark:hover:bg-warm-gray-700',
        'border border-warm-gray-200 dark:border-warm-gray-600',
        'rounded-md shadow-sm',
        'transition-all duration-200',
        'hover:shadow-md hover:-translate-y-0.5',
        'text-warm-gray-700 dark:text-warm-gray-300',
        'text-sm font-medium',
        className
      )}
      title={`Add ${config.name}`}
    >
      <Icon className="text-base" />
      <span>{config.name}</span>
    </button>
  );
};

export default WidgetButton;