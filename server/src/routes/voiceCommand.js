// Voice Command Processing Route
// This endpoint processes transcribed voice commands using LLM

const express = require('express');
const router = express.Router();

/**
 * LLM Integration Guide
 *
 * Currently using MockLLMService for development/testing (pattern matching only).
 *
 * To integrate with a real LLM provider:
 *
 * Option 1: OpenAI GPT
 *   1. Install: npm install openai
 *   2. Set env var: OPENAI_API_KEY=sk-...
 *   3. Create services/OpenAILLMService.js with processVoiceCommand(transcript, context)
 *   4. Replace MockLLMService with OpenAILLMService below
 *
 * Option 2: Anthropic Claude
 *   1. Install: npm install @anthropic-ai/sdk
 *   2. Set env var: ANTHROPIC_API_KEY=sk-ant-...
 *   3. Create services/ClaudeLLMService.js
 *   4. Replace MockLLMService with ClaudeLLMService below
 *
 * Option 3: Azure OpenAI or Custom Endpoint
 *   1. Configure your endpoint and auth
 *   2. Implement the same interface: processVoiceCommand(transcript, context)
 *   3. Return format: { command: {action, parameters}, feedback: {type, message}, success: bool }
 *
 * See MockLLMService below for the interface contract.
 */
class MockLLMService {
  async processVoiceCommand(transcript, context) {
    console.log(`🤖 MockLLMService processing: "${transcript}"`);
    console.log('🗂️ Context provided:', context);

    const lowerTranscript = transcript.toLowerCase().trim();

    /**
     * Comprehensive Pattern Matching for All Widgets
     * See docs/VOICE_COMMAND_MAPPING.md for complete reference
     *
     * Pattern Priority:
     * 1. Specific patterns with parameters (e.g., "5 minute timer")
     * 2. Action patterns (e.g., "reset timer", "start poll")
     * 3. Generic create patterns (e.g., "create timer")
     * 4. Launch patterns (e.g., "launch timer")
     */
    const patterns = [
      // ========================================
      // TIMER WIDGET COMMANDS
      // ========================================
      {
        pattern: /(?:start|create|add|make).*timer.*?(\d+)\s*(?:minute|min)/i,
        action: 'CREATE_TIMER',
        target: 'timer',
        parameters: (match) => ({ duration: parseInt(match[1]) * 60 }),
        message: (match) => `Starting a ${match[1]}-minute timer`,
        confidence: 0.90
      },
      {
        pattern: /(?:start|create|add|make).*timer/i,
        action: 'CREATE_TIMER',
        target: 'timer',
        parameters: () => ({ duration: 300 }), // Default 5 minutes
        message: () => 'Starting a 5-minute timer',
        confidence: 0.85
      },
      {
        pattern: /(?:reset|restart).*timer/i,
        action: 'RESET_TIMER',
        target: 'timer',
        parameters: () => ({}),
        message: () => 'Resetting the timer',
        confidence: 0.90
      },
      {
        pattern: /pause.*timer/i,
        action: 'PAUSE_TIMER',
        target: 'timer',
        parameters: () => ({}),
        message: () => 'Pausing the timer',
        confidence: 0.90
      },
      {
        pattern: /stop.*timer/i,
        action: 'STOP_TIMER',
        target: 'timer',
        parameters: () => ({}),
        message: () => 'Stopping the timer',
        confidence: 0.90
      },

      // ========================================
      // RANDOMISER WIDGET COMMANDS
      // ========================================
      {
        pattern: /(?:let'?s\s+)?(?:pick|choose|select).*(?:random|next).*(?:person|student|name)/i,
        action: 'RANDOMISE',
        target: 'randomiser',
        parameters: () => ({}),
        message: () => 'Choosing someone at random',
        confidence: 0.92
      },
      {
        pattern: /(?:randomise|randomize)/i,
        action: 'RANDOMISE',
        target: 'randomiser',
        parameters: () => ({}),
        message: () => 'Randomising',
        confidence: 0.88
      },
      {
        pattern: /(?:spin|roll).*(?:wheel|dice)/i,
        action: 'RANDOMISE',
        target: 'randomiser',
        parameters: () => ({}),
        message: () => 'Spinning the randomiser',
        confidence: 0.85
      },
      {
        pattern: /(?:create|add).*randomiser/i,
        action: 'CREATE_RANDOMISER',
        target: 'randomiser',
        parameters: () => ({}),
        message: () => 'Creating a randomiser',
        confidence: 0.88
      },

      // ========================================
      // LIST WIDGET COMMANDS
      // ========================================
      {
        pattern: /(?:launch|create|make|add).*list.*(?:with|tasks?|items?).*\(1\)(.*?)(?:\(2\)|$)/i,
        action: 'CREATE_LIST',
        target: 'list',
        parameters: (match) => {
          const fullText = match[0];
          const items = [];
          const itemRegex = /\((\d+)\)\s*([^()]+?)(?=\(\d+\)|$)/gi;
          let itemMatch;
          while ((itemMatch = itemRegex.exec(fullText)) !== null) {
            items.push(itemMatch[2].trim());
          }
          return { items };
        },
        message: (match) => {
          const fullText = match[0];
          const itemCount = (fullText.match(/\(\d+\)/g) || []).length;
          return `Creating a list with ${itemCount} items`;
        },
        confidence: 0.92
      },
      {
        pattern: /(?:create|make|add).*list/i,
        action: 'CREATE_LIST',
        target: 'list',
        parameters: () => ({ items: [] }),
        message: () => 'Creating a new list',
        confidence: 0.85
      },

      // ========================================
      // POLL WIDGET COMMANDS
      // ========================================
      {
        pattern: /(?:create|start|make).*poll/i,
        action: 'CREATE_POLL',
        target: 'poll',
        parameters: () => ({ options: ['Option 1', 'Option 2'] }),
        message: () => 'Creating a new poll',
        confidence: 0.88
      },
      {
        pattern: /(?:start|activate|enable).*poll/i,
        action: 'START_POLL',
        target: 'poll',
        parameters: () => ({}),
        message: () => 'Starting the poll',
        confidence: 0.90
      },
      {
        pattern: /(?:stop|pause|disable).*poll/i,
        action: 'STOP_POLL',
        target: 'poll',
        parameters: () => ({}),
        message: () => 'Stopping the poll',
        confidence: 0.90
      },

      // ========================================
      // QUESTIONS WIDGET COMMANDS
      // ========================================
      {
        pattern: /(?:enable|start|open|activate).*question/i,
        action: 'START_QUESTIONS',
        target: 'questions',
        parameters: () => ({}),
        message: () => 'Enabling questions from students',
        confidence: 0.90
      },
      {
        pattern: /(?:disable|stop|close).*question/i,
        action: 'STOP_QUESTIONS',
        target: 'questions',
        parameters: () => ({}),
        message: () => 'Disabling questions',
        confidence: 0.90
      },
      {
        pattern: /(?:create|add).*question.*widget/i,
        action: 'CREATE_QUESTIONS',
        target: 'questions',
        parameters: () => ({}),
        message: () => 'Creating a questions widget',
        confidence: 0.88
      },

      // ========================================
      // RT FEEDBACK WIDGET COMMANDS
      // ========================================
      {
        pattern: /(?:create|add).*(?:feedback|rt feedback)/i,
        action: 'CREATE_RT_FEEDBACK',
        target: 'rtFeedback',
        parameters: () => ({}),
        message: () => 'Creating an RT feedback widget',
        confidence: 0.88
      },
      {
        pattern: /(?:start|enable).*feedback/i,
        action: 'START_RT_FEEDBACK',
        target: 'rtFeedback',
        parameters: () => ({}),
        message: () => 'Starting feedback collection',
        confidence: 0.88
      },
      {
        pattern: /(?:pause|stop).*feedback/i,
        action: 'PAUSE_RT_FEEDBACK',
        target: 'rtFeedback',
        parameters: () => ({}),
        message: () => 'Pausing feedback collection',
        confidence: 0.88
      },

      // ========================================
      // LINK SHARE WIDGET COMMANDS
      // ========================================
      {
        pattern: /(?:create|add).*link.*shar/i,
        action: 'CREATE_LINK_SHARE',
        target: 'linkShare',
        parameters: () => ({}),
        message: () => 'Creating a link share widget',
        confidence: 0.88
      },

      // ========================================
      // TEXT BANNER WIDGET COMMANDS
      // ========================================
      {
        pattern: /(?:create|show|display).*banner.*(?:saying|with|text)?.*["']([^"']+)["']/i,
        action: 'CREATE_TEXT_BANNER',
        target: 'textBanner',
        parameters: (match) => ({ text: match[1] }),
        message: (match) => `Creating a banner: "${match[1]}"`,
        confidence: 0.92
      },
      {
        pattern: /(?:create|add|show).*banner/i,
        action: 'CREATE_TEXT_BANNER',
        target: 'textBanner',
        parameters: () => ({ text: 'Welcome' }),
        message: () => 'Creating a text banner',
        confidence: 0.85
      },

      // ========================================
      // SOUND EFFECTS WIDGET COMMANDS
      // ========================================
      {
        pattern: /(?:create|add).*sound.*effect/i,
        action: 'CREATE_SOUND_EFFECTS',
        target: 'soundEffects',
        parameters: () => ({}),
        message: () => 'Creating a sound effects widget',
        confidence: 0.88
      },
      {
        pattern: /play\s+(victory|applause|wrong|tada|drum roll|whistle|bell|airhorn)/i,
        action: 'PLAY_SOUND',
        target: 'soundEffects',
        parameters: (match) => ({ soundName: match[1] }),
        message: (match) => `Playing ${match[1]} sound`,
        confidence: 0.92
      },

      // ========================================
      // TASK CUE WIDGET COMMANDS
      // ========================================
      {
        pattern: /(?:create|add).*(?:task cue|work mode)/i,
        action: 'CREATE_TASK_CUE',
        target: 'taskCue',
        parameters: () => ({}),
        message: () => 'Creating a task cue widget',
        confidence: 0.88
      },
      {
        pattern: /(?:set|change).*work.*mode.*(?:to\s+)?(individual|pair|group|class)/i,
        action: 'SET_TASK_CUE_MODE',
        target: 'taskCue',
        parameters: (match) => ({ mode: match[1] }),
        message: (match) => `Setting work mode to ${match[1]}`,
        confidence: 0.90
      },

      // ========================================
      // TRAFFIC LIGHT WIDGET COMMANDS
      // ========================================
      {
        pattern: /(?:create|add).*traffic.*light/i,
        action: 'CREATE_TRAFFIC_LIGHT',
        target: 'trafficLight',
        parameters: () => ({}),
        message: () => 'Creating a traffic light widget',
        confidence: 0.88
      },
      {
        pattern: /(?:show|set|change).*(?:to\s+)?(red|yellow|green).*light/i,
        action: 'SET_TRAFFIC_LIGHT',
        target: 'trafficLight',
        parameters: (match) => ({ state: match[1] }),
        message: (match) => `Setting traffic light to ${match[1]}`,
        confidence: 0.90
      },

      // ========================================
      // IMAGE DISPLAY WIDGET COMMANDS
      // ========================================
      {
        pattern: /(?:create|add|show).*image/i,
        action: 'CREATE_IMAGE_DISPLAY',
        target: 'imageDisplay',
        parameters: () => ({}),
        message: () => 'Creating an image display widget',
        confidence: 0.85
      },

      // ========================================
      // QR CODE WIDGET COMMANDS
      // ========================================
      {
        pattern: /(?:create|generate|make).*qr.*code/i,
        action: 'CREATE_QRCODE',
        target: 'qrcode',
        parameters: () => ({}),
        message: () => 'Creating a QR code widget',
        confidence: 0.88
      },

      // ========================================
      // STICKER/STAMP WIDGET COMMANDS
      // ========================================
      {
        pattern: /(?:add|place|create).*(?:sticker|stamp)/i,
        action: 'CREATE_STICKER',
        target: 'sticker',
        parameters: () => ({}),
        message: () => 'Creating a sticker',
        confidence: 0.85
      },

      // ========================================
      // VISUALISER WIDGET COMMANDS
      // ========================================
      {
        pattern: /(?:create|add).*(?:visualiser|visualizer|audio.*visual)/i,
        action: 'CREATE_VISUALISER',
        target: 'visualiser',
        parameters: () => ({}),
        message: () => 'Creating a visualiser widget',
        confidence: 0.88
      },

      // ========================================
      // VOLUME MONITOR WIDGET COMMANDS
      // ========================================
      {
        pattern: /(?:create|add).*(?:volume|sound).*(?:monitor|level|meter)/i,
        action: 'CREATE_VOLUME_MONITOR',
        target: 'volumeMonitor',
        parameters: () => ({}),
        message: () => 'Creating a volume monitor widget',
        confidence: 0.88
      },

      // ========================================
      // LINK SHORTENER WIDGET COMMANDS
      // ========================================
      {
        pattern: /(?:create|add).*link.*shorten/i,
        action: 'CREATE_LINK_SHORTENER',
        target: 'linkShortener',
        parameters: () => ({}),
        message: () => 'Creating a link shortener widget',
        confidence: 0.88
      },

      // ========================================
      // GAME WIDGET COMMANDS
      // ========================================
      {
        pattern: /(?:create|add|play).*tic.*tac.*toe/i,
        action: 'CREATE_TIC_TAC_TOE',
        target: 'ticTacToe',
        parameters: () => ({}),
        message: () => 'Creating a tic-tac-toe game',
        confidence: 0.88
      },
      {
        pattern: /(?:create|add|play).*wordle/i,
        action: 'CREATE_WORDLE',
        target: 'wordle',
        parameters: () => ({}),
        message: () => 'Creating a Wordle game',
        confidence: 0.88
      },
      {
        pattern: /(?:create|add|play).*snake/i,
        action: 'CREATE_SNAKE',
        target: 'snake',
        parameters: () => ({}),
        message: () => 'Creating a Snake game',
        confidence: 0.88
      },

      // ========================================
      // GENERIC LAUNCH COMMANDS
      // ========================================
      {
        pattern: /launch\s+(timer|randomiser|list|poll|questions|feedback|banner|sound|game|qr|sticker)/i,
        action: 'LAUNCH_WIDGET',
        target: (match) => match[1],
        parameters: () => ({}),
        message: (match) => `Launching ${match[1]} widget`,
        confidence: 0.80
      }
    ];

    // Try to match patterns (in order of specificity)
    for (const patternDef of patterns) {
      const { pattern, action, target, parameters, message, confidence } = patternDef;
      const match = lowerTranscript.match(pattern);

      if (match) {
        console.log(`✅ Pattern matched: ${pattern.toString()} -> ${action}`);

        // Handle dynamic target (for generic launch commands)
        const resolvedTarget = typeof target === 'function' ? target(match) : target;

        const result = {
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
        console.log('📋 Generated result:', result);
        return result;
      }
    }

    // Unknown command
    console.log('❌ No patterns matched, returning unknown command response');
    const result = {
      command: {
        action: 'UNKNOWN',
        target: 'unknown',
        parameters: {},
        confidence: 0.10
      },
      feedback: {
        message: `I'm not sure how to handle "${transcript}". Try saying "start a timer for 5 minutes" or "create a new list".`,
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
    console.log('📋 Generated unknown command result:', result);
    return result;
  }
}

// Initialize the LLM service with hybrid approach
// Uses Ollama if available, falls back to MockLLMService

// Attempt to load OllamaLLMService if USE_LOCAL_LLM is enabled
let OllamaLLMService;
const USE_LOCAL_LLM = process.env.USE_LOCAL_LLM === 'true';

if (USE_LOCAL_LLM) {
  try {
    OllamaLLMService = require('../services/OllamaLLMService');
  } catch (error) {
    console.warn('⚠️ OllamaLLMService not available:', error.message);
    console.log('💡 To use local LLM, install ollama package: npm install ollama');
    console.log('💡 See docs/LOCAL_LLM_SETUP.md for setup guide');
  }
}

const mockService = new MockLLMService();
const ollamaService = USE_LOCAL_LLM && OllamaLLMService ? new OllamaLLMService() : null;

console.log(`🤖 LLM Service Mode: ${ollamaService ? 'Ollama (with MockLLM fallback)' : 'MockLLMService (pattern matching)'}`);

// POST /api/voice-command
router.post('/', async (req, res) => {
  const requestId = Math.random().toString(36).slice(2, 11);
  const startTime = Date.now();

  try {
    const { transcript, context, userPreferences } = req.body;

    console.log(`[${new Date().toISOString()}] [${requestId}] 📨 Received voice command request:`, JSON.stringify({
      transcript,
      context,
      userPreferences
    }, null, 2));

    // Validate request
    if (!transcript || typeof transcript !== 'string') {
      console.log(`[${new Date().toISOString()}] [${requestId}] ❌ Invalid request - missing or invalid transcript`);
      return res.status(400).json({
        error: 'Transcript is required and must be a string'
      });
    }

    // Process the command with hybrid approach (Ollama → MockLLM fallback)
    console.log(`[${new Date().toISOString()}] [${requestId}] ⚙️ Processing voice command...`);

    let result;
    let usedService = 'MockLLMService';

    if (ollamaService) {
      try {
        // Try Ollama first
        console.log(`[${new Date().toISOString()}] [${requestId}] 🤖 Attempting Ollama...`);
        result = await ollamaService.processVoiceCommand(transcript, {
          context: context || {},
          userPreferences: userPreferences || {}
        });
        usedService = 'OllamaLLMService';
      } catch (ollamaError) {
        // Fallback to MockLLM if Ollama fails
        console.warn(`[${new Date().toISOString()}] [${requestId}] ⚠️ Ollama failed, falling back to MockLLM:`, ollamaError.message);
        result = await mockService.processVoiceCommand(transcript, {
          context: context || {},
          userPreferences: userPreferences || {}
        });
        usedService = 'MockLLMService (fallback)';
      }
    } else {
      // Use MockLLM by default
      result = await mockService.processVoiceCommand(transcript, {
        context: context || {},
        userPreferences: userPreferences || {}
      });
    }

    const processingTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] [${requestId}] ✅ Voice command processed by ${usedService} in ${processingTime}ms:`, JSON.stringify(result, null, 2));

    res.json(result);
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] [${requestId}] 💥 Voice command processing error after ${processingTime}ms:`, error);
    res.status(500).json({
      error: 'Failed to process voice command',
      details: error.message
    });
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    service: 'voice-command-processor',
    llmService: {
      active: ollamaService ? 'Ollama (with MockLLM fallback)' : 'MockLLMService',
      mockLLMAvailable: true
    }
  };

  // Check Ollama health if enabled
  if (ollamaService && ollamaService.healthCheck) {
    try {
      const ollamaHealth = await ollamaService.healthCheck();
      health.llmService.ollama = ollamaHealth;
    } catch (error) {
      health.llmService.ollama = {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  res.json(health);
});

module.exports = router;