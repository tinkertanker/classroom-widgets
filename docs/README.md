# Classroom Widgets Documentation

Interactive classroom management tools with real-time student engagement features.

## 📚 Table of Contents

- [Project Overview](#project-overview)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Features](#features)
- [Development](#development)
- [Deployment](#deployment)
- [Documentation](#documentation)

## 🎯 Project Overview

Classroom Widgets is a real-time classroom management system that enables teachers to create interactive activities and engage with students through various widget tools. The system consists of:

- **Teacher Application**: A React-based interface for creating and managing classroom activities
- **Student Application**: A responsive web app for students to participate in activities
- **Backend Server**: Express.js server handling real-time communication via Socket.io

### Key Features

- **15+ Interactive Widgets**: Timer, Randomiser, Poll, Questions, Link Share, RT Feedback, and more
- **Real-time Collaboration**: Instant updates between teacher and student devices
- **Session Management**: Simple 5-character codes for easy student access
- **Responsive Design**: Works on phones, tablets, and computers
- **Dark Mode Support**: Comfortable viewing in any lighting condition
- **Persistent Workspace**: Auto-saves widget layouts and states

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Git

### First Time Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/classroom-widgets.git
cd classroom-widgets

# Install all dependencies
npm run install:all
```

### Development

```bash
# Run everything (recommended)
npm run dev:all
```

This starts:
- Teacher app: http://localhost:3000
- Server + Student app: http://localhost:3001
- Student app direct: http://localhost:3001/student

### Production Build

```bash
# Build everything
npm run build:all
```

## 🏗️ Architecture

### System Overview

```
┌─────────────────┐         ┌─────────────────┐
│   Teacher App   │         │  Student App    │
│   (React SPA)   │         │   (React SPA)   │
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

```
classroom-widgets/
├── src/                    # Teacher app (main React application)
│   ├── components/        # Widget components
│   ├── contexts/          # React contexts
│   ├── hooks/             # Custom hooks
│   └── utils/             # Helper functions
├── server/                 # Backend server
│   ├── src/              
│   │   ├── index.js      # Express + Socket.io server
│   │   └── student/      # Student app source (Vite)
│   └── public/           # Built student app files
├── docs/                  # Documentation
└── nginx.conf            # Production config
```

### Technology Stack

- **Frontend**: React 18.3, TypeScript, Tailwind CSS
- **Backend**: Express.js, Socket.io
- **Student App**: Vite, React, TypeScript
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

```bash
# Teacher app only
npm start                 # Development server
npm test                  # Run tests
npm run build            # Production build

# Server only
cd server
npm start                # Start server
npm run dev              # Development with nodemon

# Student app only
cd server/src/student
npm run dev              # Development server
npm run build            # Production build

# Everything
npm run dev:all          # Run all in development
npm run build:all        # Build everything
npm run install:all      # Install all dependencies
```

See [SCRIPTS.md](./SCRIPTS.md) for complete script documentation.

### Bundle Analysis

To analyze the build bundle size:

```bash
# Using Create React App's built-in stats
npm run build -- --stats

# Or install source-map-explorer (recommended)
npm install --save-dev source-map-explorer
npm run build
npx source-map-explorer 'build/static/js/*.js'
```

### Environment Variables

Create a `.env` file in the root directory:

```env
# Optional - for Link Shortener widget
VITE_SHORTIO_API_KEY=your_api_key

# Server configuration
VITE_SERVER_URL=http://localhost:3001
```

See [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) for all options.

### Adding New Widgets

See [ADDING_NEW_WIDGET.md](./ADDING_NEW_WIDGET.md) for a step-by-step guide.

## 📦 Deployment

### Docker Deployment (Recommended)

```bash
# Build and run with Docker Compose
docker-compose up -d
```

See [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md) for detailed instructions.

### Manual Deployment

1. Build all applications: `npm run build:all`
2. Set up Nginx with provided configuration
3. Configure environment variables
4. Start the Express server

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment guide.

## 📖 Documentation

### Core Documentation
- [Complete Features List](./FEATURES.md) - Comprehensive feature documentation
- [Architecture Overview](./HARMONIZED_ARCHITECTURE.md) - System design and data flow
- [Socket Events](./SOCKET_EVENTS.md) - Real-time communication protocol
- [Environment Variables](./ENVIRONMENT_VARIABLES.md) - Configuration options
- [Security Guidelines](./SECURITY.md) - Best practices and considerations

### Development Guides
- [Adding New Widgets](./ADDING_NEW_WIDGET.md) - Widget creation tutorial
- [Testing Guide](./TESTING.md) - Testing strategies
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues and solutions

### Deployment Guides
- [Docker Deployment](./DOCKER_DEPLOYMENT.md) - Container-based deployment
- [General Deployment](./DEPLOYMENT.md) - Various deployment options
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md) - Pre-deployment verification

### API Documentation
- [Socket Events Reference](./SOCKET_EVENTS_DOCUMENTATION.md) - Complete event listing
- [Widget State Management](./hooks/README.md) - State persistence

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Built with React and Create React App
- Real-time features powered by Socket.io
- UI components styled with Tailwind CSS
- Icons from react-icons library