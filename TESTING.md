# Testing Guide

## Overview

The codebase includes comprehensive tests for critical functionality using React Testing Library and Jest.

## Running Tests

```bash
# Install test dependencies
npm install

# Run all tests
npm test

# Run tests in watch mode (default)
npm test

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test Timer.test

# Run tests matching pattern
npm test --testNamePattern="workspace state"
```

## Test Structure

### Unit Tests
- **App.test.tsx** - Core application functionality
- **WorkspaceContext.test.tsx** - State management and reducer logic
- **ErrorBoundary.test.tsx** - Error handling and recovery
- **useWidgetSettings.test.tsx** - Settings modal hook behavior
- **WidgetRendererLazy.test.tsx** - Lazy loading and widget rendering
- **timer.test.tsx** - Timer widget functionality

### Test Categories

1. **Core Functionality**
   - App renders without crashing
   - Dark mode toggle
   - Workspace persistence to/from localStorage

2. **State Management**
   - Widget CRUD operations
   - Position and state updates
   - Background and sticker mode changes
   - Workspace reset functionality

3. **Error Handling**
   - Error boundaries catch widget errors
   - Error UI with retry functionality
   - Graceful degradation

4. **Widget Loading**
   - Lazy loading with Suspense
   - Loading states
   - Multiple widget rendering
   - Z-index management

5. **Widget-Specific**
   - Timer countdown functionality
   - Settings persistence
   - Sound effects
   - State management

## Writing New Tests

### Widget Test Template
```typescript
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModalProvider } from '../../contexts/ModalContext';
import YourWidget from './YourWidget';

const renderWithModal = (component: React.ReactElement) => {
  return render(
    <ModalProvider>
      {component}
    </ModalProvider>
  );
};

describe('YourWidget', () => {
  const defaultProps = {
    id: 'test-123',
    widgetState: undefined,
    updateWidgetState: jest.fn()
  };

  test('renders correctly', () => {
    renderWithModal(<YourWidget {...defaultProps} />);
    // Add assertions
  });
});
```

### Best Practices

1. **Mock External Dependencies**
   ```typescript
   jest.mock('../../sounds/beep.mp3', () => 'beep.mp3');
   ```

2. **Use Fake Timers for Time-based Tests**
   ```typescript
   beforeEach(() => {
     jest.useFakeTimers();
   });
   
   afterEach(() => {
     jest.useRealTimers();
   });
   ```

3. **Test User Interactions**
   ```typescript
   fireEvent.click(screen.getByRole('button', { name: /start/i }));
   ```

4. **Wait for Async Operations**
   ```typescript
   await waitFor(() => {
     expect(screen.getByText('Loaded')).toBeInTheDocument();
   });
   ```

5. **Test State Persistence**
   ```typescript
   expect(updateWidgetState).toHaveBeenCalledWith('test-123', expectedState);
   ```

## Coverage Goals

Target coverage for critical paths:
- Core app functionality: 80%+
- State management: 90%+
- Error boundaries: 100%
- Widget rendering: 80%+
- Individual widgets: 70%+

## Common Issues

1. **Audio/Media Mocking**
   - Mock HTMLMediaElement methods globally
   - Return resolved promises for play()

2. **Modal Testing**
   - Always wrap components using modals in ModalProvider
   - Click backdrop to test closing behavior

3. **Lazy Loading**
   - Mock lazy imports for predictable testing
   - Test loading states explicitly

4. **LocalStorage**
   - Clear before each test
   - Mock for consistent behavior

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Main branch commits
- Pre-commit hooks (if configured)

Ensure all tests pass before merging!