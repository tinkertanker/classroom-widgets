import { useEffect, useRef, useState } from 'react';
import type { TimerComponent } from '@classroom-widgets/widget-spec';

interface TimerRendererProps {
  component: TimerComponent;
}

export function TimerRenderer({ component }: TimerRendererProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(component.durationSeconds);
  const [running, setRunning] = useState(false);
  const deadline = useRef<number>();

  useEffect(() => {
    deadline.current = undefined;
    setRemainingSeconds(component.durationSeconds);
    setRunning(false);
  }, [component]);

  useEffect(() => {
    if (!running) return undefined;

    function updateFromClock() {
      const target = deadline.current;
      if (target === undefined) return;
      const next = Math.max(0, Math.ceil((target - Date.now()) / 1_000));
      setRemainingSeconds(next);
      if (next === 0) {
        deadline.current = undefined;
        setRunning(false);
      }
    }

    updateFromClock();
    const interval = window.setInterval(updateFromClock, 250);
    return () => window.clearInterval(interval);
  }, [running]);

  function start() {
    const next = remainingSeconds === 0 ? component.durationSeconds : remainingSeconds;
    setRemainingSeconds(next);
    deadline.current = Date.now() + next * 1_000;
    setRunning(true);
  }

  function pause() {
    const target = deadline.current;
    if (target !== undefined) {
      setRemainingSeconds(Math.max(0, Math.ceil((target - Date.now()) / 1_000)));
    }
    deadline.current = undefined;
    setRunning(false);
  }

  function reset() {
    deadline.current = undefined;
    setRemainingSeconds(component.durationSeconds);
    setRunning(false);
  }

  const complete = remainingSeconds === 0;

  return (
    <section className="ready-tool timer-tool" aria-labelledby={`${component.id}-title`}>
      <h2 id={`${component.id}-title`}>{component.label}</h2>
      <output
        className="timer-display"
        role="timer"
        aria-label={`${component.label}: ${formatDuration(remainingSeconds)}`}
      >
        {formatDuration(remainingSeconds)}
      </output>
      <div className="ready-tool-actions">
        <button
          className="primary-action"
          type="button"
          onClick={running ? pause : start}
        >
          {running ? 'Pause' : complete ? 'Start again' : 'Start'}
        </button>
        <button
          className="secondary-action"
          type="button"
          disabled={!running && remainingSeconds === component.durationSeconds}
          onClick={reset}
        >
          Reset
        </button>
      </div>
      {complete ? (
        <p className="ready-tool-message" role="status" aria-live="polite">
          {component.completionMessage}
        </p>
      ) : null}
    </section>
  );
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const clock = `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;
  return hours > 0 ? `${hours.toString().padStart(2, '0')}:${clock}` : clock;
}
