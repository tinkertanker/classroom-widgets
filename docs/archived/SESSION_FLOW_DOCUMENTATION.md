# Session Creation and Closing Flow Documentation

## Overview
The session management system consists of three main layers:
1. **Teacher App (Client)**: React hooks and components
2. **Socket.IO Communication**: Real-time events
3. **Server**: Session management and persistence

## Session Creation Flow

### 1. Teacher App Initiates Session

#### A. Widget Start Button Click
When a teacher clicks "Start" on any widget (Poll, Questions, etc.):

```typescript
// NetworkedWidgetWrapperV2.tsx
handleStart() -> calls useNetworkedWidget.handleStart()
```

#### B. useNetworkedWidget Hook
```typescript
// useNetworkedWidget.ts
async handleStart() {
  1. setIsStarting(true)
  2. setError(null)
  3. Call createSession() from useSession hook
  4. If session created, emit 'session:createRoom'
  5. Wait for server response
  6. If successful, setIsRoomActive(true)
}
```

#### C. useSession Hook - Session Creation
```typescript
// useSession.ts
async createSession() {
  1. Check if already connected to server
  2. Check for existing session:
     - If sessionCode exists and < 2 hours old, check server
     - If session exists on server, reuse it
     - If expired or doesn't exist, clear it
  3. If no valid session:
     - Emit 'session:create' to server
     - Wait for response with new session code
     - Store session code in Zustand store
     - Return session code
}
```

### 2. Server Processes Session Creation

#### A. Session Creation Handler
```javascript
// sessionHandler.js
socket.on(EVENTS.SESSION.CREATE, async (data, callback) => {
  1. Check if host already has a session by socket.id
  2. If existing session found:
     - Rejoin session room
     - Rejoin all active widget rooms
     - Return existing session code
  3. If no existing session:
     - Create new session with random 5-char code
     - Set host socket ID
     - Join session room
     - Return new session code
})
```

#### B. Room Creation Handler
```javascript
socket.on(EVENTS.SESSION.CREATE_ROOM, async (data, callback) => {
  1. Validate session exists and socket is host
  2. Check room limits (max rooms per session)
  3. If room exists, rejoin it
  4. If new room:
     - Create room in session
     - Join room namespace
     - Make all participants join room
     - Emit 'session:roomCreated' to all
     - Return room data
})
```

### 3. Session State Management

#### Client State Storage
- **Zustand Store** (`workspaceStore.ts`):
  - `sessionCode`: Current session code
  - `sessionCreatedAt`: Timestamp for 2-hour expiry
  - Persisted to localStorage

#### Server State
- **SessionManager** (`SessionManager.js`):
  - In-memory storage of active sessions
  - Each session contains:
    - `code`: 5-character unique code
    - `hostSocketId`: Teacher's socket ID
    - `participants`: Map of student connections
    - `activeRooms`: Map of widget rooms
    - `lastActivity`: For cleanup

## Session Closing Flow

### 1. Manual Session Close (Stop Button)

#### A. Widget Stop
```typescript
// useNetworkedWidget.ts
handleStop() {
  1. Emit 'session:closeRoom' with room details
  2. Server closes specific widget room
  3. All participants removed from room
}
```

#### B. Full Session Close
```typescript
// useSession.ts
closeSession() {
  1. Emit 'session:close' with sessionCode
  2. Clear session from Zustand store
  3. Clear local session state
}
```

### 2. Server Processes Close

#### Room Close
```javascript
socket.on(EVENTS.SESSION.CLOSE_ROOM, async (data) => {
  1. Validate session and host
  2. Remove room from session
  3. Emit 'session:roomClosed' to all
  4. Remove all sockets from room namespace
})
```

#### Session Close
```javascript
socket.on(EVENTS.SESSION.CLOSE, async (data) => {
  1. Validate session and host
  2. Emit 'session:closed' to all participants
  3. Remove all participants from rooms
  4. Remove all participants from session
  5. Delete session from SessionManager
})
```

### 3. Automatic Cleanup

#### Socket Disconnect
```javascript
socket.on('disconnect', () => {
  1. If host: Mark session for potential recovery
  2. If participant: Remove from session
  3. Update participant counts
})
```

#### Session Timeout
- Sessions expire after 2 hours (client-side check)
- Inactive sessions cleaned up after 30 minutes (server-side)

## Current Issues and Edge Cases

### 1. Session Recovery (Currently Disabled)
- **Issue**: Infinite loop when same socket ID used for recovery
- **Symptom**: Repeated recovery attempts with identical socket IDs
- **Temporary Fix**: Recovery code commented out

### 2. State Synchronization Issues
- Multiple session codes can exist simultaneously
- Local state (`localSessionCode`) vs store state (`sessionCode`)
- Race conditions between recovery and new session creation

### 3. Error Handling Gaps
- Network disconnections during session creation
- Partial room creation failures
- Inconsistent state after errors

### 4. Missing Features
- Session persistence across server restarts
- Proper session transfer between devices
- Session analytics and logging

## Recommended Fixes

1. **Simplify State Management**
   - Single source of truth for session code
   - Remove duplicate state tracking
   - Clear state lifecycle

2. **Improve Recovery Logic**
   - Proper socket ID tracking
   - Debounce recovery attempts
   - Clear recovery conditions

3. **Better Error Handling**
   - Retry logic for network failures
   - User-friendly error messages
   - State rollback on failures

4. **Add Session Validation**
   - Regular heartbeat checks
   - Server-side session validation
   - Client-server state sync