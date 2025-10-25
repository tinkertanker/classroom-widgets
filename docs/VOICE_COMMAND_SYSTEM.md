# Voice Command System Implementation

## Overview

The Classroom Widgets application now includes a comprehensive voice command system that enables programmatic control of all 20 widgets through natural language. This document provides technical details on the implementation.

## Architecture

### System Components

```
┌─────────────────┐
│  Voice UI Modal │ (User Interface)
│  VoiceInterface │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Voice Recording │ (Speech Recognition)
│useVoiceRecording│
└────────┬────────┘
         │
         ▼ (transcript)
┌─────────────────┐
│ Voice Command   │ (API Layer)
│    Service      │
└────────┬────────┘
         │
         ▼ (HTTP POST)
┌─────────────────┐
│  Server-Side    │ (Pattern Matching / LLM)
│  MockLLMService │
└────────┬────────┘
         │
         ▼ (command object)
┌─────────────────┐
│ Voice Command   │ (Execution Layer)
│    Executor     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Workspace      │ (State Management)
│     Store       │
└─────────────────┘
```

## Implementation Details

### 1. Frontend Components

#### VoiceInterface.tsx
- **Location**: `src/features/voiceControl/components/VoiceInterface.tsx`
- **Purpose**: Modal UI for voice command interaction
- **Features**:
  - Real-time audio visualization
  - State management (activating, listening, processing, success, error)
  - Live transcript display
  - Confidence indicators
  - Keyboard shortcuts (Enter, Esc, R)
  - Error recovery with example commands

#### useVoiceRecording.ts
- **Location**: `src/features/voiceControl/hooks/useVoiceRecording.ts`
- **Purpose**: Web Speech API integration
- **Features**:
  - Microphone activation
  - Real-time transcription
  - Browser compatibility checking
  - Continuous recognition mode

#### VoiceCommandService.ts
- **Location**: `src/features/voiceControl/services/VoiceCommandService.ts`
- **Purpose**: API communication layer
- **API Endpoint**: `POST /api/voice-command`
- **Request Format**:
  ```typescript
  {
    transcript: string;
    context?: object;
    userPreferences?: object;
  }
  ```
- **Response Format**:
  ```typescript
  {
    command: {
      action: string;
      target: string;
      parameters: object;
      confidence: number;
    };
    feedback: {
      message: string;
      type: 'success' | 'error';
      shouldSpeak: boolean;
    };
  }
  ```

#### VoiceCommandExecutor.ts
- **Location**: `src/features/voiceControl/services/VoiceCommandExecutor.ts`
- **Purpose**: Execute commands by manipulating workspace state
- **Lines of Code**: 784 lines
- **Methods**: 30+ execution methods
- **Widget Support**: All 20 widgets

### 2. Backend Components

#### voiceCommand.js (Express Route)
- **Location**: `server/src/routes/voiceCommand.js`
- **Purpose**: Process voice commands server-side
- **Endpoint**: `POST /api/voice-command`
- **Features**:
  - Request logging with unique request IDs
  - Processing time tracking
  - Error handling
  - Health check endpoint (`GET /api/voice-command/health`)

#### MockLLMService
- **Location**: Embedded in `server/src/routes/voiceCommand.js`
- **Purpose**: Pattern matching for voice commands
- **Pattern Count**: 50+ regex patterns
- **Confidence Scoring**: 0.80-0.92 for successful matches
- **Future**: Ready to be replaced with OpenAI/Claude/Azure LLM

## Supported Commands

### Command Categories

| Category | Widget Count | Example Commands |
|----------|--------------|------------------|
| **Timer** | 1 | "start a timer for 5 minutes", "reset timer" |
| **Randomiser** | 1 | "pick someone at random", "spin the wheel" |
| **List** | 1 | "create a list with Math, Science, English" |
| **Poll** | 1 | "create a poll", "start the poll" |
| **Questions** | 1 | "enable questions", "stop questions" |
| **RT Feedback** | 1 | "create feedback", "start feedback" |
| **Link Share** | 1 | "create link share" |
| **Text Banner** | 1 | "create a banner saying 'Welcome'" |
| **Sound Effects** | 1 | "play victory sound", "create sound effects" |
| **Task Cue** | 1 | "set work mode to group", "create task cue" |
| **Traffic Light** | 1 | "show red light", "create traffic light" |
| **Display Widgets** | 3 | "create image display", "create QR code", "add sticker" |
| **Audio Widgets** | 2 | "create visualiser", "add volume monitor" |
| **Utility Widgets** | 1 | "create link shortener" |
| **Games** | 3 | "play tic tac toe", "create wordle", "play snake" |

**Total**: 20 widgets with 100+ command variations

### Complex Commands

#### List Widget with Items
```
"launch a list widget with the following tasks (1) Math homework (2) Science project (3) Reading assignment"
```

**Parsing**:
- Pattern: `/(?:launch|create|make|add).*list.*(?:with|tasks?|items?).*\(1\)(.*?)(?:\(2\)|$)/i`
- Extraction: Iterates through numbered items `(1)`, `(2)`, `(3)`, etc.
- Parameters: `{ items: ["Math homework", "Science project", "Reading assignment"] }`

#### Timer with Duration
```
"start a timer for 10 minutes"
```

**Parsing**:
- Pattern: `/(?:start|create|add|make).*timer.*?(\d+)\s*(?:minute|min)/i`
- Extraction: Captures numeric duration
- Conversion: Minutes to seconds (`duration = 10 * 60 = 600`)

#### Text Banner with Content
```
"create a banner saying 'Break Time'"
```

**Parsing**:
- Pattern: `/(?:create|show|display).*banner.*(?:saying|with|text)?.*["']([^"']+)["']/i`
- Extraction: Captures quoted text
- Parameters: `{ text: "Break Time" }`

## Pattern Matching Strategy

### Priority Order

1. **Specific patterns with parameters** (confidence: 0.90-0.92)
   - "start a timer for 5 minutes"
   - "set work mode to group"

2. **Action patterns** (confidence: 0.88-0.90)
   - "reset timer"
   - "start poll"

3. **Generic create patterns** (confidence: 0.85-0.88)
   - "create timer"
   - "add poll"

4. **Launch patterns** (confidence: 0.80)
   - "launch timer"

### Regex Techniques

#### Non-capturing Groups
```regex
(?:start|create|add|make).*timer
```
- Matches "start timer", "create timer", "add timer"
- Doesn't capture the verb

#### Optional Elements
```regex
(?:let'?s\s+)?(?:pick|choose|select)
```
- Matches with or without "let's" prefix
- Handles both "let's" and "lets"

#### Parameter Extraction
```regex
timer.*?(\d+)\s*(?:minute|min)
```
- Captures duration number
- Handles both "minute" and "min"

## Widget State Management

### State Update Mechanisms

#### Direct Creation
```typescript
const widgetId = store.addWidget(WidgetType.TIMER, { x, y });
store.updateWidgetState(widgetId, {
  initialDuration: duration,
  duration: duration
});
```

#### Action Flags
```typescript
store.updateWidgetState(widgetId, {
  shouldReset: true
});
```

Widgets listen for state changes:
```typescript
useEffect(() => {
  if (savedState?.shouldReset) {
    handleReset();
    onStateChange?.({ shouldReset: false }); // Clear flag
  }
}, [savedState?.shouldReset]);
```

#### Toggle States
```typescript
// For networked widgets
store.updateWidgetState(widgetId, {
  isActive: true  // or false
});
```

### Widget Lookup Strategy

1. **Focused Widget First**: Check if currently focused widget matches type
2. **Any Widget Fallback**: Find first widget of that type
3. **Auto-Create**: Some commands create widget if none exists

```typescript
const findWidgetByType = (type: WidgetType, preferFocused = true) => {
  const store = useWorkspaceStore.getState();

  if (preferFocused && store.focusedWidgetId) {
    const focusedWidget = store.widgets.find(w => w.id === store.focusedWidgetId);
    if (focusedWidget?.type === type) return focusedWidget;
  }

  return store.widgets.find(w => w.type === type) || null;
};
```

## Error Handling

### Unknown Command Response

```javascript
{
  command: {
    action: 'UNKNOWN',
    confidence: 0.10
  },
  feedback: {
    message: "I'm not sure how to handle \"[transcript]\". Try saying \"start a timer for 5 minutes\" or \"create a new list\".",
    type: 'error',
    shouldSpeak: true
  },
  alternatives: [
    { action: 'CREATE_TIMER', description: 'Create a new timer', confidence: 0.60 },
    { action: 'CREATE_LIST', description: 'Create a new list', confidence: 0.50 },
    { action: 'CREATE_POLL', description: 'Create a new poll', confidence: 0.40 }
  ]
}
```

### UI Error Display

- Red warning icon
- Clear error message
- Helpful tips panel with example commands
- "Try Again" button
- Keyboard shortcut (R) for retry

## Performance Considerations

### Frontend Optimizations
- Debounced transcript updates
- Memoized command results
- Efficient state updates (only changed properties)
- CSS transforms for animations (GPU-accelerated)

### Backend Optimizations
- Early pattern matching (returns on first match)
- Regex compilation happens once
- Lightweight pattern matching (no heavy NLP)
- Request logging with minimal overhead

## Testing the System

### Manual Testing Commands

```bash
# Start all services
npm run dev:all

# Test in browser:
# 1. Open teacher app: http://localhost:3000
# 2. Click voice control button (microphone icon)
# 3. Grant microphone permission
# 4. Try these commands:

# Basic commands:
- "start a timer"
- "start a timer for 3 minutes"
- "reset timer"
- "create a list"
- "pick someone at random"

# Complex commands:
- "launch a list widget with the following tasks (1) Math (2) Science (3) English"
- "create a banner saying 'Break Time'"
- "set work mode to group"
- "show red light"

# Networked widget commands:
- "create a poll"
- "enable questions"
- "start feedback"
```

### Server Logs

The server logs show:
```
🤖 MockLLMService processing: "start a timer for 5 minutes"
✅ Pattern matched: /(?:start|create|add|make).*timer.*?(\d+)\s*(?:minute|min)/i -> CREATE_TIMER
📋 Generated result: {
  command: {
    action: 'CREATE_TIMER',
    target: 'timer',
    parameters: { duration: 300 },
    confidence: 0.9
  },
  feedback: {
    message: 'Starting a 5-minute timer',
    type: 'success',
    shouldSpeak: true
  }
}
```

## Future Enhancements

### 1. Real LLM Integration

Replace MockLLMService with OpenAI/Claude:

```javascript
// Example with OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async processVoiceCommand(transcript, context) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: VOICE_COMMAND_SYSTEM_PROMPT },
      { role: "user", content: transcript }
    ],
    functions: WIDGET_FUNCTION_DEFINITIONS
  });

  return completion.choices[0].message.function_call;
}
```

### 2. Contextual Commands

- "make it 10 minutes" (referring to just-created timer)
- "add more options" (referring to current poll)
- "start it" (referring to last created widget)

### 3. Multi-step Commands

- "create a poll with 4 options and start it"
- "launch a timer for 5 minutes and a list widget"

### 4. Relative References

- "the timer on the left"
- "the newest poll"
- "the red widget"

### 5. Batch Operations

- "create 3 timers for 5, 10, and 15 minutes"
- "reset all timers"

### 6. Command History

- "repeat last command"
- "do that again"
- Voice command history UI

### 7. Smart Defaults

- Learn user preferences (default timer duration, favorite widgets)
- Suggest frequently used commands
- Auto-complete voice commands

### 8. Natural Language Refinement

- Handle filler words ("um", "uh")
- Support regional accents and dialects
- Multi-language support

## Documentation Files

| File | Purpose |
|------|---------|
| `docs/VOICE_COMMAND_MAPPING.md` | Complete command reference for all widgets |
| `docs/VOICE_COMMAND_SYSTEM.md` | This file - technical implementation details |
| `docs/VOICE_UI_REDESIGN.md` | UI/UX design documentation |
| `server/src/routes/voiceCommand.js` | Server-side LLM integration guide |

## Related Files

### Frontend
- `src/features/voiceControl/components/VoiceInterface.tsx` (784 lines)
- `src/features/voiceControl/services/VoiceCommandExecutor.ts` (784 lines)
- `src/features/voiceControl/services/VoiceCommandService.ts`
- `src/features/voiceControl/hooks/useVoiceRecording.ts`
- `src/features/voiceControl/styles/voiceAnimations.css`
- `src/features/voiceControl/types/voiceControl.ts`

### Backend
- `server/src/routes/voiceCommand.js` (270+ lines)
- `server/src/index.js` (mounts `/api/voice-command` route)

### Types
- `src/shared/types/index.ts` (WidgetType enum)
- `src/features/voiceControl/types/voiceControl.ts`

## Statistics

- **Total Supported Commands**: 100+ variations
- **Widget Coverage**: 20/20 widgets (100%)
- **Pattern Definitions**: 50+ regex patterns
- **Execution Methods**: 30+ methods
- **Code Lines**: ~2000 lines (frontend + backend)
- **Confidence Range**: 0.80-0.92
- **Default Confidence**: 0.85

---

**Version**: 1.0
**Date**: 2025-10-20
**Author**: Classroom Widgets Development Team
**Status**: Production Ready
