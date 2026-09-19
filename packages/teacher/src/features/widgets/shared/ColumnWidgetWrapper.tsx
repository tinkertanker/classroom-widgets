import React, { useCallback, memo } from 'react';
import { FaXmark } from 'react-icons/fa6';
import { useWidget } from '@shared/hooks/useWidget';
import { widgetRegistry } from '../../../services/WidgetRegistry';
import { useWorkspaceUiStore } from '../../../store/workspaceUiStore';
import { isDesktopDashboardMode } from '@shared/utils/dashboardMode';
import { useHoverDelay } from './useHoverDelay';
import { WidgetActions } from './WidgetActions';

interface ColumnWidgetWrapperProps {
  widgetId: string;
  children: React.ReactNode;
  dashboardVisible?: boolean;
}

const ColumnWidgetWrapper: React.FC<ColumnWidgetWrapperProps> = ({ widgetId, children, dashboardVisible = true }) => {
  const { widget, remove } = useWidget(widgetId);
  const setFocusedWidget = useWorkspaceUiStore((state) => state.setFocusedWidget);
  // Use a boolean selector to avoid re-rendering all widgets on every focus change
  const isFocused = useWorkspaceUiStore((state) => state.focusedWidgetId === widgetId);
  // Match the canvas and native panel chrome timeout.
  const { visible: showDelete, onMouseEnter, onMouseLeave } = useHoverDelay(2000);

  // Detect touch devices (no hover capability) - always show delete button on touch
  const isTouchDevice = typeof window !== 'undefined' && window.matchMedia?.('(hover: none)')?.matches;

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

  if (!widget) return null;

  const config = widgetRegistry.get(widget.type);
  if (!config) return null;
  const isDashboardMode = isDesktopDashboardMode();

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
      data-web-chrome-visible={!isDashboardMode ? showDelete : undefined}
      onClick={handleWidgetClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={style}
    >
      <div className="widget-wrapper w-full h-full relative">
        <div
          className="widget-surface w-full h-full relative"
        >
          {children}
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
      {/* Web actions remain reachable outside the content, even with its footer hidden. */}
      {!isDashboardMode ? (
        <WidgetActions
          onDelete={handleDeleteClick}
        />
      ) : null}
    </div>
  );
};

export default memo(ColumnWidgetWrapper);
