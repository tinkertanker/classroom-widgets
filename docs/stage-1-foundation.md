# Stage 1: Foundation & Cleanup

## Overview
Stage 1 focuses on establishing a solid foundation for the refactoring by completing the TypeScript migration, removing the old Context system, and establishing coding standards.

**Duration**: 1 week  
**Risk Level**: Low  
**Dependencies**: None

## Objectives
1. Convert remaining JavaScript files to TypeScript
2. Remove the old Context-based state management system
3. Clean up debug code and technical debt
4. Establish and document coding conventions
5. Implement proper error boundaries

## Task Breakdown

### A. TypeScript Migration (2-3 hours)

#### Files to Convert
| File | Priority | Notes |
|------|----------|-------|
| `src/index.jsx` | High | Main entry point |
| `src/reportWebVitals.js` | Medium | Performance monitoring |

#### Files to Remove
| File | Reason |
|------|--------|
| `src/index-context.js` | Duplicate of index.jsx |
| `src/setupTests.js` | Already have setupTests.ts |

#### Migration Steps
1. Convert `index.jsx` to `index.tsx`
   - Add proper types for ReactDOM.createRoot
   - Type the root element selection
   - Ensure proper imports

2. Convert `reportWebVitals.js` to `reportWebVitals.ts`
   - Add types for web-vitals library
   - Type the onPerfEntry callback

### B. Remove Old Context System (4-6 hours)

#### Phase 1: Analysis
1. Map all dependencies on `AppWithContext.tsx`
2. Ensure `App.tsx` has feature parity
3. Document any missing functionality

#### Phase 2: Implementation
1. Add feature flag for safe rollback:
   ```typescript
   const USE_NEW_ARCHITECTURE = process.env.REACT_APP_NEW_ARCH !== 'false';
   ```

2. Update entry point to conditionally render:
   ```typescript
   root.render(
     USE_NEW_ARCHITECTURE ? <App /> : <AppWithContext />
   );
   ```

3. Update all imports from WorkspaceContext to use Zustand hooks

4. Remove files:
   - `src/AppWithContext.tsx`
   - `src/store/WorkspaceContext.tsx`
   - `src/contexts/` (if no longer needed)

#### Components to Update
- Board component (uses WorkspaceContext)
- Widget components (use workspace state)
- Toolbar (uses workspace dispatch)

### C. Code Cleanup (3-4 hours)

#### Debug Code Removal
Search and remove:
- `console.log` statements
- `console.error` used for debugging
- Debug UI elements (markers, overlays)
- TODO comments that are obsolete
- Commented-out code blocks

#### Consolidate Duplicate Logic
1. **Socket Initialization**
   - Currently in App.tsx and AppWithContext.tsx
   - Create single source of truth

2. **Widget Creation**
   - Standardize the creation flow
   - Remove duplicate type definitions

3. **Theme Handling**
   - Consolidate dark mode logic
   - Single source for theme application

### D. Coding Standards (2-3 hours)

#### File Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Folders | kebab-case | `user-profile/` |
| React Components | PascalCase | `UserProfile.tsx` |
| Hooks | camelCase with 'use' | `useUserProfile.ts` |
| Types/Interfaces | PascalCase | `UserProfile.types.ts` |
| Utilities | kebab-case | `format-date.ts` |
| Constants | UPPER_SNAKE_CASE | `API_ENDPOINTS.ts` |

#### Import Organization
```typescript
// 1. React imports
import React, { useState, useEffect } from 'react';

// 2. Third-party libraries
import { Socket } from 'socket.io-client';
import clsx from 'clsx';

// 3. Absolute imports (using @ alias)
import { Button } from '@/shared/components';
import { useWorkspace } from '@/store';

// 4. Relative imports
import { WidgetHeader } from './WidgetHeader';
import type { WidgetProps } from './types';
```

#### Folder Structure Updates
```
Before:
src/components/timer/Timer.tsx
src/components/List/List.tsx
src/components/task-cue/TaskCue.tsx

After:
src/features/widgets/timer/Timer.tsx
src/features/widgets/list/List.tsx
src/features/widgets/task-cue/TaskCue.tsx
```

### E. Error Boundaries (1-2 hours)

#### Implementation
1. **Widget Error Boundary**
   ```typescript
   // src/shared/components/WidgetErrorBoundary.tsx
   - Catches widget-specific errors
   - Shows fallback UI with widget info
   - Option to retry or remove widget
   ```

2. **App Error Boundary**
   ```typescript
   // src/app/AppErrorBoundary.tsx
   - Top-level error catching
   - Full-page error UI
   - Error reporting integration
   ```

3. **Board Error Boundary**
   ```typescript
   // src/features/board/BoardErrorBoundary.tsx
   - Catches board/canvas errors
   - Maintains toolbar functionality
   ```

## Implementation Schedule

### Day 1: TypeScript & Initial Cleanup
- [ ] Convert index.jsx to TypeScript
- [ ] Remove duplicate files
- [ ] Convert reportWebVitals.js
- [ ] Remove console.logs

### Day 2: Context System Removal
- [ ] Add feature flag system
- [ ] Verify App.tsx completeness
- [ ] Update component imports
- [ ] Remove old Context files

### Day 3: Standards & Structure
- [ ] Rename folders per conventions
- [ ] Update all imports
- [ ] Add error boundaries
- [ ] Create coding standards doc
- [ ] Final cleanup and testing

## Validation Checklist

### Pre-Implementation
- [ ] Create feature branch
- [ ] Document current functionality
- [ ] Take UI screenshots
- [ ] Note performance baseline

### Post-Implementation
- [ ] All TypeScript errors resolved
- [ ] No Context API usage remains
- [ ] Console is clean (no debug logs)
- [ ] All widgets function correctly
- [ ] UI is pixel-perfect match
- [ ] Error boundaries catch errors
- [ ] All tests pass

### Rollback Plan
1. Feature flag can disable new system
2. Git branch preservation
3. Documented rollback steps
4. 24-hour monitoring period

## Risk Mitigation

### Potential Issues
1. **Missing functionality in new system**
   - Mitigation: Thorough comparison checklist
   - Resolution: Add to App.tsx before removing old

2. **Import path breakage**
   - Mitigation: Incremental updates
   - Resolution: Global search/replace with verification

3. **State management differences**
   - Mitigation: State comparison tests
   - Resolution: Adapter pattern if needed

## Success Criteria
- Zero visual changes
- All existing features work
- Cleaner, more maintainable code
- Foundation ready for Stage 2

## Next Steps
After successful completion:
1. Code review by team
2. Merge to development branch
3. Monitor for issues (24 hours)
4. Begin Stage 2 planning