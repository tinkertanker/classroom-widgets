# Teacher App Refactoring Plan

## Overview

This document outlines the comprehensive refactoring plan for the teacher app, focusing on improving scalability and maintainability while preserving the current UI exactly as it is.

### Goals
1. **Maintain exact current UI** - No visual changes whatsoever
2. **Improve scalability** - Better performance with many widgets
3. **Enhance maintainability** - Cleaner, more organized code
4. **Complete TypeScript migration** - Type safety throughout
5. **Modernize architecture** - Complete Zustand migration

### Constraints
- No backwards compatibility needed with existing localStorage data
- Must maintain identical user experience
- Incremental approach to minimize risk

## Current State Analysis

### Architecture Issues
1. **Dual state management** - Both Context API and Zustand running simultaneously
2. **Mixed file types** - Combination of JS/JSX and TS/TSX files
3. **Performance concerns** - Large canvas always fully rendered
4. **Inconsistent patterns** - Different approaches across widgets
5. **Technical debt** - Debug code, TODOs, incomplete features

### Current File Structure
```
src/
├── AppWithContext.tsx      # Old entry point (380+ lines)
├── App.tsx                 # New entry point
├── components/            # Mixed organization
├── contexts/             # Old Context system
├── hooks/               # Mix of old and new patterns
├── store/              # Both Context and Zustand
└── utils/             # Various utilities
```

## Target Architecture

### Proposed Structure
```
src/
├── app/                    # Application entry & providers
│   ├── App.tsx            # Main app component
│   └── providers/         # App-level providers
├── features/              # Feature-based organization
│   ├── board/            # Canvas/workspace functionality
│   ├── toolbar/          # Toolbar & widget launcher
│   ├── widgets/          # All widget implementations
│   └── session/          # Networking & sessions
├── shared/               # Shared across features
│   ├── components/       # Reusable UI components
│   ├── hooks/           # Shared hooks
│   ├── utils/           # Utility functions
│   └── types/           # Shared TypeScript types
└── store/               # State management
    ├── workspace.ts     # Main workspace store
    ├── session.ts       # Session/networking store
    └── widgets.ts       # Widget-specific store
```

### State Architecture
```typescript
// Normalized state shape for performance
interface AppState {
  widgets: {
    byId: Record<string, Widget>;
    allIds: string[];
    visibleIds: string[]; // For viewport culling
  };
  workspace: {
    scale: number;
    background: BackgroundType;
    theme: 'light' | 'dark';
    scrollPosition: { x: number; y: number };
  };
  session: {
    socket: Socket | null;
    rooms: Map<string, Room>;
    participants: Map<string, Participant>;
  };
}
```

## Implementation Stages

### Stage 1: Foundation & Cleanup (Week 1)
- Complete TypeScript migration
- Remove old Context system
- Clean up code and establish conventions
- Set up error boundaries

### Stage 2: State Management (Week 1-2)
- Finalize Zustand architecture
- Separate concerns into stores
- Implement selectors
- Add persistence middleware

### Stage 3: Widget System (Week 2-3)
- Standardize widget interface
- Implement widget factory
- Create widget HOC
- Separate networked logic

### Stage 4: Performance (Week 3-4)
- Viewport culling
- Render optimization
- Virtualization
- Memoization

### Stage 5: Networking (Week 4)
- Socket service
- Connection lifecycle
- Room management
- Error handling

### Stage 6: Testing & Docs (Week 5)
- Unit tests
- Integration tests
- Component documentation
- Development guide

## Migration Strategy

### Principles
1. **No breaking changes** - UI must remain identical
2. **Feature flags** - Toggle between implementations
3. **Incremental** - Small, testable changes
4. **Rollback ready** - Easy to revert if needed

### Validation
- Screenshot testing for UI regression
- Manual testing checklist
- Performance benchmarks
- Error monitoring

## Progress Status

### Stage 1: Foundation & Cleanup ✅ **NEARLY COMPLETED**
- [x] **Complete TypeScript migration** - All JS/JSX files converted to TypeScript
- [x] **Fix runtime issues** - Resolved process.env → import.meta.env, fixed imports
- [x] **Architecture cleanup** - Removed ViewportCanvas, using react-rnd consistently
- [x] **Working application** - Toolbar, widgets, zoom, pan, and drag all functional
- [x] **Remove old Context system** - All Context files removed, only ModalContext kept
- [ ] **Error boundaries** - Not yet implemented
- [ ] **Code standards** - Partial implementation

### Stage 2-6: Pending
All other stages are pending completion of Stage 1.

## Recent Changes

### 2025-07-26
- **Context System Removal**: Deleted WorkspaceContext, SessionContext, AppWithContext
- **Cleanup**: Removed old toolbar.tsx, ZoomControl, and dependent hooks
- **Simplification**: Removed feature flag - app now uses only the new architecture
- **Documentation**: Created context-removal-summary.md

### 2025-07-25

### ✅ Completed
1. **TypeScript Migration**: Converted all remaining JS files to TS
2. **Layout Fixes**: Fixed toolbar positioning issue (Board was overlaying toolbar)
3. **Drag System**: Confirmed using react-rnd v10.4.12 with scale prop for zoom compensation
4. **Architecture Cleanup**: Removed ViewportCanvas custom drag implementation
5. **Documentation**: Updated CLAUDE.md and created architecture-cleanup.md

### 🔧 Technical Decisions
- **Drag Implementation**: Using react-rnd instead of custom DraggableWidget
- **Layout**: Board uses relative positioning with flex-1 container
- **Scale Handling**: React-rnd scale prop ensures accurate dragging at all zoom levels
- **Old System**: AppWithContext shows placeholder, doesn't break compilation

## Success Metrics

- [x] **100% TypeScript coverage** - All source files now TypeScript
- [ ] Zero Context API usage
- [ ] <16ms frame time with 50+ widgets
- [ ] 90%+ test coverage
- [x] **Zero visual regressions** - Toolbar, widgets, zoom, drag all working
- [ ] 20% bundle size reduction
- [x] **Improved developer velocity** - Cleaner codebase, better types

## Next Steps

### Immediate (Stage 1 Completion)
1. **Remove Context files**: Delete WorkspaceContext.tsx and related files
2. **Implement error boundaries**: Add WidgetErrorBoundary, AppErrorBoundary
3. **Apply coding standards**: File naming, folder structure per docs/coding-standards.md

### Future Stages
4. Begin Stage 2: State Management optimization
5. Continue with remaining stages as planned