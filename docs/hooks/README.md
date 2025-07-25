# Shared Hooks for Classroom Widgets

This directory contains reusable hooks that provide common functionality across widgets.

## Available Hooks

### `useResizeObserver`
Observes element resize events and provides current dimensions.

**Usage:**
```typescript
const [ref, size] = useResizeObserver<HTMLDivElement>((newSize) => {
  console.log('New size:', newSize);
});

return <div ref={ref}>Content</div>;
```

### `useAudio`
Manages audio playback with error handling and volume control.

**Usage:**
```typescript
const audioFile = require('./sound.mp3');
const { play, pause, stop, setVolume } = useAudio(audioFile, {
  volume: 0.5,
  preload: true
});

// Play sound
await play();
```

### `useEditMode`
Handles inline editing with keyboard shortcuts and save/cancel functionality.

**Usage:**
```typescript
const {
  isEditing,
  value,
  inputRef,
  startEdit,
  handleChange,
  handleKeyDown,
  handleBlur
} = useEditMode({
  initialValue: 'Click to edit',
  onSave: (newValue) => console.log('Saved:', newValue)
});
```

### `useWidgetSettings`
Manages widget settings modal and state updates.

**Usage:**
```typescript
const { state, openSettings, updateState } = useWidgetSettings(
  MySettingsComponent,
  {
    title: 'Widget Settings',
    initialState: { color: 'blue', size: 'medium' },
    onStateChange: (newState) => console.log('State changed:', newState)
  }
);
```

## Benefits

1. **Consistency**: All widgets behave the same way for common operations
2. **Maintainability**: Fix bugs or add features in one place
3. **Type Safety**: Full TypeScript support with proper types
4. **Performance**: Optimized implementations with proper cleanup
5. **Testability**: Easier to test isolated hook logic

## Migration Guide

To migrate existing widgets to use these hooks:

1. Identify common patterns (resize observers, audio, edit mode, etc.)
2. Replace custom implementations with hook usage
3. Remove duplicate code
4. Test that functionality remains the same

See `textBannerRefactored.tsx` for an example of a migrated widget.