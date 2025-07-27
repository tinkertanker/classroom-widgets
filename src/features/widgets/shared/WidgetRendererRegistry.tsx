import React, { Suspense } from 'react';
import { widgetRegistry } from "../../../services/WidgetRegistry";
import { WidgetType } from "../../../shared/types";
import { DragAwareWrapper } from "../../../shared/components/DragAwareWrapper";
import ErrorBoundary from "../../../shared/components/ErrorBoundary";

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
    // Convert legacy numeric type to enum
    const enumType = widgetRegistry.fromLegacyType(widgetType);
    if (!enumType) {
      console.error(`Widget type ${widgetType} not found in registry`);
      return <div>Unknown widget type</div>;
    }

    const widgetConfig = widgetRegistry.get(enumType);
    if (!widgetConfig) {
      console.error(`Widget config not found for type ${enumType}`);
      return <div>Widget configuration not found</div>;
    }

    const LazyComponent = widgetConfig.component;
    if (!LazyComponent) {
      console.error(`Component not found for widget: ${widgetConfig.name}`);
      return <div>Widget component not found</div>;
    }

    // Common props for all widgets
    const commonProps = {
      widgetId,
      savedState,
      onStateChange
    };

    // Special prop handling based on widget type
    const widgetName = widgetConfig.name.toLowerCase();
    
    switch(widgetName) {
      case 'randomiser':
        return <LazyComponent {...commonProps} toggleConfetti={toggleConfetti} />;
      
      case 'timer':
      case 'traffic light':
      case 'volume monitor':
      case 'link shortener':
        return <LazyComponent />;
      
      case 'task cue':
      case 'sound effects':
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
    <ErrorBoundary widgetName={widgetRegistry.getName(widgetRegistry.fromLegacyType(widgetType) || WidgetType.RANDOMISER).toLowerCase()}>
      <Suspense fallback={<WidgetLoader />}>
        <DragAwareWrapper isDragging={isDragging} hasDragged={hasDragged}>
          {renderWidget()}
        </DragAwareWrapper>
      </Suspense>
    </ErrorBoundary>
  );
};

export default WidgetRendererRegistry;