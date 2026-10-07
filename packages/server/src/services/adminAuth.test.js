const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createAdminAuth, SESSION_COOKIE } = require('./adminAuth');

// Ways admin auth can fail, written before the implementation:
// - a cookie whose payload, signature or format was tampered with is accepted
// - a cookie signed with another (or an empty, publicly computable) secret is accepted
// - an expired cookie is accepted
// - removing ADMIN_TOKEN does not revoke a live cookie
// - changing ADMIN_TOKEN to a different value does not revoke a live cookie
// - the token itself ends up readable in the cookie
// - sign-in works while ADMIN_TOKEN is unset, or with the wrong password

const NOW = Date.UTC(2026, 9, 6, 12);
const TOKEN = 'correct-token';

function createAuth(env = {}) {
  const auth = createAdminAuth({
    env: { ADMIN_SESSION_SECRET: 'test-session-secret-that-is-long-enough', ...env },
    now: () => auth.clock
  });
  auth.clock = NOW;
  return auth;
}

// Runs each test with ADMIN_TOKEN set, restoring the original afterwards.
function withToken(token, fn) {
  return async (t) => {
    const previous = process.env.ADMIN_TOKEN;
    t.after(() => {
      if (previous === undefined) delete process.env.ADMIN_TOKEN;
      else process.env.ADMIN_TOKEN = previous;
    });
    if (token === undefined) delete process.env.ADMIN_TOKEN;
    else process.env.ADMIN_TOKEN = token;
    await fn(t);
  };
}

const cookieHeader = (value) => `other=1; ${SESSION_COOKIE}=${value}`;
const IDENTITY = { email: 'admin-token' };

function forgeCookie(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

test('a cookie issued after password sign-in reads back while it is valid', withToken(TOKEN, () => {
  const auth = createAuth();
  const value = auth.issueSessionCookie(auth.loginWithToken(TOKEN));
  assert.deepEqual(auth.readSession(cookieHeader(value)), IDENTITY);
}));

test('tampered, malformed and foreign-secret cookies are rejected without throwing', withToken(TOKEN, () => {
  const auth = createAuth();
  const value = auth.issueSessionCookie(IDENTITY);
  const [body, signature] = value.split('.');
  const swapped = Buffer.from(JSON.stringify({
    ...JSON.parse(Buffer.from(body, 'base64url').toString()),
    email: 'other@example.com'
  })).toString('base64url');

  const rejected = [
    `${swapped}.${signature}`,
    `${body}.`,
    `${body}`,
    `${body}.${signature}x`,
    '...',
    '%%%.%%%',
    `${Buffer.from('not json').toString('base64url')}.${signature}`,
    forgeCookie({ ...IDENTITY, exp: NOW + 60_000 }, 'some-other-secret')
  ];
  for (const candidate of rejected) {
    assert.equal(auth.readSession(cookieHeader(candidate)), null, candidate);
  }
  assert.equal(auth.readSession(undefined), null);
  assert.equal(auth.readSession(''), null);
}));

test('a blank session secret is never used to sign cookies', withToken(TOKEN, () => {
  const auth = createAuth({ ADMIN_SESSION_SECRET: '   ' });
  const forged = forgeCookie({ ...IDENTITY, exp: NOW + 60_000 }, '   ');
  const forgedEmpty = forgeCookie({ ...IDENTITY, exp: NOW + 60_000 }, '');
  assert.equal(auth.readSession(cookieHeader(forged)), null);
  assert.equal(auth.readSession(cookieHeader(forgedEmpty)), null);

  // A per-process random secret still lets sign-in work until a restart.
  const value = auth.issueSessionCookie(IDENTITY);
  assert.deepEqual(auth.readSession(cookieHeader(value)), IDENTITY);
}));

test('an expired cookie is rejected', withToken(TOKEN, () => {
  const auth = createAuth();
  const value = auth.issueSessionCookie(IDENTITY);
  auth.clock = NOW + auth.sessionMaxAgeMs + 1;
  assert.equal(auth.readSession(cookieHeader(value)), null);
}));

test('password sign-in needs ADMIN_TOKEN configured and matched', withToken(undefined, () => {
  const auth = createAuth();
  assert.equal(auth.tokenLoginEnabled(), false);
  assert.equal(auth.loginWithToken('undefined'), null);
  assert.equal(auth.loginWithToken(''), null);

  process.env.ADMIN_TOKEN = TOKEN;
  assert.equal(auth.tokenLoginEnabled(), true);
  assert.equal(auth.loginWithToken('wrong-token'), null);
  assert.deepEqual(auth.loginWithToken(TOKEN), IDENTITY);
}));

test('removing ADMIN_TOKEN revokes an existing cookie', withToken(TOKEN, () => {
  const auth = createAuth();
  const value = auth.issueSessionCookie(IDENTITY);
  assert.deepEqual(auth.readSession(cookieHeader(value)), IDENTITY);
  delete process.env.ADMIN_TOKEN;
  assert.equal(auth.readSession(cookieHeader(value)), null);
}));

test('changing ADMIN_TOKEN revokes cookies issued under the old value', withToken('old-token', () => {
  const secret = 'shared-secret-across-restarts';
  const before = createAuth({ ADMIN_SESSION_SECRET: secret });
  const value = before.issueSessionCookie(IDENTITY);
  assert.deepEqual(before.readSession(cookieHeader(value)), IDENTITY);

  process.env.ADMIN_TOKEN = 'new-token';
  const after = createAuth({ ADMIN_SESSION_SECRET: secret });
  assert.equal(after.readSession(cookieHeader(value)), null);
  assert.equal(before.readSession(cookieHeader(value)), null);

  // The new value signs in fine, and its cookie works.
  const fresh = after.issueSessionCookie(IDENTITY);
  assert.deepEqual(after.readSession(cookieHeader(fresh)), IDENTITY);

}));

test('the cookie never contains the token', withToken(TOKEN, () => {
  const auth = createAuth();
  const [body] = auth.issueSessionCookie(IDENTITY).split('.');
  assert.ok(!Buffer.from(body, 'base64url').toString().includes(TOKEN));
}));
