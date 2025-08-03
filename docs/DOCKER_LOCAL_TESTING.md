# Local Docker Testing Guide (Staging Environment)

This guide explains how to test the Classroom Widgets application locally using Docker in a staging environment before deploying to production.

## Prerequisites

- Docker Desktop installed and running
- Docker Compose installed (comes with Docker Desktop)
- `.env.staging` file configured (see `.env.staging.example`)

## Quick Start

### 1. Create Staging Environment File

```bash
# Copy the example file
cp .env.staging.example .env.staging

# Edit the file to set staging values
# Make sure to set:
# - VITE_SERVER_URL=http://localhost:3001
# - CORS_ORIGINS=http://localhost:3000,http://localhost
```

### 2. Build and Run with Docker Compose

```bash
# Build and start all services
docker compose -f docker-compose.staging.yml up --build

# Or run in detached mode (background)
docker compose -f docker-compose.staging.yml up -d --build
```

### 3. Access the Application

- **Teacher App**: http://localhost:3000
- **Student App**: http://localhost:3000/student
- **Backend API**: http://localhost:3001

## Using the Test Script

For convenience, use the provided test script:

```bash
# Run the staging test script
./docker-test-local.sh
```

This script will:
- Check if Docker is running
- Create `.env.staging` if it doesn't exist
- Build and start the staging environment
- Display the URLs for accessing the application

## Common Commands

### View Logs
```bash
# All services
docker compose -f docker-compose.staging.yml logs -f

# Specific service
docker compose -f docker-compose.staging.yml logs -f frontend
docker compose -f docker-compose.staging.yml logs -f backend
```

### Stop Services
```bash
# Stop all services
docker compose -f docker-compose.staging.yml down

# Stop and remove volumes (clean slate)
docker compose -f docker-compose.staging.yml down -v
```

### Rebuild After Code Changes
```bash
# Rebuild and restart
docker compose -f docker-compose.staging.yml up --build

# Rebuild specific service
docker compose -f docker-compose.staging.yml build frontend
docker compose -f docker-compose.staging.yml build backend
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
Make sure your `.env.staging` includes:
```
CORS_ORIGINS=http://localhost:3000,http://localhost
```

### Can't Connect to Backend
Check that `VITE_SERVER_URL` in your `.env.staging` is set to:
```
VITE_SERVER_URL=http://localhost:3001
```

### Container Won't Start
Check logs for specific service:
```bash
docker compose -f docker-compose.staging.yml logs backend
docker compose -f docker-compose.staging.yml logs frontend
```

## Staging Testing Checklist

Before deploying to production, test in your staging environment:

- [ ] Teacher can create a session
- [ ] Student can join via session code
- [ ] All widgets work (Poll, Timer, etc.)
- [ ] WebSocket connections are stable
- [ ] File uploads work (if applicable)
- [ ] Dark mode works correctly
- [ ] No console errors in staging mode
- [ ] Performance is acceptable
- [ ] Debug logs are disabled (unless VITE_DEBUG=true)

## Production Deployment

Once local testing is complete:

1. Push changes to your repository
2. Use `docker-compose.prod.yml` on your production server
3. Ensure production environment variables are set
4. Set up proper domain names and SSL certificates

## Additional Notes

- The staging environment mimics production but uses different ports and no SSL
- Debug logs can be enabled in staging by setting VITE_DEBUG=true in `.env.staging`
- This is a STAGING environment - perfect for testing before production deployment
- Make sure to test with multiple browsers/devices
- Consider load testing if expecting many concurrent users