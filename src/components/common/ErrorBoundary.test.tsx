import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../../shared/components/ErrorBoundary';

// Component that throws an error
const ThrowError: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Working component</div>;
};

// Mock console.error to avoid noise in test output
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalError;
});

describe('ErrorBoundary', () => {
  test('renders children when there is no error', () => {
    render(
      <ErrorBoundary widgetName="TestWidget">
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Working component')).toBeInTheDocument();
  });

  test('renders error UI when child throws', () => {
    render(
      <ErrorBoundary widgetName="TestWidget">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText(/Something went wrong with TestWidget/)).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  test('shows error details when expanded', () => {
    render(
      <ErrorBoundary widgetName="TestWidget">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    // Click to show details
    const detailsButton = screen.getByText('Show Details');
    fireEvent.click(detailsButton);
    
    expect(screen.getByText(/Test error/)).toBeInTheDocument();
    expect(screen.getByText('Hide Details')).toBeInTheDocument();
  });

  test('resets error state when Try Again is clicked', () => {
    const { rerender } = render(
      <ErrorBoundary widgetName="TestWidget">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText(/Something went wrong with TestWidget/)).toBeInTheDocument();
    
    // Click Try Again
    const tryAgainButton = screen.getByText('Try Again');
    fireEvent.click(tryAgainButton);
    
    // Rerender with non-throwing component
    rerender(
      <ErrorBoundary widgetName="TestWidget">
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Working component')).toBeInTheDocument();
  });

  test('handles errors from async components', () => {
    const AsyncError: React.FC = () => {
      React.useEffect(() => {
        throw new Error('Async error');
      }, []);
      return <div>Async component</div>;
    };
    
    render(
      <ErrorBoundary widgetName="AsyncWidget">
        <AsyncError />
      </ErrorBoundary>
    );
    
    // Error boundaries don't catch errors in event handlers, async code, or during SSR
    // So this component will render initially
    expect(screen.getByText('Async component')).toBeInTheDocument();
  });

  test('logs error to console', () => {
    render(
      <ErrorBoundary widgetName="TestWidget">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(console.error).toHaveBeenCalled();
  });
});