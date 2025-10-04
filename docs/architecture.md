# Architecture Documentation

In-depth technical documentation for Classroom Widgets.

## Table of Contents
- [System Overview](#system-overview)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [State Management](#state-management)
- [Widget System](#widget-system)
- [Real-Time Architecture](#real-time-architecture)
- [Drag & Drop System](#drag--drop-system)
- [Styling System](#styling-system)
- [Testing Strategy](#testing-strategy)
- [Best Practices](#best-practices)

## System Overview

Classroom Widgets is a **monorepo** containing three main applications:

### Architecture Diagram

```
┌─────────────────┐         ┌─────────────────┐
│   Teacher App   │         │  Student App    │
│   (Vite+React)  │         │  (Vite+React)   │
│  localhost:3000 │         │ localhost:3001/ │
│                 │         │     student     │
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

### Request Flow

**Development:**
- Teacher → Vite dev server (port 3000)
- Student → Express server (port 3001/student)
- WebSocket → Socket.io (port 3001)

**Production:**
- Teacher → Nginx → Static React build
- Student → Nginx → Express → Static React build
- WebSocket → Nginx → Express → Socket.io

### Why This Architecture?

1. **Monorepo**: Shared types and constants between apps
2. **Embedded Student App**: Eliminates CORS issues, simplifies deployment
3. **Single Backend**: Serves both API and student app
4. **WebSocket Communication**: Real-time updates for interactive widgets

## Technology Stack

### Frontend (Teacher & Student Apps)
- **React 18.3** - UI library
- **TypeScript** - Type safety (100% TypeScript codebase)
- **Vite 7.0** - Build tool with fast HMR
- **Tailwind CSS 3.4** - Utility-first styling
- **Zustand 5.0** - Lightweight state management
- **React-RND 10.4** - Drag and drop + resize
- **Socket.io Client 4.8** - WebSocket client
- **Vitest 3.2** - Unit testing

### Backend
- **Node.js 18+** - Runtime
- **Express.js** - Web framework
- **Socket.io 4.8** - WebSocket server
- **In-memory storage** - No database (privacy by design)

### Development Tools
- **TypeScript 5.4** - Type checking
- **Vite** - Fast dev server and builds
- **Vitest** - Testing framework
- **Docker** - Containerization

## Project Structure

### Detailed Directory Layout

```
classroom-widgets/
│
├── src/                              # Teacher App
│   ├── app/                          # Application level
│   │   ├── App.tsx                   # Root component
│   │   └── providers/                # Global providers
│   │       └── ModalProvider.tsx     # Modal context
│   │
│   ├── features/                     # Feature modules
│   │   ├── board/                    # Canvas & workspace
│   │   │   ├── components/
│   │   │   │   ├── Board.tsx         # Main canvas
│   │   │   │   ├── Background.tsx    # Background patterns
│   │   │   │   ├── TrashZone.tsx     # Delete widgets zone
│   │   │   │   └── WidgetRenderer.tsx # Renders widgets
│   │   │   └── hooks/
│   │   │       └── useZoom.ts        # Zoom/pan logic
│   │   │
│   │   ├── toolbar/                  # Widget toolbar
│   │   │   ├── components/
│   │   │   │   ├── WidgetButton.tsx
│   │   │   │   ├── WidgetLaunchpad.tsx
│   │   │   │   └── CustomizeToolbarDragDrop.tsx
│   │   │
│   │   ├── widgets/                  # All widgets
│   │   │   ├── poll/                 # Example: Poll widget
│   │   │   │   ├── index.tsx         # Export
│   │   │   │   ├── poll.tsx          # Main component
│   │   │   │   └── PollSettings.tsx  # Settings modal
│   │   │   ├── timer/
│   │   │   ├── questions/
│   │   │   └── shared/               # Shared widget components
│   │   │       ├── WidgetWrapper.tsx
│   │   │       ├── NetworkedWidgetHeader.tsx
│   │   │       └── NetworkedWidgetEmpty.tsx
│   │   │
│   │   └── session/                  # Session management
│   │       ├── components/
│   │       │   └── SessionBanner/
│   │       ├── hooks/
│   │       │   └── useNetworkedWidget.ts
│   │       └── contexts/
│   │           └── UnifiedSessionProvider.tsx
│   │
│   ├── shared/                       # Shared across features
│   │   ├── components/               # Reusable UI components
│   │   ├── hooks/                    # Shared hooks
│   │   │   ├── useWidget.ts
│   │   │   └── useWidgetSettings.ts
│   │   ├── utils/                    # Utility functions
│   │   │   └── styles.ts             # Button styles
│   │   ├── types/                    # TypeScript types
│   │   │   ├── index.ts
│   │   │   └── widget.types.ts
│   │   └── constants/                # Shared constants
│   │       └── widgetTypes.ts
│   │
│   ├── store/                        # Global state (Zustand)
│   │   ├── workspaceStore.simple.ts  # Main store
│   │   └── types.ts                  # Store types
│   │
│   ├── contexts/                     # React contexts
│   │   ├── ModalContext.tsx
│   │   ├── SessionContext.tsx
│   │   └── SocketProvider.tsx
│   │
│   ├── services/                     # Services
│   │   ├── WidgetRegistry.ts         # Widget registration
│   │   └── ErrorService.ts
│   │
│   └── styles/                       # Global styles
│       └── globals.css
│
├── server/                           # Backend
│   ├── src/
│   │   ├── config/                   # Configuration
│   │   │   └── constants.js          # Event names, etc.
│   │   ├── middleware/               # Express middleware
│   │   ├── routes/                   # API routes
│   │   │   └── health.js
│   │   ├── sockets/                  # Socket.io handlers
│   │   │   ├── socketManager.js      # Main socket manager
│   │   │   └── handlers/             # Event handlers
│   │   │       ├── sessionHandler.js
│   │   │       ├── pollHandler.js
│   │   │       └── ...
│   │   ├── student/                  # Student App
│   │   │   ├── components/           # Student components
│   │   │   │   ├── PollActivity.tsx
│   │   │   │   ├── QuestionsActivity.tsx
│   │   │   │   └── ...
│   │   │   ├── App.tsx               # Student app root
│   │   │   └── index.html
│   │   └── server.js                 # Server entry point
│   │
│   └── public/                       # Built student app
│
├── docs/                             # Documentation
├── package.json                      # Root package (teacher app)
├── vite.config.js                    # Vite config
├── tsconfig.json                     # TypeScript config
├── tailwind.config.js                # Tailwind config
└── docker-compose.prod.yml           # Production Docker setup
```

## State Management

### Zustand Store

Global state managed with Zustand in `src/store/workspaceStore.simple.ts`:

```typescript
interface WorkspaceState {
  // Widget management
  widgets: Widget[];
  addWidget: (widget: Widget) => void;
  removeWidget: (id: string) => void;
  updateWidget: (id: string, updates: Partial<Widget>) => void;

  // Widget state persistence
  widgetStates: Record<string, any>;
  setWidgetState: (widgetId: string, state: any) => void;
  getWidgetState: (widgetId: string) => any;

  // UI state
  background: string;
  focusedWidgetId: string | null;

  // Toolbar
  toolbar: {
    visibleWidgets: number[];
  };
}
```

**Key Features:**
- **Persistence**: Auto-saves to localStorage
- **Selective subscriptions**: Components only re-render when needed
- **Middleware**: Built-in persist middleware

### Local Storage Schema

```typescript
// localStorage key: 'workspace-storage'
{
  "widgets": [
    {
      "id": "uuid-1",
      "type": 3,  // WidgetType.TIMER
      "x": 100,
      "y": 100,
      "width": 350,
      "height": 415,
      "zIndex": 1
    }
  ],
  "widgetStates": {
    "uuid-1": {
      "minutes": 5,
      "seconds": 0,
      "isRunning": false
    }
  },
  "background": "geometric",
  "toolbar": {
    "visibleWidgets": [1, 2, 3, 4, 5]
  }
}
```

## Widget System

### Widget Registry

All widgets registered in `src/services/WidgetRegistry.ts`:

```typescript
class WidgetRegistry {
  private widgets = new Map<number, WidgetComponent>();

  register(widget: WidgetComponent) {
    this.widgets.set(widget.type, widget);
  }

  getWidget(type: number): WidgetComponent | undefined {
    return this.widgets.get(type);
  }

  getAvailableWidgets(): WidgetComponent[] {
    return Array.from(this.widgets.values());
  }
}

export const widgetRegistry = new WidgetRegistry();

// Widget registration
widgetRegistry.register({
  type: WidgetType.POLL,
  name: 'Poll',
  icon: FaChartColumn,
  component: lazy(() => import('../features/widgets/poll')),
  defaultSize: { width: 400, height: 450 },
  minSize: { width: 300, height: 350 },
  maintainAspectRatio: false,
  category: WidgetCategory.NETWORKED
});
```

### Widget Lifecycle

```
1. User clicks widget button
   ↓
2. Toolbar calls addWidget()
   ↓
3. Store adds widget to state
   ↓
4. Board renders WidgetRenderer
   ↓
5. WidgetRenderer lazy-loads component
   ↓
6. WidgetWrapper wraps with drag/resize
   ↓
7. Widget component renders
   ↓
8. Widget manages internal state
   ↓
9. Widget calls onStateChange() to persist
   ↓
10. State saved to widgetStates in store
```

### Widget Props Interface

Every widget receives:

```typescript
interface WidgetProps {
  widgetId: string;           // Unique ID for this instance
  savedState?: any;           // Restored state from localStorage
  onStateChange?: (state: any) => void;  // Save state callback
  isActive?: boolean;         // For networked widgets
}
```

### Creating a Widget

Minimal widget example:

```typescript
import React, { useState, useEffect } from 'react';

interface MyWidgetProps {
  widgetId: string;
  savedState?: { count: number };
  onStateChange?: (state: any) => void;
}

export const MyWidget: React.FC<MyWidgetProps> = ({
  widgetId,
  savedState,
  onStateChange
}) => {
  const [count, setCount] = useState(savedState?.count || 0);

  // Persist state changes
  useEffect(() => {
    onStateChange?.({ count });
  }, [count, onStateChange]);

  return (
    <div className="bg-soft-white rounded-lg shadow-sm p-4 h-full">
      <h2 className="text-lg font-semibold">Count: {count}</h2>
      <button
        onClick={() => setCount(c => c + 1)}
        className="mt-2 px-4 py-2 bg-sage-500 text-white rounded"
      >
        Increment
      </button>
    </div>
  );
};
```

## Real-Time Architecture

### Unified Session System

All networked widgets share a single session with one activity code.

#### Components

**1. UnifiedSessionProvider** (Global)
```typescript
// Wraps entire app
<UnifiedSessionProvider>
  <App />
</UnifiedSessionProvider>
```

Manages:
- Single session for all widgets
- Socket connection
- Session recovery after page refresh
- Room lifecycle

**2. useNetworkedWidgetUnified** (Per Widget)
```typescript
const {
  hasRoom,        // Widget has active room
  isStarting,     // Creating room
  error,          // Error message
  handleStart,    // Create room
  handleStop,     // Close room
  session: {
    socket,
    sessionCode,
    participantCount,
    isConnected
  }
} = useNetworkedWidgetUnified({
  widgetId,
  roomType: 'poll',
  savedState,
  onStateChange
});
```

**3. useUnifiedSocketEvents** (Event Management)
```typescript
const { emit } = useUnifiedSocketEvents({
  events: {
    'poll:dataUpdate': (data) => { /* handle */ },
    'poll:voteUpdate': (data) => { /* handle */ }
  },
  isActive: hasRoom
});
```

### Socket Event Flow

**Session Creation** (once for all widgets):
```
Teacher Widget 1 → handleStart()
  → UnifiedSession.createSession()
  → Server: 'session:create'
  → Server Response: { code: 'ABCD1' }
  → Session created!

All other widgets use same session
```

**Room Creation** (per widget):
```
Teacher → handleStart()
  → unifiedSession.createRoom('poll', widgetId)
  → Server: 'session:createRoom' { sessionCode, roomType, widgetId }
  → Server → Students: 'session:roomCreated' { roomType, widgetId, roomData }
  → Widget shows active UI
```

**Student Interaction** (Poll example):
```
Student → Vote
  → emit: 'session:poll:vote' { sessionCode, widgetId, optionIndex }
  → Server: Updates votes
  → Server → All: 'poll:voteUpdate' { votes, totalVotes, widgetId }
  → Teacher & Students: Update UI
```

**Widget Cleanup**:
```
Widget unmounts (deleted)
  → useNetworkedWidgetUnified cleanup (with setTimeout)
  → unifiedSession.closeRoom('poll', widgetId)
  → Server: 'session:closeRoom'
  → Server → Students: 'session:roomClosed' { roomType, widgetId }
  → Students remove widget from UI
```

### Event Naming Convention

All events follow `namespace:action` pattern:

```typescript
// Session management
'session:create'
'session:join'
'session:createRoom'
'session:closeRoom'
'session:widgetStateChanged'

// Widget-specific (always include widgetId)
'session:poll:vote'
'session:poll:update'
'poll:dataUpdate'
'poll:voteUpdate'

'session:questions:submit'
'questions:newQuestion'

// Etc.
```

See [SOCKET_EVENTS.md](./SOCKET_EVENTS.md) for complete reference.

## Drag & Drop System

### React-RND Integration

Uses `react-rnd` library for drag and resize:

```typescript
// WidgetWrapper.tsx
<Rnd
  size={{ width, height }}
  position={{ x, y }}
  onDragStop={(e, data) => {
    updateWidget(id, { x: data.x, y: data.y });
  }}
  onResizeStop={(e, direction, ref, delta, position) => {
    updateWidget(id, {
      width: parseInt(ref.style.width),
      height: parseInt(ref.style.height),
      ...position
    });
  }}
  bounds="parent"
  scale={scale}  // For zoom support
  cancel=".clickable, button, input, textarea, select, a"
>
  {children}
</Rnd>
```

### Key Features

1. **Bounds**: Widgets constrained to board
2. **Scale-aware**: Works with zoom (0.5x - 2x)
3. **Click handling**: Excludes interactive elements from drag
4. **Aspect ratio**: Optional aspect ratio lock
5. **Z-index**: Active widget has highest z-index

### Click Handling Pattern

To prevent drag on interactive elements:

```tsx
// Add "clickable" class to any div with onClick
<div className="clickable" onClick={handleClick}>
  Click me
</div>

// Standard HTML elements auto-excluded:
// button, input, textarea, select, a
```

### Zoom Implementation

Board supports pinch-to-zoom (0.5x - 2x):

```typescript
const useZoom = () => {
  const [scale, setScale] = useState(1);

  const handleWheel = (e: WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;

    e.preventDefault();
    const delta = -e.deltaY;
    const newScale = clamp(scale + delta * 0.001, 0.5, 2);

    // Calculate new scroll to keep point under cursor
    // ... (see Board.tsx for full implementation)

    setScale(newScale);
  };

  return { scale, handleWheel };
};
```

## Styling System

### Tailwind Configuration

Custom color palette in `tailwind.config.js`:

```javascript
colors: {
  // Primary actions (start, active)
  sage: {
    50: '#f6f7f6',
    500: '#7c9885',
    600: '#6a8573',
    // ...
  },

  // Destructive actions (stop, delete)
  'dusty-rose': {
    500: '#b8838a',
    600: '#a57179',
    // ...
  },

  // Secondary actions
  terracotta: {
    500: '#c99a83',
    600: '#b88971',
    // ...
  },

  // Backgrounds
  'soft-white': '#fdfcfb',
  'warm-gray': {
    100: '#f5f5f4',
    800: '#292524',
    // ...
  }
}
```

### Consistent Button Styles

Utility in `src/shared/utils/styles.ts`:

```typescript
export const buttons = {
  primary: `
    px-3 py-1.5 text-sm rounded
    bg-sage-500 hover:bg-sage-600
    text-white
    border border-sage-600
    transition-colors
  `,

  danger: `
    px-3 py-1.5 text-sm rounded
    bg-dusty-rose-500 hover:bg-dusty-rose-600
    text-white
    border border-dusty-rose-600
    transition-colors
  `,
};

// Usage
<button className={buttons.primary}>Start</button>
```

### Dark Mode

Automatic dark mode support:

```tsx
// Backgrounds
className="bg-soft-white dark:bg-warm-gray-800"

// Text
className="text-warm-gray-800 dark:text-warm-gray-100"

// Borders
className="border-warm-gray-200 dark:border-warm-gray-700"
```

### Networked Widget UI Pattern

Consistent structure across all networked widgets:

```tsx
function NetworkedWidget() {
  const { hasRoom, session, handleStart } = useNetworkedWidgetUnified(...);

  if (!hasRoom) {
    return (
      <NetworkedWidgetEmpty
        icon={FaIcon}
        title="Widget Name"
        description="Description"
        buttonText="Start"
        onStart={handleStart}
        error={error}
      />
    );
  }

  return (
    <div className="bg-soft-white rounded-lg shadow-sm border w-full h-full flex flex-col p-4">
      <NetworkedWidgetHeader
        title="Widget"
        code={session.sessionCode}
        participantCount={session.participantCount}
        icon={FaIcon}
      >
        {/* Control buttons */}
      </NetworkedWidgetHeader>

      <div className="flex-1 overflow-y-auto">
        {/* Main content */}
      </div>
    </div>
  );
}
```

## Testing Strategy

### Test Structure

```
src/
├── features/
│   └── widgets/
│       └── timer/
│           ├── timer.tsx
│           └── timer.test.tsx  # Co-located with component
```

### Testing Tools

- **Vitest**: Test runner
- **React Testing Library**: Component testing
- **Jest DOM**: DOM matchers

### Example Test

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { Timer } from './timer';

describe('Timer', () => {
  const defaultProps = {
    widgetId: 'test-123',
    savedState: undefined,
    onStateChange: vi.fn()
  };

  test('renders timer with default time', () => {
    render(<Timer {...defaultProps} />);
    expect(screen.getByText(/05:00/)).toBeInTheDocument();
  });

  test('starts countdown when play button clicked', async () => {
    vi.useFakeTimers();
    render(<Timer {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /start/i }));

    vi.advanceTimersByTime(1000);
    expect(screen.getByText(/04:59/)).toBeInTheDocument();

    vi.useRealTimers();
  });
});
```

### Testing Patterns

**Mock Socket.io:**
```typescript
vi.mock('socket.io-client', () => ({
  io: () => ({
    on: vi.fn(),
    emit: vi.fn(),
    off: vi.fn()
  })
}));
```

**Mock localStorage:**
```typescript
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn()
};
global.localStorage = localStorageMock as any;
```

## Best Practices

### Component Design

1. **Single Responsibility**: Each component does one thing
2. **Composition**: Build complex UIs from simple components
3. **Props Interface**: Always define TypeScript interfaces
4. **Hooks at Top**: All hooks before conditional logic
5. **Memoization**: Use `useMemo`/`useCallback` for expensive operations

### State Management

1. **Local First**: Use local state when possible
2. **Global When Needed**: Use Zustand for cross-component state
3. **Persistence**: Save important state to localStorage
4. **Selectors**: Use selective subscriptions to minimize re-renders

### Performance

1. **Lazy Loading**: All widgets are lazy-loaded
2. **Code Splitting**: Automatic via Vite
3. **Memoization**: Prevent unnecessary re-renders
4. **Debouncing**: Debounce frequent updates (e.g., typing)

### Error Handling

1. **Error Boundaries**: Wrap widgets in error boundaries
2. **Try-Catch**: Handle async errors
3. **User Feedback**: Show clear error messages
4. **Graceful Degradation**: App continues if widget fails

### Accessibility

1. **Semantic HTML**: Use proper HTML elements
2. **ARIA Labels**: Add labels for screen readers
3. **Keyboard Navigation**: Support keyboard shortcuts
4. **Color Contrast**: Ensure sufficient contrast

### Security

1. **Input Validation**: Validate all user input
2. **XSS Protection**: React escapes by default
3. **CORS**: Configure CORS properly
4. **No Secrets in Frontend**: Never expose API keys

### Git Workflow

1. **Feature Branches**: Create branch per feature
2. **Conventional Commits**: Use conventional commit messages
3. **Pull Requests**: Review before merging
4. **Small Commits**: Make atomic commits

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Maintenance

**Example:**
```
feat(widgets): add timer pause functionality

- Add pause/resume button to timer widget
- Maintain elapsed time during pause
- Add visual indicator for paused state

Closes #123
```

## Advanced Topics

### Custom Hooks

Create reusable hooks in `src/shared/hooks/`:

```typescript
// useWidget.ts - Simplifies widget state management
export function useWidget({ id, initialState }: UseWidgetProps) {
  const { getWidget, updateWidget, setWidgetState, getWidgetState } =
    useWorkspaceStore();

  const widget = getWidget(id);
  const [internalState, setInternalState] = useState(
    getWidgetState(id) || initialState
  );

  const updateState = useCallback((newState: any) => {
    setInternalState(newState);
    setWidgetState(id, newState);
  }, [id, setWidgetState]);

  return { widget, state: internalState, updateState };
}
```

### Error Boundaries

Wrap error-prone components:

```typescript
class WidgetErrorBoundary extends Component<Props, State> {
  state = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Widget error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
```

### Performance Monitoring

```typescript
// Use React Profiler
import { Profiler } from 'react';

function onRenderCallback(
  id: string,
  phase: 'mount' | 'update',
  actualDuration: number
) {
  console.log(`${id} (${phase}): ${actualDuration}ms`);
}

<Profiler id="Board" onRender={onRenderCallback}>
  <Board />
</Profiler>
```

## Further Reading

- [GETTING_STARTED.md](./GETTING_STARTED.md) - Quick start guide
- [ADDING_NEW_WIDGET.md](./ADDING_NEW_WIDGET.md) - Widget creation guide
- [SOCKET_EVENTS.md](./SOCKET_EVENTS.md) - Socket.io event reference
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment guide

## Contributing

See coding standards above and follow existing patterns in the codebase. When in doubt, look at existing widgets for examples.
