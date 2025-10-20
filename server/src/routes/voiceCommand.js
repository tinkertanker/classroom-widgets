// Voice Command Processing Route
// This endpoint processes transcribed voice commands using LLM

const express = require('express');
const router = express.Router();

// Mock LLM service for now
// TODO: Replace with actual LLM integration (OpenAI, Claude, etc.)
class MockLLMService {
  async processVoiceCommand(transcript, context) {
    console.log(`🤖 MockLLMService processing: "${transcript}"`);
    console.log('🗂️ Context provided:', context);

    const lowerTranscript = transcript.toLowerCase().trim();

    // Simple pattern matching for demo purposes
    // In production, this would be replaced with actual LLM processing
    const patterns = [
      {
        pattern: /start.*timer.*(\d+).*minute/i,
        action: 'CREATE_TIMER',
        parameters: (match) => ({ duration: parseInt(match[1]) * 60 }),
        message: (match) => `Starting a ${match[1]}-minute timer`
      },
      {
        pattern: /start.*timer.*(\d+).*min/i,
        action: 'CREATE_TIMER',
        parameters: (match) => ({ duration: parseInt(match[1]) * 60 }),
        message: (match) => `Starting a ${match[1]}-minute timer`
      },
      {
        pattern: /start.*timer/i,
        action: 'CREATE_TIMER',
        parameters: () => ({ duration: 300 }), // Default 5 minutes
        message: () => 'Starting a 5-minute timer'
      },
      {
        pattern: /reset.*timer/i,
        action: 'RESET_TIMER',
        parameters: () => ({}),
        message: () => 'Resetting the timer'
      },
      {
        pattern: /pause.*timer/i,
        action: 'PAUSE_TIMER',
        parameters: () => ({}),
        message: () => 'Pausing the timer'
      },
      {
        pattern: /stop.*timer/i,
        action: 'STOP_TIMER',
        parameters: () => ({}),
        message: () => 'Stopping the timer'
      },
      {
        pattern: /create.*new.*list/i,
        action: 'CREATE_LIST',
        parameters: () => ({ items: [] }),
        message: () => 'Creating a new list'
      },
      {
        pattern: /create.*new.*poll/i,
        action: 'CREATE_POLL',
        parameters: () => ({ options: [] }),
        message: () => 'Creating a new poll'
      },
      {
        pattern: /randomise/i,
        action: 'RANDOMISE',
        parameters: () => ({}),
        message: () => 'Randomising'
      },
      {
        pattern: /roll.*dice/i,
        action: 'RANDOMISE',
        parameters: () => ({}),
        message: () => 'Rolling the dice'
      },
      {
        pattern: /spin/i,
        action: 'RANDOMISE',
        parameters: () => ({}),
        message: () => 'Spinning'
      },
      {
        pattern: /create.*new.*timer/i,
        action: 'CREATE_TIMER',
        parameters: () => ({ duration: 300 }),
        message: () => 'Creating a new timer'
      },
      {
        pattern: /add.*timer/i,
        action: 'CREATE_TIMER',
        parameters: () => ({ duration: 300 }),
        message: () => 'Adding a new timer'
      },
      {
        pattern: /delete.*timer/i,
        action: 'DELETE_TIMER',
        parameters: () => ({}),
        message: () => 'Deleting the timer'
      }
    ];

    // Try to match patterns
    for (const { pattern, action, parameters, message } of patterns) {
      const match = lowerTranscript.match(pattern);
      if (match) {
        console.log(`✅ Pattern matched: ${pattern.toString()} -> ${action}`);
        const result = {
          command: {
            action,
            target: 'timer',
            parameters: parameters(match),
            confidence: 0.85
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

    // Extract list items for list creation
    const listMatch = lowerTranscript.match(/create.*list(?:.*with)?(.+)/i);
    if (listMatch) {
      const itemsText = listMatch[1].trim();
      const items = itemsText.split(/(?:and|,|\s+)/).filter(item => item.length > 0);

      return {
        command: {
          action: 'CREATE_LIST',
          target: 'list',
          parameters: { items },
          confidence: 0.80
        },
        feedback: {
          message: `Creating a list with ${items.length} items`,
          type: 'success',
          shouldSpeak: true
        }
      };
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

// Initialize the LLM service
const llmService = new MockLLMService();

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

    // Process the command
    console.log(`[${new Date().toISOString()}] [${requestId}] ⚙️ Processing voice command...`);
    const result = await llmService.processVoiceCommand(transcript, {
      context: context || {},
      userPreferences: userPreferences || {}
    });

    const processingTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] [${requestId}] ✅ Voice command processed in ${processingTime}ms:`, JSON.stringify(result, null, 2));

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
router.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'voice-command-processor' });
});

module.exports = router;