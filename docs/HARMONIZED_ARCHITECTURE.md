# Harmonized Widget Architecture

This document defines the standardized architecture for all networked widgets (Poll, Link Share, Questions, RTFeedback).

## Core Principles

1. **Dual Architecture Support**: Widgets support both room-based (legacy) and session-based (preferred) architectures
2. **Consistent Event Naming**: All events follow predictable patterns
3. **Unified State Management**: Common patterns for active/inactive states
4. **Standardized Participant Tracking**: Consistent participant management across widgets

## Event Naming Conventions

### Widget Event Prefixes
- Poll: `poll:`
- Link Share: `linkShare:`  
- RTFeedback: `rtFeedback:`

### Standard Event Patterns

#### Room-Based Events (Legacy)
```
Teacher → Server:
- `[widget]:create` - Create a new room
- `[widget]:start` - Start/activate the widget
- `[widget]:stop` - Stop/deactivate the widget
- `[widget]:update` - Update widget configuration
- `[widget]:clear` - Clear widget data
- `[widget]:close` - Close the room

Server → Teacher:
- `[widget]:created` - Room creation confirmation
- `[widget]:stateChanged` - Active/inactive state change
- `[widget]:dataUpdate` - Widget data update
- `[widget]:participantJoined` - New participant
- `[widget]:participantLeft` - Participant disconnected
- `[widget]:participantCount` - Participant count update
```

#### Session-Based Events (Preferred)
```
Teacher → Server:
- `session:[widget]:create` - Create widget in session
- `session:[widget]:start` - Start widget
- `session:[widget]:stop` - Stop widget
- `session:[widget]:update` - Update configuration
- `session:[widget]:clear` - Clear data
- `session:[widget]:close` - Close widget

Server → Teacher:
- `session:[widget]:created` - Widget created
- `session:[widget]:stateChanged` - State change
- `session:[widget]:dataUpdate` - Data update
- Same participant events as room-based
```

## Widget-Specific Events

### Poll Widget
```
Additional Teacher → Server:
- `[prefix]:setPoll` - Set poll question and options
- `[prefix]:clearVotes` - Clear all votes

Additional Server → Teacher:
- `[prefix]:voteUpdate` - Individual vote received
- `[prefix]:resultsUpdate` - Aggregated results

Student → Server:
- `student:vote` - Submit vote

Server → Student:
- `poll:updated` - Poll configuration/state
- `poll:results` - Final results
```

### Link Share Widget
```
Additional Teacher → Server:
- `[prefix]:deleteSubmission` - Delete specific submission
- `[prefix]:clearSubmissions` - Clear all submissions

Additional Server → Teacher:
- `[prefix]:submissionReceived` - New submission
- `[prefix]:submissionDeleted` - Submission removed

Student → Server:
- `student:submitData` - Submit data
- `student:deleteSubmission` - Delete own submission

Server → Student:
- `linkShare:updated` - Widget state
- `linkShare:submissionConfirmed` - Submission received
```

### Questions Widget
```
Additional Teacher → Server:
- `[prefix]:markAnswered` - Mark question as answered
- `[prefix]:deleteQuestion` - Delete specific question
- `[prefix]:clearQuestions` - Clear all questions

Additional Server → Teacher:
- `[prefix]:questionReceived` - New question
- `[prefix]:questionAnswered` - Question marked answered
- `[prefix]:questionDeleted` - Question removed

Student → Server:
- `student:submitQuestion` - Submit question

Server → Student:
- `questions:updated` - Widget state
- `questions:submissionConfirmed` - Question received
```

### RTFeedback Widget
```
Additional Teacher → Server:
- `[prefix]:reset` - Reset feedback data

Additional Server → Teacher:
- `[prefix]:feedbackUpdate` - Individual feedback
- `[prefix]:aggregateUpdate` - Aggregated data

Student → Server:
- `student:updateFeedback` - Update feedback value

Server → Student:
- `rtFeedback:updated` - Widget state
- `rtFeedback:stateChanged` - Active/inactive
```

## Implementation Guidelines

### 1. Socket Connection Setup
```typescript
// In setupSocketListeners function
const setupSocketListeners = (socket: Socket, widgetType: string, isSession: boolean = false) => {
  const prefix = isSession ? `session:${widgetType}` : widgetType;
  
  // Common listeners for all widgets
  socket.on(`${prefix}:stateChanged`, handleStateChange);
  socket.on(`${prefix}:dataUpdate`, handleDataUpdate);
  socket.on(`${prefix}:participantJoined`, handleParticipantJoined);
  socket.on(`${prefix}:participantLeft`, handleParticipantLeft);
  socket.on(`${prefix}:participantCount`, handleParticipantCount);
  
  // Widget-specific listeners
  // ...
};
```

### 2. State Management
All widgets should maintain:
- `isActive`: boolean - Whether widget is accepting input
- `participants`: number - Current participant count
- `roomCode` or `sessionCode`: string - Access code
- Widget-specific data

### 3. Lifecycle Management
1. Create room/session
2. Configure widget (if needed)
3. Start activity (set isActive = true)
4. Collect data/interactions
5. Stop activity (set isActive = false)
6. View results
7. Clear data (optional)
8. Close room/session

### 4. Error Handling
- All creation events should use callbacks with success/error
- Connection errors should be displayed to users
- Graceful degradation when server is unavailable

### 5. Migration Path
1. Keep existing room-based events working (legacy support)
2. Add session-based event handlers alongside
3. Use feature flag or configuration to choose architecture
4. Eventually deprecate room-based approach

## Benefits of Harmonization

1. **Consistency**: Developers can predict event names and behavior
2. **Maintainability**: Common patterns reduce code duplication
3. **Extensibility**: Easy to add new widgets following the pattern
4. **User Experience**: Consistent behavior across all widgets
5. **Session Support**: Ready for unified session architecture

## UI/UX Standards

### Teacher App Interface

1. **Widget Headers**
   - Display widget icon instead of text title (implemented)
   - Activity code in grey pill without duplicate icons
   - Consistent button placement (settings, play/pause)
   - Participant count with user icon

2. **Session Banner**
   - Compact single-line display
   - "Visit:" label for student URL
   - "Code:" label for session code
   - Copy buttons for both values
   - Auto-expand when session starts

3. **Widget Controls**
   - Play/Pause buttons in header (not Stop)
   - Consistent color scheme:
     - Play: sage-500 (green)
     - Pause: dusty-rose-500 (red)
     - Settings: warm-gray
   - Clear All functionality where applicable

### Student App Interface

1. **Session Header**
   - Unified connection indicator in header
   - Format: "Connected to session [CODE]"
   - Subtitle: "Leave to join a different session"
   - Connection state with colored dot (green=connected, gray=connecting)

2. **Activity Cards**
   - No individual connection indicators
   - Consistent empty states when paused
   - Clear activity instructions
   - Responsive design for all devices

3. **Visual Consistency**
   - Matching color schemes between teacher and student
   - Consistent spacing and typography
   - Dark mode support throughout

## Implementation Priority

1. **Phase 1**: Standardize event names in existing room-based architecture ✓
2. **Phase 2**: Add session-based support alongside room-based ✓
3. **Phase 3**: Migrate UI to prefer session-based when available ✓
4. **Phase 4**: Deprecate room-based architecture (in progress)