# Centralized State Management

The application now uses a centralized state management system built with React Context and useReducer.

## Architecture

### WorkspaceContext
The main state container that manages:
- **widgets**: Array of widget instances
- **widgetPositions**: Map of widget positions and sizes
- **widgetStates**: Map of widget-specific states
- **activeWidgetId**: Currently selected widget
- **backgroundType**: Current background pattern
- **stickerMode**: Sticker placement mode state

### Actions
- `ADD_WIDGET`: Create a new widget
- `REMOVE_WIDGET`: Delete a widget
- `UPDATE_WIDGET_POSITION`: Update widget position/size
- `UPDATE_WIDGET_STATE`: Update widget-specific state
- `SET_ACTIVE_WIDGET`: Change active widget
- `SET_BACKGROUND`: Change background type
- `SET_STICKER_MODE`: Toggle sticker mode
- `LOAD_WORKSPACE`: Load saved workspace
- `RESET_WORKSPACE`: Clear all widgets

## Usage

### In Components
```typescript
import { useWorkspace } from '../store/WorkspaceContext';

function MyComponent() {
  const { state, addWidget, updateWidgetState } = useWorkspace();
  
  // Access state
  console.log(state.widgets);
  
  // Dispatch actions
  addWidget(WIDGET_TYPES.TIMER);
  updateWidgetState(widgetId, { color: 'blue' });
}
```

### Persistence
The `useWorkspaceSync` hook automatically:
- Loads workspace from localStorage on mount
- Saves changes to localStorage (debounced)

## Migration from Old App.tsx

The new architecture provides:
1. **Cleaner code**: No more prop drilling
2. **Better performance**: Optimized re-renders
3. **Easier testing**: Isolated state logic
4. **Type safety**: Full TypeScript support
5. **Scalability**: Easy to add new features

## Files

- `WorkspaceContext.tsx`: Main context and reducer
- `ToolbarAdapter.tsx`: Adapts old toolbar to new API
- `AppWithContext.tsx`: New app using context
- `useWorkspaceSync.ts`: Persistence hook