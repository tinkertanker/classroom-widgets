import React, { useCallback, useState, useRef, useEffect, memo } from 'react';
import { FaTrash } from 'react-icons/fa6';
import { useWidget } from '@shared/hooks/useWidget';
import { widgetRegistry } from '../../../services/WidgetRegistry';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';

interface ColumnWidgetWrapperProps {
  widgetId: string;
  children: React.ReactNode;
}

const ColumnWidgetWrapper: React.FC<ColumnWidgetWrapperProps> = ({ widgetId, children }) => {
  const { widget, remove } = useWidget(widgetId);
  const setFocusedWidget = useWorkspaceStore((state) => state.setFocusedWidget);
  // Use a boolean selector to avoid re-rendering all widgets on every focus change
  const isFocused = useWorkspaceStore((state) => state.focusedWidgetId === widgetId);
  const [showDelete, setShowDelete] = useState(false);
  const hideDeleteTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Detect touch devices (no hover capability) - always show delete button on touch
  const isTouchDevice = typeof window !== 'undefined' && window.matchMedia?.('(hover: none)')?.matches;

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideDeleteTimeoutRef.current) {
        clearTimeout(hideDeleteTimeoutRef.current);
      }
    };
  }, []);

  if (!widget) return null;

  const config = widgetRegistry.get(widget.type);
  if (!config) return null;

  const handleWidgetClick = useCallback(() => {
    setFocusedWidget(widgetId);
  }, [widgetId, setFocusedWidget]);

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // Play trash sound
    (window as any).playTrashSound?.();
    // Clear focus if this widget is currently focused
    if (isFocused) {
      setFocusedWidget(null);
    }
    // Remove the widget
    remove();
  }, [remove, isFocused, setFocusedWidget]);

  const handleMouseEnter = useCallback(() => {
    setShowDelete(true);
    // Clear any pending timeout
    if (hideDeleteTimeoutRef.current) {
      clearTimeout(hideDeleteTimeoutRef.current);
      hideDeleteTimeoutRef.current = null;
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    // Delay hiding the delete button
    hideDeleteTimeoutRef.current = setTimeout(() => {
      setShowDelete(false);
    }, 1000);
  }, []);

  return (
    <div
      className="column-widget-item relative break-inside-avoid mb-12"
      onClick={handleWidgetClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ height: widget.size.height }}
    >
      <div className="widget-wrapper w-full h-full">
        {children}
      </div>
      {/* Delete button - appears on hover below widget (outside bounds), always visible on touch devices */}
      <button
        type="button"
        onClick={handleDeleteClick}
        tabIndex={0}
        aria-label="Delete widget"
        className={`delete-button absolute -bottom-8 left-1/2 transform -translate-x-1/2
                   bg-warm-gray-200 dark:bg-warm-gray-600 hover:bg-dusty-rose-500 dark:hover:bg-dusty-rose-500
                   text-warm-gray-500 dark:text-warm-gray-400 hover:text-white p-2 rounded-full
                   shadow-lg transition-all duration-300 focus:opacity-100 focus-visible:opacity-100 focus:pointer-events-auto focus-visible:pointer-events-auto ${
                     showDelete || isTouchDevice ? 'opacity-100' : 'opacity-0 pointer-events-none'
                   }`}
        style={{ zIndex: 9999 }}
        title="Delete widget"
      >
        <FaTrash className="w-3 h-3" aria-hidden="true" />
      </button>
    </div>
  );
};

export default memo(ColumnWidgetWrapper);
