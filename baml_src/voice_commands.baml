// BAML schema for parsing voice commands
// This provides type-safe LLM-powered command extraction

// Define the command output structure
class VoiceCommand {
  action string @description("The action to perform (e.g., CREATE_TIMER, RESET_TIMER, RANDOMISE)")
  target string @description("The widget target (e.g., timer, randomiser, list, poll)")
  confidence float @description("Confidence score from 0.0 to 1.0")
  parameters CommandParameters? @description("Optional parameters for the command")
  feedback FeedbackMessage @description("Feedback message for the user")
}

class CommandParameters {
  duration int? @description("Duration in seconds for timer commands")
  items string[]? @description("List of items for list widget")
  text string? @description("Text content for banner widget")
  soundName string? @description("Sound effect name (victory, applause, wrong, tada, drum roll, whistle, bell, airhorn)")
  mode string? @description("Work mode for task cue (individual, pair, group, class)")
  state string? @description("Traffic light state (red, yellow, green)")
  options string[]? @description("Poll options")
}

class FeedbackMessage {
  message string @description("Human-readable feedback message")
  type string @description("Message type: success or error")
  shouldSpeak bool @description("Whether to use text-to-speech for this message")
}

// Alternative command suggestions for unknown commands
class CommandAlternative {
  action string @description("Suggested action name")
  description string @description("Description of what this action does")
  confidence float @description("Confidence score for this suggestion")
}

// Main function for parsing voice commands
function ParseVoiceCommand(transcript: string) -> VoiceCommand {
  client Ollama

  prompt #"
    You are a voice command parser for a classroom widget application.
    Parse the following voice command into a structured format.

    Available widgets and their actions:

    TIMER:
    - CREATE_TIMER: Create a new timer (can specify duration like "5 minutes")
    - RESET_TIMER: Reset the timer
    - PAUSE_TIMER: Pause the timer
    - STOP_TIMER: Stop the timer

    RANDOMISER:
    - CREATE_RANDOMISER: Create a randomiser widget
    - RANDOMISE: Pick a random item (e.g., "pick someone at random")

    LIST:
    - CREATE_LIST: Create a list widget (can specify items)

    POLL:
    - CREATE_POLL: Create a poll widget
    - START_POLL: Start/activate the poll
    - STOP_POLL: Stop/pause the poll

    QUESTIONS:
    - CREATE_QUESTIONS: Create a questions widget
    - START_QUESTIONS: Enable questions from students
    - STOP_QUESTIONS: Disable questions

    RT_FEEDBACK (Real-time Feedback):
    - CREATE_RT_FEEDBACK: Create an RT feedback widget
    - START_RT_FEEDBACK: Start feedback collection
    - PAUSE_RT_FEEDBACK: Pause feedback collection

    LINK_SHARE:
    - CREATE_LINK_SHARE: Create a link share widget

    TEXT_BANNER:
    - CREATE_TEXT_BANNER: Create a text banner (can specify text)

    SOUND_EFFECTS:
    - CREATE_SOUND_EFFECTS: Create a sound effects widget
    - PLAY_SOUND: Play a sound (victory, applause, wrong, tada, drum roll, whistle, bell, airhorn)

    TASK_CUE:
    - CREATE_TASK_CUE: Create a task cue widget
    - SET_TASK_CUE_MODE: Set work mode (individual, pair, group, class)

    TRAFFIC_LIGHT:
    - CREATE_TRAFFIC_LIGHT: Create a traffic light widget
    - SET_TRAFFIC_LIGHT: Set light state (red, yellow, green)

    IMAGE_DISPLAY:
    - CREATE_IMAGE_DISPLAY: Create an image display widget

    QRCODE:
    - CREATE_QRCODE: Create a QR code widget

    STICKER:
    - CREATE_STICKER: Create a sticker widget

    VISUALISER:
    - CREATE_VISUALISER: Create a visualiser widget

    VOLUME_MONITOR:
    - CREATE_VOLUME_MONITOR: Create a volume monitor widget

    LINK_SHORTENER:
    - CREATE_LINK_SHORTENER: Create a link shortener widget

    GAMES:
    - CREATE_TIC_TAC_TOE: Create a tic-tac-toe game
    - CREATE_WORDLE: Create a Wordle game
    - CREATE_SNAKE: Create a Snake game

    Voice command to parse: "{{ transcript }}"

    Extract the action, target widget, any parameters, and provide appropriate confidence score.
    If the command is unclear, set confidence low (< 0.5) and provide a helpful error message.
    For successful parsing, set confidence between 0.8-0.95 based on clarity.

    Always provide a helpful feedback message explaining what will happen.
  "#
}

// Client configuration for Ollama
client Ollama {
  provider ollama
  options {
    model "gemma2:2b"
    base_url "http://localhost:11434"
  }
}

// Alternative client for OpenAI (commented out, can be enabled)
// client GPT4 {
//   provider openai
//   options {
//     model "gpt-4"
//     api_key env.OPENAI_API_KEY
//   }
// }

// Alternative client for Anthropic Claude (commented out, can be enabled)
// client Claude {
//   provider anthropic
//   options {
//     model "claude-3-sonnet-20240229"
//     api_key env.ANTHROPIC_API_KEY
//   }
// }
