// Reusable Card component for consistent widget styling

import React, { HTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'bordered' | 'elevated';
  padding?: 'none' | 'small' | 'medium' | 'large';
  fullHeight?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      padding = 'medium',
      fullHeight = true,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const baseClasses = 'bg-soft-white dark:bg-warm-gray-800 rounded-lg transition-all duration-200';
    
    const variantClasses = {
      default: 'shadow-sm',
      bordered: 'border border-warm-gray-200 dark:border-warm-gray-700',
      elevated: 'shadow-lg hover:shadow-xl'
    };
    
    const paddingClasses = {
      none: '',
      small: 'p-2',
      medium: 'p-4',
      large: 'p-6'
    };
    
    const heightClasses = fullHeight ? 'h-full' : '';
    
    const classes = clsx(
      baseClasses,
      variantClasses[variant],
      paddingClasses[padding],
      heightClasses,
      className
    );
    
    return (
      <div ref={ref} className={classes} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

// Card Header component
export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          'flex items-center justify-between pb-4 border-b border-warm-gray-200 dark:border-warm-gray-700',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

// Card Content component
export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx('flex-1 overflow-y-auto', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardContent.displayName = 'CardContent';

// Card Footer component
export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          'pt-4 border-t border-warm-gray-200 dark:border-warm-gray-700',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';

export default Card;