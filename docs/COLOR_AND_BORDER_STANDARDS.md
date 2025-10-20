# Color and Border Standards

This document defines the standardized color palette and border system used throughout the Classroom Widgets application to ensure visual consistency and maintainability.

## Table of Contents

- [Color Palette](#color-palette)
- [Border System](#border-system)
- [Usage Guidelines](#usage-guidelines)
- [Component Integration](#component-integration)
- [Dark Mode Support](#dark-mode-support)

## Color Palette

### Primary Colors

The application uses a warm, neutral color palette designed for classroom environments.

#### Background Colors
- **Soft White** (`bg-soft-white`): `#fdfcfb` - Primary widget backgrounds
- **Warm Gray 100** (`bg-warm-gray-100`): `#f5f5f4` - Surface elements
- **Warm Gray 800** (`bg-warm-gray-800`): `#292524` - Dark mode primary backgrounds

#### Text Colors
- **Primary Text** (`text-warm-gray-800/200`): High contrast for readability
  - Light: `text-warm-gray-800` (`#44403c`)
  - Dark: `text-warm-gray-200` (`#e7e5e4`)
- **Secondary Text** (`text-warm-gray-600/400`): Supporting text
  - Light: `text-warm-gray-600` (`#57534e`)
  - Dark: `text-warm-gray-400` (`#a8a29e`)
- **Muted Text** (`text-warm-gray-500/400`): Low emphasis text
  - Light: `text-warm-gray-500` (`#78716c`)
  - Dark: `text-warm-gray-400` (`#a8a29e`)

#### Placeholder Text
- **Placeholder** (`placeholder-warm-gray-500/400`): Input field placeholders
  - Light: `#78716c`
  - Dark: `#a8a29e`

### Brand Colors

#### Sage (Primary Actions)
- **Sage 500**: `#7c9885` - Primary buttons, active states
- **Sage 400**: `#8fb4a0` - Dark mode variant
- **Sage 600**: `#6a8573` - Hover states

#### Terracotta (Secondary Actions)
- **Terracotta 500**: `#c99a83` - Secondary buttons
- **Terracotta 200**: `#f4e6e1` - Light mode borders
- **Terracotta 700**: `#8b5a4a` - Dark mode borders

#### Dusty Rose (Destructive Actions)
- **Dusty Rose 500**: `#b8838a` - Danger buttons, alerts
- **Dusty Rose 300**: `#d4a5a9` - Light mode borders
- **Dusty Rose 400**: `#c5969c` - Dark mode borders
- **Dusty Rose 600**: `#a57179` - Hover states

### Status Colors

#### Game States (Wordle)
- **Emerald 500**: `#10b981` - Correct letters
- **Yellow 500**: `#eab308` - Present letters
- **Warm Gray 400/600**: Absent letters

## Border System

### Standard Border Hierarchy

#### Primary Borders
- **Usage**: Widget containers, cards, modals
- **Class**: `borders.primary`
- **Implementation**: `border border-warm-gray-200 dark:border-warm-gray-700`
- **Width**: 1px (`border`)
- **Color**:
  - Light: `warm-gray-200` (`#e7e5e4`)
  - Dark: `warm-gray-700` (`#44403c`)

#### Secondary Borders
- **Usage**: Input fields, form controls, interactive elements
- **Class**: `borders.secondary`
- **Implementation**: `border border-warm-gray-300 dark:border-warm-gray-600`
- **Width**: 1px (`border`)
- **Color**:
  - Light: `warm-gray-300` (`#d6d3d1`)
  - Dark: `warm-gray-600` (`#57534e`)

#### Tertiary Borders
- **Usage**: Button borders, emphasis elements
- **Class**: `borders.tertiary`
- **Implementation**: `border border-warm-gray-400 dark:border-warm-gray-500`
- **Width**: 1px (`border`)
- **Color**:
  - Light: `warm-gray-400` (`#a8a29e`)
  - Dark: `warm-gray-500` (`#78716c`)

### Brand Borders

#### Sage Borders
- **Usage**: Primary action elements, focus rings
- **Class**: `borders.sage`
- **Implementation**: `border border-sage-500 dark:border-sage-400`

#### Terracotta Borders
- **Usage**: Secondary elements, About page
- **Class**: `borders.terracotta`
- **Implementation**: `border border-terracotta-200 dark:border-terracotta-700`

#### Dusty Rose Borders
- **Usage**: Error states, alerts, destructive elements
- **Class**: `borders.dustyRose`
- **Implementation**: `border border-dusty-rose-300 dark:border-dusty-rose-700`

### Border Radius Standards

#### Size Scale
- **Small** (`borderRadius.sm`): `rounded-sm` (2px) - Tiny elements
- **Medium** (`borderRadius.md`): `rounded-md` (6px) - Input fields, buttons
- **Large** (`borderRadius.lg`): `rounded-lg` (8px) - **PRIMARY STANDARD** - Widgets, cards
- **Extra Large** (`borderRadius.xl`): `rounded-xl` (12px) - Modals, prominent containers
- **Full** (`borderRadius.full`): `rounded-full` - Circular elements

### Border Width Standards

#### Width Scale
- **None** (`borderWidth.none`): `border-0` - No border
- **Thin** (`borderWidth.thin`): `border` (1px) - **PRIMARY STANDARD** - Most elements
- **Medium** (`borderWidth.medium`): `border-2` (2px) - Emphasis elements
- **Thick** (`borderWidth.thick`): `border-4` (4px) - Special accents

## Usage Guidelines

### Widget Containers
```tsx
// Use the standardized widget container utility (recommended)
import { widgetContainer } from '../../../shared/utils/styles';

<div className={widgetContainer}>
  {/* Widget content */}
</div>

// Alternative explicit import for clarity
import { widgetBorderStandard } from '../../../shared/utils/styles';

<div className={widgetBorderStandard}>
  {/* Widget content */}
</div>

// Manual implementation (if needed)
<div className="bg-soft-white/90 dark:bg-warm-gray-800/90 rounded-t-lg border border-warm-gray-200 dark:border-warm-gray-700 w-full h-full flex flex-col">
  {/* Widget content */}
</div>
```

### Input Fields
```tsx
// Use the standardized input component
<WidgetInput
  type="text"
  value={value}
  onChange={handleChange}
  placeholder="Enter text..."
/>

// Manual implementation
<input
  className="border border-warm-gray-300 dark:border-warm-gray-600 rounded-md px-3 py-2 focus:ring-2 focus:ring-sage-500 bg-white dark:bg-warm-gray-700 text-warm-gray-800 dark:text-warm-gray-200"
  // ... other props
/>
```

### Buttons
Use the standardized button styles from `styles.ts`:
```tsx
import { buttons } from '../utils/styles';

// Primary action
<button className={buttons.primary}>Start</button>

// Secondary action
<button className={buttons.secondary}>Cancel</button>

// Danger action
<button className={buttons.danger}>Delete</button>
```

### Focus States
All interactive elements should use the standardized focus ring:
```tsx
import { borderStyles } from '../utils/styles';

<div className={borderStyles.focus}>
  {/* Interactive element */}
</div>
```

## Component Integration

### Shared Components

#### WidgetInput
- **Location**: `src/shared/components/WidgetInput.tsx`
- **Features**: Standardized borders, focus states, dark mode support
- **Usage**: All input fields across widgets

#### WidgetTextarea
- **Location**: `src/shared/components/WidgetInput.tsx`
- **Features**: Same styling as WidgetInput, with resize options
- **Usage**: All textarea elements across widgets

### Style Utilities

#### borders (`src/shared/utils/styles.ts`)
```typescript
export const borders = {
  primary: "border border-warm-gray-200 dark:border-warm-gray-700",
  secondary: "border border-warm-gray-300 dark:border-warm-gray-600",
  tertiary: "border border-warm-gray-400 dark:border-warm-gray-500",
  sage: "border border-sage-500 dark:border-sage-400",
  terracotta: "border border-terracotta-200 dark:border-terracotta-700",
  dustyRose: "border border-dusty-rose-300 dark:border-dusty-rose-700",
  none: "border-0"
} as const;
```

#### borderStyles (`src/shared/utils/styles.ts`)
```typescript
export const borderStyles = {
  widget: cn(borders.primary, borderRadius.lg, borderWidth.thin),
  input: cn(borders.secondary, borderRadius.md, borderWidth.thin),
  modal: cn(borders.primary, borderRadius.lg, borderWidth.thin),
  button: cn(borders.tertiary, borderRadius.md, borderWidth.thin),
  card: cn(borders.primary, borderRadius.lg, borderWidth.thin),
  focus: "focus:ring-2 focus:ring-sage-500 focus:ring-offset-1"
} as const;
```

## Dark Mode Support

### Implementation Pattern
All colors and borders follow a consistent dark mode pattern:

```tsx
// Light mode first, then dark mode
"border-warm-gray-200 dark:border-warm-gray-700"
```

### Color Mapping
| Light Mode | Dark Mode | Usage |
|------------|-----------|-------|
| `warm-gray-200` | `warm-gray-700` | Primary borders |
| `warm-gray-300` | `warm-gray-600` | Input borders |
| `warm-gray-400` | `warm-gray-500` | Tertiary borders |
| `sage-500` | `sage-400` | Primary brand |
| `terracotta-200` | `terracotta-700` | Secondary brand |
| `dusty-rose-300` | `dusty-rose-700` | Destructive elements |

### Testing Dark Mode
Always test border and color implementations in both light and dark modes:
1. Toggle dark mode in the application
2. Verify contrast and visibility
3. Ensure consistency across all widgets

## Migration Guide

### Converting Legacy Borders

1. **Identify inconsistent borders**
   ```bash
   # Search for non-standard border implementations
   grep -r "border-warm-gray-300.*dark:border-warm-gray-600" src/
   ```

2. **Replace with standardized components**
   ```tsx
   // Before
   <input className="border border-warm-gray-300 dark:border-warm-gray-600 rounded-md" />

   // After
   <WidgetInput />
   ```

3. **Use standardized utilities**
   ```tsx
   // Before
   <div className="border border-warm-gray-200 dark:border-warm-gray-700 rounded-lg" />

   // After
   <div className={borderStyles.widget} />
   ```

### Common Patterns

#### Widget Main Container
```tsx
// Standard pattern
<div className="bg-soft-white/90 dark:bg-warm-gray-800/90 rounded-t-lg border border-warm-gray-200 dark:border-warm-gray-700 w-full h-full flex flex-col relative">
```

#### Input Fields
```tsx
// Standard pattern
<WidgetInput
  type="text"
  className="text-sm" // Additional size variations
  // ... other props
/>
```

#### Button Groups
```tsx
// Standard pattern
<div className="flex gap-2 mt-3">
  <button className={buttons.primary}>Primary Action</button>
  <button className={buttons.secondary}>Secondary Action</button>
</div>
```

## Best Practices

### 1. Consistency First
- Always use standardized components and utilities
- Don't create custom border styles unless absolutely necessary
- Follow the established hierarchy (primary → secondary → tertiary)

### 2. Accessibility
- Ensure sufficient contrast between borders and backgrounds
- Use focus rings for interactive elements
- Test with screen readers and keyboard navigation

### 3. Maintainability
- Import styles from centralized `styles.ts` utilities
- Avoid hardcoded colors in component files
- Use semantic class names (primary, secondary, etc.)

### 4. Performance
- Use the combined `borderStyles` utilities instead of individual classes
- Leverage Tailwind's dark mode prefix for consistency
- Avoid unnecessary CSS specificity

## Troubleshooting

### Common Issues

#### Borders Not Showing in Dark Mode
**Problem**: Borders disappear in dark mode
**Solution**: Ensure dark mode variant is specified
```tsx
// Incorrect
"border-warm-gray-200"

// Correct
"border-warm-gray-200 dark:border-warm-gray-700"
```

#### Inconsistent Input Styling
**Problem**: Different input styles across widgets
**Solution**: Use `WidgetInput` component instead of custom inputs
```tsx
// Replace all <input> elements with <WidgetInput>
<WidgetInput type="text" />
```

#### Focus Ring Not Working
**Problem**: Focus states not visible
**Solution**: Use standardized focus utility
```tsx
<div className={borderStyles.focus}>
  <button>Click me</button>
</div>
```

### Validation

To validate border and color consistency:

1. **Visual Inspection**: Check all widgets in light and dark modes
2. **Code Review**: Ensure all borders use standardized utilities
3. **Automated Testing**: Look for hardcoded color values
   ```bash
   grep -r "rgb(" src/  # Find hardcoded RGB values
   grep -r "#" src/     # Find hardcoded hex colors
   ```

## Future Enhancements

### Planned Improvements
1. **Design Tokens**: Implement CSS custom properties for better theming
2. **Component Library**: Create Storybook documentation for all components
3. **Automated Testing**: Add visual regression tests for border consistency
4. **Enhanced Animations**: Standardize border animations and transitions

### Extension Points
The border and color system is designed to be extensible:
- Add new brand colors following the established naming convention
- Create new border styles by combining existing utilities
- Extend the component library with specialized input types

## Complete Widget Inventory

This section provides a comprehensive list of all widgets in the Classroom Widgets application that have been standardized with the consistent border pattern.

### Standardized Widgets (18 total)

All widgets listed below use the standard border pattern: `bg-soft-white/90 dark:bg-warm-gray-800/90 rounded-t-lg border border-warm-gray-200 dark:border-warm-gray-700 w-full h-full flex flex-col`

#### Interactive Widgets
- **List** (`src/features/widgets/list/list.tsx`) - Task list with drag-and-drop reordering and status tracking
- **Randomiser** (`src/features/widgets/randomiser/randomiser.tsx`) - Random selection tool with confetti effects and slot machine animation
- **Timer** (`src/features/widgets/timer/timer.tsx`) - Countdown/timer functionality with customizable durations
- **Tic Tac Toe** (`src/features/widgets/ticTacToe/TicTacToe.tsx`) - Classic two-player game with win detection
- **Snake** (`src/features/widgets/snake/snake.tsx`) - Classic snake game with keyboard controls and score tracking
- **Wordle** (`src/features/widgets/wordle/wordle.tsx`) - Word guessing game with keyboard input and visual feedback

#### Visual & Display Widgets
- **Image Display** (`src/features/widgets/imageDisplay/imageDisplay.tsx`) - Image viewer with drag-and-drop, paste support, and double-click to change
- **Text Banner** (`src/features/widgets/textBanner/textBanner.tsx`) - Customizable text display with color themes and auto-sizing
- **Sticker** (`src/features/widgets/sticker/sticker.tsx`) - Decorative stickers with rotation and color customization
- **Traffic Light** (`src/features/widgets/trafficLight/trafficLight.tsx`) - Visual status indicators with descriptive text for classroom management
- **Volume Level** (`src/features/widgets/volumeLevel/volumeLevel.tsx`) - Audio level visualization with waveform display

#### Networked Widgets (Real-time)
- **Poll** (`src/features/widgets/poll/poll.tsx`) - Real-time polling with student participation via activity codes
- **Questions** (`src/features/widgets/questions/Questions.tsx`) - Q&A session management with student submissions
- **RT Feedback** (`src/features/widgets/rtFeedback/rtFeedback.tsx`) - Real-time feedback slider (1-5 scale) for gauging student understanding
- **Link Share** (`src/features/widgets/linkShare/LinkShare.tsx`) - Collect link submissions from students via activity codes

#### Utility Widgets
- **QR Code** (`src/features/widgets/qrcode/qrcode.tsx`) - QR code generator for sharing links with students
- **Shorten Link** (`src/features/widgets/shortenLink/shortenLink.tsx`) - URL shortening with QR code generation (requires API key)
- **Sound Effects** (`src/features/widgets/soundEffects/soundEffects.tsx`) - Sound effect player with keyboard shortcuts
- **Task Cue** (`src/features/widgets/taskCue/taskCue.tsx`) - Visual work mode indicators for classroom transitions

### Special Cases

#### Widgets with Alternative Backgrounds
- **Snake** - Uses `bg-gray-900` for game board (intentional for game aesthetics)
- **Text Banner** - Uses dynamic background colors based on selected theme

#### Shared Components
- **NetworkedWidgetEmpty** (`src/features/widgets/shared/NetworkedWidgetEmpty.tsx`) - Standardized empty state for networked widgets

### Widget Discovery Method

The complete widget inventory was determined by:
1. Scanning the `src/features/widgets/` directory for all widget folders
2. Identifying main widget components (excluding `/components/` and `/hooks/` subdirectories)
3. Verifying each widget uses the standardized border pattern
4. Updating any widgets not conforming to the standard

### Available Widget Container Utilities

The styles utility provides several widget container options:

#### `widgetContainer` (Current Standard)
```tsx
import { widgetContainer } from '../../../shared/utils/styles';
```
- Uses the standardized border pattern with `/90` opacity
- Top-only rounded corners (`rounded-t-lg`)
- Consistent warm-gray borders
- Recommended for all new widgets

#### `widgetBorderStandard` (Explicit Alternative)
```tsx
import { widgetBorderStandard } from '../../../shared/utils/styles';
```
- Identical to `widgetContainer` but with a more explicit name
- Useful for code clarity where the purpose might not be obvious
- Same standardized border pattern

#### `widgetContainerLegacy` (Deprecated)
```tsx
import { widgetContainerLegacy } from '../../../shared/utils/styles';
```
- Previous version without `/90` opacity and with `rounded-lg`
- Maintained for backward compatibility
- Should not be used for new widgets

#### `widgetContainerWithShadow` (Legacy)
```tsx
import { widgetContainerWithShadow } from '../../../shared/utils/styles';
```
- Legacy version with shadow effects
- Uses `rounded-lg` instead of `rounded-t-lg`
- Maintained for backward compatibility

### Migration Notes

When creating new widgets or modifying existing ones:
1. **Use `widgetContainer` utility** - Import and use for consistent styling
2. **Ensure dark mode variants** - The utility includes appropriate dark mode classes
3. **Top-only rounded corners** - Uses `rounded-t-lg` for modern appearance
4. **Semi-transparent backgrounds** - Includes `/90` opacity for subtle layering
5. **Test both themes** - Verify appearance in both light and dark modes
6. **Avoid manual implementations** - Use the utility classes instead of hardcoding CSS classes

---

**Version**: 1.2
**Last Updated**: 2025-10-19
**Maintainers**: Classroom Widgets Development Team

For questions or contributions, please refer to the main project documentation or create an issue in the project repository.