# Classroom Widgets Documentation

A suite of interactive classroom management tools with real-time student engagement features.

## 📚 Table of Contents

- [Project Overview](#project-overview)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Core Features](#core-features)
- [Development](#development)
- [Deployment](#deployment)
- [Documentation](#documentation)

## 🎯 Project Overview

Classroom Widgets is a real-time classroom management system that enables teachers to create interactive activities and engage with students through various widget tools. The system consists of:

- **Teacher Application**: A React-based interface for creating and managing classroom activities
- **Student Application**: A responsive web app for students to participate in activities.
- **Backend Server**: An Express.js server handling real-time communication via Socket.io.

### Available Widgets

- **Interactive**: Poll, Questions, Drop Box, Handout, Real-time Feedback.
- **Utility**: Timer, Randomiser, List, Task Cue, Traffic Light.
- **Display**: Text Banner, Image Display, QR Code, Sound Effects, Stickers.


## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Git
- Docker and Docker Compose (for production deployment)

### First Time Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/classroom-widgets.git
cd classroom-widgets

# Install all dependencies
npm run install:all
```

### Development

To run all services (recommended):

```bash
npm run dev
```

This **automatically** starts:
- **Teacher app**: http://localhost:3000 (Vite dev server)
- **Student app**: http://localhost:3002/student (Vite dev server)
- **Server**: http://localhost:3001 (Express + Socket.io)

### Production Build

```bash
npm run build:all
```

## 🏗️ Architecture

### System Overview (Development Environment)

The project is a monorepo consisting of three main parts that run concurrently during development using `npm run dev`.

```
┌─────────────────┐         ┌─────────────────┐
│   Teacher App   │         │  Student App    │
│   (Vite + React)│         │ (Vite + React)  │
│  localhost:3000 │         │ localhost:3002  │
└────────┬────────┘         └────────┬────────┘
         │                           │
         └─────────┬─────────────────┘
                   │
           ┌───────▼────────┐
           │ Express Server │
           │  (Socket.io)   │
           │ localhost:3001 │
           └────────────────┘
```

**Note:** In development, each frontend runs on its own Vite dev server for hot module replacement (HMR). In production, both are served as static files by the Express server.

### Project Structure

The repository is structured as a monorepo with three `package.json` files, orchestrating the three main parts of the application.

```plaintext
classroom-widgets/
├── src/                      # Teacher App source code (Vite + React)
│   ├── components/           # Widget and UI components
│   ├── features/             # Feature-based modules (widgets, session, etc.)
│   ├── store/                # Zustand state management
│   └── index.tsx             # Main entry point for the Teacher App
├── server/                   # Backend and Student App workspace
│   ├── src/                  # Server source code
│   │   ├── server.js         # Main Express + Socket.io server entry point
│   │   ├── config/           # Environment and app configuration
│   │   ├── middleware/       # Express middleware
│   │   ├── routes/           # API routes
│   │   ├── sockets/          # Socket.IO event handlers
│   │   └── student/          # Student App source code (Vite + React)
│   │       ├── src/          # Student App components and logic
│   │       └── package.json  # Student App dependencies
│   ├── public/               # Built Student App (served by Express)
│   └── package.json          # Backend server dependencies
├── docs/                     # Project documentation
├── package.json              # Root package (for Teacher App) and monorepo scripts
└── vite.config.js            # Vite config for the Teacher App
```

### Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Backend**: Express.js, Socket.io
- **State Management**: Zustand
- **Deployment**: Docker, Nginx

## ✨ Features

### Available Widgets

#### Interactive Widgets
- **Poll**: Real-time voting with live results
- **Questions**: Q&A submission and management
- **Drop Box**: Collect links and text submissions from students
- **Handout**: Push content (links, text) to all students
- **RT Feedback**: Real-time understanding gauge (1-5 scale)

#### Utility Widgets
- **Timer**: Countdown and stopwatch functionality
- **Randomiser**: Random selection with visual effects
- **List**: Task management with completion tracking
- **Task Cue**: Visual work mode indicators
- **Traffic Light**: Status indicators

#### Display Widgets
- **Text Banner**: Customizable text displays
- **Image Display**: Image viewer
- **QR Code**: Generate QR codes for sharing
- **Sound Effects**: Audio playback
- **Sticker**: Decorative elements

### Session Management

1. **Teacher creates session**: Automatic 5-character code generation
2. **Students join**: Enter code at `/student` URL
3. **Real-time sync**: All activities update instantly
4. **Multi-widget support**: Multiple activities per session

### UI Features

- **Drag & Drop**: Position widgets anywhere on the workspace
- **Resize**: Adjust widget sizes with aspect ratio constraints
- **Voice Commands**: Hands-free widget control using speech recognition + AI
- **Backgrounds**: Multiple pattern options
- **Dark Mode**: System-aware theme switching
- **Toolbar Customization**: Choose which widgets to display
- **Workspace Persistence**: Auto-saves layout

### Voice Command System

Control widgets hands-free using natural language:

- **Speech Recognition**: Uses Annyang library for voice input
- **Hybrid Processing**: Fast pattern matching (~5ms) + AI fallback via Ollama (~200-800ms)
- **Single Source of Truth**: All commands defined in `shared/voiceCommandDefinitions.json`
- **Auto-Sync**: TypeScript/JavaScript generated automatically to keep frontend/backend in sync

**Example commands**: "start a 5 minute timer", "launch the poll widget", "pick someone at random"

See [VOICE_COMMAND_SHARED_DEFINITIONS.md](./docs/VOICE_COMMAND_SHARED_DEFINITIONS.md) for details.

## 💻 Development

### Available Scripts

The most important scripts are run from the root `package.json`:

```bash
# Install all dependencies in all workspaces
npm run install:all

# Run Teacher App, Student App, and Server concurrently
npm run dev

# Build all applications for production (auto-generates voice types)
npm run build:all

# Regenerate voice command type definitions (TypeScript/JavaScript)
npm run generate:voice-types

# Start the production server
npm start

# Run tests for the Teacher App
npm test
```

See [Getting Started Guide](./docs/GETTING_STARTED.md) for more development details.

### Development with Claude Code

If you're using Claude Code to assist with development, ask it to check for a running tmux session. Claude Code can read the dev server logs directly from tmux using:

```bash
# List tmux sessions
tmux list-sessions

# Capture recent logs (last 100 lines)
tmux capture-pane -t 0 -p -S -100
```

**Recommended setup:**
1. Start a tmux session: `tmux new -s dev`
2. Run the dev servers: `npm run dev` (or `npm run dev:concurrent`)
3. Claude Code can then monitor logs alongside you

### Environment Variables

```bash
# Copy the example file to get started
cp .env.example .env

# Edit .env to add your API keys (optional)
nano .env
```

See **[Environment Setup Guide](./docs/ENV_SETUP.md)** for complete environment configuration guide.

### Adding New Widgets

See [Adding New Widget Guide](./docs/ADDING_NEW_WIDGET.md) for a step-by-step guide.

## 📦 Deployment

### Automated Deployment via Git Tags (CD)

Pushing a version tag triggers the GitHub Actions workflow, which SSHes into the production server and deploys automatically:

```bash
git tag v1.2.3
git push origin v1.2.3
```

The workflow will:
1. Pull the latest code on the server (`git pull --rebase`)
2. Bring down the running containers (`docker compose down`)
3. Rebuild and start the new version (`docker compose -f docker-compose.prod.yml up --build -d`)

**Required GitHub Secrets** (repo Settings → Secrets and variables → Actions):

| Secret | Description |
|--------|-------------|
| `SSH_HOST` | Production server hostname or IP |
| `SSH_USER` | SSH username on the server |
| `SSH_PRIVATE_KEY` | Private key for SSH authentication (use a dedicated deploy key, not your personal key) |
| `DEPLOY_PATH` | Absolute path to the repo on the server (e.g. `/home/user/classroom_widgets`) |

### Docker Deployment (Manual)

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

See [Deployment Guide](./docs/DEPLOYMENT.md) for detailed instructions.

### Manual Deployment

1. Build all applications: `npm run build:all`
2. Set up Nginx with provided configuration
3. Configure environment variables
4. Start the Express server: `npm start`

See [Deployment Guide](./docs/DEPLOYMENT.md) for complete deployment instructions.

## 📖 Documentation

All comprehensive documentation is in the [`docs/`](./docs) directory:

### For Developers
- **[Getting Started](./docs/GETTING_STARTED.md)** - Quick developer onboarding
- **[Architecture](./docs/ARCHITECTURE.md)** - In-depth technical documentation
- **[Adding New Widget](./docs/ADDING_NEW_WIDGET.md)** - Widget creation guide
- **[Socket Events](./docs/SOCKET_EVENTS.md)** - Real-time communication protocol
- **[Voice Command Shared Definitions](./docs/VOICE_COMMAND_SHARED_DEFINITIONS.md)** - Voice command synchronization system

### For Deployment
- **[Deployment Guide](./docs/DEPLOYMENT.md)** - Production deployment (Docker, SSL, troubleshooting)
- **[Analytics Setup](./docs/ANALYTICS.md)** - Privacy-focused analytics with Umami

### Reference
- **[Main Documentation](./docs/CLAUDE.md)** - Comprehensive project reference

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.
