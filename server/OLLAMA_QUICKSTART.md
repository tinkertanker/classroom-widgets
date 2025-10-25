# Ollama Quick Start Guide

Get Ollama running for voice command processing in 5 minutes using Docker.

## Docker Setup

### CPU-only

```bash
# 1. Start Ollama container
docker-compose -f docker-compose.ollama.yml up -d

# 2. Pull model (choose one)
docker-compose -f docker-compose.ollama.yml exec ollama ollama pull phi4          # Best accuracy
docker-compose -f docker-compose.ollama.yml exec ollama ollama pull llama3.2:3b  # Good balance
docker-compose -f docker-compose.ollama.yml exec ollama ollama pull gemma2:2b    # Faster

# 3. Test
docker-compose -f docker-compose.ollama.yml exec ollama ollama run phi4 "Convert to JSON: start timer"

# 4. Configure
echo "USE_LOCAL_LLM=true" >> .env
echo "OLLAMA_MODEL=phi4" >> .env
echo "OLLAMA_HOST=http://localhost:11434" >> .env

# 5. Install Node.js client
npm install ollama

# 6. Restart server
npm run dev:server
```

### With GPU

```bash
# 1. Start Ollama container with GPU
docker-compose -f docker-compose.ollama-gpu.yml up -d

# 2. Verify GPU
docker exec classroom-widgets-ollama nvidia-smi

# 3. Pull model
docker-compose -f docker-compose.ollama-gpu.yml exec ollama ollama pull phi4

# 4-6. Same as CPU-only above
```


## Verification

### Check Ollama is running

```bash
# Docker
docker ps | grep ollama

# Native
curl http://localhost:11434/api/tags
```

### Test from your app

1. Start your server: `npm run dev:server`
2. Open voice control in the app
3. Say: "start a timer for 5 minutes"
4. Check server logs for "OllamaLLMService"

### Expected log output

```
🤖 LLM Service Mode: Ollama (with MockLLM fallback)
[2025-10-20T12:00:00.000Z] [abc123] 🤖 Attempting Ollama...
🤖 OllamaLLMService processing: "start a timer for 5 minutes"
⏱️ Ollama processing time: 234ms
✅ Ollama result: { command: { action: 'CREATE_TIMER', ... } }
```

## Troubleshooting

### "Cannot connect to Ollama"

```bash
# Docker: Check container is running
docker ps | grep ollama
docker logs classroom-widgets-ollama

# Native: Start Ollama
ollama serve
```

### "Model not found"

```bash
# Pull the model
docker exec classroom-widgets-ollama ollama pull phi4
# Or: ollama pull phi4
```

### Slow responses

- Use GPU version (if available)
- Try smaller model: `gemma2:2b`
- Check CPU/RAM usage: `docker stats`

## Model Comparison

| Model | Size | RAM | Speed | Accuracy |
|-------|------|-----|-------|----------|
| phi4 | 4.5GB | 8GB | Medium | ⭐⭐⭐⭐ Best |
| llama3.2:3b | 2GB | 6GB | Fast | ⭐⭐⭐ Good |
| gemma2:2b | 1.6GB | 4GB | Very Fast | ⭐⭐ Fair |

## Useful Commands

```bash
# Start Ollama
docker-compose -f docker-compose.ollama.yml up -d

# Stop Ollama
docker-compose -f docker-compose.ollama.yml down

# View logs
docker-compose -f docker-compose.ollama.yml logs -f

# List models
docker exec classroom-widgets-ollama ollama list

# Pull new model
docker exec classroom-widgets-ollama ollama pull <model>

# Remove model
docker exec classroom-widgets-ollama ollama rm <model>
```

## Complete Documentation

- **Full Setup Guide**: [docs/LOCAL_LLM_SETUP.md](../docs/LOCAL_LLM_SETUP.md)
- **Docker Details**: [docs/OLLAMA_DOCKER_SETUP.md](../docs/OLLAMA_DOCKER_SETUP.md)
- **Voice Commands**: [docs/VOICE_COMMAND_MAPPING.md](../docs/VOICE_COMMAND_MAPPING.md)

## Support

- Ollama Docs: https://ollama.com/docs
- GitHub Issues: https://github.com/anthropics/classroom-widgets/issues
