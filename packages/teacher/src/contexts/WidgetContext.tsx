import React, { createContext, useMemo, ReactNode } from 'react';

interface WidgetContextType {
  widgetId?: string;
  savedState?: any;
  onStateChange?: (state: any) => void;
}

const WidgetContext = createContext<WidgetContextType | undefined>(undefined);

export const WidgetProvider: React.FC<{
  children: ReactNode;
  widgetId?: string;
  savedState?: any;
  onStateChange?: (state: any) => void;
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