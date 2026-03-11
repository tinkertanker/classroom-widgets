import React, { act } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import Timer from './timer';
import { ModalProvider } from '../../../contexts/ModalContext';

const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  configurable: true
});

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
    vi.setSystemTime(new Date('2026-03-11T14:00:00'));
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

  test('keeps manual time edits after finishing segment editing', () => {
    renderWithModal(<Timer />);

    fireEvent.click(screen.getByText('10'));

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '45' } });
    fireEvent.blur(input);

    expect(getByExactText('00:00:45')).toBeInTheDocument();
  });

  test('expands the quick-add tray and applies idle additions', () => {
    renderWithModal(<Timer />);

    fireEvent.click(screen.getByRole('button', { name: /show add time options/i }));

    expect(screen.getByRole('button', { name: /add 1 minute/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /add 1 minute/i }));

    expect(getByExactText('00:01:10')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add 1 minute/i })).not.toBeInTheDocument();
  });

  test('opens target-time tray and sets timer from clock time', () => {
    renderWithModal(<Timer />);

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /set target time/i }));
    });

    expect(screen.getByText('Until')).toBeInTheDocument();

    act(() => {
      fireEvent.change(screen.getByRole('combobox', { name: /target hour/i }), { target: { value: '2' } });
      fireEvent.change(screen.getByRole('combobox', { name: /target minute/i }), { target: { value: '5' } });
      fireEvent.click(screen.getByRole('button', { name: 'PM' }));
    });

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^set$/i }));
    });

    expect(getByExactText('00:05:00')).toBeInTheDocument();
    expect(screen.queryByText('Until')).not.toBeInTheDocument();
  });

  test('treats earlier target times as tomorrow', () => {
    vi.setSystemTime(new Date('2026-03-11T23:45:00'));

    renderWithModal(<Timer />);

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /set target time/i }));
    });

    act(() => {
      fireEvent.change(screen.getByRole('combobox', { name: /target hour/i }), { target: { value: '11' } });
      fireEvent.change(screen.getByRole('combobox', { name: /target minute/i }), { target: { value: '30' } });
      fireEvent.click(screen.getByRole('button', { name: 'PM' }));
    });

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^set$/i }));
    });

    expect(getByExactText('23:45:00')).toBeInTheDocument();
  });

  test('closes target-time tray when clicking the clock button again', () => {
    renderWithModal(<Timer />);

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /set target time/i }));
    });

    expect(screen.getByText('Until')).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /hide target time picker/i }));
    });

    expect(screen.queryByText('Until')).not.toBeInTheDocument();
  });

  test('closes target-time tray when opening quick-add tray', () => {
    renderWithModal(<Timer />);

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /set target time/i }));
    });

    expect(screen.getByText('Until')).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /show add time options/i }));
    });

    expect(screen.queryByText('Until')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add 1 minute/i })).toBeInTheDocument();
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

  test('hides target-time toggle while timer is running', () => {
    renderWithModal(<Timer />);

    expect(screen.getByRole('button', { name: /set target time/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /start/i }));

    expect(screen.queryByRole('button', { name: /set target time/i })).not.toBeInTheDocument();
  });
});
