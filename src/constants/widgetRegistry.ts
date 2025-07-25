import { WIDGET_TYPES } from './widgetTypes';
import { RoomType } from '../hooks/useSession';

// Define widget categories
export enum WidgetCategory {
  STANDALONE = 'standalone',
  NETWORKED = 'networked',
  DECORATIVE = 'decorative'
}

// Widget feature flags
export interface WidgetFeatures {
  hasSettings?: boolean;
  hasStateManagement?: boolean;
  requiresApiKey?: boolean;
  hasAudioPlayback?: boolean;
  hasFaceDetection?: boolean;
  isResizable?: boolean;
  canTriggerConfetti?: boolean;
}

// Complete widget definition
export interface WidgetDefinition {
  id: number;
  name: string;
  displayName: string;
  category: WidgetCategory;
  componentPath: string;
  icon?: string;
  description?: string;
  features?: WidgetFeatures;
  
  // Layout configuration
  layout: {
    defaultWidth: number;
    defaultHeight: number;
    minWidth: number;
    minHeight: number;
    maxWidth?: number;
    maxHeight?: number;
    lockAspectRatio: boolean | number;
  };
  
  // Networked widget specific
  networked?: {
    roomType: RoomType;
    hasStartStop: boolean;
    startsActive: boolean;
    studentComponentName: string;
  };
}

// Canonical widget registry - Single source of truth
export const WIDGET_REGISTRY: { [key: number]: WidgetDefinition } = {
  [WIDGET_TYPES.RANDOMISER]: {
    id: WIDGET_TYPES.RANDOMISER,
    name: 'randomiser',
    displayName: 'Randomiser',
    category: WidgetCategory.STANDALONE,
    componentPath: 'randomiser',
    description: 'Random selection with slot machine animation',
    features: {
      hasSettings: true,
      hasStateManagement: true,
      canTriggerConfetti: true,
      isResizable: true
    },
    layout: {
      defaultWidth: 350,
      defaultHeight: 250,
      minWidth: 200,
      minHeight: 150,
      lockAspectRatio: false
    }
  },
  
  [WIDGET_TYPES.TIMER]: {
    id: WIDGET_TYPES.TIMER,
    name: 'timer',
    displayName: 'Timer',
    category: WidgetCategory.STANDALONE,
    componentPath: 'timer',
    description: 'Countdown and stopwatch functionality',
    features: {
      hasSettings: true,
      hasStateManagement: true,
      hasAudioPlayback: true,
      isResizable: true
    },
    layout: {
      defaultWidth: 350,
      defaultHeight: 415,
      minWidth: 250,
      minHeight: 306,
      lockAspectRatio: 350 / 415
    }
  },
  
  [WIDGET_TYPES.LIST]: {
    id: WIDGET_TYPES.LIST,
    name: 'list',
    displayName: 'List',
    category: WidgetCategory.STANDALONE,
    componentPath: 'list',
    description: 'Task list with completion tracking',
    features: {
      hasSettings: true,
      hasStateManagement: true,
      canTriggerConfetti: true,
      isResizable: true
    },
    layout: {
      defaultWidth: 350,
      defaultHeight: 350,
      minWidth: 200,
      minHeight: 200,
      lockAspectRatio: false
    }
  },
  
  [WIDGET_TYPES.TASK_CUE]: {
    id: WIDGET_TYPES.TASK_CUE,
    name: 'taskCue',
    displayName: 'Task Cue',
    category: WidgetCategory.STANDALONE,
    componentPath: 'taskCue',
    description: 'Visual work mode indicators',
    features: {
      hasSettings: true,
      hasStateManagement: true,
      isResizable: false
    },
    layout: {
      defaultWidth: 350,
      defaultHeight: 350,
      minWidth: 350,
      minHeight: 350,
      maxWidth: 350,
      maxHeight: 350,
      lockAspectRatio: true
    }
  },
  
  [WIDGET_TYPES.TRAFFIC_LIGHT]: {
    id: WIDGET_TYPES.TRAFFIC_LIGHT,
    name: 'trafficLight',
    displayName: 'Traffic Light',
    category: WidgetCategory.STANDALONE,
    componentPath: 'trafficLight',
    description: 'Status indicator lights',
    features: {
      hasSettings: true,
      hasStateManagement: true,
      isResizable: true
    },
    layout: {
      defaultWidth: 400,
      defaultHeight: 180,
      minWidth: 350,
      minHeight: 150,
      lockAspectRatio: false
    }
  },
  
  [WIDGET_TYPES.SOUND_MONITOR]: {
    id: WIDGET_TYPES.SOUND_MONITOR,
    name: 'volumeLevel',
    displayName: 'Volume Level Monitor',
    category: WidgetCategory.STANDALONE,
    componentPath: 'volumeLevel',
    description: 'Audio level visualization',
    features: {
      hasSettings: true,
      isResizable: true
    },
    layout: {
      defaultWidth: 280,
      defaultHeight: 200,
      minWidth: 200,
      minHeight: 200,
      lockAspectRatio: false
    }
  },
  
  [WIDGET_TYPES.LINK_SHORTENER]: {
    id: WIDGET_TYPES.LINK_SHORTENER,
    name: 'shortenLink',
    displayName: 'Link Shortener',
    category: WidgetCategory.STANDALONE,
    componentPath: 'shortenLink',
    description: 'URL shortening service',
    features: {
      requiresApiKey: true,
      isResizable: true
    },
    layout: {
      defaultWidth: 350,
      defaultHeight: 350,
      minWidth: 200,
      minHeight: 200,
      lockAspectRatio: true
    }
  },
  
  [WIDGET_TYPES.TEXT_BANNER]: {
    id: WIDGET_TYPES.TEXT_BANNER,
    name: 'textBanner',
    displayName: 'Text Banner',
    category: WidgetCategory.STANDALONE,
    componentPath: 'textBanner',
    description: 'Customizable text display',
    features: {
      hasSettings: true,
      hasStateManagement: true,
      isResizable: true
    },
    layout: {
      defaultWidth: 500,
      defaultHeight: 200,
      minWidth: 200,
      minHeight: 80,
      lockAspectRatio: false
    }
  },
  
  [WIDGET_TYPES.IMAGE_DISPLAY]: {
    id: WIDGET_TYPES.IMAGE_DISPLAY,
    name: 'imageDisplay',
    displayName: 'Image Display',
    category: WidgetCategory.STANDALONE,
    componentPath: 'imageDisplay',
    description: 'Image viewer widget',
    features: {
      hasSettings: true,
      hasStateManagement: true,
      isResizable: true
    },
    layout: {
      defaultWidth: 350,
      defaultHeight: 350,
      minWidth: 200,
      minHeight: 200,
      lockAspectRatio: false
    }
  },
  
  [WIDGET_TYPES.SOUND_EFFECTS]: {
    id: WIDGET_TYPES.SOUND_EFFECTS,
    name: 'soundEffects',
    displayName: 'Sound Effects',
    category: WidgetCategory.STANDALONE,
    componentPath: 'soundEffects',
    description: 'Sound effect player',
    features: {
      hasAudioPlayback: true,
      isResizable: true
    },
    layout: {
      defaultWidth: 80,
      defaultHeight: 420,
      minWidth: 80,
      minHeight: 200,
      lockAspectRatio: false
    }
  },
  
  [WIDGET_TYPES.STAMP]: {
    id: WIDGET_TYPES.STAMP,
    name: 'sticker',
    displayName: 'Sticker',
    category: WidgetCategory.DECORATIVE,
    componentPath: 'sticker',
    description: 'Decorative stickers',
    features: {
      isResizable: true
    },
    layout: {
      defaultWidth: 120,
      defaultHeight: 120,
      minWidth: 60,
      minHeight: 60,
      lockAspectRatio: true
    }
  },
  
  [WIDGET_TYPES.QRCODE]: {
    id: WIDGET_TYPES.QRCODE,
    name: 'qrcode',
    displayName: 'QR Code',
    category: WidgetCategory.STANDALONE,
    componentPath: 'qrcode',
    description: 'QR code generator',
    features: {
      hasSettings: true,
      hasStateManagement: true,
      isResizable: true
    },
    layout: {
      defaultWidth: 350,
      defaultHeight: 400,
      minWidth: 250,
      minHeight: 300,
      lockAspectRatio: false
    }
  },
  
  [WIDGET_TYPES.VISUALISER]: {
    id: WIDGET_TYPES.VISUALISER,
    name: 'visualiser',
    displayName: 'Audio Visualiser',
    category: WidgetCategory.STANDALONE,
    componentPath: 'visualiser',
    description: 'Audio frequency visualization',
    features: {
      hasSettings: true,
      hasFaceDetection: true,
      isResizable: true
    },
    layout: {
      defaultWidth: 600,
      defaultHeight: 450,
      minWidth: 300,
      minHeight: 225,
      lockAspectRatio: false
    }
  },
  
  [WIDGET_TYPES.TIC_TAC_TOE]: {
    id: WIDGET_TYPES.TIC_TAC_TOE,
    name: 'TicTacToe',
    displayName: 'Tic Tac Toe',
    category: WidgetCategory.STANDALONE,
    componentPath: 'TicTacToe',
    description: 'Classic tic-tac-toe game',
    features: {
      hasSettings: true,
      hasStateManagement: true,
      isResizable: true
    },
    layout: {
      defaultWidth: 350,
      defaultHeight: 400,
      minWidth: 300,
      minHeight: 350,
      maxWidth: 500,
      maxHeight: 550,
      lockAspectRatio: false
    }
  },
  
  // NETWORKED WIDGETS
  [WIDGET_TYPES.POLL]: {
    id: WIDGET_TYPES.POLL,
    name: 'Poll',
    displayName: 'Poll',
    category: WidgetCategory.NETWORKED,
    componentPath: 'poll',
    description: 'Real-time polling with student participation',
    features: {
      hasSettings: true,
      hasStateManagement: true,
      isResizable: true
    },
    layout: {
      defaultWidth: 400,
      defaultHeight: 450,
      minWidth: 300,
      minHeight: 350,
      lockAspectRatio: false
    },
    networked: {
      roomType: 'poll' as RoomType,
      hasStartStop: true,
      startsActive: false,
      studentComponentName: 'PollActivity'
    }
  },
  
  [WIDGET_TYPES.LINK_SHARE]: {
    id: WIDGET_TYPES.LINK_SHARE,
    name: 'LinkShare',
    displayName: 'Link Share',
    category: WidgetCategory.NETWORKED,
    componentPath: 'linkShare',
    description: 'Collect link submissions from students',
    features: {
      hasStateManagement: true,
      isResizable: true
    },
    layout: {
      defaultWidth: 450,
      defaultHeight: 500,
      minWidth: 350,
      minHeight: 400,
      lockAspectRatio: false
    },
    networked: {
      roomType: 'linkShare' as RoomType,
      hasStartStop: false,
      startsActive: true,
      studentComponentName: 'LinkShareActivity'
    }
  },
  
  [WIDGET_TYPES.RT_FEEDBACK]: {
    id: WIDGET_TYPES.RT_FEEDBACK,
    name: 'RTFeedback',
    displayName: 'RT Feedback',
    category: WidgetCategory.NETWORKED,
    componentPath: 'rtFeedback',
    description: 'Real-time feedback slider for student understanding',
    features: {
      hasStateManagement: true,
      isResizable: true
    },
    layout: {
      defaultWidth: 400,
      defaultHeight: 300,
      minWidth: 300,
      minHeight: 300,
      lockAspectRatio: false
    },
    networked: {
      roomType: 'rtfeedback' as RoomType,
      hasStartStop: true,
      startsActive: true,
      studentComponentName: 'RTFeedbackActivity'
    }
  },
  
  [WIDGET_TYPES.QUESTIONS]: {
    id: WIDGET_TYPES.QUESTIONS,
    name: 'Questions',
    displayName: 'Questions',
    category: WidgetCategory.NETWORKED,
    componentPath: 'questions',
    description: 'Q&A functionality with moderation',
    features: {
      hasStateManagement: true,
      isResizable: true
    },
    layout: {
      defaultWidth: 450,
      defaultHeight: 500,
      minWidth: 350,
      minHeight: 400,
      lockAspectRatio: false
    },
    networked: {
      roomType: 'questions' as RoomType,
      hasStartStop: true,
      startsActive: true,
      studentComponentName: 'QuestionsActivity'
    }
  }
};

// Helper functions
export const getWidget = (widgetId: number): WidgetDefinition | undefined => {
  return WIDGET_REGISTRY[widgetId];
};

export const getNetworkedWidgets = (): WidgetDefinition[] => {
  return Object.values(WIDGET_REGISTRY).filter(w => w.category === WidgetCategory.NETWORKED);
};

export const getNetworkedWidgetIds = (): number[] => {
  return getNetworkedWidgets().map(w => w.id);
};

export const isNetworkedWidget = (widgetId: number): boolean => {
  const widget = WIDGET_REGISTRY[widgetId];
  return widget?.category === WidgetCategory.NETWORKED;
};

export const getWidgetsByCategory = (category: WidgetCategory): WidgetDefinition[] => {
  return Object.values(WIDGET_REGISTRY).filter(w => w.category === category);
};

export const getAllWidgets = (): WidgetDefinition[] => {
  return Object.values(WIDGET_REGISTRY);
};

// Validation function to ensure widget implementation completeness
export const validateWidgetImplementation = (widgetId: number): string[] => {
  const errors: string[] = [];
  const widget = WIDGET_REGISTRY[widgetId];
  
  if (!widget) {
    errors.push(`Widget with ID ${widgetId} not found in registry`);
    return errors;
  }
  
  // Check if component path exists
  if (!widget.componentPath) {
    errors.push(`Widget ${widget.name} missing componentPath`);
  }
  
  // Check networked widget requirements
  if (widget.networked) {
    if (!widget.networked.roomType) {
      errors.push(`Networked widget ${widget.name} missing roomType`);
    }
    if (!widget.networked.studentComponentName) {
      errors.push(`Networked widget ${widget.name} missing studentComponentName`);
    }
  }
  
  return errors;
};