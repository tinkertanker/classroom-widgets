// Migration utilities for transitioning from old to new architecture

import { WIDGET_TYPES } from '../constants/widgetTypes';
import { WidgetType, WidgetInstance, WorkspaceState, BackgroundType } from '../types';

// Map old widget types to new enum values
export function migrateWidgetType(oldType: number): WidgetType {
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
  
  return mapping[oldType] ?? WidgetType.RANDOMISER;
}

// Migrate old component list format to new widget instances
export function migrateComponentList(componentList: any[]): WidgetInstance[] {
  if (!Array.isArray(componentList)) return [];
  
  const widgets: WidgetInstance[] = [];
  const positions = new Map<string, any>();
  const sizes = new Map<string, any>();
  
  // First, extract positions and sizes from localStorage
  try {
    const savedPositions = localStorage.getItem('widgetPositions');
    const savedSizes = localStorage.getItem('widgetSizes');
    
    if (savedPositions) {
      const parsed = JSON.parse(savedPositions);
      Object.entries(parsed).forEach(([id, pos]) => {
        positions.set(id, pos);
      });
    }
    
    if (savedSizes) {
      const parsed = JSON.parse(savedSizes);
      Object.entries(parsed).forEach(([id, size]) => {
        sizes.set(id, size);
      });
    }
  } catch (error) {
    console.error('Error loading saved positions/sizes:', error);
  }
  
  // Convert old format to new
  componentList.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    
    const id = item.id || `widget-${Date.now()}-${index}`;
    const type = migrateWidgetType(item.index ?? item.type ?? 0);
    
    const widget: WidgetInstance = {
      id,
      type,
      position: positions.get(id) || { x: 0, y: 0 },
      size: sizes.get(id) || { width: 350, height: 350 },
      zIndex: index
    };
    
    widgets.push(widget);
  });
  
  return widgets;
}

// Migrate old background format
export function migrateBackground(oldBackground: any): BackgroundType {
  if (typeof oldBackground === 'string') {
    const mapping: Record<string, BackgroundType> = {
      'none': BackgroundType.NONE,
      'geometric': BackgroundType.GEOMETRIC,
      'gradient': BackgroundType.GRADIENT,
      'lines': BackgroundType.LINES,
      'dots': BackgroundType.DOTS
    };
    
    return mapping[oldBackground] ?? BackgroundType.NONE;
  }
  
  return BackgroundType.NONE;
}

// Migrate old workspace data
export function migrateWorkspace(oldData: any): Partial<WorkspaceState> {
  const workspace: Partial<WorkspaceState> = {};
  
  // Migrate widgets
  if (oldData.componentList) {
    workspace.widgets = migrateComponentList(oldData.componentList);
  }
  
  // Migrate background
  if (oldData.selectedBackground !== undefined) {
    workspace.background = migrateBackground(oldData.selectedBackground);
  }
  
  // Migrate theme
  if (oldData.darkMode !== undefined) {
    workspace.theme = oldData.darkMode ? 'dark' : 'light';
  } else if (oldData.theme) {
    workspace.theme = oldData.theme;
  }
  
  // Migrate scale
  if (oldData.scale !== undefined) {
    workspace.scale = oldData.scale;
  }
  
  return workspace;
}

// Migrate widget states
export function migrateWidgetStates(oldStates: any): Map<string, any> {
  const states = new Map<string, any>();
  
  if (!oldStates) return states;
  
  // Handle different storage formats
  if (oldStates instanceof Map) {
    return oldStates;
  }
  
  if (Array.isArray(oldStates)) {
    // Array of [id, state] pairs
    oldStates.forEach(([id, state]) => {
      if (id && state) {
        states.set(id, state);
      }
    });
  } else if (typeof oldStates === 'object') {
    // Plain object
    Object.entries(oldStates).forEach(([id, state]) => {
      if (id && state) {
        states.set(id, state);
      }
    });
  }
  
  return states;
}

// Main migration function
export function migrateFromOldFormat(): void {
  try {
    // Check if migration is needed
    const newFormatExists = localStorage.getItem('classroom-widgets-workspace');
    if (newFormatExists) {
      console.log('New format already exists, skipping migration');
      return;
    }
    
    // Load old format data
    const oldWorkspace = localStorage.getItem('widgetWorkspace');
    const oldStates = localStorage.getItem('widgetStates');
    const oldToolbar = localStorage.getItem('toolbarConfig');
    
    if (!oldWorkspace && !oldStates && !oldToolbar) {
      console.log('No old format data found, skipping migration');
      return;
    }
    
    // Prepare new format data
    const migratedData: any = {
      state: {
        widgets: [],
        background: BackgroundType.NONE,
        theme: 'light',
        scale: 1,
        scrollPosition: { x: 0, y: 0 }
      },
      version: 0
    };
    
    // Migrate workspace
    if (oldWorkspace) {
      try {
        const parsed = JSON.parse(oldWorkspace);
        const migrated = migrateWorkspace(parsed);
        Object.assign(migratedData.state, migrated);
      } catch (error) {
        console.error('Error migrating workspace:', error);
      }
    }
    
    // Migrate widget states
    if (oldStates) {
      try {
        const parsed = JSON.parse(oldStates);
        const migrated = migrateWidgetStates(parsed);
        migratedData.state.widgetStates = Array.from(migrated.entries());
      } catch (error) {
        console.error('Error migrating widget states:', error);
      }
    }
    
    // Migrate toolbar config
    if (oldToolbar) {
      try {
        const parsed = JSON.parse(oldToolbar);
        migratedData.state.toolbar = {
          visibleWidgets: parsed.visibleWidgets?.map(migrateWidgetType) || [],
          pinnedWidgets: parsed.pinnedWidgets?.map(migrateWidgetType) || [],
          showClock: parsed.showClock ?? true,
          showConnectionStatus: parsed.showConnectionStatus ?? true
        };
      } catch (error) {
        console.error('Error migrating toolbar config:', error);
      }
    }
    
    // Save in new format
    localStorage.setItem('classroom-widgets-workspace', JSON.stringify(migratedData));
    
    console.log('Migration completed successfully');
    
    // Optionally backup old data
    localStorage.setItem('widgetWorkspace_backup', oldWorkspace || '');
    localStorage.setItem('widgetStates_backup', oldStates || '');
    localStorage.setItem('toolbarConfig_backup', oldToolbar || '');
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
}