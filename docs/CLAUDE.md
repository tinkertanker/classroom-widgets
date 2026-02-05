# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 📁 Documentation Policy

**ALL documentation belongs in this `docs/` directory.**

When creating new documentation:
- ✅ Put it in `docs/`
- ✅ Update links in root `CLAUDE.md` and `README.md`
- ❌ Don't create `.md` files in the root directory (except README.md and CLAUDE.md)

This keeps the project organized and documentation easy to find.

---

## Agent Guide

Keep state derived where possible. Prefer computed values or `useMemo` over copying state with effects.
Use `useWidgetState`/`useWidgetSettings` for persisted widget state and typed `onStateChange` payloads.
For temporary UI flags or messages, prefer `useTemporaryState` rather than ad-hoc `setTimeout` calls.
Avoid `any` in widget state callbacks. Declare explicit shapes for saved state and callbacks.
Keep networked widgets on the shared patterns (`useNetworkedWidget`, `useNetworkedWidgetState`, `useSocketEvents`).
Keep commits atomic and add files explicitly.
Use `tmux` for long-running commands and `trash` instead of `rm` for deletions.

---

## Project Overview

This is a React-based classroom widgets application that provides interactive tools for classroom management and student engagement. The app allows users to add, position, resize, and remove various widget components on a shared workspace. The system includes both a teacher application and a student participation app for real-time interaction.

## Key Technologies

- React 18.3.1 with Vite (build tool)
- TypeScript (100% TypeScript codebase - all .ts/.tsx files)
- Tailwind CSS 3.4.17 for styling
- React-RND 10.4.12 for drag-and-drop and resizing functionality
- React-Confetti-Explosion for celebration effects
- Socket.io for real-time communication
- Express.js backend server
- Zustand for state management

## Essential Commands

```bash
# Development
npm run dev        # Start teacher app dev server (Vite) on localhost:3000
npm run dev:all    # Start all services (teacher + server + student)

# Testing
npm test           # Run tests with Vitest

# Building
npm run build      # Build teacher app (auto-generates voice types)
npm run build:all  # Build all applications (teacher + student)

# Setup
npm run install:all  # Install dependencies for all workspaces

# Voice Command System
npm run generate:voice-types  # Generate TypeScript/JS from shared/voiceCommandDefinitions.json
```

## Architecture

### System Architecture

This is a **monorepo** with 3 main parts:

1. **Teacher Frontend** (`src/`)
   - React + TypeScript application with Vite
   - Development: `localhost:3000`
   - Production: Served by Nginx

2. **Backend Server** (`server/`)
   - Express.js + Socket.io for real-time communication
   - Runs on port 3001
   - Handles API requests and WebSocket connections

3. **Student Frontend** (`server/src/student/`)
   - Separate lightweight React + TypeScript app built with Vite
   - Build output: `server/public/`
   - Served at `/student` path by the Express server
   - **Not a separate server** - embedded in Express

### Request Flow
- Teacher app → Vite dev server (dev) or Nginx (production)
- Real-time widgets → Socket.io connection to Express server
- Student app → Express serves built React app at `/student`
- Student interactions → Socket.io events to Express server

### Testing Checklist
When making changes, ensure:
- [ ] Widget focus/blur behavior works correctly
- [ ] Keyboard shortcuts work when widgets are focused
- [ ] Networked widget state synchronization is maintained
- [ ] Button styling is consistent across all widgets
- [ ] Canvas clicks clear widget focus

### Known Patterns
1. Always use `buttons.primary` or `buttons.danger` from styles utility for action buttons
2. NetworkedWidgetEmpty component handles the pre-session state
3. Widget focus is managed through the workspace store
4. Canvas clicks should clear widget focus
5. Networked widgets use shared infrastructure:
   - `useNetworkedWidget` - Room lifecycle management
   - `useNetworkedWidgetState` - Active state with socket sync
   - `NetworkedWidgetOverlays` - Paused/reconnecting/disconnected states
   - `NetworkedWidgetStats` - Floating stats display
   - `NetworkedWidgetControlBar` - Play/pause and clear buttons
   - `withWidgetProvider` - HOC for WidgetProvider wrapper
   - `getEmptyStateButtonText/Disabled` - Button state helpers

### Widget System
The application uses a dynamic widget system where widgets are:
1. Added via toolbar buttons - each creates a new widget instance with unique UUID
2. Positioned using react-rnd (draggable within bounds)
3. Resizable with aspect ratio constraints
4. Removable by dragging to the trash icon

### Available Widgets
- **Randomiser** (`src/components/randomiser/`) - Random selection with confetti, dual textarea for active/removed items
- **Timer** (`src/components/timer/`) - Countdown/timing functionality
- **List** (`src/components/list/`) - Task list with confetti trigger
- **Task Cue** (`src/components/taskCue/`) - Visual work mode indicators
- **Traffic Light** (`src/components/trafficLight/`) - Status indicators
- **Volume Level Monitor** (`src/components/volumeLevel/`) - Audio level visualization
- **Link Shortener** (`src/components/shortenLink/`) - URL shortening (requires API key)
- **Poll** (`src/components/poll/`) - Real-time polling with student participation via activity codes
- **Text Banner** (`src/components/textBanner/`) - Customizable text display
- **Image Display** (`src/components/imageDisplay/`) - Image viewer widget
- **Sound Effects** (`src/components/soundEffects/`) - Sound effect player
- **Sticker** (`src/components/sticker/`) - Decorative stickers for the workspace
- **QR Code** (`src/components/qrcode/`) - QR code generator for sharing links with students
- **Link Share** (`src/components/linkShare/`) - Collect link submissions from students
- **RT Feedback** (`src/components/rtFeedback/`) - Real-time feedback slider (1-5 scale) for gauging student understanding

### Voice Command System
The application includes a sophisticated voice command system for hands-free widget control.

**Key Features**:
- Speech recognition using Annyang library
- Hybrid processing: Fast pattern matching + AI fallback (Ollama)
- Single source of truth: `shared/voiceCommandDefinitions.json`
- Auto-generated type definitions for frontend/backend sync

**Important Files**:
- `shared/voiceCommandDefinitions.json` - **Edit this** to add/modify voice commands
- `scripts/generateVoiceCommandTypes.cjs` - Auto-generates TypeScript/JavaScript from JSON
- `src/features/voiceControl/` - Voice interface and command execution
- `server/src/services/OllamaLLMService.js` - AI-powered natural language processing

**Adding Voice Commands**:
1. Edit `shared/voiceCommandDefinitions.json`
2. Run `npm run generate:voice-types` (or just build - runs automatically)
3. Implement command handlers in `VoiceCommandExecutor.ts`

**Processing Flow**:
1. Speech → Text (Annyang)
2. Pattern matching (~5ms) - Most commands match here
3. If confidence < 80% → Ollama AI fallback (~200-800ms)
4. Command execution (create/control widgets)

See [VOICE_COMMAND_SHARED_DEFINITIONS.md](./VOICE_COMMAND_SHARED_DEFINITIONS.md) for complete documentation.

### Toolbar Features
- Widget creation buttons (customizable selection with transparent backgrounds)
- "More" button for accessing all widgets
- Sticker mode for placing decorative elements
- Voice control button (microphone icon) for hands-free operation
- Menu with:
  - Reset workspace
  - Background selection (geometric, gradient, lines, dots)
  - Toolbar customization
  - Dark/light mode toggle
- Server connection indicator (WiFi icon - green when connected, gray when offline)
- Integrated clock display (shows current time in 12-hour format with blinking colon)
- Trash icon for widget deletion (appears on hover with 1.5s delay before hiding)

### State Management
- Widget instances stored in `componentList` array with `{id, index}` structure
- `activeIndex` tracks currently selected widget for z-index management
- Uses React hooks for local state (no global state management)
- Workspace persistence via localStorage
- Widget-specific state saved in `widgetStates` Map
- Global modal system via ModalContext

### File Structure
```
src/
├── app/                     # Application-level code
│   ├── App.tsx             # Main application component
│   ├── App.css             # Application styles
│   └── providers/          # App-wide providers (ModalProvider)
├── features/               # Feature-based modules
│   ├── board/             # Board/canvas functionality
│   │   ├── components/    # Board components
│   │   └── hooks/         # Board-specific hooks
│   ├── toolbar/           # Toolbar feature
│   │   └── components/    # Toolbar components
│   ├── widgets/           # All widget implementations
│   │   ├── [widget-name]/ # Individual widget folders
│   │   └── shared/        # Shared widget components
│   └── session/           # Session/networking features
│       ├── components/    # Session components
│       └── hooks/         # Session hooks
├── shared/                 # Shared across features
│   ├── components/        # Reusable components
│   ├── hooks/            # Shared React hooks
│   ├── utils/            # Utility functions
│   ├── types/            # TypeScript types
│   ├── constants/        # Shared constants
│   └── backgrounds/      # Background assets
├── components/ui/          # UI component library
├── contexts/              # React contexts
├── services/              # Services (WidgetRegistry, ErrorService)
├── store/                 # State management (Zustand)
├── sounds/                # Sound assets
└── styles/                # Global styles

server/                     # Backend server for real-time features
├── src/                   # Server source code
│   ├── index.js          # Express/Socket.io server
│   └── student/          # Student React app source
│       ├── components/   # Student app components
│       └── *.tsx/css     # Student app files
└── public/               # Built student app files
```

## Important Implementation Details

1. **Widget Creation**: When adding widgets, always generate a unique ID using uuid()
2. **Positioning**: New widgets appear at (0,0). The react-rnd library handles drag boundaries
3. **Z-Index Management**: Active widget should have highest z-index (100 + index)
4. **Aspect Ratio**: All widgets maintain aspect ratio when resizing except Traffic Light and Randomiser
5. **Size Constraints**: 
   - Default size: 350x350px
   - Randomiser widget: 350x250px (landscape orientation)
   - Poll widget: 400x450px
   - Timer widget: 350x415px (maintains specific aspect ratio)
   - Traffic Light: 300x175px
   - Sound Effects: 80x420px (tall narrow layout)
6. **Cleanup**: Remove widgets by implementing drag-to-trash functionality
7. **Click Handling in Widgets**: Interactive elements inside widgets must be excluded from drag handling
   - Add the `clickable` class to any div/element with onClick handlers
   - Standard HTML elements (button, input, textarea, select, a) are automatically excluded
   - Without this, the first click on these elements gets consumed by react-rnd's drag handler
   - See WidgetWrapper.tsx `cancel` prop for the full list of excluded selectors

## Known Issues

- Link Shortener widget may have CORS restrictions with Short.io API when deployed
- Server must be running separately for networked widgets (Poll, Questions, Link Share, RT Feedback)

## Styling Guidelines

### Color Palette
- **Background**: `#f7f5f2` (warm off-white) 
- **Widget backgrounds**: `bg-soft-white` (#fdfcfb)
- **Shadows**: Use `shadow-sm` for subtle depth
- **Text colors**: Use warm-gray scale (warm-gray-600 to warm-gray-800)
- **Primary actions**: Sage green (sage-500/600)
- **Secondary actions**: Terracotta (terracotta-500/600)
- **Destructive actions**: Dusty rose (dusty-rose-500/600)
- **Borders**: warm-gray-200/300

### Typography
- **Student-facing content** (results, displays): Large text sizes (text-2xl, text-lg)
- **UI controls** (buttons, labels): Small text sizes (text-sm)
- **Headings in modals**: text-base for main titles, text-sm for section headers
- **Consistent font sizes** across all widget settings screens

### Button Styling
- **Primary buttons**: Use `px-3 py-1.5` padding with `text-sm`
- **Button text**: Place text directly in button element, avoid `<span>` wrappers
- **Consistent height**: ~24px height achieved through padding, avoid percentage-based heights
- **Container spacing**: Use `mt-2 pb-3` for button containers to ensure consistent margins
- **Alignment**: Center buttons using `flex justify-center`
- **Color scheme**: 
  - Primary actions: bg-sage-500 hover:bg-sage-600
  - Destructive actions: bg-dusty-rose-500 hover:bg-dusty-rose-600
  - Secondary actions: bg-terracotta-500 hover:bg-terracotta-600
- **Disabled state**: opacity-50 cursor-not-allowed
- **Buttons with icons**: Use `inline-flex items-center` for proper alignment

### Layout Principles
- **Widget centering**: Use `flex items-center` on main containers
- **Consistent margins**: Ensure equal left/right spacing
- **Modal dialogs**: Max width with centered positioning
- **Responsive design**: Use percentage-based heights for sections

### Component Structure
- **Main display area**: ~75% height
- **Control area**: ~10-15% height
- **Padding**: Use consistent padding (p-4, px-6 py-4 for modals)

### Networked Widget Pattern
Networked widgets (Poll, Questions, Link Share, RT Feedback) use a shared component architecture:

**Shared Hooks** (`src/features/session/hooks/`):
- `useNetworkedWidget` - Room lifecycle, recovery data, session management
- `useNetworkedWidgetState` - Active/paused state with automatic socket sync
- `useSocketEvents` - Socket event listener management with cleanup

**Shared Components** (`src/features/widgets/shared/`):
- `NetworkedWidgetEmpty` - Empty state before room exists
- `NetworkedWidgetControlBar` - Play/pause, settings, clear buttons
- `NetworkedWidgetOverlays` - Paused, reconnecting, disconnected overlays
- `NetworkedWidgetStats` - Floating statistics display (top-right)
- `withWidgetProvider` - HOC to wrap with WidgetProvider

**Shared Utilities** (`src/features/widgets/shared/utils/`):
- `getEmptyStateButtonText()` - Returns button text based on connection state
- `getEmptyStateDisabled()` - Returns whether button should be disabled

**Standard Structure**:
```tsx
function MyWidget({ widgetId, savedState, onStateChange }: WidgetProps) {
  // Room lifecycle
  const { hasRoom, isStarting, error, handleStart, session, recoveryData } =
    useNetworkedWidget({ widgetId, roomType: 'myWidget', ... });

  // Active state with socket sync
  const { isActive, toggleActive } = useNetworkedWidgetState({
    widgetId, roomType: 'myWidget', hasRoom, recoveryData
  });

  if (!hasRoom) {
    return <NetworkedWidgetEmpty ... />;
  }

  return (
    <div className={widgetWrapper}>
      <div className={`${widgetContainer} relative`}>
        <NetworkedWidgetStats>{count} items</NetworkedWidgetStats>
        <NetworkedWidgetOverlays isActive={isActive} ... />
        <div className="flex-1 p-4 pt-8">{/* Content */}</div>
      </div>
      <NetworkedWidgetControlBar isActive={isActive} onToggleActive={toggleActive} ... />
    </div>
  );
}

export default withWidgetProvider(MyWidget, 'MyWidget');
```

## Development Notes

- TypeScript configuration in `tsconfig.json` with strict mode enabled
- Vite for fast development and optimized production builds
- ESLint configuration extends react-app defaults
- Audio files for sound effects are co-located with widget components

## Server Features

### Running the Server
```bash
# Start all services concurrently (recommended)
npm run dev:all

# Or run separately:
npm run dev         # Teacher app on port 3000
npm run dev:server  # Server on port 3001
npm run dev:student # Student app dev server
```

### Real-time Features
- Activity-based sessions with 5-character codes
- WebSocket communication via Socket.io
- Live vote tracking and result broadcasting
- Participant count monitoring
- Automatic room cleanup after 12 hours

### Student App Features
- **URL**: Students visit `http://[server-ip]:3001` or production URL
- **Join Activities**: Enter 5-character activity codes to join
- **Supported Activities**:
  - **Poll**: Vote on multiple choice questions, see live results
  - **Link Share**: Submit link responses to teacher prompts
  - **RT Feedback**: Adjust feedback slider (1-5 scale) in real-time
- **Multiple Sessions**: Can join multiple activities simultaneously
- **Responsive Design**: Works on phones, tablets, and computers
- **Dark Mode**: Toggle between light and dark themes
- **Connection Status**: Visual indicators for connection state
- **Auto-sync**: Receives room state updates (active/paused) from teacher
- **Admin Dashboard**: Enter "ADMIN" as session code to view all active sessions (read-only)

### Admin Dashboard
Access by entering "ADMIN" as the session code in the student app.

**Features:**
- View all active sessions with participant counts
- See which widgets are active per session
- Widget-specific data (poll questions, vote counts, etc.)
- Auto-refresh every 10 seconds
- Read-only (no destructive actions)

**Security Note**: Protected only by knowledge of the "ADMIN" code. All operations are read-only by design.

### Server Security
- **Host verification**: All destructive actions verify `session.hostSocketId === socket.id`
- **Rate limiting**: Per-event limits prevent abuse (see `server/src/middleware/socketAuth.js`)
- **Input validation**: All socket events validated server-side (see `server/src/utils/validation.js`)
- **Error handling**: Standardized error codes and responses (see `server/src/utils/errors.js`)

## Recent Updates

### Network API Reliability & Admin Dashboard (January 2025)
- Fixed `useSocketEvents` cleanup bug (now removes only specific handlers)
- Fixed session recovery with AbortController, retry, and exponential backoff
- Added input validation for all socket events (`server/src/utils/validation.js`)
- Added standardized error codes and responses (`server/src/utils/errors.js`)
- Enabled per-event rate limiting to prevent abuse
- Added `session:cleanupRooms` handler for orphaned room cleanup
- Added read-only admin dashboard (access via "ADMIN" code in student app)
- See [SOCKET_EVENTS.md](./SOCKET_EVENTS.md) for updated API documentation
- See [ARCHITECTURE.md](./ARCHITECTURE.md) for security documentation

### Networked Widget Common Base Architecture (January 2025)
- Created shared infrastructure to reduce code duplication across networked widgets
- New hooks: `useNetworkedWidgetState` for active state management with socket sync
- New components: `NetworkedWidgetOverlays`, `NetworkedWidgetStats`
- New utilities: `getEmptyStateButtonText()`, `getEmptyStateDisabled()`
- New HOC: `withWidgetProvider` to extract WidgetProvider wrapper pattern
- All 4 networked widgets (Poll, Questions, RTFeedback, LinkShare) refactored
- LinkShare now uses `NetworkedWidgetControlBar` for consistency
- Consistent overlay behavior (paused, reconnecting, disconnected) across all widgets
- ~200 lines of code removed through consolidation

### Voice Command Shared Definitions System (January 2025)
- Implemented single source of truth for voice commands: `shared/voiceCommandDefinitions.json`
- Auto-generation script creates TypeScript and JavaScript from JSON definitions
- Frontend and backend widget names now perfectly synchronized
- Ollama AI prompts auto-generated from shared definitions
- Build process automatically regenerates type files
- Eliminates naming mismatch bugs between frontend executor and backend services
- See [VOICE_COMMAND_SHARED_DEFINITIONS.md](./VOICE_COMMAND_SHARED_DEFINITIONS.md)

### Voice Command System (January 2025)
- Hybrid approach: Fast pattern matching (~5ms) + AI fallback via Ollama (~200-800ms)
- Confidence threshold (80%) determines when to use AI
- Pattern matching tries first for speed, Ollama handles edge cases
- Success feedback with beep sound, text-to-speech, and auto-close modal
- Server-side dotenv configuration for Ollama integration
- Fixed hook initialization order in VoiceInterface component

### Focus System Implementation (August 2025)
- Added `focusedWidgetId` tracking to workspace store
- `WidgetWrapper` handles focus on click and passes `isActive` prop to widgets
- Sound Effects widget keyboard shortcuts (1-9, 0) now work when widget is focused
- Clicking on the canvas (outside widgets) clears the focused widget

### Networked Widget Improvements (August 2025)
- Fixed state synchronization when sessions are closed
- All networked widgets properly reflect disconnected state when session ends
- Start/stop buttons now use consistent outline button styles
- Button styles defined in `src/shared/utils/styles.ts`:
  - Primary buttons: `buttons.primary` (sage theme with border)
  - Danger buttons: `buttons.danger` (dusty rose theme with border)

### RT Feedback Widget (formerly Understanding Feedback)
- Renamed from "Understanding Feedback" to "RT Feedback" throughout codebase
- Implements real-time feedback collection on a 1-5 scale
- Features pause/resume functionality that syncs with students
- No settings dialog - simplified interface with just Start/Stop
- Students see appropriate UI based on room state when joining
- Visual feedback scale from "Too Easy" to "Too Hard"
- Live average calculation and distribution chart

### UI Improvements
- Toolbar buttons now have transparent backgrounds (opacity 80)
- WiFi connection indicator moved to right of settings menu
- Trash icon appears on widget hover with 1.5s delay before hiding
- Fixed nested button warning in Randomiser widget
- All networked widgets now receive widgetId prop for state management

### Randomiser Widget
- Refactored to use internal state management in settings
- Dual textarea interface for active and removed items
- Real-time processing as user types
- Colorful gradient slot machine animation
- Adaptive spin speed based on number of items

### Poll Widget
- Full-stack implementation with Express/Socket.io server
- Real-time voting and result display
- Activity management with unique codes
- Fixed synchronization issues for late-joining students
- Responsive student interface for any device

### Widget Drag and Drop Implementation
- Uses **react-rnd** library (v10.4.12) for draggable and resizable widgets
- Widgets can be dragged anywhere within the board bounds
- Resize handles on bottom-right corner
- Aspect ratio locking available for certain widgets
- **Scale-aware dragging**: The `scale` prop is passed to react-rnd to ensure accurate drag behavior at all zoom levels

### Zoom/Scale Implementation
- Pinch-to-zoom support for trackpad and touch devices
- Zoom maintains the point under the cursor/finger in the same viewport position
- Scale range: 0.5x to 2x
- Uses CSS transform scale with transform-origin at (0, 0)
- Board dimensions: 3000x2000 logical pixels
- Visual size = board size × scale
- Scroll-based zoom to handle browser coordinate system constraints

#### Zoom Algorithm
The zoom implementation uses a three-coordinate system approach:

1. **Board Coordinates**: Fixed logical coordinates (0-3000, 0-2000) used by widgets
2. **Visual Coordinates**: Board coordinates × scale (what's actually rendered)
3. **Viewport Coordinates**: Visual coordinates - scroll offset (what user sees)

**Key Formula**: To keep a point stationary during zoom:
```
newScroll = boardPoint × newScale - viewportPoint
```

Where:
- `boardPoint` = The board coordinate at the zoom origin (mouse/finger position)
- `newScale` = The target zoom scale
- `viewportPoint` = The viewport position where we want to keep the board point
- `newScroll` = The scroll position needed to maintain the point's viewport position

**Implementation Details**:
1. Transform-origin fixed at (0, 0) to simplify coordinate calculations
2. Size wrapper div scales with zoom to provide correct scroll boundaries
3. Event batching for smooth zoom on rapid wheel events
4. Hardware acceleration with CSS transforms
5. Synchronous scroll updates after scale changes to prevent jitter
6. React-rnd widgets receive the scale prop for proper drag compensation

**Board Structure**:
```jsx
<div className="board-scroll-container">  // Scrollable container
  <div style={{ width: 3000*scale, height: 2000*scale }}>  // Size wrapper
    <div style={{ transform: `scale(${scale})` }}>  // Scale wrapper
      <div className="board">  // Actual board (3000x2000)
        {widgets}
      </div>
    </div>
  </div>
</div>
```
