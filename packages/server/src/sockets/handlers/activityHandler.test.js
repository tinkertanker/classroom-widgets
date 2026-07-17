// Silence handler warn/debug noise; must be set before the logger is required.
process.env.LOG_LEVEL = 'error';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const activityHandler = require('./activityHandler');
const Session = require('../../models/Session');
const { EVENTS } = require('../../config/constants');

/**
 * Integration tests for the activity socket handler: the complete flow of
 * socket communication between teacher and students, including hostile and
 * malformed payloads (which must never throw - a throwing handler would
 * crash the server process).
 */

function mockFn() {
  const fn = (...args) => {
    fn.calls.push(args);
  };
  fn.calls = [];
  fn.calledWith = (...expected) =>
    fn.calls.some(call => expected.every((arg, i) => Object.is(call[i], arg)));
  return fn;
}

function createMockSocket(id) {
  const handlers = {};
  return {
    id,
    on: (event, handler) => {
      handlers[event] = handler;
    },
    emit: mockFn(),
    join: mockFn(),
    leave: mockFn(),
    to: () => ({ emit: mockFn() }),
    // Helper to trigger an event as if it arrived from the network
    trigger: (event, data, callback) => {
      if (handlers[event]) {
        handlers[event](data, callback);
      }
    }
  };
}

function createMockIO() {
  const emitFn = mockFn();
  const to = mockFn();
  const target = { emit: emitFn };
  return {
    to: Object.assign((room) => {
      to.calls.push([room]);
      return target;
    }, { calls: to.calls, calledWith: (room) => to.calls.some(c => c[0] === room) }),
    emit: emitFn,
    _emitFn: emitFn
  };
}

// Find the payload of an emit call for a given event name
function emittedPayload(emitMock, eventName) {
  const call = emitMock.calls.findLast(c => c[0] === eventName);
  return call ? call[1] : undefined;
}

describe('Activity Socket Handler Integration', () => {
  let io;
  let hostSocket;
  let studentSocket;
  let sessionManager;
  let session;

  const SESSION_CODE = 'TEST1';
  const WIDGET_ID = 'widget-123';
  const HOST_SOCKET_ID = 'host-socket-id';
  const STUDENT_SOCKET_ID = 'student-socket-id';

  beforeEach(() => {
    io = createMockIO();
    hostSocket = createMockSocket(HOST_SOCKET_ID);
    studentSocket = createMockSocket(STUDENT_SOCKET_ID);

    session = new Session(SESSION_CODE);
    session.hostSocketId = HOST_SOCKET_ID;
    session.createRoom('activity', WIDGET_ID);
    session.addParticipant(STUDENT_SOCKET_ID, 'Test Student', STUDENT_SOCKET_ID);

    sessionManager = {
      getSession: (code) => (code === SESSION_CODE ? session : undefined)
    };

    activityHandler(io, hostSocket, sessionManager, () => SESSION_CODE);
    activityHandler(io, studentSocket, sessionManager, () => SESSION_CODE);
  });

  function setupActivity(overrides = {}) {
    const room = session.getRoom('activity', WIDGET_ID);
    room.setActivity({
      type: 'fill-blank',
      items: [
        { id: 'item-0', content: 'hello' },
        { id: 'item-1', content: 'world' }
      ],
      targets: [
        { id: 'blank-0', accepts: ['item-0'] },
        { id: 'blank-1', accepts: ['item-1'] }
      ],
      ...overrides
    });
    room.isActive = true;
    return room;
  }

  describe('teacher: activity update flow', () => {
    it('updates activity and broadcasts to the widget room', () => {
      hostSocket.trigger(EVENTS.ACTIVITY.UPDATE, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID,
        activity: {
          type: 'fill-blank',
          title: 'Test Activity',
          items: [{ id: 'item-0', content: 'hello' }],
          targets: [{ id: 'blank-0', accepts: ['item-0'] }],
          uiRecipe: []
        }
      });

      assert.ok(io.to.calledWith(`${SESSION_CODE}:activity:${WIDGET_ID}`));

      const room = session.getRoom('activity', WIDGET_ID);
      assert.equal(room.activity.type, 'fill-blank');
      assert.equal(room.activity.title, 'Test Activity');
    });

    it('rejects update from non-host socket', () => {
      studentSocket.trigger(EVENTS.ACTIVITY.UPDATE, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID,
        activity: { type: 'fill-blank', items: [], targets: [] }
      });

      assert.equal(session.getRoom('activity', WIDGET_ID).activity, null);
    });

    it('rejects update with invalid widget ID', () => {
      hostSocket.trigger(EVENTS.ACTIVITY.UPDATE, {
        sessionCode: SESSION_CODE,
        widgetId: '',
        activity: { type: 'fill-blank', items: [], targets: [] }
      });

      assert.equal(io.to.calls.length, 0);
    });
  });

  describe('student: submit answer flow', () => {
    beforeEach(() => {
      setupActivity();
    });

    it('accepts correct answer, sends feedback and notifies the teacher', () => {
      const callback = mockFn();

      studentSocket.trigger(EVENTS.ACTIVITY.SUBMIT, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID,
        answers: {
          placements: [
            { itemId: 'item-0', targetId: 'blank-0' },
            { itemId: 'item-1', targetId: 'blank-1' }
          ],
          textInputs: {}
        }
      }, callback);

      assert.equal(callback.calls.length, 1);
      const response = callback.calls[0][0];
      assert.equal(response.success, true);
      assert.equal(response.results.score, 2);
      assert.equal(response.results.total, 2);

      const feedback = emittedPayload(studentSocket.emit, EVENTS.ACTIVITY.FEEDBACK);
      assert.ok(feedback, 'feedback should be emitted to the student');
      assert.equal(feedback.widgetId, WIDGET_ID);
      assert.equal(feedback.results.score, 2);

      assert.ok(io.to.calledWith(HOST_SOCKET_ID), 'teacher should be notified');
      const received = emittedPayload(io._emitFn, EVENTS.ACTIVITY.RESPONSE_RECEIVED);
      assert.equal(received.studentId, STUDENT_SOCKET_ID);
      assert.equal(received.results.score, 2);
    });

    it('scores partially correct answers', () => {
      const callback = mockFn();

      studentSocket.trigger(EVENTS.ACTIVITY.SUBMIT, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID,
        answers: {
          placements: [
            { itemId: 'item-0', targetId: 'blank-0' }, // correct
            { itemId: 'item-0', targetId: 'blank-1' }  // wrong (should be item-1)
          ],
          textInputs: {}
        }
      }, callback);

      const response = callback.calls[0][0];
      assert.equal(response.results.score, 1);
      assert.equal(response.results.total, 2);
    });

    it('accepts text input answers', () => {
      const callback = mockFn();

      studentSocket.trigger(EVENTS.ACTIVITY.SUBMIT, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID,
        answers: {
          placements: [],
          textInputs: { 'blank-0': 'hello', 'blank-1': 'world' }
        }
      }, callback);

      const response = callback.calls[0][0];
      assert.equal(response.success, true);
      assert.equal(response.results.score, 2);
    });

    it('rejects submission when activity is paused', () => {
      session.getRoom('activity', WIDGET_ID).isActive = false;
      const callback = mockFn();

      studentSocket.trigger(EVENTS.ACTIVITY.SUBMIT, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID,
        answers: { placements: [], textInputs: {} }
      }, callback);

      const response = callback.calls[0][0];
      assert.equal(response.success, false);
      assert.equal(response.error.code, 'WIDGET_PAUSED');
    });

    it('rejects submission from non-participant', () => {
      session.removeParticipant(STUDENT_SOCKET_ID);
      const callback = mockFn();

      studentSocket.trigger(EVENTS.ACTIVITY.SUBMIT, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID,
        answers: { placements: [], textInputs: {} }
      }, callback);

      const response = callback.calls[0][0];
      assert.equal(response.success, false);
      assert.equal(response.error.code, 'NOT_PARTICIPANT');
    });
  });

  describe('student: retry flow', () => {
    beforeEach(() => {
      const room = setupActivity({
        items: [{ id: 'item-0', content: 'test' }],
        targets: [{ id: 'blank-0', accepts: ['item-0'] }]
      });
      room.submitAnswer(STUDENT_SOCKET_ID, {
        placements: [],
        textInputs: { 'blank-0': 'wrong' }
      });
    });

    it('allows retry and clears previous response', () => {
      const callback = mockFn();

      studentSocket.trigger(EVENTS.ACTIVITY.RETRY, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID
      }, callback);

      assert.equal(callback.calls[0][0].success, true);
      assert.equal(session.getRoom('activity', WIDGET_ID).responses.has(STUDENT_SOCKET_ID), false);

      const retryReady = emittedPayload(studentSocket.emit, EVENTS.ACTIVITY.RETRY_READY);
      assert.ok(retryReady);
      assert.equal(retryReady.widgetId, WIDGET_ID);
      assert.equal(retryReady.results, null);
    });

    it('rejects retry when not allowed', () => {
      session.getRoom('activity', WIDGET_ID).allowRetry = false;
      const callback = mockFn();

      studentSocket.trigger(EVENTS.ACTIVITY.RETRY, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID
      }, callback);

      const response = callback.calls[0][0];
      assert.equal(response.success, false);
      assert.equal(response.error.code, 'RETRY_NOT_ALLOWED');
    });
  });

  describe('teacher: reveal answers flow', () => {
    beforeEach(() => {
      setupActivity({
        items: [{ id: 'item-0', content: 'answer' }],
        targets: [{ id: 'blank-0', accepts: ['item-0'] }]
      });
    });

    it('reveals answers to all students', () => {
      hostSocket.trigger(EVENTS.ACTIVITY.REVEAL, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID,
        reveal: true
      });

      assert.ok(io.to.calledWith(`${SESSION_CODE}:activity:${WIDGET_ID}`));
      assert.equal(session.getRoom('activity', WIDGET_ID).answersRevealed, true);

      const revealed = emittedPayload(io._emitFn, EVENTS.ACTIVITY.REVEALED);
      assert.deepEqual(revealed.correctAnswers, { 'blank-0': 'item-0' });
    });

    it('hides answers when reveal is false and does not broadcast REVEALED', () => {
      const room = session.getRoom('activity', WIDGET_ID);
      room.answersRevealed = true;

      hostSocket.trigger(EVENTS.ACTIVITY.REVEAL, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID,
        reveal: false
      });

      assert.equal(room.answersRevealed, false);
      assert.equal(emittedPayload(io._emitFn, EVENTS.ACTIVITY.REVEALED), undefined);
    });

    it('rejects reveal from non-host', () => {
      studentSocket.trigger(EVENTS.ACTIVITY.REVEAL, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID,
        reveal: true
      });

      assert.equal(session.getRoom('activity', WIDGET_ID).answersRevealed, false);
    });
  });

  describe('teacher: reset activity flow', () => {
    beforeEach(() => {
      const room = setupActivity({
        items: [{ id: 'item-0', content: 'test' }],
        targets: [{ id: 'blank-0', accepts: ['item-0'] }]
      });
      room.submitAnswer('student-1', { placements: [], textInputs: {} });
      room.submitAnswer('student-2', { placements: [], textInputs: {} });
      room.answersRevealed = true;
    });

    it('resets all responses and reveal state', () => {
      hostSocket.trigger(EVENTS.ACTIVITY.RESET, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID
      });

      const room = session.getRoom('activity', WIDGET_ID);
      assert.equal(room.getResponseCount(), 0);
      assert.equal(room.answersRevealed, false);
      assert.ok(io.to.calledWith(`${SESSION_CODE}:activity:${WIDGET_ID}`));
    });

    it('rejects reset from non-host', () => {
      studentSocket.trigger(EVENTS.ACTIVITY.RESET, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID
      });

      assert.equal(session.getRoom('activity', WIDGET_ID).getResponseCount(), 2);
    });
  });

  describe('student: request state flow', () => {
    beforeEach(() => {
      setupActivity({
        title: 'State Test',
        items: [{ id: 'item-0', content: 'test' }],
        targets: [{ id: 'blank-0', accepts: ['item-0'] }]
      });
    });

    it('returns current activity state and widget active state', () => {
      studentSocket.trigger(EVENTS.ACTIVITY.REQUEST_STATE, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID
      });

      const state = emittedPayload(studentSocket.emit, EVENTS.ACTIVITY.STATE_UPDATE);
      assert.equal(state.widgetId, WIDGET_ID);
      assert.equal(state.activity.title, 'State Test');
      assert.equal(state.isActive, true);

      const widgetState = emittedPayload(studentSocket.emit, EVENTS.SESSION.WIDGET_STATE_CHANGED);
      assert.deepEqual(widgetState, { roomType: 'activity', widgetId: WIDGET_ID, isActive: true });
    });

    it('includes results if the student has submitted', () => {
      session.getRoom('activity', WIDGET_ID).submitAnswer(STUDENT_SOCKET_ID, {
        placements: [{ itemId: 'item-0', targetId: 'blank-0' }],
        textInputs: {}
      });

      studentSocket.trigger(EVENTS.ACTIVITY.REQUEST_STATE, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID
      });

      const state = emittedPayload(studentSocket.emit, EVENTS.ACTIVITY.STATE_UPDATE);
      assert.equal(state.results.score, 1);
      assert.equal(state.results.total, 1);
    });

    it('includes correct answers if revealed', () => {
      session.getRoom('activity', WIDGET_ID).answersRevealed = true;

      studentSocket.trigger(EVENTS.ACTIVITY.REQUEST_STATE, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID
      });

      const state = emittedPayload(studentSocket.emit, EVENTS.ACTIVITY.STATE_UPDATE);
      assert.deepEqual(state.correctAnswers, { 'blank-0': 'item-0' });
    });
  });

  describe('code fill-in-blank: whitespace flexible evaluation', () => {
    it('accepts answers with extra whitespace', () => {
      setupActivity({
        type: 'code-fill-blank',
        items: [
          { id: 'item-0', content: 'def' },
          { id: 'item-1', content: 'return' }
        ]
      });
      const callback = mockFn();

      studentSocket.trigger(EVENTS.ACTIVITY.SUBMIT, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID,
        answers: {
          placements: [],
          textInputs: { 'blank-0': '  def  ', 'blank-1': 'return' }
        }
      }, callback);

      const response = callback.calls[0][0];
      assert.equal(response.results.score, 2);
      assert.equal(response.results.total, 2);
    });
  });

  describe('error handling and hostile payloads', () => {
    it('rejects unknown session code', () => {
      const callback = mockFn();

      studentSocket.trigger(EVENTS.ACTIVITY.SUBMIT, {
        sessionCode: 'NOSUCH',
        widgetId: WIDGET_ID,
        answers: { placements: [], textInputs: {} }
      }, callback);

      const response = callback.calls[0][0];
      assert.equal(response.success, false);
      assert.equal(response.error.code, 'INVALID_SESSION');
    });

    it('rejects unknown widget room', () => {
      const callback = mockFn();

      studentSocket.trigger(EVENTS.ACTIVITY.SUBMIT, {
        sessionCode: SESSION_CODE,
        widgetId: 'nonexistent-widget',
        answers: { placements: [], textInputs: {} }
      }, callback);

      const response = callback.calls[0][0];
      assert.equal(response.success, false);
      assert.equal(response.error.code, 'ROOM_NOT_FOUND');
    });

    it('survives null/undefined/non-object payloads on every event', () => {
      const events = [
        EVENTS.ACTIVITY.UPDATE,
        EVENTS.ACTIVITY.REVEAL,
        EVENTS.ACTIVITY.RESET,
        EVENTS.ACTIVITY.REQUEST_STATE,
        EVENTS.ACTIVITY.SUBMIT,
        EVENTS.ACTIVITY.RETRY
      ];

      for (const event of events) {
        for (const payload of [null, undefined, 'string', 42, true]) {
          hostSocket.trigger(event, payload);
          studentSocket.trigger(event, payload, mockFn());
        }
      }
      // Reaching here without a throw is the assertion; state must be untouched.
      assert.equal(session.getRoom('activity', WIDGET_ID).activity, null);
    });

    it('survives malformed answers payloads without crashing', () => {
      setupActivity();

      for (const answers of [null, 'string', 42, [], { placements: 'x' }, { textInputs: { 'blank-0': 123 } }]) {
        const callback = mockFn();
        studentSocket.trigger(EVENTS.ACTIVITY.SUBMIT, {
          sessionCode: SESSION_CODE,
          widgetId: WIDGET_ID,
          answers
        }, callback);

        const response = callback.calls[0][0];
        assert.equal(response.success, true, `answers ${JSON.stringify(answers)} should degrade to a zero score`);
        assert.equal(response.results.score, 0);
      }
    });

    it('does not throw when submit/retry are triggered without a callback', () => {
      setupActivity();

      studentSocket.trigger(EVENTS.ACTIVITY.SUBMIT, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID,
        answers: { placements: [], textInputs: {} }
      });
      studentSocket.trigger(EVENTS.ACTIVITY.RETRY, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID
      });
      studentSocket.trigger(EVENTS.ACTIVITY.SUBMIT, {
        sessionCode: 'NOSUCH',
        widgetId: WIDGET_ID,
        answers: null
      });
    });
  });
});
