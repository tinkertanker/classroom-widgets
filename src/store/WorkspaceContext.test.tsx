import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { WorkspaceProvider, useWorkspace } from './WorkspaceContext';
import { workspaceReducer } from './WorkspaceContext';
import { WIDGET_TYPES } from '../constants/widgetTypes';
import type { WidgetInstance } from '../types/app.types';

// Test component that uses the workspace context
const TestComponent: React.FC = () => {
  const { state, addWidget, removeWidget, updateWidgetPosition, setActiveWidget } = useWorkspace();
  
  return (
    <div>
      <div data-testid="widget-count">{state.widgets.length}</div>
      <div data-testid="active-widget">{state.activeWidgetId || 'none'}</div>
      <button onClick={() => addWidget(WIDGET_TYPES.TIMER)}>Add Timer</button>
      <button onClick={() => state.widgets[0] && removeWidget(state.widgets[0].id)}>
        Remove First
      </button>
      <button onClick={() => state.widgets[0] && setActiveWidget(state.widgets[0].id)}>
        Set Active
      </button>
      <button 
        onClick={() => state.widgets[0] && updateWidgetPosition(state.widgets[0].id, { x: 100, y: 100 })}
      >
        Update Position
      </button>
    </div>
  );
};

describe('WorkspaceContext', () => {
  test('provides initial state', () => {
    render(
      <WorkspaceProvider>
        <TestComponent />
      </WorkspaceProvider>
    );
    
    expect(screen.getByTestId('widget-count')).toHaveTextContent('0');
    expect(screen.getByTestId('active-widget')).toHaveTextContent('none');
  });

  test('adds widget correctly', () => {
    render(
      <WorkspaceProvider>
        <TestComponent />
      </WorkspaceProvider>
    );
    
    const addButton = screen.getByText('Add Timer');
    fireEvent.click(addButton);
    
    expect(screen.getByTestId('widget-count')).toHaveTextContent('1');
  });

  test('removes widget correctly', () => {
    render(
      <WorkspaceProvider>
        <TestComponent />
      </WorkspaceProvider>
    );
    
    // Add a widget first
    fireEvent.click(screen.getByText('Add Timer'));
    expect(screen.getByTestId('widget-count')).toHaveTextContent('1');
    
    // Remove it
    fireEvent.click(screen.getByText('Remove First'));
    expect(screen.getByTestId('widget-count')).toHaveTextContent('0');
  });

  test('sets active widget', () => {
    render(
      <WorkspaceProvider>
        <TestComponent />
      </WorkspaceProvider>
    );
    
    // Add a widget
    fireEvent.click(screen.getByText('Add Timer'));
    
    // Set it as active
    fireEvent.click(screen.getByText('Set Active'));
    
    expect(screen.getByTestId('active-widget')).not.toHaveTextContent('none');
  });

  test('updates widget position', () => {
    render(
      <WorkspaceProvider>
        <TestComponent />
      </WorkspaceProvider>
    );
    
    // Add a widget
    fireEvent.click(screen.getByText('Add Timer'));
    
    // Update position
    fireEvent.click(screen.getByText('Update Position'));
    
    // Widget should still exist
    expect(screen.getByTestId('widget-count')).toHaveTextContent('1');
  });
});

describe('workspaceReducer', () => {
  const initialState = {
    widgets: [],
    widgetPositions: new Map(),
    widgetStates: new Map(),
    activeWidgetId: null,
    backgroundType: 'geometric' as const,
    stickerMode: false,
    selectedStickerType: ''
  };

  test('ADD_WIDGET action', () => {
    const newState = workspaceReducer(initialState, {
      type: 'ADD_WIDGET',
      payload: { widgetType: WIDGET_TYPES.TIMER }
    });
    
    expect(newState.widgets).toHaveLength(1);
    expect(newState.widgets[0].index).toBe(WIDGET_TYPES.TIMER);
    expect(newState.activeWidgetId).toBe(newState.widgets[0].id);
  });

  test('REMOVE_WIDGET action', () => {
    const stateWithWidget = {
      ...initialState,
      widgets: [{ id: 'test-123', index: WIDGET_TYPES.TIMER }],
      activeWidgetId: 'test-123'
    };
    
    const newState = workspaceReducer(stateWithWidget, {
      type: 'REMOVE_WIDGET',
      payload: { widgetId: 'test-123' }
    });
    
    expect(newState.widgets).toHaveLength(0);
    expect(newState.activeWidgetId).toBeNull();
  });

  test('SET_ACTIVE_WIDGET action', () => {
    const newState = workspaceReducer(initialState, {
      type: 'SET_ACTIVE_WIDGET',
      payload: { widgetId: 'test-123' }
    });
    
    expect(newState.activeWidgetId).toBe('test-123');
  });

  test('UPDATE_WIDGET_POSITION action', () => {
    const position = { x: 100, y: 200 };
    const newState = workspaceReducer(initialState, {
      type: 'UPDATE_WIDGET_POSITION',
      payload: { widgetId: 'test-123', position }
    });
    
    expect(newState.widgetPositions.get('test-123')).toEqual(position);
  });

  test('UPDATE_WIDGET_STATE action', () => {
    const widgetState = { someData: 'test' };
    const newState = workspaceReducer(initialState, {
      type: 'UPDATE_WIDGET_STATE',
      payload: { widgetId: 'test-123', state: widgetState }
    });
    
    expect(newState.widgetStates.get('test-123')).toEqual(widgetState);
  });

  test('SET_BACKGROUND action', () => {
    const newState = workspaceReducer(initialState, {
      type: 'SET_BACKGROUND',
      payload: { backgroundType: 'geometric' }
    });
    
    expect(newState.backgroundType).toBe('geometric');
  });

  test('SET_STICKER_MODE action', () => {
    const newState = workspaceReducer(initialState, {
      type: 'SET_STICKER_MODE',
      payload: { enabled: true, stickerType: 'heart' }
    });
    
    expect(newState.stickerMode).toBe(true);
    expect(newState.selectedStickerType).toBe('heart');
    
    const toggledBack = workspaceReducer(newState, {
      type: 'SET_STICKER_MODE',
      payload: { enabled: false }
    });
    
    expect(toggledBack.stickerMode).toBe(false);
  });

  test('RESET_WORKSPACE action', () => {
    const stateWithData = {
      ...initialState,
      widgets: [{ id: 'test-123', index: WIDGET_TYPES.TIMER }],
      widgetPositions: new Map([['test-123', { x: 100, y: 100 }]]),
      activeWidgetId: 'test-123',
      backgroundType: 'geometric' as const
    };
    
    const newState = workspaceReducer(stateWithData, {
      type: 'RESET_WORKSPACE'
    });
    
    expect(newState.widgets).toHaveLength(0);
    expect(newState.widgetPositions.size).toBe(0);
    expect(newState.activeWidgetId).toBeNull();
    expect(newState.backgroundType).toBe('geometric'); // Background is preserved
  });
});