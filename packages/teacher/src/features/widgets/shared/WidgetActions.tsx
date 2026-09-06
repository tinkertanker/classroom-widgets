import React from 'react';
import { FaTrash } from 'react-icons/fa6';

/** Shares its wrapper's visibility clock with the widget control bar. */
export const WidgetActions = ({ onDelete }: {
  onDelete: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) => (
  <button
    type="button"
    data-widget-actions
    onMouseDown={event => event.stopPropagation()}
    onClick={onDelete}
    aria-label="Delete widget"
    title="Delete widget"
    className="delete-button no-drag absolute -bottom-8 left-1/2 z-[9999] flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full bg-warm-gray-200 text-warm-gray-500 shadow-lg hover:bg-dusty-rose-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 dark:bg-warm-gray-600 dark:text-warm-gray-200"
  >
    <FaTrash className="h-3 w-3" aria-hidden="true" />
  </button>
);
