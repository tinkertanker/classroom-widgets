// Ollama LLM Service for Voice Command Processing
// This service uses Ollama (https://ollama.com/) to process natural language voice commands
// and convert them into structured command objects for the frontend.

/**
 * Setup Instructions:
 *
 * 1. Install Ollama:
 *    curl -fsSL https://ollama.com/install.sh | sh
 *
 * 2. Pull a model:
 *    ollama pull phi4           # Recommended: Best accuracy
 *    ollama pull llama3.2:3b   # Alternative: Good balance
 *    ollama pull gemma2:2b      # Alternative: Faster, smaller
 *
 * 3. Start Ollama service:
 *    ollama serve               # Or it starts automatically on installation
 *
 * 4. Install Node.js client:
 *    npm install ollama
 *
 * 5. Enable in .env:
 *    USE_LOCAL_LLM=true
 *    OLLAMA_MODEL=phi4
 *    OLLAMA_HOST=http://localhost:11434
 *
 * See docs/LOCAL_LLM_SETUP.md for complete guide.
 */

const { Ollama } = require('ollama');
const { generateOllamaWidgetDocs } = require('../shared/constants/voiceCommandDefinitions');

class OllamaLLMService {
  constructor() {
    this.ollama = new Ollama({
      host: process.env.OLLAMA_HOST || 'http://localhost:11434'
    });
    this.model = process.env.OLLAMA_MODEL || 'phi4';
    this.initialized = false;
  }

  /**
   * Initialize and verify Ollama connection
   */
  async initialize() {
    if (this.initialized) return true;

    try {
      console.log(`🤖 Initializing Ollama with model: ${this.model}`);

      // Verify Ollama is running and model is available
      const models = await this.ollama.list();
      const modelExists = models.models.some(m => m.name.includes(this.model));

      if (!modelExists) {
        console.error(`❌ Model "${this.model}" not found. Available models:`, models.models.map(m => m.name));
        console.log(`💡 Pull the model with: ollama pull ${this.model}`);
        return false;
      }

      this.initialized = true;
      console.log(`✅ Ollama initialized successfully with model: ${this.model}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Ollama:', error.message);
      console.log('💡 Make sure Ollama is running: ollama serve');
      return false;
    }
  }

  /**
   * Process a voice command using Ollama LLM
   */
  async processVoiceCommand(transcript, context) {
    console.log(`🤖 OllamaLLMService processing: "${transcript}"`);
    console.log('🗂️ Context provided:', context);

    // Verify Ollama is ready
    const isReady = await this.initialize();
    if (!isReady) {
      throw new Error('Ollama service not available');
    }

    // System prompt for the LLM
    // Widget documentation is auto-generated from shared definitions
    const widgetDocs = generateOllamaWidgetDocs();

    const systemPrompt = `You are a voice command processor for a classroom widget application.
Your job is to convert natural language commands into structured JSON commands.

Available widgets and their commands:

${widgetDocs}

**Response Format (MUST be valid JSON):**
{
  "command": {
    "action": "ACTION_NAME",
    "target": "widget_type",
    "parameters": { /* action-specific parameters */ },
    "confidence": 0.85
  },
  "feedback": {
    "message": "User-friendly description of what will happen",
    "type": "success",
    "shouldSpeak": true
  }
}

**If command is unclear:**
{
  "command": {
    "action": "UNKNOWN",
    "target": "unknown",
    "parameters": {},
    "confidence": 0.1
  },
  "feedback": {
    "message": "I'm not sure how to handle '[transcript]'. Try saying 'start a timer for 5 minutes' or 'create a list'.",
    "type": "error",
    "shouldSpeak": true
  },
  "alternatives": [
    { "action": "CREATE_TIMER", "description": "Create a new timer", "confidence": 0.6 },
    { "action": "CREATE_LIST", "description": "Create a new list", "confidence": 0.5 }
  ]
}

**Important:**
- Output ONLY valid JSON, no markdown, no explanations
- Use confidence 0.8-0.95 for clear matches
- Use confidence <0.5 and action "UNKNOWN" for unclear commands
- Extract numbers for durations: "5 minutes" → 300 seconds
- Extract items from lists carefully
- Be consistent with action names (use uppercase with underscores)`;

    try {
      const startTime = Date.now();

      const response = await this.ollama.chat({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Convert this voice command to JSON:\n\nCommand: "${transcript}"\n\nContext: ${JSON.stringify(context, null, 2)}`
          }
        ],
        format: 'json', // Force JSON output
        options: {
          temperature: 0.1, // Low temperature for consistent, deterministic output
          top_p: 0.9,
          num_predict: 400, // Limit token output
          stop: ['\n\n\n'] // Stop on multiple newlines
        }
      });

      const processingTime = Date.now() - startTime;
      console.log(`⏱️ Ollama processing time: ${processingTime}ms`);

      // Parse JSON response
      let result;
      try {
        result = JSON.parse(response.message.content);
      } catch (parseError) {
        console.error('❌ Failed to parse Ollama JSON response:', response.message.content);
        throw new Error('Invalid JSON response from Ollama');
      }

      // Validate response structure
      if (!result.command || !result.feedback) {
        console.error('❌ Invalid response structure:', result);
        throw new Error('Invalid response structure from Ollama');
      }

      console.log('✅ Ollama result:', result);
      return result;

    } catch (error) {
      console.error('❌ Ollama error:', error);

      // Return error response
      return {
        command: {
          action: 'UNKNOWN',
          target: 'unknown',
          parameters: {},
          confidence: 0.1
        },
        feedback: {
          message: `Failed to process command with LLM: ${error.message}`,
          type: 'error',
          shouldSpeak: true
        },
        error: error.message
      };
    }
  }

  /**
   * Health check for Ollama service
   */
  async healthCheck() {
    try {
      const models = await this.ollama.list();
      return {
        status: 'healthy',
        service: 'Ollama',
        model: this.model,
        availableModels: models.models.map(m => m.name)
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'Ollama',
        error: error.message
      };
    }
  }
}

module.exports = OllamaLLMService;
