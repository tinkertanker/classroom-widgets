# Socket Events Documentation

This document describes all socket events used in the Classroom Widgets application for real-time communication between the teacher app and student app.

## Architecture Overview

The application supports two architectures:
1. **Room-based** (older): Individual rooms for each widget type
2. **Session-based** (newer): Single session code supports multiple widget types

## Session-Based Events

Session architecture allows one code to work across multiple widgets (Poll, Link Share, Questions, RTFeedback).

### Core Session Events

#### Events emitted by teacher app:
- `session:create` - Create or join existing session
  - Callback response: `{ success: boolean, code: string, isExisting: boolean, error?: string }`

- `session:createRoom` - Create a room within the session
  - Payload: `{ sessionCode: string, roomType: 'poll' | 'linkShare' | 'questions' | 'rtfeedback', widgetId?: string }`
  - Callback response: `{ success: boolean, isExisting: boolean, error?: string }`

- `session:closeRoom` - Close a specific room type
  - Payload: `{ sessionCode: string, roomType: string }`

#### Events received by teacher app:
- `session:participantUpdate` - Participant count/list changed
  - Payload: `{ count: number, participants: SessionParticipant[] }`

- `session:roomCreated` - Room was created successfully
  - Payload: `{ roomType: string }`

- `session:roomClosed` - Room was closed
  - Payload: `{ roomType: string }`

### Poll Session Events

#### Teacher emits:
- `session:poll:create` - Create/update poll
  - Payload: `{ sessionCode: string, question: string, options: string[] }`

- `session:poll:start` - Start accepting votes
  - Payload: `{ sessionCode: string }`

- `session:poll:stop` - Stop accepting votes
  - Payload: `{ sessionCode: string }`

- `session:poll:reset` - Clear all votes
  - Payload: `{ sessionCode: string }`

#### Teacher receives:
- `session:poll:update` - Poll state update
  - Payload: `{ question: string, options: string[], votes: {}, totalVotes: number, isActive: boolean }`

- `session:poll:voteUpdate` - Individual vote update
  - Payload: `{ optionIndex: number, totalVotes: number }`

### Link Share Session Events

#### Teacher emits:
- `session:linkShare:start` - Start accepting links
  - Payload: `{ sessionCode: string, widgetId?: string }`

- `session:linkShare:stop` - Stop accepting links  
  - Payload: `{ sessionCode: string, widgetId?: string }`

- `session:linkShare:clear` - Clear all submissions
  - Payload: `{ sessionCode: string, widgetId?: string }`

- `session:linkShare:removeSubmission` - Remove specific submission
  - Payload: `{ sessionCode: string, submissionId: string, widgetId?: string }`

#### Teacher receives:
- `session:linkShare:newSubmission` - New submission received
  - Payload: `{ id: string, studentName: string, link: string, timestamp: number, widgetId?: string }`

- `session:linkShare:submissionRemoved` - Submission was removed
  - Payload: `{ submissionId: string, widgetId?: string }`

- `linkShare:allCleared` - All submissions cleared
  - Payload: `{ widgetId?: string }`

- `linkShare:roomStateChanged` - Room active state changed
  - Payload: `{ isActive: boolean, widgetId?: string }`

### Questions Session Events

#### Teacher emits:
- `session:questions:start` - Start accepting questions
  - Payload: `{ sessionCode: string, widgetId?: string }`

- `session:questions:stop` - Stop accepting questions
  - Payload: `{ sessionCode: string, widgetId?: string }`

- `session:questions:markAnswered` - Mark question as answered
  - Payload: `{ sessionCode: string, questionId: string, widgetId?: string }`

- `session:questions:delete` - Delete a question
  - Payload: `{ sessionCode: string, questionId: string, widgetId?: string }`

- `session:questions:clearAll` - Clear all questions
  - Payload: `{ sessionCode: string, widgetId?: string }`

#### Teacher receives:
- `session:questions:newQuestion` - New question submitted
  - Payload: `{ id: string, text: string, studentName: string, timestamp: Date, answered: boolean, widgetId?: string }`

- `questions:stateChanged` - Questions active state changed
  - Payload: `{ isActive: boolean, widgetId?: string }`

### RTFeedback Session Events

#### Teacher emits:
- `session:rtfeedback:start` - Start collecting feedback
  - Payload: `{ sessionCode: string }`

- `session:rtfeedback:stop` - Stop collecting feedback
  - Payload: `{ sessionCode: string }`

- `session:rtfeedback:reset` - Clear all feedback data
  - Payload: `{ sessionCode: string }`

#### Teacher receives:
- `session:rtfeedback:update` - Bulk feedback update
  - Payload: `{ feedbackData: StudentFeedback[], aggregated: { understanding: number[], totalResponses: number } }`

## Room-Based Events (Legacy)

These events are used by widgets that haven't migrated to the session architecture yet.

### Poll Widget Events

#### Teacher emits:
- `host:join` - Join room as host
- `host:createPoll` - Create/update poll
  - Payload: `{ question: string, options: string[] }`
- `host:controlPoll` - Start/stop poll
  - Payload: `{ isActive: boolean }`
- `host:clearVotes` - Clear all votes
- `host:closeRoom` - Close the room

#### Teacher receives:
- `host:joined` - Host join confirmation
- `poll:update` - Poll state update
- `vote:update` - Vote count update
- `participant:update` - Participant count change

### Link Share Widget Events

#### Teacher emits:
- `host:createLinkShareRoom` - Create room
- `host:closeRoom` - Close room

#### Teacher receives:
- `room:created` - Room creation confirmation
- `submission:new` - New submission
- `submission:removed` - Submission removed

### RTFeedback Widget Events

#### Teacher emits:
- `rtfeedback:create` - Create feedback room
- `rtfeedback:toggle` - Start/stop feedback
  - Payload: `{ code: string, isActive: boolean }`

#### Teacher receives:
- `rtfeedback:created` - Room created
- `feedback` - Individual feedback update
  - Payload: `{ studentId: string, value: number }`
- `rtfeedback:update` - Bulk feedback update
- `rtfeedback:stateChanged` - Active state changed
- `participant:joined` - Student joined
- `studentDisconnected` - Student left

## Student App Events

### Session-based student events:
- `student:joinSession` - Join session with code
  - Payload: `{ code: string, name: string }`
- `student:leaveSession` - Leave current session

### Activity-specific student events:

#### Poll:
- `student:vote` - Submit vote
  - Payload: `{ sessionCode: string, optionIndex: number }`

#### Link Share:
- `session:linkShare:submit` - Submit link
  - Payload: `{ sessionCode: string, studentName: string, link: string, widgetId?: string }`
- `student:removeSubmission` - Remove submission (legacy)
  - Payload: `{ sessionCode: string }`

#### Questions:
- `session:questions:submit` - Submit a question
  - Payload: `{ sessionCode: string, text: string, studentName: string, widgetId?: string }`

#### RTFeedback:
- `session:rtfeedback:update` - Update feedback value
  - Payload: `{ sessionCode: string, value: number, widgetId?: string }`

## Best Practices

1. **Always handle disconnections gracefully** - Clean up rooms/sessions when host disconnects
2. **Use callbacks for critical operations** - Ensure create/join operations succeed before proceeding
3. **Implement proper error handling** - Display connection errors to users
4. **Consider migration path** - New widgets should use session-based architecture
5. **Test with multiple participants** - Ensure events work correctly with many students

## Migration Guide

To migrate a widget from room-based to session-based:

1. Replace `useNetworkedWidget` with `useSessionWidget`
2. Update event names to use `session:` prefix
3. Include `sessionCode` in all event payloads
4. Use the session participant tracking instead of widget-specific tracking
5. Test thoroughly with multiple widgets active simultaneously