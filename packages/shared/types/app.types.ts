// Widget and application type definitions

export interface WidgetInstance {
  id: string;
  index: number;
}

export interface WidgetPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WidgetSize {
  width: number;
  height: number;
}

export interface WidgetState {
  position: WidgetPosition;
  size: WidgetSize;
  // Widget-specific state can be added as needed
  [key: string]: any;
}

export type WidgetStatesMap = Map<string, any>;
export type WidgetPositionsMap = Map<string, WidgetPosition>;

// Background type is defined in index.ts