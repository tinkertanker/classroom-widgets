import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Timer from './timer';
import { ModalProvider } from '../../contexts/ModalContext';

// Mock the audio files
jest.mock('./timer-end.mp3', () => 'timer-end.mp3');

// Mock play method on HTMLAudioElement
global.HTMLMediaElement.prototype.play = jest.fn(() => Promise.resolve());
global.HTMLMediaElement.prototype.pause = jest.fn();

// Wrapper component with ModalProvider
const renderWithModal = (component: React.ReactElement) => {
  return render(
    <ModalProvider>
      {component}
    </ModalProvider>
  );
};

describe('Timer Widget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('renders with initial state showing 00:00:10', () => {
    renderWithModal(<Timer />);
    
    expect(screen.getByText('00:00:10')).toBeInTheDocument();
  });

  test('starts and stops timer', () => {
    renderWithModal(<Timer />);
    
    // Start timer
    const startButton = screen.getByRole('button', { name: /start/i });
    fireEvent.click(startButton);
    
    // Button should change to pause
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
    
    // Advance timer by 1 second
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    
    // Should show 9 seconds
    expect(screen.getByText('00:00:09')).toBeInTheDocument();
    
    // Pause timer
    fireEvent.click(screen.getByRole('button', { name: /pause/i }));
    
    // Should show resume button
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument();
  });

  test('can edit time by clicking segments', () => {
    renderWithModal(<Timer />);
    
    // Click on seconds segment (the "10" part)
    const segments = screen.getAllByText(/\d{2}/);
    const secondsSegment = segments[2]; // The third segment is seconds
    
    fireEvent.click(secondsSegment);
    
    // An input should appear
    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
    
    // Change the value
    fireEvent.change(input, { target: { value: '30' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    
    // Should update to 30 seconds
    expect(screen.getByText('00:00:30')).toBeInTheDocument();
  });

  test('resets timer', () => {
    renderWithModal(<Timer />);
    
    // Start timer
    fireEvent.click(screen.getByRole('button', { name: /start/i }));
    
    // Advance by 5 seconds
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    
    expect(screen.getByText('00:00:05')).toBeInTheDocument();
    
    // Reset timer
    const resetButton = screen.getByRole('button', { name: /reset/i });
    fireEvent.click(resetButton);
    
    // Should return to original time (10 seconds)
    expect(screen.getByText('00:00:10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();
  });

  test('plays sound when timer reaches zero', () => {
    renderWithModal(<Timer />);
    
    // Set timer to 1 second for quick test
    const segments = screen.getAllByText(/\d{2}/);
    const secondsSegment = segments[2];
    
    fireEvent.click(secondsSegment);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '01' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    
    // Start timer
    fireEvent.click(screen.getByRole('button', { name: /start/i }));
    
    // Advance to completion
    act(() => {
      jest.advanceTimersByTime(1100); // A bit more than 1 second
    });
    
    // Should have played sound
    expect(global.HTMLMediaElement.prototype.play).toHaveBeenCalled();
    
    // Timer should show 00:00:00
    expect(screen.getByText('00:00:00')).toBeInTheDocument();
  });

  test('timer countdown works correctly', () => {
    renderWithModal(<Timer />);
    
    // Timer should start at 10 seconds
    expect(screen.getByText('00:00:10')).toBeInTheDocument();
    
    // Start timer
    fireEvent.click(screen.getByRole('button', { name: /start/i }));
    
    // Advance by 3 seconds
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    
    // Should show 7 seconds remaining
    expect(screen.getByText('00:00:07')).toBeInTheDocument();
  });
});