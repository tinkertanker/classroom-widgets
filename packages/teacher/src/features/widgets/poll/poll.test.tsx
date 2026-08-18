import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Poll from './poll';

// Regression coverage for T6-B: the "start poll" gate and the button's
// disabled state used two different predicates (>=2 filled options vs.
// "not all empty"), so a poll with exactly one filled option rendered an
// enabled button that silently did nothing when clicked.

const toggleActive = vi.fn();
const emit = vi.fn();

vi.mock('../../../contexts/ModalContext', () => ({
  useModal: () => ({ showModal: vi.fn(), hideModal: vi.fn() })
}));

vi.mock('../../session/hooks/useNetworkedWidget', () => ({
  useNetworkedWidget: () => ({
    hasRoom: true,
    isStarting: false,
    error: null,
    handleStart: vi.fn(),
    session: {
      // socket is intentionally null: it only gates an unrelated "send
      // initial poll data" effect, and keeping it null avoids that
      // effect's timer outliving the test.
      socket: null,
      sessionCode: 'ABC123',
      participantCount: 0,
      isConnected: true,
      isRecovering: false
    },
    recoveryData: null
  })
}));

vi.mock('../../session/hooks/useNetworkedWidgetState', () => ({
  useNetworkedWidgetState: () => ({
    isActive: false,
    toggleActive,
    setIsActive: vi.fn()
  })
}));

vi.mock('../../session/hooks/useSocketEvents', () => ({
  useSocketEvents: () => ({ emit })
}));

vi.mock('../shared/components', () => ({
  NetworkedWidgetControlBar: ({ onToggleActive, disabled, inactiveLabel }: any) => (
    <button onClick={onToggleActive} disabled={disabled}>{inactiveLabel}</button>
  ),
  NetworkedWidgetOverlays: () => null,
  NetworkedWidgetStats: ({ children }: any) => <div>{children}</div>
}));

function renderPoll(options: string[]) {
  return render(
    <Poll
      widgetId="widget-1"
      savedState={{ pollData: { question: 'Favourite colour?', options } }}
    />
  );
}

describe('Poll start gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks starting a poll with only one filled option', async () => {
    renderPoll(['Red', '']);

    const button = screen.getByRole('button', { name: /start poll/i });
    expect(button).toBeDisabled();

    await userEvent.click(button);
    expect(toggleActive).not.toHaveBeenCalled();
  });

  it('allows starting a poll with two filled options and fires the start path', async () => {
    renderPoll(['Red', 'Blue']);

    const button = screen.getByRole('button', { name: /start poll/i });
    expect(button).not.toBeDisabled();

    await userEvent.click(button);
    expect(toggleActive).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('session:poll:update', expect.objectContaining({
      widgetId: 'widget-1',
      sessionCode: 'ABC123'
    }));
  });

  it('does not count whitespace-only options as filled', () => {
    renderPoll(['Red', '   ']);

    expect(screen.getByRole('button', { name: /start poll/i })).toBeDisabled();
  });
});
