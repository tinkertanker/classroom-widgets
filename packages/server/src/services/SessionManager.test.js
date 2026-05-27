const test = require('node:test');
const assert = require('node:assert/strict');
const SessionManager = require('./SessionManager');
const { TIME } = require('../config/constants');

test('cleanupInactiveSessions keeps old sessions with connected participants', () => {
  const manager = new SessionManager();
  try {
    const session = manager.createSession();
    session.addParticipant('student-socket', 'Student', 'student-1');
    session.lastActivity = Date.now() - TIME.INACTIVITY_TIMEOUT - 1000;

    manager.cleanupInactiveSessions();

    assert.equal(manager.getSession(session.code), session);
  } finally {
    manager.stopCleanupInterval();
  }
});

test('cleanupInactiveSessions deletes old sessions with no participants', () => {
  const manager = new SessionManager();
  try {
    const session = manager.createSession();
    session.lastActivity = Date.now() - TIME.INACTIVITY_TIMEOUT - 1000;

    manager.cleanupInactiveSessions();

    assert.equal(manager.getSession(session.code), undefined);
  } finally {
    manager.stopCleanupInterval();
  }
});
