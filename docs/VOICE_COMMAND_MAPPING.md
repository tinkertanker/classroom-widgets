# Voice Command Mapping

This document defines the comprehensive voice command system for programmatically controlling all widgets in the Classroom Widgets application.

## Overview

The voice command system provides a natural language interface for creating and controlling widgets. Commands are processed by the server-side LLM service (currently MockLLMService for pattern matching) and executed by the frontend VoiceCommandExecutor.

## Command Structure

All commands follow this structure:

```typescript
{
  command: {
    action: string,           // Action to perform (e.g., 'CREATE_TIMER', 'START_POLL')
    target: string,           // Widget type target (e.g., 'timer', 'poll')
    parameters: object,       // Command-specific parameters
    confidence: number        // LLM confidence (0.0-1.0)
  },
  feedback: {
    message: string,          // User-facing feedback message
    type: 'success' | 'error',// Result type
    shouldSpeak: boolean      // Whether to use text-to-speech
  }
}
```

## Widget Command Reference

### 1. Timer Widget

**Widget Type**: `TIMER` (WidgetType.TIMER)

#### Create Timer
- **Patterns**:
  - "start a timer for X minutes"
  - "create a timer for X min"
  - "add a timer"
  - "start timer" (default 5 minutes)
- **Action**: `CREATE_TIMER`
- **Parameters**: `{ duration: number }` (in seconds)
- **Examples**:
  - "start a timer for 10 minutes" → `{ duration: 600 }`
  - "create a 2 minute timer" → `{ duration: 120 }`

#### Reset Timer
- **Patterns**: "reset timer", "restart timer"
- **Action**: `RESET_TIMER`
- **Parameters**: `{}`
- **Target**: Focused timer or any timer
- **Example**: "reset the timer"

#### Pause Timer
- **Patterns**: "pause timer", "pause the timer"
- **Action**: `PAUSE_TIMER`
- **Parameters**: `{}`
- **Target**: Focused timer or any timer

#### Stop Timer
- **Patterns**: "stop timer", "stop the timer"
- **Action**: `STOP_TIMER`
- **Parameters**: `{}`
- **Target**: Focused timer or any timer

---

### 2. Randomiser Widget

**Widget Type**: `RANDOMISER` (WidgetType.RANDOMISER)

#### Trigger Randomiser
- **Patterns**:
  - "randomise"
  - "pick a random person"
  - "choose someone at random"
  - "spin the wheel"
  - "roll the dice"
- **Action**: `RANDOMISE` or `TRIGGER_RANDOMISER`
- **Parameters**: `{}`
- **Target**: Focused randomiser or any randomiser (creates if none exists)
- **Examples**:
  - "let's choose the next person at random"
  - "pick someone randomly"

#### Create Randomiser
- **Patterns**: "create a randomiser", "add randomiser"
- **Action**: `CREATE_RANDOMISER`
- **Parameters**: `{ items?: string[] }`
- **Examples**:
  - "create a randomiser with John, Mary, Bob"

---

### 3. List Widget

**Widget Type**: `LIST` (WidgetType.LIST)

#### Create List
- **Patterns**:
  - "create a list"
  - "make a new list"
  - "add a list with tasks X, Y, Z"
- **Action**: `CREATE_LIST`
- **Parameters**: `{ items?: string[], title?: string }`
- **Examples**:
  - "launch a list widget with the following tasks: (1) Math homework (2) Science project (3) Reading assignment"
  - "create a list with Math, Science, English"

---

### 4. Poll Widget

**Widget Type**: `POLL` (WidgetType.POLL)

#### Create Poll
- **Patterns**:
  - "create a poll"
  - "start a poll"
  - "make a poll with question X and options Y"
- **Action**: `CREATE_POLL`
- **Parameters**: `{ question?: string, options?: string[] }`
- **Examples**:
  - "create a poll asking 'What's your favorite color?' with options Red, Blue, Green"
  - "start a poll"

#### Start/Stop Poll
- **Patterns**: "start the poll", "stop the poll"
- **Action**: `START_POLL` / `STOP_POLL`
- **Parameters**: `{}`
- **Target**: Focused poll or any poll

---

### 5. Questions Widget

**Widget Type**: `QUESTIONS` (WidgetType.QUESTIONS)

#### Enable Questions
- **Patterns**:
  - "enable questions"
  - "start taking questions"
  - "open questions"
- **Action**: `START_QUESTIONS`
- **Parameters**: `{}`

#### Disable Questions
- **Patterns**: "disable questions", "stop questions"
- **Action**: `STOP_QUESTIONS`
- **Parameters**: `{}`

---

### 6. RT Feedback Widget

**Widget Type**: `RT_FEEDBACK` (WidgetType.RT_FEEDBACK)

#### Create RT Feedback
- **Patterns**: "create feedback", "add RT feedback"
- **Action**: `CREATE_RT_FEEDBACK`
- **Parameters**: `{}`

#### Start/Stop Feedback
- **Patterns**: "start feedback", "pause feedback"
- **Action**: `START_RT_FEEDBACK` / `PAUSE_RT_FEEDBACK`
- **Parameters**: `{}`

---

### 7. Link Share Widget

**Widget Type**: `LINK_SHARE` (WidgetType.LINK_SHARE)

#### Create Link Share
- **Patterns**: "create link share", "collect links"
- **Action**: `CREATE_LINK_SHARE`
- **Parameters**: `{ prompt?: string }`
- **Example**: "create a link share for homework submissions"

---

### 8. Text Banner Widget

**Widget Type**: `TEXT_BANNER` (WidgetType.TEXT_BANNER)

#### Create Banner
- **Patterns**: "create a banner", "show banner with text X"
- **Action**: `CREATE_TEXT_BANNER`
- **Parameters**: `{ text: string }`
- **Examples**:
  - "create a banner saying 'Welcome to Class'"
  - "show a banner with 'Break Time'"

---

### 9. Sound Effects Widget

**Widget Type**: `SOUND_EFFECTS` (WidgetType.SOUND_EFFECTS)

#### Create Sound Effects
- **Patterns**: "add sound effects", "create sound board"
- **Action**: `CREATE_SOUND_EFFECTS`
- **Parameters**: `{}`

#### Play Sound
- **Patterns**: "play victory sound", "play applause"
- **Action**: `PLAY_SOUND`
- **Parameters**: `{ soundName: string }`
- **Available sounds**: Victory, Applause, Wrong, Tada, Drum Roll, Whistle, Bell, Airhorn

---

### 10. Task Cue Widget

**Widget Type**: `TASK_CUE` (WidgetType.TASK_CUE)

#### Create Task Cue
- **Patterns**: "create task cue", "add work mode indicator"
- **Action**: `CREATE_TASK_CUE`
- **Parameters**: `{ mode?: 'individual' | 'pair' | 'group' | 'class' }`
- **Examples**:
  - "create a task cue"
  - "set work mode to group work"

---

### 11. Traffic Light Widget

**Widget Type**: `TRAFFIC_LIGHT` (WidgetType.TRAFFIC_LIGHT)

#### Create Traffic Light
- **Patterns**: "create traffic light", "add status indicator"
- **Action**: `CREATE_TRAFFIC_LIGHT`
- **Parameters**: `{ state?: 'red' | 'yellow' | 'green' }`
- **Examples**:
  - "create a traffic light"
  - "show red light" (creates and sets to red)

---

### 12. Image Display Widget

**Widget Type**: `IMAGE_DISPLAY` (WidgetType.IMAGE_DISPLAY)

#### Create Image Display
- **Patterns**: "show an image", "create image display"
- **Action**: `CREATE_IMAGE_DISPLAY`
- **Parameters**: `{ url?: string }`
- **Example**: "show an image from [URL]"

---

### 13. QR Code Widget

**Widget Type**: `QRCODE` (WidgetType.QRCODE)

#### Create QR Code
- **Patterns**: "create QR code", "generate QR for X"
- **Action**: `CREATE_QRCODE`
- **Parameters**: `{ url?: string, text?: string }`
- **Examples**:
  - "create a QR code for https://example.com"
  - "generate QR code"

---

### 14. Sticker/Stamp Widget

**Widget Type**: `STAMP` (WidgetType.STAMP)

#### Create Sticker
- **Patterns**: "add a sticker", "place a stamp"
- **Action**: `CREATE_STICKER`
- **Parameters**: `{ type?: string }`
- **Examples**:
  - "add a star sticker"
  - "place a checkmark stamp"

---

### 15. Visualiser Widget

**Widget Type**: `VISUALISER` (WidgetType.VISUALISER)

#### Create Visualiser
- **Patterns**: "create visualiser", "add audio visualiser"
- **Action**: `CREATE_VISUALISER`
- **Parameters**: `{}`

---

### 16. Volume Level Widget

**Widget Type**: `SOUND_MONITOR` (WidgetType.SOUND_MONITOR)

#### Create Volume Monitor
- **Patterns**: "add volume monitor", "create sound level meter"
- **Action**: `CREATE_VOLUME_MONITOR`
- **Parameters**: `{}`

---

### 17. Link Shortener Widget

**Widget Type**: `LINK_SHORTENER` (WidgetType.LINK_SHORTENER)

#### Create Link Shortener
- **Patterns**: "create link shortener", "shorten a link"
- **Action**: `CREATE_LINK_SHORTENER`
- **Parameters**: `{ url?: string }`
- **Example**: "shorten the link https://example.com/very/long/url"

---

### 18. Tic Tac Toe Widget

**Widget Type**: `TIC_TAC_TOE` (WidgetType.TIC_TAC_TOE)

#### Create Tic Tac Toe
- **Patterns**: "create tic tac toe", "add tic tac toe game"
- **Action**: `CREATE_TIC_TAC_TOE`
- **Parameters**: `{}`

---

### 19. Wordle Widget

**Widget Type**: `WORDLE` (WidgetType.WORDLE)

#### Create Wordle
- **Patterns**: "create wordle", "add word game"
- **Action**: `CREATE_WORDLE`
- **Parameters**: `{}`

---

### 20. Snake Game Widget

**Widget Type**: `SNAKE` (WidgetType.SNAKE)

#### Create Snake Game
- **Patterns**: "create snake game", "add snake"
- **Action**: `CREATE_SNAKE`
- **Parameters**: `{}`

---

## Generic Commands

### Launch Widget
- **Pattern**: "launch [widget-name]"
- **Action**: `LAUNCH_WIDGET`
- **Parameters**: `{ widgetType: WidgetType }`
- **Examples**:
  - "launch timer"
  - "launch poll"
  - "launch randomiser"

### Close Widget
- **Patterns**: "close [widget]", "remove [widget]"
- **Action**: `CLOSE_WIDGET`
- **Parameters**: `{ widgetType?: WidgetType }`
- **Target**: Focused widget or specified type
- **Example**: "close the timer"

---

## Command Resolution Priority

When multiple widgets of the same type exist:

1. **Focused Widget**: Use the currently focused widget (if applicable)
2. **First Match**: Use the first widget of that type found
3. **Create New**: If no widget exists and command is applicable, create new widget

## Error Handling

### Unknown Command
- **Response**: List suggested commands and examples
- **Alternatives**: Provide 3 most likely intended commands with confidence scores

### Missing Widget
- **Response**: "No [widget-type] found. Would you like to create one?"
- **Auto-create**: Some commands auto-create widgets (e.g., randomise)

### Invalid Parameters
- **Response**: Explain what parameters are needed
- **Example**: "Please specify a duration, like 'start a timer for 5 minutes'"

---

## Implementation Notes

### Server-Side (MockLLMService)
- Pattern matching with regex
- Extract parameters from natural language
- Return structured command objects
- Will be replaced with actual LLM (OpenAI/Claude) for production

### Frontend (VoiceCommandExecutor)
- Execute commands via workspace store
- Handle widget creation and state updates
- Focus newly created widgets
- Provide user feedback

### Widget State Management
- Commands update widget state via `store.updateWidgetState()`
- Use special state flags for actions (e.g., `shouldReset`, `shouldRandomise`)
- Widgets react to state changes in useEffect hooks

---

## Future Enhancements

1. **Contextual Commands**: "make it 10 minutes" (referring to previously created timer)
2. **Multi-step Commands**: "create a poll with 4 options and start it"
3. **Relative References**: "the timer on the left", "the newest poll"
4. **Batch Commands**: "create 3 timers for 5, 10, and 15 minutes"
5. **Command History**: "repeat last command"
6. **Smart Defaults**: Learn user preferences for default parameters

---

**Version**: 1.0
**Date**: 2025-10-20
**Author**: Classroom Widgets Development Team
