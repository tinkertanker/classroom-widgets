import { VoiceCommandResponse, ExecutionResult } from '../types/voiceControl';
import { WidgetType } from '@shared/types';
import { debug } from '@shared/utils/debug';
import {
  createList,
  createPoll,
  createTaskCue,
  createTextBanner,
  createTimer,
  createTrafficLight,
  createWidget,
  launchWidget
} from './commands/createCommands';
import {
  deleteTimer,
  pauseRTFeedback,
  pauseTimer,
  playSound,
  randomise,
  resetTimer,
  setTaskCueMode,
  setTrafficLight,
  startPoll,
  startQuestions,
  startRTFeedback,
  stopPoll,
  stopQuestions,
  stopTimer
} from './commands/controlCommands';

/**
 * Runs a parsed voice command against the board. Handlers live in
 * ./commands: creating widgets in createCommands, acting on existing ones in
 * controlCommands.
 */
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
          return await createTimer(command);
        case 'RESET_TIMER':
          return await resetTimer();
        case 'PAUSE_TIMER':
          return await pauseTimer();
        case 'STOP_TIMER':
          return await stopTimer();
        case 'DELETE_TIMER':
          return await deleteTimer();

        // ===== RANDOMISER COMMANDS =====
        case 'RANDOMISE':
        case 'TRIGGER_RANDOMISER':
          return await randomise();
        case 'CREATE_RANDOMISER':
          return await createWidget(WidgetType.RANDOMISER, 'CREATE_RANDOMISER');

        // ===== LIST COMMANDS =====
        case 'CREATE_LIST':
          return await createList(command);

        // ===== POLL COMMANDS =====
        case 'CREATE_POLL':
          return await createPoll(command);
        case 'START_POLL':
          return await startPoll();
        case 'STOP_POLL':
          return await stopPoll();

        // ===== QUESTIONS COMMANDS =====
        case 'CREATE_QUESTIONS':
          return await createWidget(WidgetType.QUESTIONS, 'CREATE_QUESTIONS');
        case 'START_QUESTIONS':
          return await startQuestions();
        case 'STOP_QUESTIONS':
          return await stopQuestions();

        // ===== RT FEEDBACK COMMANDS =====
        case 'CREATE_RT_FEEDBACK':
          return await createWidget(WidgetType.RT_FEEDBACK, 'CREATE_RT_FEEDBACK');
        case 'START_RT_FEEDBACK':
          return await startRTFeedback();
        case 'PAUSE_RT_FEEDBACK':
          return await pauseRTFeedback();

        // ===== LINK SHARE COMMANDS =====
        case 'CREATE_LINK_SHARE':
          return await createWidget(WidgetType.LINK_SHARE, 'CREATE_LINK_SHARE');

        // ===== TEXT BANNER COMMANDS =====
        case 'CREATE_TEXT_BANNER':
          return await createTextBanner(command);

        // ===== SOUND EFFECTS COMMANDS =====
        case 'CREATE_SOUND_EFFECTS':
          return await createWidget(WidgetType.SOUND_EFFECTS, 'CREATE_SOUND_EFFECTS');
        case 'PLAY_SOUND':
          return await playSound(command);

        // ===== TASK CUE COMMANDS =====
        case 'CREATE_TASK_CUE':
          return await createTaskCue(command);
        case 'SET_TASK_CUE_MODE':
          return await setTaskCueMode(command);

        // ===== TRAFFIC LIGHT COMMANDS =====
        case 'CREATE_TRAFFIC_LIGHT':
          return await createTrafficLight(command);
        case 'SET_TRAFFIC_LIGHT':
          return await setTrafficLight(command);

        // ===== OTHER WIDGET CREATE COMMANDS =====
        case 'CREATE_IMAGE_DISPLAY':
          return await createWidget(WidgetType.IMAGE_DISPLAY);
        case 'CREATE_QRCODE':
          return await createWidget(WidgetType.QRCODE);
        case 'CREATE_STICKER':
          return await createWidget(WidgetType.STAMP);
        case 'CREATE_VISUALISER':
          return await createWidget(WidgetType.VISUALISER);
        case 'CREATE_VOLUME_MONITOR':
          return await createWidget(WidgetType.SOUND_MONITOR);
        case 'CREATE_LINK_SHORTENER':
          return await createWidget(WidgetType.LINK_SHORTENER);
        case 'CREATE_TIC_TAC_TOE':
          return await createWidget(WidgetType.TIC_TAC_TOE);
        case 'CREATE_SNAKE':
          return await createWidget(WidgetType.SNAKE);

        // ===== GENERIC LAUNCH COMMAND =====
        case 'LAUNCH_WIDGET':
          return await launchWidget(command);

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
}

// Export singleton instance
export const voiceCommandExecutor = new VoiceCommandExecutor();
