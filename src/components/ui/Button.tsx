// Reusable Button component with consistent styling

import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'medium',
      fullWidth = false,
      loading = false,
      icon,
      iconPosition = 'left',
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseClasses = 'inline-flex items-center justify-center font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
    
    const variantClasses = {
      primary: 'bg-sage-500 hover:bg-sage-600 text-white focus:ring-sage-500',
      secondary: 'bg-terracotta-500 hover:bg-terracotta-600 text-white focus:ring-terracotta-500',
      danger: 'bg-dusty-rose-500 hover:bg-dusty-rose-600 text-white focus:ring-dusty-rose-500',
      ghost: 'bg-transparent hover:bg-warm-gray-100 dark:hover:bg-warm-gray-800 text-warm-gray-700 dark:text-warm-gray-300'
    };
    
    const sizeClasses = {
      small: 'px-2 py-1 text-xs rounded',
      medium: 'px-3 py-1.5 text-sm rounded',
      large: 'px-4 py-2 text-base rounded-md'
    };
    
    const disabledClasses = 'opacity-50 cursor-not-allowed';
    const fullWidthClasses = 'w-full';
    
    const classes = clsx(
      baseClasses,
      variantClasses[variant],
      sizeClasses[size],
      {
        [disabledClasses]: disabled || loading,
        [fullWidthClasses]: fullWidth
      },
      className
    );
    
    const content = (
      <>
        {loading ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
        ) : (
          <>
            {icon && iconPosition === 'left' && (
              <span className="mr-2">{icon}</span>
            )}
            {children}
            {icon && iconPosition === 'right' && (
              <span className="ml-2">{icon}</span>
            )}
          </>
        )}
      </>
    );
    
    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        {...props}
      >
        {content}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;