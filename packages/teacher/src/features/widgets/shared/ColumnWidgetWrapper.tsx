import React, { useCallback, memo } from 'react';
import { useWidget } from '@shared/hooks/useWidget';
import { widgetRegistry } from '../../../services/WidgetRegistry';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';
import { WidgetType } from '@shared/types';

interface ColumnWidgetWrapperProps {
  widgetId: string;
  children: React.ReactNode;
}

// Widgets that need a fixed height in column layout (e.g. SVG-based content
// that collapses without an explicit dimension).
const FIXED_HEIGHT_WIDGETS = new Set([WidgetType.TIMER]);

// Widgets whose height should be driven entirely by their content
// (no maxHeight constraint from canvas size).
const CONTENT_HEIGHT_WIDGETS = new Set([WidgetType.TEXT_BANNER, WidgetType.SOUND_EFFECTS]);

const ColumnWidgetWrapper: React.FC<ColumnWidgetWrapperProps> = ({ widgetId, children }) => {
  const { widget } = useWidget(widgetId);
  const setFocusedWidget = useWorkspaceStore((state) => state.setFocusedWidget);

  if (!widget) return null;

  const config = widgetRegistry.get(widget.type);
  if (!config) return null;

  const handleWidgetClick = useCallback(() => {
    setFocusedWidget(widgetId);
  }, [widgetId, setFocusedWidget]);

  // Determine height strategy per widget type
  const style: React.CSSProperties = {};
  if (FIXED_HEIGHT_WIDGETS.has(widget.type)) {
    style.height = widget.size.height;
  } else if (!CONTENT_HEIGHT_WIDGETS.has(widget.type)) {
    style.maxHeight = widget.size.height;
  }

  return (
    <div
      className="column-widget-item relative break-inside-avoid mb-4 overflow-hidden"
      onClick={handleWidgetClick}
      style={{ height: widget.size.height }}
    >
      <div className="widget-wrapper w-full h-full">
        {children}
      </div>
    </div>
  );
};

export default memo(ColumnWidgetWrapper);
