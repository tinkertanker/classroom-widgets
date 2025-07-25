# Coding Standards

## Overview
This document defines the coding standards for the Classroom Widgets project to ensure consistency, maintainability, and scalability.

## File Organization

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| **Folders** | kebab-case | `user-profile/`, `widget-system/` |
| **React Components** | PascalCase.tsx | `UserProfile.tsx`, `WidgetCanvas.tsx` |
| **Hooks** | camelCase.ts with 'use' prefix | `useUserProfile.ts`, `useWidget.ts` |
| **Types/Interfaces** | PascalCase in .types.ts | `UserProfile.types.ts` |
| **Utilities** | kebab-case.ts | `format-date.ts`, `calculate-position.ts` |
| **Constants** | UPPER_SNAKE_CASE.ts | `API_ENDPOINTS.ts`, `WIDGET_TYPES.ts` |
| **Tests** | Same as source with .test | `UserProfile.test.tsx`, `format-date.test.ts` |

### Folder Structure

```
src/
├── app/                      # Application-level code
│   ├── App.tsx              # Root component
│   ├── providers/           # App-wide providers
│   └── routes/              # Route definitions
├── features/                # Feature-based modules
│   ├── board/              # Board/canvas feature
│   ├── toolbar/            # Toolbar feature
│   ├── widgets/            # Widget implementations
│   └── session/            # Session management
├── shared/                  # Shared across features
│   ├── components/         # Reusable UI components
│   ├── hooks/              # Shared hooks
│   ├── utils/              # Utility functions
│   ├── types/              # Shared TypeScript types
│   └── constants/          # Shared constants
├── store/                   # State management
│   ├── workspace.store.ts   # Workspace state
│   ├── session.store.ts     # Session state
│   └── types.ts            # Store types
└── styles/                  # Global styles
    ├── globals.css         # Global CSS
    └── variables.css       # CSS variables
```

## TypeScript Guidelines

### Type Definitions

```typescript
// ✅ Good: Use interfaces for objects
interface UserProfile {
  id: string;
  name: string;
  email: string;
}

// ✅ Good: Use type for unions/intersections
type Theme = 'light' | 'dark';
type Position = { x: number; y: number };

// ❌ Bad: Using 'any'
const processData = (data: any) => { ... };

// ✅ Good: Proper typing
const processData = (data: UserData) => { ... };
```

### Component Props

```typescript
// ✅ Good: Separate props interface
interface ButtonProps {
  variant: 'primary' | 'secondary';
  size?: 'small' | 'medium' | 'large';
  onClick: () => void;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  variant, 
  size = 'medium',
  onClick,
  children 
}) => { ... };
```

### Generic Components

```typescript
// ✅ Good: Type-safe generic component
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  keyExtractor: (item: T) => string;
}

export function List<T>({ items, renderItem, keyExtractor }: ListProps<T>) {
  return (
    <>
      {items.map(item => (
        <div key={keyExtractor(item)}>
          {renderItem(item)}
        </div>
      ))}
    </>
  );
}
```

## React Best Practices

### Component Structure

```typescript
// ✅ Good: Clear component structure
import React, { useState, useEffect } from 'react';
import { useWorkspace } from '@/hooks';
import type { WidgetProps } from './types';

export const Widget: React.FC<WidgetProps> = ({ id, initialState }) => {
  // 1. Hooks
  const { theme } = useWorkspace();
  const [state, setState] = useState(initialState);
  
  // 2. Effects
  useEffect(() => {
    // Effect logic
  }, [dependency]);
  
  // 3. Handlers
  const handleClick = () => {
    // Handler logic
  };
  
  // 4. Render helpers
  const renderContent = () => {
    // Render logic
  };
  
  // 5. Main render
  return (
    <div className="widget">
      {renderContent()}
    </div>
  );
};
```

### Hooks Rules

```typescript
// ✅ Good: Custom hook with clear naming
export const useWidget = (widgetId: string) => {
  const widget = useStore(state => state.widgets[widgetId]);
  const updateWidget = useStore(state => state.updateWidget);
  
  const handlers = useMemo(() => ({
    update: (data: Partial<Widget>) => updateWidget(widgetId, data),
    remove: () => removeWidget(widgetId)
  }), [widgetId, updateWidget]);
  
  return { widget, ...handlers };
};

// ❌ Bad: Conditional hooks
const Component = ({ shouldFetch }) => {
  if (shouldFetch) {
    const data = useFetch(); // ❌ Conditional hook
  }
};
```

## State Management

### Zustand Store Pattern

```typescript
// ✅ Good: Properly typed store with selectors
interface WorkspaceStore {
  widgets: Record<string, Widget>;
  theme: Theme;
  
  // Actions
  addWidget: (widget: Widget) => void;
  removeWidget: (id: string) => void;
  setTheme: (theme: Theme) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  widgets: {},
  theme: 'light',
  
  addWidget: (widget) => set(state => ({
    widgets: { ...state.widgets, [widget.id]: widget }
  })),
  
  removeWidget: (id) => set(state => {
    const { [id]: removed, ...rest } = state.widgets;
    return { widgets: rest };
  }),
  
  setTheme: (theme) => set({ theme })
}));

// Selectors
export const useWidget = (id: string) => 
  useWorkspaceStore(state => state.widgets[id]);
export const useTheme = () => 
  useWorkspaceStore(state => state.theme);
```

## Import Organization

```typescript
// 1. React and React-related imports
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// 2. Third-party libraries
import clsx from 'clsx';
import { motion } from 'framer-motion';

// 3. Internal absolute imports (using @ alias)
import { Button, Card } from '@/shared/components';
import { useWorkspace } from '@/store';
import { formatDate } from '@/shared/utils';

// 4. Relative imports
import { WidgetHeader } from './components/WidgetHeader';
import { calculatePosition } from './utils';

// 5. Type imports (always last)
import type { WidgetProps, WidgetState } from './types';
```

## CSS and Styling

### Tailwind CSS Guidelines

```typescript
// ✅ Good: Organized className with clsx
import clsx from 'clsx';

const Button = ({ variant, size, disabled }) => (
  <button
    className={clsx(
      // Base styles
      'inline-flex items-center justify-center',
      'rounded-md font-medium transition-colors',
      
      // Size variants
      {
        'px-3 py-1.5 text-sm': size === 'small',
        'px-4 py-2 text-base': size === 'medium',
        'px-6 py-3 text-lg': size === 'large',
      },
      
      // Color variants
      {
        'bg-blue-600 text-white hover:bg-blue-700': variant === 'primary',
        'bg-gray-200 text-gray-900 hover:bg-gray-300': variant === 'secondary',
      },
      
      // States
      {
        'opacity-50 cursor-not-allowed': disabled,
      }
    )}
    disabled={disabled}
  >
    {children}
  </button>
);
```

### Component-Specific Styles

```typescript
// ✅ Good: Co-located styles for complex components
// Widget.module.css
.widget {
  /* Complex styles that don't fit well in Tailwind */
}

// Widget.tsx
import styles from './Widget.module.css';
```

## Error Handling

### Error Boundaries

```typescript
// ✅ Good: Specific error boundary with recovery
class WidgetErrorBoundary extends Component<Props, State> {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Widget error:', error, info);
    // Report to error service
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <WidgetErrorFallback
          error={this.state.error}
          retry={() => this.setState({ hasError: false })}
        />
      );
    }
    
    return this.props.children;
  }
}
```

### Async Error Handling

```typescript
// ✅ Good: Proper async error handling
const fetchUserData = async (userId: string) => {
  try {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  } catch (error) {
    if (error instanceof ApiError) {
      // Handle specific error types
      throw new UserFetchError(error.message);
    }
    // Re-throw unexpected errors
    throw error;
  }
};
```

## Performance Guidelines

### Memoization

```typescript
// ✅ Good: Appropriate memoization
const ExpensiveComponent = memo(({ data }) => {
  const processedData = useMemo(
    () => expensiveProcessing(data),
    [data]
  );
  
  const handleClick = useCallback((id: string) => {
    // Handle click
  }, []); // Empty deps if handler doesn't change
  
  return <div>{/* Render */}</div>;
});
```

### Code Splitting

```typescript
// ✅ Good: Lazy load heavy components
const HeavyWidget = lazy(() => import('./widgets/HeavyWidget'));

const App = () => (
  <Suspense fallback={<WidgetSkeleton />}>
    <HeavyWidget />
  </Suspense>
);
```

## Testing Guidelines

### Component Testing

```typescript
// ✅ Good: Comprehensive component test
describe('Widget', () => {
  it('renders with initial state', () => {
    render(<Widget id="123" initialState={mockState} />);
    expect(screen.getByText('Widget Title')).toBeInTheDocument();
  });
  
  it('handles user interaction', async () => {
    const user = userEvent.setup();
    render(<Widget id="123" initialState={mockState} />);
    
    await user.click(screen.getByRole('button', { name: 'Save' }));
    
    expect(mockOnSave).toHaveBeenCalledWith(expectedData);
  });
});
```

## Documentation

### Component Documentation

```typescript
/**
 * Widget component that displays and manages widget state
 * 
 * @example
 * <Widget
 *   id="widget-123"
 *   initialState={{ title: 'My Widget' }}
 *   onStateChange={(state) => console.log(state)}
 * />
 */
interface WidgetProps {
  /** Unique identifier for the widget */
  id: string;
  /** Initial state of the widget */
  initialState: WidgetState;
  /** Callback when widget state changes */
  onStateChange?: (state: WidgetState) => void;
}
```

## Git Commit Guidelines

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test additions or changes
- `chore`: Build process or auxiliary tool changes

### Examples
```
feat(widgets): add timer widget pause functionality

- Add pause/resume button to timer widget
- Maintain elapsed time during pause
- Add visual indicator for paused state

Closes #123
```

## Code Review Checklist

- [ ] Follows naming conventions
- [ ] Properly typed (no `any`)
- [ ] Includes necessary error handling
- [ ] Has appropriate memoization
- [ ] Includes tests for new functionality
- [ ] Documentation is updated
- [ ] No console.logs in production code
- [ ] Imports are properly organized
- [ ] Performance implications considered