import React from 'react';
import { FaPlus } from 'react-icons/fa6';
import { WidgetControlBar } from './WidgetControlBar';
import { cn, buttons } from '../../../../shared/utils/styles';

interface ListControlBarProps {
  onAddItem: () => void;
  isLarge: boolean;
  disabled?: boolean;
  className?: string;
  label?: string;
}

/**
 * Specialized control bar for the List widget with its add item functionality.
 * Simple control bar focused on adding new list items.
 */
export const ListControlBar: React.FC<ListControlBarProps> = ({
  onAddItem,
  isLarge,
  disabled = false,
  className,
  label = "Add Item"
}) => {
  return (
    <WidgetControlBar className={className}>
      <button
        className={cn(
          buttons.primary,
          "flex items-center gap-1.5",
          isLarge ? "text-base py-2 px-3" : "text-sm py-1.5 px-3"
        )}
        onClick={onAddItem}
        disabled={disabled}
      >
        <FaPlus className={isLarge ? "text-sm" : "text-xs"} />
        {label}
      </button>
    </WidgetControlBar>
  );
};

export default ListControlBar;