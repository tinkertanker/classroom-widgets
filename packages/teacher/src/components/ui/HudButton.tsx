// HudButton - Glass-morphism button for HUD elements

import React, { forwardRef, ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { hudContainer, hudButtonIcon, hudButtonIconSmall } from '@shared/utils/styles';

export interface HudButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon component to display */
  icon: React.ComponentType<{ className?: string }>;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Whether button is in active/selected state */
  active?: boolean;
}

const HudButton = forwardRef<HTMLButtonElement, HudButtonProps>(
  (
    {
      icon: Icon,
      size = 'md',
      active = false,
      className,
      ...props
    },
    ref
  ) => {
    const sizeClasses = size === 'sm' ? 'w-10' : 'px-3';
    const iconClass = size === 'sm' ? hudButtonIconSmall : hudButtonIcon;

    return (
      <button
        ref={ref}
        className={clsx(
          hudContainer.button,
          sizeClasses,
          active && 'ring-2 ring-sage-500 ring-offset-1',
          className
        )}
        {...props}
      >
        <Icon className={iconClass} />
      </button>
    );
  }
);

HudButton.displayName = 'HudButton';

export default HudButton;

// Also export a HudButtonGroup for grouped controls (like zoom)
export interface HudButtonGroupProps {
  children: React.ReactNode;
  className?: string;
}

export const HudButtonGroup: React.FC<HudButtonGroupProps> = ({ children, className }) => (
  <div className={clsx(hudContainer.group, className)}>
    {children}
  </div>
);

// Inner button for HudButtonGroup (no background, just icon)
export interface HudGroupButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ComponentType<{ className?: string }>;
  children?: React.ReactNode;
}

export const HudGroupButton = forwardRef<HTMLButtonElement, HudGroupButtonProps>(
  ({ icon: Icon, children, className, ...props }, ref) => (
    <button
      ref={ref}
      className={clsx(
        "p-1.5 rounded",
        "hover:bg-warm-gray-200 dark:hover:bg-warm-gray-700",
        "transition-colors",
        className
      )}
      {...props}
    >
      {Icon && <Icon className={hudButtonIconSmall} />}
      {children}
    </button>
  )
);

HudGroupButton.displayName = 'HudGroupButton';
