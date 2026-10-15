const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Session = require('./Session');
const ActivityRoom = require('./ActivityRoom');

describe('Session', () => {
  let session;

  beforeEach(() => {
    session = new Session('ABCDE');
  });

  describe('createRoom', () => {
    it('throws on duplicate rooms instead of silently replacing state', () => {
      session.createRoom('poll', 'w-1');
      assert.throws(() => session.createRoom('poll', 'w-1'), /Room already exists/);
    });

    it('throws on unknown room types', () => {
      assert.throws(() => session.createRoom('nonsense', 'w-1'), /Unknown room type/);
    });

    it('allows same widget id across different room types', () => {
      session.createRoom('poll', 'w-1');
      session.createRoom('questions', 'w-1');
      assert.ok(session.getRoom('poll', 'w-1'));
      assert.ok(session.getRoom('questions', 'w-1'));
    });

    it('propagates the host socket to created rooms', () => {
      session.hostSocketId = 'host-1';
      const room = session.createRoom('activity', 'w-1');
      assert.equal(room.hostSocketId, 'host-1');
      assert.ok(room instanceof ActivityRoom);
    });
  });

  describe('getActiveRooms', () => {
    it('reports full widget ids even when they contain a colon', () => {
      session.createRoom('poll', 'widget:with:colons');

      const [entry] = session.getActiveRooms();

      assert.equal(entry.roomType, 'poll');
      assert.equal(entry.widgetId, 'widget:with:colons');
    });

    it('reports undefined widgetId for widget-less rooms', () => {
      session.createRoom('poll', null);

      const [entry] = session.getActiveRooms();

      assert.equal(entry.roomType, 'poll');
      assert.equal(entry.widgetId, undefined);
    });
  });

  describe('participants', () => {
    it('removes participants from session and all rooms', () => {
      const room = session.createRoom('rtfeedback', 'w-1');
      session.addParticipant('sock-1', 'Ada', 'ada-1');
      room.addParticipant('sock-1', { name: 'Ada' });

      const removed = session.removeParticipant('sock-1');

      assert.equal(removed, true);
      assert.equal(session.getParticipantCount(), 0);
      assert.equal(room.getParticipantCount(), 0);
    });
  });

  describe('hostToken', () => {
    it('isValidHostToken accepts only the session\'s own token', () => {
      assert.equal(session.isValidHostToken(undefined), false);
      assert.equal(session.isValidHostToken(null), false);
      assert.equal(session.isValidHostToken(42), false);
      assert.equal(session.isValidHostToken('short'), false);
      assert.equal(session.isValidHostToken(session.hostToken + 'x'), false);
      assert.equal(session.isValidHostToken('a'.repeat(session.hostToken.length)), false);
      assert.equal(session.isValidHostToken(new Session('FGHIJ').hostToken), false);
      assert.equal(session.isValidHostToken(session.hostToken), true);
    });

    it('rotateHostToken issues a new token and invalidates the old one', () => {
      const oldToken = session.hostToken;

      const rotated = session.rotateHostToken();

      assert.equal(rotated, session.hostToken);
      assert.notEqual(rotated, oldToken);
      assert.equal(session.isValidHostToken(oldToken), false);
      assert.equal(session.isValidHostToken(rotated), true);
    });
  });
});
