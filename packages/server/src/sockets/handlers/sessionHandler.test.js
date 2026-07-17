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

function createMockSocket(id) {
  const handlers = {};
  return {
    id,
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
  const SESSION_CODE = 'TEST1';
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

  it('joins with a valid code and name', async () => {
    const response = await join({ code: SESSION_CODE, name: 'Ada' });

    assert.equal(response.success, true);
    assert.equal(response.participantId, 'student-1');
    assert.equal(session.getParticipant('student-1').name, 'Ada');
  });

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

  it('rejects whitespace-only names', async () => {
    const response = await join({ code: SESSION_CODE, name: '   \n ' });
    assert.equal(response.success, false);
    assert.equal(session.getParticipantCount(), 0);
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

  it('notifies the host with updated participant list', async () => {
    await join({ code: SESSION_CODE, name: 'Ada' });

    const update = io._emitFn.calls.findLast(c => c[0] === EVENTS.SESSION.PARTICIPANT_UPDATE);
    assert.ok(update, 'host should receive participant update');
    assert.equal(update[1].count, 1);
    assert.equal(update[1].participants[0].name, 'Ada');
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
