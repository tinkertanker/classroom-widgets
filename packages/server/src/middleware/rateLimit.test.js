const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const serverConfig = require('../config/server.config');
const { getClientIp, ipRateLimit, stopRateLimiterCleanup } = require('./rateLimit');

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
