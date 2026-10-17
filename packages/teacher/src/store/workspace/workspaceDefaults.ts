import { WidgetType } from '@shared/types';
import type { BottomBarConfig } from '../workspaceStore';

// Default recent widgets shown in toolbar (most recent first)
const defaultRecentWidgets = [
  WidgetType.RANDOMISER,
  WidgetType.TIMER,
  WidgetType.LIST,
  WidgetType.TASK_CUE,
  WidgetType.TRAFFIC_LIGHT
];

export const defaultBottomBar = {
  visibleWidgets: [
    WidgetType.RANDOMISER,
    WidgetType.TIMER,
    WidgetType.LIST,
    WidgetType.TASK_CUE,
    WidgetType.TRAFFIC_LIGHT,
    WidgetType.POLL
  ],
  pinnedWidgets: [],
  showClock: true,
  showConnectionStatus: true,
  voiceControlEnabled: false,  // Alpha feature - default OFF
  recentWidgets: defaultRecentWidgets,  // Track recently launched widgets
  recentWidgetsLimit: 5  // Number of recent widgets to show in toolbar
} satisfies BottomBarConfig;
