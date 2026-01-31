# Adding a New Widget

This guide explains how to add a new widget to the classroom widgets application using the canonical widget registry system.

## Overview

All widgets are defined in a single source of truth: `/src/services/WidgetRegistry.ts`. This ensures that when you add a new widget, all necessary configurations and integrations are handled automatically.

## Steps to Add a New Widget

### 1. Add Widget Type to Enum

First, add your widget to the `WidgetType` enum in `/src/shared/types/index.ts`:

```typescript
export enum WidgetType {
  // ... existing widgets ...
  MY_NEW_WIDGET = 18  // Use the next available number
}
```

Also add it to the legacy constants in `/src/shared/constants/widgetTypes.ts` for backward compatibility:

```typescript
export const WIDGET_TYPES = {
  // ... existing widgets ...
  MY_NEW_WIDGET: 18
};
```

### 2. Add Widget Definition to Registry

Add your widget definition to the `WidgetRegistry` class in `/src/services/WidgetRegistry.ts`:

```typescript
// First, import your widget component at the top of the file
const LazyWidgets = {
  // ... existing imports ...
  MyNewWidget: lazy(() => import('../features/widgets/myNewWidget')),
};

// Then in the initializeWidgets() method, add:
this.register({
  type: WidgetType.MY_NEW_WIDGET,
  name: 'My New Widget',
  icon: FaYourIcon,  // Import from react-icons/fa6
  component: LazyWidgets.MyNewWidget,
  defaultSize: { width: 350, height: 350 },
  minSize: { width: 200, height: 200 },  // Optional
  maxSize: { width: 500, height: 500 },  // Optional
  maintainAspectRatio: false,  // Optional
  category: WidgetCategory.TEACHING_TOOLS  // or INTERACTIVE, FUN, NETWORKED
});
```

### 3. Create Widget Component

Create your widget component in `/src/features/widgets/myNewWidget/myNewWidget.tsx`:

```typescript
import React from 'react';

interface MyNewWidgetProps {
  widgetId?: string;
  savedState?: any;
  onStateChange?: (state: any) => void;
}

const MyNewWidget: React.FC<MyNewWidgetProps> = ({ 
  widgetId, 
  savedState, 
  onStateChange 
}) => {
  // Your widget implementation
  return (
    <div className="bg-soft-white rounded-lg shadow-sm p-4 h-full">
      <h2>My New Widget</h2>
      {/* Widget content */}
    </div>
  );
};

export default MyNewWidget;
```

### 4. Add Widget to Toolbar (Optional)

To make your widget appear in the default toolbar, add it to the `defaultToolbar.visibleWidgets` array in `/src/store/workspaceStore.simple.ts`:

```typescript
const defaultToolbar = {
  visibleWidgets: [
    // ... existing widgets ...
    WidgetType.MY_NEW_WIDGET
  ],
  // ...
};
```

If you don't add it here, users can still access it through the "MORE" button.

### 5. Test Your Widget

Start the development server and test your widget:

```bash
npm start
```

Your widget should appear in the toolbar or in the "MORE" widgets modal.

## Adding a Networked Widget

For widgets that require real-time communication with students:

### 1. Define as Networked in Registry

```typescript
[WIDGET_TYPES.MY_NETWORKED_WIDGET]: {
  // ... basic configuration ...
  category: WidgetCategory.NETWORKED,
  networked: {
    roomType: 'myWidget' as RoomType,  // Must be unique
    hasStartStop: true,                 // Can be paused/resumed
    startsActive: false,                // Initial state
    studentComponentName: 'MyWidgetActivity'  // Student app component
  }
}
```

### 2. Create Widget Component Using Shared Infrastructure

Networked widgets use shared components to reduce code duplication. Create your widget in `/src/features/widgets/myWidget/myWidget.tsx`:

```typescript
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FaYourIcon } from 'react-icons/fa6';
import { useNetworkedWidget } from '../../session/hooks/useNetworkedWidget';
import { useNetworkedWidgetState } from '../../session/hooks/useNetworkedWidgetState';
import { NetworkedWidgetEmpty } from '../shared/NetworkedWidgetEmpty';
import { widgetWrapper, widgetContainer } from '../../../shared/utils/styles';
import { NetworkedWidgetControlBar, NetworkedWidgetOverlays, NetworkedWidgetStats } from '../shared/components';
import { useSocketEvents } from '../../session/hooks/useSocketEvents';
import { withWidgetProvider, WidgetProps } from '../shared/withWidgetProvider';
import { getEmptyStateButtonText, getEmptyStateDisabled } from '../shared/utils/networkedWidgetHelpers';

function MyWidget({ widgetId, savedState, onStateChange }: WidgetProps) {
  // Your widget-specific state
  const [data, setData] = useState(savedState?.data || initialData);

  // Networked widget hook - manages room lifecycle
  const {
    hasRoom,
    isStarting,
    error,
    handleStart,
    session,
    recoveryData
  } = useNetworkedWidget({
    widgetId,
    roomType: 'myWidget',
    savedState,
    onStateChange
  });

  // Active state management - handles pause/resume with socket sync
  const { isActive: isWidgetActive, toggleActive } = useNetworkedWidgetState({
    widgetId,
    roomType: 'myWidget',
    hasRoom,
    recoveryData
  });

  // Widget-specific socket events (state change handled by useNetworkedWidgetState)
  const socketEvents = useMemo(() => ({
    'myWidget:dataUpdate': (eventData: any) => {
      if (eventData.widgetId === widgetId) {
        setData(eventData.data);
      }
    }
  }), [widgetId]);

  const { emit } = useSocketEvents({
    events: socketEvents,
    isActive: hasRoom
  });

  // Handle toggle with any widget-specific logic
  const handleToggleActive = useCallback(() => {
    if (!hasRoom) return;
    toggleActive();
  }, [hasRoom, toggleActive]);

  // Recovery data restoration for widget-specific data
  useEffect(() => {
    if (recoveryData?.roomData?.data) {
      setData(recoveryData.roomData.data);
    }
  }, [recoveryData]);

  // Empty state - before room is created
  if (!hasRoom) {
    return (
      <NetworkedWidgetEmpty
        icon={FaYourIcon}
        title="My Widget"
        description="Description of what this widget does"
        buttonText={getEmptyStateButtonText({
          isStarting,
          isRecovering: session.isRecovering,
          isConnected: session.isConnected,
          defaultText: "Start My Widget"
        })}
        onStart={handleStart}
        disabled={getEmptyStateDisabled({
          isStarting,
          isRecovering: session.isRecovering,
          isConnected: session.isConnected
        })}
        error={error || undefined}
      />
    );
  }

  // Active state - room exists
  return (
    <div className={widgetWrapper}>
      <div className={`${widgetContainer} relative`}>
        {/* Statistics display */}
        <NetworkedWidgetStats>
          {data.count} item{data.count !== 1 ? 's' : ''}
        </NetworkedWidgetStats>

        {/* Overlays for paused/reconnecting/disconnected states */}
        <NetworkedWidgetOverlays
          isActive={isWidgetActive}
          isConnected={session.isConnected}
          isRecovering={session.isRecovering}
          pausedMessage="Widget is paused"
        />

        {/* Your widget content */}
        <div className="flex-1 p-4 pt-8">
          {/* Main content here */}
        </div>
      </div>

      {/* Control bar with play/pause and clear buttons */}
      <NetworkedWidgetControlBar
        isActive={isWidgetActive}
        isConnected={session.isConnected}
        onToggleActive={handleToggleActive}
        onClear={handleClear}
        clearCount={data.count}
        clearLabel="Clear all"
        activeLabel="Pause widget"
        inactiveLabel="Start widget"
        showSettings={false}
        clearVariant="clear"
      />
    </div>
  );
}

// Export with WidgetProvider wrapper
export default withWidgetProvider(MyWidget, 'MyWidget');
```

### Shared Components Reference

| Component | Purpose |
|-----------|---------|
| `useNetworkedWidget` | Room lifecycle, recovery, session management |
| `useNetworkedWidgetState` | Active state with socket sync and recovery |
| `useSocketEvents` | Socket event listener management with cleanup |
| `NetworkedWidgetEmpty` | Empty state UI before room exists |
| `NetworkedWidgetControlBar` | Play/pause, settings, clear buttons |
| `NetworkedWidgetOverlays` | Paused, reconnecting, disconnected overlays |
| `NetworkedWidgetStats` | Floating stats display (top-right) |
| `withWidgetProvider` | HOC to wrap with WidgetProvider |
| `getEmptyStateButtonText` | Button text based on connection state |
| `getEmptyStateDisabled` | Button disabled state logic |

### 3. Create Student Component

Create `/server/src/student/components/MyWidgetActivity.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';

interface MyWidgetActivityProps {
  socket: Socket;
  sessionCode: string;
  widgetId?: string;
  initialIsActive?: boolean;
}

const MyWidgetActivity: React.FC<MyWidgetActivityProps> = ({
  socket,
  sessionCode,
  widgetId,
  initialIsActive
}) => {
  // Students are automatically part of all session rooms
  // No need to explicitly join/leave individual widget rooms

  // Your student interface
  return (
    <div>
      {/* Student activity UI */}
    </div>
  );
};

export default MyWidgetActivity;
```

### 4. Add Server Event Handlers

Add event handlers in `/server/src/index.js` for your widget-specific events:

```javascript
// Handle widget-specific events
socket.on('session:myWidget:action', (data) => {
  const { sessionCode, widgetId, ...actionData } = data;
  // Handle the action
});
```

### 5. Update Student App

Add your activity component to the student app in `/server/src/student/App.tsx`:

```typescript
import MyWidgetActivity from './components/MyWidgetActivity';

// In the render section where activities are shown:
{room.type === 'myWidget' && (
  <MyWidgetActivity
    socket={room.socket}
    sessionCode={room.code}
    widgetId={room.widgetId}
    initialIsActive={room.initialData?.isActive}
  />
)}
```

## Benefits of Using the Registry

1. **Single Source of Truth**: All widget configurations in one place (`/src/services/WidgetRegistry.ts`)
2. **Automatic Integration**: Widget registration, lazy loading, and configuration are handled automatically
3. **Type Safety**: TypeScript ensures all required properties are defined
4. **Centralized Size Management**: Widget sizes defined in the `SIZES` constant for consistency
5. **Category Organization**: Widgets organized by category (Teaching Tools, Interactive, Fun, Networked)

## Common Pitfalls to Avoid

1. **Forgetting to add to WidgetType enum**: Always start by adding the enum value
2. **Mismatched component paths**: Ensure the lazy import path matches your folder structure
3. **Missing student components**: For networked widgets, don't forget the student side
4. **Incorrect room types**: Each networked widget needs a unique `roomType`
5. **Size constraints**: For non-resizable widgets, set minSize and maxSize to the same as defaultSize

## Testing Your Widget

1. Add the widget to the canvas
2. Test all interactions
3. For networked widgets:
   - Test with multiple student connections
   - Test start/stop functionality
   - Test widget deletion (should remove student panels)
   - Test session persistence

By following this guide and using the widget registry system, you ensure that your new widget is fully integrated into the application with all necessary features and cleanup handled automatically.