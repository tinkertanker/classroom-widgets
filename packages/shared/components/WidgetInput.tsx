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