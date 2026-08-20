# Voice Command Shared Definitions System

## Overview

The voice command system uses a **single source of truth** approach to ensure that widget definitions remain consistent between the frontend and backend. This prevents issues where the backend returns widget names that the frontend doesn't recognize, and vice versa.

## Architecture

```
shared/voiceCommandDefinitions.json (SOURCE OF TRUTH)
                    |
                    | npm run generate:voice-types
                    |
        +-----------+-----------+
        |                       |
        v                       v
Frontend TypeScript         Backend JavaScript
src/shared/constants/      server/src/shared/constants/
voiceCommandDefinitions.ts voiceCommandDefinitions.js
        |                       |
        v                       v
VoiceCommandExecutor       OllamaLLMService
(widget launcher)          (AI prompt generation)
```

## The Source File

**Location**: `shared/voiceCommandDefinitions.json`

This JSON file contains:
- **Widget definitions**: Each widget's display name, target name, and type
- **Action definitions**: All available actions for each widget
- **Parameter definitions**: Parameters for each action with types and defaults
- **Aliases**: Alternative names for widgets (e.g., "randomizer" for "randomiser")

### Example Widget Definition

```json
{
  "widgets": {
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
              "enum": ["individual", "pair", "group", "class"],
              "default": "individual"
            }
          }
        }
      ]
    }
  }
}
```

## Build Process

### Automatic Generation

The generation script runs automatically before builds:

```bash
# Runs before build
npm run build

# Runs before build:all
npm run build:all
```

### Manual Generation

You can also generate the files manually:

```bash
npm run generate:voice-types
```

This command:
1. Reads `shared/voiceCommandDefinitions.json`
2. Generates TypeScript constants for the frontend
3. Generates JavaScript constants for the backend
4. Creates widget target mapping objects
5. Creates action name lists

## Generated Files

### Frontend: `src/shared/constants/voiceCommandDefinitions.ts`

Generated TypeScript file containing:

```typescript
// Auto-generated interfaces
export interface WidgetDefinition { ... }
export interface ActionDefinition { ... }

// All widget definitions
export const VOICE_WIDGET_DEFINITIONS: Record<string, WidgetDefinition>;

// Target name to WidgetType mapping
export const VOICE_WIDGET_TARGET_MAP: Record<string, string> = {
  'timer': 'TIMER',
  'taskcue': 'TASK_CUE',
  'trafficlight': 'TRAFFIC_LIGHT',
  // ... etc
};

// All valid action names
export const VOICE_ACTION_NAMES = [
  'CREATE_TIMER',
  'CREATE_TASK_CUE',
  'LAUNCH_WIDGET',
  'UNKNOWN',
  // ... etc
];
```

### Backend: `server/src/shared/constants/voiceCommandDefinitions.js`

Generated JavaScript file containing:

```javascript
// All widget definitions (same as frontend)
const VOICE_WIDGET_DEFINITIONS = { ... };

// Target name mapping (same as frontend)
const VOICE_WIDGET_TARGET_MAP = { ... };

// Action names list (same as frontend)
const VOICE_ACTION_NAMES = [ ... ];

// Helper function for Ollama prompts
function generateOllamaWidgetDocs() {
  // Auto-generates widget documentation for AI
}

module.exports = {
  VOICE_WIDGET_DEFINITIONS,
  VOICE_WIDGET_TARGET_MAP,
  VOICE_ACTION_NAMES,
  generateOllamaWidgetDocs
};
```

## Usage

### Frontend: Voice Command Executor

```typescript
import { VOICE_WIDGET_TARGET_MAP } from '../../../shared/constants/voiceCommandDefinitions';

private async executeLaunchWidget(command: any): Promise<ExecutionResult> {
  const widgetName = command.target.toLowerCase();

  // Use auto-generated map
  const widgetTypeString = VOICE_WIDGET_TARGET_MAP[widgetName];

  if (!widgetTypeString) {
    return { success: false, error: `Unknown widget type: ${widgetName}` };
  }

  const widgetType = WidgetType[widgetTypeString];
  return await this.executeCreateWidget(widgetType, command, 'LAUNCH_WIDGET');
}
```

### Backend: BAML voice command service

`packages/server/src/services/BAMLVoiceCommandService.js` derives the widget and
action lists from these constants and passes them into the BAML
`ParseVoiceCommand` function as arguments, so the LLM prompt can never drift from
the shared definitions:

```javascript
const {
  VOICE_WIDGET_DEFINITIONS,
  VOICE_ACTION_NAMES
} = require('../shared/constants/voiceCommandDefinitions');

const WIDGET_TARGETS = Object.values(VOICE_WIDGET_DEFINITIONS).map((widget) => widget.targetName);
const ACTION_NAMES = [...VOICE_ACTION_NAMES];

// ...
const result = await this.client.ParseVoiceCommand(transcript, WIDGET_TARGETS, ACTION_NAMES);
```

It deliberately sends names only rather than `generateOllamaWidgetDocs()`, whose
full per-action descriptions are too long for the small local model. See
[BAML_INTEGRATION.md](BAML_INTEGRATION.md).

The generated action list includes the JSON file's `genericActions` as well as
the per-widget actions. After parsing, the service rejects unknown actions and
action/target combinations that do not occur in these definitions.

## Adding a New Widget

To add a new widget to the voice command system:

1. **Edit the source**: `shared/voiceCommandDefinitions.json`

```json
{
  "widgets": {
    "myNewWidget": {
      "displayName": "My New Widget",
      "targetName": "myNewWidget",
      "widgetType": "MY_NEW_WIDGET",
      "actions": [
        {
          "name": "CREATE_MY_NEW_WIDGET",
          "description": "Create my new widget"
        }
      ]
    }
  }
}
```

2. **Regenerate files**:

```bash
npm run generate:voice-types
```

3. **Verify generation**:
   - Check `src/shared/constants/voiceCommandDefinitions.ts`
   - Check `server/src/shared/constants/voiceCommandDefinitions.js`

4. **Implement handlers**:
   - Frontend: Add `executeCreateMyNewWidget()` in `VoiceCommandExecutor.ts`
   - Frontend: Add case in `executeCommand()` switch statement
   - Backend patterns: Add regex patterns in `PatternMatchingService` if needed

That's it! The widget name mapping and Ollama documentation are automatically synchronized.

## Adding Widget Actions

To add a new action to an existing widget:

1. **Edit the widget in** `shared/voiceCommandDefinitions.json`:

```json
{
  "widgets": {
    "timer": {
      "actions": [
        // ... existing actions
        {
          "name": "START_TIMER",
          "description": "Start the timer",
          "parameters": {
            "autoReset": {
              "type": "boolean",
              "description": "Auto-reset when complete",
              "default": false
            }
          }
        }
      ]
    }
  }
}
```

2. **Regenerate**: `npm run generate:voice-types`

3. **Implement**: Add handler in `VoiceCommandExecutor.ts`

## Benefits

### 🎯 **Single Source of Truth**
- One JSON file defines all widgets, actions, and parameters
- No more manual synchronization between frontend and backend

### 🔄 **Automatic Synchronization**
- Changes to the JSON are automatically reflected in both codebases
- Build process ensures generated files are always up to date

### 🛡️ **Type Safety**
- TypeScript interfaces generated automatically
- Compile-time errors if widget names don't match

### 🤖 **AI Consistency**
- Ollama prompts auto-generated from the same source
- Frontend executor uses the same widget names
- Impossible for them to get out of sync

### 📝 **Easy Maintenance**
- Add widgets by editing one JSON file
- Documentation auto-generated
- No manual string matching required

## Troubleshooting

### Error: "Unknown widget type: X"

**Cause**: The widget name isn't in the generated mapping

**Fix**:
1. Check `shared/voiceCommandDefinitions.json` contains the widget
2. Verify the `targetName` matches what's being sent
3. Run `npm run generate:voice-types`
4. Check generated files were updated

### Ollama returns different widget names than frontend expects

**Cause**: Generated files are out of date

**Fix**:
1. Run `npm run generate:voice-types`
2. Restart both frontend and backend servers

### Generated files don't update

**Cause**: Script hasn't run

**Fix**:
1. Manually run: `npm run generate:voice-types`
2. Check for errors in script execution
3. Verify `shared/voiceCommandDefinitions.json` is valid JSON

## Files Reference

| File | Type | Purpose |
|------|------|---------|
| `shared/voiceCommandDefinitions.json` | JSON | **SOURCE OF TRUTH** - All widget definitions |
| `scripts/generateVoiceCommandTypes.cjs` | Node.js | Generation script |
| `src/shared/constants/voiceCommandDefinitions.ts` | TypeScript | Generated frontend constants |
| `server/src/shared/constants/voiceCommandDefinitions.js` | JavaScript | Generated backend constants |

## Related Documentation

- [Voice Command System](./VOICE_COMMAND_SYSTEM.md) - Overall voice system architecture
- [Voice Command Mapping](./VOICE_COMMAND_MAPPING.md) - Available commands and patterns
- [Local LLM Setup](./LOCAL_LLM_SETUP.md) - Setting up Ollama
