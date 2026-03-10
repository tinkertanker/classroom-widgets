import React, { act } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import Timer from './timer';
import { ModalProvider } from '../../../contexts/ModalContext';

vi.mock('./timer-end.mp3', () => ({ default: 'timer-end.mp3' }));
vi.mock('./timer-end-2.wav', () => ({ default: 'timer-end-2.wav' }));
vi.mock('./timer-end-3.mp3', () => ({ default: 'timer-end-3.mp3' }));

global.HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
global.HTMLMediaElement.prototype.pause = vi.fn();

const renderWithModal = (component: React.ReactElement) => {
  return render(
    <ModalProvider>
      {component}
    </ModalProvider>
  );
};

const getByExactText = (text: string) =>
  screen.getByText((_, element) => {
    if (!element) {
      return false;
    }

    const matches = element.textContent === text;
    const childMatches = Array.from(element.children).some(
      child => child.textContent === text
    );

    return matches && !childMatches;
  });

describe('Timer Widget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  test('renders with the default editable time', () => {
    renderWithModal(<Timer />);

    expect(getByExactText('00:00:10')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add 1 minute/i })).not.toBeInTheDocument();
  });

  test('expands the quick-add tray and applies idle additions', () => {
    renderWithModal(<Timer />);

    fireEvent.click(screen.getByRole('button', { name: /show add time options/i }));

    expect(screen.getByRole('button', { name: /add 1 minute/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /add 1 minute/i }));

    expect(getByExactText('00:01:10')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add 1 minute/i })).not.toBeInTheDocument();
  });

  test('adds time while running without interrupting the countdown', () => {
    renderWithModal(<Timer />);

    fireEvent.click(screen.getByRole('button', { name: /start/i }));

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(getByExactText('9')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /show add time options/i }));
    fireEvent.click(screen.getByRole('button', { name: /add 1 minute/i }));

    expect(getByExactText('01:09')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
  });

  test('adds time while paused and resumes from the extended value', () => {
    renderWithModal(<Timer />);

    fireEvent.click(screen.getByRole('button', { name: /start/i }));

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    fireEvent.click(screen.getByRole('button', { name: /pause/i }));

    fireEvent.click(screen.getByRole('button', { name: /show add time options/i }));
    fireEvent.click(screen.getByRole('button', { name: /add 2 minutes/i }));

    expect(getByExactText('00:02:07')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /resume/i }));

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(getByExactText('02:06')).toBeInTheDocument();
  });

  test('restart returns to the adjusted duration after a quick-add', () => {
    renderWithModal(<Timer />);

    fireEvent.click(screen.getByRole('button', { name: /start/i }));
    fireEvent.click(screen.getByRole('button', { name: /show add time options/i }));
    fireEvent.click(screen.getByRole('button', { name: /add 5 minutes/i }));

    fireEvent.click(screen.getByRole('button', { name: /restart/i }));

    expect(getByExactText('00:05:10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();
  });

  test('hides quick-add controls after the timer finishes and still plays audio', () => {
    renderWithModal(<Timer />);

    fireEvent.click(screen.getByRole('button', { name: /start/i }));

    act(() => {
      vi.advanceTimersByTime(11000);
    });

    expect(screen.getByText("Time's Up!")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show add time options/i })).not.toBeInTheDocument();
    expect(global.HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });
});
