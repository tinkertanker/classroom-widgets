// WidgetRenderer - Renders individual widgets with proper wrapping

import React, { Suspense } from 'react';
import { useWidget } from '../../../shared/hooks/useWidget';
import { widgetRegistry } from '../../../services/WidgetRegistry';
import WidgetWrapper from '../../widgets/shared/WidgetWrapper';
import ErrorBoundary from '../../../shared/components/ErrorBoundary';
import { Card } from '../../../components/ui';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';

interface WidgetRendererProps {
  widgetId: string;
}

const WidgetLoader: React.FC = () => (
  <Card className="flex items-center justify-center h-full">
    <div className="flex flex-col items-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600"></div>
      <p className="mt-2 text-sm text-warm-gray-600 dark:text-warm-gray-400">Loading widget...</p>
    </div>
  </Card>
);

const WidgetRenderer: React.FC<WidgetRendererProps> = ({ widgetId }) => {
  const { widget, state, setState } = useWidget(widgetId);
  // Subscribe only to whether THIS widget is focused, not the focusedWidgetId value
  // This prevents all widgets from re-rendering when focus changes
  const isActive = useWorkspaceStore((state) => state.focusedWidgetId === widgetId);

  if (!widget) return null;

  const config = widgetRegistry.get(widget.type);
  if (!config) {
    console.error(`Widget type ${widget.type} not found in registry`);
    return null;
  }

  const Component = config.component;
  const widgetName = config.name;

  // Props to pass to the widget
  const widgetProps = {
    widgetId,
    savedState: state,
    onStateChange: setState,
    isActive
  };
  
  return (
    <WidgetWrapper widgetId={widgetId}>
      <ErrorBoundary widgetName={widgetName}>
        <Suspense fallback={<WidgetLoader />}>
          <Component {...widgetProps} />
        </Suspense>
      </ErrorBoundary>
    </WidgetWrapper>
  );
};

export default WidgetRenderer;