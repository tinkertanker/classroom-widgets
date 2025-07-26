# File Restructuring Phases

## Overview
This document tracks the phased restructuring of the codebase to match the recommended structure from coding-standards.md. Each phase should be tested before proceeding to the next.

## Target Structure
```
src/
├── app/                    # Application-level code
│   ├── App.tsx
│   ├── providers/
│   └── routes/
├── features/               # Feature-based modules
│   ├── board/
│   ├── toolbar/
│   ├── widgets/
│   └── session/
├── shared/                 # Shared across features
│   ├── components/
│   ├── hooks/
│   ├── utils/
│   ├── types/
│   └── constants/
├── store/                  # State management (already exists)
└── styles/                 # Global styles
```

## Phase 1: Create Base Folder Structure ✅
Create empty folders without moving any files.

**Actions:**
- [x] Create src/app folder
- [x] Create src/app/providers folder
- [x] Create src/features folder
- [x] Create src/shared folder with subfolders
- [x] Create src/styles folder
- [ ] Test: App should still work exactly as before

## Phase 2: Move App-Level Files ✅
Move main app files to app folder.

**Actions:**
- [x] Move App.tsx to app/App.tsx
- [x] Move App.css to app/App.css
- [x] Update index.tsx import path
- [x] Move ModalProvider setup to app/providers/ModalProvider.tsx
- [x] Test: App should launch and all features work

## Phase 3: Create Shared Folder ✅
Move truly shared components, hooks, and utilities.

**Actions:**
- [x] Move ErrorBoundary components to shared/components/
- [x] Move all hooks to shared/hooks/
- [x] Move utils to shared/utils/
- [x] Move types to shared/types/
- [x] Move constants to shared/constants/
- [x] Update all import paths
- [x] Test: All functionality intact

## Phase 4: Board Feature ✅
Create board feature module.

**Actions:**
- [x] Create features/board folder structure
- [x] Move Board components to features/board/components/
- [x] Move board-related hooks to features/board/hooks/
- [x] Update imports
- [x] Test: Board, zoom, pan, widget dragging work

## Phase 5: Toolbar Feature ✅
Create toolbar feature module.

**Actions:**
- [x] Create features/toolbar folder structure
- [x] Move toolbar components to features/toolbar/components/
- [x] Move toolbar hooks to features/toolbar/hooks/ (no specific hooks needed)
- [x] Update imports
- [x] Test: Toolbar, widget creation, menus work

## Phase 6: Widgets Feature ✅
Organize all widgets under features/widgets.

**Actions:**
- [x] Create features/widgets folder structure
- [x] Create subfolders for each widget type
- [x] Move each widget to its own feature folder
- [x] Create shared widget components folder
- [x] Update WidgetRegistry paths
- [x] Test: All widgets create, render, and function correctly

## Phase 7: Session Feature ✅
Move networked/session features.

**Actions:**
- [x] Create features/session folder
- [x] Move SessionBanner and SessionStatus components
- [x] Move session/socket related hooks (useSession, useSessionWidget, useNetworkedWidget)
- [x] Update imports
- [x] Test: All networked widgets work

## Phase 8: Final Cleanup
Remove old structure and verify everything.

**Actions:**
- [ ] Remove empty old folders
- [ ] Update all documentation
- [ ] Run full test suite
- [ ] Update import aliases if needed
- [ ] Final verification of all features

## Testing Checklist (After Each Phase)
- [ ] App launches without errors
- [ ] Can create new widgets
- [ ] Widgets can be dragged and resized
- [ ] Zoom and pan work
- [ ] Toolbar functions work
- [ ] Networked widgets connect and function
- [ ] No console errors
- [ ] No TypeScript errors

## Rollback Plan
If any phase causes issues:
1. Git reset to before the phase
2. Analyze what went wrong
3. Fix the issue
4. Retry the phase

## Progress Tracking
- Phase 1: ✅ Completed
- Phase 2: ✅ Completed
- Phase 3: ✅ Completed
- Phase 4: ✅ Completed
- Phase 5: ✅ Completed
- Phase 6: ✅ Completed
- Phase 7: ✅ Completed
- Phase 8: ⏰ Not Started