import React from 'react';
import { FaPlay, FaPause } from 'react-icons/fa6';
import { cn, buttons } from '@shared/utils/styles';

interface PlayPauseButtonProps {
  isActive: boolean;
  onToggle: () => void;
  disabled?: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showText?: boolean;
}

/**
 * Reusable play/pause toggle button for widgets that need start/stop functionality.
 * Handles the common pattern of toggling between active and inactive states.
 */
export const PlayPauseButton: React.FC<PlayPauseButtonProps> = ({
  isActive,
  onToggle,
  disabled = false,
  activeLabel = "Pause",
  inactiveLabel = "Start",
  className,
  size = 'sm',
  showIcon = true,
  showText = true
}) => {
  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-5 py-2.5 text-lg"
  };

  const iconSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base"
  };

  const handleClick = () => {
    if (!disabled) {
      onToggle();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        isActive ? buttons.danger : buttons.primary,
        sizeClasses[size],
        "disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5",
        className
      )}
      title={isActive ? activeLabel : inactiveLabel}
    >
      {showIcon && (
        <>
          {isActive ? (
            <FaPause className={iconSizes[size]} />
          ) : (
            <FaPlay className={iconSizes[size]} />
          )}
        </>
      )}
      {showText && (
        <span>{isActive ? activeLabel : inactiveLabel}</span>
      )}
    </button>
  );
};

export default PlayPauseButton;