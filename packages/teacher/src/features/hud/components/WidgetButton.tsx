// WidgetButton - Individual widget button in the toolbar

import React from 'react';
import { clsx } from 'clsx';
import { WidgetConfig } from '@shared/types';

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
        'px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-warm-gray-700',
        'bg-white/50 dark:bg-warm-gray-700/50',
        'dark:text-warm-gray-300',
        'hover:bg-white/70 dark:hover:bg-warm-gray-600/70',
        'transition-all duration-200 group relative',
        'flex flex-col items-center gap-1 min-w-[64px] sm:min-w-[80px]',
        className
      )}
      title={`Add ${config.name}`}
    >
      <div className="text-base sm:text-lg">
        <Icon />
      </div>
      <span className="text-[10px] sm:text-xs text-center leading-tight">{config.name}</span>
    </button>
  );
};

export default WidgetButton;
