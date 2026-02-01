# Socket.IO Events Protocol

This document defines the Socket.IO event protocol for the classroom widgets application, providing a unified approach for real-time communication between the teacher app, server, and student app.

## Core Architecture Principles

1.  **Session-Based**: All widgets operate within a session context.
2.  **Consistent Event Naming**: All events follow predictable, hierarchical patterns.
3.  **Unified State Management**: Common patterns for active/inactive states are used across all widgets.
4.  **Standardized Participant Tracking**: Participant management is consistent across all widgets.

## Event Naming Convention

Events follow a `namespace:action` structure, for example `session:create` or `poll:vote`.

-   **`namespace`**: The top-level category, such as `session`, `poll`, `linkShare`, `rtfeedback`, or `questions`.
-   **`action`**: The operation being performed, such as `create`, `join`, `update`, or `submit`.

## Core Event Flows

### Session Management

**Teacher Creates Session**

*   `Teacher → Server`: `session:create`
*   `Server → Teacher`: `session:created` with `{ success, code, isExisting?, activeRooms? }`

**Student Joins Session**

*   `Student → Server`: `session:join` with `{ code, name, studentId }`
*   `Server → Student`: `session:joined` with `{ success, activeRooms, participantId, error? }`
*   `Server → Teacher`: `session:participantUpdate` with `{ count, participants }`

**Student Leaves Session (Automatic)**

*   On disconnect (e.g., page close), the server automatically detects the departure and sends:
    *   `Server → Teacher`: `session:participantUpdate` with `{ count, participants }`

### Widget (Room) Management

**Teacher Creates a Widget**

*   `Teacher → Server`: `session:createRoom` with `{ sessionCode, roomType, widgetId }`
*   `Server → Teacher`: (callback) with `{ success, isExisting?, error? }`
*   `Server → Students`: `session:roomCreated` with `{ roomType, widgetId, roomData }`

**Teacher Closes/Deletes a Widget**

*   `Teacher → Server`: `session:closeRoom` with `{ sessionCode, roomType, widgetId }`
*   `Server → Students`: `session:roomClosed` with `{ roomType, widgetId }`

This happens when:
- Teacher deletes a widget (by dragging to trash or clicking delete button)
- Teacher explicitly closes a room (if the widget provides this functionality)

The flow ensures that when a widget is removed on the teacher's side, all connected students are notified and the widget is properly cleaned up from their active rooms list.

### Widget State Management

**Teacher Updates Widget State (e.g., starts or stops an activity)**

*   `Teacher → Server`: `session:updateWidgetState` with `{ sessionCode, roomType, widgetId, isActive }`
*   `Server → All`: `session:widgetStateChanged` with `{ roomType, widgetId, isActive }`

## State Request Pattern

All widgets support a state request pattern for synchronizing late-joining students:

*   `Student → Server`: `[widgetType]:requestState` with `{ sessionCode, widgetId }`
*   `Server → Student`: Widget-specific response (varies by widget type)

**Note**: All events now use `sessionCode` (not `code`) for consistency.

## Input Validation

All socket events are validated server-side. Invalid input returns an error response.

### Validators (`server/src/utils/validation.js`)

| Field | Validation |
|-------|------------|
| `sessionCode` | 4-6 alphanumeric characters (case-insensitive) |
| `widgetId` | Non-empty string, max 100 characters |
| `link` | Valid URL format |
| `question` | 1-500 characters |
| `feedbackValue` | Integer 1-5 |
| `studentName` | 1-50 characters |
| `pollOption` | Integer 0 to (options.length - 1) |

### Error Response Format

All errors follow a standardized format:

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;      // e.g., 'INVALID_SESSION', 'RATE_LIMITED'
    message: string;   // Human-readable message
  };
}
```

### Error Codes (`server/src/utils/errors.js`)

| Code | Description |
|------|-------------|
| `INVALID_SESSION` | Session not found or expired |
| `NOT_HOST` | Only the host can perform this action |
| `NOT_PARTICIPANT` | Must be a session participant |
| `ROOM_NOT_FOUND` | Widget room not found |
| `WIDGET_PAUSED` | Widget is currently paused |
| `RATE_LIMITED` | Too many requests |
| `INVALID_INPUT` | Invalid input provided |
| `SESSION_FULL` | Session at maximum capacity |

## Rate Limiting

Per-event rate limits prevent abuse. When rate limited, the response includes `retryAfter` (milliseconds).

| Event | Limit |
|-------|-------|
| `session:poll:vote` | 2 requests per 1 second |
| `session:linkShare:submit` | 3 requests per 5 seconds |
| `session:rtfeedback:submit` | 5 requests per 500ms |
| `session:questions:submit` | 2 requests per 3 seconds |

Rate limit response:
```typescript
{
  success: false,
  error: {
    code: 'RATE_LIMITED',
    message: 'Too many requests. Please wait before trying again.',
    retryAfter: 1500  // milliseconds
  }
}

## Widget-Specific Events

**Important Note on Widget IDs**: All widget-specific events include a `widgetId` field to support multiple instances of the same widget type within a session. The teacher app filters events by checking `data.widgetId === widgetId` to ensure each widget instance only processes its own events.

### Poll Widget

**Configuration**

*   `Teacher → Server`: `session:poll:update` with `{ sessionCode, widgetId, pollData }`
*   `Server → All`: `poll:stateUpdate` with `{ pollData, results, widgetId }`
    - `pollData`: Contains question, options, and isActive state (votes excluded)
    - `results`: Contains votes object, totalVotes, and participantCount
    - `widgetId`: Widget instance identifier

**Student Interaction**

*   `Student → Server`: `session:poll:vote` with `{ sessionCode, widgetId, optionIndex }`
*   `Server → Student`: `session:poll:voteConfirmed` with `{ success, widgetId, error? }`
*   `Server → All`: `poll:voteUpdate` with `{ votes, totalVotes, widgetId }`

**State Synchronization**

*   `Student → Server`: `poll:requestState` with `{ sessionCode, widgetId }`
*   `Server → Student`: `poll:stateUpdate` with `{ pollData, results, widgetId }`

**Widget Reset (Generic)**

*   `Teacher → Server`: `session:reset` with `{ sessionCode, widgetId }`
*   `Server → All`: Widget-specific update event (e.g., `poll:voteUpdate` for polls)
    - Server determines room type from widgetId
    - Calls room's reset() method if available
    - Emits appropriate update event

For Poll widgets specifically:
*   `Server → All`: `poll:voteUpdate` with `{ votes: {}, totalVotes: 0, widgetId }`
    - Students detect totalVotes=0 and clear their selection

### Link Share Widget

**Submissions**

*   `Student → Server`: `session:linkShare:submit` with `{ sessionCode, widgetId, studentName, link }`
*   `Server → Student`: `session:linkShare:submitted` with `{ success, error? }`
*   `Server → All`: `linkShare:submissionAdded` with `{ id, studentName, link, timestamp, widgetId }`
*   `Teacher → Server`: `session:linkShare:delete` with `{ sessionCode, widgetId, submissionId }`
*   `Server → All`: `linkShare:submissionDeleted` with `{ submissionId, widgetId }`

**State Synchronization**

*   `Student → Server`: `linkShare:requestState` with `{ sessionCode, widgetId }`
*   `Server → Student`: `linkShare:stateUpdate` with `{ isActive, widgetId }`

### Real-Time Feedback Widget

**Submissions**

*   `Student → Server`: `session:rtfeedback:submit` with `{ sessionCode, widgetId, value }`
*   `Server → Student`: `session:rtfeedback:submitted` with `{ success, error? }`
*   `Server → All`: `rtfeedback:dataUpdate` with `{ understanding, totalResponses, widgetId }`

**Reset**

*   `Teacher → Server`: `session:rtfeedback:reset` with `{ sessionCode, widgetId }`
*   `Server → All`: `rtfeedback:dataUpdate` with `{ understanding, totalResponses, widgetId }`

### Questions Widget

**Submissions**

*   `Student → Server`: `session:questions:submit` with `{ sessionCode, widgetId, question, studentName }`
*   `Server → Student`: `session:questions:submitted` with `{ success, error? }`
*   `Server → All`: `questions:questionAdded` with `{ id, studentName, text, timestamp, answered, widgetId }`
    - Note: Student sends `question` field, but server broadcasts as `text` field

**Management**

*   `Teacher → Server`: `session:questions:markAnswered` with `{ sessionCode, widgetId, questionId }`
*   `Server → All`: `questions:questionAnswered` with `{ questionId, widgetId }`
*   `Teacher → Server`: `session:questions:delete` with `{ sessionCode, widgetId, questionId }`
*   `Server → All`: `questions:questionDeleted` with `{ questionId, widgetId }`
*   `Teacher → Server`: `session:questions:clearAll` with `{ sessionCode, widgetId }`
*   `Server → All`: `questions:allCleared` with `{ widgetId }`

## Admin Events (Read-Only)

The admin interface is accessed via the student app by entering "ADMIN" as the session code.

**Note**: Admin access is protected only by knowledge of the "ADMIN" code. All admin operations are read-only by design.

### Get Sessions Data

*   `Admin → Server`: `admin:getSessions` with `{}`
*   `Server → Admin`: (callback) with:
```typescript
{
  success: true,
  sessions: SessionInfo[],
  stats: {
    activeSessions: number,
    totalParticipants: number,
    totalRooms: number
  }
}
```

Where `SessionInfo` includes:
- `code`: Session code
- `createdAt`: Timestamp
- `lastActivity`: Timestamp
- `hasHost`: Boolean
- `participantCount`: Number
- `participants`: Array of `{ name, joinedAt }`
- `activeRooms`: Array of room summaries with widget-specific data

### Subscribe to Updates

*   `Admin → Server`: `admin:subscribe`
*   `Admin → Server`: `admin:unsubscribe`

Subscribing joins the `admin:updates` room for potential future real-time updates.

## Data Structures

**Session**

```typescript
interface Session {
  code: string;              // 5-character unique code
  hostSocketId: string;      // Teacher's socket ID
  participants: Map<string, Participant>;
  activeRooms: Map<string, Room>;
  createdAt: number;
  lastActivity: number;
}
```

**Room (Widget Instance)**

```typescript
interface Room {
  type: 'poll' | 'linkShare' | 'rtfeedback' | 'questions';
  widgetId: string;          // Unique widget instance ID
  hostSocketId: string;      // Teacher's socket ID
  participants: Map<string, RoomParticipant>;
  isActive: boolean;         // Whether the widget is accepting input
  createdAt: number;
}
```

## UI/UX Standards

### Teacher App Interface

*   **Widget Headers**: Use icons instead of text titles, display the session code in a pill, and place control buttons (settings, play/pause) in a consistent location.
*   **Session Banner**: A compact, single-line display with the student URL and session code, with copy buttons for both.
*   **Widget Controls**: Use a consistent color scheme for play, pause, and settings buttons.

### Student App Interface

*   **Session Header**: A unified connection indicator with the session code and a colored dot to show connection status.
*   **Activity Cards**: No individual connection indicators; clear instructions and empty states when an activity is paused.
*   **Visual Consistency**: Matching color schemes, typography, and dark mode support between the teacher and student apps.

## Networked Widget Architecture (Unified Session)

The application uses a unified session architecture for all networked widgets, providing consistent session management and room lifecycle handling.

### Core Architecture Components

#### 1. UnifiedSessionProvider
Manages the global session state and socket connection for all widgets:

```typescript
// Wraps the entire app in App.tsx
<UnifiedSessionProvider>
  <App />
</UnifiedSessionProvider>
```

Key responsibilities:
- Single session for all widgets (one activity code)
- Socket connection management
- Session recovery after page refresh
- Room lifecycle (create, close, state updates)
- Participant tracking

#### 2. useNetworkedWidgetUnified Hook
Used by individual widgets to interact with the session:

```typescript
const {
  hasRoom,        // Whether this widget has an active room
  isStarting,     // Loading state during room creation
  error,          // Error messages
  handleStart,    // Create room for this widget
  handleStop,     // Close room for this widget
  session: {
    socket,           // Socket.io instance
    sessionCode,      // Current session code
    participantCount, // Number of participants
    isConnected,      // Socket connection state
    isRecovering      // Session recovery in progress
  }
} = useNetworkedWidgetUnified({
  widgetId,       // Unique widget instance ID
  roomType,       // 'poll' | 'linkShare' | 'rtfeedback' | 'questions'
  savedState,     // Restored widget state
  onStateChange   // State change callback
});
```

#### 3. useUnifiedSocketEvents Hook
Manages socket event listeners with automatic cleanup:

```typescript
const { emit, emitWithAck } = useUnifiedSocketEvents({
  events: {
    'poll:stateUpdate': (data) => { /* Handle update */ },
    'poll:voteUpdate': (data) => { /* Handle votes */ },
    'session:widgetStateChanged': (data) => { /* Handle state */ }
  },
  isActive: hasRoom  // Enable/disable listeners
});
```

### Component Structure (Poll Widget Example)

```typescript
function Poll({ widgetId, savedState, onStateChange }: PollProps) {
  // 1. Local State
  const [pollData, setPollData] = useState<PollData>(...);
  const [results, setResults] = useState<PollResults>(...);
  const [isWidgetActive, setIsWidgetActive] = useState(false);
  
  // 2. Unified Session Hook
  const {
    hasRoom,
    isStarting,
    error,
    handleStart,
    handleStop,
    session,
    recoveryData
  } = useNetworkedWidgetUnified({
    widgetId,
    roomType: 'poll',
    savedState,
    onStateChange
  });
  
  // 3. Get unified session for additional methods
  const unifiedSession = useUnifiedSession();
  
  // 4. Socket Event Handlers
  const socketEvents = useMemo(() => ({
    'poll:stateUpdate': (data) => { /* Update poll data */ },
    'poll:voteUpdate': (data) => { /* Update vote results */ },
    'session:widgetStateChanged': (data) => { /* Update active state */ }
  }), [widgetId]);
  
  // 5. Socket Events Hook
  const { emit } = useUnifiedSocketEvents({
    events: socketEvents,
    isActive: hasRoom
  });
  
  // 6. Widget State Management
  const toggleActive = useCallback((newState: boolean) => {
    if (!widgetId || !hasRoom) return;
    unifiedSession.updateRoomState('poll', widgetId, newState);
  }, [widgetId, hasRoom, unifiedSession]);
}
```

### Key Architecture Principles

#### 1. Unified Session Management
- **Single Session**: One activity code for all widgets (no per-widget codes)
- **Centralized State**: Session state managed in UnifiedSessionContext
- **Automatic Recovery**: Session recovers after page refresh if still valid
- **Room Lifecycle**: Each widget has its own room within the session

#### 2. State Separation
- **`hasRoom`**: Whether this specific widget has a room on the server
- **`isWidgetActive`**: Whether the widget is accepting input (play/pause)
- **Session State**: Global session connection and code
- **Recovery Data**: Snapshot of room state during recovery

#### 3. Hook-Based Architecture

**`useUnifiedSession`** (Context): Global session management
- Session creation and recovery
- Room creation and deletion
- Socket connection state
- Participant tracking across all widgets

**`useNetworkedWidgetUnified`**: Widget-specific room management
- Interfaces with UnifiedSession
- Manages widget's room lifecycle
- Handles cleanup on unmount
- Provides session data to widget

**`useUnifiedSocketEvents`**: Event listener management
- Automatic registration/cleanup
- Type-safe event handling
- Support for acknowledgments
- Batched event emission

#### 4. Event Flow

**Session Creation** (happens once for all widgets):
1. First widget calls `handleStart()` 
2. `UnifiedSession` creates session if none exists
3. Server returns session code
4. All widgets can now use this session

**Room Creation** (per widget):
1. Widget calls `handleStart()` → `useNetworkedWidgetUnified`
2. Calls `unifiedSession.createRoom(roomType, widgetId)`
3. Server creates room within the session
4. Widget receives confirmation and shows active UI

**State Toggle** (Play/Pause):
1. User clicks play/pause → `toggleActive()` called
2. Calls `unifiedSession.updateRoomState(roomType, widgetId, isActive)`
3. Server broadcasts `session:widgetStateChanged` to all
4. All clients update their UI state

**Widget Cleanup**:
1. Widget unmounts (deleted or page navigation)
2. `useNetworkedWidgetUnified` cleanup runs with setTimeout
3. Checks if truly unmounting (not just re-rendering)
4. Calls `unifiedSession.closeRoom()` if needed
5. Server notifies all participants

**Session Recovery** (after page refresh):
1. `UnifiedSession` checks for saved session code
2. Validates session age (< 2 hours)
3. Rejoins session and retrieves active rooms
4. Widgets check `recoveryData` for their state
5. Widgets restore their UI and connections

#### 4. UI Patterns

**Empty State**: When no session exists
```jsx
<NetworkedWidgetEmpty
  icon={FaChartColumn}
  title="Poll"
  description="Create interactive polls for your students"
  buttonText="Start Poll"
  onStart={handleStart}
  disabled={isStarting || !session.isConnected}
  error={error}
/>
```

**Active State**: When session exists
```jsx
<div className="bg-soft-white rounded-lg shadow-sm border w-full h-full flex flex-col p-4">
  <NetworkedWidgetHeader 
    title="Poll"
    code={session.sessionCode}
    participantCount={session.participantCount}
    icon={FaChartColumn}
  >
    {/* Control buttons in header */}
    <button onClick={handleToggleActive}>
      {isWidgetActive ? <FaPause /> : <FaPlay />}
    </button>
  </NetworkedWidgetHeader>
  
  {/* Main content area */}
  <div className="flex-1">
    {!isWidgetActive && <PausedOverlay />}
    {/* Widget content */}
  </div>
</div>
```

### Best Practices

1. **Use Unified Session Architecture**
   - All widgets share one session code
   - Use `UnifiedSessionProvider` at app level
   - Use `useNetworkedWidgetUnified` in widgets
   - Don't create per-widget sessions

2. **Handle Component Lifecycle Properly**
   - Use setTimeout in cleanup to detect true unmounts
   - Don't close rooms on re-renders
   - Clean up only when widget is deleted

3. **State Management**
   - Keep room existence (`hasRoom`) separate from active state
   - Use `recoveryData` for initial state after refresh
   - Update local state from socket events

4. **Error Handling**
   - Check connection state before operations
   - Display connection errors to users
   - Handle session expiration (2 hour timeout)

5. **Consistent UI/UX**
   - Use `NetworkedWidgetEmpty` for no-room state
   - Use `NetworkedWidgetHeader` for active widgets
   - Show session code prominently
   - Sage green for start, dusty-rose for stop

6. **Event Patterns**
   - Always include `widgetId` in events
   - Use callbacks for operation confirmation
   - Handle state sync for late-joining students

### Migration from Old Architecture

If migrating from the old per-widget session system:

1. Replace `SessionProvider` with `UnifiedSessionProvider`
2. Replace `useNetworkedWidget` with `useNetworkedWidgetUnified`
3. Replace `useSocketEvents` with `useUnifiedSocketEvents`
4. Remove `useActiveState` - use `unifiedSession.updateRoomState()`
5. Update event handlers to use new hooks
6. Test session recovery after page refresh