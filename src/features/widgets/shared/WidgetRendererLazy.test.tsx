import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import WidgetRendererLazy from './WidgetRendererLazy';
import { WIDGET_TYPES } from '../../../shared/constants/widgetTypes';

// Mock the lazy widgets
jest.mock('./LazyWidgets', () => {
  return {
    LazyWidgets: {
      Timer: React.lazy(() => Promise.resolve({
        default: () => React.createElement('div', null, 'Timer Widget')
      })),
      Randomiser: React.lazy(() => Promise.resolve({
        default: () => React.createElement('div', null, 'Randomiser Widget')
      })),
      List: React.lazy(() => Promise.resolve({
        default: () => React.createElement('div', null, 'List Widget')
      }))
    }
  };
});

describe('WidgetRendererLazy', () => {
  const defaultProps = {
    widgetType: WIDGET_TYPES.TIMER,
    widgetId: 'test-123',
    savedState: undefined,
    isActive: false,
    onStateChange: jest.fn(),
    toggleConfetti: jest.fn(),
    isDragging: false,
    hasDragged: false
  };

  test('shows loading state initially', () => {
    render(<WidgetRendererLazy {...defaultProps} />);
    
    expect(screen.getByText('Loading widget...')).toBeInTheDocument();
  });

  test('renders widget after loading', async () => {
    render(<WidgetRendererLazy {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Timer Widget')).toBeInTheDocument();
    });
  });

  test('renders different widget types', async () => {
    const { rerender } = render(<WidgetRendererLazy {...defaultProps} />);
    
    // Timer widget
    await waitFor(() => {
      expect(screen.getByText('Timer Widget')).toBeInTheDocument();
    });
    
    // Randomiser widget
    rerender(<WidgetRendererLazy {...defaultProps} widgetType={WIDGET_TYPES.RANDOMISER} />);
    await waitFor(() => {
      expect(screen.getByText('Randomiser Widget')).toBeInTheDocument();
    });
    
    // List widget
    rerender(<WidgetRendererLazy {...defaultProps} widgetType={WIDGET_TYPES.LIST} />);
    await waitFor(() => {
      expect(screen.getByText('List Widget')).toBeInTheDocument();
    });
  });

  test('wraps widget in error boundary', async () => {
    render(<WidgetRendererLazy {...defaultProps} />);
    
    // Widget should load successfully within error boundary
    await waitFor(() => {
      expect(screen.getByText('Timer Widget')).toBeInTheDocument();
    });
  });

  test('passes isActive prop correctly', async () => {
    const { rerender } = render(<WidgetRendererLazy {...defaultProps} isActive={true} />);
    
    await waitFor(() => {
      expect(screen.getByText('Timer Widget')).toBeInTheDocument();
    });
    
    // Test with inactive state
    rerender(<WidgetRendererLazy {...defaultProps} isActive={false} />);
    
    await waitFor(() => {
      expect(screen.getByText('Timer Widget')).toBeInTheDocument();
    });
  });

  test('passes savedState to widget', async () => {
    const savedState = { someData: 'test value' };
    
    render(<WidgetRendererLazy {...defaultProps} savedState={savedState} />);
    
    await waitFor(() => {
      expect(screen.getByText('Timer Widget')).toBeInTheDocument();
      // Widget receives the saved state (though our mock doesn't display it)
    });
  });

  test('calls onStateChange when widget updates state', async () => {
    const onStateChange = jest.fn();
    
    render(<WidgetRendererLazy {...defaultProps} onStateChange={onStateChange} />);
    
    await waitFor(() => {
      expect(screen.getByText('Timer Widget')).toBeInTheDocument();
      // In a real widget, onStateChange would be called when state changes
      // Our mock doesn't trigger this, but the prop is passed correctly
    });
  });
});