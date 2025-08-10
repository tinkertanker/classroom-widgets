import React, { ReactNode } from 'react';
import { cn, widgetContainer } from '../utils/styles';

interface WidgetBaseProps {
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
  containerRef?: React.RefObject<HTMLDivElement>;
}

export const WidgetBase: React.FC<WidgetBaseProps> = ({ 
  children, 
  className, 
  footer,
  containerRef 
}) => {
  return (
    <div ref={containerRef} className={cn(widgetContainer, className)}>
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
      {footer && (
        <div className="p-3 border-t border-warm-gray-200 dark:border-warm-gray-700">
          {footer}
        </div>
      )}
    </div>
  );
};

interface WidgetContentProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'small' | 'medium' | 'large';
}

export const WidgetContent: React.FC<WidgetContentProps> = ({ 
  children, 
  className,
  padding = 'medium' 
}) => {
  const paddingClasses = {
    none: '',
    small: 'p-2',
    medium: 'p-4',
    large: 'p-6'
  };
  
  return (
    <div className={cn(paddingClasses[padding], className)}>
      {children}
    </div>
  );
};