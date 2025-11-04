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
  soundName string? @description("Sound effect name")
  mode string? @description("Work mode for task cue")
  state string? @description("Traffic light state")
  options string[]? @description("Poll options")
}

class FeedbackMessage {
  message string @description("Human-readable feedback message")
  type string @description("Message type: success or error")
  shouldSpeak bool @description("Whether to use text-to-speech")
}

// Main function for parsing voice commands
function ParseVoiceCommand(transcript: string) -> VoiceCommand {
  client OllamaClient

  prompt #"
    You are a voice command parser for a classroom widget application.
    Parse the following voice command: "{{ transcript }}"

    Extract the action, target widget, parameters, and confidence (0.8-0.95 for clear commands).
    Provide a helpful feedback message.
  "#
}

// Client configuration for Ollama
client OllamaClient {
  provider ollama
  options {
    model "llama2"
    base_url "http://localhost:11434"
  }
}
