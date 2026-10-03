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
    data: {},
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

  // 11. A teacher opening the app the day after gets a new session, and a join
  //     code on screen, they never started, because recovery of the stored
  //     code falls back to creating one. Older clients rely on that fallback.
  describe('reclaim-only recovery (11)', () => {
    const reclaim = (socket, data) => new Promise(resolve => socket.trigger(EVENTS.SESSION.CREATE, data, resolve));

    it('refuses without creating a session when the stored one is gone', async () => {
      const result = await reclaim(host, { existingCode: 'GONE42', hostToken: 'old', reclaimOnly: true });

      assert.deepEqual(result, { success: false, error: 'Session not found' });
      assert.equal(sessionManager.sessions.size, 0);
    });

    it('refuses without creating a session, or touching the old one, when the token is wrong', async () => {
      const { code } = await createSession();
      host.trigger('disconnect');
      const other = createMockSocket('teacher-other', '10.9.1.3');
      io.connect(other);

      const result = await reclaim(other, { existingCode: code, hostToken: 'wrong', reclaimOnly: true });

      assert.deepEqual(result, { success: false, error: 'Session not found' });
      assert.equal(sessionManager.sessions.size, 1);
      assert.equal(sessionManager.getSession(code).hostSocketId, 'teacher-host');
    });

    it('still reclaims a live session', async () => {
      const { code, hostToken } = await createSession();
      host.trigger('disconnect');
      const returning = createMockSocket('teacher-back', '10.9.1.4');
      io.connect(returning);

      const result = await reclaim(returning, { existingCode: code, hostToken, reclaimOnly: true });

      assert.equal(result.success, true);
      assert.equal(result.code, code);
      assert.equal(result.isExisting, true);
    });

    it('keeps the create-a-new-session fallback for clients that do not send the flag', async () => {
      const result = await reclaim(host, { existingCode: 'GONE42', hostToken: 'old' });

      assert.equal(result.success, true);
      assert.equal(result.isExisting, false);
      assert.notEqual(result.code, 'GONE42');
    });
  });

  // 12. The server rotates the host token before its acknowledgement reaches
  //     the teacher. If that ack is lost (Wi-Fi flap mid-reclaim), the only
  //     token the teacher holds is refused on the next reconnect, and the
  //     session and its students live on for 30 minutes with no teacher.
  // 13. Tolerating that leaves old tokens valid forever: more than one stale
  //     token must never reclaim the session.
  describe('host token after a lost reclaim acknowledgement (12, 13)', () => {
    const reclaim = (socket, data) => new Promise(resolve => socket.trigger(EVENTS.SESSION.CREATE, data, resolve));
    const reconnect = (id) => {
      const socket = createMockSocket(id, `10.9.3.${id.length}`);
      io.connect(socket);
      return socket;
    };

    it('reclaims with the token the teacher still holds after a lost ack, then retires it', async () => {
      const { code, hostToken: firstToken } = await createSession();
      await createRoom(code, 'poll', 'poll-1');
      host.trigger('disconnect');

      // Flap 1: reclaim succeeds on the server, but the ack never arrives
      const lostAck = reconnect('flap-1');
      const unseen = await reclaim(lostAck, { existingCode: code, hostToken: firstToken, reclaimOnly: true });
      assert.equal(unseen.success, true);
      lostAck.trigger('disconnect');

      // Flap 2: the client still only has the first token
      const retry = reconnect('flap-2');
      const recovered = await reclaim(retry, { existingCode: code, hostToken: firstToken, reclaimOnly: true });
      assert.equal(recovered.success, true, 'the stale token held by the teacher is accepted');
      assert.equal(recovered.code, code);
      assert.equal(recovered.isExisting, true);
      assert.deepEqual(recovered.activeRooms.map(r => r.widgetId), ['poll-1']);
      assert.equal(sessionManager.getSession(code).hostSocketId, 'flap-2');
      assert.notEqual(recovered.hostToken, firstToken);

      // Presenting the current token retires the stale one (13)
      retry.trigger('disconnect');
      const next = reconnect('flap-3');
      const current = await reclaim(next, { existingCode: code, hostToken: recovered.hostToken, reclaimOnly: true });
      assert.equal(current.success, true);
      next.trigger('disconnect');
      const replay = reconnect('flap-4');
      const refused = await reclaim(replay, { existingCode: code, hostToken: firstToken, reclaimOnly: true });
      assert.deepEqual(refused, { success: false, error: 'Session not found' });
      const stillOk = await reclaim(replay, { existingCode: code, hostToken: current.hostToken, reclaimOnly: true });
      assert.equal(stillOk.success, true);
    });
  });

  // 14. After a normal reclaim the teacher stays connected all lesson, and the
  //     token it presented keeps reclaiming the session (and hands out the
  //     current token) the whole time: a leaked old token hijacks the class.
  describe('retiring the presented token (14)', () => {
    const reclaim = (socket, data) => new Promise(resolve => socket.trigger(EVENTS.SESSION.CREATE, data, resolve));
    const setUp = async () => {
      const { code, hostToken: oldToken } = await createSession();
      host.trigger('disconnect');
      const teacher = createMockSocket('teacher-back', '10.9.4.1');
      io.connect(teacher);
      const result = await reclaim(teacher, { existingCode: code, hostToken: oldToken, reclaimOnly: true });
      assert.equal(result.success, true);
      return { code, oldToken, newToken: result.hostToken, teacher };
    };
    const attackWith = async (code, token) => {
      const attacker = createMockSocket('attacker', '10.9.5.1');
      io.connect(attacker);
      return reclaim(attacker, { existingCode: code, hostToken: token, reclaimOnly: true });
    };

    it('still accepts the old token within the window, before any host event', async () => {
      const { code, oldToken } = await setUp();

      mock.timers.tick(TIME.PREVIOUS_HOST_TOKEN_MAX_AGE - 1);

      assert.equal(sessionManager.getSession(code).isValidHostToken(oldToken), true);
    });

    it('refuses the old token once the reclaiming socket sends a host event', async () => {
      const { code, oldToken, newToken, teacher } = await setUp();

      teacher.trigger(EVENTS.SESSION.CLEANUP_ROOMS, { sessionCode: code, activeWidgetIds: [] });

      assert.deepEqual(await attackWith(code, oldToken), { success: false, error: 'Session not found' });
      assert.equal(sessionManager.getSession(code).hostSocketId, 'teacher-back');
      assert.equal(sessionManager.getSession(code).isValidHostToken(newToken), true);
    });

    it('refuses the old token once the window has passed, even with no host event', async () => {
      const { code, oldToken, newToken } = await setUp();

      mock.timers.tick(TIME.PREVIOUS_HOST_TOKEN_MAX_AGE);

      assert.deepEqual(await attackWith(code, oldToken), { success: false, error: 'Session not found' });
      assert.equal(sessionManager.getSession(code).isValidHostToken(newToken), true);
    });

    it('does not extend the window when the old token is presented again', async () => {
      const { code, oldToken, teacher } = await setUp();
      mock.timers.tick(TIME.PREVIOUS_HOST_TOKEN_MAX_AGE / 2);
      teacher.trigger('disconnect');
      const again = createMockSocket('teacher-again', '10.9.4.2');
      io.connect(again);
      assert.equal((await reclaim(again, { existingCode: code, hostToken: oldToken, reclaimOnly: true })).success, true);

      mock.timers.tick(TIME.PREVIOUS_HOST_TOKEN_MAX_AGE / 2);

      assert.equal(sessionManager.getSession(code).isValidHostToken(oldToken), false);
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
