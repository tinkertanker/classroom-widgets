import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Regression coverage for T5-A and T5-B:
//  - T5-A: `isConnecting` was wired to a `socket.io-client` event that is never
//    emitted, and the recovery lifecycle was spread over two booleans and two
//    refs. Both are now a single `connectionPhase` union in real state.
//  - T5-B: `activeRooms` and `participantCounts` were parallel Maps kept in sync
//    by hand, and participant updates were written without checking that a room
//    existed. The count now lives on the room entry.

const storeState = vi.hoisted(() => ({
  current: {
    sessionCode: null as string | null,
    sessionCreatedAt: null as number | null,
    setSessionCode: (_code: string | null) => {},
    serverStatus: { url: 'http://localhost:3001' },
    widgets: [] as any[]
  }
}));

const socketState = vi.hoisted(() => ({ current: null as any }));

vi.mock('../store/workspaceStore.simple', () => {
  const useWorkspaceStore = (selector: (state: any) => any) => selector(storeState.current);
  useWorkspaceStore.getState = () => storeState.current;
  return { useWorkspaceStore };
});

vi.mock('../hooks/useSocket', () => ({
  useSocket: () => ({ socket: socketState.current })
}));

import { SessionProvider, useSession, isRecoverySettled } from './SessionContext';

interface EmittedCall {
  event: string;
  data: any;
  ack?: (response: any) => void;
}

class FakeSocket {
  connected = false;
  handlers = new Map<string, Set<(payload?: any) => void>>();
  emitted: EmittedCall[] = [];

  on(event: string, fn: (payload?: any) => void) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(fn);
  }

  off(event: string, fn: (payload?: any) => void) {
    this.handlers.get(event)?.delete(fn);
  }

  emit(event: string, data: any, ack?: (response: any) => void) {
    this.emitted.push({ event, data, ack });
  }

  /** Deliver a server-sent event to the provider's listeners. */
  fire(event: string, payload?: any) {
    this.handlers.get(event)?.forEach(fn => fn(payload));
  }

  listenerCount(event: string) {
    return this.handlers.get(event)?.size ?? 0;
  }

  /** The acknowledgement callback of the most recent emit of `event`. */
  ackFor(event: string) {
    for (let i = this.emitted.length - 1; i >= 0; i--) {
      if (this.emitted[i].event === event) return this.emitted[i].ack;
    }
    return undefined;
  }
}

let socket: FakeSocket;
let session: ReturnType<typeof useSession>;

const Probe: React.FC = () => {
  session = useSession();
  return null;
};

const renderSession = () =>
  render(
    <SessionProvider>
      <Probe />
    </SessionProvider>
  );

const connect = () => {
  act(() => {
    socket.connected = true;
    socket.fire('connect');
  });
};

const roomOf = (widgetId: string) => session.activeRooms.get(widgetId);

beforeEach(() => {
  socket = new FakeSocket();
  socketState.current = socket;
  storeState.current.sessionCode = null;
  storeState.current.sessionCreatedAt = null;
  storeState.current.widgets = [];
});

describe('SessionContext room + participant state (T5-B)', () => {
  it('reflects a participant count that arrives for a known room', () => {
    renderSession();
    connect();

    act(() => {
      socket.fire('session:roomCreated', {
        roomType: 'poll',
        widgetId: 'widget-1',
        roomData: { isActive: true, participantCount: 0 }
      });
    });
    expect(roomOf('widget-1')?.participantCount).toBe(0);

    act(() => {
      socket.fire('session:participantUpdate', { count: 3, roomType: 'poll', widgetId: 'widget-1' });
    });

    expect(roomOf('widget-1')?.participantCount).toBe(3);
    // patching the count must not disturb the rest of the room entry
    expect(roomOf('widget-1')?.isActive).toBe(true);
    expect(roomOf('widget-1')?.roomType).toBe('poll');
  });

  it('ignores a participant count for a widgetId with no room instead of orphaning it', () => {
    renderSession();
    connect();

    act(() => {
      socket.fire('session:participantUpdate', { count: 5, roomType: 'poll', widgetId: 'ghost-widget' });
    });

    expect(session.activeRooms.has('ghost-widget')).toBe(false);
    expect(session.activeRooms.size).toBe(0);
  });

  it('ignores session-level participant updates that carry no widgetId', () => {
    renderSession();
    connect();

    act(() => {
      socket.fire('session:roomCreated', {
        roomType: 'poll',
        widgetId: 'widget-1',
        roomData: { isActive: false, participantCount: 2 }
      });
    });
    act(() => {
      socket.fire('session:participantUpdate', { count: 7, roomType: 'poll' });
    });

    expect(session.activeRooms.size).toBe(1);
    expect(roomOf('widget-1')?.participantCount).toBe(2);
  });

  it('leaves no stale participant count behind when a room closes', () => {
    renderSession();
    connect();

    act(() => {
      socket.fire('session:roomCreated', {
        roomType: 'poll',
        widgetId: 'widget-1',
        roomData: { isActive: true, participantCount: 0 }
      });
    });
    act(() => {
      socket.fire('session:participantUpdate', { count: 4, roomType: 'poll', widgetId: 'widget-1' });
    });
    expect(roomOf('widget-1')?.participantCount).toBe(4);

    act(() => {
      socket.fire('session:roomClosed', { roomType: 'poll', widgetId: 'widget-1' });
    });
    expect(session.activeRooms.has('widget-1')).toBe(false);

    // a later count for the closed room cannot resurrect it...
    act(() => {
      socket.fire('session:participantUpdate', { count: 4, roomType: 'poll', widgetId: 'widget-1' });
    });
    expect(session.activeRooms.has('widget-1')).toBe(false);

    // ...and reopening the room starts from the server's count, not the old one
    act(() => {
      socket.fire('session:roomCreated', {
        roomType: 'poll',
        widgetId: 'widget-1',
        roomData: { isActive: true, participantCount: 0 }
      });
    });
    expect(roomOf('widget-1')?.participantCount).toBe(0);
  });

  it('exposes no separate participantCounts map', () => {
    renderSession();
    expect('participantCounts' in session).toBe(false);
  });
});

describe('SessionContext connection phase (T5-A)', () => {
  it('starts disconnected and tracks plain connect/disconnect with no session to recover', () => {
    renderSession();
    expect(session.connectionPhase).toBe('disconnected');
    expect(session.isConnected).toBe(false);

    connect();
    expect(session.connectionPhase).toBe('connected');
    expect(session.isConnected).toBe(true);
    expect(session.isRecovering).toBe(false);
    expect(isRecoverySettled(session.connectionPhase)).toBe(false);
    // no session to recover, so nothing was emitted
    expect(socket.ackFor('session:create')).toBeUndefined();

    act(() => {
      socket.connected = false;
      socket.fire('disconnect');
    });
    expect(session.connectionPhase).toBe('disconnected');
    expect(session.isConnected).toBe(false);
  });

  it('goes connected -> recovering -> recovered when a stored session is rejoined', async () => {
    storeState.current.sessionCode = 'ABC123';
    storeState.current.sessionCreatedAt = Date.now();
    renderSession();

    connect();
    expect(session.connectionPhase).toBe('recovering');
    expect(session.isConnected).toBe(true);
    expect(session.isRecovering).toBe(true);
    // still in flight: widgets must not conclude "no room for me" yet
    expect(isRecoverySettled(session.connectionPhase)).toBe(false);

    const ack = socket.ackFor('session:create');
    expect(ack).toBeTypeOf('function');
    await act(async () => {
      ack!({
        success: true,
        isExisting: true,
        activeRooms: [
          { roomType: 'poll', widgetId: 'widget-1', room: { isActive: true, participantCount: 2 } }
        ]
      });
    });

    expect(session.connectionPhase).toBe('recovered');
    expect(session.isRecovering).toBe(false);
    expect(isRecoverySettled(session.connectionPhase)).toBe(true);
    // the recovered room carries its participant count with it
    expect(roomOf('widget-1')?.participantCount).toBe(2);
  });

  it('goes to recovery-failed when the server rejects the rejoin', async () => {
    storeState.current.sessionCode = 'ABC123';
    storeState.current.sessionCreatedAt = Date.now();
    renderSession();

    connect();
    expect(session.connectionPhase).toBe('recovering');

    await act(async () => {
      socket.ackFor('session:create')!({ success: false, error: 'Session not found' });
    });

    expect(session.connectionPhase).toBe('recovery-failed');
    expect(session.isRecovering).toBe(false);
    // settled, so widgets may now treat "no recovery data" as "no room"
    expect(isRecoverySettled(session.connectionPhase)).toBe(true);
    expect(session.sessionCode).toBeNull();
  });

  it('re-attempts recovery after a reconnect', async () => {
    storeState.current.sessionCode = 'ABC123';
    storeState.current.sessionCreatedAt = Date.now();
    renderSession();

    connect();
    await act(async () => {
      socket.ackFor('session:create')!({ success: true, isExisting: true, activeRooms: [] });
    });
    expect(session.connectionPhase).toBe('recovered');
    const attemptsBefore = socket.emitted.filter(c => c.event === 'session:create').length;

    act(() => {
      socket.connected = false;
      socket.fire('disconnect');
    });
    expect(session.connectionPhase).toBe('disconnected');

    connect();
    expect(session.connectionPhase).toBe('recovering');
    expect(socket.emitted.filter(c => c.event === 'session:create').length).toBe(attemptsBefore + 1);
  });

  it('stays disconnected if the socket drops while recovery is still in flight', async () => {
    storeState.current.sessionCode = 'ABC123';
    storeState.current.sessionCreatedAt = Date.now();
    renderSession();

    connect();
    expect(session.connectionPhase).toBe('recovering');

    act(() => {
      socket.connected = false;
      socket.fire('disconnect');
    });
    expect(session.connectionPhase).toBe('disconnected');

    // a late answer from the dead connection must not claim we are connected
    await act(async () => {
      socket.ackFor('session:create')!({ success: true, isExisting: true, activeRooms: [] });
    });
    expect(session.connectionPhase).toBe('disconnected');
    expect(session.isConnected).toBe(false);
  });

  it('has no isConnecting flag left, on the context or on the socket', () => {
    renderSession();
    connect();

    expect('isConnecting' in session).toBe(false);
    // socket.io-client never emits 'connecting', so nothing should subscribe to it
    expect(socket.listenerCount('connecting')).toBe(0);
    expect(socket.listenerCount('connect')).toBe(1);
    expect(socket.listenerCount('disconnect')).toBe(1);
  });
});
