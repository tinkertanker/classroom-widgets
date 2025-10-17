// Voice Control System Types

export interface VoiceRecordingState {
  isListening: boolean;
  isProcessing: boolean;
  transcript: string;
  confidence: number;
  error: string | null;
}

export interface VoiceCommand {
  action: string;
  target: string;
  parameters: Record<string, any>;
  confidence: number;
}

export interface VoiceCommandResponse {
  command: VoiceCommand;
  feedback: {
    message: string;
    type: 'success' | 'confirm' | 'info' | 'error';
    shouldSpeak?: boolean;
  };
  alternatives?: Array<{
    action: string;
    description: string;
    confidence: number;
  }>;
}

export interface VoiceContext {
  activeWidgets: Array<{
    id: string;
    type: string;
    state?: any;
    isFocused: boolean;
  }>;
  availableWidgets: string[];
  screenPosition?: { x: number; y: number };
}

export interface VoiceCommandRequest {
  transcript: string;
  context: VoiceContext;
  userPreferences?: {
    defaultTimerDuration?: number;
    preferredPositions?: string[];
  };
}

export interface ExecutionResult {
  success: boolean;
  error?: string;
  widgetId?: string;
  action?: string;
}

export interface TranscriptionResult {
  transcript: string;
  confidence: number;
  alternatives?: Array<{
    transcript: string;
    confidence: number;
  }>;
}

// Voice UI States
export type VoiceInterfaceState =
  | 'idle'           // No voice interaction
  | 'activating'     // Double command pressed, starting up
  | 'listening'      // Recording audio
  | 'processing'     // Transcribing and processing
  | 'executing'      // Executing command
  | 'success'        // Command executed successfully
  | 'error';         // Error occurred

// Hook return types
export interface UseVoiceRecordingReturn extends VoiceRecordingState {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  resetState: () => void;
}

export interface UseVoiceControlReturn {
  voiceState: VoiceInterfaceState;
  transcript: string;
  command: VoiceCommand | null;
  error: string | null;
  startVoiceControl: () => void;
  stopVoiceControl: () => void;
  executeVoiceCommand: (transcript: string) => Promise<void>;
}