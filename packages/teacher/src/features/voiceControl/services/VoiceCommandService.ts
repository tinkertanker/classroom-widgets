import { VoiceCommandRequest, VoiceCommandResponse, VoiceContext } from '../types/voiceControl';
import { debug } from '@shared/utils/debug';
import { useWorkspaceUiStore } from '../../../store/workspaceUiStore';

// LLM fallback (Ollama) usually answers in under a second, but a wedged
// backend would otherwise leave the voice UI waiting forever
const COMMAND_TIMEOUT_MS = 15000;

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

class VoiceCommandService {
  // The API lives on the backend server, not the origin serving this app
  // (widgets.tk.sg has no /api route), so use the configured server URL
  private get baseUrl(): string {
    return `${useWorkspaceUiStore.getState().serverStatus.url.replace(/\/+$/, '')}/api`;
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
}

// Export singleton instance
export const voiceCommandService = new VoiceCommandService();