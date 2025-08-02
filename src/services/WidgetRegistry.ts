// Widget Registry - Single source of truth for all widget configurations

import { lazy } from 'react';
import { 
  FaClock, 
  FaListCheck, 
  FaDice, 
  FaTrafficLight,
  FaVolumeHigh,
  FaLink,
  FaFont,
  FaImage,
  FaMusic,
  FaHeart,
  FaChartColumn,
  FaQrcode,
  FaArrowUpRightFromSquare,
  FaVideo,
  FaSliders,
  FaGamepad,
  FaCircleQuestion,
  FaPersonChalkboard,
  FaSpellCheck
} from 'react-icons/fa6';

import { WidgetType, WidgetConfig, WidgetCategory, Size } from '../shared/types';
import { WIDGET_TYPES } from '../shared/constants/widgetTypes';

// Lazy load all widgets
const LazyWidgets = {
  Randomiser: lazy(() => import('../features/widgets/randomiser')),
  Timer: lazy(() => import('../features/widgets/timer')),
  List: lazy(() => import('../features/widgets/list')),
  TaskCue: lazy(() => import('../features/widgets/taskCue')),
  TrafficLight: lazy(() => import('../features/widgets/trafficLight')),
  AudioVolumeMonitor: lazy(() => import('../features/widgets/volumeLevel')),
  ShortenLink: lazy(() => import('../features/widgets/shortenLink')),
  TextBanner: lazy(() => import('../features/widgets/textBanner')),
  ImageDisplay: lazy(() => import('../features/widgets/imageDisplay')),
  SoundEffects: lazy(() => import('../features/widgets/soundEffects')),
  Sticker: lazy(() => import('../features/widgets/sticker')),
  Poll: lazy(() => import('../features/widgets/poll')),
  QRCodeWidget: lazy(() => import('../features/widgets/qrcode')),
  LinkShare: lazy(() => import('../features/widgets/linkShare')),
  Visualiser: lazy(() => import('../features/widgets/visualiser')),
  RTFeedback: lazy(() => import('../features/widgets/rtFeedback')),
  TicTacToe: lazy(() => import('../features/widgets/ticTacToe')),
  Questions: lazy(() => import('../features/widgets/questions')),
  Wordle: lazy(() => import('../features/widgets/wordle/wordle'))
};

// Default sizes for widgets
const DEFAULT_SIZE: Size = { width: 350, height: 350 };

// Widget Registry
export class WidgetRegistry {
  private static instance: WidgetRegistry;
  private widgets: Map<WidgetType, WidgetConfig>;

  private constructor() {
    this.widgets = new Map();
    this.initializeWidgets();
  }

  static getInstance(): WidgetRegistry {
    if (!WidgetRegistry.instance) {
      WidgetRegistry.instance = new WidgetRegistry();
    }
    return WidgetRegistry.instance;
  }

  private initializeWidgets(): void {
    // STANDALONE WIDGETS
    
    // Randomiser
    this.register({
      type: WidgetType.RANDOMISER,
      name: 'Randomiser',
      icon: FaDice,
      component: LazyWidgets.Randomiser,
      defaultSize: { width: 350, height: 250 },
      minSize: { width: 200, height: 150 },
      category: WidgetCategory.INTERACTIVE,
      description: 'Random selection with slot machine animation',
      features: {
        hasSettings: true,
        hasStateManagement: true,
        canTriggerConfetti: true,
        isResizable: true
      }
    });

    // Timer
    this.register({
      type: WidgetType.TIMER,
      name: 'Timer',
      icon: FaClock,
      component: LazyWidgets.Timer,
      defaultSize: { width: 350, height: 415 },
      minSize: { width: 250, height: 306 },
      maintainAspectRatio: true,
      category: WidgetCategory.TEACHING_TOOLS,
      description: 'Countdown and stopwatch functionality',
      features: {
        hasSettings: true,
        hasStateManagement: true,
        hasAudioPlayback: true,
        isResizable: true
      }
    });

    // List
    this.register({
      type: WidgetType.LIST,
      name: 'List',
      icon: FaListCheck,
      component: LazyWidgets.List,
      defaultSize: DEFAULT_SIZE,
      minSize: { width: 200, height: 200 },
      category: WidgetCategory.TEACHING_TOOLS,
      description: 'Task list with completion tracking',
      features: {
        hasSettings: true,
        hasStateManagement: true,
        canTriggerConfetti: true,
        isResizable: true
      }
    });

    // Task Cue
    this.register({
      type: WidgetType.TASK_CUE,
      name: 'Task Cue',
      icon: FaPersonChalkboard,
      component: LazyWidgets.TaskCue,
      defaultSize: { width: 325, height: 325 },
      minSize: { width: 325, height: 325 },
      maxSize: { width: 325, height: 325 },
      maintainAspectRatio: true,
      category: WidgetCategory.TEACHING_TOOLS,
      description: 'Visual work mode indicators',
      features: {
        isTransparent: true,
        hasSettings: true,
        hasStateManagement: true,
        isResizable: false
      }
    });

    // Traffic Light
    this.register({
      type: WidgetType.TRAFFIC_LIGHT,
      name: 'Traffic Light',
      icon: FaTrafficLight,
      component: LazyWidgets.TrafficLight,
      defaultSize: { width: 300, height: 175 },
      minSize: { width: 350, height: 150 },
      category: WidgetCategory.TEACHING_TOOLS,
      description: 'Status indicator lights',
      features: {
        hasSettings: true,
        hasStateManagement: true,
        isTransparent: true,
        isResizable: true
      }
    });

    // Volume Monitor
    this.register({
      type: WidgetType.SOUND_MONITOR,
      name: 'Volume Monitor',
      icon: FaVolumeHigh,
      component: LazyWidgets.AudioVolumeMonitor,
      defaultSize: { width: 315, height: 210 },
      minSize: { width: 315, height: 210 },
      maxSize: { width: 315, height: 210 },
      category: WidgetCategory.TEACHING_TOOLS,
      description: 'Audio level visualization',
      features: {
        hasSettings: true,
        isResizable: false
      }
    });

    // Link Shortener
    this.register({
      type: WidgetType.LINK_SHORTENER,
      name: 'Link Shortener',
      icon: FaLink,
      component: LazyWidgets.ShortenLink,
      defaultSize: DEFAULT_SIZE,
      minSize: { width: 200, height: 200 },
      maintainAspectRatio: true,
      category: WidgetCategory.TEACHING_TOOLS,
      description: 'URL shortening service',
      features: {
        requiresApiKey: true,
        isResizable: true
      }
    });

    // Text Banner
    this.register({
      type: WidgetType.TEXT_BANNER,
      name: 'Text Banner',
      icon: FaFont,
      component: LazyWidgets.TextBanner,
      defaultSize: { width: 400, height: 300 },
      minSize: { width: 200, height: 80 },
      category: WidgetCategory.TEACHING_TOOLS,
      description: 'Customizable text display',
      features: {
        hasSettings: true,
        hasStateManagement: true,
        isResizable: true
      }
    });

    // Image Display
    this.register({
      type: WidgetType.IMAGE_DISPLAY,
      name: 'Image',
      icon: FaImage,
      component: LazyWidgets.ImageDisplay,
      defaultSize: DEFAULT_SIZE,
      minSize: { width: 200, height: 200 },
      category: WidgetCategory.TEACHING_TOOLS,
      description: 'Image viewer widget',
      features: {
        hasSettings: true,
        hasStateManagement: true,
        isResizable: true
      }
    });

    // QR Code
    this.register({
      type: WidgetType.QRCODE,
      name: 'QR Code',
      icon: FaQrcode,
      component: LazyWidgets.QRCodeWidget,
      defaultSize: DEFAULT_SIZE,
      minSize: { width: 250, height: 300 },
      category: WidgetCategory.TEACHING_TOOLS,
      description: 'QR code generator',
      features: {
        hasSettings: true,
        hasStateManagement: true,
        isResizable: true
      }
    });

    // FUN WIDGETS

    // Sound Effects
    this.register({
      type: WidgetType.SOUND_EFFECTS,
      name: 'Sound Effects',
      icon: FaMusic,
      component: LazyWidgets.SoundEffects,
      defaultSize: { width: 80, height: 405 },
      minSize: { width: 80, height: 200 },
      category: WidgetCategory.FUN,
      description: 'Sound effect player',
      features: {
        hasAudioPlayback: true,
        isResizable: true
      }
    });

    // Sticker
    this.register({
      type: WidgetType.STAMP,
      name: 'Sticker',
      icon: FaHeart,
      component: LazyWidgets.Sticker,
      defaultSize: { width: 150, height: 150 },
      minSize: { width: 50, height: 50 },
      maxSize: { width: 400, height: 400 },
      maintainAspectRatio: true,
      category: WidgetCategory.FUN,
      description: 'Decorative stickers',
      features: {
        isResizable: true,
        isTransparent: true
      }
    });

    // Visualiser
    this.register({
      type: WidgetType.VISUALISER,
      name: 'Visualiser',
      icon: FaVideo,
      component: LazyWidgets.Visualiser,
      defaultSize: DEFAULT_SIZE,
      minSize: { width: 300, height: 225 },
      category: WidgetCategory.FUN,
      description: 'Audio frequency visualization',
      features: {
        hasSettings: true,
        hasFaceDetection: true,
        isResizable: true
      }
    });

    // Tic Tac Toe
    this.register({
      type: WidgetType.TIC_TAC_TOE,
      name: 'Tic Tac Toe',
      icon: FaGamepad,
      component: LazyWidgets.TicTacToe,
      defaultSize: { width: 350, height: 350 },
      minSize: { width: 350, height: 350 },
      maxSize: { width: 350, height: 350 },
      category: WidgetCategory.FUN,
      description: 'Classic tic-tac-toe game',
      features: {
        hasSettings: true,
        hasStateManagement: true,
        isResizable: false
      }
    });

    // Wordle
    this.register({
      type: WidgetType.WORDLE,
      name: 'Wordle',
      icon: FaSpellCheck,
      component: LazyWidgets.Wordle,
      defaultSize: { width: 350, height: 500 },
      minSize: { width: 300, height: 450 },
      maxSize: { width: 400, height: 600 },
      category: WidgetCategory.FUN,
      description: 'Daily word puzzle game',
      features: {
        hasStateManagement: true,
        isResizable: true
      }
    });

    // NETWORKED WIDGETS

    // Poll
    this.register({
      type: WidgetType.POLL,
      name: 'Poll',
      icon: FaChartColumn,
      component: LazyWidgets.Poll,
      defaultSize: { width: 400, height: 400 },
      minSize: { width: 300, height: 250 },
      maxSize: { width: 600, height: 800 },
      category: WidgetCategory.NETWORKED,
      description: 'Real-time polling with student participation',
      features: {
        hasSettings: true,
        hasStateManagement: true,
        isResizable: true
      },
      networked: {
        roomType: 'poll',
        hasStartStop: true,
        startsActive: false,
        studentComponentName: 'PollActivity'
      }
    });

    // Link Share
    this.register({
      type: WidgetType.LINK_SHARE,
      name: 'Link Share',
      icon: FaArrowUpRightFromSquare,
      component: LazyWidgets.LinkShare,
      defaultSize: DEFAULT_SIZE,
      minSize: { width: 350, height: 400 },
      category: WidgetCategory.NETWORKED,
      description: 'Collect link submissions from students',
      features: {
        hasStateManagement: true,
        isResizable: true
      },
      networked: {
        roomType: 'linkShare',
        hasStartStop: false,
        startsActive: true,
        studentComponentName: 'LinkShareActivity'
      }
    });

    // RT Feedback
    this.register({
      type: WidgetType.RT_FEEDBACK,
      name: 'RT Feedback',
      icon: FaSliders,
      component: LazyWidgets.RTFeedback,
      defaultSize: DEFAULT_SIZE,
      minSize: { width: 300, height: 300 },
      category: WidgetCategory.NETWORKED,
      description: 'Real-time feedback slider for student understanding',
      features: {
        hasStateManagement: true,
        isResizable: true
      },
      networked: {
        roomType: 'rtfeedback',
        hasStartStop: true,
        startsActive: true,
        studentComponentName: 'RTFeedbackActivity'
      }
    });

    // Questions
    this.register({
      type: WidgetType.QUESTIONS,
      name: 'Questions',
      icon: FaCircleQuestion,
      component: LazyWidgets.Questions,
      defaultSize: DEFAULT_SIZE,
      minSize: { width: 350, height: 400 },
      category: WidgetCategory.NETWORKED,
      description: 'Q&A functionality with moderation',
      features: {
        hasStateManagement: true,
        isResizable: true
      },
      networked: {
        roomType: 'questions',
        hasStartStop: true,
        startsActive: true,
        studentComponentName: 'QuestionsActivity'
      }
    });
  }

  private register(config: WidgetConfig): void {
    this.widgets.set(config.type, config);
  }

  get(type: WidgetType): WidgetConfig | undefined {
    return this.widgets.get(type);
  }

  getAll(): WidgetConfig[] {
    return Array.from(this.widgets.values());
  }

  getByCategory(category: WidgetCategory): WidgetConfig[] {
    return this.getAll().filter(widget => widget.category === category);
  }

  getIcon(type: WidgetType): React.ComponentType<any> | undefined {
    return this.get(type)?.icon;
  }

  getName(type: WidgetType): string {
    return this.get(type)?.name || 'Unknown Widget';
  }

  getComponent(type: WidgetType): React.ComponentType<any> | undefined {
    return this.get(type)?.component;
  }

  getDefaultSize(type: WidgetType): Size {
    return this.get(type)?.defaultSize || DEFAULT_SIZE;
  }

  getMinSize(type: WidgetType): Size | undefined {
    return this.get(type)?.minSize;
  }

  getMaxSize(type: WidgetType): Size | undefined {
    return this.get(type)?.maxSize;
  }

  isNetworked(type: WidgetType): boolean {
    return this.get(type)?.category === WidgetCategory.NETWORKED;
  }

  getNetworkedConfig(type: WidgetType) {
    return this.get(type)?.networked;
  }

  getRoomType(type: WidgetType): string | undefined {
    return this.get(type)?.networked?.roomType;
  }

  hasFeature(type: WidgetType, feature: keyof import('../shared/types').WidgetFeatures): boolean {
    return this.get(type)?.features?.[feature] || false;
  }

  getNetworkedWidgets(): WidgetConfig[] {
    return this.getByCategory(WidgetCategory.NETWORKED);
  }

  getWidgetsByFeature(feature: keyof import('../shared/types').WidgetFeatures): WidgetConfig[] {
    return this.getAll().filter(widget => widget.features?.[feature]);
  }

  // Legacy compatibility - map old numeric types to new enum
  fromLegacyType(legacyType: number): WidgetType | undefined {
    const mapping: Record<number, WidgetType> = {
      [WIDGET_TYPES.RANDOMISER]: WidgetType.RANDOMISER,
      [WIDGET_TYPES.TIMER]: WidgetType.TIMER,
      [WIDGET_TYPES.LIST]: WidgetType.LIST,
      [WIDGET_TYPES.TASK_CUE]: WidgetType.TASK_CUE,
      [WIDGET_TYPES.TRAFFIC_LIGHT]: WidgetType.TRAFFIC_LIGHT,
      [WIDGET_TYPES.SOUND_MONITOR]: WidgetType.SOUND_MONITOR,
      [WIDGET_TYPES.LINK_SHORTENER]: WidgetType.LINK_SHORTENER,
      [WIDGET_TYPES.TEXT_BANNER]: WidgetType.TEXT_BANNER,
      [WIDGET_TYPES.IMAGE_DISPLAY]: WidgetType.IMAGE_DISPLAY,
      [WIDGET_TYPES.SOUND_EFFECTS]: WidgetType.SOUND_EFFECTS,
      [WIDGET_TYPES.STAMP]: WidgetType.STAMP,
      [WIDGET_TYPES.POLL]: WidgetType.POLL,
      [WIDGET_TYPES.QRCODE]: WidgetType.QRCODE,
      [WIDGET_TYPES.LINK_SHARE]: WidgetType.LINK_SHARE,
      [WIDGET_TYPES.VISUALISER]: WidgetType.VISUALISER,
      [WIDGET_TYPES.RT_FEEDBACK]: WidgetType.RT_FEEDBACK,
      [WIDGET_TYPES.TIC_TAC_TOE]: WidgetType.TIC_TAC_TOE,
      [WIDGET_TYPES.QUESTIONS]: WidgetType.QUESTIONS,
      [WIDGET_TYPES.WORDLE]: WidgetType.WORDLE
    };
    return mapping[legacyType];
  }

  toLegacyType(type: WidgetType): number {
    const mapping: Record<WidgetType, number> = {
      [WidgetType.RANDOMISER]: WIDGET_TYPES.RANDOMISER,
      [WidgetType.TIMER]: WIDGET_TYPES.TIMER,
      [WidgetType.LIST]: WIDGET_TYPES.LIST,
      [WidgetType.TASK_CUE]: WIDGET_TYPES.TASK_CUE,
      [WidgetType.TRAFFIC_LIGHT]: WIDGET_TYPES.TRAFFIC_LIGHT,
      [WidgetType.SOUND_MONITOR]: WIDGET_TYPES.SOUND_MONITOR,
      [WidgetType.LINK_SHORTENER]: WIDGET_TYPES.LINK_SHORTENER,
      [WidgetType.TEXT_BANNER]: WIDGET_TYPES.TEXT_BANNER,
      [WidgetType.IMAGE_DISPLAY]: WIDGET_TYPES.IMAGE_DISPLAY,
      [WidgetType.SOUND_EFFECTS]: WIDGET_TYPES.SOUND_EFFECTS,
      [WidgetType.STAMP]: WIDGET_TYPES.STAMP,
      [WidgetType.POLL]: WIDGET_TYPES.POLL,
      [WidgetType.QRCODE]: WIDGET_TYPES.QRCODE,
      [WidgetType.LINK_SHARE]: WIDGET_TYPES.LINK_SHARE,
      [WidgetType.VISUALISER]: WIDGET_TYPES.VISUALISER,
      [WidgetType.RT_FEEDBACK]: WIDGET_TYPES.RT_FEEDBACK,
      [WidgetType.TIC_TAC_TOE]: WIDGET_TYPES.TIC_TAC_TOE,
      [WidgetType.QUESTIONS]: WIDGET_TYPES.QUESTIONS,
      [WidgetType.WORDLE]: WIDGET_TYPES.WORDLE
    };
    return mapping[type];
  }
}

// Export singleton instance
export const widgetRegistry = WidgetRegistry.getInstance();