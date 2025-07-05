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

## Essential Commands

```bash
# Development
npm start          # Start development server on localhost:3000

# Testing
npm test           # Run tests in watch mode (Jest + React Testing Library)

# Building
npm build          # Create production build in ./build folder

# Setup (required before first run)
cp src/secrets/shortioKey.example.js src/secrets/shortioKey.js
# Then add your Short.io API key to shortioKey.js
```

## Architecture

### Widget System
The application uses a dynamic widget system where widgets are:
1. Added via toolbar buttons - each creates a new widget instance with unique UUID
2. Positioned using react-rnd (draggable within bounds)
3. Resizable with aspect ratio constraints
4. Removable by dragging to the trash icon

### Available Widgets
- **Randomiser** (`src/components/randomiser/`) - Random selection with confetti
- **Timer** (`src/components/timer/`) - Countdown/timing functionality
- **List** (`src/components/list/`) - Task list with confetti trigger
- **Work Symbols** (`src/components/work/`) - Visual work mode indicators
- **Clock** (`src/components/clock/`) - Time display (smaller default size: 150px)
- **Traffic Light** (`src/components/trafficLight/`) - Status indicators
- **Volume Level Monitor** (`src/components/volumeLevel/`) - Audio level visualization
- **Link Shortener** (`src/components/shortenLink/`) - URL shortening (requires API key)

### State Management
- Widget instances stored in `componentList` array with `{id, index}` structure
- `activeIndex` tracks currently selected widget for z-index management
- Uses React hooks for local state (no global state management)

### File Structure
```
src/
├── App.js                    # Main application with widget management logic
├── components/              # Individual widget components
│   └── [widget-name]/      # Each widget in its own folder
│       ├── index.tsx       # Component implementation
│       └── [assets]        # Widget-specific assets
├── secrets/                # API key configuration
└── toolbar.js              # Toolbar component for adding widgets
```

## Important Implementation Details

1. **Widget Creation**: When adding widgets, always generate a unique ID using uuid()
2. **Positioning**: New widgets appear at (0,0). The react-rnd library handles drag boundaries
3. **Z-Index Management**: Active widget should have highest z-index (100 + index)
4. **Aspect Ratio**: All widgets maintain aspect ratio when resizing except Traffic Light and Randomiser
5. **Size Constraints**: 
   - Default size: 350x350px
   - Clock widget: 150x150px  
   - Randomiser widget: 350x250px (landscape orientation)
6. **Cleanup**: Remove widgets by implementing drag-to-trash functionality

## Known Issues

- Link Shortener doesn't work when deployed due to CORS restrictions with Short.io API
- The default test file (App.test.js) is outdated and doesn't test actual functionality
- Mixed file extensions (.js/.tsx) without proper TypeScript configuration

## Styling Guidelines

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
  - Primary actions: bg-teal-500 hover:bg-teal-600
  - Destructive actions: bg-red-500 hover:bg-red-600
  - Secondary actions: bg-yellow-500 hover:bg-yellow-600
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