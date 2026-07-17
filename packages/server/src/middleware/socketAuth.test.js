const { describe, it, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { eventRateLimiter, EVENT_RATE_LIMITS, socketAuth } = require('./socketAuth');
const { LIMITS } = require('../config/constants');

function fakeSocket(id, ip = '10.0.0.1') {
  return { id, clientIP: ip };
}

describe('eventRateLimiter', () => {
  const EVENT = 'session:poll:vote'; // 2 per 1000ms
  let socket;
  let counter = 0;

  beforeEach(() => {
    // Unique socket per test so state never leaks between tests
    socket = fakeSocket(`sock-${++counter}`);
  });

  it('allows events with no configured limit', () => {
    for (let i = 0; i < 50; i++) {
      assert.equal(eventRateLimiter(socket, 'session:activity:submit').allowed, true);
    }
  });

  it('blocks the request just past the limit and reports retryAfter', () => {
    const { max, windowMs } = EVENT_RATE_LIMITS[EVENT];

    for (let i = 0; i < max; i++) {
      assert.equal(eventRateLimiter(socket, EVENT).allowed, true, `request ${i + 1} within limit`);
    }

    const blocked = eventRateLimiter(socket, EVENT);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfter > 0 && blocked.retryAfter <= windowMs);
  });

  it('resets the window after windowMs elapses', (t) => {
    t.mock.timers.enable({ apis: ['Date'] });
    const { max, windowMs } = EVENT_RATE_LIMITS[EVENT];

    for (let i = 0; i < max; i++) {
      eventRateLimiter(socket, EVENT);
    }
    assert.equal(eventRateLimiter(socket, EVENT).allowed, false);

    t.mock.timers.tick(windowMs + 1);

    assert.equal(eventRateLimiter(socket, EVENT).allowed, true);
  });

  it('tracks limits per client, not globally', () => {
    const other = fakeSocket('sock-other', '10.0.0.2');
    const { max } = EVENT_RATE_LIMITS[EVENT];

    for (let i = 0; i < max; i++) {
      eventRateLimiter(socket, EVENT);
    }
    assert.equal(eventRateLimiter(socket, EVENT).allowed, false);
    assert.equal(eventRateLimiter(other, EVENT).allowed, true);
  });

  it('tracks limits per event for the same client', () => {
    const vote = 'session:poll:vote';
    const question = 'session:questions:submit';

    for (let i = 0; i < EVENT_RATE_LIMITS[vote].max; i++) {
      eventRateLimiter(socket, vote);
    }
    assert.equal(eventRateLimiter(socket, vote).allowed, false);
    assert.equal(eventRateLimiter(socket, question).allowed, true);
  });
});

describe('socketAuth middleware', () => {
  it('rejects connections when the server is at capacity', () => {
    const sessionManager = {
      getStats: () => ({ totalParticipants: LIMITS.MAX_TOTAL_PARTICIPANTS })
    };
    const middleware = socketAuth(sessionManager);
    const socket = { handshake: { address: '10.0.0.1' } };

    let error;
    middleware(socket, (err) => { error = err; });

    assert.ok(error instanceof Error);
    assert.match(error.message, /capacity/);
  });

  it('accepts connections below capacity and initializes metadata', () => {
    const sessionManager = {
      getStats: () => ({ totalParticipants: 0 })
    };
    const middleware = socketAuth(sessionManager);
    const socket = { handshake: { address: '10.0.0.1' } };

    let error = 'not called';
    middleware(socket, (err) => { error = err; });

    assert.equal(error, undefined);
    assert.equal(socket.clientIP, '10.0.0.1');
    assert.equal(socket.metadata.isHost, false);
    assert.equal(socket.metadata.sessionCode, null);
  });
});
