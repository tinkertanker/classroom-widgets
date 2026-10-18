// Voice Command Processing Route
// This endpoint processes transcribed voice commands using LLM

const express = require('express');
const router = express.Router();

const { ipRateLimit } = require('../middleware/rateLimit');
const PatternMatchingService = require('../services/PatternMatchingService');

const VOICE_COMMAND_DEBUG = process.env.VOICE_COMMAND_DEBUG === 'true';

// Real voice transcripts are a sentence or two; anything longer is abuse.
const MAX_TRANSCRIPT_LENGTH = 1000;

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
    if (VOICE_COMMAND_DEBUG) {
      console.log('💡 To use BAML, ensure it\'s installed: pnpm --filter @classroom-widgets/server add @boundaryml/baml');
      console.log('💡 Generate client with: npx baml-cli generate');
    }
  }
}

const patternService = new PatternMatchingService();
const bamlService = USE_BAML && BAMLVoiceCommandService ? new BAMLVoiceCommandService() : null;

// Determine active mode
const aiServiceName = bamlService
  ? `Pattern matching first (${CONFIDENCE_THRESHOLD * 100}% threshold), BAML fallback (type-safe)`
  : 'Pattern matching only';

if (VOICE_COMMAND_DEBUG) {
  console.log(`🤖 Voice Command Processing Mode: ${aiServiceName}`);
}

// The teacher app shows the body's `error` text to the teacher.
const voiceRateLimit = ipRateLimit(
  { windowMs: 10_000, max: 20 },
  { body: { error: 'Too many voice command requests. Please slow down.' } }
);

// Per-client limit on the unauthenticated POST; /health stays unlimited.
router.post('/', voiceRateLimit, async (req, res) => {
  const requestId = Math.random().toString(36).slice(2, 11);
  const startTime = Date.now();

  try {
    const { transcript, context, userPreferences } = req.body;

    if (VOICE_COMMAND_DEBUG) {
      console.log(`[${new Date().toISOString()}] [${requestId}] 📨 Received voice command request:`, JSON.stringify({
        transcript,
        context,
        userPreferences
      }, null, 2));
    }

    // Validate request
    if (!transcript || typeof transcript !== 'string') {
      if (VOICE_COMMAND_DEBUG) {
        console.log(`[${new Date().toISOString()}] [${requestId}] ❌ Invalid request - missing or invalid transcript`);
      }
      return res.status(400).json({
        error: 'Transcript is required and must be a string'
      });
    }

    // Length cap must run before trim()/regexes so pathological inputs can't
    // hit the pattern matchers at all.
    if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
      return res.status(400).json({
        error: `Transcript is too long (max ${MAX_TRANSCRIPT_LENGTH} characters)`
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
      if (VOICE_COMMAND_DEBUG) {
        console.log(`[${new Date().toISOString()}] [${requestId}] ⚡ Fast reject: obviously invalid transcript`);
      }
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
      if (VOICE_COMMAND_DEBUG) {
        console.log(`[${new Date().toISOString()}] [${requestId}] ✅ Fast rejected in ${processingTime}ms`);
      }
      return res.json(result);
    }

    // Process the command with intelligent hybrid approach (Pattern → BAML if needed)
    if (VOICE_COMMAND_DEBUG) {
      console.log(`[${new Date().toISOString()}] [${requestId}] ⚙️ Processing voice command...`);
    }

    let result;
    let usedService = 'PatternMatchingService';

    // Step 1: Try fast pattern matching first
    result = await patternService.processVoiceCommand(transcript, {
      context: context || {},
      userPreferences: userPreferences || {}
    });

    // The intent prefilter marks results that bypassed the pattern scan. Strip the
    // marker before responding and tag it for telemetry. We deliberately do NOT use
    // it to skip BAML: when BAML is configured, natural phrasings outside the
    // INTENT_KEYWORDS list (e.g. "five minute countdown", "applause") should still
    // get a chance via BAML rather than being permanently UNKNOWN.
    const viaIntentPrefilter = result.viaIntentPrefilter === true;
    if (viaIntentPrefilter) {
      delete result.viaIntentPrefilter;
      usedService = 'PatternMatchingService (intent prefilter)';
    }

    // Step 2: If confidence is low, try BAML AI fallback
    if (result.command.confidence < CONFIDENCE_THRESHOLD && bamlService) {
      if (VOICE_COMMAND_DEBUG) {
        console.log(`[${new Date().toISOString()}] [${requestId}] ⚠️ Low confidence (${(result.command.confidence * 100).toFixed(0)}%), trying BAML...`);
      }
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
    if (VOICE_COMMAND_DEBUG) {
      console.log(`[${new Date().toISOString()}] [${requestId}] ✅ Voice command processed by ${usedService} in ${processingTime}ms:`, JSON.stringify(result, null, 2));
    }

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
      ollamaAvailable: false,
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

  res.json(health);
});

module.exports = router;