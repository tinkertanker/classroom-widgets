import { WIDGET_TYPES } from './widgetTypes';

// Widget configuration definitions
export const WIDGET_CONFIGS = {
  [WIDGET_TYPES.RANDOMISER]: {
    defaultWidth: 350,
    defaultHeight: 250,
    minWidth: 200,
    minHeight: 150,
    lockAspectRatio: false
  },
  [WIDGET_TYPES.TIMER]: {
    defaultWidth: 350,
    defaultHeight: 415,
    minWidth: 250,
    minHeight: 306,
    lockAspectRatio: 350 / 415
  },
  [WIDGET_TYPES.LIST]: {
    defaultWidth: 350,
    defaultHeight: 350,
    minWidth: 200,
    minHeight: 200,
    lockAspectRatio: false
  },
  [WIDGET_TYPES.WORK_SYMBOLS]: {
    defaultWidth: 350,
    defaultHeight: 350,
    minWidth: 200,
    minHeight: 200,
    lockAspectRatio: true
  },
  [WIDGET_TYPES.TRAFFIC_LIGHT]: {
    defaultWidth: 300,
    defaultHeight: 175,
    minWidth: 250,
    minHeight: 150,
    lockAspectRatio: false
  },
  [WIDGET_TYPES.SOUND_MONITOR]: {
    defaultWidth: 280,
    defaultHeight: 290,
    minWidth: 200,
    minHeight: 200,
    lockAspectRatio: false
  },
  [WIDGET_TYPES.LINK_SHORTENER]: {
    defaultWidth: 350,
    defaultHeight: 350,
    minWidth: 200,
    minHeight: 200,
    lockAspectRatio: true
  },
  [WIDGET_TYPES.TEXT_BANNER]: {
    defaultWidth: 500,
    defaultHeight: 200,
    minWidth: 200,
    minHeight: 80,
    lockAspectRatio: false
  },
  [WIDGET_TYPES.IMAGE_DISPLAY]: {
    defaultWidth: 350,
    defaultHeight: 350,
    minWidth: 200,
    minHeight: 200,
    lockAspectRatio: false
  },
  [WIDGET_TYPES.SOUND_EFFECTS]: {
    defaultWidth: 80,
    defaultHeight: 420,
    minWidth: 80,
    minHeight: 200,
    lockAspectRatio: false
  },
  [WIDGET_TYPES.STAMP]: {
    defaultWidth: 60,
    defaultHeight: 60,
    minWidth: 30,
    minHeight: 30,
    lockAspectRatio: true,
    // Sticker-specific configurations for tall shapes
    stickerConfigs: {
      exclamation: {
        defaultWidth: 45,
        defaultHeight: 80,
        minWidth: 25,
        minHeight: 45,
        lockAspectRatio: 45 / 80
      }
    }
  }
};

// Helper function to get widget config
export function getWidgetConfig(widgetType, stickerType = null) {
  const baseConfig = WIDGET_CONFIGS[widgetType] || {
    defaultWidth: 350,
    defaultHeight: 350,
    minWidth: 200,
    minHeight: 200,
    lockAspectRatio: true
  };
  
  // For stickers, check if there's a sticker-specific config
  if (widgetType === WIDGET_TYPES.STAMP && stickerType && baseConfig.stickerConfigs && baseConfig.stickerConfigs[stickerType]) {
    return { ...baseConfig, ...baseConfig.stickerConfigs[stickerType] };
  }
  
  return baseConfig;
}