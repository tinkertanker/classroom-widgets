// Base types for all widgets

export interface BaseWidgetProps {
  savedState?: unknown;
  onStateChange?: (state: unknown) => void;
  toggleConfetti?: (value: boolean) => void;
  isActive?: boolean;
}
