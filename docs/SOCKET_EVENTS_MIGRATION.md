# Socket Events Migration Guide

This document tracks the differences between the current implementation and the standardized protocol, showing what needs to be updated in each component.

## Key Changes Summary

1. **Event Name Standardization**: Some events have inconsistent names across components
2. **Response Events**: Need to add proper confirmation events for all actions
3. **State Request Pattern**: Standardize across all widgets
4. **Widget ID Inclusion**: Ensure all events include widgetId where applicable

## Migration Tasks by Component

### 1. Server (✅ Mostly Compliant)

The server already uses the constants.js file and is mostly compliant. Minor fixes needed:

#### Poll Widget
- [x] ✅ Uses correct event names from constants
- [x] ✅ `session:poll:vote` expects `optionIndex` (fixed)
- [x] ✅ Emits `session:poll:voteConfirmed` (fixed)

#### RT Feedback Widget  
- [x] ✅ Uses `updateFeedback` method instead of `submitFeedback` (fixed)
- [x] ✅ Uses `clearAllFeedback` instead of `reset` (fixed)
- [x] ✅ Has `rtfeedback:requestState` handler (added)

#### Link Share Widget
- [ ] ❌ Uses `linkShare:roomStateChanged` but should be `linkShare:stateChanged`
- [ ] ❌ Missing `linkShare:requestState` handler

#### Questions Widget
- [ ] ❌ Missing `questions:requestState` handler
- [ ] ❌ Should emit `session:questions:submitted` instead of `questions:submitted`

### 2. Teacher App Updates Needed

#### Poll Widget (`/src/features/widgets/poll/poll.tsx`)
Current vs Required:
- `poll:voteUpdate` → Already correct ✅
- Needs to handle `widgetId` in all events

#### Link Share Widget (`/src/features/widgets/linkShare/linkShare.tsx`) 
Current vs Required:
- `linkShare:roomStateChanged` → `linkShare:stateChanged`
- `linkShare:stateChanged` → `linkShare:stateChanged` (keep but ensure widgetId)
- Add `widgetId` to all emitted events

#### RT Feedback Widget (`/src/features/widgets/rtFeedback/rtFeedback.tsx`)
Current vs Required:
- `rtfeedback:update` → Already correct ✅
- `rtfeedback:stateChanged` → Already correct ✅
- Ensure `widgetId` in all events

#### Questions Widget (`/src/features/widgets/questions/questions.tsx`)
Current vs Required:
- `newQuestion` → Already correct ✅
- `questionAnswered` → Already correct ✅  
- `questionDeleted` → Already correct ✅
- `allQuestionsCleared` → Already correct ✅
- Ensure `widgetId` in all events

### 3. Student App Updates Needed

#### Poll Activity (`/server/src/student/hooks/usePollSocket.ts`)
- [x] ✅ `session:poll:vote` with `optionIndex` (fixed)
- [x] ✅ Listens for `session:poll:voteConfirmed` (fixed)
- [x] ✅ Uses `poll:requestState`

#### RT Feedback Activity (`/server/src/student/components/RTFeedbackActivity.tsx`)
- [x] ✅ `session:rtfeedback:submit` (fixed)
- [x] ✅ Uses `rtfeedback:requestState`
- [ ] ❌ Should listen for `session:rtfeedback:submitted` confirmation

#### Link Share Activity (`/server/src/student/components/LinkShareActivity.tsx`)
- [ ] ❌ Should use `linkShare:requestState` instead of custom logic
- [ ] ❌ Should listen for `linkShare:stateChanged`

#### Questions Activity (`/server/src/student/components/QuestionsActivity.tsx`)
- [ ] ❌ Should listen for `session:questions:submitted` instead of `questions:submitted`
- [ ] ❌ Should use `questions:requestState`
- [ ] ❌ Should listen for `questions:list` to get initial questions

## Implementation Priority

### Phase 1: Server Fixes (High Priority)
1. Fix LinkShare `roomStateChanged` → `stateChanged`
2. Add `linkShare:requestState` handler
3. Add `questions:requestState` handler  
4. Fix Questions to emit `session:questions:submitted`

### Phase 2: Student App Fixes (High Priority)
1. Update RTFeedback to listen for submission confirmation
2. Update LinkShare to use standard state request pattern
3. Update Questions to use correct event names and state pattern

### Phase 3: Teacher App Updates (Medium Priority)
1. Update LinkShare event names
2. Ensure all widgets include widgetId in events
3. Add proper error handling for all widget operations

### Phase 4: Testing & Validation (Required)
1. Test each widget with multiple participants
2. Verify state synchronization for late-joining students
3. Test error cases (full room, invalid session, etc.)
4. Verify widget cleanup notifies all participants

## Breaking Changes

Most changes are backward compatible, but these require coordination:

1. **LinkShare**: `linkShare:roomStateChanged` → `linkShare:stateChanged`
   - Server must emit both during transition
   - Update teacher and student apps together

2. **Questions**: `questions:submitted` → `session:questions:submitted`  
   - Server can emit both during transition
   - Update student app to listen for both

## Success Criteria

- [ ] All widgets follow consistent event naming
- [ ] All student actions receive confirmation events
- [ ] All widgets support state request pattern
- [ ] Widget IDs included in all relevant events
- [ ] Late-joining students see correct state
- [ ] Error handling works consistently
- [ ] No console errors during normal operation