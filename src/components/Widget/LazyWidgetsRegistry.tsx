import { lazy } from 'react';
import { WIDGET_REGISTRY, getAllWidgets } from '../../constants/widgetRegistry';

// Dynamically generate lazy-loaded components based on widget registry
// This ensures all widgets in the registry have corresponding lazy imports

const generateLazyWidgets = () => {
  const lazyWidgets: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {};
  
  getAllWidgets().forEach(widget => {
    try {
      // Map widget names to their import paths
      // The registry uses consistent naming that matches component folders
      lazyWidgets[widget.name] = lazy(() => import(`../${widget.componentPath}/${widget.componentPath}`));
    } catch (error) {
      console.error(`Failed to create lazy import for widget: ${widget.name}`, error);
    }
  });
  
  return lazyWidgets;
};

// Export the generated lazy widgets
export const LazyWidgetsFromRegistry = generateLazyWidgets();

// Also export with mapped names for compatibility with existing code
export const LazyWidgets = {
  // Standalone widgets
  randomiser: lazy(() => import('../randomiser/randomiser')),
  timer: lazy(() => import('../timer/timer')),
  list: lazy(() => import('../list/list')),
  taskCue: lazy(() => import('../taskCue/taskCue')),
  trafficLight: lazy(() => import('../trafficLight/trafficLight')),
  volumeLevel: lazy(() => import('../volumeLevel/volumeLevel')),
  shortenLink: lazy(() => import('../shortenLink/shortenLink')),
  textBanner: lazy(() => import('../textBanner/textBanner')),
  imageDisplay: lazy(() => import('../imageDisplay/imageDisplay')),
  soundEffects: lazy(() => import('../soundEffects/soundEffects')),
  sticker: lazy(() => import('../sticker/sticker')),
  qrcode: lazy(() => import('../qrcode/qrcode')),
  visualiser: lazy(() => import('../visualiser/visualiser')),
  TicTacToe: lazy(() => import('../TicTacToe/TicTacToe')),
  
  // Networked widgets - using PascalCase as they are in the registry
  Poll: lazy(() => import('../poll/Poll')),
  DataShare: lazy(() => import('../dataShare/DataShare')),
  RTFeedback: lazy(() => import('../rtFeedback/RTFeedback')),
  Questions: lazy(() => import('../questions/Questions'))
};

// Validation function to ensure all widgets in registry have lazy imports
export function validateLazyWidgets(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  getAllWidgets().forEach(widget => {
    if (!LazyWidgets[widget.name as keyof typeof LazyWidgets]) {
      missing.push(widget.name);
    }
  });
  
  return {
    valid: missing.length === 0,
    missing
  };
}