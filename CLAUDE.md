# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React-based classroom widgets application that provides interactive tools for classroom management and student engagement. The app allows users to add, position, resize, and remove various widget components on a shared workspace.

## Key Technologies

- React 18.3.1 with Create React App
- Mixed JavaScript/TypeScript (components use .tsx, main files use .js)
- Tailwind CSS 3.4.17 for styling
- React-RND for drag-and-drop and resizing functionality
- Face-api.js for face recognition features
- React-Confetti for celebration effects
- Socket.io for real-time communication (Poll widget)
- Express.js for server-side functionality

## Essential Commands

```bash
# Development
npm start          # Start development server on localhost:3000

# Testing
npm test           # Run tests in watch mode (Jest + React Testing Library)

# Building
npm build          # Create production build in ./build folder

# Setup (optional - for Link Shortener widget)
# Copy .env.example to .env and add your Short.io API key
cp .env.example .env
# Then edit .env and set VITE_SHORTIO_API_KEY to your API key
```

## Architecture

### System Architecture: 2 Servers

This application uses a **2-server architecture**:

1. **Frontend Server (Teacher App)**
   - React application for the main classroom widgets interface
   - Development: Webpack dev server on port 3000
   - Production: Nginx container on port 80
   - Deployed at: widgets.tk.sg

2. **Backend Server (Express with dual purpose)**
   - **API & WebSocket Server**: Handles real-time features for Poll and DataShare widgets
   - **Student App Server**: Serves the student React app at `/student` path
   - Runs on port 3001
   - Deployed at: go.tk.sg

### Student App Architecture

The student app is **embedded within the Express server**:
- Source location: `/server/src/student/` (separate React app built with Vite)
- Build output: `/server/public/`
- Served at: `http://[server]:3001/student`
- **Not a separate server** - served by the same Express instance

### Request Flow
- Teacher accesses main app → `https://widgets.tk.sg` → Nginx serves React app
- Teacher creates activity → React app calls → `https://go.tk.sg/api/*` → Express API
- Student joins activity → `https://go.tk.sg/student` → Express serves student React app
- Student WebSocket connection → `wss://go.tk.sg/socket.io` → Same Express server

This design is efficient because it:
- Reduces the number of services to manage (only 2 containers)
- Eliminates CORS issues between student app and API
- Simplifies SSL configuration and deployment
- Shares resources between API and student app serving

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

### Toolbar Features
- Widget creation buttons (customizable selection)
- "More" button for accessing all widgets
- Sticker mode for placing decorative elements
- Menu with:
  - Reset workspace
  - Background selection (geometric, gradient, lines, dots)
  - Toolbar customization
  - Dark/light mode toggle
- Integrated clock display (shows current time in 12-hour format with blinking colon)
- Trash icon for widget deletion

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
├── App.tsx                  # Main application with widget management logic
├── components/              # Individual widget components
│   ├── [widget-name]/      # Each widget in its own folder
│   │   ├── index.tsx       # Component export
│   │   └── [widget].tsx    # Component implementation
│   ├── backgrounds/        # Background pattern components
│   ├── toolbar/           # Toolbar and customization components
│   └── Widget/            # Widget container and renderer
├── constants/              # Widget types and configurations
├── contexts/               # React contexts (Modal)
├── hooks/                  # Custom React hooks
├── utils/                  # Helper functions
├── secrets/                # API key configuration
server/                      # Backend server for real-time features
├── src/                    # Server source code
│   ├── index.js           # Express/Socket.io server
│   └── student/           # Student React app source
│       ├── components/    # Student app components
│       └── *.tsx/css     # Student app files
└── public/                 # Built student app files
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

## Known Issues

- Link Shortener doesn't work when deployed due to CORS restrictions with Short.io API
- The default test file (App.test.js) is outdated and doesn't test actual functionality
- Mixed file extensions (.js/.tsx) without proper TypeScript configuration
- Server must be running separately for Poll widget functionality

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

## Development Notes

- No custom linting beyond Create React App defaults
- No TypeScript config file despite using .tsx files
- Face detection models are stored in the public folder
- Audio files for sound effects are in component folders

## Server Features (for Poll Widget)

### Running the Server
```bash
# Start server and React app together
./start-with-server.sh

# Or run separately:
cd server && npm start  # Server on port 3001
npm start              # React app on port 3000
```

### Real-time Features
- Activity-based sessions with 5-character codes
- WebSocket communication via Socket.io
- Live vote tracking and result broadcasting
- Participant count monitoring
- Automatic room cleanup after 12 hours

### Student Participation
- Students visit `http://[server-ip]:3001`
- Enter activity code to join poll
- Vote on questions in real-time
- See results after voting

## Recent Updates

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