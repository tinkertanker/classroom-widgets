import React from 'react';
import { zIndex } from '@shared/utils/styles';
import { clsx } from 'clsx';

interface NarrowModeExitButtonProps {
  isNarrowScreen: boolean;
  layoutFormat: 'canvas' | 'column';
  onToggleLayout: () => void;
}

// Custom icon for column layout - two stacked rectangles (top-bottom)
const ColumnLayoutIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 16 16" fill="currentColor">
    <rect x="1" y="1" width="14" height="14" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <rect x="3" y="3.5" width="10" height="3.5" rx="0.5" />
    <rect x="3" y="9" width="10" height="3.5" rx="0.5" />
  </svg>
);

// Custom icon for canvas layout - asymmetric grid with merged cells
const CanvasLayoutIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 16 16" fill="currentColor">
    <rect x="1" y="1" width="14" height="14" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
    {/* A1+A2 merged - top-left wide cell */}
    <rect x="3" y="3" width="7" height="4" rx="0.5" />
    {/* A3+B3 merged - right tall cell */}
    <rect x="11" y="3" width="2" height="10" rx="0.5" />
    {/* B2 - bottom-middle cell */}
    <rect x="6" y="9" width="4" height="4" rx="0.5" />
    {/* B1 is empty */}
  </svg>
);

const NarrowModeExitButton: React.FC<NarrowModeExitButtonProps> = ({
  isNarrowScreen,
  layoutFormat,
  onToggleLayout
}) => {
  // Only show in narrow screen mode
  if (!isNarrowScreen) {
    return null;
  }

  const isColumn = layoutFormat === 'column';
  const label = isColumn ? 'Canvas' : 'Column';
  const Icon = isColumn ? CanvasLayoutIcon : ColumnLayoutIcon;
  const title = isColumn ? 'Switch to canvas layout' : 'Switch to column layout';

  return (
    <button
      onClick={onToggleLayout}
      className={clsx(
        `fixed bottom-2 right-2 ${zIndex.hud} px-2 py-1.5 h-auto`,
        "flex flex-col items-center gap-0.5",
        "bg-soft-white/80 dark:bg-warm-gray-800/80 rounded-lg shadow-md backdrop-blur-sm",
        "border border-warm-gray-300/50 dark:border-warm-gray-600/50",
        "hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700",
        // Match BottomBar's peekWrapper exactly
        "transition-all duration-300 ease-in-out pointer-events-auto",
        "opacity-30 translate-y-7",
        "hover:opacity-100 hover:translate-y-0",
        "focus-visible:opacity-100 focus-visible:translate-y-0",
        "active:opacity-100 active:translate-y-0"
      )}
      title={title}
    >
      <Icon className="w-4 h-4" />
      <span className="text-[10px]">{label}</span>
    </button>
  );
};

export default NarrowModeExitButton;
