// Base types for all widgets

export interface BaseWidgetProps {
  savedState?: any;
  onStateChange?: (state: any) => void;
  toggleConfetti?: (value: boolean) => void;
  isActive?: boolean;
}
