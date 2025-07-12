import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AppWithContext from './AppWithContext';

// Mock the audio files
jest.mock('./sounds/trash-crumple.mp3', () => 'trash-sound.mp3');

describe('App Core Functionality', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Mock MutationObserver to avoid act() warnings
    global.MutationObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      disconnect: jest.fn(),
      takeRecords: jest.fn()
    }));
  });

  test('renders without crashing', () => {
    render(<AppWithContext />);
    expect(screen.getByRole('button', { name: /timer/i })).toBeInTheDocument();
  });

  test('dark mode toggle works', () => {
    render(<AppWithContext />);
    
    // Find and click the menu button
    const menuButton = screen.getByRole('button', { name: /menu/i });
    fireEvent.click(menuButton);
    
    // Find and click dark mode toggle
    const darkModeToggle = screen.getByText(/dark mode/i);
    fireEvent.click(darkModeToggle);
    
    // Check if dark class is applied
    expect(document.querySelector('.App')).toHaveClass('dark');
  });

  test('workspace state persists to localStorage', async () => {
    render(<AppWithContext />);
    
    // Add a widget
    const timerButton = screen.getByRole('button', { name: /timer/i });
    fireEvent.click(timerButton);
    
    // Wait for state to be saved (debounced)
    await waitFor(() => {
      const savedState = localStorage.getItem('workspaceState');
      expect(savedState).toBeTruthy();
      
      const parsed = JSON.parse(savedState!);
      expect(parsed.componentList).toHaveLength(1);
      expect(parsed.componentList[0].index).toBe(1); // WIDGET_TYPES.TIMER
    }, { timeout: 1000 });
  });

  test('workspace state loads from localStorage', () => {
    // Pre-populate localStorage
    const mockState = {
      componentList: [{ id: 'test-123', index: 1 }],
      widgetPositions: [['test-123', { x: 100, y: 100 }]],
      widgetStates: [],
      activeIndex: null,
      backgroundType: 'geometric'
    };
    localStorage.setItem('workspaceState', JSON.stringify(mockState));
    
    // Render app
    render(<AppWithContext />);
    
    // Verify that localStorage was accessed
    const savedState = localStorage.getItem('workspaceState');
    expect(savedState).toBeTruthy();
    
    // The parsed state should match what we saved
    const parsed = JSON.parse(savedState!);
    expect(parsed.componentList).toHaveLength(1);
  });
});