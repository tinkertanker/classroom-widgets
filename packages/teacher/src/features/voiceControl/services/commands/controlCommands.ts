import { WidgetType } from '@shared/types';
import { debug } from '@shared/utils/debug';
import { useWorkspaceStore } from '../../../../store/workspaceStore.simple';
import type { ExecutionResult, VoiceCommand } from '../../types/voiceControl';
import { findTargetWidget } from './widgetLookup';
import { errorMessage, stringParam } from './commandParameters';
import { createTrafficLight, createWidget, trafficLightState } from './createCommands';

// Commands that act on a widget already on the board

/**
 * Send a one-shot signal (reset, pause, stop) to the target timer
 */
const signalTimer = (
  signal: 'shouldReset' | 'shouldPause' | 'shouldStop',
  action: 'RESET_TIMER' | 'PAUSE_TIMER' | 'STOP_TIMER',
  verb: string,
  pastTense: string
): ExecutionResult => {
  try {
    const store = useWorkspaceStore.getState();
    const timerWidget = findTargetWidget(WidgetType.TIMER);

    if (!timerWidget) {
      return {
        success: false,
        error: `No timer found to ${verb}`
      };
    }

    store.updateWidgetState(timerWidget.id, {
      [signal]: true
    });

    debug(`✅ ${pastTense} timer widget:`, timerWidget.id);

    return {
      success: true,
      widgetId: timerWidget.id,
      action
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to ${verb} timer: ${errorMessage(error)}`
    };
  }
};

export const resetTimer = async (): Promise<ExecutionResult> =>
  signalTimer('shouldReset', 'RESET_TIMER', 'reset', 'Reset');

export const pauseTimer = async (): Promise<ExecutionResult> =>
  signalTimer('shouldPause', 'PAUSE_TIMER', 'pause', 'Paused');

export const stopTimer = async (): Promise<ExecutionResult> =>
  signalTimer('shouldStop', 'STOP_TIMER', 'stop', 'Stopped');

/**
 * Delete a timer widget
 */
export const deleteTimer = async (): Promise<ExecutionResult> => {
  try {
    const timerWidget = findTargetWidget(WidgetType.TIMER);

    if (!timerWidget) {
      return {
        success: false,
        error: 'No timer found to delete'
      };
    }

    // For now, we'll return success but note that delete functionality needs implementation
    debug('📝 Delete functionality not yet implemented for timer:', timerWidget.id);

    return {
      success: false,
      error: 'Delete functionality not yet implemented'
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to delete timer: ${errorMessage(error)}`
    };
  }
};

/**
 * Trigger randomiser
 */
export const randomise = async (): Promise<ExecutionResult> => {
  try {
    const store = useWorkspaceStore.getState();
    const randomiserWidget = findTargetWidget(WidgetType.RANDOMISER);

    if (!randomiserWidget) {
      // Create a new randomiser if none exists
      const centerX = 400;
      const centerY = 300;
      const widgetWidth = 350;
      const widgetHeight = 250;
      const x = centerX - widgetWidth / 2;
      const y = centerY - widgetHeight / 2;

      const widgetId = store.addWidget(WidgetType.RANDOMISER, { x, y });

      // Trigger randomisation
      store.updateWidgetState(widgetId, {
        shouldRandomise: true
      });

      debug('✅ Created and triggered randomiser widget:', widgetId);

      return {
        success: true,
        widgetId,
        action: 'CREATE_RANDOMISER'
      };
    }

    // Trigger randomisation on existing widget
    store.updateWidgetState(randomiserWidget.id, {
      shouldRandomise: true
    });

    debug('✅ Triggered randomiser widget:', randomiserWidget.id);

    return {
      success: true,
      widgetId: randomiserWidget.id,
      action: 'RANDOMISE'
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to randomise: ${errorMessage(error)}`
    };
  }
};

interface ActivationTarget {
  widgetType: WidgetType;
  action: string;
  isActive: boolean;
  // What to do when no widget of this type is on the board
  whenMissing: { error: string } | { createAction: string };
}

/**
 * Turn a networked widget's activity on or off. Some starts create the
 * widget when none exists yet.
 */
const setActivation = async ({ widgetType, action, isActive, whenMissing }: ActivationTarget): Promise<ExecutionResult> => {
  const widget = findTargetWidget(widgetType);
  if (!widget) {
    return 'error' in whenMissing
      ? { success: false, error: whenMissing.error }
      : await createWidget(widgetType, whenMissing.createAction);
  }

  const store = useWorkspaceStore.getState();
  store.updateWidgetState(widget.id, { isActive });

  return { success: true, widgetId: widget.id, action };
};

/** Start/activate a poll */
export const startPoll = () => setActivation({
  widgetType: WidgetType.POLL, action: 'START_POLL', isActive: true,
  whenMissing: { error: 'No poll found to start' }
});

/** Stop/pause a poll */
export const stopPoll = () => setActivation({
  widgetType: WidgetType.POLL, action: 'STOP_POLL', isActive: false,
  whenMissing: { error: 'No poll found to stop' }
});

/** Start/enable questions, creating the widget if there is none */
export const startQuestions = () => setActivation({
  widgetType: WidgetType.QUESTIONS, action: 'START_QUESTIONS', isActive: true,
  whenMissing: { createAction: 'CREATE_QUESTIONS' }
});

/** Stop/disable questions */
export const stopQuestions = () => setActivation({
  widgetType: WidgetType.QUESTIONS, action: 'STOP_QUESTIONS', isActive: false,
  whenMissing: { error: 'No questions widget found to stop' }
});

/** Start RT Feedback collection, creating the widget if there is none */
export const startRTFeedback = () => setActivation({
  widgetType: WidgetType.RT_FEEDBACK, action: 'START_RT_FEEDBACK', isActive: true,
  whenMissing: { createAction: 'CREATE_RT_FEEDBACK' }
});

/** Pause RT Feedback collection */
export const pauseRTFeedback = () => setActivation({
  widgetType: WidgetType.RT_FEEDBACK, action: 'PAUSE_RT_FEEDBACK', isActive: false,
  whenMissing: { error: 'No RT feedback widget found to pause' }
});

/**
 * Play a sound effect
 */
export const playSound = async (command: VoiceCommand): Promise<ExecutionResult> => {
  const soundWidget = findTargetWidget(WidgetType.SOUND_EFFECTS);
  if (!soundWidget) {
    return { success: false, error: 'No sound effects widget found' };
  }

  const soundName = stringParam(command, 'soundName');
  const store = useWorkspaceStore.getState();
  store.updateWidgetState(soundWidget.id, { playSound: soundName });

  return { success: true, widgetId: soundWidget.id, action: 'PLAY_SOUND' };
};

/**
 * Set Task Cue mode
 */
export const setTaskCueMode = async (command: VoiceCommand): Promise<ExecutionResult> => {
  const taskCueWidget = findTargetWidget(WidgetType.TASK_CUE);
  if (!taskCueWidget) {
    return { success: false, error: 'No task cue widget found' };
  }

  const mode = stringParam(command, 'mode');
  const store = useWorkspaceStore.getState();
  store.updateWidgetState(taskCueWidget.id, { mode });

  return { success: true, widgetId: taskCueWidget.id, action: 'SET_TASK_CUE_MODE' };
};

/**
 * Set Traffic Light state, creating the widget in that state if there is none
 */
export const setTrafficLight = async (command: VoiceCommand): Promise<ExecutionResult> => {
  const trafficLightWidget = findTargetWidget(WidgetType.TRAFFIC_LIGHT);
  if (!trafficLightWidget) {
    // Auto-create with the specified state
    return await createTrafficLight(command);
  }

  const lightState = trafficLightState(command.parameters?.state);
  if (!lightState) {
    return { success: false, error: `Unknown traffic light state: ${command.parameters?.state}` };
  }
  const store = useWorkspaceStore.getState();
  store.updateWidgetState(trafficLightWidget.id, lightState);

  return { success: true, widgetId: trafficLightWidget.id, action: 'SET_TRAFFIC_LIGHT' };
};
