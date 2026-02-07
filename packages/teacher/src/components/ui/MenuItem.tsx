// MenuItem - Reusable menu item component for dropdown menus

import React, { forwardRef, ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { menuItem } from '@shared/utils/styles';

export interface MenuItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon component to display on the left */
  icon?: React.ComponentType<{ className?: string }>;
  /** Visual variant - danger shows red text */
  variant?: 'default' | 'danger';
  /** Additional content to show on the right (e.g., toggle switch) */
  rightContent?: React.ReactNode;
}

const MenuItem = forwardRef<HTMLButtonElement, MenuItemProps>(
  (
    {
      icon: Icon,
      variant = 'default',
      rightContent,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={clsx(
          variant === 'danger' ? menuItem.danger : menuItem.base,
          className
        )}
        {...props}
      >
        {Icon && <Icon className="mr-3 w-4 h-4 flex-shrink-0" />}
        <span className="flex-1 text-left">{children}</span>
        {rightContent}
      </button>
    );
  }
);

MenuItem.displayName = 'MenuItem';

export default MenuItem;

// Also export a MenuDivider for convenience
export const MenuDivider: React.FC = () => (
  <div className={menuItem.divider} />
);

// Export a MenuSection header
export const MenuSectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className={menuItem.sectionHeader}>{children}</div>
);
