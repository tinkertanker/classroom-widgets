import { widgetRegistry } from '../../services/WidgetRegistry';
import { WIDGET_TYPES } from './widgetTypes';

interface WidgetSizeConfig {
  defaultWidth: number;
  defaultHeight: number;
  minWidth: number;
  minHeight: number;
  maxWidth?: number;
  maxHeight?: number;
  lockAspectRatio: boolean | number;
  stickerConfigs?: {
    [key: string]: Partial<WidgetSizeConfig>;
  };
}

// Widget configuration definitions - Generated from service registry
export const WIDGET_CONFIGS: { [key: number]: WidgetSizeConfig } = {};

// Build configs from service registry
Object.entries(WIDGET_TYPES).forEach(([, legacyId]) => {
  const enumType = widgetRegistry.fromLegacyType(legacyId);
  if (!enumType) return;
  
  const widget = widgetRegistry.get(enumType);
  if (!widget) return;
  
  WIDGET_CONFIGS[legacyId] = {
    defaultWidth: widget.defaultSize.width,
    defaultHeight: widget.defaultSize.height,
    minWidth: widget.minSize?.width || 200,
    minHeight: widget.minSize?.height || 200,
    maxWidth: widget.maxSize?.width,
    maxHeight: widget.maxSize?.height,
    lockAspectRatio: widget.maintainAspectRatio || false,
    // Special handling for sticker configs
    ...(legacyId === WIDGET_TYPES.STAMP ? {
      stickerConfigs: {
        exclamation: {
          defaultWidth: 90,
          defaultHeight: 160,
          minWidth: 50,
          minHeight: 90,
          lockAspectRatio: 90 / 160
        }
      }
    } : {})
  };
});

// Helper function to get widget config
export function getWidgetConfig(widgetType: number, stickerType: string | null = null): WidgetSizeConfig {
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