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

  return (
    <div
      className="column-widget-item relative break-inside-avoid mb-4"
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
