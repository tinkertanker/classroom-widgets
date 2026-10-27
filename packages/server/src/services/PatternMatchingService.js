// Fast regex-based voice command matching (~5ms), tried before any LLM fallback

const {
  INTENT_KEYWORDS,
  buildIntentRegex,
  buildVoiceCommandPatterns
} = require('./voiceCommandPatterns');

const VOICE_COMMAND_DEBUG = process.env.VOICE_COMMAND_DEBUG === 'true';

/**
 * LLM Integration Guide
 *
 * Hybrid Approach (Current Implementation):
 * 1. PatternMatchingService - Fast regex-based matching (~5ms)
 * 2. BAMLVoiceCommandService - Type-safe AI fallback for low-confidence matches (~1-3s)
 *
 * The system tries pattern matching first, then falls back to BAML if confidence < 0.80
 *
 * IMPORTANT: Widget Definitions
 * - All widget names, actions, and parameters are defined in shared/voiceCommandDefinitions.json
 * - Run `pnpm generate:voice-types` to regenerate TypeScript/JavaScript files
 * - This ensures frontend and backend stay perfectly synchronized
 * - Both Ollama prompts and widget target maps are auto-generated from this source
 *
 * To integrate other LLM providers:
 *
 * BAML Configuration:
 * - Model: qwen2.5:0.5b (fast, lightweight, good JSON output)
 * - Endpoint: http://localhost:11434/v1 (OpenAI-compatible API)
 * - Optional fields: feedback and shouldSpeak (handles incomplete LLM responses)
 * - SAP algorithm: Schema-Aligned Parsing for flexible LLM outputs
 */
class PatternMatchingService {
  static buildUnknownResult(transcript, options = {}) {
    const result = {
      success: false,
      command: {
        action: 'UNKNOWN',
        target: 'unknown',
        parameters: {},
        confidence: 0.10
      },
      feedback: {
        message: `I'm not sure how to handle "${transcript}".`,
        type: 'error',
        shouldSpeak: true
      },
      alternatives: [
        {
          action: 'CREATE_TIMER',
          description: 'Create a new timer',
          confidence: 0.60
        },
        {
          action: 'CREATE_LIST',
          description: 'Create a new list',
          confidence: 0.50
        },
        {
          action: 'CREATE_POLL',
          description: 'Create a new poll',
          confidence: 0.40
        }
      ]
    };

    if (options.viaIntentPrefilter) {
      result.viaIntentPrefilter = true;
    }

    return result;
  }

  async processVoiceCommand(transcript, context) {
    if (VOICE_COMMAND_DEBUG) {
      console.log(`🔍 PatternMatchingService processing: ${JSON.stringify(transcript)}`);
      console.log('🗂️ Context provided:', context);
    }

    const lowerTranscript = transcript.toLowerCase().trim();

    /**
     * Comprehensive Pattern Matching for All Widgets (see voiceCommandPatterns.js).
     * Patterns are cached on the class so we don't rebuild ~50 RegExp objects
     * on every request.
     */
    if (!PatternMatchingService.patterns) {
      PatternMatchingService.patterns = buildVoiceCommandPatterns();

      PatternMatchingService.intentRegex = buildIntentRegex(INTENT_KEYWORDS);
    }

    // Fast path: skip the full pattern scan for transcripts with zero command-intent
    // keywords (background chatter, gibberish). The route layer decides whether to
    // still call BAML — this function only controls pattern matching.
    if (!PatternMatchingService.intentRegex.test(lowerTranscript)) {
      if (VOICE_COMMAND_DEBUG) {
        console.log('⚡ Fast path: transcript has no known command intent keywords');
      }
      const result = PatternMatchingService.buildUnknownResult(transcript, { viaIntentPrefilter: true });
      if (VOICE_COMMAND_DEBUG) {
        console.log('📋 Generated unknown command result:', result);
      }
      return result;
    }

    const patterns = PatternMatchingService.patterns;

    // Try to match patterns (in order of specificity)
    for (const patternDef of patterns) {
      const { pattern, action, target, parameters, message, confidence } = patternDef;
      const match = lowerTranscript.match(pattern);

      if (match) {
        if (VOICE_COMMAND_DEBUG) {
          console.log(`✅ Pattern matched: ${pattern.toString()} -> ${action}`);
        }

        // Handle dynamic target (for generic launch commands)
        const resolvedTarget = typeof target === 'function' ? target(match) : target;

        const result = {
          success: true,
          command: {
            action,
            target: resolvedTarget,
            parameters: parameters(match),
            confidence: confidence || 0.85
          },
          feedback: {
            message: message(match),
            type: 'success',
            shouldSpeak: true
          }
        };
        if (VOICE_COMMAND_DEBUG) {
          console.log('📋 Generated result:', result);
        }
        return result;
      }
    }

    // Unknown command (had intent keywords but no pattern matched — let BAML try)
    if (VOICE_COMMAND_DEBUG) {
      console.log('❌ No patterns matched, returning unknown command response');
    }
    const result = PatternMatchingService.buildUnknownResult(transcript);
    if (VOICE_COMMAND_DEBUG) {
      console.log('📋 Generated unknown command result:', result);
    }
    return result;
  }
}

module.exports = PatternMatchingService;
