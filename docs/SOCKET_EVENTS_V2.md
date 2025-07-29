# Socket.IO Events Protocol v2

This document defines the standardized Socket.IO event protocol for the classroom widgets application. It provides a unified approach for real-time communication between teacher app, server, and student app.

## Design Principles

1. **Consistent Naming**: All events follow a hierarchical namespace pattern
2. **Predictable Responses**: Every action has a clear response event
3. **Widget Agnostic**: Common patterns work across all widget types
4. **Backward Compatible**: Legacy events supported during migration

## Event Naming Convention

```
namespace:action:target
```

- **namespace**: Top-level category (`session`, `poll`, `linkShare`, `rtfeedback`, `questions`)
- **action**: The operation (`create`, `join`, `update`, `submit`, etc.)
- **target**: Optional specific target (`vote`, `state`, etc.)

## Core Event Flows

### 1. Session Management

#### Teacher Creates Session
```
Teacher → Server: session:create
Server → Teacher: session:created { success, code, isExisting?, activeRooms? }
```

#### Student Joins Session
```
Student → Server: session:join { code, name, studentId }
Server → Student: session:joined { success, activeRooms, participantId, error? }
Server → Teacher: session:participantUpdate { count, participants }
```

### 2. Room Management (Widget Instances)

#### Teacher Creates Widget Room
```
Teacher → Server: session:createRoom { sessionCode, roomType, widgetId }
Server → Teacher: (callback) { success, isExisting?, error? }
Server → Students: session:roomCreated { roomType, widgetId, roomId, roomData }
```

#### Teacher Closes Widget Room
```
Teacher → Server: session:closeRoom { sessionCode, roomType, widgetId }
Server → Students: session:roomClosed { roomType, widgetId, roomId }
```

#### Student Joins/Leaves Room
```
Student → Server: session:joinRoom { sessionCode, roomType, widgetId }
Server → Student: [widgetType]:roomJoined { roomData, isActive }
Server → Teacher: session:participantUpdate { count, roomType, widgetId }

Student → Server: session:leaveRoom { sessionCode, roomType, widgetId }
Server → Teacher: session:participantUpdate { count, roomType, widgetId }
```

### 3. Widget-Specific Events

## Poll Widget

### Configuration & State
```
Teacher → Server: session:poll:update { sessionCode, widgetId, pollData }
Server → All: poll:dataUpdate { pollData, results?, widgetId }

Teacher → Server: session:poll:start { sessionCode, widgetId }
Server → All: poll:stateChanged { isActive: true, widgetId }

Teacher → Server: session:poll:stop { sessionCode, widgetId }
Server → All: poll:stateChanged { isActive: false, widgetId }
```

### Student Interaction
```
Student → Server: session:poll:vote { sessionCode, widgetId, optionIndex }
Server → Student: session:poll:voteConfirmed { success, error? }
Server → All: poll:voteUpdate { votes, totalVotes, widgetId }

Student → Server: poll:requestState { code, widgetId }
Server → Student: poll:dataUpdate { pollData, results }
Server → Student: poll:stateChanged { isActive, widgetId }
```

## Link Share Widget

### State Management
```
Teacher → Server: session:linkShare:start { sessionCode, widgetId }
Server → All: linkShare:stateChanged { isActive: true, widgetId }

Teacher → Server: session:linkShare:stop { sessionCode, widgetId }
Server → All: linkShare:stateChanged { isActive: false, widgetId }
```

### Submissions
```
Student → Server: session:linkShare:submit { sessionCode, widgetId, studentName, link }
Server → Student: session:linkShare:submitted { success, error? }
Server → Teacher: linkShare:newSubmission { id, studentName, link, timestamp, widgetId }

Teacher → Server: session:linkShare:delete { sessionCode, widgetId, submissionId }
Server → All: linkShare:submissionDeleted { submissionId, widgetId }
```

### State Request
```
Student → Server: linkShare:requestState { code, widgetId }
Server → Student: linkShare:stateChanged { isActive, widgetId }
```

## RT Feedback Widget

### State Management
```
Teacher → Server: session:rtfeedback:start { sessionCode, widgetId }
Server → All: rtfeedback:stateChanged { isActive: true, widgetId }

Teacher → Server: session:rtfeedback:stop { sessionCode, widgetId }
Server → All: rtfeedback:stateChanged { isActive: false, widgetId }

Teacher → Server: session:rtfeedback:reset { sessionCode, widgetId }
Server → All: rtfeedback:update { understanding, totalResponses, widgetId }
```

### Feedback Updates
```
Student → Server: session:rtfeedback:submit { sessionCode, widgetId, value }
Server → Student: session:rtfeedback:submitted { success, error? }
Server → All: rtfeedback:update { understanding, totalResponses, widgetId }

Student → Server: rtfeedback:requestState { code, widgetId }
Server → Student: rtfeedback:stateChanged { isActive, widgetId }
```

## Questions Widget

### State Management
```
Teacher → Server: session:questions:start { sessionCode, widgetId }
Server → All: questions:stateChanged { isActive: true, widgetId }

Teacher → Server: session:questions:stop { sessionCode, widgetId }
Server → All: questions:stateChanged { isActive: false, widgetId }
```

### Question Management
```
Student → Server: session:questions:submit { sessionCode, widgetId, question, studentName }
Server → Student: session:questions:submitted { success, error? }
Server → Teacher: questions:newQuestion { id, studentName, question, timestamp, isAnswered, widgetId }

Teacher → Server: session:questions:markAnswered { sessionCode, widgetId, questionId }
Server → All: questions:questionAnswered { questionId, widgetId }

Teacher → Server: session:questions:delete { sessionCode, widgetId, questionId }
Server → All: questions:questionDeleted { questionId, widgetId }

Teacher → Server: session:questions:clearAll { sessionCode, widgetId }
Server → All: questions:allCleared { widgetId }
```

### State Request
```
Student → Server: questions:requestState { code, widgetId }
Server → Student: questions:stateChanged { isActive, widgetId }
Server → Student: questions:list { questions, widgetId }
```

## Data Structures

### Session
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

### Room
```typescript
interface Room {
  type: 'poll' | 'linkShare' | 'rtfeedback' | 'questions';
  widgetId: string;          // Unique widget instance ID
  hostSocketId: string;      // Teacher's socket ID
  participants: Map<string, RoomParticipant>;
  isActive: boolean;         // Whether accepting input
  createdAt: number;
}
```

### Widget-Specific Data

#### Poll Data
```typescript
interface PollData {
  question: string;
  options: string[];
  isActive: boolean;
}

interface PollResults {
  votes: number[];           // Vote count per option
  totalVotes: number;
}
```

#### RT Feedback Data
```typescript
interface RTFeedbackUpdate {
  understanding: number[];   // Distribution across 9 buckets (1-5 in 0.5 increments)
  totalResponses: number;
}
```

#### Link Share Submission
```typescript
interface LinkSubmission {
  id: string;
  studentName: string;
  link: string;
  timestamp: number;
}
```

#### Question
```typescript
interface Question {
  id: string;
  studentName: string;
  question: string;
  timestamp: number;
  isAnswered: boolean;
}
```

## Implementation Notes

### Room Identification
- Rooms are identified by `${roomType}:${widgetId}` when widgetId exists
- This allows multiple instances of the same widget type in a session

### Socket.IO Namespaces
- Session namespace: `session:${sessionCode}`
- Room namespace: `${sessionCode}:${roomType}:${widgetId}`

### Event Broadcasting
- **To session**: `io.to('session:${sessionCode}')`
- **To room**: `io.to('${sessionCode}:${roomType}:${widgetId}')`
- **To host only**: `io.to(session.hostSocketId)`

### State Synchronization
- All widgets support `requestState` for late-joining students
- State changes are broadcast to all room participants
- Teacher always receives participant count updates

### Error Handling
- All student-initiated events should respond with success/error status
- Use specific error messages for different failure cases
- Don't expose internal implementation details in errors

## Migration Strategy

1. **Server**: Already implements this protocol via constants.js
2. **Teacher App**: Update event names to match server constants
3. **Student App**: Update event names and ensure proper error handling
4. **Testing**: Verify each widget type with multiple participants

## Common Patterns

### Widget Lifecycle
1. Teacher creates widget → `session:createRoom`
2. Students auto-join from session → `session:joinRoom`
3. Teacher controls state → `start`/`stop` events
4. Students interact → `submit`/`vote` events
5. Real-time updates → broadcast to room
6. Teacher removes widget → `session:closeRoom`

### State Request Pattern
Every widget implements:
```
Student → Server: [widget]:requestState { code, widgetId }
Server → Student: [widget]:stateChanged { isActive, widgetId }
Server → Student: [widget-specific data event]
```

### Participant Updates
Whenever room participants change:
```
Server → Teacher: session:participantUpdate { count, roomType?, widgetId? }
```