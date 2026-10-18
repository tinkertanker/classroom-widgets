const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const serverConfig = require('../config/server.config');
const { getClientIp, ipRateLimit, ipMissRateLimit, pendingCleanupHandles, stopRateLimiterCleanup } = require('./rateLimit');

function fakeRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    set(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function fakeReq(ip, headers = {}) {
  return { headers, socket: { remoteAddress: ip } };
}

describe('getClientIp', () => {
  const original = serverConfig.TRUST_PROXY;
  afterEach(() => { serverConfig.TRUST_PROXY = original; });

  it('ignores X-Forwarded-For when no proxy is trusted', () => {
    serverConfig.TRUST_PROXY = 0;
    assert.equal(getClientIp({ 'x-forwarded-for': '1.2.3.4' }, '10.0.0.1'), '10.0.0.1');
  });

  it('uses the hop nearest the trusted proxy when TRUST_PROXY is set', () => {
    serverConfig.TRUST_PROXY = 1;
    assert.equal(getClientIp({ 'x-forwarded-for': '9.9.9.9, 1.2.3.4' }, '10.0.0.1'), '1.2.3.4');
  });

  it('falls back to the remote address on a malformed header', () => {
    serverConfig.TRUST_PROXY = 1;
    assert.equal(getClientIp({ 'x-forwarded-for': 'not-an-ip' }, '10.0.0.1'), '10.0.0.1');
  });
});

describe('ipRateLimit', () => {
  afterEach(() => stopRateLimiterCleanup());

  it('returns 429 with Retry-After once the per-IP limit is exceeded', () => {
    const middleware = ipRateLimit({ windowMs: 60_000, max: 2 });
    let nextCalls = 0;
    const next = () => { nextCalls += 1; };

    middleware(fakeReq('10.0.0.1'), fakeRes(), next);
    middleware(fakeReq('10.0.0.1'), fakeRes(), next);
    assert.equal(nextCalls, 2);

    const res = fakeRes();
    middleware(fakeReq('10.0.0.1'), res, next);
    assert.equal(nextCalls, 2);
    assert.equal(res.statusCode, 429);
    assert.equal(res.body.error, 'RATE_LIMITED');
    assert.ok(Number(res.headers['Retry-After']) >= 1);

    // A different IP is unaffected
    middleware(fakeReq('10.0.0.2'), fakeRes(), next);
    assert.equal(nextCalls, 3);
  });
});

describe('ipRateLimit timers and windows', () => {
  it('registers unrefed cleanup timers with the shared shutdown registry', (t) => {
    t.after(() => stopRateLimiterCleanup());
    const initialHandleCount = pendingCleanupHandles.length;

    assert.equal(typeof ipRateLimit({ windowMs: 10_000, max: 20 }), 'function');
    assert.equal(typeof ipMissRateLimit({ windowMs: 60_000, max: 3 }), 'function');

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
    const body = { error: 'Too many voice command requests. Please slow down.' };
    const middleware = ipRateLimit({ windowMs: 2500, max: 2 }, { body });
    let nextCalls = 0;
    const run = (ip) => {
      const res = fakeRes();
      middleware(fakeReq(ip), res, () => { nextCalls += 1; });
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
    assert.equal(blocked.headers['Retry-After'], '2');
    assert.deepEqual(blocked.body, body);

    run('10.0.0.2');
    assert.equal(nextCalls, 3);

    // Existing windows expire strictly after windowMs, not at the boundary.
    t.mock.timers.tick(1499);
    const boundary = run('10.0.0.1');
    assert.equal(boundary.statusCode, 429);
    // Never advertise Retry-After: 0 while still refusing the request.
    assert.equal(boundary.headers['Retry-After'], '1');
    assert.equal(nextCalls, 3);

    t.mock.timers.tick(1);
    run('10.0.0.1');
    run('10.0.0.1');
    assert.equal(nextCalls, 5);
    const resetLimit = run('10.0.0.1');
    assert.equal(resetLimit.statusCode, 429);
    assert.equal(resetLimit.headers['Retry-After'], '3');
    assert.equal(nextCalls, 5);

    // The second IP's later window must retain its earlier request count.
    run('10.0.0.2');
    assert.equal(nextCalls, 6);
    const otherLimit = run('10.0.0.2');
    assert.equal(otherLimit.statusCode, 429);
    assert.equal(otherLimit.headers['Retry-After'], '1');
    assert.equal(nextCalls, 6);
  });
});


describe('ipMissRateLimit', () => {
  afterEach(() => stopRateLimiterCleanup());

  it('only counts requests the handler marks as misses', () => {
    const middleware = ipMissRateLimit({ windowMs: 60_000, max: 2 });
    const run = (ip, miss) => {
      const req = fakeReq(ip);
      const res = fakeRes();
      let passed = false;
      middleware(req, res, () => {
        passed = true;
        if (miss) req.rateLimitMiss();
      });
      return { passed, res };
    };

    // Hits never consume the budget
    for (let i = 0; i < 20; i++) assert.equal(run('10.0.0.1', false).passed, true);

    assert.equal(run('10.0.0.1', true).passed, true);
    assert.equal(run('10.0.0.1', true).passed, true);

    const blocked = run('10.0.0.1', false);
    assert.equal(blocked.passed, false);
    assert.equal(blocked.res.statusCode, 429);

    assert.equal(run('10.0.0.2', true).passed, true);
  });
});
