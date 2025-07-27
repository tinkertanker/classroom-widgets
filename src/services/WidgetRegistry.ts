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
  FaWaveSquare,
  FaSliders,
  FaGamepad,
  FaCircleQuestion,
  FaPersonChalkboard
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
  Questions: lazy(() => import('../features/widgets/questions'))
};

// Default sizes for widgets
const DEFAULT_SIZE: Size = { width: 350, height: 350 };
const SIZES = {
  small: { width: 250, height: 250 },
  medium: DEFAULT_SIZE,
  large: { width: 450, height: 450 },
  landscape: { width: 350, height: 250 },
  portrait: { width: 250, height: 350 },
  wide: { width: 400, height: 300 },
  tall: { width: 300, height: 400 },
  soundEffects: { width: 80, height: 420 },
  trafficLight: { width: 300, height: 175 },
  timer: { width: 350, height: 415 },
  volumeMonitor: { width: 315, height: 210 },
  poll: { width: 400, height: 340 },
  ticTacToe: { width: 350, height: 350 },
  taskCue: { width: 325, height: 325 }
};

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
    // Interactive Widgets
    this.register({
      type: WidgetType.RANDOMISER,
      name: 'Randomiser',
      icon: FaDice,
      component: LazyWidgets.Randomiser,
      defaultSize: SIZES.landscape,
      category: WidgetCategory.INTERACTIVE
    });

    this.register({
      type: WidgetType.TIMER,
      name: 'Timer',
      icon: FaClock,
      component: LazyWidgets.Timer,
      defaultSize: SIZES.timer,
      maintainAspectRatio: true,
      category: WidgetCategory.TEACHING_TOOLS
    });

    this.register({
      type: WidgetType.LIST,
      name: 'List',
      icon: FaListCheck,
      component: LazyWidgets.List,
      defaultSize: DEFAULT_SIZE,
      category: WidgetCategory.TEACHING_TOOLS
    });

    this.register({
      type: WidgetType.TASK_CUE,
      name: 'Task Cue',
      icon: FaPersonChalkboard,
      component: LazyWidgets.TaskCue,
      defaultSize: SIZES.taskCue,
      minSize: SIZES.taskCue,
      maxSize: SIZES.taskCue,
      category: WidgetCategory.TEACHING_TOOLS
    });

    this.register({
      type: WidgetType.TRAFFIC_LIGHT,
      name: 'Traffic Light',
      icon: FaTrafficLight,
      component: LazyWidgets.TrafficLight,
      defaultSize: SIZES.trafficLight,
      category: WidgetCategory.TEACHING_TOOLS
    });

    this.register({
      type: WidgetType.SOUND_MONITOR,
      name: 'Volume Monitor',
      icon: FaVolumeHigh,
      component: LazyWidgets.AudioVolumeMonitor,
      defaultSize: SIZES.volumeMonitor,
      minSize: SIZES.volumeMonitor,
      maxSize: SIZES.volumeMonitor,
      category: WidgetCategory.TEACHING_TOOLS
    });

    this.register({
      type: WidgetType.LINK_SHORTENER,
      name: 'Link Shortener',
      icon: FaLink,
      component: LazyWidgets.ShortenLink,
      defaultSize: DEFAULT_SIZE,
      category: WidgetCategory.TEACHING_TOOLS
    });

    this.register({
      type: WidgetType.TEXT_BANNER,
      name: 'Text Banner',
      icon: FaFont,
      component: LazyWidgets.TextBanner,
      defaultSize: SIZES.wide,
      category: WidgetCategory.TEACHING_TOOLS
    });

    this.register({
      type: WidgetType.IMAGE_DISPLAY,
      name: 'Image',
      icon: FaImage,
      component: LazyWidgets.ImageDisplay,
      defaultSize: DEFAULT_SIZE,
      category: WidgetCategory.TEACHING_TOOLS
    });

    this.register({
      type: WidgetType.QRCODE,
      name: 'QR Code',
      icon: FaQrcode,
      component: LazyWidgets.QRCodeWidget,
      defaultSize: DEFAULT_SIZE,
      category: WidgetCategory.TEACHING_TOOLS
    });

    // Fun Widgets
    this.register({
      type: WidgetType.SOUND_EFFECTS,
      name: 'Sound Effects',
      icon: FaMusic,
      component: LazyWidgets.SoundEffects,
      defaultSize: SIZES.soundEffects,
      category: WidgetCategory.FUN
    });

    this.register({
      type: WidgetType.STAMP,
      name: 'Sticker',
      icon: FaHeart,
      component: LazyWidgets.Sticker,
      defaultSize: { width: 150, height: 150 },
      minSize: { width: 50, height: 50 },
      maxSize: { width: 400, height: 400 },
      category: WidgetCategory.FUN
    });

    this.register({
      type: WidgetType.VISUALISER,
      name: 'Visualiser',
      icon: FaWaveSquare,
      component: LazyWidgets.Visualiser,
      defaultSize: DEFAULT_SIZE,
      category: WidgetCategory.FUN
    });

    this.register({
      type: WidgetType.TIC_TAC_TOE,
      name: 'Tic Tac Toe',
      icon: FaGamepad,
      component: LazyWidgets.TicTacToe,
      defaultSize: SIZES.ticTacToe,
      minSize: SIZES.ticTacToe,
      maxSize: SIZES.ticTacToe,
      category: WidgetCategory.FUN
    });

    // Networked Widgets
    this.register({
      type: WidgetType.POLL,
      name: 'Poll',
      icon: FaChartColumn,
      component: LazyWidgets.Poll,
      defaultSize: SIZES.poll,
      minSize: { width: 300, height: 250 },
      category: WidgetCategory.NETWORKED
    });

    this.register({
      type: WidgetType.LINK_SHARE,
      name: 'Link Share',
      icon: FaArrowUpRightFromSquare,
      component: LazyWidgets.LinkShare,
      defaultSize: DEFAULT_SIZE,
      category: WidgetCategory.NETWORKED
    });

    this.register({
      type: WidgetType.RT_FEEDBACK,
      name: 'RT Feedback',
      icon: FaSliders,
      component: LazyWidgets.RTFeedback,
      defaultSize: DEFAULT_SIZE,
      category: WidgetCategory.NETWORKED
    });

    this.register({
      type: WidgetType.QUESTIONS,
      name: 'Questions',
      icon: FaCircleQuestion,
      component: LazyWidgets.Questions,
      defaultSize: DEFAULT_SIZE,
      category: WidgetCategory.NETWORKED
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

  isNetworked(type: WidgetType): boolean {
    return this.get(type)?.category === WidgetCategory.NETWORKED;
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
      [WIDGET_TYPES.QUESTIONS]: WidgetType.QUESTIONS
    };
    return mapping[legacyType];
  }
}

// Export singleton instance
export const widgetRegistry = WidgetRegistry.getInstance();