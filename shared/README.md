# Shared Definitions

This directory contains the **single source of truth** for voice command widget definitions.

## 📋 voiceCommandDefinitions.json

This JSON file defines all widgets, actions, and parameters for the voice command system. It serves as the authoritative source that keeps the frontend and backend perfectly synchronized.

### When to Edit This File

Edit this file when you need to:

- ✅ Add a new widget to the voice command system
- ✅ Add a new action to an existing widget
- ✅ Change widget naming (targetName, aliases)
- ✅ Add or modify action parameters
- ✅ Update widget display names

### After Editing

**Always run after making changes:**

```bash
npm run generate:voice-types
```

This regenerates:
- `src/shared/constants/voiceCommandDefinitions.ts` (Frontend TypeScript)
- `server/src/shared/constants/voiceCommandDefinitions.js` (Backend JavaScript)

### Build Integration

The generation script runs automatically during builds:

```bash
npm run build        # Auto-generates before building
npm run build:all    # Auto-generates before building all
```

## 📖 Documentation

For complete documentation on how this system works, see:

**[docs/VOICE_COMMAND_SHARED_DEFINITIONS.md](../docs/VOICE_COMMAND_SHARED_DEFINITIONS.md)**

## 🔍 Quick Example

```json
{
  "widgets": {
    "myWidget": {
      "displayName": "My Widget",
      "targetName": "myWidget",
      "widgetType": "MY_WIDGET",
      "aliases": ["widget"],
      "actions": [
        {
          "name": "CREATE_MY_WIDGET",
          "description": "Create my widget",
          "parameters": {
            "color": {
              "type": "string",
              "description": "Widget color",
              "default": "blue"
            }
          }
        }
      ]
    }
  }
}
```

After saving and running `npm run generate:voice-types`:

- ✅ Frontend can launch with: `executeLaunchWidget({ target: "myWidget" })`
- ✅ Ollama AI knows about "My Widget" and its parameters
- ✅ Both use the exact same naming - no mismatches possible

## ⚠️ Important

- **DO NOT** manually edit the generated `.ts` or `.js` files
- **ALWAYS** edit this JSON file instead
- **ALWAYS** run `npm run generate:voice-types` after changes
- Check this file into version control
- The generated files are also checked in (so builds work without regeneration)
