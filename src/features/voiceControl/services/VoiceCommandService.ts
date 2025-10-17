import { VoiceCommandRequest, VoiceCommandResponse, VoiceContext } from '../types/voiceControl';

export class VoiceCommandService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NODE_ENV === 'development'
      ? 'http://localhost:3001/api'
      : '/api';
  }

  /**
   * Process voice command through LLM endpoint
   */
  async processCommand(
    transcript: string,
    context: VoiceContext,
    userPreferences?: VoiceCommandRequest['userPreferences']
  ): Promise<VoiceCommandResponse> {
    try {
      const request: VoiceCommandRequest = {
        transcript,
        context,
        userPreferences
      };

      console.log('Sending voice command request:', request);

      const response = await fetch(`${this.baseUrl}/voice-command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Voice command failed: ${response.statusText} (${response.status})`
        );
      }

      const result: VoiceCommandResponse = await response.json();
      console.log('Voice command response:', result);

      return result;
    } catch (error) {
      console.error('Voice command service error:', error);

      // Return a fallback error response
      return {
        command: {
          action: 'ERROR',
          target: 'unknown',
          parameters: {},
          confidence: 0
        },
        feedback: {
          message: error instanceof Error ? error.message : 'Failed to process voice command',
          type: 'error',
          shouldSpeak: false
        }
      };
    }
  }

  /**
   * Get current widget context for voice commands
   */
  getWidgetContext(): VoiceContext {
    // This will be implemented when we integrate with the main app
    // For now, return a basic context structure
    return {
      activeWidgets: [],
      availableWidgets: [
        'timer', 'list', 'poll', 'randomiser', 'questions',
        'image', 'linkShare', 'rtFeedback', 'ticTacToe'
      ],
      screenPosition: { x: 0, y: 0 }
    };
  }

  /**
   * Check if the voice command service is available
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/voice-command/health`);
      return response.ok;
    } catch (error) {
      console.error('Voice command service health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const voiceCommandService = new VoiceCommandService();