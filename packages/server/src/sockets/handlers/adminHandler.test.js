process.env.LOG_LEVEL = 'error';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const adminHandler = require('./adminHandler');
const Session = require('../../models/Session');

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

describe('adminHandler: admin:getSessions', () => {
  const SESSION_CODE = 'TEST1';
  let io;
  let socket;
  let session;
  let sessionManager;

  beforeEach(() => {
    io = createMockIO();
    socket = createMockSocket('admin-1');
    session = new Session(SESSION_CODE);
    session.hostSocketId = 'host-1';
    sessionManager = {
      sessions: new Map([[SESSION_CODE, session]]),
      getStats: () => ({})
    };
    adminHandler(io, socket, sessionManager);
  });

  function getSessions() {
    const callback = mockFn();
    socket.trigger('admin:getSessions', {}, callback);
    assert.equal(callback.calls.length, 1);
    const [response] = callback.calls[0];
    assert.equal(response.success, true);
    return response;
  }

  it('returns room count summaries without calling toJSON', () => {
    const poll = session.createRoom('poll', 'w-poll');
    poll.setPollData({ question: 'Favourite colour?', options: ['Red', 'Blue'] });
    poll.isActive = true;
    poll.vote('student-1', 0);
    poll.vote('student-2', 1);

    const questions = session.createRoom('questions', 'w-questions');
    questions.addQuestion('student-1', 'Why?', 'Ada');
    questions.addQuestion('student-2', 'How?', 'Bob');

    const linkShare = session.createRoom('linkShare', 'w-links');
    linkShare.addSubmission('Ada', 'https://example.com');

    const rtfeedback = session.createRoom('rtfeedback', 'w-rt');
    rtfeedback.updateFeedback('student-1', 4);
    rtfeedback.updateFeedback('student-2', 3);

    // The admin summary must use cheap accessors, not full serialization
    for (const room of [poll, questions, linkShare, rtfeedback]) {
      room.toJSON = () => {
        throw new Error('toJSON should not be called');
      };
    }

    const response = getSessions();
    assert.equal(response.sessions.length, 1);

    const rooms = response.sessions[0].activeRooms;
    assert.equal(rooms.length, 4);

    const byType = Object.fromEntries(rooms.map(r => [r.roomType, r]));

    assert.equal(byType.poll.pollQuestion, 'Favourite colour?');
    assert.equal(byType.poll.totalVotes, 2);
    assert.equal(byType.poll.isActive, true);

    assert.equal(byType.questions.questionCount, 2);
    assert.equal(byType.linkShare.submissionCount, 1);
    assert.equal(byType.rtfeedback.responseCount, 2);
  });

  it('reports inactive rooms as not active', () => {
    session.createRoom('rtfeedback', 'w-rt');

    const response = getSessions();
    const [room] = response.sessions[0].activeRooms;
    assert.equal(room.isActive, false);
    assert.equal(room.responseCount, 0);
  });
});
