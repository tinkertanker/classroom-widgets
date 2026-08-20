// BAML schema for parsing voice commands
// This provides type-safe LLM-powered command extraction

// Define the command output structure
class VoiceCommand {
  action string @description("The action to perform (e.g., CREATE_TIMER, RESET_TIMER, RANDOMISE)")
  target string @description("The widget target (e.g., timer, randomiser, list, poll)")
  confidence float @description("Confidence score from 0.0 to 1.0")
  parameters CommandParameters? @description("Optional parameters for the command")
  feedback FeedbackMessage? @description("Feedback message for the user (optional)")
}

class CommandParameters {
  duration int? @description("Duration in seconds for timer commands")
  items string[]? @description("List of items for list widget")
  text string? @description("Text content for banner widget")
  soundName string? @description("Sound effect name")
  mode string? @description("Work mode for task cue")
  state string? @description("Traffic light state")
  options string[]? @description("Poll options")
}

class FeedbackMessage {
  message string @description("Human-readable feedback message")
  type string @description("Message type: success or error")
  shouldSpeak bool? @description("Whether to use text-to-speech (defaults to true)")
}

// Main function for parsing voice commands
function ParseVoiceCommand(transcript: string) -> VoiceCommand {
  client OllamaClient

  prompt #"
    You are a voice command parser for a classroom widget application.
    Parse the following voice command: "{{ transcript }}"

    Available actions: CREATE_TIMER, RESET_TIMER, PAUSE_TIMER, CREATE_LIST, CREATE_POLL, START_POLL,
    CREATE_RANDOMISER, RANDOMISE, CREATE_QUESTIONS, CREATE_TRAFFIC_LIGHT, CREATE_TEXT_BANNER, UNKNOWN

    Available widgets: timer, randomiser, list, poll, questions, trafficLight, textBanner, soundEffects

    CRITICAL: Return ONLY the raw JSON object. Do not wrap it in markdown code blocks. Do not include ```json or ```. Just return the pure JSON.

    Example of correct output:
    {"action": "CREATE_TIMER", "target": "timer", "confidence": 0.9, "parameters": {"duration": 300}, "feedback": {"message": "Creating a 5-minute timer", "type": "success", "shouldSpeak": true}}

    Return a JSON object with these exact fields:
    - action: one of the available actions above
    - target: one of the available widgets above
    - confidence: a number between 0.0 and 1.0
    - parameters: an object with optional fields (duration, items, text, etc.)
    - feedback: an object with message (string), type (string: "success" or "error"), shouldSpeak (boolean)

    Extract the action, target widget, parameters, and confidence (0.8-0.95 for clear commands).
    Provide a helpful feedback message.
  "#
}

// Client configuration for Ollama
// NOTE: Ollama provider uses OpenAI-compatible endpoints at /v1
client OllamaClient {
  provider ollama
  options {
    model "qwen2.5:0.5b"
    base_url "http://localhost:11434/v1"
  }
}
