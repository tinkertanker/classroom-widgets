import React, { useCallback, useState, useRef, useEffect, memo } from 'react';
import { FaTrash, FaXmark } from 'react-icons/fa6';
import { useWidget } from '@shared/hooks/useWidget';
import { widgetRegistry } from '../../../services/WidgetRegistry';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';
import { isDesktopDashboardMode } from '@shared/utils/dashboardMode';
import LiquidGlassOverlay from '../../desktop/LiquidGlassOverlay';

interface ColumnWidgetWrapperProps {
  widgetId: string;
  children: React.ReactNode;
  dashboardVisible?: boolean;
}

const ColumnWidgetWrapper: React.FC<ColumnWidgetWrapperProps> = ({ widgetId, children, dashboardVisible = true }) => {
  const { widget, remove } = useWidget(widgetId);
  const setFocusedWidget = useWorkspaceStore((state) => state.setFocusedWidget);
  // Use a boolean selector to avoid re-rendering all widgets on every focus change
  const isFocused = useWorkspaceStore((state) => state.focusedWidgetId === widgetId);
  const [showDelete, setShowDelete] = useState(false);
  const hideDeleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    // Clear any existing timeout before creating a new one
    if (hideDeleteTimeoutRef.current) {
      clearTimeout(hideDeleteTimeoutRef.current);
    }
    // Delay hiding the delete button
    hideDeleteTimeoutRef.current = setTimeout(() => {
      setShowDelete(false);
    }, 1000);
  }, []);

  if (!widget) return null;

  const config = widgetRegistry.get(widget.type);
  if (!config) return null;
  const isTransparent = config.features?.isTransparent || false;
  const isDashboardMode = isDesktopDashboardMode();
  const showDashboardOverlay = isDashboardMode && dashboardVisible && !isTransparent;

  // Height strategy is driven by the widget's columnSizing declaration
  const columnSizing = config.columnSizing ?? 'fixed';
  const style: React.CSSProperties = {};

  switch (columnSizing) {
    case 'aspect-ratio': {
      const { width, height } = config.defaultSize;
      style.aspectRatio = `${width} / ${height}`;
      break;
    }
    case 'content':
      // No height constraints — content drives height
      break;
    case 'fixed': {
      style.height = config.columnHeight ?? config.defaultSize.height;
      break;
    }
  }

  const isDeleteVisible = showDelete || isTouchDevice;

  return (
    <div
      className="column-widget-item relative break-inside-avoid mb-12"
      onClick={handleWidgetClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={style}
    >
      <div className="widget-wrapper w-full h-full relative">
        <div
          className="widget-surface w-full h-full relative"
          data-dashboard-glass={showDashboardOverlay ? 'true' : 'false'}
        >
          {children}
          <LiquidGlassOverlay active={showDashboardOverlay} />
          {isDashboardMode ? (
            <div
              className={`dashboard-widget-chrome absolute top-2 right-2 flex items-center gap-1 transition-all duration-200 ${
                isDeleteVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              data-dashboard-interactive="true"
              style={{ zIndex: 9999 }}
            >
              <button
                type="button"
                onClick={handleDeleteClick}
                tabIndex={isDeleteVisible ? 0 : -1}
                aria-label="Close widget"
                className="delete-button w-7 h-7 rounded-full bg-white/90 dark:bg-warm-gray-800/90 text-warm-gray-600 dark:text-warm-gray-200 border border-warm-gray-200/80 dark:border-warm-gray-600/80 shadow-lg flex items-center justify-center hover:bg-dusty-rose-500 hover:text-white transition-colors"
                title="Close widget"
              >
                <FaXmark className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {/* Delete button - appears on hover below widget (outside bounds), always visible on touch devices */}
      {!isDashboardMode ? (
        <button
          type="button"
          onClick={handleDeleteClick}
          tabIndex={isDeleteVisible ? 0 : -1}
          aria-label="Delete widget"
          className={`delete-button absolute -bottom-8 left-1/2 transform -translate-x-1/2
                     bg-warm-gray-200 dark:bg-warm-gray-600 hover:bg-dusty-rose-500 dark:hover:bg-dusty-rose-500
                     text-warm-gray-500 dark:text-warm-gray-400 hover:text-white p-2 rounded-full
                     shadow-lg transition-all duration-300 ${
                       isDeleteVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
                     }`}
          style={{ zIndex: 9999 }}
          title="Delete widget"
        >
          <FaTrash className="w-3 h-3" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
};

export default memo(ColumnWidgetWrapper);
