import { WidgetType } from '@shared/types';
import { debug } from '@shared/utils/debug';
import { VOICE_WIDGET_TARGET_MAP } from '@shared/constants/voiceCommandDefinitions';
import { useWorkspaceStore } from '../../../../store/workspaceStore';
import { getDefaultPollQuestion } from '../../../widgets/poll/pollQuestions';
import type { ExecutionResult, VoiceCommand } from '../../types/voiceControl';
import { getViewportCenterPosition } from './widgetLookup';
import { errorMessage, numberParam, stringArrayParam, stringParam } from './commandParameters';

// The Traffic Light widget stores the lit colour, not its name
const TRAFFIC_LIGHT_COLOURS: Record<string, string> = {
  red: '#ff0000',
  yellow: '#ffa500',
  orange: '#ffa500',
  amber: '#ffa500',
  green: '#008000'
};

/** The Traffic Light state for a spoken colour, or null for an unknown one */
export const trafficLightState = (state: unknown): { activeLight: string } | null => {
  const activeLight = typeof state === 'string' ? TRAFFIC_LIGHT_COLOURS[state.toLowerCase()] : undefined;
  return activeLight ? { activeLight } : null;
};

/**
 * Generic widget creation helper
 */
export const createWidget = async (
  widgetType: WidgetType,
  actionName?: string
): Promise<ExecutionResult> => {
  try {
    const store = useWorkspaceStore.getState();

    // Get viewport center position
    const { x, y } = getViewportCenterPosition(widgetType);

    // Create widget
    const widgetId = store.addWidget(widgetType, { x, y });

    debug(`✅ Created ${widgetType} widget:`, widgetId);

    return {
      success: true,
      widgetId,
      action: actionName || 'CREATE_WIDGET'
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to create widget: ${errorMessage(error)}`
    };
  }
};

/** Create a widget, then seed its state (if any) when creation succeeded */
const createWidgetWithState = async (
  widgetType: WidgetType,
  actionName: string,
  initialState: Record<string, unknown> | null
): Promise<ExecutionResult> => {
  const widgetResult = await createWidget(widgetType, actionName);

  if (widgetResult.success && widgetResult.widgetId && initialState) {
    const store = useWorkspaceStore.getState();
    store.updateWidgetState(widgetResult.widgetId, initialState);
  }

  return widgetResult;
};

/**
 * Create a new timer widget
 */
export const createTimer = async (command: VoiceCommand): Promise<ExecutionResult> => {
  try {
    const store = useWorkspaceStore.getState();
    const duration = numberParam(command, 'duration') || 300; // Default 5 minutes

    // Get viewport center position
    const { x, y } = getViewportCenterPosition(WidgetType.TIMER);

    // Create timer widget
    const widgetId = store.addWidget(WidgetType.TIMER, { x, y });

    // Set initial state with duration
    store.updateWidgetState(widgetId, {
      initialDuration: duration,
      duration: duration
    });

    debug('✅ Created timer widget:', widgetId);

    return {
      success: true,
      widgetId,
      action: 'CREATE_TIMER'
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to create timer: ${errorMessage(error)}`
    };
  }
};

/**
 * Create a new list widget
 */
export const createList = async (command: VoiceCommand): Promise<ExecutionResult> => {
  try {
    const store = useWorkspaceStore.getState();
    const items = stringArrayParam(command, 'items') || [];

    // Get viewport center position
    const { x, y } = getViewportCenterPosition(WidgetType.LIST);

    // Create list widget
    const widgetId = store.addWidget(WidgetType.LIST, { x, y });

    // Set initial items if provided
    if (items.length > 0) {
      // The List widget's item shape: a missing status cycles to NaN
      const initialItems = items.map((item, index) => ({
        id: `item-${Date.now()}-${index}`,
        text: item,
        status: 0
      }));

      store.updateWidgetState(widgetId, {
        items: initialItems
      });
    }

    debug('✅ Created list widget:', widgetId);

    return {
      success: true,
      widgetId,
      action: 'CREATE_LIST'
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to create list: ${errorMessage(error)}`
    };
  }
};

/**
 * Create a new poll widget
 */
export const createPoll = async (command: VoiceCommand): Promise<ExecutionResult> => {
  try {
    const store = useWorkspaceStore.getState();
    const defaultPoll = getDefaultPollQuestion();
    const requestedOptions = stringArrayParam(command, 'options');
    const usesPlaceholderOptions = requestedOptions !== undefined &&
      requestedOptions.length > 0 &&
      requestedOptions.every((option) => /^Option \d+$/i.test(option.trim()));
    const options = requestedOptions === undefined || requestedOptions.length === 0 || usesPlaceholderOptions
      ? defaultPoll.options
      : requestedOptions;

    // Get viewport center position
    const { x, y } = getViewportCenterPosition(WidgetType.POLL);

    // Create poll widget
    const widgetId = store.addWidget(WidgetType.POLL, { x, y });

    // Set initial poll data, in the shape the Poll widget restores from
    store.updateWidgetState(widgetId, {
      pollData: {
        question: defaultPoll.question,
        options: [...options]
      }
    });

    debug('✅ Created poll widget:', widgetId);

    return {
      success: true,
      widgetId,
      action: 'CREATE_POLL'
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to create poll: ${errorMessage(error)}`
    };
  }
};

/**
 * Create Text Banner widget
 */
export const createTextBanner = (command: VoiceCommand): Promise<ExecutionResult> =>
  createWidgetWithState(WidgetType.TEXT_BANNER, 'CREATE_TEXT_BANNER', {
    text: stringParam(command, 'text') || 'Welcome'
  });

/**
 * Create Task Cue widget
 */
export const createTaskCue = (command: VoiceCommand): Promise<ExecutionResult> =>
  createWidgetWithState(WidgetType.TASK_CUE, 'CREATE_TASK_CUE', {
    mode: stringParam(command, 'mode') || 'individual'
  });

/**
 * Create Traffic Light widget
 */
export const createTrafficLight = (command: VoiceCommand): Promise<ExecutionResult> =>
  createWidgetWithState(WidgetType.TRAFFIC_LIGHT, 'CREATE_TRAFFIC_LIGHT',
    trafficLightState(stringParam(command, 'state') || 'red'));

/**
 * Launch a widget by name (generic launcher)
 * Uses auto-generated widget target map from shared definitions
 */
export const launchWidget = async (command: VoiceCommand): Promise<ExecutionResult> => {
  const widgetName = command.target.toLowerCase();

  // Use auto-generated map from shared definitions
  // This ensures frontend and backend stay in sync. The map already holds
  // resolved WidgetType values, so check against undefined rather than
  // falsiness - WidgetType.RANDOMISER is 0.
  const widgetType: WidgetType | undefined = VOICE_WIDGET_TARGET_MAP[widgetName];

  if (widgetType === undefined) {
    return {
      success: false,
      error: `Unknown widget type: ${widgetName}`
    };
  }

  return await createWidget(widgetType, 'LAUNCH_WIDGET');
};
