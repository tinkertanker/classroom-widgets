# NPM Scripts Guide

This guide explains all available npm scripts for development and deployment.

## Quick Start

### For Development
```bash
# Install all dependencies (run once)
npm run install:all

# Run everything for development
npm run dev:all
```

### For Production
```bash
# Build everything for production
npm run deploy:prepare

# Serve in production mode
npm run serve:production
```

## All Available Scripts

### Basic Scripts
- `npm start` - Start the teacher app in development mode (port 3000)
- `npm run build` - Build the teacher app for production
- `npm test` - Run tests for the teacher app

### Development Scripts
- `npm run dev` - Same as `npm start` (teacher app only)
- `npm run dev:server` - Start the server with auto-reload (port 3001)
- `npm run dev:student` - Start the student app dev server (port 3002)
- `npm run dev:all` - **Start everything for development** (recommended)
- `npm run dev:concurrent` - Start everything using concurrently (alternative to dev:all)

### Production Scripts
- `npm run server` - Start the server in production mode
- `npm run build:student` - Build the student app for production
- `npm run build:all` - Build both teacher and student apps

### Setup Scripts
- `npm run check` - Check if all dependencies are installed
- `npm run install:all` - Install dependencies for all components
- `npm run clean` - Remove all node_modules and build directories
- `npm run clean:install` - Clean everything and reinstall

### Deployment Scripts
- `npm run deploy:prepare` - Build everything for deployment
- `npm run serve:production` - Run server in production mode

## Development Workflow

1. **Initial Setup**
   ```bash
   npm run install:all
   ```

2. **Daily Development**
   ```bash
   npm run dev:all
   ```
   This starts:
   - Teacher app: http://localhost:3000
   - Student app: http://localhost:3002/student
   - Server API: http://localhost:3001

3. **Running Components Separately**
   ```bash
   # Terminal 1: Teacher app
   npm run dev

   # Terminal 2: Server
   npm run dev:server

   # Terminal 3: Student app
   npm run dev:student
   ```

## Production Deployment

1. **Build Everything**
   ```bash
   npm run deploy:prepare
   ```

2. **Run in Production**
   ```bash
   npm run serve:production
   ```

3. **With nginx** (recommended)
   - Built teacher app files are in `./build/`
   - Built student app files are in `./server/public/`
   - Configure nginx as per `nginx.conf`

## Troubleshooting

- If you get module not found errors, run `npm run install:all`
- If builds are stale, run `npm run clean:install`
- Make sure ports 3000, 3001, and 3002 are available