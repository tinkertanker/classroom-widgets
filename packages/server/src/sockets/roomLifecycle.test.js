process.env.LOG_LEVEL = 'error';

// Room lifecycle on the server (issue #78).
//
// Rooms no longer close when a teacher widget unmounts (layout switch, compact
// overlay, re-render). They close when the teacher deletes the widget, ends the
// session, or the server decides they are abandoned. Ways that could go wrong,
// each pinned by a test below:
//
//  1. An abandoned room is never closed, so rooms pile up for the life of the
//     process (and a session hits MAX_ROOMS_PER_SESSION).
//  2. A room in use is closed early: activity from the host or a student does
//     not count, so a live poll disappears mid-lesson.
//  3. A room is closed silently: the teacher widget still looks live and
//     students keep a dead card, because nobody was sent session:roomClosed.
//  4. Expiring one idle room takes a busy sibling room or the whole session
//     with it.
//  5. A teacher who drops off (reload, Wi-Fi, laptop lid) loses the session,
//     and every student in it, before the reconnect grace period is over.
//  6. A teacher who never comes back keeps the session (and its rooms) alive
//     after the grace period.
//  7. Reconnecting inside the grace period does not cancel the pending close,
//     so the session still dies later under a connected teacher.
//  8. The session inactivity sweep deletes the session of a teacher who is
//     still connected (no students joined for a while), silently taking every
//     room with it.
//  9. A student joining does not count as activity on the rooms they join
//     (Link Share and RT Feedback students never send requestState), so an
//     idle room is closed minutes after a student joins it.
// 10. Closing one idle room throws. The sweep runs on a timer outside any
//     socket handler, so the throw reaches the process's uncaughtException
//     handler, which exits and drops every class; or it stops the sweep and
//     the other idle rooms are never closed.

const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { setupSocketHandlers } = require('./socketManager');
const { clearHostDisconnectTimeout } = require('./hostDisconnectTimeouts');
const SessionManager = require('../services/SessionManager');
const { EVENTS, TIME } = require('../config/constants');

const MINUTE = 60 * 1000;

function createMockSocket(id, ip = `10.9.0.${id.length}`) {
  const handlers = {};
  const emitted = [];
  return {
    id,
    clientIP: ip,
    handshake: { headers: {}, secure: false },
    rooms: new Set(),
    emitted,
    on: (event, handler) => { handlers[event] = handler; },
    emit: (...args) => emitted.push(args),
    join: () => {},
    leave: () => {},
    to: () => ({ emit: () => {} }),
    trigger: (event, ...args) => handlers[event] && handlers[event](...args)
  };
}

function createMockIO() {
  let connectionHandler;
  const broadcasts = [];
  return {
    on: (event, handler) => { if (event === 'connection') connectionHandler = handler; },
    to: (target) => ({ emit: (...args) => broadcasts.push({ target, event: args[0], data: args[1] }) }),
    sockets: { adapter: { rooms: new Map() }, sockets: new Map() },
    broadcasts,
    connect: (socket) => connectionHandler(socket)
  };
}

describe('room lifecycle', () => {
  let sessionManager;
  let io;
  let host;

  const createSession = () => new Promise(resolve => host.trigger(EVENTS.SESSION.CREATE, {}, resolve));
  const createRoom = (sessionCode, roomType, widgetId) => new Promise(resolve =>
    host.trigger(EVENTS.SESSION.CREATE_ROOM, { sessionCode, roomType, widgetId }, resolve));
  const roomClosedBroadcasts = () => io.broadcasts.filter(b => b.event === 'session:roomClosed');

  beforeEach(() => {
    // SessionManager schedules its sweep in the constructor, so the clock must
    // be mocked first.
    mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: Date.parse('2026-09-28T08:00:00+08:00') });
    sessionManager = new SessionManager();
    io = createMockIO();
    setupSocketHandlers(io, sessionManager);
    host = createMockSocket('teacher-host', '10.9.1.1');
    io.connect(host);
  });

  afterEach(() => {
    for (const code of sessionManager.sessions.keys()) clearHostDisconnectTimeout(code);
    sessionManager.stopCleanupInterval();
    sessionManager.sessions.clear();
    mock.timers.reset();
  });

  describe('idle room expiry', () => {
    it('closes a room nobody has touched for ROOM_IDLE_TIMEOUT and tells the teacher and students (1, 3)', async () => {
      const { code } = await createSession();
      await createRoom(code, 'poll', 'poll-1');

      mock.timers.tick(TIME.ROOM_IDLE_TIMEOUT + TIME.CLEANUP_INTERVAL);

      const session = sessionManager.getSession(code);
      assert.equal(session.getRoom('poll', 'poll-1'), undefined, 'the idle room is gone');
      assert.deepEqual(roomClosedBroadcasts(), [{
        target: `session:${code}`,
        event: 'session:roomClosed',
        data: { roomType: 'poll', widgetId: 'poll-1' }
      }]);
    });

    it('keeps a room that is idle for less than ROOM_IDLE_TIMEOUT (2)', async () => {
      const { code } = await createSession();
      await createRoom(code, 'poll', 'poll-1');

      mock.timers.tick(TIME.ROOM_IDLE_TIMEOUT - MINUTE);

      assert.ok(sessionManager.getSession(code).getRoom('poll', 'poll-1'));
      assert.deepEqual(roomClosedBroadcasts(), []);
    });

    it('counts a host event on the room as activity (2)', async () => {
      const { code } = await createSession();
      await createRoom(code, 'poll', 'poll-1');

      mock.timers.tick(TIME.ROOM_IDLE_TIMEOUT - MINUTE);
      host.trigger(EVENTS.POLL.UPDATE, {
        sessionCode: code,
        widgetId: 'poll-1',
        pollData: { question: 'Lunch?', options: ['Rice', 'Noodles'] }
      });
      mock.timers.tick(TIME.ROOM_IDLE_TIMEOUT - MINUTE);

      assert.ok(sessionManager.getSession(code).getRoom('poll', 'poll-1'), 'host activity kept the room');
      mock.timers.tick(TIME.CLEANUP_INTERVAL + MINUTE);
      assert.equal(sessionManager.getSession(code).getRoom('poll', 'poll-1'), undefined, 'then it goes idle');
    });

    it('counts a student event on the room as activity (2)', async () => {
      const { code } = await createSession();
      await createRoom(code, 'poll', 'poll-1');
      const student = createMockSocket('student-1', '10.9.2.1');
      io.connect(student);
      student.trigger(EVENTS.SESSION.JOIN, { code, name: 'Ada', studentId: 'ada' });
      await new Promise(resolve => setImmediate(resolve));

      mock.timers.tick(TIME.ROOM_IDLE_TIMEOUT - MINUTE);
      student.trigger(EVENTS.POLL.REQUEST_STATE, { sessionCode: code, widgetId: 'poll-1' });
      mock.timers.tick(TIME.ROOM_IDLE_TIMEOUT - MINUTE);

      assert.ok(sessionManager.getSession(code).getRoom('poll', 'poll-1'), 'student activity kept the room');
    });

    it('counts a student joining the session as activity on the rooms they join (9)', async () => {
      const { code } = await createSession();
      await createRoom(code, 'linkShare', 'drop-box-1');

      mock.timers.tick(TIME.ROOM_IDLE_TIMEOUT - MINUTE);
      const student = createMockSocket('late-student', '10.9.2.2');
      io.connect(student);
      student.trigger(EVENTS.SESSION.JOIN, { code, name: 'Bo', studentId: 'bo' });
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(student.emitted.find(e => e[0] === 'session:joined')?.[1].success, true);

      mock.timers.tick(TIME.CLEANUP_INTERVAL + 2 * MINUTE);
      assert.ok(sessionManager.getSession(code).getRoom('linkShare', 'drop-box-1'), 'the join kept the room');
      assert.deepEqual(roomClosedBroadcasts(), []);

      mock.timers.tick(TIME.ROOM_IDLE_TIMEOUT);
      assert.equal(sessionManager.getSession(code).getRoom('linkShare', 'drop-box-1'), undefined, 'then it goes idle');
    });

    it('keeps sweeping, and keeps the process up, when closing one idle room throws (10)', async () => {
      const { code } = await createSession();
      await createRoom(code, 'poll', 'broken-poll');
      await createRoom(code, 'poll', 'idle-poll');
      const closeNormally = sessionManager.roomExpiryHandler;
      sessionManager.setRoomExpiryHandler((session, roomType, widgetId) => {
        if (widgetId === 'broken-poll') throw new Error('boom');
        return closeNormally(session, roomType, widgetId);
      });

      assert.doesNotThrow(() => mock.timers.tick(TIME.ROOM_IDLE_TIMEOUT + TIME.CLEANUP_INTERVAL));

      const session = sessionManager.getSession(code);
      assert.equal(session.getRoom('poll', 'idle-poll'), undefined, 'the other idle room still closed');
      assert.deepEqual(roomClosedBroadcasts().map(b => b.data.widgetId), ['idle-poll']);

      sessionManager.setRoomExpiryHandler(closeNormally);
      mock.timers.tick(TIME.CLEANUP_INTERVAL);
      assert.equal(session.getRoom('poll', 'broken-poll'), undefined, 'a later sweep retries it');
    });

    it('closes only the idle room, not a busy sibling or the session (4)', async () => {
      const { code } = await createSession();
      await createRoom(code, 'poll', 'idle-poll');
      await createRoom(code, 'poll', 'busy-poll');

      // Touch the busy room every hour; never touch the idle one.
      const hours = Math.ceil((TIME.ROOM_IDLE_TIMEOUT + TIME.CLEANUP_INTERVAL) / (60 * MINUTE));
      for (let i = 0; i < hours; i++) {
        mock.timers.tick(60 * MINUTE);
        host.trigger(EVENTS.SESSION.UPDATE_WIDGET_STATE, {
          sessionCode: code, roomType: 'poll', widgetId: 'busy-poll', isActive: i % 2 === 0
        });
      }

      const session = sessionManager.getSession(code);
      assert.ok(session, 'the session survives');
      assert.equal(session.getRoom('poll', 'idle-poll'), undefined);
      assert.ok(session.getRoom('poll', 'busy-poll'));
      assert.deepEqual(roomClosedBroadcasts().map(b => b.data.widgetId), ['idle-poll']);
    });
  });

  describe('session inactivity sweep', () => {
    it('never deletes the session of a connected teacher, even with no students (8)', async () => {
      const { code } = await createSession();
      await createRoom(code, 'poll', 'poll-1');

      mock.timers.tick(TIME.INACTIVITY_TIMEOUT + TIME.CLEANUP_INTERVAL);

      assert.ok(sessionManager.getSession(code)?.getRoom('poll', 'poll-1'));
    });
  });

  describe('teacher disconnect grace period', () => {
    it('keeps the session and its rooms until HOST_RECONNECT_GRACE has passed, then closes them (5, 6)', async () => {
      const { code } = await createSession();
      await createRoom(code, 'poll', 'poll-1');

      host.trigger('disconnect');
      mock.timers.tick(TIME.HOST_RECONNECT_GRACE - MINUTE);
      assert.ok(sessionManager.getSession(code)?.getRoom('poll', 'poll-1'), 'still there just before the grace ends');
      assert.ok(!io.broadcasts.some(b => b.event === EVENTS.SESSION.CLOSED));

      mock.timers.tick(MINUTE);
      assert.equal(sessionManager.getSession(code), undefined, 'closed once the grace ends');
      assert.ok(io.broadcasts.some(b => b.event === EVENTS.SESSION.CLOSED && b.target === `session:${code}`));
    });

    it('a teacher who reconnects inside the grace period keeps the same session and room (5, 7)', async () => {
      const { code, hostToken } = await createSession();
      await createRoom(code, 'poll', 'poll-1');

      host.trigger('disconnect');
      mock.timers.tick(TIME.HOST_RECONNECT_GRACE - MINUTE);

      const returning = createMockSocket('teacher-host-2', '10.9.1.2');
      io.connect(returning);
      const reclaimed = await new Promise(resolve =>
        returning.trigger(EVENTS.SESSION.CREATE, { existingCode: code, hostToken }, resolve));
      assert.equal(reclaimed.code, code);
      assert.equal(reclaimed.isExisting, true);
      assert.deepEqual(reclaimed.activeRooms.map(r => r.widgetId), ['poll-1']);

      mock.timers.tick(TIME.HOST_RECONNECT_GRACE);
      assert.ok(sessionManager.getSession(code)?.getRoom('poll', 'poll-1'), 'the pending close was cancelled');
    });
  });
});
