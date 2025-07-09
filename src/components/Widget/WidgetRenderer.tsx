import React from 'react';
import Randomiser from "../randomiser/randomiser";
import Timer from "../timer/timer";
import List from "../list/list";
import TaskCue from "../taskCue/taskCue";
import TrafficLight from "../trafficLight/trafficLight";
import AudioVolumeMonitor from "../volumeLevel/volumeLevel";
import ShortenLink from "../shortenLink/shortenLink";
import TextBanner from "../textBanner/textBanner";
import ImageDisplay from "../imageDisplay/imageDisplay";
import SoundEffects from "../soundEffects/soundEffects";
import Sticker from "../sticker/sticker";
import Poll from "../poll/poll";
import QRCodeWidget from "../qrcode/qrcode";
import DataShare from "../dataShare/dataShare";
import Visualiser from "../visualiser/visualiser";
import { WIDGET_TYPES } from "../../constants/widgetTypes";
import { DragAwareWrapper } from "../common/DragAwareWrapper";

const WidgetRenderer = ({ widgetType, widgetId, savedState, isActive, onStateChange, toggleConfetti, isDragging, hasDragged }) => {
  const renderWidget = () => {
    switch(widgetType) {
    case WIDGET_TYPES.RANDOMISER:
      return <Randomiser 
        toggleConfetti={toggleConfetti} 
        savedState={savedState}
        onStateChange={onStateChange}
      />;
    case WIDGET_TYPES.TIMER:
      return <Timer />;
    case WIDGET_TYPES.LIST:
      return <List 
        savedState={savedState}
        onStateChange={onStateChange}
      />;
    case WIDGET_TYPES.TASK_CUE:
      return <TaskCue isActive={isActive} />;
    case WIDGET_TYPES.TRAFFIC_LIGHT:
      return <TrafficLight />;
    case WIDGET_TYPES.SOUND_MONITOR:
      return <AudioVolumeMonitor />;
    case WIDGET_TYPES.LINK_SHORTENER:
      return <ShortenLink />;
    case WIDGET_TYPES.TEXT_BANNER:
      return <TextBanner
        savedState={savedState}
        onStateChange={onStateChange}
      />;
    case WIDGET_TYPES.IMAGE_DISPLAY:
      return <ImageDisplay
        savedState={savedState}
        onStateChange={onStateChange}
      />;
    case WIDGET_TYPES.SOUND_EFFECTS:
      return <SoundEffects isActive={isActive} />;
    case WIDGET_TYPES.STAMP:
      return <Sticker
        stickerType={savedState?.stickerType || savedState?.stampType || 'heart'}
        savedState={savedState}
        onStateChange={onStateChange}
      />;
    case WIDGET_TYPES.POLL:
      return <Poll
        savedState={savedState}
        onStateChange={onStateChange}
      />;
    case WIDGET_TYPES.QRCODE:
      return <QRCodeWidget
        savedState={savedState}
        onStateChange={onStateChange}
      />;
    case WIDGET_TYPES.DATA_SHARE:
      return <DataShare
        savedState={savedState}
        onStateChange={onStateChange}
      />;
    case WIDGET_TYPES.VISUALISER:
      return <Visualiser
        savedState={savedState}
        onStateChange={onStateChange}
      />;
    default:
      return null;
    }
  };

  return (
    <DragAwareWrapper isDragging={isDragging} hasDragged={hasDragged}>
      {renderWidget()}
    </DragAwareWrapper>
  );
};

export default WidgetRenderer;