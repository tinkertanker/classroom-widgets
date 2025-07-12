import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { WidgetInstance, WidgetPosition, BackgroundType } from '../types/app.types';
import { v4 as uuidv4 } from 'uuid';
import { findAvailablePosition } from '../utils/widgetHelpers';
import { getWidgetConfig } from '../constants/widgetConfigs';

// State types
interface WorkspaceState {
  widgets: WidgetInstance[];
  widgetPositions: Map<string, WidgetPosition>;
  widgetStates: Map<string, any>;
  activeWidgetId: string | null;
  backgroundType: BackgroundType;
  stickerMode: boolean;
  selectedStickerType: string;
}

// Action types
type WorkspaceAction =
  | { type: 'ADD_WIDGET'; payload: { widgetType: number; stickerType?: string } }
  | { type: 'REMOVE_WIDGET'; payload: { widgetId: string } }
  | { type: 'UPDATE_WIDGET_POSITION'; payload: { widgetId: string; position: WidgetPosition } }
  | { type: 'UPDATE_WIDGET_STATE'; payload: { widgetId: string; state: any } }
  | { type: 'SET_ACTIVE_WIDGET'; payload: { widgetId: string | null } }
  | { type: 'SET_BACKGROUND'; payload: { backgroundType: BackgroundType } }
  | { type: 'SET_STICKER_MODE'; payload: { enabled: boolean; stickerType?: string } }
  | { type: 'LOAD_WORKSPACE'; payload: Partial<WorkspaceState> }
  | { type: 'RESET_WORKSPACE' };

// Initial state
const initialState: WorkspaceState = {
  widgets: [],
  widgetPositions: new Map(),
  widgetStates: new Map(),
  activeWidgetId: null,
  backgroundType: 'geometric',
  stickerMode: false,
  selectedStickerType: 'heart'
};

// Reducer
function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'ADD_WIDGET': {
      const { widgetType, stickerType } = action.payload;
      const newId = uuidv4();
      const config = getWidgetConfig(widgetType, stickerType || null);
      
      const position = findAvailablePosition(
        config.defaultWidth,
        config.defaultHeight,
        state.widgetPositions
      );

      return {
        ...state,
        widgets: [...state.widgets, { id: newId, index: widgetType }],
        widgetPositions: new Map(state.widgetPositions).set(newId, {
          ...position,
          width: config.defaultWidth,
          height: config.defaultHeight
        }),
        activeWidgetId: newId
      };
    }

    case 'REMOVE_WIDGET': {
      const { widgetId } = action.payload;
      const newPositions = new Map(state.widgetPositions);
      const newStates = new Map(state.widgetStates);
      newPositions.delete(widgetId);
      newStates.delete(widgetId);

      return {
        ...state,
        widgets: state.widgets.filter(w => w.id !== widgetId),
        widgetPositions: newPositions,
        widgetStates: newStates,
        activeWidgetId: state.activeWidgetId === widgetId ? null : state.activeWidgetId
      };
    }

    case 'UPDATE_WIDGET_POSITION': {
      const { widgetId, position } = action.payload;
      return {
        ...state,
        widgetPositions: new Map(state.widgetPositions).set(widgetId, position)
      };
    }

    case 'UPDATE_WIDGET_STATE': {
      const { widgetId, state: widgetState } = action.payload;
      return {
        ...state,
        widgetStates: new Map(state.widgetStates).set(widgetId, widgetState)
      };
    }

    case 'SET_ACTIVE_WIDGET': {
      return {
        ...state,
        activeWidgetId: action.payload.widgetId
      };
    }

    case 'SET_BACKGROUND': {
      return {
        ...state,
        backgroundType: action.payload.backgroundType
      };
    }

    case 'SET_STICKER_MODE': {
      return {
        ...state,
        stickerMode: action.payload.enabled,
        selectedStickerType: action.payload.stickerType || state.selectedStickerType
      };
    }

    case 'LOAD_WORKSPACE': {
      return {
        ...state,
        ...action.payload
      };
    }

    case 'RESET_WORKSPACE': {
      return {
        ...initialState,
        backgroundType: state.backgroundType // Preserve background preference
      };
    }

    default:
      return state;
  }
}

// Context
interface WorkspaceContextValue {
  state: WorkspaceState;
  addWidget: (widgetType: number, stickerType?: string) => void;
  removeWidget: (widgetId: string) => void;
  updateWidgetPosition: (widgetId: string, position: WidgetPosition) => void;
  updateWidgetState: (widgetId: string, state: any) => void;
  setActiveWidget: (widgetId: string | null) => void;
  setBackground: (backgroundType: BackgroundType) => void;
  setStickerMode: (enabled: boolean, stickerType?: string) => void;
  loadWorkspace: (data: Partial<WorkspaceState>) => void;
  resetWorkspace: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

// Provider component
export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(workspaceReducer, initialState);

  // Action creators
  const addWidget = useCallback((widgetType: number, stickerType?: string) => {
    dispatch({ type: 'ADD_WIDGET', payload: { widgetType, stickerType } });
  }, []);

  const removeWidget = useCallback((widgetId: string) => {
    dispatch({ type: 'REMOVE_WIDGET', payload: { widgetId } });
  }, []);

  const updateWidgetPosition = useCallback((widgetId: string, position: WidgetPosition) => {
    dispatch({ type: 'UPDATE_WIDGET_POSITION', payload: { widgetId, position } });
  }, []);

  const updateWidgetState = useCallback((widgetId: string, state: any) => {
    dispatch({ type: 'UPDATE_WIDGET_STATE', payload: { widgetId, state } });
  }, []);

  const setActiveWidget = useCallback((widgetId: string | null) => {
    dispatch({ type: 'SET_ACTIVE_WIDGET', payload: { widgetId } });
  }, []);

  const setBackground = useCallback((backgroundType: BackgroundType) => {
    dispatch({ type: 'SET_BACKGROUND', payload: { backgroundType } });
  }, []);

  const setStickerMode = useCallback((enabled: boolean, stickerType?: string) => {
    dispatch({ type: 'SET_STICKER_MODE', payload: { enabled, stickerType } });
  }, []);

  const loadWorkspace = useCallback((data: Partial<WorkspaceState>) => {
    dispatch({ type: 'LOAD_WORKSPACE', payload: data });
  }, []);

  const resetWorkspace = useCallback(() => {
    dispatch({ type: 'RESET_WORKSPACE' });
  }, []);

  const value: WorkspaceContextValue = {
    state,
    addWidget,
    removeWidget,
    updateWidgetPosition,
    updateWidgetState,
    setActiveWidget,
    setBackground,
    setStickerMode,
    loadWorkspace,
    resetWorkspace
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
};

// Hook to use workspace context
export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};

// Export reducer for testing
export { workspaceReducer };