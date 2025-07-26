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
        'px-3 py-2 rounded-lg text-warm-gray-700',
        'bg-soft-white/80 dark:bg-warm-gray-800/80',
        'dark:text-warm-gray-300',
        'hover:bg-warm-gray-100/80 dark:hover:bg-warm-gray-700/80',
        'transition-all duration-200 group relative',
        'flex flex-col items-center gap-1 min-w-[80px]',
        className
      )}
      title={`Add ${config.name}`}
    >
      <div className="text-lg">
        <Icon />
      </div>
      <span className="text-xs text-center leading-tight">{config.name}</span>
    </button>
  );
};

export default WidgetButton;