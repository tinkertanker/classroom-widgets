import { VoiceCommandResponse, ExecutionResult } from '../types/voiceControl';
import { WidgetType } from '../../../shared/types';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';
import { debug } from '../../../shared/utils/debug';
import { VOICE_WIDGET_TARGET_MAP } from '../../../shared/constants/voiceCommandDefinitions';
import { widgetRegistry } from '../../../services/WidgetRegistry';

/**
 * Helper Functions for Widget Lookup
 * These functions get fresh state each time to avoid stale references
 */

// Get viewport center position for new widgets
const getViewportCenterPosition = (widgetType: WidgetType): { x: number; y: number } => {
  const scrollContainer = document.querySelector('.board-scroll-container') as HTMLElement;
  const scale = useWorkspaceStore.getState().scale || 1;

  if (!scrollContainer) {
    debug.warn('Could not find scroll container, using default position');
    return { x: 400, y: 300 };
  }

  const scrollRect = scrollContainer.getBoundingClientRect();

  // Calculate center position relative to the board
  const centerX = (scrollContainer.scrollLeft + scrollRect.width / 2) / scale;
  const centerY = (scrollContainer.scrollTop + scrollRect.height / 2) / scale;

  // Get widget size from registry
  const widgetConfig = widgetRegistry.get(widgetType);
  const widgetWidth = widgetConfig?.defaultSize.width || 350;
  const widgetHeight = widgetConfig?.defaultSize.height || 350;

  // Adjust position to center the widget
  const x = centerX - widgetWidth / 2;
  const y = centerY - widgetHeight / 2;

  debug('📍 Calculated viewport center position:', { x, y, centerX, centerY, widgetWidth, widgetHeight });

  return { x, y };
};

// Generic widget finder
const findWidgetByType = (type: WidgetType, preferFocused = true) => {
  const store = useWorkspaceStore.getState();

  if (preferFocused && store.focusedWidgetId) {
    const focusedWidget = store.widgets.find(w => w.id === store.focusedWidgetId);
    if (focusedWidget?.type === type) return focusedWidget;
  }

  return store.widgets.find(w => w.type === type) || null;
};

// Specific widget finders (for backwards compatibility)
const findFocusedTimer = () => findWidgetByType(WidgetType.TIMER, true);
const findAnyTimer = () => findWidgetByType(WidgetType.TIMER, false);
const findFocusedRandomiser = () => findWidgetByType(WidgetType.RANDOMISER, true);
const findAnyRandomiser = () => findWidgetByType(WidgetType.RANDOMISER, false);

// Poll widget finders
const findFocusedPoll = () => findWidgetByType(WidgetType.POLL, true);
const findAnyPoll = () => findWidgetByType(WidgetType.POLL, false);

// Questions widget finders
const findFocusedQuestions = () => findWidgetByType(WidgetType.QUESTIONS, true);
const findAnyQuestions = () => findWidgetByType(WidgetType.QUESTIONS, false);

// RT Feedback widget finders
const findFocusedRTFeedback = () => findWidgetByType(WidgetType.RT_FEEDBACK, true);
const findAnyRTFeedback = () => findWidgetByType(WidgetType.RT_FEEDBACK, false);

// Task Cue widget finders
const findFocusedTaskCue = () => findWidgetByType(WidgetType.TASK_CUE, true);
const findAnyTaskCue = () => findWidgetByType(WidgetType.TASK_CUE, false);

// Traffic Light widget finders
const findFocusedTrafficLight = () => findWidgetByType(WidgetType.TRAFFIC_LIGHT, true);
const findAnyTrafficLight = () => findWidgetByType(WidgetType.TRAFFIC_LIGHT, false);

// Sound Effects widget finders
const findFocusedSoundEffects = () => findWidgetByType(WidgetType.SOUND_EFFECTS, true);
const findAnySoundEffects = () => findWidgetByType(WidgetType.SOUND_EFFECTS, false);

export class VoiceCommandExecutor {
  /**
   * Execute a voice command
   */
  async executeCommand(commandResponse: VoiceCommandResponse): Promise<ExecutionResult> {
    const { command } = commandResponse;
    debug('🎯 Executing voice command:', command);

    try {
      switch (command.action) {
        // ===== TIMER COMMANDS =====
        case 'CREATE_TIMER':
          return await this.executeCreateTimer(command);
        case 'RESET_TIMER':
          return await this.executeResetTimer(command);
        case 'PAUSE_TIMER':
          return await this.executePauseTimer(command);
        case 'STOP_TIMER':
          return await this.executeStopTimer(command);
        case 'DELETE_TIMER':
          return await this.executeDeleteTimer(command);

        // ===== RANDOMISER COMMANDS =====
        case 'RANDOMISE':
        case 'TRIGGER_RANDOMISER':
          return await this.executeRandomise(command);
        case 'CREATE_RANDOMISER':
          return await this.executeCreateRandomiser(command);

        // ===== LIST COMMANDS =====
        case 'CREATE_LIST':
          return await this.executeCreateList(command);

        // ===== POLL COMMANDS =====
        case 'CREATE_POLL':
          return await this.executeCreatePoll(command);
        case 'START_POLL':
          return await this.executeStartPoll(command);
        case 'STOP_POLL':
          return await this.executeStopPoll(command);

        // ===== QUESTIONS COMMANDS =====
        case 'CREATE_QUESTIONS':
          return await this.executeCreateQuestions(command);
        case 'START_QUESTIONS':
          return await this.executeStartQuestions(command);
        case 'STOP_QUESTIONS':
          return await this.executeStopQuestions(command);

        // ===== RT FEEDBACK COMMANDS =====
        case 'CREATE_RT_FEEDBACK':
          return await this.executeCreateRTFeedback(command);
        case 'START_RT_FEEDBACK':
          return await this.executeStartRTFeedback(command);
        case 'PAUSE_RT_FEEDBACK':
          return await this.executePauseRTFeedback(command);

        // ===== LINK SHARE COMMANDS =====
        case 'CREATE_LINK_SHARE':
          return await this.executeCreateLinkShare(command);

        // ===== TEXT BANNER COMMANDS =====
        case 'CREATE_TEXT_BANNER':
          return await this.executeCreateTextBanner(command);

        // ===== SOUND EFFECTS COMMANDS =====
        case 'CREATE_SOUND_EFFECTS':
          return await this.executeCreateSoundEffects(command);
        case 'PLAY_SOUND':
          return await this.executePlaySound(command);

        // ===== TASK CUE COMMANDS =====
        case 'CREATE_TASK_CUE':
          return await this.executeCreateTaskCue(command);
        case 'SET_TASK_CUE_MODE':
          return await this.executeSetTaskCueMode(command);

        // ===== TRAFFIC LIGHT COMMANDS =====
        case 'CREATE_TRAFFIC_LIGHT':
          return await this.executeCreateTrafficLight(command);
        case 'SET_TRAFFIC_LIGHT':
          return await this.executeSetTrafficLight(command);

        // ===== OTHER WIDGET CREATE COMMANDS =====
        case 'CREATE_IMAGE_DISPLAY':
          return await this.executeCreateWidget(WidgetType.IMAGE_DISPLAY, command);
        case 'CREATE_QRCODE':
          return await this.executeCreateWidget(WidgetType.QRCODE, command);
        case 'CREATE_STICKER':
          return await this.executeCreateWidget(WidgetType.STAMP, command);
        case 'CREATE_VISUALISER':
          return await this.executeCreateWidget(WidgetType.VISUALISER, command);
        case 'CREATE_VOLUME_MONITOR':
          return await this.executeCreateWidget(WidgetType.SOUND_MONITOR, command);
        case 'CREATE_LINK_SHORTENER':
          return await this.executeCreateWidget(WidgetType.LINK_SHORTENER, command);
        case 'CREATE_TIC_TAC_TOE':
          return await this.executeCreateWidget(WidgetType.TIC_TAC_TOE, command);
        case 'CREATE_WORDLE':
          return await this.executeCreateWidget(WidgetType.WORDLE, command);
        case 'CREATE_SNAKE':
          return await this.executeCreateWidget(WidgetType.SNAKE, command);

        // ===== GENERIC LAUNCH COMMAND =====
        case 'LAUNCH_WIDGET':
          return await this.executeLaunchWidget(command);

        case 'UNKNOWN':
        default:
          return {
            success: false,
            error: `Unknown command: ${command.action}`
          };
      }
    } catch (error) {
      debug.error('Command execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Command execution failed'
      };
    }
  }

  /**
   * Create a new timer widget
   */
  private async executeCreateTimer(command: any): Promise<ExecutionResult> {
    try {
      const store = useWorkspaceStore.getState();
      const duration = command.parameters.duration || 300; // Default 5 minutes

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
        error: `Failed to create timer: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Reset an existing timer
   */
  private async executeResetTimer(command: any): Promise<ExecutionResult> {
    try {
      const store = useWorkspaceStore.getState();
      const timerWidget = findFocusedTimer() || findAnyTimer();

      if (!timerWidget) {
        return {
          success: false,
          error: 'No timer found to reset'
        };
      }

      // Reset timer state
      store.updateWidgetState(timerWidget.id, {
        shouldReset: true
      });

      debug('✅ Reset timer widget:', timerWidget.id);

      return {
        success: true,
        widgetId: timerWidget.id,
        action: 'RESET_TIMER'
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to reset timer: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Pause a timer
   */
  private async executePauseTimer(command: any): Promise<ExecutionResult> {
    try {
      const store = useWorkspaceStore.getState();
      const timerWidget = findFocusedTimer() || findAnyTimer();

      if (!timerWidget) {
        return {
          success: false,
          error: 'No timer found to pause'
        };
      }

      // Pause timer state
      store.updateWidgetState(timerWidget.id, {
        shouldPause: true
      });

      debug('✅ Paused timer widget:', timerWidget.id);

      return {
        success: true,
        widgetId: timerWidget.id,
        action: 'PAUSE_TIMER'
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to pause timer: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Stop a timer
   */
  private async executeStopTimer(command: any): Promise<ExecutionResult> {
    try {
      const store = useWorkspaceStore.getState();
      const timerWidget = findFocusedTimer() || findAnyTimer();

      if (!timerWidget) {
        return {
          success: false,
          error: 'No timer found to stop'
        };
      }

      // Stop timer state
      store.updateWidgetState(timerWidget.id, {
        shouldStop: true
      });

      debug('✅ Stopped timer widget:', timerWidget.id);

      return {
        success: true,
        widgetId: timerWidget.id,
        action: 'STOP_TIMER'
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to stop timer: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Create a new list widget
   */
  private async executeCreateList(command: any): Promise<ExecutionResult> {
    try {
      const store = useWorkspaceStore.getState();
      const items = command.parameters.items || [];

      // Get viewport center position
      const { x, y } = getViewportCenterPosition(WidgetType.LIST);

      // Create list widget
      const widgetId = store.addWidget(WidgetType.LIST, { x, y });

      // Set initial items if provided
      if (items.length > 0) {
        const initialItems = items.map((item: string, index: number) => ({
          id: `item-${Date.now()}-${index}`,
          text: item,
          completed: false
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
        error: `Failed to create list: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Create a new poll widget
   */
  private async executeCreatePoll(command: any): Promise<ExecutionResult> {
    try {
      const store = useWorkspaceStore.getState();
      const options = command.parameters.options || ['Option 1', 'Option 2'];

      // Get viewport center position
      const { x, y } = getViewportCenterPosition(WidgetType.POLL);

      // Create poll widget
      const widgetId = store.addWidget(WidgetType.POLL, { x, y });

      // Set initial poll data
      store.updateWidgetState(widgetId, {
        question: 'Voice-Generated Poll',
        options: options.map((option: string, index: number) => option),
        votes: {}
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
        error: `Failed to create poll: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Trigger randomiser
   */
  private async executeRandomise(command: any): Promise<ExecutionResult> {
    try {
      const store = useWorkspaceStore.getState();
      const randomiserWidget = findFocusedRandomiser() || findAnyRandomiser();

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
        error: `Failed to randomise: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Delete a timer widget
   */
  private async executeDeleteTimer(command: any): Promise<ExecutionResult> {
    try {
      const timerWidget = findFocusedTimer() || findAnyTimer();

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
        error: `Failed to delete timer: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Create a randomiser widget (separate from triggering existing one)
   */
  private async executeCreateRandomiser(command: any): Promise<ExecutionResult> {
    return await this.executeCreateWidget(WidgetType.RANDOMISER, command, 'CREATE_RANDOMISER');
  }

  /**
   * Start/activate a poll
   */
  private async executeStartPoll(command: any): Promise<ExecutionResult> {
    const pollWidget = findFocusedPoll() || findAnyPoll();
    if (!pollWidget) {
      return { success: false, error: 'No poll found to start' };
    }

    const store = useWorkspaceStore.getState();
    store.updateWidgetState(pollWidget.id, { isActive: true });

    return { success: true, widgetId: pollWidget.id, action: 'START_POLL' };
  }

  /**
   * Stop/pause a poll
   */
  private async executeStopPoll(command: any): Promise<ExecutionResult> {
    const pollWidget = findFocusedPoll() || findAnyPoll();
    if (!pollWidget) {
      return { success: false, error: 'No poll found to stop' };
    }

    const store = useWorkspaceStore.getState();
    store.updateWidgetState(pollWidget.id, { isActive: false });

    return { success: true, widgetId: pollWidget.id, action: 'STOP_POLL' };
  }

  /**
   * Create Questions widget
   */
  private async executeCreateQuestions(command: any): Promise<ExecutionResult> {
    return await this.executeCreateWidget(WidgetType.QUESTIONS, command, 'CREATE_QUESTIONS');
  }

  /**
   * Start/enable questions
   */
  private async executeStartQuestions(command: any): Promise<ExecutionResult> {
    const questionsWidget = findFocusedQuestions() || findAnyQuestions();
    if (!questionsWidget) {
      // Auto-create if doesn't exist
      return await this.executeCreateQuestions(command);
    }

    const store = useWorkspaceStore.getState();
    store.updateWidgetState(questionsWidget.id, { isActive: true });

    return { success: true, widgetId: questionsWidget.id, action: 'START_QUESTIONS' };
  }

  /**
   * Stop/disable questions
   */
  private async executeStopQuestions(command: any): Promise<ExecutionResult> {
    const questionsWidget = findFocusedQuestions() || findAnyQuestions();
    if (!questionsWidget) {
      return { success: false, error: 'No questions widget found to stop' };
    }

    const store = useWorkspaceStore.getState();
    store.updateWidgetState(questionsWidget.id, { isActive: false });

    return { success: true, widgetId: questionsWidget.id, action: 'STOP_QUESTIONS' };
  }

  /**
   * Create RT Feedback widget
   */
  private async executeCreateRTFeedback(command: any): Promise<ExecutionResult> {
    return await this.executeCreateWidget(WidgetType.RT_FEEDBACK, command, 'CREATE_RT_FEEDBACK');
  }

  /**
   * Start RT Feedback collection
   */
  private async executeStartRTFeedback(command: any): Promise<ExecutionResult> {
    const feedbackWidget = findFocusedRTFeedback() || findAnyRTFeedback();
    if (!feedbackWidget) {
      // Auto-create if doesn't exist
      return await this.executeCreateRTFeedback(command);
    }

    const store = useWorkspaceStore.getState();
    store.updateWidgetState(feedbackWidget.id, { isActive: true });

    return { success: true, widgetId: feedbackWidget.id, action: 'START_RT_FEEDBACK' };
  }

  /**
   * Pause RT Feedback collection
   */
  private async executePauseRTFeedback(command: any): Promise<ExecutionResult> {
    const feedbackWidget = findFocusedRTFeedback() || findAnyRTFeedback();
    if (!feedbackWidget) {
      return { success: false, error: 'No RT feedback widget found to pause' };
    }

    const store = useWorkspaceStore.getState();
    store.updateWidgetState(feedbackWidget.id, { isActive: false });

    return { success: true, widgetId: feedbackWidget.id, action: 'PAUSE_RT_FEEDBACK' };
  }

  /**
   * Create Link Share widget
   */
  private async executeCreateLinkShare(command: any): Promise<ExecutionResult> {
    return await this.executeCreateWidget(WidgetType.LINK_SHARE, command, 'CREATE_LINK_SHARE');
  }

  /**
   * Create Text Banner widget
   */
  private async executeCreateTextBanner(command: any): Promise<ExecutionResult> {
    const text = command.parameters.text || 'Welcome';
    const widgetResult = await this.executeCreateWidget(WidgetType.TEXT_BANNER, command, 'CREATE_TEXT_BANNER');

    if (widgetResult.success && widgetResult.widgetId) {
      const store = useWorkspaceStore.getState();
      store.updateWidgetState(widgetResult.widgetId, { text });
    }

    return widgetResult;
  }

  /**
   * Create Sound Effects widget
   */
  private async executeCreateSoundEffects(command: any): Promise<ExecutionResult> {
    return await this.executeCreateWidget(WidgetType.SOUND_EFFECTS, command, 'CREATE_SOUND_EFFECTS');
  }

  /**
   * Play a sound effect
   */
  private async executePlaySound(command: any): Promise<ExecutionResult> {
    const soundWidget = findFocusedSoundEffects() || findAnySoundEffects();
    if (!soundWidget) {
      return { success: false, error: 'No sound effects widget found' };
    }

    const soundName = command.parameters.soundName;
    const store = useWorkspaceStore.getState();
    store.updateWidgetState(soundWidget.id, { playSound: soundName });

    return { success: true, widgetId: soundWidget.id, action: 'PLAY_SOUND' };
  }

  /**
   * Create Task Cue widget
   */
  private async executeCreateTaskCue(command: any): Promise<ExecutionResult> {
    const mode = command.parameters.mode || 'individual';
    const widgetResult = await this.executeCreateWidget(WidgetType.TASK_CUE, command, 'CREATE_TASK_CUE');

    if (widgetResult.success && widgetResult.widgetId) {
      const store = useWorkspaceStore.getState();
      store.updateWidgetState(widgetResult.widgetId, { mode });
    }

    return widgetResult;
  }

  /**
   * Set Task Cue mode
   */
  private async executeSetTaskCueMode(command: any): Promise<ExecutionResult> {
    const taskCueWidget = findFocusedTaskCue() || findAnyTaskCue();
    if (!taskCueWidget) {
      return { success: false, error: 'No task cue widget found' };
    }

    const mode = command.parameters.mode;
    const store = useWorkspaceStore.getState();
    store.updateWidgetState(taskCueWidget.id, { mode });

    return { success: true, widgetId: taskCueWidget.id, action: 'SET_TASK_CUE_MODE' };
  }

  /**
   * Create Traffic Light widget
   */
  private async executeCreateTrafficLight(command: any): Promise<ExecutionResult> {
    const state = command.parameters.state || 'red';
    const widgetResult = await this.executeCreateWidget(WidgetType.TRAFFIC_LIGHT, command, 'CREATE_TRAFFIC_LIGHT');

    if (widgetResult.success && widgetResult.widgetId) {
      const store = useWorkspaceStore.getState();
      store.updateWidgetState(widgetResult.widgetId, { currentLight: state });
    }

    return widgetResult;
  }

  /**
   * Set Traffic Light state
   */
  private async executeSetTrafficLight(command: any): Promise<ExecutionResult> {
    const trafficLightWidget = findFocusedTrafficLight() || findAnyTrafficLight();
    if (!trafficLightWidget) {
      // Auto-create with the specified state
      return await this.executeCreateTrafficLight(command);
    }

    const state = command.parameters.state;
    const store = useWorkspaceStore.getState();
    store.updateWidgetState(trafficLightWidget.id, { currentLight: state });

    return { success: true, widgetId: trafficLightWidget.id, action: 'SET_TRAFFIC_LIGHT' };
  }

  /**
   * Generic widget creation helper
   */
  private async executeCreateWidget(
    widgetType: WidgetType,
    command: any,
    actionName?: string
  ): Promise<ExecutionResult> {
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
        error: `Failed to create widget: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Launch a widget by name (generic launcher)
   * Uses auto-generated widget target map from shared definitions
   */
  private async executeLaunchWidget(command: any): Promise<ExecutionResult> {
    const widgetName = command.target.toLowerCase();

    // Use auto-generated map from shared definitions
    // This ensures frontend and backend stay in sync
    const widgetTypeString = VOICE_WIDGET_TARGET_MAP[widgetName];

    if (!widgetTypeString) {
      return {
        success: false,
        error: `Unknown widget type: ${widgetName}`
      };
    }

    // Map the string to WidgetType enum
    const widgetType = WidgetType[widgetTypeString as keyof typeof WidgetType];

    if (!widgetType) {
      return {
        success: false,
        error: `Widget type not found in enum: ${widgetTypeString}`
      };
    }

    return await this.executeCreateWidget(widgetType, command, 'LAUNCH_WIDGET');
  }
}

// Export singleton instance
export const voiceCommandExecutor = new VoiceCommandExecutor();