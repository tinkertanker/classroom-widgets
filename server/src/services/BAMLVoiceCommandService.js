// BAML-powered Voice Command Service
// Uses BAML for type-safe LLM command parsing with Ollama

const { b } = require('../../../baml_client');

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
  constructor() {
    this.client = b;
    console.log('🎯 BAMLVoiceCommandService initialized');
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
      // Call the BAML-generated ParseVoiceCommand function
      const result = await this.client.ParseVoiceCommand(transcript);

      const processingTime = Date.now() - startTime;
      console.log(`✅ BAML parsed in ${processingTime}ms:`, JSON.stringify(result, null, 2));

      // Transform BAML result to match our API format
      return {
        command: {
          action: result.action,
          target: result.target,
          parameters: result.parameters || {},
          confidence: result.confidence
        },
        feedback: {
          message: result.feedback.message,
          type: result.feedback.type,
          shouldSpeak: result.feedback.shouldSpeak
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
      // Try a simple test parse
      const testResult = await this.client.ParseVoiceCommand('test');
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
