import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
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
    expect(socket.request().data).toEqual({ existingCode: CODE, hostToken: token });
    expect((await respond()).isExisting).toBe(true);

    expect(context.connectionPhase).toBe('recovered');
    expectPreserved();
    expect(server.manager.getSession(CODE)).toBe(server.session);
    expect(server.session.getRoom('poll', 'poll-1')).toBe(server.room);
    expect(server.session.getParticipants().map((student: any) => student.name)).toEqual(['Ada', 'Bo']);
    expect(server.room.getParticipantCount()).toBe(2);
    expect(localStorage.getItem(TOKEN_KEY)).not.toBe(token);
    expect(server.session.isValidHostToken(token)).toBe(false);
    expect(peer.socket.join).toHaveBeenCalledWith(`${CODE}:poll:poll-1`);
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
    // A different socket and unknown code must create a fresh authenticated session.
    let result: Promise<boolean>;
    act(() => { result = context.recoverSession('MNPQRS'); });
    expect(socket.request().data.existingCode).toBe('MNPQRS');
    const fresh = await respond();
    expect(await result!).toBe(true);
    expect(fresh.isExisting).toBe(false);
    await acknowledge(oldResponse, oldRequest);
    expect(context.sessionCode).toBe(fresh.code);
    expect(context.activeRooms.size).toBe(0);
    expect(localStorage.getItem(TOKEN_KEY)).toBe(fresh.hostToken);
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

  it.each(['invalid token', 'deleted session'] as const)('keeps the handler fallback for %s, rather than reclaiming without authentication', async (failure) => {
    mount();
    await recoverOnce();
    const previousToken = localStorage.getItem(TOKEN_KEY);
    const previousHost = server.session.hostSocketId;
    disconnect();
    if (failure === 'invalid token') server.session.rotateHostToken();
    else server.manager.deleteSession(CODE);
    connect();
    const response = await respond();
    expect(response.isExisting).toBe(false);
    expect(response.code).not.toBe(CODE);
    expect(context.connectionPhase).toBe('recovered');
    expect(context.sessionCode).toBe(response.code);
    expect(context.activeRooms.size).toBe(0);
    expect(context.getWidgetRecoveryData('poll-1')).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBe(response.hostToken);
    expect(response.hostToken).not.toBe(previousToken);
    expect(server.session.hostSocketId).toBe(previousHost);
  });

  it('releases successful room waiters with the replacement code, not the code captured before recovery', async () => {
    mount();
    server.manager.deleteSession(CODE);
    connect();
    let roomResult: Promise<boolean>;
    act(() => { roomResult = context.createRoom('poll', 'poll-1'); });
    const fresh = await respond();
    const request = socket.emitted.find(call => call.event === 'session:createRoom')!;
    expect(request.data).toEqual({ sessionCode: fresh.code, roomType: 'poll', widgetId: 'poll-1' });
    await acknowledge(await peer.createRoom(request.data), request);
    expect(await roomResult!).toBe(true);
    expect(context.activeRooms.get('poll-1')?.roomData.code).toBe(fresh.code);
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
    await respond();
    expect(context.connectionPhase).toBe('recovered');
  });

  it('allows recovery at the local age limit, but not beyond it', async () => {
    storeState.current.sessionCreatedAt = Date.now() - 2 * 60 * 60 * 1000;
    mount();
    await recoverOnce();
    expectPreserved();
  });

  it('still clears a genuinely expired local session without attempting reclaim', () => {
    storeState.current.sessionCreatedAt = Date.now() - 2 * 60 * 60 * 1000 - 1;
    mount();
    connect();
    expect(context.connectionPhase).toBe('recovery-failed');
    expect(context.sessionCode).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(socket.requests()).toHaveLength(0);
  });
});
