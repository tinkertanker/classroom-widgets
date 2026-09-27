import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { WidgetType } from '@shared/types';

const storeState = vi.hoisted(() => ({
  current: {
    sessionCode: null as string | null,
    sessionCreatedAt: null as number | null,
    setSessionCode: vi.fn(),
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
vi.mock('../hooks/useSocket', () => ({ useSocket: () => ({ socket: socketState.current }) }));

import { SessionProvider, useSession, isRecoverySettled } from './SessionContext';
import SessionBanner from '../features/session/components/SessionBanner';

// Exercise the real handler, IP budget, manager, session and room models. Only
// transport and the workspace store are mocked, not the rejection or reclaim.
process.env.LOG_LEVEL = 'error';
const require = createRequire(import.meta.url);
const sessionHandler = require('../../../server/src/sockets/handlers/sessionHandler.js');
const Session = require('../../../server/src/models/Session.js');
const SessionManager = require('../../../server/src/services/SessionManager.js');
const { stopRateLimiterCleanup } = require('../../../server/src/middleware/socketAuth.js');

const TOKEN_KEY = 'classroom-widgets:hostToken';
const TOKEN_CODE_KEY = 'classroom-widgets:hostTokenCode';
const CODE = 'BCDFGH';
let ipSequence = 0;

interface Request {
  event: string;
  data: any;
  ack?: (response: any) => void;
}

class FakeSocket {
  connected = false;
  handlers = new Map<string, Set<() => void>>();
  emitted: Request[] = [];

  on(event: string, fn: () => void) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(fn);
  }
  off(event: string, fn: () => void) { this.handlers.get(event)?.delete(fn); }
  emit(event: string, data: any, ack?: (response: any) => void) {
    this.emitted.push({ event, data, ack });
  }
  fire(event: string) { this.handlers.get(event)?.forEach(fn => fn()); }
  requests() { return this.emitted.filter(call => call.event === 'session:create'); }
  request() { return this.requests().at(-1)!; }
}

function serverFixture() {
  const ip = `192.0.2.${++ipSequence}`;
  const manager = new SessionManager();
  const session = new Session(CODE);
  manager.sessions.set(CODE, session);
  session.hostSocketId = 'original-host';
  const room = session.createRoom('poll', 'poll-1');
  room.isActive = true;
  room.setPollData({ question: 'Choose a number', options: ['Two', 'Three', 'Five'] });
  for (const [id, name, choice] of [['student-a', 'Ada', 2], ['student-b', 'Bo', 0]] as const) {
    session.addParticipant(id, name, `device-${id}`);
    room.addParticipant(id, { name });
    room.vote(id, choice);
  }
  const io = {
    to: () => ({ emit: vi.fn() }),
    sockets: { adapter: { rooms: new Map() }, sockets: new Map() }
  };
  let sequence = 0;
  const peer = () => {
    const handlers = new Map<string, Function>();
    const socket = {
      id: `host-${++sequence}`,
      clientIP: ip,
      handshake: { headers: {}, secure: false },
      on: (event: string, handler: Function) => handlers.set(event, handler),
      join: vi.fn()
    };
    sessionHandler(io, socket, manager, () => null);
    return {
      socket,
      create: (data: any): Promise<any> => new Promise(resolve => handlers.get('session:create')!(data, resolve)),
      createRoom: (data: any): Promise<any> => new Promise(resolve => handlers.get('session:createRoom')!(data, resolve))
    };
  };
  return { manager, session, room, peer };
}

let socket: FakeSocket;
let server: ReturnType<typeof serverFixture>;
let peer: ReturnType<typeof server.peer>;
let context: ReturnType<typeof useSession>;
const Probe = () => { context = useSession(); return null; };
const mount = () => render(<SessionProvider><Probe /><SessionBanner /></SessionProvider>);
const connect = () => {
  peer = server.peer();
  act(() => { socket.connected = true; socket.fire('connect'); });
};
const disconnect = () => act(() => { socket.connected = false; socket.fire('disconnect'); });
const advance = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const acknowledge = async (response: any, request = socket.request()) => {
  await act(async () => { request.ack!(response); });
};
const respond = async () => {
  const response = await peer.create(socket.request().data);
  await acknowledge(response);
  return response;
};
const spendBudget = async (count: number) => {
  for (let i = 0; i < count; i++) {
    expect((await server.peer().create({})).success).toBe(true);
  }
};
const recoverOnce = async () => {
  connect();
  expect((await respond()).isExisting).toBe(true);
  expect(context.connectionPhase).toBe('recovered');
};
const throttleReconnect = async () => {
  await recoverOnce();
  disconnect();
  await spendBudget(29);
  connect();
  const response = await respond();
  expect(response).toEqual({
    success: false,
    error: 'Too many session requests. Please try again later.',
    retryAfter: 60_000
  });
};
const deferRecovery = async () => {
  await throttleReconnect();
  for (let attempt = 2; attempt <= 3; attempt++) {
    await advance(60_001);
    await spendBudget(30);
    expect((await respond()).retryAfter).toBe(60_000);
  }
  expect(context.connectionPhase).toBe('recovery-deferred');
  expect(socket.requests()).toHaveLength(4);
};
const expectPreserved = () => {
  expect(context.sessionCode).toBe(CODE);
  expect(context.activeRooms.get('poll-1')?.participantCount).toBe(2);
  expect(context.getWidgetRecoveryData('poll-1')?.roomData.pollData.votes).toEqual({ 0: 1, 1: 0, 2: 1 });
  expect(localStorage.getItem(TOKEN_KEY)).toBe(server.session.hostToken);
  expect(storeState.current.setSessionCode).not.toHaveBeenCalledWith(null);
  expect(screen.getAllByText(CODE)).toHaveLength(2); // Both responsive banner layouts retain the code.
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-20T01:00:00Z'));
  localStorage.clear();
  socket = new FakeSocket();
  socketState.current = socket;
  server = serverFixture();
  storeState.current.sessionCode = CODE;
  storeState.current.sessionCreatedAt = Date.now();
  storeState.current.setSessionCode.mockClear();
  storeState.current.widgets = [{ id: 'poll-1', type: WidgetType.POLL }];
  localStorage.setItem(TOKEN_KEY, server.session.hostToken);
});
afterEach(() => {
  cleanup();
  server.manager.stopCleanupInterval();
  vi.useRealTimers();
});
afterAll(stopRateLimiterCleanup);

describe('SessionContext recovery with the real session:create handler (#157)', () => {
  it('preserves state and waits past the millisecond window boundary before reclaiming rooms and students', async () => {
    mount();
    await recoverOnce();
    const token = localStorage.getItem(TOKEN_KEY);
    disconnect();
    await spendBudget(29);
    await advance(12_345);
    connect();
    const response = await respond();
    expect(response.retryAfter).toBe(47_655);
    expect(context.connectionPhase).toBe('recovering');
    expectPreserved();

    await advance(47_654);
    expect(socket.requests()).toHaveLength(2);
    await advance(1);
    // The limiter resets at age > windowMs, not >= windowMs.
    expect(socket.requests()).toHaveLength(2);
    await advance(1);
    expect(socket.requests()).toHaveLength(3);
    expect(socket.request().data).toEqual({ existingCode: CODE, hostToken: token, reclaimOnly: true });
    expect((await respond()).isExisting).toBe(true);

    expect(context.connectionPhase).toBe('recovered');
    expectPreserved();
    expect(server.manager.getSession(CODE)).toBe(server.session);
    expect(server.session.getRoom('poll', 'poll-1')).toBe(server.room);
    expect(server.session.getParticipants().map((student: any) => student.name)).toEqual(['Ada', 'Bo']);
    expect(server.room.getParticipantCount()).toBe(2);
    expect(localStorage.getItem(TOKEN_KEY)).not.toBe(token);
    expect(peer.socket.join).toHaveBeenCalledWith(`${CODE}:poll:poll-1`);
    // The presented token keeps reclaiming until delivery of the new one is
    // confirmed (here: the recovered client's first host event), then stops.
    expect(server.session.isValidHostToken(token)).toBe(true);
    await peer.createRoom({ sessionCode: CODE, roomType: 'poll', widgetId: 'poll-1' });
    expect(server.session.isValidHostToken(token)).toBe(false);
    expect(server.session.isValidHostToken(localStorage.getItem(TOKEN_KEY))).toBe(true);
  });

  it('does not spin or clear state when the exact window boundary returns retryAfter: 0', async () => {
    mount();
    await recoverOnce();
    disconnect();
    await spendBudget(29);
    await advance(60_000);
    connect();
    expect((await respond()).retryAfter).toBe(0);
    expectPreserved();
    await advance(999);
    expect(socket.requests()).toHaveLength(2);
    await advance(1);
    expect(socket.requests()).toHaveLength(3);
    expect((await respond()).isExisting).toBe(true);
    expectPreserved();
  });

  it('stops after three throttled attempts, settles room waiters, and can recover on a later reconnect', async () => {
    mount();
    await throttleReconnect();
    const roomResult = vi.fn();
    void context.createRoom('questions', 'waiting-widget').then(roomResult);
    for (let attempt = 2; attempt <= 3; attempt++) {
      await advance(60_001);
      // Other hosts win the next window before this request reaches the handler.
      await spendBudget(30);
      expect((await respond()).retryAfter).toBe(60_000);
    }
    expect(socket.requests()).toHaveLength(4); // Initial recovery + three attempts.
    expect(context.connectionPhase).toBe('recovery-deferred');
    expect(isRecoverySettled(context.connectionPhase)).toBe(false);
    expect(context.isRecovering).toBe(false);
    expect(roomResult).toHaveBeenCalledWith(false);
    expect(socket.emitted.some(call => call.event === 'session:createRoom')).toBe(false);
    expectPreserved();
    await advance(300_000);
    expect(socket.requests()).toHaveLength(4);
    disconnect();
    await recoverOnce();
    expectPreserved();
  });

  it('offers a visible retry while transport stays connected and recovers the same classroom through the banner', async () => {
    mount();
    connect();
    expect(screen.getByRole('status')).toHaveTextContent('Reconnecting to session');
    expect(screen.queryByTitle('Connected to server')).not.toBeInTheDocument();
    await respond();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByTitle('Connected to server')).toBeInTheDocument();
    disconnect();
    // Start a separate run with the same real per-IP budget, now already used once.
    await spendBudget(29);
    connect();
    await respond();
    for (let attempt = 2; attempt <= 3; attempt++) {
      await advance(60_001);
      await spendBudget(30);
      await respond();
    }
    expect(screen.getByRole('status')).toHaveTextContent('Session recovery paused');
    const retry = screen.getByRole('button', { name: 'Retry session recovery' });
    expect(retry).toBeEnabled();
    expect(context.isConnected).toBe(true);
    expect(socket.connected).toBe(true);
    expect(screen.queryByTitle('Connected to server')).not.toBeInTheDocument();
    expectPreserved();
    const savedToken = localStorage.getItem(TOKEN_KEY);
    await advance(60_001);
    expect(socket.requests()).toHaveLength(4); // No unrequested fourth retry.

    // Two clicks in one render must not restart the run or consume two slots.
    act(() => { fireEvent.click(retry); fireEvent.click(retry); });
    expect(socket.requests()).toHaveLength(5);
    expect(socket.request().data).toEqual({ existingCode: CODE, hostToken: savedToken, reclaimOnly: true });
    expect(screen.getByRole('status')).toHaveTextContent('Reconnecting to session');
    expect(screen.getByRole('button', { name: 'Retry session recovery' })).toBeDisabled();
    expect(screen.queryByTitle('Connected to server')).not.toBeInTheDocument();
    const roomResult = vi.fn();
    void context.createRoom('poll', 'poll-1').then(roomResult);
    expect(socket.emitted.some(call => call.event === 'session:createRoom')).toBe(false);
    expect(roomResult).not.toHaveBeenCalled();
    expect(localStorage.getItem(TOKEN_KEY)).toBe(savedToken);

    expect((await respond()).isExisting).toBe(true);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry session recovery' })).not.toBeInTheDocument();
    expect(screen.getByTitle('Connected to server')).toBeInTheDocument();
    expect(socket.connected).toBe(true);
    expect(server.manager.getSession(CODE)).toBe(server.session);
    expect(server.session.getRoom('poll', 'poll-1')).toBe(server.room);
    expect(server.session.getParticipants().map((student: any) => student.name)).toEqual(['Ada', 'Bo']);
    expect(server.room.getParticipantCount()).toBe(2);
    expect(localStorage.getItem(TOKEN_KEY)).not.toBe(savedToken);
    expectPreserved();
    const roomRequest = socket.emitted.find(call => call.event === 'session:createRoom')!;
    expect(roomRequest.data.sessionCode).toBe(CODE);
    await acknowledge(await peer.createRoom(roomRequest.data), roomRequest);
    expect(roomResult).toHaveBeenCalledWith(true);
  });

  it('keeps the warning persistent and re-enables the banner retry after another bounded failure', async () => {
    mount();
    await deferRecovery();
    fireEvent.click(screen.getByRole('button', { name: 'Retry session recovery' }));
    expect((await respond()).retryAfter).toBe(60_000);
    for (let attempt = 2; attempt <= 3; attempt++) {
      expect(screen.getByRole('button', { name: 'Retry session recovery' })).toBeDisabled();
      await advance(60_001);
      await spendBudget(30);
      expect((await respond()).retryAfter).toBe(60_000);
    }
    expect(socket.requests()).toHaveLength(7);
    expect(screen.getByRole('status')).toHaveTextContent('Session recovery paused');
    expect(screen.getByRole('button', { name: 'Retry session recovery' })).toBeEnabled();
    // Collapsing the session code must not dismiss the recovery warning/action.
    fireEvent.click(screen.getByTitle('Session recovery paused'));
    await advance(180_000);
    expect(screen.getByRole('status')).toHaveTextContent('Session recovery paused');
    expect(screen.getByRole('button', { name: 'Retry session recovery' })).toBeEnabled();
    expect(socket.requests()).toHaveLength(7);
    expect(context.sessionCode).toBe(CODE);
    expect(localStorage.getItem(TOKEN_KEY)).toBe(server.session.hostToken);
    expect(socket.emitted.some(call => call.event === 'session:createRoom')).toBe(false);
  });

  it('removes the recovery warning on close and ignores an outstanding banner retry response', async () => {
    mount();
    await deferRecovery();
    await advance(60_001);
    fireEvent.click(screen.getByRole('button', { name: 'Retry session recovery' }));
    const response = await peer.create(socket.request().data);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    try {
      fireEvent.click(screen.getAllByRole('button', { name: 'Close session' })[0]);
    } finally {
      confirm.mockRestore();
    }
    await acknowledge(response);
    await advance(180_000);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry session recovery' })).not.toBeInTheDocument();
    expect(context.sessionCode).toBeNull();
    expect(context.activeRooms.size).toBe(0);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(socket.requests()).toHaveLength(5);
  });

  it('preserves recoverable state after three transport timeouts and ignores a timed-out acknowledgement', async () => {
    mount();
    await recoverOnce();
    disconnect();
    connect();
    const firstRequest = socket.request();
    const roomResult = vi.fn();
    void context.createRoom('poll', 'waiting-widget').then(roomResult);
    await advance(5_999);
    expect(socket.requests()).toHaveLength(2);
    await advance(1);
    expect(socket.requests()).toHaveLength(3);
    await acknowledge({ success: false, error: 'Session not found' }, firstRequest);
    expectPreserved();
    await advance(12_000);
    expect(socket.requests()).toHaveLength(4);
    expect(context.connectionPhase).toBe('recovery-deferred');
    expect(roomResult).toHaveBeenCalledWith(false);
    expectPreserved();
  });

  it.each(['disconnect', 'close', 'unmount'] as const)('cancels a throttle delay and releases waiters on %s', async (intent) => {
    const view = mount();
    await throttleReconnect();
    const roomResult = vi.fn();
    void context.createRoom('questions', 'waiting-widget').then(roomResult);
    await act(async () => {
      if (intent === 'disconnect') disconnect();
      if (intent === 'close') context.closeSession();
      if (intent === 'unmount') view.unmount();
    });
    expect(roomResult).toHaveBeenCalledWith(false);
    await advance(180_000);
    expect(socket.requests()).toHaveLength(2);
    expect(socket.emitted.some(call => call.event === 'session:createRoom')).toBe(false);
    if (intent === 'close') {
      expect(context.sessionCode).toBeNull();
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    } else {
      expect(localStorage.getItem(TOKEN_KEY)).toBe(server.session.hostToken);
    }
  });

  it.each(['disconnect', 'close', 'unmount'] as const)('ignores an in-flight recovery acknowledgement after %s', async (intent) => {
    const view = mount();
    connect();
    const lateResponse = await peer.create(socket.request().data);
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const roomResult = vi.fn();
    void context.createRoom('questions', 'waiting-widget').then(roomResult);
    await act(async () => {
      if (intent === 'disconnect') disconnect();
      if (intent === 'close') context.closeSession();
      if (intent === 'unmount') view.unmount();
    });
    expect(roomResult).toHaveBeenCalledWith(false);
    await acknowledge(lateResponse);
    expect(localStorage.getItem(TOKEN_KEY)).toBe(intent === 'close' ? null : savedToken);
    expect(context.activeRooms.size).toBe(0);
    await advance(180_000);
    expect(socket.requests()).toHaveLength(1);
  });

  it('ignores even a resolved acknowledgement when close happens before its continuation', async () => {
    mount();
    connect();
    const response = await peer.create(socket.request().data);
    await act(async () => {
      socket.request().ack!(response);
      context.closeSession();
    });
    expect(context.sessionCode).toBeNull();
    expect(context.activeRooms.size).toBe(0);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('targets a new explicit recovery code, not the stale render, and rejects obsolete responses', async () => {
    mount();
    connect();
    const oldRequest = socket.request();
    const oldResponse = await peer.create(oldRequest.data);
    disconnect();
    connect();
    // An unknown code is refused (reclaim-only, #78) rather than replaced by a
    // session the teacher never started; the obsolete answer cannot revive it.
    let result: Promise<boolean>;
    act(() => { result = context.recoverSession('MNPQRS'); });
    expect(socket.request().data).toMatchObject({ existingCode: 'MNPQRS', reclaimOnly: true });
    const refused = await respond();
    expect(await result!).toBe(false);
    expect(refused).toEqual({ success: false, error: 'Session not found' });
    await acknowledge(oldResponse, oldRequest);
    expect(context.connectionPhase).toBe('recovery-failed');
    expect(context.sessionCode).toBeNull();
    expect(context.activeRooms.size).toBe(0);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    await advance(180_000);
    expect(socket.requests()).toHaveLength(3);
  });

  it('cancels a delayed recovery when closing and immediately creating a new session', async () => {
    mount();
    await throttleReconnect();
    const oldRequest = socket.request();
    let created: Promise<string | null>;
    act(() => {
      context.closeSession();
      created = context.createSession();
    });
    expect(socket.request().data).toEqual({});
    await advance(60_001);
    const fresh = await respond();
    expect(await created!).toBe(fresh.code);
    await acknowledge({ success: false, error: 'Session not found' }, oldRequest);
    expect(context.sessionCode).toBe(fresh.code);
    expect(localStorage.getItem(TOKEN_KEY)).toBe(fresh.hostToken);
    await advance(180_000);
    expect(socket.requests()).toHaveLength(3);
  });

  it.each(['disconnect', 'close', 'unmount'] as const)('also cancels a pending new session on %s', async (intent) => {
    storeState.current.sessionCode = null;
    storeState.current.sessionCreatedAt = null;
    localStorage.clear();
    const view = mount();
    connect();
    let created: Promise<string | null>;
    act(() => { created = context.createSession(); });
    const response = await peer.create(socket.request().data);
    const result = vi.fn();
    void created!.then(result);
    await act(async () => {
      if (intent === 'disconnect') disconnect();
      if (intent === 'close') context.closeSession();
      if (intent === 'unmount') view.unmount();
    });
    expect(result).toHaveBeenCalledWith(null);
    await acknowledge(response);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(storeState.current.setSessionCode).not.toHaveBeenCalledWith(response.code);
  });

  it.each(['invalid token', 'deleted session'] as const)('ends the stored session for %s, without reclaiming or creating one (#78)', async (failure) => {
    mount();
    await recoverOnce();
    const previousHost = server.session.hostSocketId;
    disconnect();
    if (failure === 'invalid token') server.session.rotateHostToken();
    else server.manager.deleteSession(CODE);
    const sessionsBefore = server.manager.sessions.size;
    connect();
    const response = await respond();
    expect(response.success).toBe(false);
    expect(server.manager.sessions.size).toBe(sessionsBefore);
    expect(context.connectionPhase).toBe('recovery-failed');
    expect(context.sessionCode).toBeNull();
    expect(context.activeRooms.size).toBe(0);
    expect(context.getWidgetRecoveryData('poll-1')).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(server.session.hostSocketId).toBe(previousHost);
  });

  it('releases room waiters when the stored session is gone, without emitting for the dead code', async () => {
    mount();
    server.manager.deleteSession(CODE);
    connect();
    let roomResult: Promise<boolean>;
    act(() => { roomResult = context.createRoom('poll', 'poll-1'); });
    await respond();
    expect(await roomResult!).toBe(false);
    expect(socket.emitted.some(call => call.event === 'session:createRoom')).toBe(false);
    expect(context.connectionPhase).toBe('recovery-failed');
    expect(context.sessionCode).toBeNull();
  });

  it('does not let an obsolete negative acknowledgement settle a newer recovery or its waiters', async () => {
    mount();
    connect();
    const oldRequest = socket.request();
    const oldRoomResult = vi.fn();
    void context.createRoom('poll', 'poll-1').then(oldRoomResult);
    let recovered: Promise<boolean>;
    act(() => { recovered = context.recoverSession(CODE); });
    const currentRoomResult = vi.fn();
    void context.createRoom('poll', 'poll-1').then(currentRoomResult);
    await acknowledge({ success: false, error: 'Session not found' }, oldRequest);
    expect(oldRoomResult).toHaveBeenCalledWith(false);
    expect(currentRoomResult).not.toHaveBeenCalled();
    expect(context.connectionPhase).toBe('recovering');
    expect(context.sessionCode).toBe(CODE);
    await respond();
    expect(await recovered!).toBe(true);
    const request = socket.emitted.find(call => call.event === 'session:createRoom')!;
    await acknowledge(await peer.createRoom(request.data), request);
    expect(currentRoomResult).toHaveBeenCalledWith(true);
  });

  it('does not resurrect a closed room from a late createRoom acknowledgement', async () => {
    mount();
    await recoverOnce();
    const result = context.createRoom('poll', 'poll-1');
    const request = socket.emitted.find(call => call.event === 'session:createRoom')!;
    const response = await peer.createRoom(request.data);
    act(() => { context.closeSession(); });
    await acknowledge(response, request);
    expect(await result).toBe(false);
    expect(context.activeRooms.size).toBe(0);
    expect(context.getWidgetRecoveryData('poll-1')).toBeNull();
  });

  it('cancels recovery and clears the old snapshot when the workspace store closes the session', async () => {
    const view = mount();
    await throttleReconnect();
    const result = vi.fn();
    void context.createRoom('poll', 'poll-1').then(result);
    storeState.current.sessionCode = null;
    storeState.current.sessionCreatedAt = null;
    view.rerender(<SessionProvider><Probe /><SessionBanner /></SessionProvider>);
    await act(async () => {});
    expect(result).toHaveBeenCalledWith(false);
    expect(context.sessionCode).toBeNull();
    expect(context.activeRooms.size).toBe(0);
    expect(context.getWidgetRecoveryData('poll-1')).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    await advance(180_000);
    expect(socket.requests()).toHaveLength(2);
  });

  it('recovers after the StrictMode setup/cleanup/setup cycle without accepting the first cancelled answer', async () => {
    socket.connected = true;
    peer = server.peer();
    render(<React.StrictMode><SessionProvider><Probe /><SessionBanner /></SessionProvider></React.StrictMode>);
    expect(socket.requests()).toHaveLength(2);
    const first = socket.requests()[0];
    await acknowledge(await peer.create(first.data), first);
    expect(context.connectionPhase).toBe('recovering');
    expect(context.activeRooms.size).toBe(0);
    await respond();
    expect(context.connectionPhase).toBe('recovered');
    expectPreserved();
  });

  it.each([-1, NaN, Infinity, 2_147_483_647, '60000', null])('defers unsafe retryAfter %s without discarding state or overflowing a timer', async (retryAfter) => {
    mount();
    await recoverOnce();
    disconnect();
    connect();
    await acknowledge({ success: false, error: 'Temporary throttle', retryAfter });
    expect(context.connectionPhase).toBe('recovery-deferred');
    expectPreserved();
    await advance(180_000);
    expect(socket.requests()).toHaveLength(2);
  });

  it('cancels work when the socket is replaced and keeps the replacement recovery current', async () => {
    const view = mount();
    connect();
    const oldRequest = socket.request();
    const response = await peer.create(oldRequest.data);
    const result = vi.fn();
    void context.createRoom('poll', 'poll-1').then(result);
    socket = new FakeSocket();
    socketState.current = socket;
    view.rerender(<SessionProvider><Probe /><SessionBanner /></SessionProvider>);
    connect();
    await acknowledge(response, oldRequest);
    expect(result).toHaveBeenCalledWith(false);
    expect(context.connectionPhase).toBe('recovering');
    expect(context.activeRooms.size).toBe(0);
    expect(socket.requests()).toHaveLength(1);
    // The dropped socket's reclaim rotated the token but its answer was
    // discarded. The server still accepts the token this client holds.
    await respond();
    expect(context.connectionPhase).toBe('recovered');
    expect(context.sessionCode).toBe(CODE);
  });

  // Issue #78: the server now keeps a room until its widget is deleted, the
  // teacher is gone for 30 minutes, or the room is idle for 4 hours, so the
  // client no longer guesses from the session's age. Ways that could go wrong:
  //  1. A reload after 2 hours drops a session the server still holds, giving
  //     the teacher a new code while the students sit in the old one.
  //  2. A stored session the server no longer holds leaves the teacher on a
  //     dead code, or with rooms and a recovery snapshot from it; or, opened
  //     the next day, silently starts a new session the teacher never asked
  //     for (a join code on the banner and an unswept server session).
  //  3. Starting another widget in a session older than 2 hours creates a
  //     replacement session or clears the live rooms.
  it('recovers a stored session older than two hours that the server still holds (1)', async () => {
    const createdAt = Date.now() - 5 * 60 * 60 * 1000;
    storeState.current.sessionCreatedAt = createdAt;
    mount();
    await recoverOnce();
    expectPreserved();
    expect(context.sessionCreatedAt).toBe(createdAt);
  });

  it('forgets a stored session the server no longer holds, and starts a new one only when asked (2)', async () => {
    storeState.current.sessionCreatedAt = Date.now() - 24 * 60 * 60 * 1000;
    server.manager.sessions.delete(CODE);
    mount();
    connect();
    const response = await respond();

    expect(response).toMatchObject({ success: false, error: 'Session not found' });
    expect(server.manager.sessions.size).toBe(0);
    expect(context.connectionPhase).toBe('recovery-failed');
    expect(context.sessionCode).toBeNull();
    expect(screen.queryByText(CODE)).toBeNull();
    expect(context.activeRooms.size).toBe(0);
    expect(context.getWidgetRecoveryData('poll-1')).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(context.error).toBe('Your previous session ended. Press Start to begin a new one.');

    // The next widget start creates a fresh session
    let code: string | null = null;
    await act(async () => {
      const pending = context.createSession();
      const created = await peer.create(socket.request().data);
      await acknowledge(created);
      code = await pending;
    });
    expect(code).toBeTruthy();
    expect(code).not.toBe(CODE);
    expect(context.sessionCode).toBe(code);
    expect(context.error).toBeNull();
  });

  // Two tabs share localStorage. Ways that could go wrong:
  //  4. A tab reclaims with the token it read at load, after another tab of
  //     the same session has rotated it, and is refused.
  //  5. A refused tab wipes the stored code and token another tab now holds.
  //  6. A tab sends another session's stored token with its own code, is
  //     refused for that reason, and then wipes that session's token.
  it('reclaims with the token in storage at emit time, not the one read at load (4)', async () => {
    mount();
    // Another tab of the same session reclaimed and stored the current token
    server.session.rotateHostToken();
    localStorage.setItem(TOKEN_KEY, server.session.hostToken);
    localStorage.setItem(TOKEN_CODE_KEY, CODE);
    connect();
    expect(socket.request().data.hostToken).toBe(server.session.hostToken);
    expect((await respond()).isExisting).toBe(true);
    expect(context.connectionPhase).toBe('recovered');
  });

  it('sends its own token when another tab has moved on to another session before the emit (6)', async () => {
    const ownToken = localStorage.getItem(TOKEN_KEY);
    mount();
    server.manager.deleteSession(CODE);
    localStorage.setItem(TOKEN_KEY, 'token-from-other-tab');
    localStorage.setItem(TOKEN_CODE_KEY, 'OTHER1');
    connect();
    expect(socket.request().data).toMatchObject({ existingCode: CODE, hostToken: ownToken });
    await respond();

    expect(context.connectionPhase).toBe('recovery-failed');
    expect(localStorage.getItem(TOKEN_KEY)).toBe('token-from-other-tab');
    expect(localStorage.getItem(TOKEN_CODE_KEY)).toBe('OTHER1');
    expect(storeState.current.setSessionCode).not.toHaveBeenCalledWith(null);
  });

  it('leaves another tab\'s stored session alone when its own reclaim is refused (5)', async () => {
    mount();
    server.manager.deleteSession(CODE);
    connect();
    const request = socket.request();
    // Meanwhile another tab stored a different session's token
    localStorage.setItem(TOKEN_KEY, 'token-from-other-tab');
    await acknowledge(await peer.create(request.data), request);

    expect(context.connectionPhase).toBe('recovery-failed');
    expect(context.sessionCode).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBe('token-from-other-tab');
    expect(storeState.current.setSessionCode).not.toHaveBeenCalledWith(null);
  });

  it('keeps the recovered session and its rooms when another widget starts after two hours (3)', async () => {
    storeState.current.sessionCreatedAt = Date.now() - 5 * 60 * 60 * 1000;
    mount();
    await recoverOnce();
    const requestsBefore = socket.requests().length;

    let code: string | null = null;
    await act(async () => { code = await context.createSession(); });

    expect(code).toBe(CODE);
    expect(socket.requests()).toHaveLength(requestsBefore);
    expect(context.activeRooms.has('poll-1')).toBe(true);
  });
});
