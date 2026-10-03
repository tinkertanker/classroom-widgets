process.env.LOG_LEVEL = 'error';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const sessionHandler = require('./sessionHandler');
const Session = require('../../models/Session');
const { EVENTS, LIMITS } = require('../../config/constants');

function mockFn() {
  const fn = (...args) => {
    fn.calls.push(args);
  };
  fn.calls = [];
  return fn;
}

let socketCounter = 0;

function createMockSocket(id) {
  const handlers = {};
  return {
    id,
    data: {},
    // Unique per test so the per-connection rate limiter never carries over
    clientIP: `10.0.0.${++socketCounter}`,
    handshake: { headers: {}, secure: false },
    on: (event, handler) => {
      handlers[event] = handler;
    },
    emit: mockFn(),
    join: mockFn(),
    leave: mockFn(),
    trigger: (event, data, callback) => handlers[event] && handlers[event](data, callback)
  };
}

function createMockIO() {
  const emitFn = mockFn();
  return {
    to: () => ({ emit: emitFn }),
    emit: emitFn,
    _emitFn: emitFn
  };
}

function joinedResponse(socket) {
  const call = socket.emit.calls.findLast(c => c[0] === 'session:joined');
  return call ? call[1] : undefined;
}

describe('sessionHandler: student join', () => {
  const SESSION_CODE = 'TEST12';
  let io;
  let socket;
  let session;
  let sessionManager;

  beforeEach(() => {
    io = createMockIO();
    socket = createMockSocket('student-1');
    session = new Session(SESSION_CODE);
    session.hostSocketId = 'host-1';
    sessionManager = {
      findSessionByHost: () => undefined,
      getSession: (code) => (code === SESSION_CODE ? session : undefined)
    };
    sessionHandler(io, socket, sessionManager, () => null);
  });

  async function join(data) {
    socket.trigger(EVENTS.SESSION.JOIN, data);
    // Handler is async; give the microtask queue a tick
    await new Promise(resolve => setImmediate(resolve));
    return joinedResponse(socket);
  }

  it('rejects missing code or name', async () => {
    for (const data of [{}, { code: SESSION_CODE }, { name: 'Ada' }, { code: SESSION_CODE, name: '' }]) {
      socket.emit.calls.length = 0;
      const response = await join(data);
      assert.equal(response.success, false, JSON.stringify(data));
    }
    assert.equal(session.getParticipantCount(), 0);
  });

  it('rejects non-string code and name payloads without throwing', async () => {
    for (const data of [
      { code: 42, name: 'Ada' },
      { code: SESSION_CODE, name: { toString: 'evil' } },
      { code: ['TEST1'], name: 'Ada' }
    ]) {
      socket.emit.calls.length = 0;
      const response = await join(data);
      assert.equal(response.success, false, JSON.stringify(data));
    }
  });

  it('truncates oversized names instead of storing megabytes', async () => {
    const hugeName = 'A'.repeat(100_000);
    const response = await join({ code: SESSION_CODE, name: hugeName });

    assert.equal(response.success, true);
    const stored = session.getParticipant('student-1').name;
    assert.equal(stored.length, LIMITS.MAX_STUDENT_NAME_LENGTH);
  });

  it('falls back to socket.id for hostile studentId payloads', async () => {
    for (const studentId of ['x'.repeat(101), 42, {}, [], '']) {
      session.removeParticipant('student-1');
      const response = await join({ code: SESSION_CODE, name: 'Ada', studentId });
      assert.equal(response.success, true);
      assert.equal(session.getParticipant('student-1').studentId, 'student-1', JSON.stringify(studentId));
    }
  });

  it('keeps a legitimate studentId', async () => {
    await join({ code: SESSION_CODE, name: 'Ada', studentId: 'device-abc-123' });
    assert.equal(session.getParticipant('student-1').studentId, 'device-abc-123');
  });

  it('rejects joining an unknown session', async () => {
    const response = await join({ code: 'NOSUCH', name: 'Ada' });
    assert.equal(response.success, false);
    assert.match(response.error, /not found/i);
  });

  it('rejects joins once the session participant limit is reached', async () => {
    session.getParticipantCount = () => LIMITS.MAX_PARTICIPANTS_PER_SESSION;

    const response = await join({ code: SESSION_CODE, name: 'Ada' });

    assert.equal(response.success, false);
    assert.equal(response.error, 'SESSION_FULL');
  });

  it('notifies the host with the participant count only', async () => {
    await join({ code: SESSION_CODE, name: 'Ada' });

    const update = io._emitFn.calls.findLast(c => c[0] === EVENTS.SESSION.PARTICIPANT_UPDATE);
    assert.ok(update, 'host should receive participant update');
    assert.deepEqual(update[1], { count: 1 });
  });

  it('joins the student into all active widget rooms', async () => {
    session.createRoom('poll', 'w-1');
    session.createRoom('questions', 'w-2');

    await join({ code: SESSION_CODE, name: 'Ada' });

    const joinedRooms = socket.join.calls.map(c => c[0]);
    assert.ok(joinedRooms.includes(`session:${SESSION_CODE}`));
    assert.ok(joinedRooms.includes(`${SESSION_CODE}:poll:w-1`));
    assert.ok(joinedRooms.includes(`${SESSION_CODE}:questions:w-2`));
  });
});

describe('sessionHandler: host session:create', () => {
  const CODE = 'TEST1';
  let io;
  let socket;
  let session;
  let sessionManager;

  beforeEach(() => {
    io = createMockIO();
    socket = createMockSocket('new-host');
    session = new Session(CODE);
    session.hostSocketId = 'host-1';
    sessionManager = {
      findSessionByHost: () => undefined,
      getSession: (code) => (code === CODE ? session : undefined),
      createSession: () => new Session('NEW01')
    };
    sessionHandler(io, socket, sessionManager, () => null);
  });

  async function create(data) {
    let response;
    socket.trigger(EVENTS.SESSION.CREATE, data, (r) => { response = r; });
    await new Promise(resolve => setImmediate(resolve));
    return response;
  }

  it('refuses to reclaim an existing session without a token', async () => {
    const response = await create({ existingCode: CODE });

    assert.equal(response.success, true);
    assert.equal(response.isExisting, false);
    assert.equal(response.code, 'NEW01');
    assert.equal(session.hostSocketId, 'host-1');
    assert.equal(io._emitFn.calls.find(c => c[0] === EVENTS.SESSION.HOST_RECONNECTED), undefined);
  });

  it('refuses to reclaim an existing session with a wrong token', async () => {
    const response = await create({ existingCode: CODE, hostToken: 'not-the-token' });

    assert.equal(response.success, true);
    assert.equal(response.isExisting, false);
    assert.equal(response.code, 'NEW01');
    assert.equal(session.hostSocketId, 'host-1');
    assert.equal(io._emitFn.calls.find(c => c[0] === EVENTS.SESSION.HOST_RECONNECTED), undefined);
  });

  it('reclaims the session when the host token matches', async () => {
    const originalToken = session.hostToken;
    const response = await create({ existingCode: CODE, hostToken: originalToken });

    assert.equal(response.success, true);
    assert.equal(response.isExisting, true);
    assert.equal(response.code, CODE);
    assert.equal(session.hostSocketId, socket.id);
    assert.ok(io._emitFn.calls.find(c => c[0] === EVENTS.SESSION.HOST_RECONNECTED));

    // The reclaim rotates the token: the response carries the fresh one
    assert.notEqual(response.hostToken, originalToken);
    assert.equal(response.hostToken, session.hostToken);
  });

  // The rotated token reaches the host only in the acknowledgement, which can
  // be lost (#78). The pre-rotation token therefore stays valid until the
  // rotated one is presented, and never after: at most one stale token works.
  it('accepts the pre-rotation token only until the rotated one is presented', async () => {
    const originalToken = session.hostToken;
    const first = await create({ existingCode: CODE, hostToken: originalToken });
    const rotatedToken = first.hostToken;

    const attempt = async (id, hostToken) => {
      const peer = createMockSocket(id);
      sessionHandler(io, peer, sessionManager, () => null);
      let result;
      peer.trigger(EVENTS.SESSION.CREATE, { existingCode: CODE, hostToken }, (r) => { result = r; });
      await new Promise(resolve => setImmediate(resolve));
      return { peer, result };
    };

    // The host whose ack was lost still holds the original token
    const lostAck = await attempt('lost-ack', originalToken);
    assert.equal(lostAck.result.isExisting, true);
    assert.equal(lostAck.result.hostToken, rotatedToken, 'it is handed the token it missed');
    assert.equal(session.hostSocketId, lostAck.peer.id);

    // Presenting the rotated token retires the original one
    const reclaim = await attempt('reclaimer', rotatedToken);
    assert.equal(reclaim.result.success, true);
    assert.equal(reclaim.result.isExisting, true);
    assert.equal(session.hostSocketId, reclaim.peer.id);

    const replay = await attempt('attacker', originalToken);
    assert.equal(replay.result.success, true);
    assert.equal(replay.result.isExisting, false);
    assert.equal(replay.result.code, 'NEW01');
    assert.equal(session.hostSocketId, reclaim.peer.id);
  });
});
