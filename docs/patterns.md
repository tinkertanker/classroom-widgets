# Codebase Patterns and Techniques

This document highlights some of the most interesting and educational patterns and techniques used in the classroom-widgets codebase.

## Codebase Summary

The project is a monorepo containing three main parts:

1.  **Teacher Frontend:** A React application (`src`) for teachers to control the widgets.
2.  **Node.js Backend:** An Express server (`server`) using Socket.IO for real-time communication.
3.  **Student Frontend:** A separate, lightweight React application (`server/src/student`) for students to interact with the widgets.

The application is built with a modern tech stack, including React, TypeScript, Vite, Tailwind CSS, and Zustand for state management. The core of the application is its real-time architecture, which allows for interactive widgets in a classroom setting.

## Interesting Patterns and Techniques

### 1. Real-time Architecture with Socket.IO

The application uses Socket.IO to facilitate real-time communication between the teacher's frontend, the backend, and the students' frontends.

**Backend:**

The backend uses a `socketManager.js` to handle all incoming socket connections and events. It uses a session-based architecture to manage rooms and participants, which is a robust way to handle multi-user interactions.

```javascript
// server/src/sockets/socketManager.js

const { EVENTS } = require('../config/constants');

// Import individual socket handlers
const sessionHandler = require('./handlers/sessionHandler');
// ... other handlers

function setupSocketHandlers(io, sessionManager) {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);
    
    let currentSessionCode = null;

    socket.on(EVENTS.SESSION.JOIN, (data) => {
      currentSessionCode = data.code;
    });

    // Setup all handlers
    sessionHandler(io, socket, sessionManager, () => currentSessionCode);
    // ... other handlers

    socket.on('disconnect', () => {
      // ... handle disconnection
    });
  });
}
```

**Frontend:**

The frontend uses a custom hook, `useNetworkedWidget`, to abstract away the complexities of real-time networking from the UI components. This hook handles session management, room creation, and communication with the backend.

```typescript
// src/features/session/hooks/useNetworkedWidget.ts

export function useNetworkedWidget({
  widgetId,
  roomType,
  // ... other props
}: UseNetworkedWidgetProps): UseNetworkedWidgetReturn {
  // ... hook logic
  
  const handleStart = useCallback(async () => {
    // ... logic to create a session and a room
  }, [socket, isConnected, sessionCode, roomType, widgetId, setSessionCode]);

  const handleStop = useCallback(() => {
    if (!socket || !sessionCode) return;
    
    socket.emit('session:closeRoom', { 
      sessionCode,
      roomType,
      widgetId 
    });
  }, [socket, sessionCode, roomType, widgetId]);

  // ...
}
```

### 2. Custom Hooks for Cross-Cutting Concerns

The codebase makes extensive use of custom hooks to encapsulate complex logic and keep components clean and reusable.

*   **`useNetworkedWidget`**: As mentioned above, this hook is the cornerstone of the real-time widgets.
*   **`useWidget`**: This hook provides a simple interface for widgets to interact with the global state store. It abstracts away the details of Zustand, making it easy to manage widget-specific state.

    ```typescript
    // src/features/widgets/shared/hooks/useWidget.ts
    
    export function useWidget({ id, initialState }: UseWidgetProps) {
      const {
        getWidget,
        updateWidget,
        removeWidget,
        setWidgetState,
        getWidgetState,
      } = useWorkspaceStore();
    
      // ...
    
      return {
        widget,
        state: internalState,
        updateState,
        remove,
        updateWidgetData,
      };
    }
    ```
*   **`useSessionRecovery`**: This hook is a great example of how to handle session recovery in a real-time application. It demonstrates how to gracefully handle disconnections and reconnections, which is crucial for a good user experience.

### 3. Zustand for State Management

The application uses Zustand for global state management. The `workspaceStore.simple.ts` file defines a simple yet powerful store that can be accessed from any component in the application.

```typescript
// src/store/workspaceStore.simple.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ...

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      widgets: [],
      widgetStates: {},
      // ... other state and actions
    }),
    {
      name: 'workspace-storage',
    }
  )
);
```

### 4. Widget Registry for Extensibility

The `WidgetRegistry.ts` service is a good example of the "registry" pattern. It allows for widgets to be dynamically registered and rendered, which makes the application extensible. This is a powerful technique for building applications with a plug-in architecture.

```typescript
// src/services/WidgetRegistry.ts

import { Widget, WidgetComponent } from '../shared/types/widget.types';

class WidgetRegistry {
  private widgets = new Map<string, WidgetComponent>();

  register(widget: WidgetComponent) {
    if (this.widgets.has(widget.type)) {
      console.warn(`Widget type ${widget.type} is already registered.`);
    }
    this.widgets.set(widget.type, widget);
  }

  getWidget(type: string): WidgetComponent | undefined {
    return this.widgets.get(type);
  }

  getAvailableWidgets(): WidgetComponent[] {
    return Array.from(this.widgets.values());
  }
}

export const widgetRegistry = new WidgetRegistry();
```
