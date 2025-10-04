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

- **Interactive**: Poll, Questions, Link Share, Real-time Feedback.
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

To run all services concurrently (recommended):

```bash
npm run dev
```
This starts:
- Teacher app: http://localhost:3000
- Server + Student app: http://localhost:3001

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
│  localhost:3000 │         │ localhost:3001  │
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
- **Link Share**: Collect and display shared links
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
- **Backgrounds**: Multiple pattern options
- **Dark Mode**: System-aware theme switching
- **Toolbar Customization**: Choose which widgets to display
- **Workspace Persistence**: Auto-saves layout

## 💻 Development

### Available Scripts

The most important scripts are run from the root `package.json`:

```bash
# Install all dependencies in all workspaces
npm run install:all

# Run Teacher App, Student App, and Server concurrently
npm run dev

# Build all applications for production
npm run build:all

# Start the production server
npm start

# Run tests for the Teacher App
npm test
```

See [Getting Started Guide](./docs/GETTING_STARTED.md) for more development details.

### Environment Variables

```bash
# Copy the example file to get started
cp .env.example .env

# Edit .env to add your API keys (optional)
nano .env
```

See **[ENV_SETUP.md](./ENV_SETUP.md)** for complete environment configuration guide.

### Adding New Widgets

See [Adding New Widget Guide](./docs/ADDING_NEW_WIDGET.md) for a step-by-step guide.

## 📦 Deployment

### Docker Deployment (Recommended)

```bash
# Build and run with Docker Compose
docker-compose up -d
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

### For Deployment
- **[Deployment Guide](./docs/DEPLOYMENT.md)** - Production deployment (Docker, SSL, troubleshooting)

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
