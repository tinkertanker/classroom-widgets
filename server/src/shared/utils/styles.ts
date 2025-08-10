import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Common transition classes
export const transitions = {
  colors: "transition-colors duration-200",
  all: "transition-all duration-300",
  shadow: "transition-shadow duration-200",
  opacity: "transition-opacity duration-300",
  transform: "transition-transform duration-200"
} as const;

// Common background styles
export const backgrounds = {
  card: "bg-soft-white dark:bg-warm-gray-800",
  surface: "bg-warm-gray-100 dark:bg-warm-gray-700",
  hover: "hover:bg-warm-gray-200 dark:hover:bg-warm-gray-600",
  border: "border border-warm-gray-200 dark:border-warm-gray-700"
} as const;

// Common text styles
export const text = {
  primary: "text-warm-gray-800 dark:text-warm-gray-200",
  secondary: "text-warm-gray-600 dark:text-warm-gray-400",
  muted: "text-warm-gray-500 dark:text-warm-gray-400",
  placeholder: "placeholder-warm-gray-500 dark:placeholder-warm-gray-400"
} as const;

// Common button styles
export const buttons = {
  primary: cn(
    "bg-sage-100 hover:bg-sage-200 dark:bg-sage-900/30 dark:hover:bg-sage-900/40",
    "border border-sage-500 dark:border-sage-400",
    "text-sage-700 dark:text-sage-300 rounded",
    transitions.colors
  ),
  secondary: cn(
    "bg-warm-gray-100 hover:bg-warm-gray-200 dark:bg-warm-gray-800 dark:hover:bg-warm-gray-700",
    "border border-warm-gray-400 dark:border-warm-gray-500",
    text.primary,
    "rounded",
    transitions.colors
  ),
  danger: cn(
    "bg-dusty-rose-100 hover:bg-dusty-rose-200 dark:bg-dusty-rose-900/30 dark:hover:bg-dusty-rose-900/40",
    "border border-dusty-rose-500 dark:border-dusty-rose-400",
    "text-dusty-rose-700 dark:text-dusty-rose-300 rounded",
    transitions.colors
  ),
  ghost: cn(
    "hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700",
    text.primary,
    "rounded",
    transitions.colors
  )
} as const;

// Widget container styles
export const widgetContainer = cn(
  backgrounds.card,
  backgrounds.border,
  "rounded-lg shadow-sm w-full h-full overflow-hidden flex flex-col"
);

// Status colors for lists, tasks, etc.
export const statusColors = {
  green: {
    bg: "bg-green-500 hover:bg-green-600",
    surface: "bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/40",
    text: text.primary
  },
  yellow: {
    bg: "bg-yellow-500 hover:bg-yellow-600",
    surface: "bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200 dark:hover:bg-yellow-900/40",
    text: text.primary
  },
  red: {
    bg: "bg-red-500 hover:bg-red-600",
    surface: "bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/40",
    text: text.primary
  },
  gray: {
    bg: "bg-warm-gray-400 hover:bg-warm-gray-500",
    surface: "bg-warm-gray-100 dark:bg-warm-gray-700 hover:bg-warm-gray-200 dark:hover:bg-warm-gray-600",
    text: "text-warm-gray-300 dark:text-warm-gray-500"
  },
  default: {
    bg: "bg-warm-gray-200 dark:bg-warm-gray-600 hover:bg-warm-gray-300 dark:hover:bg-warm-gray-500",
    surface: backgrounds.surface + " " + backgrounds.hover,
    text: text.primary
  }
} as const;

// Icon size utilities
export const iconSizes = {
  xs: "w-3 h-3",
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
  xl: "w-8 h-8"
} as const;

// Responsive size classes
export const responsiveSizes = {
  text: {
    small: "text-sm",
    medium: "text-base",
    large: "text-2xl"
  },
  padding: {
    small: "p-1.5",
    medium: "p-2",
    large: "p-3"
  },
  spacing: {
    small: "space-y-1",
    medium: "space-y-2",
    large: "space-y-3"
  }
} as const;

// Helper to get status color classes
export function getStatusColor(status: number | string, type: 'bg' | 'surface' | 'text' = 'bg') {
  const colorMap: Record<number | string, keyof typeof statusColors> = {
    1: 'green',
    2: 'yellow',
    3: 'red',
    4: 'gray',
    'success': 'green',
    'warning': 'yellow',
    'error': 'red',
    'disabled': 'gray'
  };
  
  const colorKey = colorMap[status] || 'default';
  return statusColors[colorKey][type];
}