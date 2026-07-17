const test = require('node:test');
const assert = require('node:assert/strict');
const SessionManager = require('./SessionManager');
const { TIME, LIMITS } = require('../config/constants');

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

test('createSession returns the existing session for a known code', () => {
  const manager = new SessionManager();
  try {
    const first = manager.createSession();
    const again = manager.createSession(first.code);

    assert.equal(again, first);
    assert.equal(manager.getStats().activeSessions, 1);
  } finally {
    manager.stopCleanupInterval();
  }
});

test('createSession generates unique codes', () => {
  const manager = new SessionManager();
  try {
    const codes = new Set();
    for (let i = 0; i < 50; i++) {
      codes.add(manager.createSession().code);
    }
    assert.equal(codes.size, 50);
  } finally {
    manager.stopCleanupInterval();
  }
});

test('createSession throws once MAX_SESSIONS is reached instead of growing without bound', () => {
  const manager = new SessionManager();
  try {
    for (let i = 0; i < LIMITS.MAX_SESSIONS; i++) {
      manager.sessions.set(`FAKE${i}`, { fake: true });
    }

    assert.throws(() => manager.createSession(), /capacity/);

    // Existing sessions must still be retrievable by code
    assert.ok(manager.createSession('FAKE0'));
  } finally {
    manager.stopCleanupInterval();
  }
});

test('findSessionByHost locates sessions and returns null otherwise', () => {
  const manager = new SessionManager();
  try {
    const session = manager.createSession();
    session.hostSocketId = 'host-42';

    assert.equal(manager.findSessionByHost('host-42'), session);
    assert.equal(manager.findSessionByHost('nobody'), null);
  } finally {
    manager.stopCleanupInterval();
  }
});

test('getStats aggregates participants and rooms across sessions', () => {
  const manager = new SessionManager();
  try {
    const a = manager.createSession();
    const b = manager.createSession();
    a.addParticipant('s1', 'Ada');
    a.addParticipant('s2', 'Grace');
    a.createRoom('poll', 'w-1');
    b.createRoom('questions', 'w-2');

    assert.deepEqual(manager.getStats(), {
      activeSessions: 2,
      totalParticipants: 2,
      totalRooms: 2
    });
  } finally {
    manager.stopCleanupInterval();
  }
});
