# Prop Drilling Refactoring Guide

## Problem Analysis

The widget components in this codebase exhibit several prop drilling patterns:

1. **Widget Props**: `widgetId`, `savedState`, and `onStateChange` are passed through multiple component layers
2. **Session State**: Session object is passed via render props pattern
3. **Callback References**: Using refs to pass callbacks up the component tree (anti-pattern)
4. **Repeated Props**: Same props passed to many components

## Solution Approach

### 1. Widget Context

Created `WidgetContext` to provide widget-specific props:
- Eliminates passing `widgetId`, `savedState`, `onStateChange` through every layer
- Makes widget components more composable

### 2. Networked Widget Context

Created context within `NetworkedWidgetWrapperV2`:
- Provides session and room state to all child components
- Removes need for render props pattern
- Simplifies component interfaces

### 3. Component Composition

Instead of render props:
```tsx
// OLD: Render props pattern
<NetworkedWidgetWrapper>
  {({ session, isRoomActive }) => (
    <Component session={session} isRoomActive={isRoomActive} />
  )}
</NetworkedWidgetWrapper>

// NEW: Context + composition
<NetworkedWidgetWrapperV2>
  <Component /> {/* Gets session from context */}
</NetworkedWidgetWrapperV2>
```

## Migration Steps

1. **For new widgets**: Use the V2 components and contexts
2. **For existing widgets**: Gradually migrate when making changes

### Example Migration

Before:
```tsx
function Widget({ widgetId, savedState, onStateChange }) {
  return (
    <NetworkedWidgetWrapper
      widgetId={widgetId}
      savedState={savedState}
      onStateChange={onStateChange}
      // ... more props
    >
      {({ session, isRoomActive }) => (
        // Component using session and isRoomActive
      )}
    </NetworkedWidgetWrapper>
  );
}
```

After:
```tsx
function Widget({ widgetId, savedState, onStateChange }) {
  return (
    <WidgetProvider widgetId={widgetId} savedState={savedState} onStateChange={onStateChange}>
      <NetworkedWidgetWrapperV2 roomType="poll" title="Poll">
        <WidgetContent /> {/* Uses contexts */}
      </NetworkedWidgetWrapperV2>
    </WidgetProvider>
  );
}
```

## Benefits

1. **Reduced Coupling**: Components don't need to know about props they don't use
2. **Better Composition**: Can create new widget variations easily
3. **Cleaner Interfaces**: Components only receive props they actually need
4. **Easier Testing**: Can provide mock contexts for testing
5. **Better Performance**: Less prop passing means fewer re-renders

## Considerations

1. **Gradual Migration**: Don't need to refactor all widgets at once
2. **Context Performance**: Use multiple contexts to avoid unnecessary re-renders
3. **Type Safety**: Ensure contexts are properly typed

## Next Steps

1. Create widget-specific contexts for complex state (e.g., PollContext)
2. Move shared widget state to Zustand store
3. Create HOCs for common widget patterns
4. Document context usage patterns