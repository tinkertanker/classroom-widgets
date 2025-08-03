# Local Docker Testing Guide

This guide explains how to test the Classroom Widgets application locally using Docker before deploying to production.

## Prerequisites

- Docker Desktop installed and running
- Docker Compose installed (comes with Docker Desktop)
- `.env.production` file configured (see `.env.example`)

## Quick Start

### 1. Create Production Environment File

```bash
# Copy the example file
cp .env.example .env.production

# Edit the file to set production values
# Make sure to set:
# - VITE_SERVER_URL=http://localhost:3001
# - CORS_ORIGINS=http://localhost:3000,http://localhost
```

### 2. Build and Run with Docker Compose

```bash
# Build and start all services
docker-compose up --build

# Or run in detached mode (background)
docker-compose up -d --build
```

### 3. Access the Application

- **Teacher App**: http://localhost:3000
- **Student App**: http://localhost:3000/student
- **Backend API**: http://localhost:3001

## Testing Production Build

To test the exact production build:

```bash
# Use the production compose file
docker-compose -f docker-compose.prod.yml up --build

# Note: You'll need to modify VIRTUAL_HOST entries for local testing
```

## Common Commands

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f frontend
docker-compose logs -f backend
```

### Stop Services
```bash
# Stop all services
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v
```

### Rebuild After Code Changes
```bash
# Rebuild and restart
docker-compose up --build

# Rebuild specific service
docker-compose build frontend
docker-compose build backend
```

## Troubleshooting

### Port Already in Use
If you get "port already allocated" errors:

```bash
# Check what's using the ports
lsof -i :3000
lsof -i :3001

# Kill the processes or change ports in docker-compose.yml
```

### CORS Issues
Make sure your `.env.production` includes:
```
CORS_ORIGINS=http://localhost:3000,http://localhost
```

### Can't Connect to Backend
Check that `VITE_SERVER_URL` in your `.env.production` is set to:
```
VITE_SERVER_URL=http://localhost:3001
```

### Container Won't Start
Check logs for specific service:
```bash
docker-compose logs backend
docker-compose logs frontend
```

## Testing Checklist

Before deploying to production, test:

- [ ] Teacher can create a session
- [ ] Student can join via session code
- [ ] All widgets work (Poll, Timer, etc.)
- [ ] WebSocket connections are stable
- [ ] File uploads work (if applicable)
- [ ] Dark mode works correctly
- [ ] No console errors in production mode
- [ ] Performance is acceptable

## Production Deployment

Once local testing is complete:

1. Push changes to your repository
2. Use `docker-compose.prod.yml` on your production server
3. Ensure production environment variables are set
4. Set up proper domain names and SSL certificates

## Additional Notes

- The local Docker setup mimics production but uses different ports and no SSL
- Debug logs are disabled in production builds (VITE_DEBUG has no effect)
- Make sure to test with multiple browsers/devices
- Consider load testing if expecting many concurrent users