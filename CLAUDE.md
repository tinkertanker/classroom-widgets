# Claude Development Notes

## Project Overview
Classroom Widgets is a React-based application for creating interactive classroom tools. It features both standalone and networked widgets that can be used for teaching and student engagement.

## Key Architecture Patterns

### Widget System
- All widgets are registered in `WidgetRegistry` 
- Widgets can be standalone or networked
- Networked widgets use Socket.io for real-time communication

### Focus Management
- Widgets track focus state via `focusedWidgetId` in the workspace store
- The `isActive` prop is passed to widgets to enable widget-specific keyboard shortcuts
- Clicking on the canvas (outside widgets) clears the focused widget

### Styling Patterns
- Consistent button styles are defined in `src/shared/utils/styles.ts`
- Primary buttons: `buttons.primary` (sage theme)
- Danger buttons: `buttons.danger` (dusty rose theme)
- All networked widget controls use these consistent styles

## Recent Updates

### Focus System Implementation
- Added `focusedWidgetId` tracking to workspace store
- `WidgetWrapper` handles focus on click and passes `isActive` prop
- Sound Effects widget keyboard shortcuts (1-9, 0) now work when widget is focused

### Networked Widget Improvements
- Fixed state synchronization when sessions are closed
- All networked widgets properly reflect disconnected state
- Start/stop buttons now use consistent outline button styles

## Development Commands
```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run lint       # Run ESLint
npm run typecheck  # Run TypeScript type checking
```

## Testing Checklist
- [ ] Test widget focus/blur behavior
- [ ] Verify keyboard shortcuts work when widgets are focused
- [ ] Check networked widget state synchronization
- [ ] Ensure consistent button styling across all widgets

## Known Patterns
1. Always use `buttons.primary` or `buttons.danger` for action buttons
2. NetworkedWidgetEmpty component handles the pre-session state
3. Widget focus is managed through the workspace store
4. Canvas clicks should clear widget focus