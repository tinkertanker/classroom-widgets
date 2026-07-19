import { act, fireEvent, render, screen } from '@testing-library/react';
import { isWidgetSpec, type WidgetSpec } from '@classroom-widgets/widget-spec';

import classroomRoutinesSource from '../../../examples/studio/classroom-routines-toolkit.widget.json';
import { WidgetPlayer } from './WidgetPlayer';

const classroomRoutines = classroomRoutinesSource as unknown as WidgetSpec;

describe('ready-made classroom tools', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a validated fixture containing every ready-made V1 tool', () => {
    expect(isWidgetSpec(classroomRoutinesSource)).toBe(true);
    render(<WidgetPlayer spec={classroomRoutines} />);

    expect(screen.getByRole('timer', { name: /Settle-in time/ })).toHaveTextContent('05:00');
    expect(screen.getByRole('heading', { name: /Choose how we will discuss/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Before you begin' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'How ready are you to begin?' })).toBeInTheDocument();
  });

  it('counts down against the clock and announces completion', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-18T00:00:00.000Z'));
    render(<WidgetPlayer spec={classroomRoutines} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    act(() => {
      vi.advanceTimersByTime(300_000);
    });

    expect(screen.getByRole('timer', { name: /Settle-in time/ })).toHaveTextContent('00:00');
    expect(
      screen.getByText('Time is up. Face the front and get ready for the next instruction.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start again' })).toBeEnabled();
  });

  it('draws every non-repeating option once and can reset the pool', () => {
    render(<WidgetPlayer spec={classroomRoutines} />);
    const choose = screen.getByRole('button', { name: 'Choose' });

    for (let draw = 0; draw < 4; draw += 1) fireEvent.click(choose);

    expect(choose).toBeDisabled();
    expect(screen.getByText(/Every option has been chosen/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reset choices' }));
    expect(choose).toBeEnabled();
  });

  it('tracks checklist progress and exposes traffic-light state through native buttons', () => {
    render(<WidgetPlayer spec={classroomRoutines} />);

    fireEvent.click(screen.getByRole('checkbox', { name: /Place the required materials/ }));
    expect(screen.getByRole('status', { name: '1 of 3 complete' })).toBeInTheDocument();

    const amber = screen.getByRole('button', { name: 'I am nearly ready' });
    const green = screen.getByRole('button', { name: 'I am ready to begin' });
    expect(amber).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(green);
    expect(green).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Current signal: I am ready to begin')).toBeInTheDocument();
  });
});
