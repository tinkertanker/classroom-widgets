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

**Vote Reset**

*   `Teacher → Server`: `session:poll:reset` with `{ sessionCode, widgetId }`
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