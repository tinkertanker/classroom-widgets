# Getting Started

Quick start guide for developers working on Classroom Widgets.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Development](#development)
- [macOS App](#macos-app)
- [Project Structure](#project-structure)
- [Available Widgets](#available-widgets)
- [Testing](#testing)
- [Common Tasks](#common-tasks)

## Prerequisites

- **Node.js** 22.13+ and pnpm 11 (via `corepack enable`)
- **Git**
- **Docker** (optional, for testing production builds)
- **macOS 13+ and Xcode 15+** (optional, for the native macOS app)

Check your versions:
```bash
node --version  # Should be 22.13+
pnpm --version
git --version
```

## Installation

### First Time Setup

```bash
# Clone the repository
git clone https://github.com/tinkertanker/classroom-widgets.git
cd classroom-widgets

# Install all dependencies
pnpm install
```

This installs dependencies for:
- Teacher app (`packages/teacher`)
- Student app (`packages/student`)
- Server (`packages/server`)
- Shared workspace (`packages/shared`)

The native app in `packages/macos-dashboard` is a Swift package; Xcode resolves and builds it when you run the macOS scripts.

### Environment Variables

Create `.env` files from examples only when you need optional API keys or non-default server settings:

```bash
# Teacher app (optional for Vite development)
cp packages/teacher/.env.example packages/teacher/.env
# Set VITE_LINK_SHORTENER_ENABLED=true to show the web Link Shortener widget

# Server (optional for development)
cp packages/server/.env.example packages/server/.env
# Set SHORTIO_API_KEY and SHORTIO_DOMAIN there to enable shortening
```

## Development

### Start All Services

**Recommended: Run everything together**

```bash
pnpm dev
```

This **automatically** starts:
- **Teacher App**: http://localhost:3000 (Vite dev server)
- **Student App**: http://localhost:3002/student (Vite dev server)
- **Server**: http://localhost:3001 (Express + Socket.io)

### Or Run Services Separately (Advanced)

```bash
# Terminal 1: Teacher app only
pnpm dev:teacher

# Terminal 2: Server only
pnpm dev:server

# Terminal 3: Student app only (dev mode with HMR)
pnpm dev:student

# OR use concurrently (runs all in one terminal):
pnpm dev:concurrent
```

### Testing the Application

1. Open teacher app: http://localhost:3000
2. Click "Session" in toolbar → "Start New Session"
3. Note the 5-character session code
4. Open student app: http://localhost:3002/student
5. Enter the session code
6. Add widgets (Poll, Timer, etc.) in teacher app
7. Students will see them automatically!

**Note:** In development, the student app runs on its own Vite dev server (port 3002). In production, it's served by the Express server at `http://localhost:3001/student`.

## macOS App

On a Mac with Xcode installed, build the teacher assets and native Swift host, install the result to Applications, launch it, and verify the process:

```bash
npm run macos:run -- --verify
```

Classroom Widgets runs from the menu bar. Select its icon and use **New Floating Widget** to open a supported compact widget. Local builds replace `/Applications/Classroom Widgets Dashboard.app`.

To create an ad hoc signed DMG for local packaging checks, install `create-dmg` and run:

```bash
npm run macos:dmg
```

Do not publish that ad hoc artifact. Public downloads must be Developer ID signed, notarized, and stapled. See [macOS App and Distribution](./MACOS_DISTRIBUTION.md) for installation, supported widgets, app identity, signing, validation, and release instructions.

## Project Structure

```
classroom-widgets/
├── packages/
│   ├── teacher/                # Teacher App (React + TypeScript + Vite)
│   │   ├── src/app/            # Application root & providers
│   │   ├── src/features/       # Board, widgets, HUD, session, voice control
│   │   ├── src/store/          # Zustand state management
│   │   └── package.json
│   ├── student/                # Student App (React + TypeScript + Vite)
│   │   ├── components/         # Student-facing activity UI
│   │   ├── services/           # Socket and API helpers
│   │   └── package.json
│   ├── server/                 # Backend (Node.js + Express + Socket.io)
│   │   ├── src/config/         # Server configuration
│   │   ├── src/routes/         # API routes
│   │   ├── src/sockets/        # Socket.io event handlers
│   │   ├── src/server.js       # Server entry point
│   │   └── package.json
│   ├── shared/                 # Shared types, hooks, constants, utilities
│   └── macos-dashboard/        # Native menu-bar host (SwiftPM + AppKit/WebKit)
├── scripts/                    # Build, distribution, and repo tooling scripts
├── docs/                       # Documentation
├── package.json                # Root workspace scripts
├── pnpm-lock.yaml              # Locked dependency graph
└── pnpm-workspace.yaml          # Workspace package globs
```

### Key Technologies

- **React 18.3** - UI library
- **TypeScript** - Type safety (100% TypeScript codebase)
- **Vite** - Build tool & dev server
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **Socket.io** - Real-time communication
- **Express.js** - Backend server
- **React-RND** - Drag & drop + resize
- **Vitest** - Testing framework
- **Swift, AppKit, SwiftUI, and WebKit** - Native macOS host and settings UI

## Available Widgets

### Interactive (Networked)
- **Poll** - Real-time voting with live results
- **Questions** - Q&A submission system
- **Link Share** - Collect links from students
- **RT Feedback** - Real-time understanding gauge (1-5 scale)

### Utility
- **Timer** - Countdown timer with sound alerts
- **Randomiser** - Random selection from list with animations
- **List** - Task checklist with confetti
- **Task Cue** - Work mode indicators (solo/pair/group)
- **Traffic Light** - Status indicators

### Display
- **Text Banner** - Customizable text display
- **Image Display** - Image viewer
- **QR Code** - Generate QR codes
- **Sound Effects** - Audio playback
- **Sticker** - Decorative stickers
- **Visualiser** - Audio visualizer

### Games
- **Tic Tac Toe** - Two-player game
- **Wordle** - Word guessing game
- **Snake** - Classic snake game

All widgets support:
- Drag & drop positioning
- Resizing with aspect ratio control
- State persistence (auto-saves)
- Dark mode

## Testing

### Run Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test -- --watch

# Run with coverage
pnpm test -- --coverage

# Run specific test file
pnpm test timer.test
```

### Testing Framework

Uses **Vitest** + **React Testing Library**:

```typescript
// Example test
import { render, screen } from '@testing-library/react';
import { Timer } from './timer';

test('renders timer', () => {
  render(<Timer widgetId="123" />);
  expect(screen.getByText(/timer/i)).toBeInTheDocument();
});
```

## Common Tasks

### Package Scripts Reference

#### Development
```bash
pnpm dev              # Start everything (recommended)
pnpm dev:all          # Same as pnpm dev
pnpm dev:teacher      # Start teacher app only
pnpm dev:server       # Start backend server only
pnpm dev:student      # Start student app only
pnpm dev:concurrent   # Start everything with concurrently
```

#### Building
```bash
pnpm build            # Build all workspaces that define a build script
pnpm build:student    # Build student app for production
pnpm build:all        # Build everything
pnpm macos:run -- --verify  # Build, install, launch, and verify the macOS app
pnpm macos:dmg        # Create an ad hoc local DMG; do not publish it
```

#### Testing
```bash
pnpm test                 # Run tests with Vitest
```

#### Setup/Maintenance
```bash
pnpm install      # Install all dependencies
pnpm clean            # Remove node_modules and builds
pnpm clean && pnpm install
```

### Adding a New Widget

See [ADDING_NEW_WIDGET.md](./ADDING_NEW_WIDGET.md) for detailed instructions.

Quick overview:
1. Add widget type to `WidgetType` enum
2. Create widget component in `packages/teacher/src/features/widgets/your-widget/`
3. Register in `WidgetRegistry.ts`
4. Add to default toolbar (optional)

### Debugging

**Enable debug mode:**
```bash
# packages/teacher/.env
VITE_DEBUG=true
```

**Check server logs:**
```bash
# Server runs in same terminal as dev:all
# Look for Socket.io connection messages
```

**Browser DevTools:**
- Press F12
- Check Console for errors
- Check Network tab for WebSocket connections
- Check Application → Local Storage for persisted state

### Common Issues

**Port already in use:**
```bash
# Find what's using the port
lsof -i :3000
lsof -i :3001

# Kill the process
kill -9 <PID>
```

**Dependencies out of sync:**
```bash
pnpm clean
pnpm install
```

**WebSocket not connecting:**
1. Ensure server is running (`pnpm dev:server`)
2. Check `VITE_SERVER_URL` in `packages/teacher/.env` (default: `http://localhost:3001`)
3. Check browser console for errors

**Hot reload not working:**
```bash
# Clear Vite cache
rm -rf node_modules/.cache
pnpm dev
```

**TypeScript errors:**
```bash
# Check teacher app type errors
pnpm --filter @classroom-widgets/teacher typecheck

# Check student app type errors
pnpm --filter @classroom-widgets/student build
```

## Coding Standards

### File Naming

| Type | Convention | Example |
|------|-----------|---------|
| Folders | kebab-case | `user-profile/` |
| React Components | PascalCase.tsx | `UserProfile.tsx` |
| Hooks | camelCase.ts with 'use' prefix | `useWidget.ts` |
| Utilities | kebab-case.ts | `format-date.ts` |
| Constants | UPPER_SNAKE_CASE.ts | `WIDGET_TYPES.ts` |

### Component Structure

```typescript
import React, { useState, useEffect, useCallback } from 'react';

interface WidgetProps {
  widgetId: string;
  savedState?: any;
  onStateChange?: (state: any) => void;
}

export const Widget: React.FC<WidgetProps> = ({
  widgetId,
  savedState,
  onStateChange
}) => {
  // 1. Hooks
  const [state, setState] = useState(savedState);

  // 2. Effects
  useEffect(() => {
    // Effect logic
  }, []);

  // 3. Handlers
  const handleClick = useCallback(() => {
    // Handler logic
  }, []);

  // 4. Render
  return (
    <div className="bg-soft-white rounded-lg shadow-sm p-4">
      {/* Widget content */}
    </div>
  );
};
```

### Styling with Tailwind

Use the custom color palette:

```tsx
// Primary actions (start, active)
className="bg-sage-500 hover:bg-sage-600"

// Destructive actions (stop, delete)
className="bg-dusty-rose-500 hover:bg-dusty-rose-600"

// Secondary actions
className="bg-terracotta-500 hover:bg-terracotta-600"

// Backgrounds
className="bg-soft-white dark:bg-warm-gray-800"

// Text
className="text-warm-gray-800 dark:text-warm-gray-100"
```

### State Management

Use Zustand for global state:

```typescript
// packages/teacher/src/store/workspaceStore.simple.ts
// In components
import { useWorkspaceStore } from '../store/workspaceStore.simple';

const widgets = useWorkspaceStore(state => state.widgets);
const addWidget = useWorkspaceStore(state => state.addWidget);
```

## Next Steps

- **Add a new widget**: See [ADDING_NEW_WIDGET.md](./ADDING_NEW_WIDGET.md)
- **Understand architecture**: See [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Deploy to production**: See [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Socket events reference**: See [SOCKET_EVENTS.md](./SOCKET_EVENTS.md)

## Getting Help

- Check [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed documentation
- Check [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment issues
- Open an issue on GitHub
- Review existing code in `packages/teacher/src/features/widgets/` for examples

Happy coding! 🎉
