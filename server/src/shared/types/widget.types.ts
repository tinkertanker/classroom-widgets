// Base types for all widgets

export interface BaseWidgetProps {
  savedState?: any;
  onStateChange?: (state: any) => void;
  toggleConfetti?: (value: boolean) => void;
  isActive?: boolean;
}

// Common widget state patterns
export interface WidgetWithSettings {
  showSettings: boolean;
}

// Widget-specific prop interfaces can extend BaseWidgetProps
export interface RandomiserProps extends BaseWidgetProps {
  // Randomiser-specific props if any
}

export interface TimerProps extends BaseWidgetProps {
  // Timer-specific props if any
}

export interface ListProps extends BaseWidgetProps {
  // List-specific props if any
}

export interface PollProps extends BaseWidgetProps {
  widgetId: string;
}

// Add more widget prop interfaces as needed