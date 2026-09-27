import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Issue #78: rooms now outlive the widget component, so a widget can mount
// over a room that already exists (layout switch, compact overlay, reload),
// and SessionContext retires a widget's recovery snapshot once it has seen it.
// A new room is started automatically; ways that could go wrong:
//  1. A widget that remounts over an existing, paused room starts it again.
//  2. A widget restored after a reload starts its paused room again as soon
//     as its recovery snapshot is retired.
//  3. A room the teacher has just created is no longer started automatically.

const session = vi.hoisted(() => ({
  activeRooms: new Map<string, any>(),
  updateRoomState: vi.fn()
}));

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => session
}));

vi.mock('./useSocketEvents', () => ({
  useSocketEvents: () => ({ emit: vi.fn(), emitWithAck: vi.fn() })
}));

import { useNetworkedWidgetState } from './useNetworkedWidgetState';

type Props = { hasRoom: boolean; recoveryData: any };
const render = (initialProps: Props) => renderHook(
  ({ hasRoom, recoveryData }: Props) =>
    useNetworkedWidgetState({ widgetId: 'poll-1', roomType: 'poll', hasRoom, recoveryData }),
  { initialProps }
);

const pausedSnapshot = { roomData: { isActive: false } };

beforeEach(() => {
  session.activeRooms = new Map();
  session.updateRoomState.mockClear();
});

describe('useNetworkedWidgetState auto-start', () => {
  it('does not restart a paused room it remounts over (1)', () => {
    session.activeRooms.set('poll-1', { roomType: 'poll', widgetId: 'poll-1', isActive: false });

    const { result } = render({ hasRoom: true, recoveryData: null });

    expect(session.updateRoomState).not.toHaveBeenCalled();
    expect(result.current.isActive).toBe(false);
  });

  it('does not restart a recovered paused room once its snapshot is retired (2)', () => {
    const { rerender, result } = render({ hasRoom: false, recoveryData: null });

    rerender({ hasRoom: true, recoveryData: pausedSnapshot });
    rerender({ hasRoom: true, recoveryData: null });

    expect(session.updateRoomState).not.toHaveBeenCalled();
    expect(result.current.isActive).toBe(false);
  });

  it('starts a room the teacher has just created (3)', () => {
    const { rerender } = render({ hasRoom: false, recoveryData: null });

    rerender({ hasRoom: true, recoveryData: null });

    expect(session.updateRoomState).toHaveBeenCalledTimes(1);
    expect(session.updateRoomState).toHaveBeenCalledWith('poll', 'poll-1', true);
  });
});
