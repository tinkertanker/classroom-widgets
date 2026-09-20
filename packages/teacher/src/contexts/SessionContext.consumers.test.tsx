import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { WidgetType } from '@shared/types';
import { createDefaultStorageV2 } from '@shared/types/storage';
import { loadStorage, saveStorage } from '@shared/utils/storageMigration';
import { SessionProvider, useSession } from './SessionContext';
import { ModalProvider } from './ModalContext';
import { useWorkspaceStore } from '../store/workspaceStore.simple';
import { useSocketEvents } from '../features/session/hooks/useSocketEvents';
import SessionBanner from '../features/session/components/SessionBanner';
import Poll from '../features/widgets/poll/poll';
import LinkShare from '../features/widgets/linkShare/LinkShare';
import FillBlank from '../features/widgets/activity/fillBlank/FillBlank';
import CodeFillBlank from '../features/widgets/activity/codeFillBlank/CodeFillBlank';
import Questions from '../features/widgets/questions/Questions';
import RTFeedback from '../features/widgets/rtFeedback/rtFeedback';
import Handout from '../features/widgets/handout/Handout';
import PollSettings from '../features/widgets/poll/PollSettings';

const transport = vi.hoisted(() => ({ socket: null as any }));
vi.mock('../hooks/useSocket', () => ({ useSocket: () => ({ socket: transport.socket }) }));

// Only transport and clipboard I/O are mocked. Provider, store/persistence, widget hooks,
// controls, modal/editor, session/IP limiter and host handlers are real.
process.env.LOG_LEVEL = 'error';
const require = createRequire(import.meta.url);
const sessionHandler = require('../../../server/src/sockets/handlers/sessionHandler.js');
const pollHandler = require('../../../server/src/sockets/handlers/pollHandler.js');
const Session = require('../../../server/src/models/Session.js');
const SessionManager = require('../../../server/src/services/SessionManager.js');
const { stopRateLimiterCleanup } = require('../../../server/src/middleware/socketAuth.js');
const CODE = 'BCDFGH';
const TOKEN = 'classroom-widgets:hostToken';
const TWO_HOURS = 7_200_000;
let ipSequence = 0;

function fixture() {
  const manager = new SessionManager();
  const session = new Session(CODE);
  manager.sessions.set(CODE, session);
  session.hostSocketId = 'original-host';
  const poll = session.createRoom('poll', 'poll-1');
  poll.isActive = true;
  poll.setPollData({ question: 'Choose a number', options: ['Two', 'Three', 'Five'] });
  for (const [id, name, vote] of [['student-a', 'Ada', 2], ['student-b', 'Bo', 0]] as const) {
    session.addParticipant(id, name, `device-${id}`);
    poll.addParticipant(id, { name });
    poll.vote(id, vote);
  }
  const ip = `198.51.100.${++ipSequence}`;
  let sequence = 0;
  let currentPeer: ReturnType<typeof peer>;
  const clientHandlers = new Map<string, Set<Function>>();
  const sent: Array<{ event: string; data: any; ack?: Function }> = [];
  const client = {
    connected: false,
    on(event: string, fn: Function) {
      if (!clientHandlers.has(event)) clientHandlers.set(event, new Set());
      clientHandlers.get(event)!.add(fn);
    },
    off(event: string, fn: Function) { clientHandlers.get(event)?.delete(fn); },
    fire(event: string, data?: any) { clientHandlers.get(event)?.forEach(fn => fn(data)); },
    emit(event: string, data: any, ack?: Function) {
      sent.push({ event, data, ack });
      if (event !== 'session:create') currentPeer?.handlers.get(event)?.(data, ack);
    }
  };
  function peer() {
    const handlers = new Map<string, Function>();
    const rooms = new Set<string>();
    const socket = {
      id: `host-${++sequence}`, clientIP: ip, rooms,
      handshake: { headers: {}, secure: false },
      on: (event: string, fn: Function) => handlers.set(event, fn),
      join: (room: string) => rooms.add(room),
      emit: (event: string, data: any) => client.fire(event, data)
    };
    const io = {
      to: (room: string) => ({ emit: (event: string, data: any) => {
        if (currentPeer?.rooms.has(room)) client.fire(event, data);
      } }),
      sockets: { adapter: { rooms: new Map() }, sockets: new Map() }
    };
    sessionHandler(io, socket, manager, () => CODE);
    pollHandler(io, socket, manager, () => CODE);
    return { handlers, rooms, socket };
  }
  return {
    manager, session, poll, client, sent,
    creates: () => sent.filter(call => call.event === 'session:create'),
    connect: () => { currentPeer = peer(); client.connected = true; client.fire('connect'); },
    disconnect: () => { client.connected = false; client.fire('disconnect'); },
    respond: async () => {
      const request = sent.filter(call => call.event === 'session:create').at(-1)!;
      const response: any = await new Promise(resolve => currentPeer.handlers.get('session:create')!(request.data, resolve));
      request.ack!(response);
      return response;
    },
    spendBudget: async (count: number) => {
      for (let i = 0; i < count; i++) {
        const response: any = await new Promise(resolve => peer().handlers.get('session:create')!({}, resolve));
        expect(response.success).toBe(true);
      }
    },
    rejectedPollUpdate: () => peer().handlers.get('session:poll:update')!({
      sessionCode: CODE, widgetId: 'poll-1', pollData: { question: 'Unauthorized', options: ['A', 'B'] }
    })
  };
}

let server: ReturnType<typeof fixture>;
let session: ReturnType<typeof useSession>;
let socketEvents: ReturnType<typeof useSocketEvents>;
const Probe = () => { session = useSession(); socketEvents = useSocketEvents({ events: {} }); return null; };
const savePoll = (state: any) => useWorkspaceStore.getState().updateWidgetState('poll-1', state);
const mount = (children?: React.ReactNode) => render(
  <SessionProvider><ModalProvider><Probe /><SessionBanner />{children}</ModalProvider></SessionProvider>
);
const advance = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const respond = async () => { await act(async () => { await server.respond(); }); };
const connect = async () => {
  await act(async () => { server.connect(); });
  if (session.connectionPhase === 'recovering') await respond();
};
const defer = async () => {
  act(() => server.disconnect());
  await server.spendBudget(29);
  await connect();
  for (let attempt = 2; attempt <= 3; attempt++) {
    await advance(60_001);
    await server.spendBudget(30);
    await respond();
  }
  expect(session.connectionPhase).toBe('recovery-deferred');
};
const pollState = () => useWorkspaceStore.getState().widgetStates.get('poll-1');
const persistedAge = () => {
  // Use the production leave-page flush, not a second persistence model.
  window.dispatchEvent(new Event('pagehide'));
  return loadStorage()!.session.createdAt;
};

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-20T01:00:00Z'));
  window.dispatchEvent(new Event('pagehide'));
  localStorage.clear();
  const storage = createDefaultStorageV2();
  storage.session = { code: CODE, createdAt: Date.now() };
  storage.workspaces[storage.currentWorkspaceId].widgets = [
    { id: 'poll-1', type: WidgetType.POLL, position: { x: 0, y: 0 }, size: { width: 500, height: 440 } } as any
  ];
  saveStorage(storage);
  await useWorkspaceStore.persist.rehydrate();
  server = fixture();
  transport.socket = server.client;
  localStorage.setItem(TOKEN, server.session.hostToken);
});
afterEach(() => { cleanup(); server.manager.stopCleanupInterval(); vi.useRealTimers(); });
afterAll(stopRateLimiterCleanup);

describe('session recovery consumer invariants (#157)', () => {
  it.each([TWO_HOURS - 1, TWO_HOURS, TWO_HOURS + 1])('keeps same-session persisted age when retrying at age %i', async (age) => {
    const createdAt = Date.now();
    mount();
    await connect();
    await defer();
    vi.setSystemTime(createdAt + age);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry session recovery' })); });
    if (age <= TWO_HOURS) {
      await respond();
      expect(session.connectionPhase).toBe('recovered');
      expect(server.creates()).toHaveLength(5);
      expect(session.sessionCreatedAt).toBe(createdAt);
      expect(useWorkspaceStore.getState().sessionCreatedAt).toBe(createdAt);
      expect(persistedAge()).toBe(createdAt);
      await advance(1);
      act(() => { void session.recoverSession(CODE); });
      if (age === TWO_HOURS) expect(server.creates()).toHaveLength(5);
    } else {
      expect(server.creates()).toHaveLength(4);
      expect(session.connectionPhase).toBe('recovery-failed');
      expect(session.sessionCreatedAt).toBeNull();
      expect(useWorkspaceStore.getState().sessionCreatedAt).toBeNull();
      expect(persistedAge()).toBeNull();
    }
  });

  it('does not renew persisted age on repeated failed same-code retries', async () => {
    const createdAt = Date.now();
    mount();
    await connect();
    await defer();
    for (let i = 0; i < 2; i++) {
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry session recovery' })); });
      await respond();
      for (let attempt = 2; attempt <= 3; attempt++) {
        await advance(60_001);
        await server.spendBudget(30);
        await respond();
      }
      expect(session.connectionPhase).toBe('recovery-deferred');
      expect(session.sessionCreatedAt).toBe(createdAt);
      expect(persistedAge()).toBe(createdAt);
    }
    expect(server.creates()).toHaveLength(10);
  });

  it('initializes persisted age for a different identity without changing the old server session', async () => {
    mount();
    await connect();
    const originalCreatedAt = session.sessionCreatedAt;
    await defer();
    await advance(60_001);
    const requestedAt = Date.now();
    act(() => { void session.recoverSession('JKLMNP'); });
    expect(session.sessionCreatedAt).toBe(requestedAt);
    expect(persistedAge()).toBe(requestedAt);
    expect(requestedAt).toBeGreaterThan(originalCreatedAt!);
    await respond();
    expect(session.connectionPhase).toBe('recovered');
    expect(session.sessionCode).not.toBe(CODE);
    expect(persistedAge()).toBe(requestedAt);
    expect(server.manager.getSession(CODE)).toBe(server.session);
  });

  it.each([false, true])('blocks stale mutations before rerender (reconnected: %s) and keeps the open poll draft until reclaim', async (reconnected) => {
    mount(<Poll widgetId="poll-1" savedState={{}} onStateChange={savePoll} />);
    await connect();
    expect(screen.getByText('Choose a number')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.change(screen.getByPlaceholderText("What's your poll question?"), { target: { value: 'Unsaved draft' } });
    const oldEmit = socketEvents.emit;
    const oldUpdate = session.updateRoomState;
    const oldClose = session.closeRoom;
    const oldSave = screen.getByRole('button', { name: 'Save Changes' });
    const saved = pollState();
    const sent = server.sent.length;
    await server.spendBudget(29);
    act(() => {
      server.disconnect();
      if (reconnected) server.connect();
      // Dispatch before React rerenders: disabled props alone cannot protect
      // this editor callback or the captured shared mutation methods.
      fireEvent.click(oldSave);
      oldUpdate('poll', 'poll-1', false);
      oldClose('poll', 'poll-1');
      oldEmit('session:poll:update', { sessionCode: CODE, widgetId: 'poll-1', pollData: { question: 'Stale', options: [], isActive: true } });
    });
    // Reconnect may start reclaim, but no room or widget mutation is sent.
    expect(server.sent.slice(sent).map(call => call.event)).toEqual(reconnected ? ['session:create'] : []);
    expect(pollState()).toEqual(saved);
    expect(screen.getByText('Choose a number')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
    if (reconnected) {
      // Recovery starts in the effect after the disconnect/connect batch.
      expect(server.client.connected).toBe(true);
      await advance(0);
      await respond();
    } else {
      await connect();
    }
    expect(screen.getByRole('button', { name: 'Pause poll' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
    server.rejectedPollUpdate();
    expect(server.poll.pollData.question).toBe('Choose a number');
    await advance(60_001);
    await respond();
    expect(session.connectionPhase).toBe('recovered');
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save Changes' })); });
    expect(pollState().pollData.question).toBe('Unsaved draft');
    expect(server.poll.pollData.question).toBe('Unsaved draft');
    expect(server.manager.getSession(CODE)).toBe(server.session);
    expect(server.session.getRoom('poll', 'poll-1')).toBe(server.poll);
    expect(server.session.getParticipants().map((student: any) => student.name)).toEqual(['Ada', 'Bo']);
  });

  it('disables actual poll controls in deferred recovery and resumes editing after banner retry', async () => {
    mount(<Poll widgetId="poll-1" savedState={{}} onStateChange={savePoll} />);
    await connect();
    const token = localStorage.getItem(TOKEN);
    const oldEvents = socketEvents;
    const oldUpdate = session.updateRoomState;
    await defer();
    const saved = pollState();
    const sent = server.sent.length;
    expect(server.client.connected).toBe(true);
    expect(session.isConnected).toBe(true);
    expect(session.isSessionReady).toBe(false);
    for (const name of ['Pause poll', 'Settings', 'Reset votes']) {
      const button = screen.getByRole('button', { name });
      expect(button).toBeDisabled();
      fireEvent.click(button);
    }
    act(() => {
      oldEvents.emit('session:reset', { sessionCode: CODE, widgetId: 'poll-1' });
      oldUpdate('poll', 'poll-1', false);
    });
    await expect(oldEvents.emitWithAck('session:reset', { sessionCode: CODE, widgetId: 'poll-1' })).rejects.toThrow('Session not ready');
    expect(await session.createRoom('poll', 'pending-1')).toBe(false);
    expect(pollState()).toEqual(saved);
    expect(server.sent).toHaveLength(sent);
    expect(localStorage.getItem(TOKEN)).toBe(token);
    expect(screen.getByRole('button', { name: 'Retry session recovery' })).toBeEnabled();
    await advance(60_001);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry session recovery' })); });
    await respond();
    expect(session.connectionPhase).toBe('recovered');
    expect(session.isSessionReady).toBe(true);
    expect(localStorage.getItem(TOKEN)).not.toBe(token);
    expect(screen.getByRole('button', { name: 'Settings' })).toBeEnabled();
    expect(server.creates()).toHaveLength(5);
    expect(server.session.getRoom('poll', 'poll-1')).toBe(server.poll);
    expect(server.session.getParticipants().map((student: any) => student.name)).toEqual(['Ada', 'Bo']);
  });

  it.each([
    ['Drop Box', LinkShare, 'linkShare', 'Pause submissions'],
    ['Questions', Questions, 'questions', 'Pause accepting questions'],
    ['RT Feedback', RTFeedback, 'rtfeedback', 'Pause feedback'],
    ['Handout', Handout, 'handout', 'Pause handout'],
    ['Fill Blank', FillBlank, 'activity', 'Pause activity'],
    ['Code Fill Blank', CodeFillBlank, 'activity', 'Pause activity']
  ] as const)('gates %s controls while retaining its classroom room', async (_name, Component, roomType, pauseLabel) => {
    const room = server.session.createRoom(roomType, 'other-1');
    room.isActive = true;
    mount(<Component widgetId="other-1" savedState={{}} />);
    await connect();
    await defer();
    expect(screen.getByRole('button', { name: pauseLabel })).toBeDisabled();
    expect(server.session.getRoom(roomType, 'other-1')).toBe(room);
    expect(session.activeRooms.has('other-1')).toBe(true);
    for (const button of screen.queryAllByRole('button', { name: /Settings|Show answers|Links \+ Text|Add item/ })) {
      expect(button).toBeDisabled();
    }
  });

  it.each([['Fill Blank', FillBlank], ['Code Fill Blank', CodeFillBlank]] as const)('blocks an already-open %s editor save before the disconnected render', async (_name, Component) => {
    server.session.createRoom('activity', 'activity-1').isActive = true;
    const savedState = { activityData: { template: 'Use {{care}}', answers: ['care'], distractors: [], language: 'python' } };
    const save = vi.fn();
    mount(<Component widgetId="activity-1" savedState={savedState} onStateChange={save} />);
    await connect();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.change(within(screen.getByRole('dialog')).getByDisplayValue('Use {{care}}'), { target: { value: 'Use {{patience}}' } });
    const saveButton = screen.getByRole('button', { name: 'Save Activity' });
    const sent = server.sent.length;
    save.mockClear();
    act(() => { server.disconnect(); fireEvent.click(saveButton); });
    expect(server.sent).toHaveLength(sent);
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save Activity' })).toBeDisabled();
    await connect();
    expect(screen.getByRole('button', { name: 'Save Activity' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save Activity' }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ activityData: expect.objectContaining({ template: 'Use {{patience}}' }) }));
  });

  it('does not optimistically change drop-box mode through a stale click', async () => {
    server.session.createRoom('linkShare', 'drop-1').isActive = true;
    const save = vi.fn();
    mount(<LinkShare widgetId="drop-1" onStateChange={save} />);
    await connect();
    const mode = screen.getByRole('button', { name: 'Links + Text' });
    const sent = server.sent.length;
    save.mockClear();
    act(() => { server.disconnect(); fireEvent.click(mode); });
    expect(server.sent).toHaveLength(sent);
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Links + Text' })).toBeDisabled();
  });

  describe.each([
    ['Poll', Poll, 'poll', 'poll-1', 'Choose a number', 'A retained poll draft', 'Save Changes'],
    ['Fill Blank', FillBlank, 'activity', 'activity-1', 'Use {{care}}', 'Use {{patience}}', 'Save Activity'],
    ['Code Fill Blank', CodeFillBlank, 'activity', 'activity-1', 'Use {{care}}', 'Use {{patience}}', 'Save Activity']
  ] as const)('%s open editor', (_name, Component, roomType, widgetId, initialValue, draft, saveLabel) => {
    const openEditor = async () => {
      if (roomType === 'activity') server.session.createRoom(roomType, widgetId).isActive = true;
      const save = vi.fn((state: any) => useWorkspaceStore.getState().updateWidgetState(widgetId, state));
      const savedState = { activityData: { template: 'Use {{care}}', answers: ['care'], distractors: ['rush'], language: 'python' } };
      mount(<Component widgetId={widgetId} savedState={savedState} onStateChange={save} />);
      await connect();
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
      const dialog = screen.getByRole('dialog');
      fireEvent.change(within(dialog).getByDisplayValue(initialValue), { target: { value: draft } });
      return { dialog, save };
    };

    it('recovers from inside the same modal and saves the retained draft', async () => {
      const createdAt = Date.now();
      const { dialog, save } = await openEditor();
      await defer();
      expect(server.client.connected).toBe(true);
      expect(within(dialog).getByRole('button', { name: saveLabel })).toBeDisabled();
      const token = localStorage.getItem(TOKEN);
      const saved = useWorkspaceStore.getState().widgetStates.get(widgetId);
      await advance(60_001);
      const retry = within(dialog).getByRole('button', { name: 'Retry session recovery from editor' });
      // Both events arrive before a render. Only one recovery run may start.
      act(() => { fireEvent.click(retry); fireEvent.click(retry); });
      expect(server.creates()).toHaveLength(5);
      expect(retry).toBeDisabled();
      expect(screen.getByRole('dialog')).toBe(dialog);
      expect(within(dialog).getByDisplayValue(draft)).toBeInTheDocument();
      expect(useWorkspaceStore.getState().widgetStates.get(widgetId)).toEqual(saved);
      await respond();
      expect(screen.getByRole('dialog')).toBe(dialog);
      expect(within(dialog).queryByRole('button', { name: 'Retry session recovery from editor' })).not.toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: saveLabel })).toBeEnabled();
      expect(session.sessionCreatedAt).toBe(createdAt);
      expect(persistedAge()).toBe(createdAt);
      expect(localStorage.getItem(TOKEN)).not.toBe(token);
      expect(server.manager.getSession(CODE)).toBe(server.session);
      expect(server.session.getParticipants().map((student: any) => student.name)).toEqual(['Ada', 'Bo']);
      save.mockClear();
      fireEvent.click(within(dialog).getByRole('button', { name: saveLabel }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      const state = save.mock.lastCall![0];
      expect(roomType === 'poll' ? state.pollData.question : state.activityData.template).toBe(draft);
      if (roomType === 'poll') expect(server.poll.pollData.question).toBe(draft);
    });

    it('keeps the old draft disabled and copyable when the real handler replaces the classroom', async () => {
      const { dialog, save } = await openEditor();
      const clipboard = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: clipboard } });
      // A different host consumed the reclaim credential. The real handler
      // refuses this client's stale token and creates a new classroom.
      server.session.rotateHostToken();
      act(() => server.disconnect());
      await connect();
      expect(session.sessionCode).not.toBe(CODE);
      expect(session.isSessionReady).toBe(true);
      expect(server.manager.getSession(CODE)).toBe(server.session);
      expect(screen.getByRole('dialog')).toBe(dialog);
      expect(within(dialog).getByDisplayValue(draft)).toBeInTheDocument();
      const saveButton = within(dialog).getByRole('button', { name: saveLabel });
      expect(saveButton).toBeDisabled();
      expect(within(dialog).getByText(/classroom or connection changed/i)).toBeInTheDocument();
      expect(within(dialog).queryByRole('button', { name: 'Retry session recovery from editor' })).not.toBeInTheDocument();
      const sent = server.sent.length;
      save.mockClear();
      fireEvent.click(saveButton);
      expect(save).not.toHaveBeenCalled();
      expect(server.sent).toHaveLength(sent);
      expect(screen.getByRole('dialog')).toBe(dialog);
      await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Copy draft' })); });
      const copied = JSON.parse(clipboard.mock.calls[0][0]);
      expect(roomType === 'poll' ? copied.question : copied.template).toBe(draft);
      expect(screen.getByRole('dialog')).toBe(dialog);
    });
  });

  it('keeps a poll editor open through another bounded deferred run and later success', async () => {
    const createdAt = Date.now();
    mount(<Poll widgetId="poll-1" savedState={{}} onStateChange={savePoll} />);
    await connect();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByDisplayValue('Choose a number'), { target: { value: 'Keep this draft' } });
    await defer();
    const retry = within(dialog).getByRole('button', { name: 'Retry session recovery from editor' });
    fireEvent.click(retry);
    await respond();
    for (let attempt = 2; attempt <= 3; attempt++) {
      await advance(60_001);
      await server.spendBudget(30);
      await respond();
    }
    expect(server.creates()).toHaveLength(7);
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(within(dialog).getByDisplayValue('Keep this draft')).toBeInTheDocument();
    expect(retry).toBeEnabled();
    expect(persistedAge()).toBe(createdAt);
    expect(server.poll.pollData.question).toBe('Choose a number');
    await advance(60_001);
    fireEvent.click(retry);
    await respond();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save Changes' }));
    expect(server.poll.pollData.question).toBe('Keep this draft');
    expect(server.creates()).toHaveLength(8);
  });

  it('does not close a local Poll editor when its owner declines the save', () => {
    useWorkspaceStore.setState({ sessionCode: null, sessionCreatedAt: null });
    const close = vi.fn();
    const save = vi.fn(() => false);
    mount(<PollSettings onClose={close} onSave={save} initialData={{ question: 'Local draft', options: ['A', 'B'] }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(save).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('Local draft')).toBeInTheDocument();
  });

  it('allows standalone offline editor saves without a classroom session', () => {
    useWorkspaceStore.setState({ sessionCode: null, sessionCreatedAt: null });
    const save = vi.fn();
    mount(<PollSettings onClose={() => {}} onSave={save} initialData={{ question: 'Local', options: ['A', 'B'] }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(save).toHaveBeenCalledWith({ question: 'Local', options: ['A', 'B'] });
  });

  it('still lets an online widget with no session create its first room', async () => {
    useWorkspaceStore.setState({ sessionCode: null, sessionCreatedAt: null });
    mount(<Poll widgetId="poll-1" savedState={{}} onStateChange={savePoll} />);
    await connect();
    const start = screen.getByRole('button', { name: 'Start Poll' });
    expect(start).toBeEnabled();
    await act(async () => { fireEvent.click(start); });
    await respond();
    await advance(100);
    expect(server.sent.some(call => call.event === 'session:createRoom')).toBe(true);
    expect(screen.getByRole('button', { name: 'Settings' })).toBeEnabled();
  });
});
