# Local LLM Setup Guide

This guide explains how to replace the MockLLMService with a local LLM running on your server for natural language voice command processing.

## Why Use a Local LLM?

### Advantages
- ✅ **Privacy**: Voice commands stay on your server, no data sent to third parties
- ✅ **No API Costs**: No per-request charges from OpenAI/Anthropic
- ✅ **Low Latency**: Faster response times (no internet roundtrip)
- ✅ **Offline Capable**: Works without internet connection
- ✅ **Customizable**: Fine-tune model for classroom-specific commands

### Disadvantages
- ❌ **Resource Requirements**: Needs CPU/RAM (optionally GPU)
- ❌ **Initial Setup**: More complex than API key configuration
- ❌ **Model Quality**: Smaller models less accurate than GPT-4/Claude

## Recommended Solutions for 2025

### Option 1: Ollama (⭐ Recommended)

**Best for**: Easy setup, production use, non-GPU systems

**Why Ollama?**
- Simple installation (single command)
- Built-in model management
- OpenAI-compatible API
- Works without GPU (CPU-only mode)
- Active community and updates
- Minimal code changes needed

#### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **RAM** | 8 GB | 16 GB |
| **Storage** | 4 GB (model) | 10+ GB (multiple models) |
| **CPU** | 4 cores | 8+ cores |
| **GPU** | None (optional) | NVIDIA with 6+ GB VRAM |
| **OS** | Linux, macOS, Windows | Linux |

#### Installation

```bash
# Linux / macOS
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# Download from: https://ollama.com/download
```

#### Recommended Models for Voice Commands

| Model | Size | RAM Required | Speed | Accuracy |
|-------|------|--------------|-------|----------|
| **Llama 3.2 (3B)** | 2.0 GB | 4 GB | ⚡⚡⚡ Fast | ⭐⭐⭐ Good |
| **Phi-4** | 4.5 GB | 8 GB | ⚡⚡ Medium | ⭐⭐⭐⭐ Excellent |
| **Gemma 2 (2B)** | 1.6 GB | 3 GB | ⚡⚡⚡ Very Fast | ⭐⭐⭐ Good |
| **Llama 3.2 (1B)** | 1.3 GB | 2 GB | ⚡⚡⚡ Ultra Fast | ⭐⭐ Fair |

**Recommended for Classroom Widgets**: **Phi-4** (best accuracy-to-speed ratio)

#### Setup Steps

**1. Install Ollama:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**2. Pull a model:**
```bash
# Pull Phi-4 (recommended)
ollama pull phi4

# Or try smaller models
ollama pull llama3.2:3b
ollama pull gemma2:2b
```

**3. Verify installation:**
```bash
ollama list
```

**4. Test the model:**
```bash
ollama run phi4 "Convert this to a command: start a timer for 5 minutes"
```

#### Server Integration

**Install Node.js client:**
```bash
cd server
npm install ollama
```

**Create OllamaLLMService.js:**

```javascript
// server/src/services/OllamaLLMService.js
const { Ollama } = require('ollama');

class OllamaLLMService {
  constructor() {
    this.ollama = new Ollama({ host: 'http://localhost:11434' });
    this.model = process.env.OLLAMA_MODEL || 'phi4';
  }

  async processVoiceCommand(transcript, context) {
    console.log(`🤖 OllamaLLMService processing: "${transcript}"`);

    const systemPrompt = `You are a voice command processor for a classroom widget application.
Convert natural language commands into structured JSON commands.

Available widgets: timer, randomiser, list, poll, questions, feedback, banner, sound effects, task cue, traffic light, image, qr code, sticker, visualiser, volume monitor, link shortener, tic-tac-toe, wordle, snake.

Available actions:
- CREATE_TIMER: { duration: number (seconds) }
- RESET_TIMER, PAUSE_TIMER, STOP_TIMER
- RANDOMISE (pick random)
- CREATE_LIST: { items: string[] }
- CREATE_POLL, START_POLL, STOP_POLL
- CREATE_QUESTIONS, START_QUESTIONS, STOP_QUESTIONS
- CREATE_TEXT_BANNER: { text: string }
- SET_TASK_CUE_MODE: { mode: "individual"|"pair"|"group"|"class" }
- SET_TRAFFIC_LIGHT: { state: "red"|"yellow"|"green" }
- PLAY_SOUND: { soundName: string }

Respond ONLY with valid JSON in this format:
{
  "command": {
    "action": "ACTION_NAME",
    "target": "widget_type",
    "parameters": {},
    "confidence": 0.9
  },
  "feedback": {
    "message": "User-friendly description",
    "type": "success",
    "shouldSpeak": true
  }
}

If unsure, use action "UNKNOWN" with confidence 0.1 and suggest alternatives.`;

    try {
      const response = await this.ollama.chat({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Convert this command to JSON: "${transcript}"\n\nContext: ${JSON.stringify(context)}`
          }
        ],
        format: 'json', // Force JSON output
        options: {
          temperature: 0.1, // Low temperature for consistent output
          top_p: 0.9,
          num_predict: 300 // Limit token output
        }
      });

      const result = JSON.parse(response.message.content);
      console.log('✅ Ollama result:', result);

      return result;
    } catch (error) {
      console.error('❌ Ollama error:', error);

      // Fallback to unknown command
      return {
        command: {
          action: 'UNKNOWN',
          target: 'unknown',
          parameters: {},
          confidence: 0.1
        },
        feedback: {
          message: `Failed to process command: ${error.message}`,
          type: 'error',
          shouldSpeak: true
        }
      };
    }
  }
}

module.exports = OllamaLLMService;
```

**Update voiceCommand.js:**

```javascript
// server/src/routes/voiceCommand.js

// Replace this line:
// class MockLLMService { ... }

// With:
const OllamaLLMService = require('../services/OllamaLLMService');
const llmService = new OllamaLLMService();
```

**Environment Variables:**

```bash
# server/.env
OLLAMA_MODEL=phi4
OLLAMA_HOST=http://localhost:11434
```

---

### Option 2: node-llama-cpp

**Best for**: Maximum control, self-contained binary models

**Advantages:**
- No external service needed (Ollama server)
- Direct model loading
- More control over inference

**System Requirements:**
- Same as Ollama
- Needs C++ compiler for installation

#### Installation

```bash
cd server
npm install node-llama-cpp
```

#### Setup

**Download a GGUF model:**
```bash
mkdir -p server/models
cd server/models

# Download Phi-4 GGUF (4-bit quantized, ~2.5GB)
wget https://huggingface.co/TheBloke/phi-4-GGUF/resolve/main/phi-4.Q4_K_M.gguf
```

**Create LlamaCppLLMService.js:**

```javascript
// server/src/services/LlamaCppLLMService.js
const { LlamaModel, LlamaContext, LlamaChatSession } = require("node-llama-cpp");
const path = require("path");

class LlamaCppLLMService {
  constructor() {
    this.model = null;
    this.context = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    console.log('🚀 Loading LLM model...');

    const modelPath = path.join(__dirname, '../../models/phi-4.Q4_K_M.gguf');

    this.model = new LlamaModel({ modelPath });
    this.context = new LlamaContext({ model: this.model });

    this.initialized = true;
    console.log('✅ LLM model loaded successfully');
  }

  async processVoiceCommand(transcript, context) {
    await this.initialize();

    console.log(`🤖 LlamaCppLLMService processing: "${transcript}"`);

    const systemPrompt = `[Same system prompt as Ollama version]`;

    const session = new LlamaChatSession({ context: this.context });

    try {
      const response = await session.prompt(
        `${systemPrompt}\n\nConvert this command to JSON: "${transcript}"`
      );

      const result = JSON.parse(response);
      console.log('✅ Llama.cpp result:', result);

      return result;
    } catch (error) {
      console.error('❌ Llama.cpp error:', error);

      return {
        command: { action: 'UNKNOWN', target: 'unknown', parameters: {}, confidence: 0.1 },
        feedback: { message: `Failed to process: ${error.message}`, type: 'error', shouldSpeak: true }
      };
    }
  }
}

module.exports = LlamaCppLLMService;
```

---

### Option 3: Transformers.js

**Best for**: Browser-based LLM, client-side processing

**Advantages:**
- Runs in browser (WebGPU/WASM)
- No server needed
- Completely private (never leaves client)

**Disadvantages:**
- Slower than server-side
- Limited model sizes
- Not ideal for server deployment

#### Installation

```bash
npm install @xenova/transformers
```

**Example usage** (for completeness, but not recommended for your server):

```javascript
import { pipeline } from '@xenova/transformers';

const generator = await pipeline('text-generation', 'Xenova/Phi-3-mini-4k-instruct');
const result = await generator(prompt, { max_new_tokens: 100 });
```

---

## Performance Comparison

### Response Time Tests (Estimated)

| Solution | Model | Hardware | Avg Response Time |
|----------|-------|----------|-------------------|
| MockLLMService | Pattern matching | Any CPU | <5ms |
| Ollama | Phi-4 | 8-core CPU, 16GB RAM | 200-800ms |
| Ollama | Phi-4 | NVIDIA RTX 3060 | 50-150ms |
| Ollama | Llama 3.2 (3B) | 8-core CPU, 16GB RAM | 150-500ms |
| Ollama | Gemma 2 (2B) | 4-core CPU, 8GB RAM | 100-300ms |
| node-llama-cpp | Phi-4 Q4 | Same as Ollama | Similar |
| OpenAI GPT-4 | Cloud | Any | 500-2000ms + latency |

### Accuracy Comparison

| Solution | Accuracy | Complex Commands | Parameter Extraction |
|----------|----------|------------------|----------------------|
| MockLLMService | ⭐⭐⭐ Good | ❌ Limited | ⭐⭐⭐ Good (regex) |
| Ollama (Phi-4) | ⭐⭐⭐⭐ Excellent | ✅ Yes | ⭐⭐⭐⭐ Excellent |
| Ollama (Llama 3.2 3B) | ⭐⭐⭐⭐ Excellent | ✅ Yes | ⭐⭐⭐⭐ Very Good |
| Ollama (Gemma 2 2B) | ⭐⭐⭐ Good | ⚠️ Partial | ⭐⭐⭐ Good |
| OpenAI GPT-4 | ⭐⭐⭐⭐⭐ Perfect | ✅ Yes | ⭐⭐⭐⭐⭐ Perfect |

---

## Deployment Checklist

### Local Development

- [ ] Install Ollama
- [ ] Pull model (`ollama pull phi4`)
- [ ] Test model (`ollama run phi4 "test"`)
- [ ] Install npm package (`npm install ollama`)
- [ ] Create OllamaLLMService.js
- [ ] Update voiceCommand.js
- [ ] Test voice commands
- [ ] Verify JSON output format

### Production Deployment

- [ ] Install Ollama on production server
- [ ] Configure Ollama as systemd service (Linux)
- [ ] Set resource limits (CPU/memory)
- [ ] Add health check endpoint
- [ ] Monitor response times
- [ ] Set up logging
- [ ] Configure fallback to MockLLMService if Ollama fails
- [ ] Document model version and setup

### Systemd Service (Linux)

```ini
# /etc/systemd/system/ollama.service
[Unit]
Description=Ollama Service
After=network-online.target

[Service]
ExecStart=/usr/local/bin/ollama serve
User=ollama
Group=ollama
Restart=always
RestartSec=3
Environment="OLLAMA_HOST=0.0.0.0:11434"

[Install]
WantedBy=default.target
```

```bash
sudo systemctl enable ollama
sudo systemctl start ollama
```

---

## Hybrid Approach (Recommended for Production)

Use **both** MockLLMService and OllamaLLMService with fallback:

```javascript
// server/src/routes/voiceCommand.js

const MockLLMService = require('./services/MockLLMService');
const OllamaLLMService = require('./services/OllamaLLMService');

const USE_LOCAL_LLM = process.env.USE_LOCAL_LLM === 'true';
const mockService = new MockLLMService();
const ollamaService = USE_LOCAL_LLM ? new OllamaLLMService() : null;

router.post('/', async (req, res) => {
  const { transcript, context, userPreferences } = req.body;

  try {
    let result;

    if (ollamaService) {
      try {
        // Try Ollama first
        result = await ollamaService.processVoiceCommand(transcript, { context, userPreferences });
      } catch (ollamaError) {
        console.error('Ollama failed, falling back to MockLLM:', ollamaError);
        result = await mockService.processVoiceCommand(transcript, { context, userPreferences });
      }
    } else {
      // Use MockLLM by default
      result = await mockService.processVoiceCommand(transcript, { context, userPreferences });
    }

    res.json(result);
  } catch (error) {
    console.error('Both services failed:', error);
    res.status(500).json({ error: 'Failed to process voice command' });
  }
});
```

**Environment variable:**
```bash
# .env
USE_LOCAL_LLM=true  # Set to false to use MockLLMService
```

---

## Cost Analysis

### Running Costs

| Solution | Setup Cost | Running Cost (Monthly) | Electricity |
|----------|------------|------------------------|-------------|
| **MockLLMService** | $0 | $0 | Negligible |
| **Ollama (CPU)** | $0 | $0 | ~$2-5 |
| **Ollama (GPU)** | GPU cost | $0 | ~$10-15 |
| **OpenAI GPT-4** | $0 | $50-500+ | $0 |
| **Anthropic Claude** | $0 | $30-300+ | $0 |

### Break-even Analysis

If you process **1,000+ commands/day**, local LLM becomes cost-effective within 1-2 months.

---

## Troubleshooting

### Ollama Issues

**Problem**: `connection refused on localhost:11434`
```bash
# Check if Ollama is running
ollama list

# Start Ollama service
ollama serve

# Or on Linux
sudo systemctl start ollama
```

**Problem**: Out of memory
```bash
# Use smaller model
ollama pull gemma2:2b

# Or adjust context size
OLLAMA_NUM_GPU=0  # Force CPU mode
```

**Problem**: Slow responses
```bash
# Use GPU acceleration (if available)
OLLAMA_NUM_GPU=1

# Or use smaller/quantized model
ollama pull llama3.2:1b
```

### Model Quality Issues

**Problem**: Incorrect command parsing

**Solution**:
1. Improve system prompt with more examples
2. Add few-shot examples in prompt
3. Use larger model (Phi-4 instead of Gemma 2B)
4. Add validation layer to check output format
5. Fallback to MockLLMService for known patterns

---

## Further Reading

- [Ollama Documentation](https://ollama.com/docs)
- [node-llama-cpp GitHub](https://github.com/withcatai/node-llama-cpp)
- [Phi-4 Model Card](https://huggingface.co/microsoft/phi-4)
- [LangChain.js + Ollama](https://js.langchain.com/docs/integrations/llms/ollama/)

---

**Version**: 1.0
**Date**: 2025-10-20
**Author**: Classroom Widgets Development Team
