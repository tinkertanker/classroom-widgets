const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const Session = require('../../models/Session');
const PollRoom = require('../../models/PollRoom');
const ActivityRoom = require('../../models/ActivityRoom');
const HandoutRoom = require('../../models/HandoutRoom');
const {
  GUARD_ERRORS,
  isHostRejection,
  resolveRoom,
  resolveHostRoom
} = require('./resolveHostRoom');

/**
 * Unit tests for the shared host/room resolution guard used by every widget
 * socket handler. The guard is the single place that decides *whether* an
 * event may proceed; each handler still owns *how* a rejection is surfaced,
 * so these tests pin down the decision and the returned room key only.
 */

const SESSION_CODE = 'TEST1';
const WIDGET_ID = 'widget-123';
const HOST_SOCKET = { id: 'host-socket-id' };
const STUDENT_SOCKET = { id: 'student-socket-id' };

describe('resolveHostRoom guard', () => {
  let session;

  beforeEach(() => {
    session = new Session(SESSION_CODE);
    session.setHost(HOST_SOCKET.id);
    session.createRoom('poll', WIDGET_ID);
    session.createRoom('activity', WIDGET_ID);
  });

  describe('resolveHostRoom - success', () => {
    it('resolves a poll room for the host', () => {
      const result = resolveHostRoom(session, HOST_SOCKET, 'poll', PollRoom, WIDGET_ID);

      assert.equal(result.ok, true);
      assert.equal(result.error, null);
      assert.equal(result.room, session.getRoom('poll', WIDGET_ID));
      assert.ok(result.room instanceof PollRoom);
      assert.equal(result.roomId, `poll:${WIDGET_ID}`);
    });

    it('resolves an activity room for the host', () => {
      const result = resolveHostRoom(session, HOST_SOCKET, 'activity', ActivityRoom, WIDGET_ID);

      assert.equal(result.ok, true);
      assert.equal(result.error, null);
      assert.equal(result.room, session.getRoom('activity', WIDGET_ID));
      assert.ok(result.room instanceof ActivityRoom);
      assert.equal(result.roomId, `activity:${WIDGET_ID}`);
    });

    it('returns the same room key the session builds internally', () => {
      // Including a widget-less room and a widget ID that itself contains ':'
      session.createRoom('handout');
      session.createRoom('handout', 'nested:widget');

      const unscoped = resolveHostRoom(session, HOST_SOCKET, 'handout', HandoutRoom, undefined);
      assert.equal(unscoped.ok, true);
      assert.equal(unscoped.roomId, 'handout');
      assert.equal(unscoped.roomId, session._roomKey('handout', undefined));

      const nested = resolveHostRoom(session, HOST_SOCKET, 'handout', HandoutRoom, 'nested:widget');
      assert.equal(nested.ok, true);
      assert.equal(nested.roomId, 'handout:nested:widget');
      assert.equal(nested.roomId, session._roomKey('handout', 'nested:widget'));
    });
  });

  describe('resolveHostRoom - rejections', () => {
    it('rejects with NO_SESSION when there is no session', () => {
      for (const [roomType, RoomClass] of [['poll', PollRoom], ['activity', ActivityRoom]]) {
        for (const missing of [undefined, null]) {
          const result = resolveHostRoom(missing, HOST_SOCKET, roomType, RoomClass, WIDGET_ID);

          assert.equal(result.ok, false);
          assert.equal(result.error, GUARD_ERRORS.NO_SESSION);
          assert.equal(result.room, null);
          assert.equal(result.roomId, null);
        }
      }
    });

    it('rejects with NOT_HOST when the socket is not the session host', () => {
      for (const [roomType, RoomClass] of [['poll', PollRoom], ['activity', ActivityRoom]]) {
        const result = resolveHostRoom(session, STUDENT_SOCKET, roomType, RoomClass, WIDGET_ID);

        assert.equal(result.ok, false);
        assert.equal(result.error, GUARD_ERRORS.NOT_HOST);
        assert.equal(result.room, null);
        assert.equal(result.roomId, null);
      }
    });

    it('rejects with NOT_HOST once the host socket has been replaced', () => {
      session.setHost('a-newer-host-socket');

      const result = resolveHostRoom(session, HOST_SOCKET, 'poll', PollRoom, WIDGET_ID);

      assert.equal(result.ok, false);
      assert.equal(result.error, GUARD_ERRORS.NOT_HOST);
    });

    it('rejects with NO_ROOM when the room does not exist', () => {
      for (const [roomType, RoomClass] of [['poll', PollRoom], ['activity', ActivityRoom]]) {
        const result = resolveHostRoom(session, HOST_SOCKET, roomType, RoomClass, 'no-such-widget');

        assert.equal(result.ok, false);
        assert.equal(result.error, GUARD_ERRORS.NO_ROOM);
        assert.equal(result.room, null);
        assert.equal(result.roomId, null);
      }
    });

    it('rejects with WRONG_ROOM_TYPE when the room is not of the expected class', () => {
      const pollAsActivity = resolveHostRoom(session, HOST_SOCKET, 'poll', ActivityRoom, WIDGET_ID);
      assert.equal(pollAsActivity.ok, false);
      assert.equal(pollAsActivity.error, GUARD_ERRORS.WRONG_ROOM_TYPE);
      assert.equal(pollAsActivity.room, null);
      assert.equal(pollAsActivity.roomId, null);

      const activityAsPoll = resolveHostRoom(session, HOST_SOCKET, 'activity', PollRoom, WIDGET_ID);
      assert.equal(activityAsPoll.ok, false);
      assert.equal(activityAsPoll.error, GUARD_ERRORS.WRONG_ROOM_TYPE);
    });

    it('checks the host before the room, matching the original guard order', () => {
      const result = resolveHostRoom(session, STUDENT_SOCKET, 'poll', PollRoom, 'no-such-widget');

      assert.equal(result.error, GUARD_ERRORS.NOT_HOST);
    });
  });

  describe('resolveRoom', () => {
    it('resolves for a non-host socket', () => {
      for (const [roomType, RoomClass] of [['poll', PollRoom], ['activity', ActivityRoom]]) {
        const result = resolveRoom(session, roomType, RoomClass, WIDGET_ID);

        assert.equal(result.ok, true);
        assert.equal(result.error, null);
        assert.equal(result.room, session.getRoom(roomType, WIDGET_ID));
        assert.equal(result.roomId, `${roomType}:${WIDGET_ID}`);
      }
    });

    it('rejects with NO_SESSION, NO_ROOM and WRONG_ROOM_TYPE like the host variant', () => {
      assert.equal(resolveRoom(undefined, 'poll', PollRoom, WIDGET_ID).error, GUARD_ERRORS.NO_SESSION);
      assert.equal(resolveRoom(session, 'poll', PollRoom, 'no-such-widget').error, GUARD_ERRORS.NO_ROOM);
      assert.equal(resolveRoom(session, 'activity', PollRoom, WIDGET_ID).error, GUARD_ERRORS.WRONG_ROOM_TYPE);
    });

    it('never rejects a non-host socket for being a non-host', () => {
      const result = resolveRoom(session, 'activity', ActivityRoom, WIDGET_ID);

      assert.equal(result.ok, true);
      assert.equal(isHostRejection(result.error), false);
    });
  });

  describe('isHostRejection', () => {
    it('is true only for the reasons the old `!session || hostSocketId !== socket.id` covered', () => {
      assert.equal(isHostRejection(GUARD_ERRORS.NO_SESSION), true);
      assert.equal(isHostRejection(GUARD_ERRORS.NOT_HOST), true);
      assert.equal(isHostRejection(GUARD_ERRORS.NO_ROOM), false);
      assert.equal(isHostRejection(GUARD_ERRORS.WRONG_ROOM_TYPE), false);
      assert.equal(isHostRejection(null), false);
      assert.equal(isHostRejection(undefined), false);
    });
  });
});
