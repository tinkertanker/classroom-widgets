import React, { Suspense } from 'react';
import { WIDGET_REGISTRY, getWidget } from "../../../shared/constants/widgetRegistry";
import { getWidgetDisplayName } from "../../../shared/utils/widgetRegistryHelpers";
import { DragAwareWrapper } from "../../../shared/components/DragAwareWrapper";
import ErrorBoundary from "../../../shared/components/ErrorBoundary";
import { LazyWidgets } from './LazyWidgets';

interface WidgetRendererProps {
  widgetType: number;
  widgetId: string;
  savedState: any;
  isActive: boolean;
  onStateChange: (state: any) => void;
  toggleConfetti: (value: boolean) => void;
  isDragging: boolean;
  hasDragged: boolean;
}

// Loading component shown while widget loads
const WidgetLoader: React.FC = () => (
  <div className="flex items-center justify-center h-full">
    <div className="flex flex-col items-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600"></div>
      <p className="mt-2 text-sm text-warm-gray-600 dark:text-warm-gray-400">Loading widget...</p>
    </div>
  </div>
);

/**
 * Widget renderer that uses the canonical widget registry
 * This ensures all widgets are properly configured and implemented
 */
const WidgetRendererRegistry: React.FC<WidgetRendererProps> = ({ 
  widgetType, 
  widgetId, 
  savedState, 
  isActive, 
  onStateChange, 
  toggleConfetti,
  isDragging,
  hasDragged
}) => {
  const renderWidget = () => {
    const widgetDef = getWidget(widgetType);
    if (!widgetDef) {
      console.error(`Widget type ${widgetType} not found in registry`);
      return <div>Unknown widget type</div>;
    }

    // Common props for all widgets
    const commonProps = {
      widgetId,
      savedState,
      onStateChange
    };

    // Get the lazy-loaded component based on the widget name
    const LazyComponent = LazyWidgets[widgetDef.name as keyof typeof LazyWidgets];
    
    if (!LazyComponent) {
      console.error(`Lazy component not found for widget: ${widgetDef.name}`);
      return <div>Widget component not found</div>;
    }

    // Special prop handling based on widget type
    switch(widgetDef.name) {
      case 'randomiser':
        return <LazyComponent {...commonProps} toggleConfetti={toggleConfetti} />;
      
      case 'timer':
      case 'trafficLight':
      case 'volumeLevel':
      case 'shortenLink':
        return <LazyComponent />;
      
      case 'taskCue':
      case 'soundEffects':
        return <LazyComponent isActive={isActive} />;
      
      case 'sticker':
        return <LazyComponent 
          stickerType={savedState?.stickerType || savedState?.stampType || 'heart'} 
          {...commonProps} 
        />;
      
      default:
        // All other widgets use common props
        return <LazyComponent {...commonProps} />;
    }
  };

  return (
    <ErrorBoundary widgetName={getWidgetDisplayName(widgetType).toLowerCase()}>
      <Suspense fallback={<WidgetLoader />}>
        <DragAwareWrapper isDragging={isDragging} hasDragged={hasDragged}>
          {renderWidget()}
        </DragAwareWrapper>
      </Suspense>
    </ErrorBoundary>
  );
};

export default WidgetRendererRegistry;