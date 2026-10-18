// Regex patterns the voice command route tries, most specific first.
// See docs/VOICE_COMMAND_MAPPING.md for complete reference.
//
// Pattern Priority:
// 1. Specific patterns with parameters (e.g., "5 minute timer")
// 2. Action patterns (e.g., "reset timer", "start poll")
// 3. Generic create patterns (e.g., "create timer")
// 4. Launch patterns (e.g., "launch timer")

// Words that signal a likely command intent. Transcripts that contain none of these
// (e.g. background chatter, gibberish) skip the full ~50-pattern regex scan. BAML
// fallback is still attempted in the route when configured, so natural phrasings
// outside this list aren't permanently lost.
const INTENT_KEYWORDS = [
  'timer', 'randomiser', 'randomizer', 'randomise', 'randomize', 'random',
  'poll', 'question', 'questions',
  'feedback', 'traffic', 'light', 'banner', 'sound', 'sticker', 'stamp', 'list',
  'link', 'shorten', 'shortener', 'image', 'qr', 'qrcode', 'task', 'cue',
  'visualiser', 'visualizer', 'volume', 'monitor', 'snake', 'tic',
  'tac', 'toe', 'activity', 'fill', 'blank', 'handout', 'drop', 'box', 'share',
  'create', 'add', 'make', 'start', 'stop', 'pause', 'reset', 'restart',
  'enable', 'disable', 'open', 'close', 'play', 'set', 'change', 'show',
  'display', 'launch', 'pick', 'choose', 'select', 'spin', 'roll', 'generate',
  'place', 'activate'
];

function buildIntentRegex(keywords) {
  const escapedKeywords = keywords.map((keyword) => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`\\b(?:${escapedKeywords.join('|')})\\b`, 'i');
}

/** Build the ordered pattern table (each call returns fresh RegExp objects) */
function buildVoiceCommandPatterns() {
  return [
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
      pattern: /(?:create|show|display)[^"']*banner[^"']*["']([^"']+)["']/i,
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
}

module.exports = {
  INTENT_KEYWORDS,
  buildIntentRegex,
  buildVoiceCommandPatterns
};
