const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { eventRateLimiter, createEventRateLimiter, createIpRateLimiter, EVENT_RATE_LIMITS, socketAuth } = require('./socketAuth');
const { pendingCleanupHandles, stopRateLimiterCleanup } = require('./rateLimit');
const { EVENTS, LIMITS } = require('../config/constants');

function fakeSocket(id, ip = '10.0.0.1') {
  return { id, clientIP: ip };
}

describe('createIpRateLimiter', () => {
  it('registers unrefed cleanup timers with the shared shutdown registry', (t) => {
    t.after(() => stopRateLimiterCleanup());
    const initialHandleCount = pendingCleanupHandles.length;

    assert.equal(typeof createIpRateLimiter({ windowMs: 10_000, max: 20 }), 'function');
    assert.equal(typeof createIpRateLimiter({ windowMs: 60_000, max: 3 }), 'function');

    const newHandles = pendingCleanupHandles.slice(initialHandleCount);
    assert.equal(newHandles.length, 2);
    assert.notEqual(newHandles[0], newHandles[1]);
    for (const handle of newHandles) {
      assert.equal(handle.hasRef(), false);
    }

    const handles = [...pendingCleanupHandles];
    const clear = t.mock.method(global, 'clearInterval');
    stopRateLimiterCleanup();

    assert.equal(pendingCleanupHandles.length, 0);
    assert.equal(clear.mock.callCount(), handles.length);
    assert.deepEqual(new Set(clear.mock.calls.map(call => call.arguments[0])), new Set(handles));

    // Shutdown may be requested more than once; no handle should be cleared twice.
    stopRateLimiterCleanup();
    assert.equal(clear.mock.callCount(), handles.length);
  });

  it('preserves per-IP counts, Retry-After rounding and the window expiry boundary', (t) => {
    t.after(() => stopRateLimiterCleanup());
    t.mock.timers.enable({ apis: ['Date'] });
    const middleware = createIpRateLimiter({ windowMs: 2500, max: 2 });
    let nextCalls = 0;
    const run = (ip) => {
      const res = {
        statusCode: 200,
        headers: {},
        body: undefined,
        set(name, value) { this.headers[name] = value; return this; },
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
      };
      middleware({ ip }, res, () => { nextCalls += 1; });
      return res;
    };

    const first = run('10.0.0.1');
    assert.equal(first.statusCode, 200);
    assert.equal(first.body, undefined);
    assert.deepEqual(first.headers, {});
    run('10.0.0.1');
    assert.equal(nextCalls, 2);

    t.mock.timers.tick(1001);
    const blocked = run('10.0.0.1');
    assert.equal(nextCalls, 2);
    assert.equal(blocked.statusCode, 429);
    assert.equal(blocked.headers['Retry-After'], 2);
    assert.deepEqual(blocked.body, { error: 'Too many voice command requests. Please slow down.' });

    run('10.0.0.2');
    assert.equal(nextCalls, 3);

    // Existing windows expire strictly after windowMs, not at the boundary.
    t.mock.timers.tick(1499);
    const boundary = run('10.0.0.1');
    assert.equal(boundary.statusCode, 429);
    assert.equal(boundary.headers['Retry-After'], 0);
    assert.equal(nextCalls, 3);

    t.mock.timers.tick(1);
    run('10.0.0.1');
    run('10.0.0.1');
    assert.equal(nextCalls, 5);
    const resetLimit = run('10.0.0.1');
    assert.equal(resetLimit.statusCode, 429);
    assert.equal(resetLimit.headers['Retry-After'], 3);
    assert.equal(nextCalls, 5);

    // The second IP's later window must retain its earlier request count.
    run('10.0.0.2');
    assert.equal(nextCalls, 6);
    const otherLimit = run('10.0.0.2');
    assert.equal(otherLimit.statusCode, 429);
    assert.equal(otherLimit.headers['Retry-After'], 1);
    assert.equal(nextCalls, 6);
  });
});

describe('eventRateLimiter', () => {
  const EVENT = 'session:poll:vote'; // 2 per 1000ms
  let socket;
  let counter = 0;

  beforeEach(() => {
    // Unique socket per test so state never leaks between tests
    socket = fakeSocket(`sock-${++counter}`);
  });

  it('fails closed for events with no configured limit', () => {
    const result = eventRateLimiter(socket, 'session:not:configured');
    assert.equal(result.allowed, false);
    assert.ok(result.retryAfter > 0);
  });

  it('has a configured limit for every rate-limited handler event', () => {
    const limited = [
      EVENTS.SESSION.CREATE,
      EVENTS.SESSION.JOIN,
      EVENTS.ACTIVITY.SUBMIT,
      EVENTS.ACTIVITY.RETRY,
      EVENTS.ACTIVITY.REQUEST_STATE,
      EVENTS.POLL.VOTE,
      EVENTS.LINK_SHARE.SUBMIT,
      EVENTS.RT_FEEDBACK.SUBMIT,
      EVENTS.QUESTIONS.SUBMIT
    ];
    for (const event of limited) {
      assert.ok(EVENT_RATE_LIMITS[event], `missing limit for ${event}`);
    }
  });

  it('counts ip-scoped events across connections from the same IP', () => {
    const limiter = createEventRateLimiter({
      'session:create': { windowMs: 60_000, max: 2, scope: 'ip' }
    });
    assert.equal(limiter(fakeSocket('a', '10.9.9.9'), 'session:create').allowed, true);
    assert.equal(limiter(fakeSocket('b', '10.9.9.9'), 'session:create').allowed, true);
    assert.equal(limiter(fakeSocket('c', '10.9.9.9'), 'session:create').allowed, false);
    assert.equal(limiter(fakeSocket('d', '10.9.9.8'), 'session:create').allowed, true);
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
});
