import React from 'react';
import { FaArrowRotateLeft, FaTrash } from 'react-icons/fa6';
import { cn, buttons } from '../../../../shared/utils/styles';

interface ClearButtonProps {
  onClear: () => void;
  count?: number;
  label?: string;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'reset' | 'delete' | 'clear';
  showIcon?: boolean;
  showText?: boolean;
  requireConfirmation?: boolean;
  confirmationMessage?: string;
}

/**
 * Reusable clear/reset button for widgets that need to clear data.
 * Supports different variants and optional confirmation dialogs.
 */
export const ClearButton: React.FC<ClearButtonProps> = ({
  onClear,
  count = 0,
  label,
  disabled = false,
  className,
  size = 'sm',
  variant = 'clear',
  showIcon = true,
  showText = true,
  requireConfirmation = false,
  confirmationMessage
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

  const getIcon = () => {
    switch (variant) {
      case 'reset':
        return <FaArrowRotateLeft className={iconSizes[size]} />;
      case 'delete':
        return <FaTrash className={iconSizes[size]} />;
      case 'clear':
      default:
        return showText ? null : <FaArrowRotateLeft className={iconSizes[size]} />;
    }
  };

  const getDefaultLabel = () => {
    if (label) return label;

    switch (variant) {
      case 'reset':
        return "Reset";
      case 'delete':
        return "Delete";
      case 'clear':
      default:
        return count > 0 ? `Clear all` : "Clear";
    }
  };

  const handleClick = () => {
    if (disabled) return;

    if (requireConfirmation) {
      const message = confirmationMessage ||
        (variant === 'delete' ? 'Are you sure you want to delete this item?' :
         variant === 'reset' ? 'Are you sure you want to reset this data?' :
         'Are you sure you want to clear all data?');

      if (window.confirm(message)) {
        onClear();
      }
    } else {
      onClear();
    }
  };

  // Don't render if count is 0 and showWhenEmpty is false (implicit behavior)
  if (count === 0 && variant !== 'delete' && !label) {
    return null;
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        buttons.primary,
        sizeClasses[size],
        "disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5",
        className
      )}
      title={getDefaultLabel()}
    >
      {showIcon && getIcon()}
      {showText && (
        <span>{getDefaultLabel()}</span>
      )}
    </button>
  );
};

export default ClearButton;