import React, { Suspense } from 'react';
import { WIDGET_TYPES } from "../../constants/widgetTypes";
import { DragAwareWrapper } from "../common/DragAwareWrapper";
import ErrorBoundary from "../common/ErrorBoundary";
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

const WidgetRendererLazy: React.FC<WidgetRendererProps> = ({ 
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
    // Common props for all widgets
    const commonProps = {
      savedState,
      onStateChange
    };

    switch(widgetType) {
    case WIDGET_TYPES.RANDOMISER:
      const Randomiser = LazyWidgets.Randomiser;
      return <Randomiser {...commonProps} toggleConfetti={toggleConfetti} />;
      
    case WIDGET_TYPES.TIMER:
      const Timer = LazyWidgets.Timer;
      return <Timer />;
      
    case WIDGET_TYPES.LIST:
      const List = LazyWidgets.List;
      return <List {...commonProps} />;
      
    case WIDGET_TYPES.TASK_CUE:
      const TaskCue = LazyWidgets.TaskCue;
      return <TaskCue isActive={isActive} />;
      
    case WIDGET_TYPES.TRAFFIC_LIGHT:
      const TrafficLight = LazyWidgets.TrafficLight;
      return <TrafficLight />;
      
    case WIDGET_TYPES.SOUND_MONITOR:
      const AudioVolumeMonitor = LazyWidgets.AudioVolumeMonitor;
      return <AudioVolumeMonitor />;
      
    case WIDGET_TYPES.LINK_SHORTENER:
      const ShortenLink = LazyWidgets.ShortenLink;
      return <ShortenLink />;
      
    case WIDGET_TYPES.TEXT_BANNER:
      const TextBanner = LazyWidgets.TextBanner;
      return <TextBanner {...commonProps} />;
      
    case WIDGET_TYPES.IMAGE_DISPLAY:
      const ImageDisplay = LazyWidgets.ImageDisplay;
      return <ImageDisplay {...commonProps} />;
      
    case WIDGET_TYPES.SOUND_EFFECTS:
      const SoundEffects = LazyWidgets.SoundEffects;
      return <SoundEffects isActive={isActive} />;
      
    case WIDGET_TYPES.STAMP:
      const Sticker = LazyWidgets.Sticker;
      return <Sticker 
        stickerType={savedState?.stickerType || savedState?.stampType || 'heart'} 
        {...commonProps} 
      />;
      
    case WIDGET_TYPES.POLL:
      const Poll = LazyWidgets.Poll;
      return <Poll {...commonProps} />;
      
    case WIDGET_TYPES.QRCODE:
      const QRCodeWidget = LazyWidgets.QRCodeWidget;
      return <QRCodeWidget {...commonProps} />;
      
    case WIDGET_TYPES.DATA_SHARE:
      const DataShare = LazyWidgets.DataShare;
      return <DataShare {...commonProps} />;
      
    case WIDGET_TYPES.VISUALISER:
      const Visualiser = LazyWidgets.Visualiser;
      return <Visualiser {...commonProps} />;
      
    default:
      return null;
    }
  };

  // Get widget name for error boundary
  const getWidgetName = () => {
    const widgetEntry = Object.entries(WIDGET_TYPES).find(([_, value]) => value === widgetType);
    return widgetEntry ? widgetEntry[0].replace(/_/g, ' ').toLowerCase() : 'widget';
  };

  return (
    <ErrorBoundary widgetName={getWidgetName()}>
      <Suspense fallback={<WidgetLoader />}>
        <DragAwareWrapper isDragging={isDragging} hasDragged={hasDragged}>
          {renderWidget()}
        </DragAwareWrapper>
      </Suspense>
    </ErrorBoundary>
  );
};

export default WidgetRendererLazy;