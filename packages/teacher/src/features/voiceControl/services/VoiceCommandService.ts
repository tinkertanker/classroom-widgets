import { VoiceCommandRequest, VoiceCommandResponse, VoiceContext } from '../types/voiceControl';
import { debug } from '@shared/utils/debug';

// LLM fallback (Ollama) usually answers in under a second, but a wedged
// backend would otherwise leave the voice UI waiting forever
const COMMAND_TIMEOUT_MS = 15000;
const HEALTH_CHECK_TIMEOUT_MS = 5000;

// AbortSignal.timeout() is newer than the app's build target; fall back to a
// manual controller so older runtimes still send the request un-bounded by
// the missing API rather than failing before fetch starts
function timeoutSignal(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  if (typeof AbortController === 'undefined') {
    return undefined;
  }
  const controller = new AbortController();
  setTimeout(() => {
    try {
      controller.abort(new DOMException('The operation timed out', 'TimeoutError'));
    } catch {
      // Very old runtimes lack abort(reason)/DOMException constructor
      controller.abort();
    }
  }, ms);
  return controller.signal;
}

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

      const requestId = Math.random().toString(36).slice(2, 11);
      debug(`[${new Date().toISOString()}] [${requestId}] 🚀 Sending voice command request:`, JSON.stringify(request, null, 2));

      const response = await fetch(`${this.baseUrl}/voice-command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: timeoutSignal(COMMAND_TIMEOUT_MS)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Voice command failed: ${response.statusText} (${response.status})`
        );
      }

      const result: VoiceCommandResponse = await response.json();
      debug(`[${new Date().toISOString()}] [${requestId}] ✅ Voice command response:`, JSON.stringify(result, null, 2));

      return result;
    } catch (error) {
      debug.error('Voice command service error:', error);

      // Return a fallback error response
      return {
        success: false,
        command: {
          action: 'ERROR',
          target: 'unknown',
          parameters: {},
          confidence: 0
        },
        feedback: {
          // A timed-out fetch rejects with a DOMException whose raw message
          // ("signal timed out") would otherwise be shown to the teacher
          message: (error as { name?: string } | null)?.name === 'TimeoutError'
            ? 'Voice command timed out — is the server running?'
            : error instanceof Error ? error.message : 'Failed to process voice command',
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
      const response = await fetch(`${this.baseUrl}/voice-command/health`, {
        signal: timeoutSignal(HEALTH_CHECK_TIMEOUT_MS)
      });
      return response.ok;
    } catch (error) {
      debug.error('Voice command service health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const voiceCommandService = new VoiceCommandService();