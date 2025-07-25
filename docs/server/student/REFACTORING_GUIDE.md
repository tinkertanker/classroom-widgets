# Student App Refactoring Guide

This document outlines the refactored architecture of the student app, designed to fully embrace the session-based approach and reduce code duplication.

## Overview of Changes

### 1. **Shared Types and Interfaces** (`types/activity.types.ts`)
- `BaseActivityProps`: Common props for all activities
- Extended props for specific activities (Poll, Link Share, etc.)
- `ActivityState`: Common state interface
- `SocketEventMap`: Type-safe socket events
- `ActivityRoomType`: Union type from widget registry

### 2. **Common Hooks**

#### `useActivitySocket` (`hooks/useActivitySocket.ts`)
Manages socket lifecycle for all activities:
- Automatic room join/leave
- Wrapped emit/on/off methods with safety checks
- Event handler cleanup
- Initial state request timing

```typescript
const { emit, on, off, isConnected } = useActivitySocket({
  socket,
  sessionCode,
  roomType: 'poll',
  widgetId,
  onRequestState: () => {
    emit('poll:requestState', { code: sessionCode, widgetId });
  }
});
```

### 3. **Base Components** (`components/ActivityBase.tsx`)
Reusable UI components:
- `ActivityBase`: Container with common states (paused, error, active)
- `ConnectionIndicator`: Shows connection status
- `SuccessMessage`: Animated success notifications
- `ActivityStatus`: Status bars with variants

### 4. **Dynamic Activity Renderer** (`components/ActivityRenderer.tsx`)
- Lazy loads activity components based on room type
- Maps props appropriately for each activity type
- Error boundaries for each activity
- Uses widget registry for configuration

### 5. **Centralized Configuration** (`config/studentApp.config.ts`)
All app settings in one place:
- Animation timings
- UI dimensions
- Socket settings
- Error/success messages
- Activity-specific configurations

### 6. **Consistent Styling** (`styles/activityStyles.ts`)
Shared style constants:
- Container styles
- Typography classes
- Button variants
- Input styles
- Status message styles
- Activity-specific color schemes

## Migration Guide

### Refactoring an Activity Component

Before:
```typescript
const PollActivity: React.FC<Props> = ({ socket, roomCode, ... }) => {
  // Lots of boilerplate for socket management
  useEffect(() => {
    socket.emit('session:joinRoom', { ... });
    return () => {
      socket.emit('session:leaveRoom', { ... });
    };
  }, [...]);
  
  // Manual event handling
  useEffect(() => {
    socket.on('poll:stateChanged', handler);
    return () => socket.off('poll:stateChanged', handler);
  }, [...]);
  
  // Inline UI for different states
  if (!isActive) {
    return <div>Paused...</div>;
  }
  
  return <div>...</div>;
};
```

After:
```typescript
const PollActivityRefactored: React.FC<PollActivityProps> = ({ ... }) => {
  // Use common hook for socket management
  const { emit, on, off, isConnected } = useActivitySocket({
    socket,
    sessionCode,
    roomType: 'poll',
    widgetId,
    onRequestState: () => emit('poll:requestState', { ... })
  });
  
  // Simplified event handling
  useEffect(() => {
    on('poll:stateChanged', handleStateChanged);
    return () => off('poll:stateChanged', handleStateChanged);
  }, [on, off]);
  
  // Use base component for common UI
  return (
    <ActivityBase
      title={pollData.question}
      isActive={pollData.isActive}
      isConnected={isConnected}
      error={error}
    >
      {/* Activity-specific content */}
    </ActivityBase>
  );
};
```

## Benefits of Refactoring

1. **Reduced Code Duplication**
   - Socket management logic extracted to hook
   - Common UI patterns in base components
   - Shared styles and configurations

2. **Improved Maintainability**
   - Single source of truth for configurations
   - Consistent patterns across activities
   - Easier to add new activities

3. **Better Type Safety**
   - Typed socket events
   - Proper prop interfaces
   - Widget registry integration

4. **Enhanced Developer Experience**
   - Clear separation of concerns
   - Reusable components and hooks
   - Centralized documentation

## Adding a New Activity

1. Add activity type to widget registry
2. Create activity component using base components:
   ```typescript
   const NewActivity: React.FC<NewActivityProps> = (props) => {
     const { emit, on, off, isConnected } = useActivitySocket({
       socket: props.socket,
       sessionCode: props.sessionCode,
       roomType: 'newActivity',
       widgetId: props.widgetId
     });
     
     return (
       <ActivityBase {...baseProps}>
         {/* Your activity UI */}
       </ActivityBase>
     );
   };
   ```
3. Add to activity components map in `ActivityRenderer`
4. Add activity-specific configuration to `studentApp.config.ts`

## Testing Considerations

The refactored architecture makes testing easier:
- Mock `useActivitySocket` for isolated component testing
- Test base components separately
- Use configuration objects for consistent test data
- Activity components focus on business logic, not infrastructure

## Performance Improvements

1. **Lazy Loading**: Activities load only when needed
2. **Event Cleanup**: Proper cleanup prevents memory leaks
3. **Optimized Rerenders**: Better state management
4. **Animation Control**: Centralized timing configuration

## Next Steps

1. Migrate remaining activity components to new patterns
2. Add unit tests for hooks and base components
3. Create Storybook stories for UI components
4. Add performance monitoring
5. Implement error tracking

This refactoring provides a solid foundation for maintaining and extending the student app with the session-based architecture.