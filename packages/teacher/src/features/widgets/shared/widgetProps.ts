/**
 * Common widget props interface that all networked widgets implement
 */
export interface WidgetProps {
  widgetId?: string;
  savedState?: any;
  onStateChange?: (state: any) => void;
}
