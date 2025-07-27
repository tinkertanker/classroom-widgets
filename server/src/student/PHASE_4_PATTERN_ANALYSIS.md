# Phase 4: Common Activity Pattern Analysis

## Pattern Identification

After analyzing all 4 activity components (PollActivity, LinkShareActivity, RTFeedbackActivity, QuestionsActivity), here are the common patterns:

### 1. Room Join/Leave Pattern
All activities have identical room joining logic:
```typescript
// Join room
useEffect(() => {
  if (isSession && widgetId) {
    socket.emit('session:joinRoom', {
      sessionCode: roomCode,
      roomType: 'poll'|'linkShare'|'rtfeedback'|'questions',
      widgetId
    });

    return () => {
      socket.emit('session:leaveRoom', {
        sessionCode: roomCode,
        roomType: 'poll'|'linkShare'|'rtfeedback'|'questions',
        widgetId
      });
    };
  }
}, [socket, roomCode, widgetId, isSession]);
```

### 2. Activity State Pattern
Most activities track `isActive` state:
- PollActivity: `isActive` in pollData
- LinkShareActivity: `isActive` state
- RTFeedbackActivity: `isActive` state
- QuestionsActivity: `isActive` state

### 3. State Request Pattern
Activities request initial state if not provided:
```typescript
let timer: NodeJS.Timeout | undefined;
if (!hasInitialData) {
  timer = setTimeout(() => {
    socket.emit('[activity]:requestState', { code: roomCode, widgetId });
  }, 100);
}
```

### 4. Success/Error Handling Pattern
LinkShareActivity and QuestionsActivity share:
- `showSuccess` state
- `error` state
- `isSubmitting` state
- Similar success message UI

## Extraction Decision

### Worth Extracting ✅

1. **Room Join/Leave Hook**
   - Used by all 4 activities
   - Identical logic
   - Clear abstraction boundary

### Not Worth Extracting ❌

1. **Activity State Management**
   - While similar, each activity handles state differently
   - PollActivity uses complex state in `usePollSocket`
   - Would add complexity without much benefit

2. **Success/Error UI**
   - Only 2 of 4 activities use it
   - Simple enough to duplicate
   - UI might need customization per activity

3. **State Request Logic**
   - Different event names per activity
   - Different conditions for requesting
   - Not enough commonality

## Recommendation

**Extract only the Room Join/Leave pattern** into a custom hook:

```typescript
// hooks/useSessionRoom.ts
export const useSessionRoom = ({
  socket,
  sessionCode,
  roomType,
  widgetId,
  isSession = false
}) => {
  useEffect(() => {
    if (isSession && widgetId) {
      socket.emit('session:joinRoom', {
        sessionCode,
        roomType,
        widgetId
      });

      return () => {
        socket.emit('session:leaveRoom', {
          sessionCode,
          roomType,
          widgetId
        });
      };
    }
  }, [socket, sessionCode, roomType, widgetId, isSession]);
};
```

## Benefits
- Reduces code duplication (4 identical implementations)
- Single place to update room join/leave logic
- Clear, focused abstraction
- Easy to test

## Risks
- Minimal - this is a simple, well-defined pattern
- Easy to revert if needed