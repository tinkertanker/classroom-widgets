import { widgetRegistry } from '../../services/WidgetRegistry';
import { WidgetType, WidgetConfig } from '../types';
import { WIDGET_TYPES } from '../constants/widgetTypes';

/**
 * Validates that all required widget components are properly implemented
 */
export function validateAllWidgetImplementations(): { 
  valid: boolean; 
  errors: string[] 
} {
  const errors: string[] = [];
  const allWidgets = widgetRegistry.getAll();
  
  allWidgets.forEach(widget => {
    // Validate component
    if (!widget.component) {
      errors.push(`Widget ${widget.name} (${widget.type}) missing component`);
    }
    
    // Validate networked widget requirements
    if (widget.networked) {
      if (!widget.networked.roomType) {
        errors.push(`Networked widget ${widget.name} missing roomType`);
      }
      if (!widget.networked.studentComponentName) {
        errors.push(`Networked widget ${widget.name} missing studentComponentName`);
      }
    }
    
    // Validate size configuration
    if (!widget.defaultSize) {
      errors.push(`Widget ${widget.name} missing defaultSize configuration`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get list of networked widget IDs for cleanup dispatch
 */
export function getNetworkedWidgetIdsForCleanup(): number[] {
  const networkedWidgets = widgetRegistry.getNetworkedWidgets();
  return networkedWidgets.map(widget => widgetRegistry.toLegacyType(widget.type));
}

/**
 * Check if a widget type should trigger cleanup on removal
 */
export function shouldTriggerCleanup(widgetType: number): boolean {
  const enumType = widgetRegistry.fromLegacyType(widgetType);
  return enumType ? widgetRegistry.isNetworked(enumType) : false;
}

/**
 * Get widget display name from type
 */
export function getWidgetDisplayName(widgetType: number): string {
  const enumType = widgetRegistry.fromLegacyType(widgetType);
  return enumType ? widgetRegistry.getName(enumType) : 'Unknown Widget';
}

/**
 * Get widget component import path
 */
export function getWidgetComponentPath(widgetType: number): string {
  const enumType = widgetRegistry.fromLegacyType(widgetType);
  if (!enumType) {
    throw new Error(`Widget type ${widgetType} not found in registry`);
  }
  const widget = widgetRegistry.get(enumType);
  if (!widget) {
    throw new Error(`Widget config for type ${enumType} not found`);
  }
  // Return the widget name as component path for compatibility
  return widget.name.charAt(0).toLowerCase() + widget.name.slice(1).replace(/\s+/g, '');
}

/**
 * Get student component name for networked widgets
 */
export function getStudentComponentName(widgetType: number): string | null {
  const enumType = widgetRegistry.fromLegacyType(widgetType);
  if (!enumType) return null;
  
  const config = widgetRegistry.getNetworkedConfig(enumType);
  return config?.studentComponentName || null;
}

/**
 * Generate toolbar items from widget registry
 */
export function generateToolbarItems(): {
  id: number;
  label: string;
  icon?: string;
}[] {
  const allWidgets = widgetRegistry.getAll();
  
  return allWidgets
    .filter(widget => widget.category !== 'fun' || widget.name !== 'Sticker') // Exclude stickers from main toolbar
    .map(widget => ({
      id: widgetRegistry.toLegacyType(widget.type),
      label: widget.name,
      icon: widget.icon?.displayName || undefined
    }));
}

/**
 * Get room type for networked widget
 */
export function getWidgetRoomType(widgetType: number): string | null {
  const enumType = widgetRegistry.fromLegacyType(widgetType);
  return enumType ? widgetRegistry.getRoomType(enumType) : null;
}

/**
 * Check if widget has start/stop functionality
 */
export function widgetHasStartStop(widgetType: number): boolean {
  const enumType = widgetRegistry.fromLegacyType(widgetType);
  if (!enumType) return false;
  
  const config = widgetRegistry.getNetworkedConfig(enumType);
  return config?.hasStartStop || false;
}

/**
 * Check if widget starts in active state
 */
export function widgetStartsActive(widgetType: number): boolean {
  const enumType = widgetRegistry.fromLegacyType(widgetType);
  if (!enumType) return false;
  
  const config = widgetRegistry.getNetworkedConfig(enumType);
  return config?.startsActive || false;
}

/**
 * Get all widgets with a specific feature
 */
export function getWidgetsWithFeature(feature: keyof import('../types').WidgetFeatures): WidgetConfig[] {
  return widgetRegistry.getWidgetsByFeature(feature);
}

/**
 * Check if widget is networked (using numeric type)
 */
export function isNetworkedWidget(widgetType: number): boolean {
  const enumType = widgetRegistry.fromLegacyType(widgetType);
  return enumType ? widgetRegistry.isNetworked(enumType) : false;
}

/**
 * Development helper: Log widget registry status
 */
export function logWidgetRegistryStatus(): void {
  const validation = validateAllWidgetImplementations();
  
  if (process.env.NODE_ENV === 'development') {
    console.group('Widget Registry Status');
    console.log(`Total widgets: ${widgetRegistry.getAll().length}`);
    console.log(`Networked widgets: ${widgetRegistry.getNetworkedWidgets().length}`);
    console.log(`Validation: ${validation.valid ? '✅ Valid' : '❌ Invalid'}`);
    if (!validation.valid) {
      console.error('Errors:', validation.errors);
    }
    console.groupEnd();
  }
}