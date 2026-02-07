import React from 'react';
import { FaDice, FaRotate, FaGear } from 'react-icons/fa6';
import { WidgetControlBar } from './WidgetControlBar';
import { cn, buttons } from '@shared/utils/styles';

interface RandomiserControlBarProps {
  buttonSettings: 'normal' | 'result';
  isSpinning: boolean;
  isLoading: boolean;
  result: string;
  removedChoices: string[];
  onRandomise: () => void;
  onRemoveResult: () => void;
  onSettings: () => void;
  className?: string;
}

/**
 * Specialized control bar for the Randomiser widget with its dual-mode functionality.
 * Handles both the normal randomise state and the result display state.
 */
export const RandomiserControlBar: React.FC<RandomiserControlBarProps> = ({
  buttonSettings,
  isSpinning,
  isLoading,
  result,
  removedChoices,
  onRandomise,
  onRemoveResult,
  onSettings,
  className
}) => {
  if (buttonSettings === 'normal') {
    return (
      <WidgetControlBar className={className}>
        <button
          className={cn(buttons.primary, "px-3 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5")}
          onClick={onRandomise}
          disabled={isLoading}
        >
          <FaDice className="text-xs" />
          Randomise!!
        </button>

        <button
          className="p-2 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 rounded transition-colors duration-200"
          onClick={onSettings}
          title="Settings"
        >
          <FaGear className="text-warm-gray-600 dark:text-warm-gray-400 hover:text-warm-gray-700 dark:hover:text-warm-gray-300 text-sm" />
        </button>
      </WidgetControlBar>
    );
  }

  if (buttonSettings === 'result') {
    return (
      <WidgetControlBar className={className}>
        <div className="flex items-center gap-2">
          <button
            className={cn(buttons.danger, "px-3 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed")}
            onClick={onRemoveResult}
            disabled={removedChoices.includes(result)}
          >
            {removedChoices.includes(result) ? "Already removed" : "Remove option"}
          </button>

          <button
            disabled={isLoading}
            className={cn(buttons.primary, "px-3 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5")}
            onClick={onRandomise}
          >
            <FaRotate className="text-xs" />
            Again!
          </button>
        </div>

        <button
          className="p-2 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 rounded transition-colors duration-200"
          onClick={onSettings}
          title="Settings"
        >
          <FaGear className="text-warm-gray-600 dark:text-warm-gray-400 hover:text-warm-gray-700 dark:hover:text-warm-gray-300 text-sm" />
        </button>
      </WidgetControlBar>
    );
  }

  return null;
};

export default RandomiserControlBar;