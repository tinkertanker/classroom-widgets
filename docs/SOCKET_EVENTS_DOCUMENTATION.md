# Socket.IO Events Documentation

This document provides a comprehensive overview of all Socket.IO events used in the classroom widgets application for real-time communication between the teacher app, student app, and server.

## Event Naming Convention

The application uses a hierarchical naming convention:
- `session:*` - Session-level events (new architecture)
- `[widget]:*` - Widget-specific events (e.g., `poll:*`, `questions:*`)

## Session Management Events

### `session:create`
**Emitted by:** Teacher (host)  
**Listened by:** Server  
**Payload:** None (uses callback)  
**Response:** `{ code: string, success: boolean }`  
**Purpose:** Creates a new session with a 5-character code that can host multiple widget rooms

### `session:join`
**Emitted by:** Student  
**Listened by:** Server  
**Payload:**
```javascript
{
  code: string,      // 5-character session code
  name: string,      // Student name
  studentId: string  // Socket ID
}
```
**Response:** `session:joined` event  
**Purpose:** Student joins a session

### `session:joined`
**Emitted by:** Server  
**Listened by:** Student  
**Payload:**
```javascript
{
  success: boolean,
  sessionId?: string,
  activeRooms?: Array<{
    roomId: string,
    type: 'poll' | 'linkShare' | 'rtFeedback' | 'questions',
    widgetId: string,
    isActive?: boolean
  }>,
  error?: string
}
```
**Purpose:** Confirms student has joined session and provides list of active rooms

### `session:participantUpdate`
**Emitted by:** Server  
**Listened by:** Teacher  
**Payload:**
```javascript
{
  sessionCode: string,
  participants: number,
  participantList: Array<{ id: string, name: string }>
}
```
**Purpose:** Updates teacher about session participant changes

### `session:createRoom`
**Emitted by:** Teacher  
**Listened by:** Server  
**Payload:**
```javascript
{
  sessionCode: string,
  roomType: 'poll' | 'linkShare' | 'rtFeedback' | 'questions',
  widgetId: string
}
```
**Response:** Callback with `{ success: boolean, roomId?: string, error?: string }`  
**Purpose:** Creates a widget-specific room within a session

### `session:roomCreated`
**Emitted by:** Server  
**Listened by:** Student  
**Payload:**
```javascript
{
  roomId: string,
  type: 'poll' | 'dataShare' | 'rtFeedback' | 'questions',
  widgetId: string
}
```
**Purpose:** Notifies students that a new room has been created in their session

### `session:closeRoom`
**Emitted by:** Teacher  
**Listened by:** Server  
**Payload:**
```javascript
{
  sessionCode: string,
  roomType: 'poll' | 'linkShare' | 'rtFeedback' | 'questions',
  widgetId: string
}
```
**Purpose:** Closes a widget-specific room

### `session:roomClosed`
**Emitted by:** Server  
**Listened by:** Student  
**Payload:**
```javascript
{
  roomId: string,
  widgetId: string
}
```
**Purpose:** Notifies students that a room has been closed

### `session:joinRoom`
**Emitted by:** Teacher, Student  
**Listened by:** Server  
**Payload:**
```javascript
{
  sessionCode: string,
  roomType: 'poll' | 'linkShare' | 'rtFeedback' | 'questions',
  widgetId: string
}
```
**Purpose:** Join a specific widget room within a session

### `session:leaveRoom`
**Emitted by:** Student  
**Listened by:** Server  
**Payload:**
```javascript
{
  sessionCode: string,
  roomType: 'poll' | 'linkShare' | 'rtFeedback' | 'questions',
  widgetId: string
}
```
**Purpose:** Leave a specific widget room

## Room Lifecycle Events

These events manage the lifecycle of widget rooms within sessions. Each networked widget (Poll, Link Share, RT Feedback, Questions) follows this pattern:

### Room Creation
1. **Teacher action**: Creates widget on canvas
2. **Teacher app**: Calls `session.createRoom(roomType, widgetId)`
3. **Event flow**: `session:createRoom` → Server creates room → `session:roomCreated` broadcast

### Room Start/Stop (Widget-specific)
- **Poll**: Controlled by `isActive` in poll data updates
- **Link Share**: Always active once created
- **RT Feedback**: `session:rtfeedback:start` / `session:rtfeedback:stop`
- **Questions**: `session:questions:start` / `session:questions:stop`

### Room Deletion
1. **Teacher action**: Drags widget to trash or removes from canvas
2. **Teacher app**: Dispatches `widget-cleanup` custom event
3. **Widget hook**: Calls `session.closeRoom(roomType, widgetId)`
4. **Event flow**: `session:closeRoom` → Server closes room → `session:roomClosed` broadcast
5. **Student app**: Removes widget panel with exit animation

### State Change Broadcasting
When start/stop events occur, widgets broadcast state changes:
- **Poll**: `poll:stateChanged` with `{ isActive: boolean }`
- **RT Feedback**: `rtfeedback:stateChanged` with `{ isActive: boolean }`
- **Questions**: `questions:stateChanged` with `{ isActive: boolean }`

### Important Implementation Details

1. **Widget Cleanup**: The teacher app must dispatch a `widget-cleanup` custom event when removing networked widgets:
```javascript
window.dispatchEvent(new CustomEvent('widget-cleanup', {
  detail: { widgetId, widgetType, roomCode }
}));
```

2. **Room Identifiers**: Rooms are identified by `${roomType}:${widgetId}` when widgetId exists, allowing multiple instances of the same widget type.

3. **Automatic Behaviors**:
   - RT Feedback and Questions start in active state when room is created
   - Poll starts inactive until teacher configures and activates it
   - Link Share is always active (no start/stop states)

4. **Student Panel Management**: Student app listens for `session:roomClosed` events and removes the corresponding widget panel with a 300ms exit animation.

## Poll Widget Events

### `session:poll:update`
**Emitted by:** Teacher  
**Listened by:** Server  
**Payload:**
```javascript
{
  sessionCode: string,
  widgetId: string,
  pollData: {
    question: string,
    options: string[],
    isActive: boolean
  }
}
```
**Purpose:** Updates poll configuration and state

### `poll:dataUpdate`
**Emitted by:** Server  
**Listened by:** Teacher, Student  
**Payload:**
```javascript
{
  pollData: {
    question: string,
    options: string[],
    isActive: boolean
  },
  results?: {
    votes: number[],
    totalVotes: number
  }
}
```
**Purpose:** Broadcasts poll data updates to all participants

### `poll:stateChanged`
**Emitted by:** Server  
**Listened by:** Teacher, Student  
**Payload:**
```javascript
{
  isActive: boolean
}
```
**Purpose:** Notifies about poll active state changes

### `poll:requestState`
**Emitted by:** Student  
**Listened by:** Server  
**Payload:**
```javascript
{
  code: string,
  widgetId: string
}
```
**Purpose:** Request current poll state when joining or reconnecting

### `session:poll:vote`
**Emitted by:** Student  
**Listened by:** Server  
**Payload:**
```javascript
{
  sessionCode: string,
  widgetId: string,
  optionIndex: number
}
```
**Purpose:** Submit a vote for a poll option

### `vote:confirmed`
**Emitted by:** Server  
**Listened by:** Student  
**Payload:**
```javascript
{
  success: boolean,
  error?: string  // 'Not a participant', 'Already voted', 'Vote failed'
}
```
**Purpose:** Confirms vote submission status

### `poll:voteUpdate`
**Emitted by:** Server  
**Listened by:** Teacher  
**Payload:**
```javascript
{
  results: {
    votes: number[],
    totalVotes: number
  }
}
```
**Purpose:** Updates teacher with latest voting results

### `poll:updated` (Legacy)
**Emitted by:** Server  
**Listened by:** Teacher  
**Purpose:** Legacy event for poll updates

## Link Share Widget Events

### `session:linkShare:submit`
**Emitted by:** Student  
**Listened by:** Server  
**Payload:**
```javascript
{
  sessionCode: string,
  studentName: string,
  link: string,
  widgetId: string
}
```
**Purpose:** Submit a link/text to share

### `session:linkShare:submitted`
**Emitted by:** Server  
**Listened by:** Student  
**Payload:**
```javascript
{
  success: boolean,
  error?: string
}
```
**Purpose:** Confirms submission status

### `linkShare:newSubmission`
**Emitted by:** Server  
**Listened by:** Teacher  
**Payload:**
```javascript
{
  id: string,
  studentName: string,
  link: string,
  timestamp: number
}
```
**Purpose:** Notifies teacher of new submission

### `session:linkShare:delete`
**Emitted by:** Teacher  
**Listened by:** Server  
**Payload:**
```javascript
{
  sessionCode: string,
  widgetId: string,
  submissionId: string
}
```
**Purpose:** Delete a specific submission

### `linkShare:submissionDeleted`
**Emitted by:** Server  
**Listened by:** Teacher  
**Payload:** `string` (submissionId)  
**Purpose:** Confirms submission deletion

## RT Feedback Widget Events

### `session:rtfeedback:start`
**Emitted by:** Teacher  
**Listened by:** Server  
**Payload:**
```javascript
{
  sessionCode: string,
  widgetId: string
}
```
**Purpose:** Start accepting feedback

### `session:rtfeedback:stop`
**Emitted by:** Teacher  
**Listened by:** Server  
**Payload:**
```javascript
{
  sessionCode: string,
  widgetId: string
}
```
**Purpose:** Stop accepting feedback

### `session:rtfeedback:reset`
**Emitted by:** Teacher  
**Listened by:** Server  
**Payload:**
```javascript
{
  sessionCode: string,
  widgetId: string
}
```
**Purpose:** Reset all feedback values

### `rtfeedback:stateChanged`
**Emitted by:** Server  
**Listened by:** Teacher, Student  
**Payload:**
```javascript
{
  isActive: boolean
}
```
**Purpose:** Notifies about feedback collection state changes

### `session:rtfeedback:update`
**Emitted by:** Student  
**Listened by:** Server  
**Payload:**
```javascript
{
  sessionCode: string,
  widgetId: string,
  feedback: number  // 1-5
}
```
**Purpose:** Submit or update feedback value

### `rtfeedback:update`
**Emitted by:** Server  
**Listened by:** Teacher  
**Payload:**
```javascript
{
  average: number,
  distribution: number[],  // Array of 5 counts [1s, 2s, 3s, 4s, 5s]
  participants: number
}
```
**Purpose:** Updates teacher with aggregated feedback data

### `rtfeedback:requestState`
**Emitted by:** Student  
**Listened by:** Server  
**Payload:**
```javascript
{
  code: string,
  widgetId: string
}
```
**Purpose:** Request current feedback state when joining

## Questions Widget Events

### `session:questions:start`
**Emitted by:** Teacher  
**Listened by:** Server  
**Payload:**
```javascript
{
  sessionCode: string,
  widgetId: string
}
```
**Purpose:** Start accepting questions

### `session:questions:stop`
**Emitted by:** Teacher  
**Listened by:** Server  
**Payload:**
```javascript
{
  sessionCode: string,
  widgetId: string
}
```
**Purpose:** Stop accepting questions

### `questions:stateChanged`
**Emitted by:** Server  
**Listened by:** Teacher, Student  
**Payload:**
```javascript
{
  isActive: boolean
}
```
**Purpose:** Notifies about question acceptance state changes

### `session:questions:submit`
**Emitted by:** Student  
**Listened by:** Server  
**Payload:**
```javascript
{
  sessionCode: string,
  widgetId: string,
  question: string,
  studentName: string
}
```
**Purpose:** Submit a question

### `questions:submitted`
**Emitted by:** Server  
**Listened by:** Student  
**Payload:**
```javascript
{
  success: boolean
}
```
**Purpose:** Confirms question submission

### `questions:error`
**Emitted by:** Server  
**Listened by:** Student  
**Payload:**
```javascript
{
  error: string
}
```
**Purpose:** Error message when questions are not being accepted

### `newQuestion`
**Emitted by:** Server  
**Listened by:** Teacher  
**Payload:**
```javascript
{
  id: string,
  studentName: string,
  question: string,
  timestamp: number,
  isAnswered: boolean
}
```
**Purpose:** Notifies teacher of new question (sent to host socket only)

### `session:questions:markAnswered`
**Emitted by:** Teacher  
**Listened by:** Server  
**Payload:**
```javascript
{
  sessionCode: string,
  widgetId: string,
  questionId: string
}
```
**Purpose:** Mark a question as answered

### `questionAnswered`
**Emitted by:** Server  
**Listened by:** Teacher, Student  
**Payload:**
```javascript
{
  questionId: string
}
```
**Purpose:** Notifies that a question has been answered

### `session:questions:delete`
**Emitted by:** Teacher  
**Listened by:** Server  
**Payload:**
```javascript
{
  sessionCode: string,
  widgetId: string,
  questionId: string
}
```
**Purpose:** Delete a specific question

### `questionDeleted`
**Emitted by:** Server  
**Listened by:** Teacher, Student  
**Payload:**
```javascript
{
  questionId: string
}
```
**Purpose:** Notifies that a question has been deleted

### `session:questions:clearAll`
**Emitted by:** Teacher  
**Listened by:** Server  
**Payload:**
```javascript
{
  sessionCode: string,
  widgetId: string
}
```
**Purpose:** Clear all questions

### `allQuestionsCleared`
**Emitted by:** Server  
**Listened by:** Teacher, Student  
**Payload:**
```javascript
{
  widgetId: string
}
```
**Purpose:** Notifies that all questions have been cleared

### `questions:requestState`
**Emitted by:** Student  
**Listened by:** Server  
**Payload:**
```javascript
{
  code: string,
  widgetId: string
}
```
**Purpose:** Request current questions state and list

### `questions:list`
**Emitted by:** Server  
**Listened by:** Student  
**Payload:** `Question[]` (array of question objects)  
**Purpose:** Sends full list of questions to student


## Connection Management Events

### `connect`
**Emitted by:** Socket.IO client  
**Listened by:** Student app  
**Purpose:** Socket connection established

### `connect_error`
**Emitted by:** Socket.IO client  
**Listened by:** Student app  
**Purpose:** Socket connection error

### `disconnect`
**Emitted by:** Socket.IO client  
**Listened by:** Server, Student app  
**Purpose:** Socket disconnection, triggers cleanup

## Event Flow Examples

[CLAUDE, read this]
### Session Context
In the modern architecture, all widgets operate within a session context. A session is created by the teacher and can host multiple widget instances. Students join the session once and can participate in all active widgets within that session.

### Poll Widget Flow
1. Teacher creates session: `session:create` → receives code
2. Teacher creates poll room: `session:createRoom` with roomType='poll' → receives roomId
3. Student joins session: `session:join` → receives `session:joined` with list of active rooms
4. Student automatically sees poll widget, joins room: `session:joinRoom`
5. Teacher updates poll: `session:poll:update` → server broadcasts `poll:dataUpdate` to all in room
6. Student votes: `session:poll:vote` → receives `vote:confirmed`
7. Server broadcasts: `poll:voteUpdate` with aggregated results to teacher

### Link Share Flow
1. Teacher creates session: `session:create` → receives code
2. Teacher creates link share room: `session:createRoom` with roomType='linkShare' → receives roomId
3. Student joins session: `session:join` → receives `session:joined` with active rooms
4. Student joins link share room: `session:joinRoom`
5. Student submits: `session:linkShare:submit` → receives `session:linkShare:submitted`
6. Teacher receives: `linkShare:newSubmission` with submission details
7. Teacher can delete: `session:linkShare:delete` → broadcasts `linkShare:submissionDeleted`

### RT Feedback Flow
1. Teacher creates session: `session:create` → receives code
2. Teacher creates RT feedback room: `session:createRoom` with roomType='rtfeedback' → receives roomId
3. Student joins session: `session:join` → sees RT Feedback widget
4. Student joins feedback room: `session:joinRoom`
5. Teacher starts feedback: `session:rtfeedback:start` → broadcasts `rtfeedback:stateChanged` {isActive: true}
6. Student updates slider: `session:rtfeedback:update` with value (1-5)
7. Server aggregates all values and broadcasts: `rtfeedback:update` to teacher with average/distribution
8. Teacher stops: `session:rtfeedback:stop` → broadcasts `rtfeedback:stateChanged` {isActive: false}

### Questions Flow
1. Teacher creates session: `session:create` → receives code
2. Teacher creates questions room: `session:createRoom` with roomType='questions' → receives roomId
3. Student joins session: `session:join` → sees Questions widget
4. Student joins questions room: `session:joinRoom`
5. Teacher starts accepting questions: `session:questions:start` → broadcasts `questions:stateChanged`
6. Student submits: `session:questions:submit` → receives `questions:submitted`
7. Teacher receives: `newQuestion` directly (not broadcast to other students)
8. Teacher marks answered: `session:questions:markAnswered` → broadcasts `questionAnswered` to all
9. Teacher can delete: `session:questions:delete` → broadcasts `questionDeleted` to all