# Ollama Docker Setup Guide

This guide explains how to run Ollama LLM in a Docker container, separate from your Classroom Widgets application server.

## Why Docker for Ollama?

### Advantages
- ✅ **Isolation**: Separate resource management and dependencies
- ✅ **Easy Deployment**: Same setup works everywhere (dev/staging/prod)
- ✅ **GPU Support**: Easy NVIDIA GPU configuration
- ✅ **Scalability**: Can run on different servers/machines
- ✅ **Version Control**: Pin specific Ollama versions
- ✅ **Resource Limits**: Control CPU/RAM allocation
- ✅ **No Host Pollution**: No system-wide installation needed

### Architecture

```
┌─────────────────────────┐
│  Classroom Widgets      │
│  Node.js Server         │
│  (Port 3001)            │
└───────────┬─────────────┘
            │ HTTP
            │ localhost:11434
            ▼
┌─────────────────────────┐
│  Ollama Container       │
│  (Port 11434)           │
│  - Model: phi4          │
│  - API Server           │
└─────────────────────────┘
```

## Quick Start (CPU-only)

### 1. Pull and Run Ollama Container

```bash
# Pull latest Ollama image
docker pull ollama/ollama

# Run Ollama container
docker run -d \
  --name ollama \
  -p 11434:11434 \
  -v ollama-data:/root/.ollama \
  --restart unless-stopped \
  ollama/ollama

# Verify it's running
docker ps | grep ollama
```

### 2. Pull a Model

```bash
# Pull phi4 model (recommended)
docker exec ollama ollama pull phi4

# Or try other models
docker exec ollama ollama pull llama3.2:3b
docker exec ollama ollama pull gemma2:2b
```

### 3. Test the Model

```bash
# Test via docker exec
docker exec ollama ollama run phi4 "Convert to JSON: start a timer for 5 minutes"

# Or test via HTTP API
curl http://localhost:11434/api/generate -d '{
  "model": "phi4",
  "prompt": "Convert to JSON: start a timer",
  "stream": false
}'
```

### 4. Configure Classroom Widgets

```bash
# server/.env
USE_LOCAL_LLM=true
OLLAMA_MODEL=phi4
OLLAMA_HOST=http://localhost:11434
```

### 5. Install Node.js Client

```bash
cd server
npm install ollama
```

### 6. Restart Server

```bash
npm run dev:server
```

---

## GPU Support (NVIDIA)

### Prerequisites

- NVIDIA GPU with CUDA support
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) installed
- Docker 19.03+

### Installation

```bash
# Install NVIDIA Container Toolkit (Ubuntu/Debian)
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker
```

### Run with GPU

```bash
docker run -d \
  --name ollama \
  --gpus all \
  -p 11434:11434 \
  -v ollama-data:/root/.ollama \
  --restart unless-stopped \
  ollama/ollama
```

### Verify GPU Usage

```bash
# Check GPU is detected
docker exec ollama nvidia-smi

# Run model and monitor GPU
watch -n 1 nvidia-smi
```

---

## Docker Compose (Recommended)

Create a `docker-compose.yml` file in your server directory:

### CPU-only Setup

```yaml
# server/docker-compose.yml
version: '3.8'

services:
  ollama:
    image: ollama/ollama:latest
    container_name: classroom-widgets-ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama-data:/root/.ollama
    restart: unless-stopped
    networks:
      - classroom-widgets
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:11434/api/tags"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  ollama-data:
    driver: local

networks:
  classroom-widgets:
    driver: bridge
```

### GPU-enabled Setup

```yaml
# server/docker-compose.yml
version: '3.8'

services:
  ollama:
    image: ollama/ollama:latest
    container_name: classroom-widgets-ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama-data:/root/.ollama
    restart: unless-stopped
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    networks:
      - classroom-widgets
    environment:
      - NVIDIA_VISIBLE_DEVICES=all
      - NVIDIA_DRIVER_CAPABILITIES=compute,utility
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:11434/api/tags"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  ollama-data:
    driver: local

networks:
  classroom-widgets:
    driver: bridge
```

### Usage

```bash
# Start Ollama
docker-compose up -d

# Pull model
docker-compose exec ollama ollama pull phi4

# View logs
docker-compose logs -f ollama

# Stop
docker-compose down

# Stop and remove data
docker-compose down -v
```

---

## Full Stack Docker Compose

Include both your Node.js server and Ollama:

```yaml
# docker-compose.yml (root directory)
version: '3.8'

services:
  # Classroom Widgets Server
  server:
    build: ./server
    container_name: classroom-widgets-server
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - USE_LOCAL_LLM=true
      - OLLAMA_MODEL=phi4
      - OLLAMA_HOST=http://ollama:11434
    depends_on:
      ollama:
        condition: service_healthy
    networks:
      - classroom-widgets
    restart: unless-stopped

  # Ollama LLM Service
  ollama:
    image: ollama/ollama:latest
    container_name: classroom-widgets-ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama-data:/root/.ollama
    restart: unless-stopped
    # Uncomment for GPU support
    # deploy:
    #   resources:
    #     reservations:
    #       devices:
    #         - driver: nvidia
    #           count: 1
    #           capabilities: [gpu]
    networks:
      - classroom-widgets
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:11434/api/tags"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  ollama-data:
    driver: local

networks:
  classroom-widgets:
    driver: bridge
```

**Key points:**
- Server connects to Ollama at `http://ollama:11434` (Docker network hostname)
- `depends_on` ensures Ollama starts first
- `condition: service_healthy` waits for Ollama to be ready

---

## Resource Limits

### Set Memory/CPU Limits

```yaml
services:
  ollama:
    image: ollama/ollama:latest
    # ... other config ...
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 8G
        reservations:
          cpus: '2'
          memory: 4G
```

### Recommended Resources by Model

| Model | Min RAM | Recommended RAM | Min CPU Cores | GPU VRAM |
|-------|---------|-----------------|---------------|----------|
| **Phi-4** | 4 GB | 8 GB | 4 | 6 GB |
| **Llama 3.2 (3B)** | 3 GB | 6 GB | 4 | 4 GB |
| **Gemma 2 (2B)** | 2 GB | 4 GB | 2 | 3 GB |
| **Llama 3.2 (1B)** | 1.5 GB | 3 GB | 2 | 2 GB |

---

## Model Management

### Pull Models

```bash
# Using docker exec
docker exec ollama ollama pull phi4
docker exec ollama ollama pull llama3.2:3b

# Using docker-compose
docker-compose exec ollama ollama pull phi4
```

### List Models

```bash
docker exec ollama ollama list
```

### Remove Models

```bash
docker exec ollama ollama rm phi4
```

### Pre-load Models in Dockerfile

Create a custom image with models pre-installed:

```dockerfile
# server/Dockerfile.ollama
FROM ollama/ollama:latest

# Pre-load models
RUN ollama serve & sleep 5 && \
    ollama pull phi4 && \
    ollama pull llama3.2:3b && \
    pkill ollama

# Default command
CMD ["ollama", "serve"]
```

Build and use:

```bash
docker build -f Dockerfile.ollama -t classroom-ollama .

# Use in docker-compose.yml
services:
  ollama:
    image: classroom-ollama
    # ... rest of config
```

---

## Production Deployment

### 1. Use Docker Secrets for Sensitive Data

```yaml
services:
  server:
    secrets:
      - ollama_api_key
    environment:
      - OLLAMA_API_KEY_FILE=/run/secrets/ollama_api_key

secrets:
  ollama_api_key:
    file: ./secrets/ollama_api_key.txt
```

### 2. Add Monitoring

```yaml
services:
  ollama:
    # ... other config ...
    labels:
      - "prometheus.scrape=true"
      - "prometheus.port=11434"
      - "prometheus.path=/metrics"
```

### 3. Add Logging

```yaml
services:
  ollama:
    # ... other config ...
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 4. Use Persistent Storage

```bash
# Create named volume with specific driver
docker volume create \
  --driver local \
  --opt type=none \
  --opt device=/mnt/storage/ollama \
  --opt o=bind \
  ollama-data
```

---

## Remote Ollama Server

Run Ollama on a separate machine (e.g., GPU server):

### On GPU Server

```bash
# Run Ollama exposed to network
docker run -d \
  --name ollama \
  --gpus all \
  -p 0.0.0.0:11434:11434 \
  -v ollama-data:/root/.ollama \
  --restart unless-stopped \
  ollama/ollama
```

### On Application Server

```bash
# server/.env
USE_LOCAL_LLM=true
OLLAMA_MODEL=phi4
OLLAMA_HOST=http://192.168.1.100:11434  # GPU server IP
```

**Security note:** Use firewall rules or VPN to secure the connection.

---

## Automatic Model Download

Create an initialization script:

```bash
#!/bin/bash
# server/scripts/init-ollama.sh

echo "Waiting for Ollama to be ready..."
until curl -f http://localhost:11434/api/tags >/dev/null 2>&1; do
  sleep 2
done

echo "Ollama is ready. Pulling models..."
docker exec ollama ollama pull phi4
echo "Models downloaded successfully"
```

Add to docker-compose:

```yaml
services:
  ollama-init:
    image: curlimages/curl:latest
    depends_on:
      ollama:
        condition: service_healthy
    entrypoint: /bin/sh
    command: >
      -c "
      echo 'Pulling models...';
      curl -X POST http://ollama:11434/api/pull -d '{\"name\":\"phi4\"}';
      echo 'Models ready';
      "
    networks:
      - classroom-widgets
```

---

## Troubleshooting

### Issue: Cannot connect to Ollama

**Check container is running:**
```bash
docker ps | grep ollama
docker logs ollama
```

**Check port is accessible:**
```bash
curl http://localhost:11434/api/tags
```

**Check from Node.js server:**
```bash
docker exec classroom-widgets-server curl http://ollama:11434/api/tags
```

### Issue: Out of memory

**Check container memory:**
```bash
docker stats ollama
```

**Increase memory limit:**
```yaml
deploy:
  resources:
    limits:
      memory: 16G
```

**Use smaller model:**
```bash
docker exec ollama ollama pull gemma2:2b
```

### Issue: Slow performance

**Use GPU:**
- Install NVIDIA Container Toolkit
- Add `--gpus all` flag

**Check CPU usage:**
```bash
docker stats ollama
```

**Increase CPU allocation:**
```yaml
deploy:
  resources:
    limits:
      cpus: '8'
```

### Issue: Model not found

**List available models:**
```bash
docker exec ollama ollama list
```

**Pull the model:**
```bash
docker exec ollama ollama pull phi4
```

---

## Health Checks

### API Health Check

```bash
curl http://localhost:11434/api/tags
```

Expected response:
```json
{
  "models": [
    {
      "name": "phi4:latest",
      "modified_at": "2025-10-20T12:00:00Z",
      "size": 4500000000
    }
  ]
}
```

### Model Test

```bash
curl http://localhost:11434/api/generate -d '{
  "model": "phi4",
  "prompt": "Say hello",
  "stream": false
}'
```

---

## Backup and Restore

### Backup Models

```bash
# Stop container
docker-compose down

# Backup volume
docker run --rm \
  -v ollama-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/ollama-backup.tar.gz -C /data .
```

### Restore Models

```bash
# Create volume
docker volume create ollama-data

# Restore
docker run --rm \
  -v ollama-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/ollama-backup.tar.gz -C /data
```

---

## Performance Benchmarks

### CPU-only (8-core, 16GB RAM)

| Model | Load Time | First Token | Tokens/sec | Memory Usage |
|-------|-----------|-------------|------------|--------------|
| Phi-4 | ~5s | ~800ms | 15-20 | 6 GB |
| Llama 3.2 (3B) | ~3s | ~500ms | 20-30 | 4 GB |
| Gemma 2 (2B) | ~2s | ~300ms | 30-50 | 3 GB |

### GPU (NVIDIA RTX 3060, 12GB VRAM)

| Model | Load Time | First Token | Tokens/sec | VRAM Usage |
|-------|-----------|-------------|------------|------------|
| Phi-4 | ~2s | ~50ms | 80-120 | 5 GB |
| Llama 3.2 (3B) | ~1s | ~30ms | 100-150 | 3 GB |
| Gemma 2 (2B) | ~1s | ~20ms | 150-200 | 2 GB |

---

## Cost Analysis

### Cloud Deployment (per month)

| Setup | Resources | Cost (AWS) | Cost (GCP) | Cost (DigitalOcean) |
|-------|-----------|------------|------------|---------------------|
| **CPU-only** | 4 vCPU, 16GB RAM | ~$100 | ~$95 | ~$80 |
| **GPU** | 1x T4, 8 vCPU, 30GB RAM | ~$400 | ~$380 | N/A |

Compare with:
- **OpenAI GPT-4**: $0.03/1K tokens = ~$300-1000/month
- **Anthropic Claude**: $0.024/1K tokens = ~$240-800/month

**Break-even**: Local LLM becomes cost-effective at ~100K tokens/month (moderate usage)

---

## Further Reading

- [Official Ollama Docker Documentation](https://hub.docker.com/r/ollama/ollama)
- [Ollama API Documentation](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/)
- [Docker Compose Specification](https://docs.docker.com/compose/compose-file/)

---

**Version**: 1.0
**Date**: 2025-10-20
**Author**: Classroom Widgets Development Team
