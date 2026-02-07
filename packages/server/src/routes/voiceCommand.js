// Voice Command Processing Route
// This endpoint processes transcribed voice commands using LLM

const express = require('express');
const router = express.Router();
const { VOICE_WIDGET_TARGET_MAP } = require('../shared/constants/voiceCommandDefinitions');

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
 * - Run `npm run generate:voice-types` to regenerate TypeScript/JavaScript files
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
  async processVoiceCommand(transcript, context) {
    console.log(`🔍 PatternMatchingService processing: "${transcript}"`);
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
        pattern: /launch\s+(?:the\s+)?(?:(traffic\s+light)|(timer|randomiser|list|poll|questions|feedback|banner|sound|game|qr|sticker))\s*(?:widget)?/i,
        action: 'LAUNCH_WIDGET',
        target: (match) => {
          // match[1] is "traffic light", match[2] is single-word widgets
          const widget = match[1] || match[2];
          // Map "traffic light" to "trafficLight"
          return widget === 'traffic light' ? 'trafficLight' : widget;
        },
        parameters: () => ({}),
        message: (match) => {
          const widget = match[1] || match[2];
          return `Launching ${widget} widget`;
        },
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
        console.log('📋 Generated result:', result);
        return result;
      }
    }

    // Unknown command
    console.log('❌ No patterns matched, returning unknown command response');
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
    console.log('📋 Generated unknown command result:', result);
    return result;
  }
}

// Initialize the voice command services
// Strategy: Try fast pattern matching first, fall back to BAML AI for low-confidence matches

const USE_BAML = process.env.USE_BAML === 'true';
const CONFIDENCE_THRESHOLD = 0.80; // Use BAML AI for matches below this confidence

let BAMLVoiceCommandService;

// Load BAML service if enabled
if (USE_BAML) {
  try {
    BAMLVoiceCommandService = require('../services/BAMLVoiceCommandService');
  } catch (error) {
    console.warn('⚠️ BAMLVoiceCommandService not available:', error.message);
    console.log('💡 To use BAML, ensure it\'s installed: npm install @boundaryml/baml');
    console.log('💡 Generate client with: npx baml-cli generate');
  }
}

const patternService = new PatternMatchingService();
const bamlService = USE_BAML && BAMLVoiceCommandService ? new BAMLVoiceCommandService() : null;

// Determine active mode
const aiServiceName = bamlService
  ? `Pattern matching first (${CONFIDENCE_THRESHOLD * 100}% threshold), BAML fallback (type-safe)`
  : 'Pattern matching only';

console.log(`🤖 Voice Command Processing Mode: ${aiServiceName}`);

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

    // Quick validation: Filter out obviously invalid transcripts
    const trimmedTranscript = transcript.trim();
    const isObviouslyInvalid = (
      trimmedTranscript.length < 3 ||                    // Too short
      /^[^a-zA-Z]*$/.test(trimmedTranscript) ||         // No letters at all
      /^(uh+|um+|ah+|er+|mm+)$/i.test(trimmedTranscript) || // Just filler words
      trimmedTranscript === 'thank you' ||               // Politeness after command
      trimmedTranscript === 'thanks'
    );

    if (isObviouslyInvalid) {
      console.log(`[${new Date().toISOString()}] [${requestId}] ⚡ Fast reject: obviously invalid transcript`);
      const processingTime = Date.now() - startTime;
      const result = {
        success: false,
        command: {
          action: 'UNKNOWN',
          target: 'unknown',
          parameters: {},
          confidence: 0.10
        },
        feedback: {
          message: "I didn't catch that. Try saying something like 'create a timer' or 'launch the poll'.",
          type: 'not_understood',
          shouldSpeak: false  // Don't speak for obvious noise
        }
      };
      console.log(`[${new Date().toISOString()}] [${requestId}] ✅ Fast rejected in ${processingTime}ms`);
      return res.json(result);
    }

    // Process the command with intelligent hybrid approach (Pattern → BAML if needed)
    console.log(`[${new Date().toISOString()}] [${requestId}] ⚙️ Processing voice command...`);

    let result;
    let usedService = 'PatternMatchingService';

    // Step 1: Try fast pattern matching first
    result = await patternService.processVoiceCommand(transcript, {
      context: context || {},
      userPreferences: userPreferences || {}
    });

    // Step 2: If confidence is low, try BAML AI fallback
    if (result.command.confidence < CONFIDENCE_THRESHOLD && bamlService) {
      console.log(`[${new Date().toISOString()}] [${requestId}] ⚠️ Low confidence (${(result.command.confidence * 100).toFixed(0)}%), trying BAML...`);
      try {
        const bamlResult = await bamlService.processVoiceCommand(transcript, {
          context: context || {},
          userPreferences: userPreferences || {}
        });
        // Use BAML result if it has better confidence
        if (bamlResult.command.confidence > result.command.confidence) {
          result = bamlResult;
          usedService = 'BAMLVoiceCommandService (type-safe AI fallback)';
        } else {
          usedService = 'PatternMatchingService (BAML not better)';
        }
      } catch (bamlError) {
        console.warn(`[${new Date().toISOString()}] [${requestId}] ⚠️ BAML failed:`, bamlError.message);
        usedService = 'PatternMatchingService (BAML failed)';
        // Keep pattern matching result
      }
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
      active: aiServiceName,
      patternMatchingAvailable: true,
      bamlAvailable: !!bamlService,
      ollamaAvailable: !!ollamaService,
      confidenceThreshold: CONFIDENCE_THRESHOLD
    }
  };

  // Check BAML health if enabled
  if (bamlService && bamlService.healthCheck) {
    try {
      const bamlHealth = await bamlService.healthCheck();
      health.llmService.baml = bamlHealth;
    } catch (error) {
      health.llmService.baml = {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

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