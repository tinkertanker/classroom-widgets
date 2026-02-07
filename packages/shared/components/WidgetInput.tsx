import React, { forwardRef } from 'react';
import { cn, text, backgrounds, transitions, borderStyles } from '../utils/styles';

interface WidgetInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  fullWidth?: boolean;
}

export const WidgetInput = forwardRef<HTMLInputElement, WidgetInputProps>(
  ({ className, error, fullWidth = true, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          borderStyles.input,
          borderStyles.focus,
          "px-3 py-2 outline-none",
          text.primary,
          text.placeholder,
          backgrounds.surface,
          transitions.colors,
          fullWidth && "w-full",
          error && "ring-2 ring-red-500",
          className
        )}
        {...props}
      />
    );
  }
);

WidgetInput.displayName = 'WidgetInput';

interface WidgetTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  fullWidth?: boolean;
  autoResize?: boolean;
}

export const WidgetTextarea = forwardRef<HTMLTextAreaElement, WidgetTextareaProps>(
  ({ className, error, fullWidth = true, autoResize, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          borderStyles.input,
          borderStyles.focus,
          "px-3 py-2 outline-none",
          text.primary,
          text.placeholder,
          backgrounds.surface,
          transitions.colors,
          fullWidth && "w-full",
          autoResize && "resize-none overflow-hidden",
          error && "ring-2 ring-red-500",
          className
        )}
        {...props}
      />
    );
  }
);

WidgetTextarea.displayName = 'WidgetTextarea';

interface WidgetButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const WidgetButton: React.FC<WidgetButtonProps> = ({
  className,
  variant = 'primary',
  size = 'md',
  fullWidth,
  children,
  ...props
}) => {
  const variants = {
    primary: "bg-sage-500 hover:bg-sage-600 dark:bg-sage-600 dark:hover:bg-sage-700 text-white",
    secondary: "bg-warm-gray-200 hover:bg-warm-gray-300 dark:bg-warm-gray-600 dark:hover:bg-warm-gray-500 " + text.primary,
    danger: "bg-dusty-rose-500 hover:bg-dusty-rose-600 text-white",
    ghost: "hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 " + text.primary
  };

  const sizes = {
    sm: "px-2 py-1 text-sm",
    md: "px-3 py-1.5 text-base",
    lg: "px-4 py-2 text-lg"
  };

  return (
    <button
      className={cn(
        "rounded font-medium",
        transitions.colors,
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};