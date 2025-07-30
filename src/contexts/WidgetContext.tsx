import React, { createContext, useContext, ReactNode } from 'react';

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
  return (
    <WidgetContext.Provider value={{ widgetId, savedState, onStateChange }}>
      {children}
    </WidgetContext.Provider>
  );
};

export const useWidget = () => {
  const context = useContext(WidgetContext);
  if (!context) {
    throw new Error('useWidget must be used within a WidgetProvider');
  }
  return context;
};