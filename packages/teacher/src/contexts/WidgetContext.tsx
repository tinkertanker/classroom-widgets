import React, { createContext, useMemo, ReactNode } from 'react';

interface WidgetContextType {
  widgetId?: string;
  savedState?: unknown;
  onStateChange?: (state: unknown) => void;
}

const WidgetContext = createContext<WidgetContextType | undefined>(undefined);

export const WidgetProvider: React.FC<{
  children: ReactNode;
  widgetId?: string;
  savedState?: unknown;
  onStateChange?: (state: unknown) => void;
}> = ({ children, widgetId, savedState, onStateChange }) => {
  const value = useMemo(
    () => ({ widgetId, savedState, onStateChange }),
    [widgetId, savedState, onStateChange]
  );
  return (
    <WidgetContext.Provider value={value}>
      {children}
    </WidgetContext.Provider>
  );
};