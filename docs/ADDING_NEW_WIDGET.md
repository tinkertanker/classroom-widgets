# Adding a New Widget

This guide explains how to add a new widget to the classroom widgets application using the canonical widget registry system.

## Overview

All widgets are defined in a single source of truth: `/src/constants/widgetRegistry.ts`. This ensures that when you add a new widget, all necessary configurations and integrations are handled automatically.

## Steps to Add a New Widget

### 1. Add Widget Type Constant

First, add your widget to the `WIDGET_TYPES` enum in `/src/constants/widgetTypes.ts`:

```typescript
export const WIDGET_TYPES = {
  // ... existing widgets ...
  MY_NEW_WIDGET: 18  // Use the next available number
};
```

### 2. Add Widget Definition to Registry

Add your widget definition to `WIDGET_REGISTRY` in `/src/constants/widgetRegistry.ts`:

```typescript
[WIDGET_TYPES.MY_NEW_WIDGET]: {
  id: WIDGET_TYPES.MY_NEW_WIDGET,
  name: 'myNewWidget',           // Component folder name
  displayName: 'My New Widget',   // User-facing name
  category: WidgetCategory.STANDALONE,  // or NETWORKED
  componentPath: 'myNewWidget',   // Folder path under /src/components/
  description: 'Description of what the widget does',
  features: {
    hasSettings: true,
    hasStateManagement: true,
    isResizable: true
  },
  layout: {
    defaultWidth: 350,
    defaultHeight: 350,
    minWidth: 200,
    minHeight: 200,
    lockAspectRatio: false
  }
}
```

### 3. Create Widget Component

Create your widget component in `/src/components/myNewWidget/myNewWidget.tsx`:

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

### 4. Add to Lazy Widgets

Add your widget to `/src/components/Widget/LazyWidgetsRegistry.tsx`:

```typescript
export const LazyWidgets = {
  // ... existing widgets ...
  myNewWidget: lazy(() => import('../myNewWidget/myNewWidget')),
};
```

### 5. Run Validation

In development, run the widget validation to ensure everything is configured correctly:

```javascript
// In browser console:
validateWidgets()
```

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

### 2. Create Student Component

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
  // Join room on mount
  useEffect(() => {
    if (widgetId) {
      socket.emit('session:joinRoom', {
        sessionCode,
        roomType: 'myWidget',
        widgetId
      });

      return () => {
        socket.emit('session:leaveRoom', {
          sessionCode,
          roomType: 'myWidget',
          widgetId
        });
      };
    }
  }, [socket, sessionCode, widgetId]);

  // Your student interface
  return (
    <div>
      {/* Student activity UI */}
    </div>
  );
};

export default MyWidgetActivity;
```

### 3. Add Server Event Handlers

Add event handlers in `/server/src/index.js` for your widget-specific events:

```javascript
// Handle widget-specific events
socket.on('session:myWidget:action', (data) => {
  const { sessionCode, widgetId, ...actionData } = data;
  // Handle the action
});
```

### 4. Update Student App

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

1. **Single Source of Truth**: All widget configurations in one place
2. **Automatic Integration**: Widget cleanup, lifecycle events, and configuration are handled automatically
3. **Type Safety**: TypeScript ensures all required properties are defined
4. **Validation**: Built-in validation tools catch configuration errors early
5. **Consistency**: Ensures all widgets follow the same patterns

## Common Pitfalls to Avoid

1. **Forgetting to add to WIDGET_TYPES**: Always start by adding the constant
2. **Mismatched component paths**: Ensure `componentPath` matches your folder structure
3. **Missing student components**: For networked widgets, don't forget the student side
4. **Incorrect room types**: Each networked widget needs a unique `roomType`

## Testing Your Widget

1. Add the widget to the canvas
2. Test all interactions
3. For networked widgets:
   - Test with multiple student connections
   - Test start/stop functionality
   - Test widget deletion (should remove student panels)
   - Test session persistence

By following this guide and using the widget registry system, you ensure that your new widget is fully integrated into the application with all necessary features and cleanup handled automatically.