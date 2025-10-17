import { VoiceCommandResponse, ExecutionResult } from '../types/voiceControl';
import { WidgetType } from '../../../shared/types';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';

export class VoiceCommandExecutor {
  private addWidget: (type: WidgetType, position?: { x: number; y: number }) => string;
  private updateWidgetState: (widgetId: string, state: any) => void;
  private focusedWidgetId: string | null;
  private widgets: any[];

  constructor() {
    // Get store functions
    const store = useWorkspaceStore.getState();
    this.addWidget = store.addWidget;
    this.updateWidgetState = store.updateWidgetState;
    this.focusedWidgetId = store.focusedWidgetId;
    this.widgets = store.widgets;
  }

  /**
   * Execute a voice command
   */
  async executeCommand(commandResponse: VoiceCommandResponse): Promise<ExecutionResult> {
    const { command } = commandResponse;
    console.log('Executing voice command:', command);

    try {
      switch (command.action) {
        case 'CREATE_TIMER':
          return await this.executeCreateTimer(command);

        case 'RESET_TIMER':
          return await this.executeResetTimer(command);

        case 'PAUSE_TIMER':
          return await this.executePauseTimer(command);

        case 'STOP_TIMER':
          return await this.executeStopTimer(command);

        case 'CREATE_LIST':
          return await this.executeCreateList(command);

        case 'CREATE_POLL':
          return await this.executeCreatePoll(command);

        case 'RANDOMISE':
          return await this.executeRandomise(command);

        case 'DELETE_TIMER':
          return await this.executeDeleteTimer(command);

        case 'UNKNOWN':
        default:
          return {
            success: false,
            error: `Unknown command: ${command.action}`
          };
      }
    } catch (error) {
      console.error('Command execution failed:', error);
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
      const duration = command.parameters.duration || 300; // Default 5 minutes

      // Calculate center position for new widget
      const centerX = 400;
      const centerY = 300;
      const widgetWidth = 350;
      const widgetHeight = 415;
      const x = centerX - widgetWidth / 2;
      const y = centerY - widgetHeight / 2;

      // Create timer widget
      const widgetId = this.addWidget(WidgetType.TIMER, { x, y });

      // Set initial state with duration
      this.updateWidgetState(widgetId, {
        initialDuration: duration,
        duration: duration
      });

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
      // Find focused timer or any timer
      const timerWidget = this.findFocusedTimer() || this.findAnyTimer();

      if (!timerWidget) {
        return {
          success: false,
          error: 'No timer found to reset'
        };
      }

      // Reset timer state
      this.updateWidgetState(timerWidget.id, {
        shouldReset: true
      });

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
      const timerWidget = this.findFocusedTimer() || this.findAnyTimer();

      if (!timerWidget) {
        return {
          success: false,
          error: 'No timer found to pause'
        };
      }

      // Pause timer state
      this.updateWidgetState(timerWidget.id, {
        shouldPause: true
      });

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
      const timerWidget = this.findFocusedTimer() || this.findAnyTimer();

      if (!timerWidget) {
        return {
          success: false,
          error: 'No timer found to stop'
        };
      }

      // Stop timer state
      this.updateWidgetState(timerWidget.id, {
        shouldStop: true
      });

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
      const items = command.parameters.items || [];

      // Calculate center position
      const centerX = 400;
      const centerY = 300;
      const widgetWidth = 350;
      const widgetHeight = 350;
      const x = centerX - widgetWidth / 2;
      const y = centerY - widgetHeight / 2;

      // Create list widget
      const widgetId = this.addWidget(WidgetType.LIST, { x, y });

      // Set initial items if provided
      if (items.length > 0) {
        const initialItems = items.map((item: string, index: number) => ({
          id: `item-${Date.now()}-${index}`,
          text: item,
          completed: false
        }));

        this.updateWidgetState(widgetId, {
          items: initialItems
        });
      }

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
      const options = command.parameters.options || ['Option 1', 'Option 2'];

      // Calculate center position
      const centerX = 400;
      const centerY = 300;
      const widgetWidth = 400;
      const widgetHeight = 400;
      const x = centerX - widgetWidth / 2;
      const y = centerY - widgetHeight / 2;

      // Create poll widget
      const widgetId = this.addWidget(WidgetType.POLL, { x, y });

      // Set initial poll data
      this.updateWidgetState(widgetId, {
        question: 'Voice-Generated Poll',
        options: options.map((option: string, index: number) => option),
        votes: {}
      });

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
      const randomiserWidget = this.findFocusedRandomiser() || this.findAnyRandomiser();

      if (!randomiserWidget) {
        // Create a new randomiser if none exists
        const centerX = 400;
        const centerY = 300;
        const widgetWidth = 350;
        const widgetHeight = 250;
        const x = centerX - widgetWidth / 2;
        const y = centerY - widgetHeight / 2;

        const widgetId = this.addWidget(WidgetType.RANDOMISER, { x, y });

        // Trigger randomisation
        this.updateWidgetState(widgetId, {
          shouldRandomise: true
        });

        return {
          success: true,
          widgetId,
          action: 'CREATE_RANDOMISER'
        };
      }

      // Trigger randomisation on existing widget
      this.updateWidgetState(randomiserWidget.id, {
        shouldRandomise: true
      });

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
      const timerWidget = this.findFocusedTimer() || this.findAnyTimer();

      if (!timerWidget) {
        return {
          success: false,
          error: 'No timer found to delete'
        };
      }

      // Delete widget (this would need to be implemented in the store)
      // For now, we'll just return success
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

  // Helper methods to find widgets
  private findFocusedTimer() {
    if (!this.focusedWidgetId) return null;
    const widget = this.widgets.find(w => w.id === this.focusedWidgetId);
    return widget?.type === WidgetType.TIMER ? widget : null;
  }

  private findAnyTimer() {
    return this.widgets.find(w => w.type === WidgetType.TIMER) || null;
  }

  private findFocusedRandomiser() {
    if (!this.focusedWidgetId) return null;
    const widget = this.widgets.find(w => w.id === this.focusedWidgetId);
    return widget?.type === WidgetType.RANDOMISER ? widget : null;
  }

  private findAnyRandomiser() {
    return this.widgets.find(w => w.type === WidgetType.RANDOMISER) || null;
  }
}

// Export singleton instance
export const voiceCommandExecutor = new VoiceCommandExecutor();