import { 
  WIDGET_REGISTRY, 
  getNetworkedWidgetIds, 
  isNetworkedWidget,
  WidgetDefinition 
} from '../constants/widgetRegistry';
import { WIDGET_TYPES } from '../constants/widgetTypes';

/**
 * Validates that all required widget components are properly implemented
 */
export function validateAllWidgetImplementations(): { 
  valid: boolean; 
  errors: string[] 
} {
  const errors: string[] = [];
  
  Object.values(WIDGET_REGISTRY).forEach(widget => {
    // Validate component path
    if (!widget.componentPath) {
      errors.push(`Widget ${widget.displayName} (${widget.id}) missing componentPath`);
    }
    
    // Validate networked widget requirements
    if (widget.networked) {
      if (!widget.networked.roomType) {
        errors.push(`Networked widget ${widget.displayName} missing roomType`);
      }
      if (!widget.networked.studentComponentName) {
        errors.push(`Networked widget ${widget.displayName} missing studentComponentName`);
      }
    }
    
    // Validate layout configuration
    if (!widget.layout) {
      errors.push(`Widget ${widget.displayName} missing layout configuration`);
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
  return getNetworkedWidgetIds();
}

/**
 * Check if a widget type should trigger cleanup on removal
 */
export function shouldTriggerCleanup(widgetType: number): boolean {
  return isNetworkedWidget(widgetType);
}

/**
 * Get widget display name from type
 */
export function getWidgetDisplayName(widgetType: number): string {
  return WIDGET_REGISTRY[widgetType]?.displayName || 'Unknown Widget';
}

/**
 * Get widget component import path
 */
export function getWidgetComponentPath(widgetType: number): string {
  const widget = WIDGET_REGISTRY[widgetType];
  if (!widget) {
    throw new Error(`Widget type ${widgetType} not found in registry`);
  }
  return widget.componentPath;
}

/**
 * Get student component name for networked widgets
 */
export function getStudentComponentName(widgetType: number): string | null {
  const widget = WIDGET_REGISTRY[widgetType];
  return widget?.networked?.studentComponentName || null;
}

/**
 * Generate toolbar items from widget registry
 */
export function generateToolbarItems(): {
  id: number;
  label: string;
  icon?: string;
}[] {
  return Object.values(WIDGET_REGISTRY)
    .filter(widget => widget.category !== 'decorative') // Exclude stickers from main toolbar
    .map(widget => ({
      id: widget.id,
      label: widget.displayName,
      icon: widget.icon
    }));
}

/**
 * Get room type for networked widget
 */
export function getWidgetRoomType(widgetType: number): string | null {
  const widget = WIDGET_REGISTRY[widgetType];
  return widget?.networked?.roomType || null;
}

/**
 * Check if widget has start/stop functionality
 */
export function widgetHasStartStop(widgetType: number): boolean {
  const widget = WIDGET_REGISTRY[widgetType];
  return widget?.networked?.hasStartStop || false;
}

/**
 * Check if widget starts in active state
 */
export function widgetStartsActive(widgetType: number): boolean {
  const widget = WIDGET_REGISTRY[widgetType];
  return widget?.networked?.startsActive || false;
}

/**
 * Get all widgets with a specific feature
 */
export function getWidgetsWithFeature(feature: keyof NonNullable<WidgetDefinition['features']>): WidgetDefinition[] {
  return Object.values(WIDGET_REGISTRY).filter(
    widget => widget.features?.[feature] === true
  );
}

/**
 * Development helper: Log widget registry status
 */
export function logWidgetRegistryStatus(): void {
  const validation = validateAllWidgetImplementations();
  
  console.group('Widget Registry Status');
  console.log(`Total widgets: ${Object.keys(WIDGET_REGISTRY).length}`);
  console.log(`Networked widgets: ${getNetworkedWidgetIds().length}`);
  console.log(`Validation: ${validation.valid ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (!validation.valid) {
    console.error('Validation errors:', validation.errors);
  }
  
  console.table(
    Object.values(WIDGET_REGISTRY).map(w => ({
      ID: w.id,
      Name: w.displayName,
      Category: w.category,
      Networked: !!w.networked,
      RoomType: w.networked?.roomType || '-',
      HasStartStop: w.networked?.hasStartStop || false
    }))
  );
  
  console.groupEnd();
}