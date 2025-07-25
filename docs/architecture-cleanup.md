# Architecture Cleanup Summary

## Date: 2025-07-25

### Components Removed
- **ViewportCanvas** directory and all its contents:
  - `ViewportCanvas.tsx` - Custom canvas implementation
  - `ViewportWidget.tsx` - Custom widget wrapper
  - `DraggableWidget.tsx` - Custom drag implementation
  
### Reason for Removal
These components were part of the old architecture (used in AppWithContext.tsx) and have been replaced by:
- **Board** component for the canvas
- **WidgetWrapper** component using react-rnd for drag/drop functionality

### Current Widget System
The application now uses a cleaner, more maintainable approach:
1. **Board** component provides the zoomable/pannable canvas
2. **WidgetRenderer** renders individual widgets
3. **WidgetWrapper** uses react-rnd (v10.4.12) for:
   - Dragging widgets with proper scale compensation
   - Resizing widgets with constraints
   - Aspect ratio locking where needed

### Key Improvements
- Simpler codebase with less custom drag/drop code to maintain
- React-rnd handles edge cases and browser compatibility
- Scale-aware dragging works correctly at all zoom levels
- Consistent behavior across all widgets

### Technical Details
- React-rnd's `scale` prop ensures drag deltas are properly adjusted for zoom
- Board uses CSS transforms for zoom with a three-coordinate system
- Widgets maintain their positions in logical board coordinates (0-3000, 0-2000)