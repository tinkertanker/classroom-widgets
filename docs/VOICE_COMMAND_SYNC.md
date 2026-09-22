# Voice Command Synchronization System

## Quick Reference

### 🎯 Single Source of Truth

**File**: `shared/voiceCommandDefinitions.json`

This file defines ALL widgets, actions, and parameters for voice commands.

### 🔄 How It Works

```
                    shared/voiceCommandDefinitions.json
                                    |
                    pnpm generate:voice-types (auto on build)
                                    |
                    +---------------+---------------+
                    |                               |
                    v                               v
            Frontend TS                      Backend JS
    voiceCommandDefinitions.ts      voiceCommandDefinitions.js
                    |                               |
                    v                               v
        VoiceCommandExecutor                OllamaLLMService
        (widget launcher)                   (AI prompts)
```

### ⚡ Quick Commands

```bash
# Manually regenerate type files
pnpm generate:voice-types

# Build (auto-generates)
pnpm build
pnpm build:all
```

### ✏️ Making Changes

1. Edit `shared/voiceCommandDefinitions.json`
2. Run `pnpm generate:voice-types`
3. Implement handlers in code if needed
4. Test!

### 📚 Full Documentation

- **System Overview**: [docs/VOICE_COMMAND_SHARED_DEFINITIONS.md](docs/VOICE_COMMAND_SHARED_DEFINITIONS.md)
- **Shared Folder**: [shared/README.md](shared/README.md)
- **Voice System**: [docs/VOICE_COMMAND_SYSTEM.md](docs/VOICE_COMMAND_SYSTEM.md)

### ✅ Benefits

- ✅ **Zero naming mismatches** - Frontend and backend always agree
- ✅ **Type-safe** - TypeScript catches errors at compile time
- ✅ **Easy maintenance** - Edit one JSON file, not multiple code files
- ✅ **AI consistency** - Ollama gets the same widget names automatically
- ✅ **Build integration** - Auto-generates on every build

### Example: Adding a Widget

**Before** (manual sync - error-prone):
1. Add widget to frontend executor ❌ Easy to miss
2. Add widget to backend patterns ❌ Easy to typo
3. Add widget to Ollama prompts ❌ Easy to forget
4. Hope the names match ❌ Often don't!

**Now** (automated sync):
1. Edit `shared/voiceCommandDefinitions.json` ✅
2. Run `pnpm generate:voice-types` ✅
3. Everything syncs automatically! ✅

---

**Last Updated**: January 2025
**Version**: 1.0.0
