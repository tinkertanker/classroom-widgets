import React from 'react';
import { WidgetProvider } from '../../../contexts/WidgetContext';

/**
 * Common widget props interface that all networked widgets implement
 */
export interface WidgetProps {
  widgetId?: string;
  savedState?: any;
  onStateChange?: (state: any) => void;
}

/**
 * Higher-Order Component that wraps a widget component with WidgetProvider.
 * This extracts the repeated wrapper pattern from all networked widgets.
 */
export function withWidgetProvider<P extends WidgetProps>(
  Component: React.ComponentType<P>,
  displayName?: string
): React.FC<P> {
  const WrappedComponent: React.FC<P> = (props) => {
    return (
      <WidgetProvider
        widgetId={props.widgetId}
        savedState={props.savedState}
        onStateChange={props.onStateChange}
      >
        <Component {...props} />
      </WidgetProvider>
    );
  };

  WrappedComponent.displayName = displayName || `WithWidgetProvider(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
}

export default withWidgetProvider;
