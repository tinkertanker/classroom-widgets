// AUTO-GENERATED FILE - DO NOT EDIT
// Generated from shared/voiceCommandDefinitions.json
// Run 'npm run generate:voice-types' to regenerate

/**
 * Voice Command Widget Definitions
 * This file is auto-generated to ensure consistency between frontend and backend
 */

/**
 * All widget definitions from shared config
 */
const VOICE_WIDGET_DEFINITIONS = {
  "timer": {
    "displayName": "Timer",
    "targetName": "timer",
    "widgetType": "TIMER",
    "actions": [
      {
        "name": "CREATE_TIMER",
        "description": "Create a new timer widget",
        "parameters": {
          "duration": {
            "type": "number",
            "description": "Duration in seconds",
            "default": 300
          }
        }
      },
      {
        "name": "RESET_TIMER",
        "description": "Reset the timer"
      },
      {
        "name": "PAUSE_TIMER",
        "description": "Pause the timer"
      },
      {
        "name": "STOP_TIMER",
        "description": "Stop the timer"
      }
    ]
  },
  "randomiser": {
    "displayName": "Randomiser",
    "targetName": "randomiser",
    "widgetType": "RANDOMISER",
    "aliases": [
      "randomizer"
    ],
    "actions": [
      {
        "name": "CREATE_RANDOMISER",
        "description": "Create a new randomiser widget"
      },
      {
        "name": "RANDOMISE",
        "description": "Pick a random item"
      }
    ]
  },
  "list": {
    "displayName": "List",
    "targetName": "list",
    "widgetType": "LIST",
    "actions": [
      {
        "name": "CREATE_LIST",
        "description": "Create a new list widget",
        "parameters": {
          "items": {
            "type": "array",
            "description": "List of items",
            "default": []
          }
        }
      }
    ]
  },
  "poll": {
    "displayName": "Poll",
    "targetName": "poll",
    "widgetType": "POLL",
    "actions": [
      {
        "name": "CREATE_POLL",
        "description": "Create a new poll widget",
        "parameters": {
          "options": {
            "type": "array",
            "description": "Poll options",
            "default": [
              "Option 1",
              "Option 2"
            ]
          }
        }
      },
      {
        "name": "START_POLL",
        "description": "Start/activate the poll"
      },
      {
        "name": "STOP_POLL",
        "description": "Stop/pause the poll"
      }
    ]
  },
  "questions": {
    "displayName": "Questions",
    "targetName": "questions",
    "widgetType": "QUESTIONS",
    "actions": [
      {
        "name": "CREATE_QUESTIONS",
        "description": "Create a questions widget"
      },
      {
        "name": "START_QUESTIONS",
        "description": "Enable questions from students"
      },
      {
        "name": "STOP_QUESTIONS",
        "description": "Disable questions"
      }
    ]
  },
  "rtFeedback": {
    "displayName": "RT Feedback",
    "targetName": "rtFeedback",
    "widgetType": "RT_FEEDBACK",
    "aliases": [
      "feedback"
    ],
    "actions": [
      {
        "name": "CREATE_RT_FEEDBACK",
        "description": "Create an RT feedback widget"
      },
      {
        "name": "START_RT_FEEDBACK",
        "description": "Start feedback collection"
      },
      {
        "name": "PAUSE_RT_FEEDBACK",
        "description": "Pause feedback collection"
      }
    ]
  },
  "linkShare": {
    "displayName": "Link Share",
    "targetName": "linkShare",
    "widgetType": "LINK_SHARE",
    "actions": [
      {
        "name": "CREATE_LINK_SHARE",
        "description": "Create a link share widget"
      }
    ]
  },
  "textBanner": {
    "displayName": "Text Banner",
    "targetName": "textBanner",
    "widgetType": "TEXT_BANNER",
    "aliases": [
      "banner"
    ],
    "actions": [
      {
        "name": "CREATE_TEXT_BANNER",
        "description": "Create a text banner widget",
        "parameters": {
          "text": {
            "type": "string",
            "description": "Banner text",
            "default": "Welcome"
          }
        }
      }
    ]
  },
  "soundEffects": {
    "displayName": "Sound Effects",
    "targetName": "soundEffects",
    "widgetType": "SOUND_EFFECTS",
    "aliases": [
      "sound"
    ],
    "actions": [
      {
        "name": "CREATE_SOUND_EFFECTS",
        "description": "Create a sound effects widget"
      },
      {
        "name": "PLAY_SOUND",
        "description": "Play a sound effect",
        "parameters": {
          "soundName": {
            "type": "string",
            "description": "Name of the sound",
            "enum": [
              "victory",
              "applause",
              "wrong",
              "tada",
              "drum roll",
              "whistle",
              "bell",
              "airhorn"
            ]
          }
        }
      }
    ]
  },
  "taskCue": {
    "displayName": "Task Cue",
    "targetName": "taskCue",
    "widgetType": "TASK_CUE",
    "actions": [
      {
        "name": "CREATE_TASK_CUE",
        "description": "Create a task cue widget",
        "parameters": {
          "mode": {
            "type": "string",
            "description": "Work mode",
            "enum": [
              "individual",
              "pair",
              "group",
              "class"
            ],
            "default": "individual"
          }
        }
      },
      {
        "name": "SET_TASK_CUE_MODE",
        "description": "Set work mode",
        "parameters": {
          "mode": {
            "type": "string",
            "description": "Work mode",
            "enum": [
              "individual",
              "pair",
              "group",
              "class"
            ]
          }
        }
      }
    ]
  },
  "trafficLight": {
    "displayName": "Traffic Light",
    "targetName": "trafficLight",
    "widgetType": "TRAFFIC_LIGHT",
    "actions": [
      {
        "name": "CREATE_TRAFFIC_LIGHT",
        "description": "Create a traffic light widget",
        "parameters": {
          "state": {
            "type": "string",
            "description": "Light state",
            "enum": [
              "red",
              "yellow",
              "green"
            ],
            "default": "red"
          }
        }
      },
      {
        "name": "SET_TRAFFIC_LIGHT",
        "description": "Set traffic light state",
        "parameters": {
          "state": {
            "type": "string",
            "description": "Light state",
            "enum": [
              "red",
              "yellow",
              "green"
            ]
          }
        }
      }
    ]
  },
  "imageDisplay": {
    "displayName": "Image Display",
    "targetName": "imageDisplay",
    "widgetType": "IMAGE_DISPLAY",
    "actions": [
      {
        "name": "CREATE_IMAGE_DISPLAY",
        "description": "Create an image display widget"
      }
    ]
  },
  "qrcode": {
    "displayName": "QR Code",
    "targetName": "qrcode",
    "widgetType": "QRCODE",
    "aliases": [
      "qr"
    ],
    "actions": [
      {
        "name": "CREATE_QRCODE",
        "description": "Create a QR code widget"
      }
    ]
  },
  "sticker": {
    "displayName": "Sticker",
    "targetName": "sticker",
    "widgetType": "STAMP",
    "actions": [
      {
        "name": "CREATE_STICKER",
        "description": "Create a sticker widget"
      }
    ]
  },
  "visualiser": {
    "displayName": "Visualiser",
    "targetName": "visualiser",
    "widgetType": "VISUALISER",
    "actions": [
      {
        "name": "CREATE_VISUALISER",
        "description": "Create a visualiser widget"
      }
    ]
  },
  "volumeMonitor": {
    "displayName": "Volume Monitor",
    "targetName": "volumeMonitor",
    "widgetType": "SOUND_MONITOR",
    "actions": [
      {
        "name": "CREATE_VOLUME_MONITOR",
        "description": "Create a volume monitor widget"
      }
    ]
  },
  "linkShortener": {
    "displayName": "Link Shortener",
    "targetName": "linkShortener",
    "widgetType": "LINK_SHORTENER",
    "actions": [
      {
        "name": "CREATE_LINK_SHORTENER",
        "description": "Create a link shortener widget"
      }
    ]
  },
  "ticTacToe": {
    "displayName": "Tic Tac Toe",
    "targetName": "ticTacToe",
    "widgetType": "TIC_TAC_TOE",
    "aliases": [
      "game"
    ],
    "actions": [
      {
        "name": "CREATE_TIC_TAC_TOE",
        "description": "Create a tic-tac-toe game widget"
      }
    ]
  },
  "wordle": {
    "displayName": "Wordle",
    "targetName": "wordle",
    "widgetType": "WORDLE",
    "actions": [
      {
        "name": "CREATE_WORDLE",
        "description": "Create a Wordle game widget"
      }
    ]
  },
  "snake": {
    "displayName": "Snake",
    "targetName": "snake",
    "widgetType": "SNAKE",
    "actions": [
      {
        "name": "CREATE_SNAKE",
        "description": "Create a Snake game widget"
      }
    ]
  }
};

/**
 * Widget target name to WidgetType mapping
 */
const VOICE_WIDGET_TARGET_MAP = {
  'timer': 'TIMER',
  'randomiser': 'RANDOMISER',
  'randomizer': 'RANDOMISER',
  'list': 'LIST',
  'poll': 'POLL',
  'questions': 'QUESTIONS',
  'rtfeedback': 'RT_FEEDBACK',
  'feedback': 'RT_FEEDBACK',
  'linkshare': 'LINK_SHARE',
  'textbanner': 'TEXT_BANNER',
  'banner': 'TEXT_BANNER',
  'soundeffects': 'SOUND_EFFECTS',
  'sound': 'SOUND_EFFECTS',
  'taskcue': 'TASK_CUE',
  'trafficlight': 'TRAFFIC_LIGHT',
  'imagedisplay': 'IMAGE_DISPLAY',
  'qrcode': 'QRCODE',
  'qr': 'QRCODE',
  'sticker': 'STAMP',
  'visualiser': 'VISUALISER',
  'volumemonitor': 'SOUND_MONITOR',
  'linkshortener': 'LINK_SHORTENER',
  'tictactoe': 'TIC_TAC_TOE',
  'game': 'TIC_TAC_TOE',
  'wordle': 'WORDLE',
  'snake': 'SNAKE',
};

/**
 * All valid action names
 */
const VOICE_ACTION_NAMES = [
  'CREATE_IMAGE_DISPLAY',
  'CREATE_LINK_SHARE',
  'CREATE_LINK_SHORTENER',
  'CREATE_LIST',
  'CREATE_POLL',
  'CREATE_QRCODE',
  'CREATE_QUESTIONS',
  'CREATE_RANDOMISER',
  'CREATE_RT_FEEDBACK',
  'CREATE_SNAKE',
  'CREATE_SOUND_EFFECTS',
  'CREATE_STICKER',
  'CREATE_TASK_CUE',
  'CREATE_TEXT_BANNER',
  'CREATE_TIC_TAC_TOE',
  'CREATE_TIMER',
  'CREATE_TRAFFIC_LIGHT',
  'CREATE_VISUALISER',
  'CREATE_VOLUME_MONITOR',
  'CREATE_WORDLE',
  'PAUSE_RT_FEEDBACK',
  'PAUSE_TIMER',
  'PLAY_SOUND',
  'RANDOMISE',
  'RESET_TIMER',
  'SET_TASK_CUE_MODE',
  'SET_TRAFFIC_LIGHT',
  'START_POLL',
  'START_QUESTIONS',
  'START_RT_FEEDBACK',
  'STOP_POLL',
  'STOP_QUESTIONS',
  'STOP_TIMER',
];

/**
 * Generate Ollama system prompt documentation from definitions
 */
function generateOllamaWidgetDocs() {
  let docs = '';

  for (const [key, widget] of Object.entries(VOICE_WIDGET_DEFINITIONS)) {
    docs += `**${widget.displayName.toUpperCase()} WIDGET:**\n`;

    for (const action of widget.actions) {
      docs += `- ${action.name}`;

      if (action.parameters) {
        const params = Object.entries(action.parameters).map(([name, param]) => {
          if (param.enum) {
            return `${name}: "${param.enum.join('"|"')}"`;
          }
          return `${name}: ${param.type}`;
        }).join(', ');
        docs += `: { ${params} }`;
      }

      docs += `\n  Examples: ${action.description}\n`;
    }

    docs += '\n';
  }

  // Add valid target list
  const targets = Object.values(VOICE_WIDGET_DEFINITIONS).map(w => `"${w.targetName}"`);
  docs += `**Valid LAUNCH_WIDGET targets (use camelCase):**\n`;
  docs += targets.join(', ') + '\n';

  return docs;
}

module.exports = {
  VOICE_WIDGET_DEFINITIONS,
  VOICE_WIDGET_TARGET_MAP,
  VOICE_ACTION_NAMES,
  generateOllamaWidgetDocs
};
