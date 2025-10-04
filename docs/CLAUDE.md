# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
npm run build      # Build teacher app
npm run build:all  # Build all applications (teacher + student)

# Setup
npm run install:all  # Install dependencies for all workspaces
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
5. All networked widgets use `useNetworkedWidget` hook for connection management

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

### Toolbar Features
- Widget creation buttons (customizable selection with transparent backgrounds)
- "More" button for accessing all widgets
- Sticker mode for placing decorative elements
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
Networked widgets (Poll, Link Share, RT Feedback) follow a consistent UI structure:

1. **Container Structure**:
   ```jsx
   <div className="bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 w-full h-full flex flex-col p-4 relative">
   ```

2. **Empty State**: Use `NetworkedWidgetEmpty` component
   - Title and description
   - Large icon (5xl size, warm-gray-400/500)
   - "Create Room" button (sage-500 background)
   - Connection error display with server start instructions

3. **Active State**: Use `NetworkedWidgetHeader` with room code display
   - Activity code display (large text)
   - Student URL information
   - Control buttons in header

4. **Common Patterns**: 
   - Start/Stop toggle button (single button that changes color/icon)
   - Settings gear icon (optional - RT Feedback doesn't use it)
   - Status indicators for connection state
   - Participant count display
   - Widget cleanup on deletion notifies connected students

5. **Socket Management**: Use `useNetworkedWidget` hook for:
   - Room creation and connection
   - Socket event handling
   - Cleanup on unmount
   - `NetworkedWidgetHeader` at top showing:
     - Activity code (large, bold)
     - Student URL
     - Action buttons in header children
   - Main content area with `flex-1 overflow-y-auto`

4. **Common Patterns**:
   - Start/Stop button toggles between sage-500 (start) and dusty-rose-500 (stop)
   - Settings gear icon in top right
   - Status indicators (connection, participant count)
   - Real-time updates via Socket.io
   - useNetworkedWidget hook for connection management

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

## Recent Updates

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