import React, { act } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import Timer from './timer';
import { ModalProvider } from '../../../contexts/ModalContext';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';
import { warmGray } from '@shared/constants/colors';

const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

const originalLocalStorage = globalThis.localStorage;

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  configurable: true
});

vi.mock('./timer-end-2.wav', () => ({ default: 'timer-end-2.wav' }));
vi.mock('./timer-end-3.mp3', () => ({ default: 'timer-end-3.mp3' }));
vi.mock('./components/CreatureAnimation', () => ({
  CreatureAnimation: () => null
}));

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
    useWorkspaceStore.setState({ theme: 'light' });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  afterAll(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      configurable: true
    });
  });

  test('renders with the default editable time', () => {
    renderWithModal(<Timer />);

    expect(getByExactText('00:00:10')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add 1 minute/i })).not.toBeInTheDocument();
  });

  test('keeps the outer timer shell transparent in dark mode while filling the circle solid dark', () => {
    useWorkspaceStore.setState({ theme: 'dark' });

    renderWithModal(<Timer />);

    const timerOuterContainer = screen.getByTestId('timer-outer-container');
    expect(timerOuterContainer).toHaveClass('rounded-lg');
    expect(timerOuterContainer).toHaveClass('bg-transparent');
    expect(timerOuterContainer).toHaveClass('dark:bg-transparent');
    expect(timerOuterContainer).not.toHaveClass('dark:bg-warm-gray-800/90');

    const timerVisualShell = screen.getByTestId('timer-visual-shell');
    expect(timerVisualShell).toHaveClass('dark:bg-transparent');
    expect(timerVisualShell).not.toHaveClass('dark:bg-warm-gray-800/90');

    expect(screen.getByTestId('timer-face')).toHaveAttribute('fill', warmGray[800]);
  });

  test('uses layered strokes instead of SVG filters for the progress glow', () => {
    const { container } = renderWithModal(<Timer />);

    expect(container.querySelector('filter')).not.toBeInTheDocument();
    expect(container.querySelectorAll('circle[stroke="url(#rainbowGradient)"]')).toHaveLength(2);
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

  test('exposes the selected target period accessibly', () => {
    renderWithModal(<Timer />);

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /set target time/i }));
    });

    expect(screen.getByRole('button', { name: 'PM' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'AM' })).toHaveAttribute('aria-pressed', 'false');

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'AM' }));
    });

    expect(screen.getByRole('button', { name: 'AM' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'PM' })).toHaveAttribute('aria-pressed', 'false');
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

  test('does not persist timer state on every countdown tick while running', () => {
    const onStateChange = vi.fn();

    renderWithModal(<Timer onStateChange={onStateChange} />);

    onStateChange.mockClear();

    fireEvent.click(screen.getByRole('button', { name: /start/i }));

    expect(onStateChange).toHaveBeenCalledTimes(1);

    onStateChange.mockClear();

    act(() => {
      vi.advanceTimersByTime(3200);
    });

    expect(onStateChange).not.toHaveBeenCalled();
  });

  test('preserves a restored running timer deadline', () => {
    const onStateChange = vi.fn();
    const endTime = Date.now() + 60_000;

    renderWithModal(<Timer savedState={{ timer: {
      endTime,
      initialTime: 10,
      originalTime: 10,
      isRunning: true,
      isPaused: false,
      pausedTimeRemaining: 0
    } }} onStateChange={onStateChange} />);

    expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({
      timer: expect.objectContaining({ endTime })
    }));
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

  test('restores a finished timer without replaying its end sound', () => {
    const onStateChange = vi.fn();

    renderWithModal(<Timer savedState={{ timer: {
      endTime: null,
      initialTime: 10,
      originalTime: 10,
      isRunning: false,
      isPaused: false,
      pausedTimeRemaining: 0,
      timerFinished: true
    } }} onStateChange={onStateChange} />);

    expect(screen.getByText("Time's Up!")).toBeInTheDocument();
    expect(global.HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({
      timer: expect.objectContaining({ timerFinished: true })
    }));
  });

  test('notifies once when a running timer expired while unmounted in StrictMode', () => {
    renderWithModal(<React.StrictMode><Timer savedState={{ timer: {
      endTime: Date.now() - 1000,
      initialTime: 10,
      originalTime: 10,
      isRunning: true,
      isPaused: false,
      pausedTimeRemaining: 0
    } }} /></React.StrictMode>);

    expect(global.HTMLMediaElement.prototype.play).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(screen.getByText("Time's Up!")).toBeInTheDocument();
    expect(global.HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });

  test('mute stops an end sound that is already playing', () => {
    renderWithModal(<Timer />);

    fireEvent.click(screen.getByRole('button', { name: /start/i }));

    act(() => {
      vi.advanceTimersByTime(11000);
    });

    expect(global.HTMLMediaElement.prototype.play).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /^mute timer sound$/i }));

    expect(global.HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /unmute timer sound/i })).toBeInTheDocument();
  });

  test('unmuting mid-countdown still plays the end sound', () => {
    renderWithModal(<Timer />);

    fireEvent.click(screen.getByRole('button', { name: /^mute timer sound$/i }));
    fireEvent.click(screen.getByRole('button', { name: /start/i }));

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    fireEvent.click(screen.getByRole('button', { name: /unmute timer sound/i }));
    (global.HTMLMediaElement.prototype.play as ReturnType<typeof vi.fn>).mockClear();

    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.getByText("Time's Up!")).toBeInTheDocument();
    expect(global.HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });

  test('hides target-time toggle while timer is running', () => {
    renderWithModal(<Timer />);

    expect(screen.getByRole('button', { name: /set target time/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /start/i }));

    expect(screen.queryByRole('button', { name: /set target time/i })).not.toBeInTheDocument();
  });

  describe('state machine', () => {
    // The countdown state lives in a discriminated union, so these walk every
    // transition and every restore branch, checking that the end-of-timer sound
    // fires exactly once per finish — never zero times, never twice.
    const playSpy = () => global.HTMLMediaElement.prototype.play as ReturnType<typeof vi.fn>;

    const runningPayload = (endTime: number) => ({
      endTime,
      initialTime: 10,
      originalTime: 10,
      isRunning: true,
      isPaused: false,
      pausedTimeRemaining: 0
    });

    test('walks idle to running to paused to running to finished, sounding the alarm once', () => {
      renderWithModal(<Timer />);

      expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /start/i }));

      expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(getByExactText('7')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /pause/i }));

      expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /pause/i })).not.toBeInTheDocument();
      expect(getByExactText('00:00:07')).toBeInTheDocument();

      // A paused timer must not consume its remaining seconds.
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(getByExactText('00:00:07')).toBeInTheDocument();
      expect(playSpy()).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: /resume/i }));

      expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(7000);
      });

      expect(screen.getByText("Time's Up!")).toBeInTheDocument();
      expect(playSpy()).toHaveBeenCalledTimes(1);

      // A finished timer must not leave a tick scheduled that fires again later.
      act(() => {
        vi.advanceTimersByTime(20000);
      });

      expect(playSpy()).toHaveBeenCalledTimes(1);
    });

    test('restart from a running timer returns to idle and cancels the countdown', () => {
      renderWithModal(<Timer />);

      fireEvent.click(screen.getByRole('button', { name: /start/i }));

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      fireEvent.click(screen.getByRole('button', { name: /restart/i }));

      expect(getByExactText('00:00:10')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(20000);
      });

      expect(playSpy()).not.toHaveBeenCalled();
      expect(screen.queryByText("Time's Up!")).not.toBeInTheDocument();
    });

    test('restart from a paused timer returns to idle', () => {
      renderWithModal(<Timer />);

      fireEvent.click(screen.getByRole('button', { name: /start/i }));

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      fireEvent.click(screen.getByRole('button', { name: /pause/i }));
      fireEvent.click(screen.getByRole('button', { name: /restart/i }));

      expect(getByExactText('00:00:10')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(20000);
      });

      expect(playSpy()).not.toHaveBeenCalled();
    });

    test('restart from a finished timer returns to idle without re-sounding', () => {
      renderWithModal(<Timer />);

      fireEvent.click(screen.getByRole('button', { name: /start/i }));

      act(() => {
        vi.advanceTimersByTime(11000);
      });

      expect(playSpy()).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: /restart/i }));

      expect(getByExactText('00:00:10')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(20000);
      });

      expect(playSpy()).toHaveBeenCalledTimes(1);
    });

    test('setting a target time from idle resets the countdown', () => {
      renderWithModal(<Timer />);

      act(() => {
        fireEvent.click(screen.getByRole('button', { name: /set target time/i }));
      });

      act(() => {
        fireEvent.change(screen.getByRole('combobox', { name: /target hour/i }), { target: { value: '2' } });
        fireEvent.change(screen.getByRole('combobox', { name: /target minute/i }), { target: { value: '5' } });
        fireEvent.click(screen.getByRole('button', { name: 'PM' }));
      });

      act(() => {
        fireEvent.click(screen.getByRole('button', { name: /^set$/i }));
      });

      expect(getByExactText('00:05:00')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(20000);
      });

      expect(playSpy()).not.toHaveBeenCalled();
    });

    test('restores a running timer with time left and finishes it exactly once', () => {
      const onStateChange = vi.fn();
      const endTime = Date.now() + 5000;

      renderWithModal(
        <Timer savedState={{ timer: runningPayload(endTime) }} onStateChange={onStateChange} />
      );

      expect(getByExactText('5')).toBeInTheDocument();
      expect(playSpy()).not.toHaveBeenCalled();
      expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({
        timer: expect.objectContaining({
          endTime,
          isRunning: true,
          isPaused: false,
          timerFinished: false
        })
      }));

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(screen.getByText("Time's Up!")).toBeInTheDocument();
      expect(playSpy()).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(20000);
      });

      expect(playSpy()).toHaveBeenCalledTimes(1);
    });

    test('restores a running timer that expired while the tab was closed and sounds once', () => {
      renderWithModal(<Timer savedState={{ timer: runningPayload(Date.now() - 3000) }} />);

      expect(screen.getByText("Time's Up!")).toBeInTheDocument();
      // The pending notification is deferred to a macrotask so it survives a
      // StrictMode double-mount without firing twice.
      expect(playSpy()).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(0);
      });

      expect(playSpy()).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(20000);
      });

      expect(playSpy()).toHaveBeenCalledTimes(1);
    });

    test('restores a paused timer without resuming or sounding', () => {
      const onStateChange = vi.fn();

      renderWithModal(<Timer savedState={{
        timer: {
          endTime: null,
          initialTime: 60,
          originalTime: 60,
          isRunning: false,
          isPaused: true,
          pausedTimeRemaining: 25
        },
        segmentValues: ['00', '00', '25']
      }} onStateChange={onStateChange} />);

      expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument();
      expect(getByExactText('00:00:25')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(20000);
      });

      expect(getByExactText('00:00:25')).toBeInTheDocument();
      expect(playSpy()).not.toHaveBeenCalled();
      expect(onStateChange).toHaveBeenLastCalledWith(expect.objectContaining({
        timer: expect.objectContaining({
          endTime: null,
          isRunning: false,
          isPaused: true,
          timerFinished: false,
          pausedTimeRemaining: 25
        })
      }));
    });

    test('restores a finished timer silently and keeps it finished', () => {
      renderWithModal(<Timer savedState={{ timer: {
        endTime: null,
        initialTime: 10,
        originalTime: 10,
        isRunning: false,
        isPaused: false,
        pausedTimeRemaining: 0,
        timerFinished: true
      } }} />);

      expect(screen.getByText("Time's Up!")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(20000);
      });

      expect(playSpy()).not.toHaveBeenCalled();
    });

    test('restores an old payload that predates the timerFinished flag', () => {
      // Payloads written before `timerFinished` existed omit the key entirely;
      // a running one that has already expired still owes exactly one alarm.
      const legacyPayload = {
        endTime: Date.now() - 2000,
        initialTime: 10,
        originalTime: 10,
        isRunning: true,
        isPaused: false,
        pausedTimeRemaining: 0
      };

      expect('timerFinished' in legacyPayload).toBe(false);

      renderWithModal(<Timer savedState={{ timer: legacyPayload }} />);

      act(() => {
        vi.advanceTimersByTime(0);
      });

      expect(screen.getByText("Time's Up!")).toBeInTheDocument();
      expect(playSpy()).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(20000);
      });

      expect(playSpy()).toHaveBeenCalledTimes(1);
    });

    test('restores a contradictory old payload into exactly one state', () => {
      // Independent booleans allowed combinations the union cannot express;
      // a stored running-and-paused payload has to land in one of them.
      renderWithModal(<Timer savedState={{ timer: {
        endTime: Date.now() + 5000,
        initialTime: 10,
        originalTime: 10,
        isRunning: true,
        isPaused: true,
        pausedTimeRemaining: 25,
        timerFinished: true
      } }} />);

      expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /resume/i })).not.toBeInTheDocument();
      expect(screen.queryByText("Time's Up!")).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(screen.getByText("Time's Up!")).toBeInTheDocument();
      expect(playSpy()).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(20000);
      });

      expect(playSpy()).toHaveBeenCalledTimes(1);
    });

    test('restores a running payload with no deadline as idle rather than finished', () => {
      renderWithModal(<Timer savedState={{ timer: {
        endTime: null,
        initialTime: 10,
        originalTime: 10,
        isRunning: true,
        isPaused: false,
        pausedTimeRemaining: 0
      } }} />);

      expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();
      expect(screen.queryByText("Time's Up!")).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(20000);
      });

      expect(playSpy()).not.toHaveBeenCalled();
    });
  });
});
