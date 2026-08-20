// BAML-powered Voice Command Service
// Uses BAML for type-safe LLM command parsing with Ollama

const {
  VOICE_WIDGET_DEFINITIONS,
  VOICE_ACTION_NAMES
} = require('../shared/constants/voiceCommandDefinitions');

// The widget/action catalog handed to the LLM comes from the generated constants
// (source of truth: packages/shared/voiceCommandDefinitions.json), not from a
// hand-maintained copy inside the BAML prompt. Names only: the full per-action
// docs from generateOllamaWidgetDocs() are far too long for a 0.5B model.
// UNKNOWN is a sentinel appended by the BAML prompt template, so it is not part
// of these lists.
const WIDGET_TARGETS = Object.values(VOICE_WIDGET_DEFINITIONS).map((widget) => widget.targetName);
const ACTION_NAMES = [...VOICE_ACTION_NAMES];

// Note: BAML generates TypeScript files, so we need to use dynamic import
// or install tsx/ts-node. For now, we'll lazy-load it.
let bamlClient = null;
async function getBamlClient() {
  if (!bamlClient) {
    try {
      // Try to use tsx to load TypeScript files
      require('tsx/cjs');
      const baml = require('../../baml_client');
      bamlClient = baml.b;
    } catch (error) {
      throw new Error('BAML client requires tsx to load TypeScript files. Install with: npm install --save-dev tsx');
    }
  }
  return bamlClient;
}

/**
 * BAMLVoiceCommandService
 *
 * This service uses BAML (Basically A Made-up Language) to provide
 * type-safe, structured LLM parsing of voice commands.
 *
 * Benefits over raw LLM calls:
 * - Type safety with auto-generated TypeScript/JavaScript types
 * - Consistent output structure
 * - Built-in validation and error handling
 * - Easy provider switching (Ollama, OpenAI, Claude)
 * - Automatic retries and fallbacks
 */
class BAMLVoiceCommandService {
  /**
   * @param {object} [options]
   * @param {{ ParseVoiceCommand: Function }} [options.client] - Pre-built BAML client.
   *   Injected by tests so they don't need tsx or a running Ollama; production
   *   leaves it unset and the real client is lazy-loaded on first use.
   */
  constructor({ client = null } = {}) {
    this.client = client;
    console.log('🎯 BAMLVoiceCommandService initialized');
  }

  /**
   * The widget targets sent to the LLM, derived from the shared definitions.
   * @returns {string[]}
   */
  getWidgetTargets() {
    return WIDGET_TARGETS;
  }

  /**
   * The action names sent to the LLM, derived from the shared definitions.
   * @returns {string[]}
   */
  getActionNames() {
    return ACTION_NAMES;
  }

  /**
   * Process a voice command using BAML
   * @param {string} transcript - The voice command transcript
   * @param {object} context - Additional context (workspace state, user preferences)
   * @returns {Promise<object>} - Structured command result
   */
  async processVoiceCommand(transcript, context = {}) {
    const startTime = Date.now();
    console.log(`🎯 BAML processing: "${transcript}"`);

    try {
      // Lazy-load the BAML client
      if (!this.client) {
        this.client = await getBamlClient();
      }

      // Call the BAML-generated ParseVoiceCommand function, passing the catalog
      // in as arguments so the prompt can never drift from the shared definitions.
      const result = await this.client.ParseVoiceCommand(transcript, WIDGET_TARGETS, ACTION_NAMES);

      const processingTime = Date.now() - startTime;
      console.log(`✅ BAML parsed in ${processingTime}ms:`, JSON.stringify(result, null, 2));

      // Check if the command is UNKNOWN or confidence is too low
      const isUnknown = result.action === 'UNKNOWN' || result.confidence < 0.5;

      // Transform BAML result to match our API format
      // Provide default feedback if LLM didn't include it
      const feedback = result.feedback || {
        message: isUnknown
          ? `I didn't understand "${transcript}". Try saying something like "create a timer" or "launch the poll".`
          : `${result.action.replace(/_/g, ' ').toLowerCase()} on ${result.target}`,
        type: isUnknown ? 'not_understood' : 'success',
        shouldSpeak: true
      };

      return {
        success: !isUnknown,
        command: {
          action: result.action,
          target: result.target,
          parameters: result.parameters || {},
          confidence: result.confidence
        },
        feedback: {
          message: feedback.message,
          type: feedback.type,
          shouldSpeak: feedback.shouldSpeak !== undefined ? feedback.shouldSpeak : true
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ BAML error after ${processingTime}ms:`, error.message);

      // Return a graceful fallback response
      return {
        command: {
          action: 'UNKNOWN',
          target: 'unknown',
          parameters: {},
          confidence: 0.10
        },
        feedback: {
          message: `I couldn't process "${transcript}". ${error.message}`,
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
            action: 'RANDOMISE',
            description: 'Pick someone at random',
            confidence: 0.40
          }
        ]
      };
    }
  }

  /**
   * Health check for BAML service
   * @returns {Promise<object>} - Health status
   */
  async healthCheck() {
    try {
      // Lazy-load the BAML client
      if (!this.client) {
        this.client = await getBamlClient();
      }

      // Try a simple test parse
      await this.client.ParseVoiceCommand('test', WIDGET_TARGETS, ACTION_NAMES);
      return {
        status: 'healthy',
        service: 'BAML Voice Command Parser',
        provider: 'Ollama (via BAML)',
        message: 'Service is operational'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'BAML Voice Command Parser',
        error: error.message,
        suggestion: 'Make sure Ollama is running on localhost:11434'
      };
    }
  }

  /**
   * Get service metadata
   * @returns {object} - Service information
   */
  getInfo() {
    return {
      name: 'BAMLVoiceCommandService',
      description: 'Type-safe LLM voice command parser using BAML',
      provider: 'Ollama (configurable)',
      benefits: [
        'Type-safe parsing with auto-generated types',
        'Structured output validation',
        'Easy provider switching',
        'Built-in error handling',
        'Confidence scoring'
      ]
    };
  }
}

module.exports = BAMLVoiceCommandService;
