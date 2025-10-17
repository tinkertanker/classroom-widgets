import React from 'react';
import { cn, widgetControls } from '../../../../shared/utils/styles';

interface WidgetControlBarProps {
  children: React.ReactNode;
  className?: string;
  gap?: string;
  justify?: string;
}

/**
 * Base control bar component that provides consistent layout and styling
 * for all widget control bars. Uses the standard widgetControls styling.
 */
export const WidgetControlBar: React.FC<WidgetControlBarProps> = ({
  children,
  className,
  gap = "gap-2",
  justify = "justify-between"
}) => {
  return (
    <div className={cn(widgetControls, gap, justify, className)}>
      {children}
    </div>
  );
};

export default WidgetControlBar;