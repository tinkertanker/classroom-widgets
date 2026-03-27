import React, { useCallback, memo } from 'react';
import { useWidget } from '@shared/hooks/useWidget';
import { widgetRegistry } from '../../../services/WidgetRegistry';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';

interface ColumnWidgetWrapperProps {
  widgetId: string;
  children: React.ReactNode;
}

const ColumnWidgetWrapper: React.FC<ColumnWidgetWrapperProps> = ({ widgetId, children }) => {
  const { widget } = useWidget(widgetId);
  const setFocusedWidget = useWorkspaceStore((state) => state.setFocusedWidget);

  if (!widget) return null;

  const config = widgetRegistry.get(widget.type);
  if (!config) return null;

  const handleWidgetClick = useCallback(() => {
    setFocusedWidget(widgetId);
  }, [widgetId, setFocusedWidget]);

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
