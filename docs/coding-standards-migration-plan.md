# Coding Standards Migration Plan

## Overview
This document outlines a gradual migration plan to apply coding standards without breaking the existing application.

## Current vs Target Structure

### Current Structure
```
src/
├── components/           # All components mixed together
├── hooks/               # All hooks
├── store/               # State management
├── types/               # Type definitions
├── utils/               # Utilities
└── App.tsx             # Main app
```

### Target Structure (from coding-standards.md)
```
src/
├── app/                 # Application-level code
├── features/            # Feature-based modules
├── shared/              # Shared across features
├── store/               # State management
└── styles/              # Global styles
```

## Migration Strategy

### Phase 1: Fix Naming Conventions (Low Risk) ✅ Can do now
1. **Component Files**: Ensure PascalCase for all React components
   - ✅ Most already follow this
   - Need to fix: `widget.tsx` → `Widget.tsx`
   - Need to fix: lowercase widget files (e.g., `poll.tsx` → `Poll.tsx`)

2. **Hook Files**: Ensure camelCase with 'use' prefix
   - ✅ Already correct

3. **Type Files**: Move inline types to `.types.ts` files
   - Create `widget.types.ts` for each widget
   - Move interfaces from component files

### Phase 2: Organize Imports (Low Risk) ✅ Can do now
1. Apply import order in all files:
   - React imports
   - Third-party libraries
   - Internal imports
   - Relative imports
   - Type imports

### Phase 3: Apply TypeScript Best Practices (Medium Risk)
1. Replace all `any` types with proper types
2. Add proper return types to all functions
3. Ensure all props have interfaces

### Phase 4: Component Structure (Medium Risk)
1. Standardize component internal structure:
   - Hooks first
   - Effects second
   - Handlers third
   - Render helpers fourth
   - Main render last

### Phase 5: File Restructuring (High Risk) ⚠️ Future work
This is a major change that should be done carefully:

1. **Create new structure alongside old**:
   ```
   src/
   ├── features/               # New structure
   │   ├── board/
   │   ├── toolbar/
   │   └── widgets/
   ├── components/            # Keep old structure during migration
   ```

2. **Migrate one feature at a time**:
   - Start with standalone features (e.g., toolbar)
   - Update imports gradually
   - Test thoroughly after each migration

3. **Final cleanup**:
   - Remove old structure once everything is migrated
   - Update all import paths

## Immediate Actions (Safe to do now)

### 1. Fix File Names
These files need renaming to follow conventions:

```bash
# Widget components (should be PascalCase)
src/components/list/list.tsx → List.tsx
src/components/poll/poll.tsx → Poll.tsx  
src/components/randomiser/randomiser.tsx → Randomiser.tsx
src/components/timer/timer.tsx → Timer.tsx
src/components/trafficLight/trafficLight.tsx → TrafficLight.tsx
src/components/volumeLevel/volumeLevel.tsx → VolumeLevel.tsx
src/components/shortenLink/shortenLink.tsx → ShortenLink.tsx
src/components/textBanner/textBanner.tsx → TextBanner.tsx
src/components/imageDisplay/imageDisplay.tsx → ImageDisplay.tsx
src/components/soundEffects/soundEffects.tsx → SoundEffects.tsx
src/components/sticker/sticker.tsx → Sticker.tsx
src/components/qrcode/qrcode.tsx → QRCode.tsx
src/components/rtFeedback/rtFeedback.tsx → RTFeedback.tsx
src/components/taskCue/taskCue.tsx → TaskCue.tsx
```

### 2. Remove Unused Files
- `src/components/main/widget.tsx` (old widget component)
- `src/components/main/numericInput.tsx` (unused)
- `src/components/main/reusableButton.tsx` (unused)
- `src/components/poll/Poll.new.tsx` (duplicate)

### 3. Standardize Index Files
Ensure all widget folders have proper index.tsx files that export the default component.

## Risk Assessment

- **Low Risk**: Naming changes, import organization, removing unused files
- **Medium Risk**: TypeScript improvements, component structure standardization
- **High Risk**: Full file restructuring to feature-based organization

## Recommendation

Start with Phase 1-3 (low to medium risk) which will improve code quality without breaking changes. Phase 4-5 should be planned as a separate major refactoring effort with dedicated testing time.