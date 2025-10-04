# Getting Started

Quick start guide for developers working on Classroom Widgets.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Development](#development)
- [Project Structure](#project-structure)
- [Available Widgets](#available-widgets)
- [Testing](#testing)
- [Common Tasks](#common-tasks)

## Prerequisites

- **Node.js** 18+ and npm
- **Git**
- **Docker** (optional, for testing production builds)

Check your versions:
```bash
node --version  # Should be 18+
npm --version
git --version
```

## Installation

### First Time Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/classroom-widgets.git
cd classroom-widgets

# Install all dependencies (root + server + student)
npm run install:all
```

This installs dependencies for:
- Teacher app (root directory)
- Server (server/)
- Student app (server/src/student/)

### Environment Variables

Create `.env` files from examples:

```bash
# Teacher app (optional)
cp .env.example .env
# Edit to add VITE_SHORTIO_API_KEY if using Link Shortener widget

# Server (optional for development)
# Defaults work fine for local development
```

## Development

### Start All Services

**Recommended: Run everything together**

```bash
npm run dev:all
```

This starts:
- **Teacher App**: http://localhost:3000 (Vite dev server)
- **Student App**: http://localhost:3002/student (Vite dev server)
- **Server**: http://localhost:3001 (Express + Socket.io)

### Or Run Services Separately

```bash
# Terminal 1: Teacher app
npm run dev

# Terminal 2: Server + Student app
npm run dev:server

# Terminal 3: Student app (dev mode with HMR)
npm run dev:student
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

## Project Structure

```
classroom-widgets/
├── src/                        # Teacher App (React + TypeScript + Vite)
│   ├── app/                    # Application root & providers
│   ├── features/               # Feature modules
│   │   ├── board/             # Canvas & drag-drop
│   │   ├── toolbar/           # Widget toolbar
│   │   ├── widgets/           # All widget implementations
│   │   │   ├── poll/
│   │   │   ├── timer/
│   │   │   ├── questions/
│   │   │   └── ...
│   │   └── session/           # Session management
│   ├── shared/                # Shared components & utilities
│   ├── store/                 # Zustand state management
│   └── index.tsx              # Entry point
│
├── server/                     # Backend (Node.js + Express + Socket.io)
│   ├── src/
│   │   ├── config/            # Server configuration
│   │   ├── routes/            # API routes
│   │   ├── sockets/           # Socket.io event handlers
│   │   ├── student/           # Student App (React + TypeScript + Vite)
│   │   │   ├── components/    # Student app components
│   │   │   └── App.tsx        # Student app entry
│   │   └── server.js          # Server entry point
│   └── public/                # Built student app (served by Express)
│
├── docs/                       # Documentation
├── package.json               # Root package (teacher app)
└── vite.config.js             # Vite configuration
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
npm test

# Run tests in watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test timer.test
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

### NPM Scripts Reference

#### Development
```bash
npm run dev              # Start teacher app (Vite dev server)
npm run dev:server       # Start backend server
npm run dev:student      # Start student app (Vite dev server)
npm run dev:all          # Start everything (recommended)
```

#### Building
```bash
npm run build            # Build teacher app for production
npm run build:student    # Build student app for production
npm run build:all        # Build everything
```

#### Testing
```bash
npm test                 # Run tests with Vitest
```

#### Setup/Maintenance
```bash
npm run install:all      # Install all dependencies
npm run clean            # Remove node_modules and builds
npm run clean:install    # Clean and reinstall everything
```

### Adding a New Widget

See [ADDING_NEW_WIDGET.md](./ADDING_NEW_WIDGET.md) for detailed instructions.

Quick overview:
1. Add widget type to `WidgetType` enum
2. Create widget component in `src/features/widgets/your-widget/`
3. Register in `WidgetRegistry.ts`
4. Add to default toolbar (optional)

### Debugging

**Enable debug mode:**
```bash
# .env
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
npm run clean:install
```

**WebSocket not connecting:**
1. Ensure server is running (`npm run dev:server`)
2. Check `VITE_SERVER_URL` in `.env` (default: `http://localhost:3001`)
3. Check browser console for errors

**Hot reload not working:**
```bash
# Clear Vite cache
rm -rf node_modules/.cache
npm run dev
```

**TypeScript errors:**
```bash
# Check for type errors
npx tsc --noEmit
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
// src/store/workspaceStore.simple.ts
export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      widgets: [],
      addWidget: (widget) => set(state => ({
        widgets: [...state.widgets, widget]
      })),
    }),
    { name: 'workspace-storage' }
  )
);

// In components
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
- Review existing code in `src/features/widgets/` for examples

Happy coding! 🎉
