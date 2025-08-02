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

*   `Student → Server`: `[widgetType]:requestState` with `{ code, widgetId }` (note: uses 'code' not 'sessionCode')
*   `Server → Student`: Widget-specific response (varies by widget type)

## Widget-Specific Events

### Poll Widget

**Configuration**

*   `Teacher → Server`: `session:poll:update` with `{ sessionCode, widgetId, pollData }`
*   `Server → All`: `poll:dataUpdate` with `{ pollData, results, widgetId }`
    - `pollData`: Contains question, options, and isActive state (votes excluded)
    - `results`: Contains votes object, totalVotes, and participantCount
    - `widgetId`: Widget instance identifier

**Student Interaction**

*   `Student → Server`: `session:poll:vote` with `{ sessionCode, widgetId, optionIndex }`
*   `Server → Student`: `session:poll:voteConfirmed` with `{ success, widgetId, error? }`
*   `Server → All`: `poll:voteUpdate` with `{ votes, totalVotes, widgetId }`

**State Synchronization**

*   `Student → Server`: `poll:requestState` with `{ code, widgetId }`
*   `Server → Student`: `poll:dataUpdate` with `{ pollData, results, widgetId }`

**Widget Reset (Generic)**

*   `Teacher → Server`: `session:reset` with `{ sessionCode, widgetId }`
*   `Server → All`: Widget-specific update event (e.g., `poll:voteUpdate` for polls)
    - Server determines room type from widgetId
    - Calls room's reset() method if available
    - Emits appropriate update event

For Poll widgets specifically:
*   `Server → All`: `poll:voteUpdate` with `{ votes: {}, totalVotes: 0, widgetId }`
    - Students detect totalVotes=0 and clear their selection

Note: Legacy endpoints `poll:vote` and `vote:confirmed` are also supported for backward compatibility.

### Link Share Widget

**Submissions**

*   `Student → Server`: `session:linkShare:submit` with `{ sessionCode, widgetId, studentName, link }`
*   `Server → Student`: `session:linkShare:submitted` with `{ success, error? }`
*   `Server → Teacher`: `linkShare:newSubmission` with `{ id, studentName, link, timestamp, widgetId }`
*   `Teacher → Server`: `session:linkShare:delete` with `{ sessionCode, widgetId, submissionId }`
*   `Server → All`: `linkShare:submissionDeleted` with `{ submissionId, widgetId }`

### Real-Time Feedback Widget

**Submissions**

*   `Student → Server`: `session:rtfeedback:submit` with `{ sessionCode, widgetId, value }`
*   `Server → Student`: `session:rtfeedback:submitted` with `{ success, error? }`
*   `Server → All`: `rtfeedback:update` with `{ understanding, totalResponses, widgetId }`

**Reset**

*   `Teacher → Server`: `session:rtfeedback:reset` with `{ sessionCode, widgetId }`
*   `Server → All`: `rtfeedback:update` with `{ understanding, totalResponses, widgetId }`

### Questions Widget

**Submissions**

*   `Student → Server`: `session:questions:submit` with `{ sessionCode, widgetId, question, studentName }`
*   `Server → Student`: `session:questions:submitted` with `{ success, error? }`
*   `Server → Teacher`: `questions:newQuestion` with `{ id, studentName, question, timestamp, isAnswered, widgetId }`

**Management**

*   `Teacher → Server`: `session:questions:markAnswered` with `{ sessionCode, widgetId, questionId }`
*   `Server → All`: `questions:questionAnswered` with `{ questionId, widgetId }`
*   `Teacher → Server`: `session:questions:delete` with `{ sessionCode, widgetId, questionId }`
*   `Server → All`: `questions:questionDeleted` with `{ questionId, widgetId }`
*   `Teacher → Server`: `session:questions:clearAll` with `{ sessionCode, widgetId }`
*   `Server → All`: `questions:allCleared` with `{ widgetId }`

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

## Networked Widget Architecture (Poll Widget Example)

The Poll widget serves as an exemplar of the networked widget architecture, demonstrating best practices for real-time classroom widgets.

### Component Structure

```typescript
// Poll.tsx - Main widget component
function Poll({ widgetId, savedState, onStateChange }: PollProps) {
  // 1. Local State Management
  const [pollData, setPollData] = useState<PollData>(...);
  const [results, setResults] = useState<PollResults>(...);
  const [isWidgetActive, setIsWidgetActive] = useState(false);
  
  // 2. Networked Widget Hook - Manages room lifecycle
  const {
    hasRoom,        // Whether a room exists on the server
    isStarting,     // Loading state during room creation
    error,          // Error messages
    handleStart,    // Create room function
    handleStop,     // Close room function
    session         // Session data (socket, sessionCode, etc.)
  } = useNetworkedWidget({
    widgetId,
    roomType: 'poll',
    savedState,
    onStateChange
  });
  
  // 3. Socket Event Handlers - Define events to listen for
  const socketEvents = useMemo(() => ({
    'poll:dataUpdate': (data) => { /* Update poll data */ },
    'poll:voteUpdate': (data) => { /* Update vote results */ },
    'session:widgetStateChanged': (data) => { /* Update active state */ }
  }), [widgetId]);
  
  // 4. Socket Management Hooks
  const { emit } = useSocketEvents({
    socket: session.socket,
    events: socketEvents,
    isActive: hasRoom
  });
  
  const { toggleActive, reset } = useActiveState({
    socket: session.socket,
    sessionCode: session.sessionCode,
    roomType: 'poll',
    widgetId,
    isActive: hasRoom,
    isRoomActive: hasRoom
  });
}
```

### Key Architecture Principles

#### 1. State Separation
- **`hasRoom`**: Tracks whether a room exists on the server (room created/deleted)
- **`isWidgetActive`**: Tracks whether the widget is actively accepting input (play/pause state)
- These are separate concerns - a room can exist but be paused

#### 2. Hook-Based Architecture
The Poll widget uses three main hooks for socket functionality:

**`useNetworkedWidget`**: High-level room management
- Creates/destroys rooms
- Manages session connection
- Handles participant tracking
- Provides session data (socket, sessionCode)

**`useSocketEvents`**: Event listener management
- Automatically registers/unregisters socket listeners
- Handles cleanup on unmount
- Provides `emit` function for sending events
- Events are always registered when socket exists (not dependent on active state)

**`useActiveState`**: Widget state toggling and reset
- Manages play/pause functionality
- Emits `session:updateWidgetState` events
- Provides generic `reset()` function that emits `session:reset`
- Ensures consistent state management across widgets

#### 3. Event Flow

**Room Creation**:
1. User clicks "Start Poll" → `handleStart()` called
2. `useNetworkedWidget` emits `session:createRoom`
3. Server creates room (starts paused by default)
4. Server emits `session:widgetStateChanged` with `isActive: false`
5. Widget receives event and updates `isWidgetActive` state

**State Toggle (Play/Pause)**:
1. User clicks play/pause → `handleToggleActive()` called
2. `toggleActive(newState)` emits `session:updateWidgetState`
3. Server updates room state and broadcasts to all clients
4. All widgets receive `session:widgetStateChanged` and update UI

**Data Updates**:
1. Widget calls `emit('session:poll:update', data)`
2. Server processes update and broadcasts to room
3. All clients receive `poll:dataUpdate` event
4. Widgets update their local state

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

1. **Always separate room existence from active state**
   - Use `hasRoom` for room lifecycle
   - Use `isWidgetActive` for play/pause state

2. **Use the provided hooks instead of direct socket access**
   - Ensures consistent event handling
   - Automatic cleanup and error handling
   - Follows DRY principles

3. **Handle edge cases**
   - Late-joining students (state request pattern)
   - Disconnection/reconnection
   - Widget deletion cleanup

4. **Consistent UI/UX**
   - Use `NetworkedWidgetEmpty` for empty state
   - Use `NetworkedWidgetHeader` for active state
   - Follow color scheme conventions (sage for play, dusty-rose for pause)

5. **Event naming conventions**
   - Teacher → Server: `session:[widgetType]:[action]`
   - Server → Clients: `[widgetType]:[update]`
   - Always include `widgetId` in events for multi-instance support