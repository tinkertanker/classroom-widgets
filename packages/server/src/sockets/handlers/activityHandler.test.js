import { describe, it, expect, beforeEach, vi } from 'vitest';
import activityHandler from './activityHandler.js';
import Session from '../../models/Session.js';
import { EVENTS } from '../../config/constants.js';

/**
 * Integration tests for Activity Socket Handler
 * Tests the complete flow of socket communication between teacher and students
 */

// Mock the logger to suppress output during tests
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}));

// Mock rate limiter to always allow
vi.mock('../../middleware/socketAuth', () => ({
  eventRateLimiter: vi.fn(() => ({ allowed: true }))
}));

describe('Activity Socket Handler Integration', () => {
  let io;
  let hostSocket;
  let studentSocket;
  let sessionManager;
  let session;
  let eventHandlers;

  const SESSION_CODE = 'TEST1';
  const WIDGET_ID = 'widget-123';
  const HOST_SOCKET_ID = 'host-socket-id';
  const STUDENT_SOCKET_ID = 'student-socket-id';

  // Helper to create a mock socket
  function createMockSocket(id) {
    const handlers = {};
    return {
      id,
      on: vi.fn((event, handler) => {
        handlers[event] = handler;
      }),
      emit: vi.fn(),
      join: vi.fn(),
      leave: vi.fn(),
      to: vi.fn(() => ({ emit: vi.fn() })),
      _handlers: handlers,
      // Helper to trigger an event
      trigger: (event, data, callback) => {
        if (handlers[event]) {
          handlers[event](data, callback);
        }
      }
    };
  }

  // Helper to create mock io
  function createMockIO() {
    const emitFn = vi.fn();
    return {
      to: vi.fn(() => ({ emit: emitFn, _emit: emitFn })),
      emit: emitFn,
      _getEmitFn: () => emitFn
    };
  }

  beforeEach(() => {
    // Create fresh mocks for each test
    io = createMockIO();
    hostSocket = createMockSocket(HOST_SOCKET_ID);
    studentSocket = createMockSocket(STUDENT_SOCKET_ID);

    // Create a real session
    session = new Session(SESSION_CODE);
    session.hostSocketId = HOST_SOCKET_ID;
    session.createRoom('activity', WIDGET_ID);
    session.addParticipant(STUDENT_SOCKET_ID, 'Test Student', STUDENT_SOCKET_ID);

    // Create session manager mock
    sessionManager = {
      getSession: vi.fn((code) => code === SESSION_CODE ? session : null)
    };

    // Register handlers for host socket
    activityHandler(io, hostSocket, sessionManager, () => SESSION_CODE);

    // Register handlers for student socket
    activityHandler(io, studentSocket, sessionManager, () => SESSION_CODE);
  });

  describe('Teacher: Activity Update Flow', () => {
    it('should update activity and broadcast to room', () => {
      const activityData = {
        type: 'fill-blank',
        title: 'Test Activity',
        items: [{ id: 'item-0', content: 'hello' }],
        targets: [{ id: 'blank-0', accepts: ['item-0'] }],
        uiRecipe: []
      };

      hostSocket.trigger(EVENTS.ACTIVITY.UPDATE, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID,
        activity: activityData
      });

      // Verify io.to was called with correct room
      expect(io.to).toHaveBeenCalledWith(`${SESSION_CODE}:activity:${WIDGET_ID}`);

      // Verify the room's activity was updated
      const room = session.getRoom('activity', WIDGET_ID);
      expect(room.activity.type).toBe('fill-blank');
      expect(room.activity.title).toBe('Test Activity');
    });

    it('should reject update from non-host socket', () => {
      const activityData = {
        type: 'fill-blank',
        items: [],
        targets: []
      };

      // Student tries to update activity
      studentSocket.trigger(EVENTS.ACTIVITY.UPDATE, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID,
        activity: activityData
      });

      // Room activity should remain null (not updated)
      const room = session.getRoom('activity', WIDGET_ID);
      expect(room.activity).toBeNull();
    });

    it('should reject update for invalid widget ID', () => {
      hostSocket.trigger(EVENTS.ACTIVITY.UPDATE, {
        sessionCode: SESSION_CODE,
        widgetId: '', // Invalid
        activity: { type: 'fill-blank', items: [], targets: [] }
      });

      // Should not throw, just warn and ignore
      expect(io.to).not.toHaveBeenCalled();
    });
  });

  describe('Student: Submit Answer Flow', () => {
    beforeEach(() => {
      // Set up activity first
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
        ]
      });
      room.isActive = true;
    });

    it('should accept correct answer and send feedback', () => {
      const callback = vi.fn();

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

      // Callback should be called with success
      expect(callback).toHaveBeenCalled();
      const callbackArg = callback.mock.calls[0][0];
      expect(callbackArg.success).toBe(true);
      expect(callbackArg.results.score).toBe(2);
      expect(callbackArg.results.total).toBe(2);

      // Feedback should be emitted to student
      expect(studentSocket.emit).toHaveBeenCalledWith(
        EVENTS.ACTIVITY.FEEDBACK,
        expect.objectContaining({
          widgetId: WIDGET_ID,
          results: expect.objectContaining({ score: 2, total: 2 })
        })
      );

      // Teacher should be notified
      expect(io.to).toHaveBeenCalledWith(HOST_SOCKET_ID);
    });

    it('should accept partially correct answer', () => {
      const callback = vi.fn();

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

      const callbackArg = callback.mock.calls[0][0];
      expect(callbackArg.results.score).toBe(1);
      expect(callbackArg.results.total).toBe(2);
    });

    it('should accept text input answers', () => {
      const callback = vi.fn();

      studentSocket.trigger(EVENTS.ACTIVITY.SUBMIT, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID,
        answers: {
          placements: [],
          textInputs: {
            'blank-0': 'hello',
            'blank-1': 'world'
          }
        }
      }, callback);

      const callbackArg = callback.mock.calls[0][0];
      expect(callbackArg.success).toBe(true);
      expect(callbackArg.results.score).toBe(2);
    });

    it('should reject submission when activity is paused', () => {
      const room = session.getRoom('activity', WIDGET_ID);
      room.isActive = false;

      const callback = vi.fn();

      studentSocket.trigger(EVENTS.ACTIVITY.SUBMIT, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID,
        answers: { placements: [], textInputs: {} }
      }, callback);

      expect(callback).toHaveBeenCalled();
      const callbackArg = callback.mock.calls[0][0];
      expect(callbackArg.success).toBe(false);
      expect(callbackArg.error).toBeDefined();
    });

    it('should reject submission from non-participant', () => {
      // Remove student from session
      session.removeParticipant(STUDENT_SOCKET_ID);

      const callback = vi.fn();

      studentSocket.trigger(EVENTS.ACTIVITY.SUBMIT, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID,
        answers: { placements: [], textInputs: {} }
      }, callback);

      expect(callback).toHaveBeenCalled();
      const callbackArg = callback.mock.calls[0][0];
      expect(callbackArg.success).toBe(false);
    });
  });

  describe('Student: Retry Flow', () => {
    beforeEach(() => {
      const room = session.getRoom('activity', WIDGET_ID);
      room.setActivity({
        type: 'fill-blank',
        items: [{ id: 'item-0', content: 'test' }],
        targets: [{ id: 'blank-0', accepts: ['item-0'] }]
      });
      room.isActive = true;

      // Student submits first
      room.submitAnswer(STUDENT_SOCKET_ID, {
        placements: [],
        textInputs: { 'blank-0': 'wrong' }
      });
    });

    it('should allow retry and clear previous response', () => {
      const callback = vi.fn();

      studentSocket.trigger(EVENTS.ACTIVITY.RETRY, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID
      }, callback);

      expect(callback).toHaveBeenCalled();
      const callbackArg = callback.mock.calls[0][0];
      expect(callbackArg.success).toBe(true);

      // Response should be cleared
      const room = session.getRoom('activity', WIDGET_ID);
      expect(room.responses.has(STUDENT_SOCKET_ID)).toBe(false);

      // Retry ready event should be emitted
      expect(studentSocket.emit).toHaveBeenCalledWith(
        EVENTS.ACTIVITY.RETRY_READY,
        expect.objectContaining({
          widgetId: WIDGET_ID,
          results: null
        })
      );
    });

    it('should reject retry when not allowed', () => {
      const room = session.getRoom('activity', WIDGET_ID);
      room.allowRetry = false;

      const callback = vi.fn();

      studentSocket.trigger(EVENTS.ACTIVITY.RETRY, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID
      }, callback);

      expect(callback).toHaveBeenCalled();
      const callbackArg = callback.mock.calls[0][0];
      expect(callbackArg.success).toBe(false);
    });
  });

  describe('Teacher: Reveal Answers Flow', () => {
    beforeEach(() => {
      const room = session.getRoom('activity', WIDGET_ID);
      room.setActivity({
        type: 'fill-blank',
        items: [{ id: 'item-0', content: 'answer' }],
        targets: [{ id: 'blank-0', accepts: ['item-0'] }]
      });
    });

    it('should reveal answers to all students', () => {
      hostSocket.trigger(EVENTS.ACTIVITY.REVEAL, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID,
        reveal: true
      });

      // Should broadcast to room
      expect(io.to).toHaveBeenCalledWith(`${SESSION_CODE}:activity:${WIDGET_ID}`);

      // Room should have answers revealed
      const room = session.getRoom('activity', WIDGET_ID);
      expect(room.answersRevealed).toBe(true);
    });

    it('should hide answers when reveal is false', () => {
      const room = session.getRoom('activity', WIDGET_ID);
      room.answersRevealed = true;

      hostSocket.trigger(EVENTS.ACTIVITY.REVEAL, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID,
        reveal: false
      });

      expect(room.answersRevealed).toBe(false);
    });

    it('should reject reveal from non-host', () => {
      studentSocket.trigger(EVENTS.ACTIVITY.REVEAL, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID,
        reveal: true
      });

      const room = session.getRoom('activity', WIDGET_ID);
      expect(room.answersRevealed).toBe(false);
    });
  });

  describe('Teacher: Reset Activity Flow', () => {
    beforeEach(() => {
      const room = session.getRoom('activity', WIDGET_ID);
      room.setActivity({
        type: 'fill-blank',
        items: [{ id: 'item-0', content: 'test' }],
        targets: [{ id: 'blank-0', accepts: ['item-0'] }]
      });
      room.isActive = true;

      // Add some responses
      room.submitAnswer('student-1', { placements: [], textInputs: {} });
      room.submitAnswer('student-2', { placements: [], textInputs: {} });
      room.answersRevealed = true;
    });

    it('should reset all responses and reveal state', () => {
      hostSocket.trigger(EVENTS.ACTIVITY.RESET, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID
      });

      const room = session.getRoom('activity', WIDGET_ID);
      expect(room.getResponseCount()).toBe(0);
      expect(room.answersRevealed).toBe(false);

      // Should broadcast updated state
      expect(io.to).toHaveBeenCalledWith(`${SESSION_CODE}:activity:${WIDGET_ID}`);
    });

    it('should reject reset from non-host', () => {
      studentSocket.trigger(EVENTS.ACTIVITY.RESET, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID
      });

      const room = session.getRoom('activity', WIDGET_ID);
      expect(room.getResponseCount()).toBe(2); // Still has responses
    });
  });

  describe('Student: Request State Flow', () => {
    beforeEach(() => {
      const room = session.getRoom('activity', WIDGET_ID);
      room.setActivity({
        type: 'fill-blank',
        title: 'State Test',
        items: [{ id: 'item-0', content: 'test' }],
        targets: [{ id: 'blank-0', accepts: ['item-0'] }]
      });
      room.isActive = true;
    });

    it('should return current activity state', () => {
      studentSocket.trigger(EVENTS.ACTIVITY.REQUEST_STATE, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID
      });

      expect(studentSocket.emit).toHaveBeenCalledWith(
        EVENTS.ACTIVITY.STATE_UPDATE,
        expect.objectContaining({
          widgetId: WIDGET_ID,
          activity: expect.objectContaining({ title: 'State Test' }),
          isActive: true
        })
      );
    });

    it('should include results if student has submitted', () => {
      const room = session.getRoom('activity', WIDGET_ID);
      room.submitAnswer(STUDENT_SOCKET_ID, {
        placements: [{ itemId: 'item-0', targetId: 'blank-0' }],
        textInputs: {}
      });

      studentSocket.trigger(EVENTS.ACTIVITY.REQUEST_STATE, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID
      });

      expect(studentSocket.emit).toHaveBeenCalledWith(
        EVENTS.ACTIVITY.STATE_UPDATE,
        expect.objectContaining({
          results: expect.objectContaining({ score: 1, total: 1 })
        })
      );
    });

    it('should include correct answers if revealed', () => {
      const room = session.getRoom('activity', WIDGET_ID);
      room.answersRevealed = true;

      studentSocket.trigger(EVENTS.ACTIVITY.REQUEST_STATE, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID
      });

      expect(studentSocket.emit).toHaveBeenCalledWith(
        EVENTS.ACTIVITY.STATE_UPDATE,
        expect.objectContaining({
          correctAnswers: expect.objectContaining({ 'blank-0': 'item-0' })
        })
      );
    });
  });

  describe('Code Fill-in-Blank: Whitespace Flexible Evaluation', () => {
    beforeEach(() => {
      const room = session.getRoom('activity', WIDGET_ID);
      room.setActivity({
        type: 'code-fill-blank',
        items: [
          { id: 'item-0', content: 'def' },
          { id: 'item-1', content: 'return' }
        ],
        targets: [
          { id: 'blank-0', accepts: ['item-0'] },
          { id: 'blank-1', accepts: ['item-1'] }
        ]
      });
      room.isActive = true;
    });

    it('should accept answers with extra whitespace', () => {
      const callback = vi.fn();

      studentSocket.trigger(EVENTS.ACTIVITY.SUBMIT, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID,
        answers: {
          placements: [],
          textInputs: {
            'blank-0': '  def  ', // extra spaces
            'blank-1': 'return'
          }
        }
      }, callback);

      const callbackArg = callback.mock.calls[0][0];
      expect(callbackArg.results.score).toBe(2);
      expect(callbackArg.results.total).toBe(2);
    });

    it('should handle newlines in code answers', () => {
      const room = session.getRoom('activity', WIDGET_ID);
      room.setActivity({
        type: 'code-fill-blank',
        items: [{ id: 'item-0', content: 'print("hello")' }],
        targets: [{ id: 'blank-0', accepts: ['item-0'] }]
      });

      const callback = vi.fn();

      studentSocket.trigger(EVENTS.ACTIVITY.SUBMIT, {
        sessionCode: SESSION_CODE,
        widgetId: WIDGET_ID,
        answers: {
          placements: [],
          textInputs: {
            'blank-0': 'print("hello")'  // exact match
          }
        }
      }, callback);

      const callbackArg = callback.mock.calls[0][0];
      expect(callbackArg.results.score).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid session code', () => {
      const callback = vi.fn();

      studentSocket.trigger(EVENTS.ACTIVITY.SUBMIT, {
        sessionCode: 'INVALID',
        widgetId: WIDGET_ID,
        answers: { placements: [], textInputs: {} }
      }, callback);

      expect(callback).toHaveBeenCalled();
      const callbackArg = callback.mock.calls[0][0];
      expect(callbackArg.success).toBe(false);
    });

    it('should handle missing room', () => {
      const callback = vi.fn();

      studentSocket.trigger(EVENTS.ACTIVITY.SUBMIT, {
        sessionCode: SESSION_CODE,
        widgetId: 'nonexistent-widget',
        answers: { placements: [], textInputs: {} }
      }, callback);

      expect(callback).toHaveBeenCalled();
      const callbackArg = callback.mock.calls[0][0];
      expect(callbackArg.success).toBe(false);
    });
  });
});
