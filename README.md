# Classroom Widgets Documentation

A suite of interactive classroom management tools with real-time student engagement features.

## 📚 Table of Contents

- [Project Overview](#project-overview)
- [macOS App](#macos-app)
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
- **macOS Application**: A native menu-bar app for placing always-on-top classroom widgets over other apps.

### Available Widgets

- **Interactive**: Poll, Questions, Drop Box, Handout, Real-time Feedback.
- **Utility**: Timer, Randomiser, List, Task Cue, Traffic Light.
- **Display**: Text Banner, Image Display, QR Code, Sound Effects, Stickers.

### Related project

The teacher-facing iPad app for creating and sharing self-contained interactive
activities now lives in its own repository:
[**Tapplet**](https://github.com/tinkertanker/tapplet).

## 🖥️ macOS App

Classroom Widgets for macOS is a signed and notarized menu-bar app for opening compact classroom widgets that stay above other apps. It requires macOS 13 or later.

**[Download the latest macOS release](https://github.com/tinkertanker/classroom-widgets/releases)**

To install it:

1. Download `ClassroomWidgets-v<version>-macos.dmg` from the release page.
2. Open the DMG and drag Classroom Widgets to Applications.
3. Launch Classroom Widgets from Applications. The app runs from the menu bar rather than the Dock.
4. Select the menu-bar icon, then **New Floating Widget**.

The macOS app currently supports Randomiser, Timer, List, Task Cue, Traffic Light, Text Banner, QR Code, and Sound Effects. Settings include launch at login, showing widgets on all Spaces, widget background opacity, and a configurable global shortcut for opening Settings.

The canonical bundle identifier is `sg.tk.classroomwidgets`. Upgrading from a release before 0.10.15 may require configuring preferences, login-item approval, and macOS permissions again because those releases used a different app identity.

See the [macOS app and distribution guide](./docs/MACOS_DISTRIBUTION.md) for usage, local builds, signing, notarization, and release instructions.

## 🚀 Quick Start

### Prerequisites

- Node.js 20.19+ or 22.12+ and npm
- Git
- Docker and Docker Compose (only for Docker-based production deployment)
- macOS 13+ and Xcode 15+ (only for building the native macOS app)

### First Time Setup

```bash
# Clone the repository
git clone https://github.com/tinkertanker/classroom-widgets.git
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

The web stack consists of three parts that run concurrently during development using `npm run dev`. The native macOS app is a separate Swift package that embeds a production build of the teacher interface for its floating widgets.

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

The repository is structured as an npm workspaces monorepo. Run the common commands from the repository root unless a command explicitly names a workspace.

```plaintext
classroom-widgets/
├── packages/
│   ├── teacher/              # Teacher App source code (Vite + React)
│   │   ├── src/app/          # Application root and providers
│   │   ├── src/features/     # Feature modules, widgets, board, session, HUD
│   │   ├── src/store/        # Zustand state management
│   │   └── package.json      # Teacher workspace scripts
│   ├── student/              # Student App source code (Vite + React)
│   │   ├── components/       # Student-facing activity UI
│   │   └── package.json      # Student workspace scripts
│   ├── server/               # Express + Socket.io backend
│   │   ├── src/server.js     # Server entry point
│   │   ├── src/routes/       # API routes
│   │   ├── src/sockets/      # Socket.IO event handlers
│   │   └── package.json      # Backend workspace scripts
│   ├── shared/               # Shared types, hooks, constants, and utilities
│   └── macos-dashboard/      # Native menu-bar host (SwiftPM + AppKit/WebKit)
├── script/                   # macOS app and release packaging scripts
├── docs/                     # Project documentation
├── package.json              # Root workspace scripts
└── package-lock.json         # Locked dependency graph for all workspaces
```

### Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Backend**: Express.js, Socket.io
- **State Management**: Zustand
- **Deployment**: Docker, Nginx
- **macOS Desktop**: Swift, AppKit, SwiftUI, WebKit, Swift Package Manager

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
- **Single Source of Truth**: All commands defined in `packages/shared/voiceCommandDefinitions.json`
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
npm run server

# Run tests for the Teacher App
npm test

# Build, install, launch, and verify the macOS app (macOS only)
npm run macos:run -- --verify

# Create an ad hoc signed local DMG (macOS only; not for public download)
npm run macos:dmg
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
# Optional: teacher app env vars for Vite development
cp packages/teacher/.env.example packages/teacher/.env

# Optional: server env vars for local development
cp packages/server/.env.example packages/server/.env

# Edit these files to add API keys or server settings as needed
nano packages/teacher/.env
nano packages/server/.env
```

See **[Environment Setup Guide](./docs/ENV_SETUP.md)** for complete environment configuration guide.

### Adding New Widgets

See [Adding New Widget Guide](./docs/ADDING_NEW_WIDGET.md) for a step-by-step guide.

## 📦 Deployment

The root `package.json` version is also used for macOS release artifacts. After the version change and release code have landed, tag the exact `master` commit:

```bash
git tag v1.2.3
git push origin v1.2.3
```

Pushing a `v*` tag triggers the GitHub Actions workflow that redeploys the production web services. It does **not** build or upload the macOS app. A public macOS release must be built, Developer ID signed, notarized, stapled, validated, and uploaded to the matching GitHub release from an authorized Mac.

See the [Deployment Guide](./docs/DEPLOYMENT.md) for the web deployment and the [macOS app and distribution guide](./docs/MACOS_DISTRIBUTION.md) for the native release process.

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
- **[macOS App and Distribution](./docs/MACOS_DISTRIBUTION.md)** - Install, use, build, sign, notarize, and publish the native app
- **[Analytics Setup](./docs/ANALYTICS.md)** - Privacy-focused analytics with Umami

### Reference
- **[Agent guide (CLAUDE.md)](./CLAUDE.md)** - Comprehensive project reference for humans and coding agents

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.
