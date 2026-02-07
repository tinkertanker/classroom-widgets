import React from 'react';
import { FaGear } from 'react-icons/fa6';
import { cn, buttons } from '@shared/utils/styles';

interface SettingsButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  title?: string;
  showText?: boolean;
  text?: string;
}

/**
 * Reusable settings button that opens configuration modals or panels.
 * Consistent styling and behavior across all widgets.
 */
export const SettingsButton: React.FC<SettingsButtonProps> = ({
  onClick,
  disabled = false,
  className,
  size = 'sm',
  title = "Settings",
  showText = false,
  text = "Settings"
}) => {
  const sizeClasses = {
    sm: "p-2",
    md: "p-2.5",
    lg: "p-3"
  };

  const iconSizes = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-xl"
  };

  const textSizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg"
  };

  const handleClick = () => {
    if (!disabled) {
      onClick();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        sizeClasses[size],
        "text-warm-gray-500 hover:text-warm-gray-700 dark:text-warm-gray-400 dark:hover:text-warm-gray-200",
        "hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 rounded transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        showText && buttons.primary,
        className
      )}
      title={title}
    >
      <FaGear className={iconSizes[size]} />
      {showText && (
        <span className={cn(textSizeClasses[size], "ml-1.5")}>
          {text}
        </span>
      )}
    </button>
  );
};

export default SettingsButton;